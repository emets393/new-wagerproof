import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// MLB Betting Trends list view, pushed from the Outliers hub. Ports
/// `wagerproof-mobile/app/(drawer)/(tabs)/mlb-betting-trends.tsx`.
///
/// Same shape as NBA/NCAAB trends, but the sort axis is ML dominance
/// (moneyline) instead of ATS — MLB lines don't have spread coverage in
/// the same way, so RN replaces the ATS pill with an ML pill.
struct MLBBettingTrendsView: View {
    @Environment(MainTabStore.self) private var tabStore
    @Environment(GamesStore.self) private var gamesStore
    @Environment(MLBGameSheetStore.self) private var mlbSheetStore
    @State private var store = MLBBettingTrendsStore()

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
        .navigationTitle("MLB Betting Trends")
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
            if store.games.isEmpty {
                await store.refresh()
            }
        }
        .sheet(item: $binding.selectedGame) { game in
            MLBBettingTrendsBottomSheet(game: game) {
                store.closeTrendsSheet()
            }
        }
    }

    private var explainer: some View {
        ToolExplainerBannerView(
            accentColor: Color(hex: 0x002D72),
            title: "MLB Betting Trends",
            titleIcon: "baseball.fill",
            headline: "162 games reveal the patterns.",
            description: "Situational win % and over/under trends at 60%+ across rest, matchup type, and recent form — edges the daily line doesn't always catch.",
            examples: [
                .init(icon: "figure.baseball", label: "Yankees ML after a loss", value: "64% (18-10)", valueColor: Color(hex: 0x22C55E)),
                .init(icon: "chart.line.uptrend.xyaxis", label: "Dodgers Over vs LHP", value: "67% (12-6)", valueColor: Color(hex: 0x22C55E)),
                .init(icon: "bed.double.fill", label: "Braves ML on full rest", value: "62% (15-9)", valueColor: Color(hex: 0x22C55E)),
            ]
        )
    }

    private var sortPills: some View {
        @Bindable var binding = store
        return HStack(spacing: 10) {
            sortPill(mode: .time, icon: "clock", label: "Time", binding: $binding.sortMode)
            sortPill(mode: .ouConsensus, icon: "chart.line.uptrend.xyaxis", label: "O/U", binding: $binding.sortMode)
            sortPill(mode: .mlDominance, icon: "chart.bar.fill", label: "ML", binding: $binding.sortMode)
            Spacer()
        }
        .sensoryFeedback(.selection, trigger: store.sortMode)
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
    private func sortPill(mode: MLBTrendsSortMode, icon: String, label: String, binding: Binding<MLBTrendsSortMode>) -> some View {
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

    @ViewBuilder
    private var content: some View {
        if store.loading && store.games.isEmpty {
            shimmer
        } else if let message = store.errorMessage, store.games.isEmpty {
            errorView(message)
        } else if store.games.isEmpty {
            empty
        } else {
            cards
        }
    }

    private var cards: some View {
        LazyVStack(spacing: 12) {
            // Enumerate so each card can cascade in via `.staggeredAppear`
            // when it replaces the skeleton.
            ForEach(Array(store.games.enumerated()), id: \.element.id) { index, game in
                MLBBettingTrendsMatchupCardView(game: game) {
                    openGamePage(for: game.gamePk)
                }
                .staggeredAppear(index: index)
            }
        }
        .padding(.horizontal, Spacing.lg)
    }

    /// Resolve `gamePk` to a typed `MLBGame` in `GamesStore`, open the MLB
    /// sheet store, jump to Games tab. Fall back to the in-tab trends sheet
    /// if not cached.
    private func openGamePage(for gamePk: Int) {
        if let mlbGame = gamesStore.games.mlb.first(where: { $0.gamePk == gamePk }) {
            mlbSheetStore.openGameSheet(mlbGame)
            tabStore.select(.games)
        } else if let trendsGame = store.games.first(where: { $0.gamePk == gamePk }) {
            store.openTrendsSheet(trendsGame)
        }
    }

    private var shimmer: some View {
        VStack(spacing: 12) {
            ForEach(0..<5, id: \.self) { _ in
                MLBBettingTrendsCardSkeleton()
            }
        }
        .padding(.horizontal, Spacing.lg)
        .transition(.opacity)
    }

    private var empty: some View {
        ContentUnavailableView {
            Label("No MLB trends today", systemImage: "baseball.fill")
        } description: {
            Text("Trends populate as today's MLB slate locks in. Pull to refresh.")
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

/// Skeleton placeholder for `MLBBettingTrendsMatchupCardView`. Mirrors the real
/// card's chrome exactly (26pt ultraThinMaterial surface, 0.5pt border, soft
/// shadow, 4pt top stripe) and drops Skeleton* primitives where the two team
/// columns (48pt avatar + abbr), the centered `@`/time pill, and the chevron
/// land — so the crossfade to loaded content never shifts layout.
///
/// The inner placeholder group carries the unified `.shimmering()` sweep; the
/// chrome stays solid (applied via `.background`/`.overlay` *after* the shimmer).
private struct MLBBettingTrendsCardSkeleton: View {
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
