import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// MLB F5 Splits tool. Ports `wagerproof-mobile/app/(drawer)/(tabs)/mlb-f5-splits.tsx`,
/// restyled to the MLB feed card-list shell: a scroll of date-grouped
/// `F5GameCardView` comparison cards with pinned date headers. List-only —
/// the RN screen has no per-game detail route.
struct MLBF5SplitsView: View {
    @State private var store = MLBF5SplitsStore()

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 8, pinnedViews: [.sectionHeaders]) {
                explainer
                    .padding(.horizontal, 12)
                    .padding(.top, 8)
                content
            }
            .padding(.bottom, Spacing.xxl)
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle("MLB F5 Splits")
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
            if store.games.isEmpty { await store.refresh() }
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if store.isLoading && store.games.isEmpty {
            skeleton
        } else if let msg = store.errorMessage, store.games.isEmpty {
            errorState(msg)
        } else if store.games.isEmpty {
            emptyState
        } else {
            let sections = GameDateGrouping.group(
                store.games,
                key: { GameDateGrouping.dateKey(from: $0.officialDate) },
                label: { MLBFormatting.dateLabel($0.officialDate) }
            )
            ForEach(sections, id: \.key) { section in
                Section {
                    ForEach(Array(section.items.enumerated()), id: \.element.id) { index, game in
                        F5GameCardView(game: game, lookup: store.splitLookup)
                            .padding(.horizontal, 12)
                            .staggeredAppear(index: index)
                    }
                } header: {
                    sectionHeader(section.label)
                }
            }
        }
    }

    private var explainer: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "info.circle.fill")
                .font(.system(size: 16))
                .foregroundStyle(Color.appAccentBlue)
            Text("The away team is judged by its away games vs tonight's opposing starter hand, and the home team by its home games vs tonight's opposing starter hand.")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.appTextPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appAccentBlue.opacity(0.10), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.appAccentBlue.opacity(0.4), lineWidth: 1)
        )
    }

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
                F5GameCardShimmer()
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
                Label("Failed to load F5 splits", systemImage: "exclamationmark.triangle")
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
            Image(systemName: "baseball")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Color.appTextMuted)
            Text("No MLB games on the F5 board right now")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .frame(maxWidth: .infinity, minHeight: 220)
    }
}

/// Skeleton for `F5GameCardView`. Reproduces its 26pt glass chrome and the
/// header / teams row / stat-section layout (two team columns either side of a
/// center metric-label column) so the crossfade to loaded splits never shifts.
/// Inner placeholders shimmer; chrome stays solid.
private struct F5GameCardShimmer: View {
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
        VStack(alignment: .leading, spacing: 0) {
            // Header: date/abbr block + F5 O/U capsule.
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    SkeletonBlock(width: 130, height: 10)
                    SkeletonBlock(width: 90, height: 16)
                }
                Spacer(minLength: 8)
                SkeletonCapsule(width: 72, height: 20)
            }
            .padding(.bottom, 12)

            // Venue line.
            SkeletonBlock(width: 180, height: 10)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.bottom, 10)

            // Teams row: logo + name + ML, separated by an "@" gap.
            HStack(alignment: .center, spacing: 10) {
                teamBlockPlaceholder
                SkeletonCircle(16)
                teamBlockPlaceholder
            }
            .padding(.bottom, 12)

            // Three stat sections (title + a few compare rows).
            ForEach(0..<3, id: \.self) { _ in statSectionPlaceholder }
        }
    }

    private var teamBlockPlaceholder: some View {
        VStack(spacing: 5) {
            SkeletonCircle(46)
            SkeletonBlock(width: 70, height: 10)
            SkeletonBlock(width: 50, height: 10)
        }
        .frame(maxWidth: .infinity)
    }

    private var statSectionPlaceholder: some View {
        VStack(spacing: 9) {
            SkeletonBlock(width: 150, height: 12)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.top, 12)
            ForEach(0..<3, id: \.self) { _ in
                HStack(alignment: .center, spacing: 8) {
                    SkeletonBlock(width: 44, height: 12).frame(maxWidth: .infinity)
                    SkeletonBlock(width: 96, height: 10).frame(width: 116)
                    SkeletonBlock(width: 44, height: 12).frame(maxWidth: .infinity)
                }
            }
        }
    }
}
