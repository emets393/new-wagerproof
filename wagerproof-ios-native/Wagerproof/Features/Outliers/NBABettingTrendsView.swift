import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// NBA Betting Trends list view, pushed from the Outliers hub. Ports
/// `wagerproof-mobile/app/(drawer)/(tabs)/nba-betting-trends.tsx`.
///
/// Layout:
///   - Scrollable `LazyVStack` containing:
///     - `ToolExplainerBannerView` (Honeydew banner pattern, accent #0EA5E9)
///     - A row of sort pills (Time / O/U / ATS) bound to the store
///     - The matchup card list
///   - `.refreshable` re-hydrates the store
///   - Tapping a card opens `NBABettingTrendsBottomSheet` via the store's
///     `selectedGame` sheet binding
///
/// Why store-based selection: matches the RN pattern of a single in-tab
/// sheet that any card can open. We don't push another nav level — we
/// present a sheet — so back navigation still pops the hub→detail stack.
struct NBABettingTrendsView: View {
    @Environment(MainTabStore.self) private var tabStore
    @Environment(GamesStore.self) private var gamesStore
    @Environment(NBAGameSheetStore.self) private var nbaSheetStore
    @State private var store = NBABettingTrendsStore()

    var body: some View {
        @Bindable var binding = store
        ScrollView {
            LazyVStack(spacing: 8, pinnedViews: [.sectionHeaders]) {
                explainer
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                Section {
                    content
                } header: {
                    pinnedSortBar
                }
            }
            .padding(.bottom, Spacing.xxl)
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle("NBA Betting Trends")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await store.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .tint(Color.appPrimary)
                .accessibilityLabel("Refresh")
            }
        }
        .refreshable { await store.refresh() }
        .task {
            if case .idle = store.loadState {
                await store.refresh()
            }
        }
        .sheet(item: $binding.selectedGame) { game in
            NBABettingTrendsBottomSheet(game: game) {
                store.closeTrendsSheet()
            }
        }
    }

    // MARK: - Sections

    private var explainer: some View {
        ToolExplainerBannerView(
            accentColor: Color(hex: 0x0EA5E9),
            title: "NBA Betting Trends",
            titleIcon: "basketball.fill",
            headline: "Situations that keep paying off.",
            description: "Teams covering at 65%+ in specific situations — after wins, as favorites, on rest — patterns the line doesn't always price in.",
            examples: [
                .init(icon: "checkmark.shield.fill", label: "Celtics ATS after a loss", value: "72% (13-5)", valueColor: Color(hex: 0x22C55E)),
                .init(icon: "chart.line.uptrend.xyaxis", label: "Lakers Over as home favorite", value: "68% (11-5)", valueColor: Color(hex: 0x22C55E)),
                .init(icon: "bed.double.fill", label: "Nuggets ATS on 2+ days rest", value: "70% (9-4)", valueColor: Color(hex: 0x22C55E)),
            ]
        )
    }

    private var sortPills: some View {
        @Bindable var binding = store
        return HStack(spacing: 10) {
            sortPill(mode: .time, icon: "clock", label: "Time", binding: $binding.sortMode)
            sortPill(mode: .ouConsensus, icon: "chart.line.uptrend.xyaxis", label: "O/U", binding: $binding.sortMode)
            sortPill(mode: .atsDominance, icon: "chart.bar.fill", label: "ATS", binding: $binding.sortMode)
            Spacer()
        }
        .sensoryFeedback(.selection, trigger: store.sortMode)
    }

    @ViewBuilder
    private func sortPill(mode: NBABettingTrendsStore.SortMode, icon: String, label: String, binding: Binding<NBABettingTrendsStore.SortMode>) -> some View {
        let isActive = binding.wrappedValue == mode
        Button {
            binding.wrappedValue = mode
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .semibold))
                Text(label)
                    .font(.system(size: 13, weight: .semibold))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(isActive ? Color.appPrimary : Color.appSurfaceMuted)
            .foregroundStyle(isActive ? .white : Color.appTextPrimary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    /// Sort pills hosted in a pinned Liquid Glass capsule — the MLB feed
    /// shell's pinned-header treatment (matches GamesView/PropsView).
    private var pinnedSortBar: some View {
        sortPills
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .modifier(LiquidGlassCapsule())
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, 8)
            .background(Color.appSurface)
    }

    @ViewBuilder
    private var content: some View {
        switch store.loadState {
        case .idle, .loading:
            if store.games.isEmpty {
                shimmer
            } else {
                cards
            }
        case .loaded, .refreshing:
            if store.games.isEmpty {
                empty
            } else {
                cards
            }
        case .failed(let message):
            errorView(message)
        }
    }

    private var cards: some View {
        // VStack-of-cards instead of List — preserves the rounded matchup
        // card geometry from RN. Each card already has its own horizontal
        // padding via `padding(.horizontal, Spacing.lg)` here.
        LazyVStack(spacing: 12) {
            // Enumerate so each card can cascade in via `.staggeredAppear`
            // when it replaces the skeleton.
            ForEach(Array(store.games.enumerated()), id: \.element.id) { index, game in
                NBABettingTrendsMatchupCardView(game: game) {
                    openGamePage(for: game.gameId)
                }
                .staggeredAppear(index: index)
            }
        }
        .padding(.horizontal, Spacing.lg)
    }

    /// Resolve the trends game's `gameId` to the typed `NBAGame` in
    /// `GamesStore`, open the NBA sheet store, and jump to the Games tab so
    /// the user lands on the game detail page (pushed by `GamesView`'s
    /// `navigationDestination(item:)`). Falls back to the in-tab trends
    /// sheet if the game isn't in the cache.
    private func openGamePage(for gameId: Int) {
        let idString = String(gameId)
        if let nbaGame = gamesStore.games.nba.first(where: {
            $0.id == idString || String($0.gameId) == idString
        }) {
            nbaSheetStore.openGameSheet(nbaGame)
            tabStore.select(.games)
        } else if let trendsGame = store.games.first(where: { $0.gameId == gameId }) {
            store.openTrendsSheet(trendsGame)
        }
    }

    private var shimmer: some View {
        VStack(spacing: 12) {
            ForEach(0..<5, id: \.self) { _ in
                NBABettingTrendsCardSkeleton()
            }
        }
        .padding(.horizontal, Spacing.lg)
        .transition(.opacity)
    }

    private var empty: some View {
        ContentUnavailableView {
            Label("No NBA trends today", systemImage: "basketball.fill")
        } description: {
            Text("Trends populate as today's NBA slate locks in. Pull to refresh.")
        }
        .frame(minHeight: 260)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(Color.appLoss)
            Text(message)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)
            Button("Retry") { Task { await store.refresh() } }
                .buttonStyle(.borderedProminent)
                .tint(Color.appPrimary)
        }
        .frame(minHeight: 260)
    }
}

/// Skeleton placeholder for `NBABettingTrendsMatchupCardView`. Mirrors the real
/// card's chrome exactly (26pt ultraThinMaterial surface, 0.5pt border, soft
/// shadow, 4pt top stripe) and drops Skeleton* primitives where the two team
/// columns (48pt avatar + abbr), the centered `@`/tipoff pill, and the chevron
/// land — so the crossfade to loaded content never shifts layout.
///
/// The inner placeholder group carries the unified `.shimmering()` sweep; the
/// chrome stays solid (applied via `.background`/`.overlay` *after* the shimmer).
private struct NBABettingTrendsCardSkeleton: View {
    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 26, style: .continuous)
        VStack(spacing: 0) {
            // 4pt top stripe stand-in (real card uses a team-color gradient).
            SkeletonBlock(height: 4, cornerRadius: 0)

            HStack(alignment: .center, spacing: 12) {
                teamColumn
                centerColumn
                teamColumn
                // Trailing chevron — 14pt glyph footprint.
                SkeletonBlock(width: 8, height: 14, cornerRadius: 2)
            }
            .padding(.vertical, 16)
            .padding(.horizontal, 12)
        }
        .shimmering()
        .background(shape.fill(.ultraThinMaterial))
        .clipShape(shape)
        .overlay(shape.strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    private var teamColumn: some View {
        VStack(spacing: 6) {
            SkeletonCircle(48)
            SkeletonBlock(width: 32, height: 12)
        }
        .frame(maxWidth: .infinity)
    }

    private var centerColumn: some View {
        VStack(spacing: 6) {
            SkeletonBlock(width: 14, height: 18)
            SkeletonBlock(width: 56, height: 22, cornerRadius: 8)
        }
        .frame(maxWidth: .infinity)
    }
}

// FIDELITY-WAIVER #233: An `NBABettingTrendsBottomSheet` Swift view does
// not exist yet (only the situation-section building blocks are ported).
// Inline a minimal wrapper here so the screen still presents the per-game
// trends sheet. The wrapper renders the same five situation sections the
// RN sheet uses (last-game, fav/dog, side+fav/dog, rest bucket, rest comp)
// in the same order. Full RN parity for the bonus copy + how-to guide
// lands when the dedicated sheet view is ported alongside the NBA game
// bottom sheet rollout.
struct NBABettingTrendsBottomSheet: View {
    let game: NBAGameTrendsData
    var onClose: () -> Void = {}

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                headerCard
                NBATrendsSituationSection(
                    title: "Last Game Situation",
                    icon: "clock",
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    situationType: .lastGame,
                    tooltip: "How each team performs ATS and O/U after a win vs. after a loss."
                )
                NBATrendsSituationSection(
                    title: "Favorite/Underdog",
                    icon: "rosette",
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    situationType: .favDog,
                    tooltip: "Performance when favored vs. as underdog. Strong contrast suggests an edge."
                )
                NBATrendsSituationSection(
                    title: "Side Spread Situation",
                    icon: "house",
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    situationType: .sideFavDog,
                    tooltip: "Combines home/away with favorite/underdog role."
                )
                NBATrendsSituationSection(
                    title: "Rest Bucket",
                    icon: "calendar.badge.clock",
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    situationType: .restBucket,
                    tooltip: "Performance based on days of rest (1, 2-3, or 4+)."
                )
                NBATrendsSituationSection(
                    title: "Rest Comparison",
                    icon: "scale.3d",
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    situationType: .restComp,
                    tooltip: "Rest advantage vs. opponent."
                )
                Spacer().frame(height: 40)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
        }
        .background(Color.appSurface)
        .presentationDetents([.fraction(0.85), .large])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.disabled)
    }

    @ViewBuilder
    private var headerCard: some View {
        VStack(spacing: 0) {
            LinearGradient(
                colors: [
                    TeamColorPair.neutralNBA.primary,
                    TeamColorPair.neutralNBA.secondary,
                    TeamColorPair.neutralNBA.primary.opacity(0.85),
                    TeamColorPair.neutralNBA.secondary.opacity(0.85)
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 4)
            VStack(spacing: 16) {
                Text("Situational Betting Trends")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                HStack(alignment: .top, spacing: 12) {
                    teamColumn(name: game.awayTeam.teamName)
                    VStack(spacing: 8) {
                        Text("@")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary.opacity(0.5))
                        Text(formatTipoff(game.tipoffTime))
                            .font(.system(size: 12, weight: .semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 10))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    teamColumn(name: game.homeTeam.teamName)
                }
            }
            .padding(16)
        }
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(Color.appBorder, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func teamColumn(name: String) -> some View {
        VStack(spacing: 8) {
            GameCardTeamAvatar(teamName: name, sport: "nba", size: 64)
            Text(name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity)
    }

    private func formatTipoff(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "TBD" }
        return GameCardFormatting.convertTimeToEST(raw)
    }
}

