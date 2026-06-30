import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// Native port of `app/(drawer)/(tabs)/agents/public/[id].tsx`. Read-only public
/// detail with a Follow / Unfollow CTA. Shares the collapsing aura hero + Liquid
/// Glass widget-card theme with `AgentDetailView`, minus the owner-only autopilot
/// / settings controls.
struct PublicAgentDetailView: View {
    let agentId: String

    @Environment(AuthStore.self) private var auth
    @Environment(ProAccessStore.self) private var proAccess
    @State private var store: AgentDetailStore
    @State private var auditStore = AgentPickAuditStore()
    @State private var isFollowing: Bool = false
    @State private var followBusy: Bool = false
    @State private var showHistory: Bool = true
    @State private var errorMessage: String? = nil

    init(agentId: String) {
        self.agentId = agentId
        _store = State(initialValue: AgentDetailStore(agentId: agentId))
    }

    private var entitlements: AgentEntitlementsStore {
        AgentEntitlementsStore(proAccess: proAccess)
    }

    private var agent: Agent? { store.snapshot?.agent }
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
    private var todaysPicksContentKey: String {
        let loading: Bool = {
            if case .loading = store.snapshotLoadState { return true }
            return false
        }()
        return "\(loading)-\(store.todaysPicks.count)"
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
        .alert("Error", isPresented: errorAlertBinding, presenting: errorMessage) { _ in
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: { msg in Text(msg) }
    }

    private var detailScroll: some View {
        CollapsingWidgetScroll(heroMaxHeight: 256, heroMinHeight: 132) { progress in
            AgentPixelWaveBackground(avatarColor: agent?.avatarColor ?? "#6366f1", progress: progress)
        } hero: { progress in
            heroView(progress: progress)
        } content: {
            followBlock
            todaysPicksCard
            pickHistoryCard
            performanceCard
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
                progress: progress
            )
            .padding(.horizontal, 16)
            .padding(.top, 6)
        }
    }

    // MARK: - Follow CTA / own-agent banner

    @ViewBuilder
    private var followBlock: some View {
        Group {
            if isOwnAgent {
                ownAgentBanner
            } else {
                followButton
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, WidgetCard.gap)
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

    // MARK: - Today's Picks card

    @ViewBuilder
    private var todaysPicksCard: some View {
        WidgetCollapsingSection(
            title: "Today's Picks",
            systemImage: "doc.text.image",
            iconTint: Color(hex: 0x00E676),
            contentKey: todaysPicksContentKey
        ) {
            VStack(alignment: .leading, spacing: 12) {
                if !canSeePicks {
                    lockedPickPlaceholder
                    lockedPickPlaceholder
                } else if case .loading = store.snapshotLoadState, store.todaysPicks.isEmpty {
                    PickCardSkeleton(); PickCardSkeleton()
                } else if store.todaysPicks.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "calendar.badge.exclamationmark").font(.system(size: 28))
                            .foregroundStyle(Color.appTextSecondary)
                        Text("No picks yet today")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                } else {
                    ForEach(Array(store.todaysPicks.enumerated()), id: \.element.id) { index, pick in
                        AgentPickCard(pick: pick, onTap: { auditStore.present(pick: pick) })
                            .staggeredAppear(index: index)
                    }
                }
            }
        }
    }

    // MARK: - Pick History card

    @ViewBuilder
    private var pickHistoryCard: some View {
        WidgetCollapsingSection(
            title: "Pick History",
            systemImage: "clock.arrow.circlepath",
            iconTint: Color.appPrimary,
            accessory: .chevron(expanded: showHistory),
            onHeaderTap: {
                showHistory.toggle()
                if showHistory {
                    Task { await store.loadHistory(isOwner: isOwnAgent) }
                }
            }
        ) {
            if showHistory {
                historyContent
            } else {
                Text("Tap to view this agent's graded pick history")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private var historyContent: some View {
        if !canSeePicks {
            VStack(spacing: 8) { lockedPickPlaceholder; lockedPickPlaceholder }
        } else if case .loading = store.historyLoadState, store.pickHistory.isEmpty {
            VStack(spacing: 8) { PickCardSkeleton(); PickCardSkeleton() }
        } else if store.pickHistory.isEmpty {
            Text("No picks yet")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
        } else {
            VStack(spacing: 8) {
                ForEach(Array(store.pickHistory.enumerated()), id: \.element.id) { index, pick in
                    AgentPickItem(pick: pick, showReasoning: .none, onTap: { auditStore.present(pick: pick) })
                        .staggeredAppear(index: index)
                }
            }
        }
    }

    // MARK: - Performance card

    @ViewBuilder
    private var performanceCard: some View {
        WidgetCollapsingSection(title: "Performance", systemImage: "chart.line.uptrend.xyaxis", iconTint: Color.appPrimary) {
            if !canSeePicks {
                VStack(spacing: 8) {
                    Image(systemName: "lock.fill").font(.system(size: 22)).foregroundStyle(Color.appTextSecondary)
                    Text("Unlock performance with Pro")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
            } else if case .loading = store.performanceLoadState, store.performancePicks.isEmpty {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 28)
            } else if let agent = agent {
                AgentPerformanceCharts(
                    allPicks: store.performancePicks,
                    preferredSports: agent.preferredSports,
                    agentColor: AgentColorPalette.primary(for: agent.avatarColor)
                )
                .task {
                    if store.performancePicks.isEmpty {
                        await store.loadPerformancePicks(isOwner: isOwnAgent)
                    }
                }
            }
        }
    }

    // MARK: - Shared bits

    private var lockedPickPlaceholder: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("LOCKED PICK")
                    .font(.system(size: 10, weight: .heavy, design: .monospaced))
                    .tracking(1.5)
                    .foregroundStyle(Color.appTextSecondary)
                Spacer()
                Image(systemName: "lock.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Text("Upgrade to Pro to view this agent's picks")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.appSurfaceMuted)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 1)
        )
    }

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
        } catch {
            isFollowing = !nextValue
            errorMessage = (error as NSError).localizedDescription
        }
    }

    private var errorAlertBinding: Binding<Bool> {
        Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
    }
}
