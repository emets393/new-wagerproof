import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// MLB Player Prop Matchups tool. Ports `wagerproof-mobile/app/(drawer)/(tabs)/mlb-pitcher-matchups.tsx`,
/// restyled to the MLB feed card-list shell: a "Top Prop Plays" rail followed
/// by per-game `PropMatchupCardView`s (starters + lineups + posted props).
/// Tapping a player pushes the existing `PlayerPropDetailView` for the deep
/// splits + line scrubber.
struct MLBPitcherMatchupsView: View {
    @State private var store = MLBPitcherMatchupsStore()
    @State private var selectedProp: PlayerPropSelection?

    /// Per-player feed items (headline prop + detail selection), keyed by
    /// playerId — reuses the Props-tab flattener so the matchup card and the
    /// top-plays rail share one source of truth.
    private var itemsByPlayer: [Int: PlayerPropFeedItem] {
        let items = PlayerPropFeed.items(from: store.matchups)
        return Dictionary(items.map { ($0.selection.playerId, $0) }, uniquingKeysWith: { a, _ in a })
    }

    private var topPlays: [PlayerPropFeedItem] {
        PlayerPropFeed.items(from: store.matchups)
            .filter { $0.hitRate >= 0 }
            .sorted { $0.hitRate > $1.hitRate }
            .prefix(8)
            .map { $0 }
    }

    var body: some View {
        let byPlayer = itemsByPlayer
        ScrollView {
            LazyVStack(spacing: 8, pinnedViews: [.sectionHeaders]) {
                if !topPlays.isEmpty {
                    topPlaysRail
                        .padding(.top, 8)
                }
                content(byPlayer: byPlayer)
            }
            .padding(.bottom, Spacing.xxl)
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle("Player Prop Matchups")
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
            if store.matchups.isEmpty { await store.refresh() }
        }
        .navigationDestination(item: $selectedProp) { selection in
            PlayerPropDetailView(selection: selection)
        }
    }

    // MARK: - Content

    @ViewBuilder
    private func content(byPlayer: [Int: PlayerPropFeedItem]) -> some View {
        if store.isLoading && store.matchups.isEmpty {
            skeleton
        } else if let msg = store.errorMessage, store.matchups.isEmpty {
            errorState(msg)
        } else if store.matchups.isEmpty {
            emptyState
        } else {
            let sections = GameDateGrouping.group(
                store.sortedMatchups(),
                key: { GameDateGrouping.dateKey(from: $0.officialDate) },
                label: { MLBFormatting.dateLabel($0.officialDate) }
            )
            ForEach(sections, id: \.key) { section in
                Section {
                    ForEach(Array(section.items.enumerated()), id: \.element.id) { index, matchup in
                        PropMatchupCardView(matchup: matchup, itemsByPlayer: byPlayer) { sel in
                            selectedProp = sel
                        }
                        .padding(.horizontal, 12)
                        .staggeredAppear(index: index)
                    }
                } header: {
                    sectionHeader(section.label)
                }
            }
        }
    }

    // MARK: - Top plays rail

    private var topPlaysRail: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Top Prop Plays")
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
                .padding(.horizontal, 16)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(topPlays) { item in
                        Button {
                            selectedProp = item.selection
                        } label: {
                            topPlayChip(item)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    private func topPlayChip(_ item: PlayerPropFeedItem) -> some View {
        let l10 = item.headline.computed.l10
        let pct = l10.games > 0 ? Double(l10.over) / Double(l10.games) : 0
        return VStack(spacing: 6) {
            PlayerHeadshot(playerId: item.selection.playerId, size: 44)
            Text(item.selection.playerName)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
            Text("\(MLBPlayerProps.marketLabel(item.headline.row.market)) O \(MLBPlayerProps.formatLine(item.headline.computed.line))")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .lineLimit(1)
            Text("\(l10.fractionLabel) L10")
                .font(.system(size: 11, weight: .heavy, design: .monospaced))
                .foregroundStyle(pct >= 0.6 ? Color.appWin : Color.appTextSecondary)
        }
        .frame(width: 110)
        .padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.ultraThinMaterial))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5)
        )
    }

    // MARK: - Section header / states

    private func sectionHeader(_ label: String) -> some View {
        HStack {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Color.appTextSecondary)
                .padding(.leading, 20)
                .padding(.trailing, 16)
                .padding(.vertical, 6)
            Spacer(minLength: 0)
        }
        .background(Color.appSurface.opacity(0.95))
    }

    private var skeleton: some View {
        VStack(spacing: 12) {
            ForEach(0..<3, id: \.self) { _ in
                PropMatchupCardShimmer()
                    .padding(.horizontal, 12)
            }
        }
        .padding(.vertical, 8)
        .transition(.opacity)
    }

    private func errorState(_ message: String) -> some View {
        VStack {
            Spacer().frame(height: 40)
            ContentUnavailableView {
                Label("Failed to load matchups", systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            } actions: {
                Button {
                    Task { await store.refresh() }
                } label: {
                    Label("Retry", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.appPrimary)
            }
            Spacer()
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer().frame(height: 60)
            Image(systemName: "figure.baseball")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Color.appTextMuted)
            Text("No player prop matchups posted right now")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .frame(maxWidth: .infinity, minHeight: 220)
    }
}

/// Skeleton for `PropMatchupCardView`. Reproduces its 26pt glass chrome and the
/// header / starters row / lineup-section layout (two starter columns either
/// side of a "VS", then batting-order rows with a trailing prop pill). Inner
/// placeholders shimmer; chrome stays solid.
private struct PropMatchupCardShimmer: View {
    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 26, style: .continuous)
        content
            .padding(14)
            .shimmering()
            .background(shape.fill(.ultraThinMaterial))
            .clipShape(shape)
            .overlay(shape.strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5))
            .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header: date/abbr block + Day/Night capsule.
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    SkeletonBlock(width: 130, height: 10)
                    SkeletonBlock(width: 90, height: 16)
                }
                Spacer(minLength: 8)
                SkeletonCapsule(width: 54, height: 20)
            }

            // Starters: headshot + name + archetype + stats + prop pill, "VS" center.
            HStack(alignment: .top, spacing: 8) {
                starterColumnPlaceholder
                SkeletonBlock(width: 18, height: 11).padding(.top, 18)
                starterColumnPlaceholder
            }

            Divider().overlay(Color.appBorder.opacity(0.5))

            // Two lineup sections (title + a few batter rows).
            lineupSectionPlaceholder
            lineupSectionPlaceholder
        }
    }

    private var starterColumnPlaceholder: some View {
        VStack(spacing: 4) {
            SkeletonCircle(40)
            SkeletonBlock(width: 90, height: 12)
            SkeletonBlock(width: 70, height: 10)
            SkeletonBlock(width: 80, height: 10)
            SkeletonCapsule(width: 84, height: 18)
        }
        .frame(maxWidth: .infinity)
    }

    private var lineupSectionPlaceholder: some View {
        VStack(alignment: .leading, spacing: 6) {
            SkeletonBlock(width: 90, height: 10)
            ForEach(0..<4, id: \.self) { _ in
                HStack(spacing: 8) {
                    SkeletonBlock(width: 14, height: 12)
                    VStack(alignment: .leading, spacing: 3) {
                        SkeletonBlock(width: 110, height: 12)
                        SkeletonBlock(width: 60, height: 9)
                    }
                    Spacer(minLength: 4)
                    SkeletonCapsule(width: 84, height: 18)
                }
                .padding(.vertical, 5)
            }
        }
    }
}
