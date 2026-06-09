import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// NCAAB Model Accuracy list view, pushed from the Outliers hub. Ports
/// `wagerproof-mobile/app/(drawer)/(tabs)/ncaab-model-accuracy.tsx`.
/// Same shape as the NBA version with the orange accent color used by RN
/// for the NCAAB tool family.
struct NCAABModelAccuracyView: View {
    @Environment(MainTabStore.self) private var tabStore
    @Environment(GamesStore.self) private var gamesStore
    @Environment(NCAABGameSheetStore.self) private var ncaabSheetStore
    @State private var store = NCAABModelAccuracyStore()

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 8, pinnedViews: [.sectionHeaders]) {
                explainer
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                Section {
                    content
                    howToUseGuide
                        .padding(.horizontal, Spacing.lg)
                        .padding(.top, Spacing.md)
                } header: {
                    pinnedSortBar
                }
            }
            .padding(.bottom, Spacing.xxl)
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle("NCAAB Model Accuracy")
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
    }

    private var explainer: some View {
        ToolExplainerBannerView(
            accentColor: Color(hex: 0xF97316),
            title: "NCAAB Model Accuracy",
            titleIcon: "target",
            headline: "The model's college track record.",
            description: "Games where the model has been extremely accurate (70%+) or consistently wrong (30%-). Both are actionable.",
            examples: [
                .init(icon: "hand.thumbsup.fill", label: "Duke spread pick — 79% accurate", value: "Trust", valueColor: Color(hex: 0x22C55E)),
                .init(icon: "hand.thumbsdown.fill", label: "UNC O/U pick — only 35% accurate", value: "Fade", valueColor: Color(hex: 0xEF4444)),
                .init(icon: "target", label: "Kansas ML pick — 74% accurate", value: "Trust", valueColor: Color(hex: 0x22C55E)),
            ]
        )
    }

    private var sortPills: some View {
        @Bindable var binding = store
        return HStack(spacing: 10) {
            sortPill(mode: .time, icon: "clock", label: "Time", binding: $binding.sortMode)
            sortPill(mode: .spread, icon: "target", label: "Spread", binding: $binding.sortMode)
            sortPill(mode: .moneyline, icon: "chart.bar.fill", label: "ML", binding: $binding.sortMode)
            sortPill(mode: .ou, icon: "arrow.up.arrow.down", label: "O/U", binding: $binding.sortMode)
            Spacer()
        }
        .sensoryFeedback(.selection, trigger: store.sortMode)
    }

    @ViewBuilder
    private func sortPill(mode: NCAABModelAccuracyStore.SortMode, icon: String, label: String, binding: Binding<NCAABModelAccuracyStore.SortMode>) -> some View {
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
                    .transition(.opacity)
            } else {
                cards
            }
        case .loaded:
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
            ForEach(Array(store.games.enumerated()), id: \.element.id) { index, game in
                Button {
                    openGamePage(for: game.gameId)
                } label: {
                    NCAABModelAccuracyMatchupCardView(game: game)
                }
                .buttonStyle(.plain)
                .staggeredAppear(index: index)
            }
        }
        .padding(.horizontal, Spacing.lg)
    }

    private func openGamePage(for gameId: Int) {
        let idString = String(gameId)
        guard let ncaabGame = gamesStore.games.ncaab.first(where: {
            $0.id == idString || String($0.gameId) == idString
        }) else { return }
        ncaabSheetStore.openGameSheet(ncaabGame)
        tabStore.select(.games)
    }

    private var shimmer: some View {
        VStack(spacing: 12) {
            ForEach(0..<4, id: \.self) { _ in
                NCAABModelAccuracyCardShimmer()
            }
        }
        .padding(.horizontal, Spacing.lg)
    }

    private var empty: some View {
        ContentUnavailableView {
            Label("No NCAAB accuracy data today", systemImage: "target")
        } description: {
            Text("Accuracy buckets populate as today's slate locks in. Pull to refresh.")
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

    private var howToUseGuide: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "lightbulb.fill")
                    .foregroundStyle(Color.appPrimary)
                Text("How to use this tool")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            tip("1. Sort by Spread, ML, or O/U to find where the model has been strongest.")
            tip("2. Prioritize matchups where model confidence and historical hit rate agree.")
            tip("3. Use this as a signal-check tool, then confirm with injuries, line movement, and your own read.")
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.appBorder, lineWidth: 1)
        )
    }

    private func tip(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12))
            .lineSpacing(3)
            .foregroundStyle(Color.appTextSecondary)
    }
}

/// Skeleton for `NCAABModelAccuracyMatchupCardView` — identical chrome/layout
/// to the NBA variant (26pt glass, accent bar, team header + three pick
/// blocks). Inner placeholders shimmer; chrome stays solid.
private struct NCAABModelAccuracyCardShimmer: View {
    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 26, style: .continuous)
        VStack(spacing: 0) {
            Rectangle().fill(Color.appSkeleton).frame(height: 4)

            VStack(spacing: 6) {
                HStack(spacing: 8) {
                    SkeletonCircle(32)
                    SkeletonBlock(width: 30, height: 12)
                    SkeletonCircle(32)
                    SkeletonBlock(width: 30, height: 12)
                    Spacer(minLength: 0)
                    SkeletonBlock(width: 52, height: 11)
                }
                .padding(.bottom, 4)

                ForEach(0..<3, id: \.self) { _ in pickBlockPlaceholder }
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 14)
            .shimmering()
        }
        .background(shape.fill(.ultraThinMaterial))
        .clipShape(shape)
        .overlay(shape.strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    private var pickBlockPlaceholder: some View {
        VStack(spacing: 4) {
            HStack {
                SkeletonBlock(width: 60, height: 12)
                Spacer()
                SkeletonBlock(width: 80, height: 12)
            }
            HStack {
                SkeletonBlock(width: 56, height: 12)
                Spacer()
                SkeletonBlock(width: 64, height: 12)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.appSurfaceMuted.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.appBorder.opacity(0.5), lineWidth: 1)
        )
    }
}
