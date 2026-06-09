import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// NCAAB Betting Trends list view, pushed from the Outliers hub. Ports
/// `wagerproof-mobile/app/(drawer)/(tabs)/ncaab-betting-trends.tsx`.
///
/// Same layout as the NBA variant — explainer banner, sort pills, matchup
/// cards — keyed off the NCAAB store. Tapping a card presents the existing
/// `NCAABBettingTrendsBottomSheet`.
struct NCAABBettingTrendsView: View {
    @Environment(MainTabStore.self) private var tabStore
    @Environment(GamesStore.self) private var gamesStore
    @Environment(NCAABGameSheetStore.self) private var ncaabSheetStore
    @State private var store = NCAABBettingTrendsStore()

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
        .navigationTitle("NCAAB Betting Trends")
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
            NCAABBettingTrendsBottomSheet(game: game) {
                store.closeTrendsSheet()
            }
        }
    }

    private var explainer: some View {
        ToolExplainerBannerView(
            accentColor: Color(hex: 0x6366F1),
            title: "NCAAB Betting Trends",
            titleIcon: "basketball.fill",
            headline: "College chaos has patterns.",
            description: "More variance means bigger edges. Situational trends at 65%+ ATS or O/U win rates reveal what the market misses in college hoops.",
            examples: [
                .init(icon: "checkmark.shield.fill", label: "Duke ATS as home favorite", value: "74% (14-5)", valueColor: Color(hex: 0x22C55E)),
                .init(icon: "chart.line.uptrend.xyaxis", label: "Gonzaga Over after a win", value: "69% (9-4)", valueColor: Color(hex: 0x22C55E)),
                .init(icon: "arrow.down", label: "Kentucky Under as dog", value: "71% (10-4)", valueColor: Color(hex: 0x22C55E)),
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
    private func sortPill(mode: NCAABBettingTrendsStore.SortMode, icon: String, label: String, binding: Binding<NCAABBettingTrendsStore.SortMode>) -> some View {
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
        LazyVStack(spacing: 12) {
            // Enumerate so each card can cascade in via `.staggeredAppear`
            // when it replaces the skeleton.
            ForEach(Array(store.games.enumerated()), id: \.element.id) { index, game in
                NCAABBettingTrendsMatchupCardView(game: game) {
                    openGamePage(for: game.gameId)
                }
                .staggeredAppear(index: index)
            }
        }
        .padding(.horizontal, Spacing.lg)
    }

    /// Resolve the trends gameId to a typed `NCAABGame`, open the NCAAB
    /// sheet store, jump to Games tab. Fall back to the in-tab trends sheet
    /// if the game isn't in the cache.
    private func openGamePage(for gameId: Int) {
        let idString = String(gameId)
        if let ncaabGame = gamesStore.games.ncaab.first(where: {
            $0.id == idString || String($0.gameId) == idString
        }) {
            ncaabSheetStore.openGameSheet(ncaabGame)
            tabStore.select(.games)
        } else if let trendsGame = store.games.first(where: { $0.gameId == gameId }) {
            store.openTrendsSheet(trendsGame)
        }
    }

    private var shimmer: some View {
        VStack(spacing: 12) {
            ForEach(0..<5, id: \.self) { _ in
                NCAABBettingTrendsCardSkeleton()
            }
        }
        .padding(.horizontal, Spacing.lg)
        .transition(.opacity)
    }

    private var empty: some View {
        ContentUnavailableView {
            Label("No NCAAB trends today", systemImage: "basketball.fill")
        } description: {
            Text("Trends populate as today's NCAAB slate locks in. Pull to refresh.")
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

/// Skeleton placeholder for `NCAABBettingTrendsMatchupCardView`. Mirrors the
/// real card's chrome exactly (26pt ultraThinMaterial surface, 0.5pt border,
/// soft shadow, 4pt top stripe) and drops Skeleton* primitives where the two
/// team columns (48pt avatar + abbr), the centered `@`/tipoff pill, and the
/// chevron land — so the crossfade to loaded content never shifts layout.
///
/// The inner placeholder group carries the unified `.shimmering()` sweep; the
/// chrome stays solid (applied via `.background`/`.overlay` *after* the shimmer).
private struct NCAABBettingTrendsCardSkeleton: View {
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
