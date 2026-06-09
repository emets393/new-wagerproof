import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Native port of `components/agents/AgentLeaderboard.tsx`. Renders:
///   - The filter pill rows (sort mode + timeframe).
///   - A list of `LeaderboardRow`s — top 3 wrapped in a glow halo.
///   - `EmptyState` when zero public agents.
///   - Skeletons during the initial fetch.
///
/// Owns no state of its own; the parent injects a `LeaderboardStore` and the
/// view binds directly to its `sortMode` / `timeframe` properties (their
/// didSet triggers a refresh).
struct AgentLeaderboardView: View {
    @Bindable var store: LeaderboardStore
    @Environment(AgentEntitlementsStore.self) private var entitlements
    /// When false the sort/timeframe pills are hidden — the host (Outliers tab)
    /// lifts `LeaderboardFilterBar` into its pinned glass header instead.
    var showsFilters: Bool = true
    var onRowTap: (AgentLeaderboardEntry) -> Void

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                if showsFilters {
                    LeaderboardFilterBar(store: store)
                }
                content
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
        .refreshable {
            await store.refresh()
        }
        .task {
            if case .idle = store.loadState {
                await store.refresh()
            }
        }
    }

    // MARK: - Content branches

    @ViewBuilder
    private var content: some View {
        switch store.loadState {
        case .idle, .loading:
            if store.entries.isEmpty {
                ForEach(0..<6, id: \.self) { _ in skeletonRow }
            } else {
                rows
            }
        case .loaded:
            if store.entries.isEmpty {
                emptyState
            } else {
                rows
            }
        case .failed(let msg):
            ContentUnavailableView {
                Label("Couldn't load leaderboard", systemImage: "exclamationmark.triangle")
            } description: {
                Text(msg)
            } actions: {
                Button {
                    Task { await store.refresh() }
                } label: {
                    Label("Retry", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(hex: 0x00E676))
            }
            .padding(.top, Spacing.xl)
        }
    }

    private var rows: some View {
        ForEach(Array(store.entries.enumerated()), id: \.element.id) { idx, entry in
            let rank = idx + 1
            LeaderboardRow(
                entry: entry,
                rank: rank,
                lockStats: !entitlements.canViewAgentPicks,
                isEntitlementsLoading: entitlements.isLoading,
                isBottomMode: store.isBottomMode,
                onTap: { onRowTap(entry) }
            )
            // Cascade each row in when it replaces the loading shimmer.
            .staggeredAppear(index: idx)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "trophy")
                .font(.system(size: 48))
                .foregroundStyle(Color.appTextSecondary)
            Text("No public agents yet")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            Text("Be the first to make your agent public!")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.xxl)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.appBorder.opacity(0.2))
        )
    }

    /// Skeleton placeholder for `LeaderboardRow`. Mirrors that row's layout
    /// (rank block, avatar circle, name + sport subtitle, trailing record/units
    /// + win-rate badge) using the unified Skeleton* primitives, inside the same
    /// 12pt chrome. The inner group carries the `.shimmering()` sweep; the card
    /// chrome stays solid (applied after the shimmer).
    private var skeletonRow: some View {
        HStack(spacing: 12) {
            SkeletonBlock(width: 28, height: 20, cornerRadius: 4)
            SkeletonCircle(36)
            VStack(alignment: .leading, spacing: 2) {
                SkeletonBlock(width: 120, height: 14)
                SkeletonBlock(width: 60, height: 10)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 2) {
                SkeletonBlock(width: 44, height: 12)
                SkeletonBlock(width: 52, height: 14)
            }
            SkeletonBlock(width: 40, height: 11)
        }
        .padding(12)
        .shimmering()
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.appBorder.opacity(0.2))
        )
    }
}

// MARK: - LeaderboardFilterBar

/// The leaderboard's sort-mode + timeframe pill rows (and the 10+ picks
/// toggle), extracted so it can render either inline in `AgentLeaderboardView`
/// or lifted into the Outliers tab's pinned glass header. Binds directly to the
/// shared `LeaderboardStore` — each pill tap flips a property whose didSet
/// re-runs the fetch.
struct LeaderboardFilterBar: View {
    @Bindable var store: LeaderboardStore

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(LeaderboardStore.SortMode.allCases, id: \.self) { mode in
                        filterPill(label: mode.label, isActive: store.sortMode == mode) {
                            store.sortMode = mode
                        }
                    }
                }
                .padding(.vertical, 2)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(LeaderboardStore.Timeframe.allCases, id: \.self) { tf in
                        filterPill(label: tf.label, isActive: store.timeframe == tf, isSubtle: true) {
                            store.timeframe = tf
                        }
                    }
                    Toggle("10+ picks", isOn: $store.excludeUnder10Picks)
                        .toggleStyle(.button)
                        .controlSize(.small)
                        .tint(Color(hex: 0x00E676))
                }
                .padding(.vertical, 2)
            }
        }
    }

    private func filterPill(label: String, isActive: Bool, isSubtle: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 12, weight: .bold))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    Capsule().fill(
                        isActive
                            ? Color(hex: 0x00E676).opacity(0.15)
                            : Color.appBorder.opacity(isSubtle ? 0.3 : 0.5)
                    )
                )
                .overlay(
                    Capsule().stroke(
                        isActive
                            ? Color(hex: 0x00E676).opacity(0.45)
                            : Color.appBorder.opacity(0.3),
                        lineWidth: 1
                    )
                )
                .foregroundStyle(isActive ? Color(hex: 0x00E676) : Color.appTextSecondary)
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: isActive)
    }
}

// MARK: - LeaderboardRow

/// One row of `AgentLeaderboardView`. Mirrors RN `LeaderboardRow`.
private struct LeaderboardRow: View {
    let entry: AgentLeaderboardEntry
    let rank: Int
    let lockStats: Bool
    let isEntitlementsLoading: Bool
    let isBottomMode: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                rankBadge
                avatarSection
                Spacer(minLength: 0)
                statsSection
                winRateBadge
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.appBorder.opacity(0.2))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.appBorder.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var rankBadge: some View {
        let (color, icon): (Color, String?) = {
            switch rank {
            case 1: return (Color(hex: 0xFFD700), "trophy.fill")
            case 2: return (Color(hex: 0xC0C0C0), "medal.fill")
            case 3: return (Color(hex: 0xCD7F32), "medal")
            default: return (Color.appTextSecondary, nil)
            }
        }()

        if let icon {
            Image(systemName: icon)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 32)
        } else {
            Text("\(rank)")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(color)
                .frame(width: 32)
        }
    }

    @ViewBuilder
    private var avatarSection: some View {
        let avatar = ZStack {
            Circle().fill(LinearGradient(
                colors: AgentColorPalette.avatarGradient(for: entry.avatarColor),
                startPoint: .topLeading, endPoint: .bottomTrailing))
            PixelSpriteAvatar(spriteIndex: entry.spriteIndex)
                .padding(rank <= 3 ? 3 : 2)
        }
        .frame(width: rank <= 3 ? 44 : 36, height: rank <= 3 ? 44 : 36)

        HStack(spacing: 10) {
            if rank <= 3 {
                GlowingCardWrapper(color: entry.avatarColor, cornerRadius: 22) {
                    avatar
                }
            } else {
                avatar
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    ForEach(Array(entry.preferredSports.prefix(2)), id: \.self) { sport in
                        Text(sport.label)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    if entry.preferredSports.count > 2 {
                        Text("+\(entry.preferredSports.count - 2)")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }
            }
        }
    }

    private var statsSection: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text(record)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            ZStack {
                if isEntitlementsLoading {
                    ProgressView().controlSize(.mini)
                } else {
                    Text(netUnitsLabel)
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(entry.netUnits >= 0 ? Color.appWin : Color.appLoss)
                }
                if !isEntitlementsLoading && lockStats {
                    // Lock overlay — simulates the AndroidBlurView blur on RN.
                    ZStack {
                        Rectangle()
                            .fill(.ultraThinMaterial)
                        Image(systemName: "lock.fill")
                            .font(.system(size: 9))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }
            }
        }
        .frame(minWidth: 56)
    }

    private var winRateBadge: some View {
        let label = entry.winRate.map { String(format: "%.1f%%", $0 * 100) } ?? "-"
        let color: Color = {
            if isBottomMode {
                if let wr = entry.winRate, wr < 0.35 { return .appLoss }
                return Color(hex: 0xF97316)
            }
            return Color(hex: 0x00E676)
        }()
        return Text(label)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(color)
            .frame(width: 48)
    }

    private var record: String {
        var s = "\(entry.wins)-\(entry.losses)"
        if entry.pushes > 0 { s += "-\(entry.pushes)" }
        return s
    }

    private var netUnitsLabel: String {
        let sign = entry.netUnits >= 0 ? "+" : ""
        return String(format: "%@%.2fu", sign, entry.netUnits)
    }
}
