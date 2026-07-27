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
    /// Center of the "built pages" window. Follows `selection`, but debounced so
    /// the newly-admitted page is constructed on idle rather than mid-swipe.
    @State private var windowCenter: Int
    @State private var windowTask: Task<Void, Never>?

    private let stripHeight: CGFloat = 44
    /// How many pages either side of `windowCenter` stay built. Radius 2 (not 1)
    /// so that even when `windowCenter` is one behind `selection` — the window
    /// covers `center±2`, and a paging TabView only moves one page per gesture —
    /// the page you're swiping toward is always already built. No blank pages.
    private let pageWindowRadius = 2
    /// Long enough that page construction lands after the paging animation
    /// settles, short enough that a fast second swipe still finds its page built.
    private let windowSettleDelay: Duration = .milliseconds(200)

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
        self._windowCenter = State(initialValue: idx)
    }

    /// True when this page should be materialized. Everything outside the window
    /// renders as an empty placeholder that still carries its `.tag`, so the
    /// TabView's paging/index math is unchanged.
    private func isPageBuilt(_ idx: Int) -> Bool {
        abs(idx - windowCenter) <= pageWindowRadius
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

                // Single shared team glow, BEHIND the pages.
                //
                // It used to composite ABOVE the TabView with `.plusLighter`.
                // A non-normal blend mode makes the enclosing group
                // non-flattenable, so Core Animation had to render the entire
                // backdrop — two live pages and ~22 glass layers — into an
                // offscreen buffer and re-blend it every frame. That was the
                // single most expensive thing on this screen.
                //
                // Drawn over the opaque surface instead, with NO blend mode. On
                // the dark surface (0x0A0A0A) additive-over-black and
                // normal-over-that are near identical. The pages are
                // transparent (`transparentPage: true`) apart from their hero
                // band, so the glow still reads everywhere it used to.
                //
                // Cross-FADES between two static aura layers (identity keyed on
                // `selection`) instead of animating awayColor/homeColor. The
                // blobs cache themselves in a `drawingGroup`; animating their
                // colors invalidated that cache, so a matchup change re-ran two
                // large blurred blobs on every frame of the 0.45s transition.
                // Opacity is a free GPU op on the already-rasterized textures.
                ZStack {
                    TeamAuraBackground(awayColor: c.away, homeColor: c.home, progress: 0, showBase: false)
                        .id(selection)
                        .transition(.opacity)
                }
                .animation(.smooth(duration: 0.45), value: selection)
                .ignoresSafeArea()
                .allowsHitTesting(false)

                // Pages carousel — transparent and bled to ALL edges, so the
                // paging TabView reserves no opaque band at the top (under the
                // nav bar) or bottom (home indicator). Each page insets its own
                // hero/content via the passed safe-area values instead.
                TabView(selection: $selection) {
                    ForEach(Array(games.enumerated()), id: \.element.id) { idx, game in
                        // Only a small window around the current page is built.
                        // A paging TabView keeps every page it's given resident,
                        // so building the whole slate meant N heavy detail sheets
                        // — and N `.task` data loads — constructed before the push
                        // animation even ran. Building purely on demand fixes that
                        // but reintroduces per-swipe hitching, because the page is
                        // constructed mid-gesture. The window gets both: neighbors
                        // are always ready before you can reach them, and the rest
                        // of the slate costs nothing.
                        if isPageBuilt(idx) {
                            page(
                                game,
                                // Pull the hero up to sit just clear of the back
                                // chevron rather than below the whole nav bar.
                                max(12, topInset - 36),
                                // Clear the floating strip + the home indicator.
                                stripHeight + 24 + bottomInset
                            )
                            // Resident-but-not-selected pages drop their live
                            // glass for a flat fill (see `widgetPageIsCurrent`).
                            .environment(\.widgetPageIsCurrent, idx == selection)
                            .tag(idx)
                        } else {
                            Color.clear.tag(idx)
                        }
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .ignoresSafeArea()

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
        // Landing on a new matchup is the big beat on this screen, so it gets the
        // heavy impact — the per-section ticks while scrolling a page are light by
        // comparison (see `WidgetCollapsingSection`). Fires when the page settles,
        // and equally when a strip chip is tapped, since both change the matchup.
        .sensoryFeedback(.impact(weight: .heavy), trigger: selection)
        // Recenter the built-pages window after the swipe settles, so admitting a
        // new page never constructs a detail sheet during the paging animation.
        .onChange(of: selection) { _, new in
            windowTask?.cancel()
            windowTask = Task {
                try? await Task.sleep(for: windowSettleDelay)
                guard !Task.isCancelled else { return }
                windowCenter = new
            }
        }
        .onDisappear { windowTask?.cancel() }
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
                // Lazy: an eager HStack built every chip — two logo views each —
                // for the whole slate the moment the detail page opened.
                LazyHStack(spacing: 6) {
                    ForEach(Array(games.enumerated()), id: \.element.id) { idx, game in
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
