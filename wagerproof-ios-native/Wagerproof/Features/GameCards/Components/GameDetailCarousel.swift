import SwiftUI
import WagerproofDesign

/// Generic swipeable carousel of a sport's game-detail pages — the shared engine
/// behind every sport's matchup detail (MLB/NFL/CFB/NBA/NCAAB wrappers).
///
/// The page CONTENT carousels (each page is an opaque detail sheet rendered with
/// its own aura suppressed), while a SINGLE shared team-color glow sits fixed on
/// top (additive) so it doesn't swipe with the pages — it just re-tints smoothly
/// when the carousel settles on a new matchup. A floating Liquid Glass matchup
/// strip stays pinned at the bottom (replacing the tab bar) and updates to mark
/// which matchup you're on.
///
/// Safe areas: the whole thing bleeds to every edge (full-bleed glow, no toolbar
/// or home-indicator band); the real insets are read via `GeometryReader` and
/// handed to each page so the hero content clears the back button and the last
/// widget clears the strip.
///
/// Callers supply three closures:
///   - `teamColors`  → (away, home) glow colors for a game
///   - `chip`        → the bottom-strip chip for a game (and whether it's current)
///   - `page`        → the detail page for a game, given the top/bottom insets
struct GameDetailCarousel<G: Identifiable, Page: View, Chip: View>: View where G.ID: Hashable {
    let games: [G]
    var onClose: () -> Void = {}
    let teamColors: (G) -> (away: Color, home: Color)
    @ViewBuilder var chip: (_ game: G, _ isCurrent: Bool) -> Chip
    @ViewBuilder var page: (_ game: G, _ topInset: CGFloat, _ bottomInset: CGFloat) -> Page

    @State private var selection: Int

    private let stripHeight: CGFloat = 44

    init(
        games: [G],
        initialGame: G,
        onClose: @escaping () -> Void = {},
        teamColors: @escaping (G) -> (away: Color, home: Color),
        @ViewBuilder chip: @escaping (_ game: G, _ isCurrent: Bool) -> Chip,
        @ViewBuilder page: @escaping (_ game: G, _ topInset: CGFloat, _ bottomInset: CGFloat) -> Page
    ) {
        self.games = games
        self.onClose = onClose
        self.teamColors = teamColors
        self.chip = chip
        self.page = page
        let idx = games.firstIndex(where: { $0.id == initialGame.id }) ?? 0
        self._selection = State(initialValue: idx)
    }

    private var currentColors: (away: Color, home: Color) {
        guard games.indices.contains(selection) else { return (.clear, .clear) }
        return teamColors(games[selection])
    }

    var body: some View {
        let c = currentColors
        // Read the real safe-area insets so we can bleed the page fully to every
        // edge (full-bleed glow, no toolbar/home-indicator band) while still
        // insetting the hero content and the last widget by the exact amounts.
        GeometryReader { geo in
            let topInset = geo.safeAreaInsets.top
            let bottomInset = geo.safeAreaInsets.bottom
            ZStack {
                // Full-bleed base behind the pages.
                Color.appSurface.ignoresSafeArea()

                // Pages carousel — transparent and bled to ALL edges, so the
                // paging TabView reserves no opaque band at the top (under the
                // nav bar) or bottom (home indicator). Each page insets its own
                // hero/content via the passed safe-area values instead.
                TabView(selection: $selection) {
                    ForEach(Array(games.enumerated()), id: \.offset) { idx, game in
                        page(
                            game,
                            // Pull the hero up to sit just clear of the back
                            // chevron rather than below the whole nav bar.
                            max(12, topInset - 36),
                            // Clear the floating strip + the home indicator.
                            stripHeight + 24 + bottomInset
                        )
                        .tag(idx)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .ignoresSafeArea()

                // Single FIXED shared glow — additive over the pages so it shows
                // at the edges/top without occluding content, never swipes, and
                // the colors cross-fade when `selection` settles on a new matchup.
                TeamAuraBackground(awayColor: c.away, homeColor: c.home, progress: 0, showBase: false)
                    .ignoresSafeArea()
                    .blendMode(.plusLighter)
                    .opacity(0.9)
                    .allowsHitTesting(false)
                    .animation(.smooth(duration: 0.45), value: selection)

                // Floating matchup strip — fixed, never swipes; sits just above
                // the home indicator over the bled background.
                if games.count > 1 {
                    VStack {
                        Spacer()
                        matchupStrip
                            .padding(.horizontal, 14)
                            .padding(.bottom, bottomInset > 0 ? bottomInset : 12)
                    }
                    .ignoresSafeArea(.container, edges: .bottom)
                }
            }
        }
        // Replace the app tab bar with the matchup strip on detail pages.
        .toolbar(.hidden, for: .tabBar)
        // Transparent, inline nav bar: just the back chevron floats over the
        // glow — no title row or material band marking the toolbar area.
        .toolbarBackground(.hidden, for: .navigationBar)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Liquid Glass matchup strip (fixed, never swipes)

    @ViewBuilder
    private var matchupStrip: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(Array(games.enumerated()), id: \.offset) { idx, game in
                        chip(game, idx == selection)
                            .id(idx)
                            .contentShape(Capsule())
                            .onTapGesture {
                                // Set selection plainly — wrapping a paging
                                // TabView's programmatic selection in
                                // withAnimation while it's also driven by manual
                                // swipes desyncs the binding from the visible
                                // page (tapping then lands on the wrong game).
                                // The TabView animates the page change itself.
                                selection = idx
                            }
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
            }
            .frame(height: stripHeight)
            .liquidGlassBackground(in: Capsule())
            .onChange(of: selection) { _, new in
                withAnimation(.smooth(duration: 0.35)) { proxy.scrollTo(new, anchor: .center) }
            }
            .task { proxy.scrollTo(selection, anchor: .center) }
        }
    }
}

/// Default matchup-strip chip: away logo + "AWAY @ HOME" + home logo, in a
/// highlightable capsule. Sports pass their own logo view via `logo`.
struct CarouselMatchupChip<Logo: View>: View {
    let awayAbbr: String
    let homeAbbr: String
    let isCurrent: Bool
    @ViewBuilder var awayLogo: Logo
    @ViewBuilder var homeLogo: Logo

    init(
        awayAbbr: String,
        homeAbbr: String,
        isCurrent: Bool,
        @ViewBuilder awayLogo: () -> Logo,
        @ViewBuilder homeLogo: () -> Logo
    ) {
        self.awayAbbr = awayAbbr
        self.homeAbbr = homeAbbr
        self.isCurrent = isCurrent
        self.awayLogo = awayLogo()
        self.homeLogo = homeLogo()
    }

    var body: some View {
        HStack(spacing: 5) {
            awayLogo
            Text("\(awayAbbr) @ \(homeAbbr)")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(isCurrent ? Color.appTextPrimary : Color.appTextSecondary)
            homeLogo
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Capsule().fill(isCurrent ? Color.appPrimary.opacity(0.20) : Color.clear))
        .overlay(Capsule().stroke(isCurrent ? Color.appPrimary.opacity(0.55) : Color.clear, lineWidth: 1))
        .opacity(isCurrent ? 1 : 0.7)
    }
}
