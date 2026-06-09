import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Native port of `wagerproof-mobile/components/agents/TopAgentPicksFeed.tsx`.
///
/// Renders the Top Agent Picks tab as a Spotify-style sectioned feed: each
/// section is an agent header (rank, avatar emoji bubble, record, net units)
/// over a horizontally scrollable strip of up to 4 `OutlierMatchupCardView`s
/// (one per pick). A native segmented `Picker` selects between
/// Top 10 / Following / Favorites. Search runs through `.searchable` on the
/// parent and pumps the bound store's `searchText`.
///
/// Pagination is cursor-based: when the last section's last row is rendered,
/// the `.task(id:)` modifier on that row calls `store.loadMore()`. This keeps
/// pagination on the UI thread without re-implementing FlatList's
/// `onEndReached` semantics.
///
/// The view itself owns nothing — all state lives on the injected
/// `TopAgentPicksFeedStore` so the AgentsView parent can refresh on tab
/// activation.
struct TopAgentPicksFeed: View {
    @Bindable var store: TopAgentPicksFeedStore
    @Environment(FavoriteAgentsStore.self) private var favorites
    @Environment(\.colorScheme) private var colorScheme
    /// When false the Top 10/Following/Favorites picker is hidden — the host
    /// (Outliers tab) lifts it into its pinned glass header instead. Still
    /// binds to the same `store.filterMode`, so the lifted picker drives this.
    var showsFilters: Bool = true
    var onAgentTap: (String) -> Void
    var onPickTap: (TopAgentPickFeedRow) -> Void

    @State private var loadingPickId: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if showsFilters {
                    filterRow
                        .padding(.horizontal, Spacing.lg)
                        .padding(.top, Spacing.sm)
                        .padding(.bottom, Spacing.md)
                }
                content
            }
            .padding(.bottom, Spacing.xxl)
        }
        // The `.searchable` modifier on the parent (AgentsView) drives
        // `store.searchText`. We debounce here via `.task(id:)` to avoid
        // hitting the RPC per keystroke.
        .task(id: store.searchText) {
            try? await Task.sleep(nanoseconds: 250_000_000)
            if Task.isCancelled { return }
            await store.applySearchText(store.searchText)
        }
        // Push local favorites onto the store so the .favorites filter mode
        // can union them with the server-side set.
        .onChange(of: favorites.favoriteIds) { _, ids in
            store.localFavoriteIds = ids
        }
        .onAppear {
            store.localFavoriteIds = favorites.favoriteIds
        }
        .refreshable {
            await store.refresh()
        }
    }

    // MARK: - Filter row

    private var filterRow: some View {
        // Native segmented picker — the iOS equivalent of the RN
        // horizontally-scrolling pill row.
        Picker("Filter", selection: $store.filterMode) {
            ForEach(TopAgentPicksFeedStore.FilterMode.allCases, id: \.self) { mode in
                Text(mode.label).tag(mode)
            }
        }
        .pickerStyle(.segmented)
        .sensoryFeedback(.selection, trigger: store.filterMode)
    }

    // MARK: - Content branches

    @ViewBuilder
    private var content: some View {
        switch store.loadState {
        case .idle, .loading where store.items.isEmpty:
            skeletonRows
        case .failed(let msg):
            errorState(msg)
        default:
            if store.items.isEmpty {
                emptyState
            } else {
                feedSections
            }
        }
    }

    // MARK: - Feed

    private var feedSections: some View {
        LazyVStack(alignment: .leading, spacing: Spacing.md) {
            ForEach(Array(store.sections.enumerated()), id: \.element.id) { index, section in
                AgentSectionView(
                    section: section,
                    loadingPickId: loadingPickId,
                    isFavorite: favorites.isFavorite(section.agentId),
                    onAgentTap: { onAgentTap(section.agentId) },
                    onFavoriteToggle: {
                        _ = favorites.toggle(section.agentId)
                    },
                    onPickTap: { row in
                        loadingPickId = row.id
                        onPickTap(row)
                        // Clear loading spinner after a short delay so taps
                        // give visible feedback even if the parent's sheet
                        // present is instant.
                        Task {
                            try? await Task.sleep(nanoseconds: 500_000_000)
                            if loadingPickId == row.id {
                                loadingPickId = nil
                            }
                        }
                    }
                )
                // Trigger pagination when the last section is rendered.
                // `task(id:)` re-runs only when the section identity changes
                // so we don't hammer loadMore on every scroll tick.
                .task(id: section.id) {
                    if index == store.sections.count - 1 {
                        await store.loadMore()
                    }
                }
            }

            if case .loading = store.loadMoreState {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .padding(.vertical, Spacing.lg)
            }
        }
    }

    // MARK: - Skeleton

    private var skeletonRows: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            ForEach(0..<3, id: \.self) { i in
                // Mirror AgentSectionView's card shell: glass surface, a header
                // (square avatar + name + record line), a divider, then the
                // horizontal picks strip.
                let shape = RoundedRectangle(cornerRadius: 26, style: .continuous)
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 12) {
                        SkeletonBlock(width: 48, height: 48, cornerRadius: 13)
                        VStack(alignment: .leading, spacing: 5) {
                            SkeletonBlock(width: 140, height: 14)
                            SkeletonBlock(width: 90, height: 11)
                        }
                        Spacer(minLength: 0)
                    }
                    .shimmering()
                    .padding(.horizontal, 14)
                    .padding(.top, 12)
                    Divider()
                        .background(Color.appBorder.opacity(0.5))
                        .padding(.horizontal, 14)
                        .padding(.top, 10)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Spacing.md) {
                            ForEach(0..<3, id: \.self) { j in
                                OutlierCardShimmerView(phase: (i + j) % 3)
                            }
                        }
                        .padding(.horizontal, 14)
                    }
                    .padding(.top, 10)
                    .padding(.bottom, 12)
                }
                .background {
                    ZStack {
                        shape.fill(.ultraThinMaterial)
                            .opacity(colorScheme == .dark ? 0.55 : 1)
                        shape.strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 0.5)
                    }
                }
                .clipShape(shape)
                .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
                .padding(.horizontal, 12)
            }
        }
        .padding(.top, Spacing.md)
    }

    // MARK: - Empty / Error

    private var emptyState: some View {
        ContentUnavailableView {
            Label(emptyTitle, systemImage: emptyIcon)
        } description: {
            Text(emptyMessage)
                .multilineTextAlignment(.center)
        }
        .padding(.top, Spacing.xl)
    }

    private var emptyTitle: String {
        if !store.appliedSearchText.isEmpty { return "No matches" }
        switch store.filterMode {
        case .top10: return "No top picks yet"
        case .following: return "No followed agents"
        case .favorites: return "No favorites yet"
        }
    }

    private var emptyIcon: String {
        if !store.appliedSearchText.isEmpty { return "magnifyingglass" }
        switch store.filterMode {
        case .top10: return "sparkles"
        case .following: return "person.crop.circle.badge.plus"
        case .favorites: return "star"
        }
    }

    private var emptyMessage: String {
        if !store.appliedSearchText.isEmpty {
            return "Nothing matched “\(store.appliedSearchText)”. Try a different agent, team, or pick."
        }
        return store.filterMode.emptyMessage
    }

    private func errorState(_ msg: String) -> some View {
        ContentUnavailableView {
            Label("Couldn't load feed", systemImage: "exclamationmark.triangle")
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

// MARK: - Per-agent section

private struct AgentSectionView: View {
    let section: TopAgentPicksFeedStore.AgentSection
    let loadingPickId: String?
    let isFavorite: Bool
    let onAgentTap: () -> Void
    let onFavoriteToggle: () -> Void
    let onPickTap: (TopAgentPickFeedRow) -> Void

    @Environment(\.colorScheme) private var colorScheme

    /// First row carries the agent's identity (same for every row in the
    /// section — pulled from the RPC join).
    private var header: TopAgentPickFeedRow? { section.rows.first }

    var body: some View {
        // Each section adopts the My Agents list-card shell (`AgentRowCard`):
        // a 26pt Liquid Glass surface, hairline border, soft shadow. The agent
        // identity sits up top; the picks scroller takes the place of the
        // card's bottom info bar.
        let shape = RoundedRectangle(cornerRadius: 26, style: .continuous)
        return VStack(alignment: .leading, spacing: 0) {
            agentHeader
                .padding(.horizontal, 14)
                .padding(.top, 12)
            Divider()
                .background(Color.appBorder.opacity(0.5))
                .padding(.horizontal, 14)
                .padding(.top, 10)
            picksRow
                .padding(.top, 10)
                .padding(.bottom, 12)
        }
        .background {
            ZStack {
                // Match AgentRowCard: thin the material in dark mode so the
                // card reads as more transparent glass.
                shape.fill(.ultraThinMaterial)
                    .opacity(colorScheme == .dark ? 0.55 : 1)
                shape.strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 0.5)
            }
        }
        .clipShape(shape)
        // Long-press the whole card for the agent actions (the star button was
        // removed to declutter the identity row).
        .contextMenu {
            if let row = header {
                Button(action: onAgentTap) {
                    Label("View Agent", systemImage: "person.crop.circle")
                }
                Button(action: onFavoriteToggle) {
                    Label(
                        isFavorite ? "Unfollow \(row.agentName)" : "Follow \(row.agentName)",
                        systemImage: isFavorite ? "star.slash" : "star"
                    )
                }
            }
        }
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
        .padding(.horizontal, 12)
    }

    /// Identity row mirrors `AgentRowCard`: pixel-sprite avatar, name + the two
    /// most distinctive strategy chips, and the streak/form chart on the right.
    /// Net units (the feed's ranking metric) ride along the name; the favorite
    /// star stays as the trailing control.
    @ViewBuilder
    private var agentHeader: some View {
        if let row = header {
            HStack(spacing: 12) {
                avatar(row: row)

                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 6) {
                        if row.agentRank != nil {
                            rankBadge(rank: row.agentRank)
                        }
                        Text(row.agentName)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                            .lineLimit(1)
                            .layoutPriority(1)
                    }
                    strategyChipsRow(for: row)
                }

                Spacer(minLength: 6)

                AgentFormChart(performance: agentPerformance)
                    .frame(width: 78, height: 46)
            }
        }
    }

    /// Rounded-square brand-gradient avatar in `AgentRowCard`'s exact style, with
    /// the agent's pixel-office sprite (derived from the avatar id, same seed the
    /// My Agents list uses) so the character matches across surfaces.
    private func avatar(row: TopAgentPickFeedRow) -> some View {
        let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)
        let primary = AgentColorPalette.primary(for: row.agentAvatarColor)
        return ZStack {
            shape
                .fill(Color.appSurfaceElevated)
                .overlay(
                    shape
                        .fill(
                            LinearGradient(
                                colors: AgentColorPalette.avatarGradient(for: row.agentAvatarColor),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .opacity(0.85)
                )
                .overlay(shape.strokeBorder(Color.appSurfaceElevated, lineWidth: 1.5))
            PixelSpriteAvatar(spriteIndex: AgentSpriteIndex.forSeed(row.avatarId))
                .padding(3)
        }
        .frame(width: 52, height: 52)
        .shadow(color: primary.opacity(0.32), radius: 6, x: 0, y: 0)
        .shadow(color: primary.opacity(0.18), radius: 10, x: 0, y: 2)
        .contentShape(shape)
        .onTapGesture(perform: onAgentTap)
    }

    // MARK: - Agent reconstruction (for the AgentRowCard-style identity)

    /// Rebuild a lightweight `Agent` from the feed row so we can reuse the real
    /// strategy-tag logic + pixel sprite. The RPC returns the agent's archived
    /// personality (→ chips) and identity; archetype/sports aren't in the feed,
    /// so they default (archetype nil, sports derived from this agent's picks).
    private var agentSnapshot: Agent? {
        guard let row = header else { return nil }
        let sports = Array(Set(section.rows.map(\.sport)))
        return Agent(
            id: row.avatarId, userId: "", name: row.agentName,
            avatarEmoji: row.agentAvatarEmoji, avatarColor: row.agentAvatarColor,
            preferredSports: sports, archetype: nil,
            personalityParams: row.archivedPersonality ?? .default,
            isActive: true, createdAt: "", updatedAt: ""
        )
    }

    /// Performance for the form chart — real W/L/P + net units from the feed.
    /// `currentStreak` is 0 until the feed RPC returns `agent_current_streak`
    /// (the streak badge then degrades to "—").
    private var agentPerformance: AgentPerformance? {
        guard let row = header else { return nil }
        return AgentPerformance(
            avatarId: row.avatarId,
            totalPicks: row.agentWins + row.agentLosses + row.agentPushes,
            wins: row.agentWins, losses: row.agentLosses, pushes: row.agentPushes,
            netUnits: row.agentNetUnits, currentStreak: row.agentCurrentStreak
        )
    }

    private func strategyChipsRow(for row: TopAgentPickFeedRow) -> some View {
        let tags = Array((agentSnapshot?.strategyTags ?? []).prefix(2))
        let primary = AgentColorPalette.primary(for: row.agentAvatarColor)
        return HStack(spacing: 6) {
            ForEach(Array(tags.enumerated()), id: \.element.id) { idx, tag in
                chip(tag, primary: primary)
                    .layoutPriority(idx == 0 ? 0 : 1)
            }
        }
    }

    private func chip(_ tag: AgentStrategyTag, primary: Color) -> some View {
        Text(tag.text)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(tagColor(tag, primary: primary))
            .lineLimit(1)
            .truncationMode(.tail)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Color.appSurfaceMuted.opacity(0.6), in: Capsule())
            .overlay(Capsule().stroke(Color.appBorder.opacity(0.5), lineWidth: 0.5))
    }

    /// Color per strategy category — mirror of AgentRowCard.tagColor.
    private func tagColor(_ tag: AgentStrategyTag, primary: Color) -> Color {
        switch tag.kind {
        case .archetype: return primary
        case .risk:
            switch tag.level {
            case 1, 2: return Color.appWin
            case 4, 5: return Color(hex: 0xF97316)
            default: return Color.appTextSecondary
            }
        case .betType: return Color.appAccentBlue
        case .lean: return Color.appTextSecondary
        case .value: return Color.appWin
        case .fade: return Color(hex: 0x8B5CF6)
        }
    }

    private var picksRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.md) {
                ForEach(Array(section.rows.prefix(4)), id: \.id) { row in
                    let teams = parseMatchup(row.matchup)
                    OutlierMatchupCardView(
                        awayTeam: teams.away,
                        homeTeam: teams.home,
                        sport: row.sport.asSportLeague,
                        pickIcon: betTypeIcon(row.betType),
                        pickLabel: row.pickSelection,
                        pickValue: row.odds,
                        accentColor: row.agentNetUnits >= 0 ? Color(hex: 0x00E676) : Color(hex: 0xF59E0B),
                        loading: loadingPickId == row.id,
                        onTap: { onPickTap(row) }
                    )
                }
            }
            .padding(.horizontal, 14)
        }
    }

    private func rankBadge(rank: Int?) -> some View {
        Group {
            if let rank {
                if rank == 1 {
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color(hex: 0xFFD700))
                } else if rank == 2 {
                    Image(systemName: "medal.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color(hex: 0xC0C0C0))
                } else if rank == 3 {
                    Image(systemName: "medal")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color(hex: 0xCD7F32))
                } else {
                    Text("#\(rank)")
                        .font(.system(size: 12, weight: .heavy))
                        .foregroundStyle(Color(hex: 0x00E676))
                }
            }
        }
        .frame(minWidth: 28)
    }

    private func betTypeIcon(_ betType: String) -> String {
        switch betType.lowercased() {
        case "spread": return "number"
        case "moneyline": return "dollarsign.circle"
        case "total": return "arrow.up.arrow.down"
        default: return "rectangle.on.rectangle"
        }
    }

    private func parseMatchup(_ matchup: String) -> (away: String, home: String) {
        // RN's parseMatchup splits on " @ " or " vs " — try both, fall back
        // to the original string for both sides.
        let separators = [" @ ", " vs ", " at "]
        for sep in separators {
            if let range = matchup.range(of: sep, options: .caseInsensitive) {
                let away = String(matchup[..<range.lowerBound]).trimmingCharacters(in: .whitespaces)
                let home = String(matchup[range.upperBound...]).trimmingCharacters(in: .whitespaces)
                return (away, home)
            }
        }
        return (matchup, matchup)
    }
}

// MARK: - Sport bridge

private extension AgentSport {
    /// Bridges the AgentSport enum (agents domain) to SportLeague (games
    /// domain) so we can reuse the shared OutlierMatchupCardView's palette.
    var asSportLeague: SportLeague {
        switch self {
        case .nfl: return .nfl
        case .cfb: return .cfb
        case .nba: return .nba
        case .ncaab: return .ncaab
        case .mlb: return .mlb
        }
    }
}
