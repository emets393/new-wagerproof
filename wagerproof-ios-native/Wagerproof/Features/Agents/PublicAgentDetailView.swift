import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores
#if canImport(UIKit)
import UIKit
#endif

/// Native port of `app/(drawer)/(tabs)/agents/public/[id].tsx`. Read-only public
/// detail with a Follow / Unfollow CTA.
///
/// Matches `AgentDetailView`'s theme exactly: a `CollapsingWidgetScroll` with the
/// collapsing agent aura hero over container-less inline sections (Today's Picks
/// mini-ticket rail → Performance charts → Recent Activity → Pick History), all
/// keyed off a plain `AgentSectionHeader` so the content reads as page highlights
/// rather than boxed cards. The only differences from the owner screen are the
/// public-specific chrome: no generation/autopilot/settings controls, plus the
/// Follow CTA on top and the responsible-gambling disclaimer at the bottom.
struct PublicAgentDetailView: View {
    let agentId: String

    @Environment(AuthStore.self) private var auth
    @Environment(ProAccessStore.self) private var proAccess
    // B-follow-ux: shared app-wide follow list, so the "My Agents" hub's
    // Following section updates immediately after a follow/unfollow here —
    // no separate fetch/poll needed on the list side.
    @Environment(FollowedAgentsStore.self) private var followedAgentsStore
    @State private var store: AgentDetailStore
    @State private var auditStore = AgentPickAuditStore()
    @State private var isFollowing: Bool = false
    @State private var followBusy: Bool = false
    @State private var showHistorySheet: Bool = false
    @State private var errorMessage: String? = nil
    /// "Copy build" CTA — opens the agent-creation wizard prefilled from this
    /// public agent's readable profile fields. Only ever shown for agents the
    /// viewer doesn't own; the resulting agent is a brand-new one they own.
    @State private var showCopyBuild: Bool = false
    /// Full-screen pick focus presentation (tap a mini ticket → the large card).
    /// No print intro here — public viewers never trigger a generation run.
    @State private var focusStartIndex: Int? = nil
    /// Easter egg parity with the owner view: tapping the hero avatar ripples the
    /// pixelwave background.
    @State private var rippleEmitter = GlyphRippleEmitter()

    /// Gap below each inline section — matches `AgentDetailView.sectionGap` so the
    /// two detail surfaces share one vertical rhythm.
    private let sectionGap: CGFloat = 28

    init(agentId: String) {
        self.agentId = agentId
        _store = State(initialValue: AgentDetailStore(agentId: agentId))
    }

    private var entitlements: AgentEntitlementsStore {
        AgentEntitlementsStore(proAccess: proAccess)
    }

    private var agent: Agent? { store.snapshot?.agent }
    /// Agent brand tint for the pick tickets + folder (matches the perf chart).
    private var agentTint: Color {
        agent.map { AgentColorPalette.primary(for: $0.avatarColor) } ?? Color(hex: 0x00E676)
    }
    private var canViewPicks: Bool { entitlements.canViewAgentPicks }
    /// Owners can always view their own agent's picks/charts (web parity).
    private var canSeePicks: Bool { canViewPicks || isOwnAgent }
    private var isOwnAgent: Bool {
        guard let uid = currentUserId, let ownerId = agent?.userId else { return false }
        return uid == ownerId.lowercased()
    }
    private var historyReloadKey: String {
        "\(agentId)-\(canSeePicks)-\(isOwnAgent)-\(currentUserId ?? "")"
    }
    private var currentUserId: String? {
        if case .authenticated(let userId) = auth.phase {
            return userId.uuidString.lowercased()
        }
        return nil
    }

    var body: some View {
        Group {
            if agent != nil {
                detailScroll
            } else if case .loading = store.snapshotLoadState {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                notFoundView
            }
        }
        // Match AgentDetailView: commit the page to the always-dark pixelwave
        // aesthetic so the glass cards + text read over the near-black field.
        .preferredColorScheme(.dark)
        .toolbarBackground(.hidden, for: .navigationBar)
        // Hide the app tab bar on the detail page (pushed from the Agents tab).
        .toolbar(.hidden, for: .tabBar)
        // While the pick focus overlay is up, hide the nav bar so the only control
        // is the overlay's own chevron (mirrors AgentDetailView).
        .toolbar(focusStartIndex == nil ? .visible : .hidden, for: .navigationBar)
        .navigationTitle(agent?.name ?? "Public Agent")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await refresh() }
        .task(id: historyReloadKey) {
            if store.snapshot == nil {
                await store.refreshSnapshot()
            }
            if let following = store.isFollowingFromSnapshot {
                isFollowing = following
            }
            if canSeePicks {
                async let history: Void = store.loadHistory(isOwner: isOwnAgent)
                async let performance: Void = store.loadPerformancePicks(isOwner: isOwnAgent)
                _ = await (history, performance)
            }
        }
        .sheet(isPresented: $auditStore.isPresented) {
            if let pick = auditStore.selectedPick {
                AgentPickPayloadAuditSheet(pick: pick, payload: auditStore.payload)
            }
        }
        .sheet(isPresented: $showHistorySheet) {
            PickHistorySheet(
                items: store.fullBetHistory,
                agentName: agent?.name ?? "Agent",
                agentColor: agentTint
            )
        }
        // "Copy build" — full-screen (not a sheet) to match how `.createAgent`
        // presents the same `AgentBuilderView` pixelwave carousel elsewhere.
        .fullScreenCover(isPresented: $showCopyBuild) {
            if let agent {
                AgentBuilderView(
                    initialDraft: .copying(fromPublicAgent: agent),
                    onCreated: { _ in showCopyBuild = false }
                )
            }
        }
        .overlay {
            if let start = focusStartIndex {
                AgentPickFocusView(
                    items: store.todaysBetItems,
                    accent: agentTint,
                    startIndex: start,
                    printIntro: false,
                    onAudit: { pick in auditStore.present(pick: pick) },
                    onClose: { focusStartIndex = nil }
                )
                .transition(.opacity)
            }
        }
        .alert("Error", isPresented: errorAlertBinding, presenting: errorMessage) { _ in
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: { msg in Text(msg) }
    }

    private var detailScroll: some View {
        CollapsingWidgetScroll(heroMaxHeight: 196, heroMinHeight: 60) { _ in
            AgentPixelWaveBackground(
                avatarColor: agent?.avatarColor ?? "#6366f1",
                rippleEmitter: rippleEmitter
            )
        } hero: { progress in
            heroView(progress: progress)
        } content: {
            followBlock
            picksSection
            performanceSection
            recentActivitySection
            pickHistorySlot
            disclaimer
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
        }
    }

    // MARK: - Hero

    @ViewBuilder
    private func heroView(progress: CGFloat) -> some View {
        if let agent = agent {
            AgentGlassHero(
                agent: agent,
                performance: store.snapshot?.performance,
                lockedNetUnits: !canSeePicks,
                subtitleSystemImage: "globe",
                subtitle: "Public Agent",
                progress: progress,
                onAvatarTap: rippleAvatar
            )
            .padding(.horizontal, 16)
            .padding(.top, 6)
        }
    }

    // MARK: - Follow CTA / own-agent banner

    @ViewBuilder
    private var followBlock: some View {
        VStack(spacing: 10) {
            if isOwnAgent {
                ownAgentBanner
            } else {
                followButton
                copyBuildButton
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, WidgetCard.gap)
    }

    /// "Copy build" — never enables Generate on someone else's agent; it just
    /// opens the normal creation wizard prefilled from the public agent's
    /// personality/insights/sports/identity so the viewer can tweak + create
    /// their OWN agent from the same starting point.
    private var copyBuildButton: some View {
        Button {
            showCopyBuild = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "doc.on.doc")
                Text("Copy build")
                    .font(.system(size: 15, weight: .heavy))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.appSurfaceMuted)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.appBorder, lineWidth: 1)
            )
            .foregroundStyle(Color.appTextPrimary)
        }
        .buttonStyle(.plain)
    }

    private var followButton: some View {
        Button {
            Task { await toggleFollow() }
        } label: {
            HStack(spacing: 8) {
                if followBusy {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: isFollowing ? "checkmark" : "plus")
                }
                Text(isFollowing ? "Following" : "Follow")
                    .font(.system(size: 15, weight: .heavy))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isFollowing ? Color.appBorder.opacity(0.5) : Color(hex: 0x00E676))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(isFollowing ? Color(hex: 0x00E676) : .clear, lineWidth: 2)
            )
            .foregroundStyle(isFollowing ? Color(hex: 0x00E676) : .white)
        }
        .buttonStyle(.plain)
        .disabled(followBusy)
    }

    private var ownAgentBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "person.crop.circle.badge.checkmark")
                .foregroundStyle(Color.appWin)
            Text("This is your agent").font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appWin)
        }
        .frame(maxWidth: .infinity)
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.appWin.opacity(0.1))
        )
    }

    // MARK: - Today's Picks section (container-less, mini-ticket rail)

    /// The headline section — a plain `AgentSectionHeader` over the horizontal
    /// mini-ticket rail (edge-bleeding past the section inset so cards scroll
    /// under the screen edge), matching the owner detail page. Read-only: no
    /// generation card / footer. Tapping a ticket opens the focus card.
    @ViewBuilder
    private var picksSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            AgentSectionHeader(title: "Today's Picks", systemImage: "checklist")

            if !canSeePicks {
                AgentLockedPicksRail(accent: agentTint)
                    .padding(.horizontal, -WidgetCard.hInset)
            } else if case .loading = store.snapshotLoadState, store.todaysBetItems.isEmpty {
                AgentTodaysPicksRailSkeleton()
                    .padding(.horizontal, -WidgetCard.hInset)
            } else if store.todaysBetItems.isEmpty {
                emptyPicksState
            } else {
                AgentTodaysPicksRail(
                    items: store.todaysBetItems,
                    accent: agentTint,
                    onTapPick: { pick in
                        if let idx = store.todaysBetItems.firstIndex(where: { $0.id == AgentBetItem.pick(pick).id }) {
                            focusStartIndex = idx
                        }
                    },
                    onTapParlay: { parlay in
                        // Parlays ride the same focus pager as picks (share included).
                        if let idx = store.todaysBetItems.firstIndex(where: { $0.id == AgentBetItem.parlay(parlay).id }) {
                            focusStartIndex = idx
                        }
                    }
                )
                .padding(.horizontal, -WidgetCard.hInset)
            }
        }
        .padding(.horizontal, WidgetCard.hInset)
        .padding(.bottom, sectionGap)
    }

    private var emptyPicksState: some View {
        VStack(spacing: 10) {
            Image(systemName: "calendar.badge.exclamationmark").font(.system(size: 28))
                .foregroundStyle(Color.appTextSecondary)
            Text("No picks yet today")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 22)
    }

    // MARK: - Performance section (container-less, inline charts)

    @ViewBuilder
    private var performanceSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            AgentSectionHeader(title: "Performance", systemImage: "chart.line.uptrend.xyaxis")

            if !canSeePicks {
                VStack(spacing: 8) {
                    Image(systemName: "lock.fill").font(.system(size: 26))
                        .foregroundStyle(Color.appTextSecondary)
                    Text("Upgrade to view pick charts")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 28)
            } else if isPerformanceSettling {
                AgentPerformanceChartSkeleton()
                    .transition(.opacity)
            } else if let agent = agent {
                // `showsTitle: false` — the section header above already names it.
                AgentPerformanceCharts(
                    items: store.performancePicks.map(AgentBetItem.pick)
                        + store.performanceParlays.map(AgentBetItem.parlay),
                    preferredSports: agent.preferredSports,
                    agentColor: AgentColorPalette.primary(for: agent.avatarColor),
                    showsTitle: false
                )
                .transition(.opacity)
            }
        }
        .padding(.horizontal, WidgetCard.hInset)
        .padding(.bottom, sectionGap)
        .animation(.easeOut(duration: 0.25), value: isPerformanceSettling)
    }

    /// True while performance picks are doing their FIRST load (idle or loading
    /// with nothing cached). "Loaded but empty" hands off to the chart's own
    /// graded-picks empty state rather than the skeleton.
    private var isPerformanceSettling: Bool {
        guard store.performancePicks.isEmpty && store.performanceParlays.isEmpty else { return false }
        switch store.performanceLoadState {
        case .idle, .loading: return true
        case .loaded, .failed: return false
        }
    }

    // MARK: - Recent Activity section

    /// The activity timeline, matching the owner page. `AgentTimeline` renders its
    /// own section header and self-hides (EmptyView) when there are no events, so
    /// this whole section disappears for brand-new agents.
    @ViewBuilder
    private var recentActivitySection: some View {
        if let agent = agent {
            AgentTimeline(
                agent: agent,
                performance: store.snapshot?.performance,
                todaysPicks: store.todaysPicks,
                todaysParlays: store.todaysParlays,
                todaysRun: store.todaysGenerationRun
            )
            .padding(.horizontal, WidgetCard.hInset)
            .padding(.bottom, sectionGap)
        }
    }

    // MARK: - Pick History folder

    /// The agent's recent pick tickets poke out of a manila folder embossed "PICK
    /// HISTORY". Tapping opens the full rolodex + filter sheet (`PickHistorySheet`).
    @ViewBuilder
    private var pickHistorySlot: some View {
        AgentPickFolderCard(
            recentItems: canSeePicks ? store.fullBetHistory : [],
            totalCount: store.fullBetHistory.count,
            loading: canSeePicks && isHistoryLoading && store.fullBetHistory.isEmpty,
            locked: !canSeePicks,
            agentColor: agentTint,
            onTap: { showHistorySheet = true }
        )
        .padding(.horizontal, WidgetCard.hInset)
        .padding(.bottom, sectionGap)
    }

    private var isHistoryLoading: Bool {
        if case .loading = store.historyLoadState { return true }
        if case .loading = store.performanceLoadState { return true }
        return false
    }

    // MARK: - Shared bits

    private var notFoundView: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.crop.circle.badge.exclamationmark")
                .font(.system(size: 36))
                .foregroundStyle(Color.appTextSecondary)
            Text("Agent not found").font(.system(size: 15, weight: .semibold))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var disclaimer: some View {
        HStack(alignment: .top, spacing: 6) {
            Image(systemName: "info.circle").font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
            Text("AI agents analyze data — they do not constitute betting advice. Verify independently and wager responsibly.")
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextSecondary)
        }
        .opacity(0.7)
    }

    // MARK: - Actions

    /// Easter egg: a tap on the hero avatar fires a glyph ripple from the disc's
    /// global center through the pixelwave background, plus a light haptic.
    private func rippleAvatar(at globalCenter: CGPoint) {
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
        rippleEmitter.emit(at: globalCenter)
    }

    private func refresh() async {
        await store.refreshSnapshot()
        if canSeePicks {
            async let history: Void = store.loadHistory(isOwner: isOwnAgent)
            async let performance: Void = store.loadPerformancePicks(isOwner: isOwnAgent)
            _ = await (history, performance)
        }
        if let following = store.isFollowingFromSnapshot {
            isFollowing = following
        }
    }

    private func toggleFollow() async {
        guard let userId = currentUserId else {
            errorMessage = "Sign in to follow agents."
            return
        }
        followBusy = true
        defer { followBusy = false }
        let nextValue = !isFollowing
        isFollowing = nextValue
        do {
            try await AgentChatService.setFollow(userId: userId, agentId: agentId, follow: nextValue)
            // B1 — keep the shared FollowedAgentsStore in sync so the "My
            // Agents" hub's Following section reflects this change the next
            // time it appears, without waiting on its own poll/refresh.
            followedAgentsStore.bind(userId: userId)
            await followedAgentsStore.refresh()
        } catch {
            isFollowing = !nextValue
            errorMessage = (error as NSError).localizedDescription
        }
    }

    private var errorAlertBinding: Binding<Bool> {
        Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
    }
}
