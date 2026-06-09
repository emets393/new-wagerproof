import SwiftUI
import WagerproofModels

/// Per-B15 routing helpers. We avoid editing `AgentsRouter.swift` and
/// `AgentsView.swift` directly because B14 (creation wizard) and B16
/// (top picks feed) are in flight in parallel — both touch those files.
///
/// Integration step (post-B14 + post-B16 stitch):
///   1. In `AgentsView.routeDestination(_:)` replace the placeholder
///      destinations with the real screens declared below:
///        case .agentDetail(let id):
///            AgentDetailView(agentId: id)
///        case .publicAgentDetail(let id):
///            PublicAgentDetailView(agentId: id)
///   2. Delete the three private `*PlaceholderView` structs at the bottom
///      of `AgentsView.swift` (they were waiver #072 stubs).
///
/// We expose factory helpers here so the integrator can grep for
/// `AgentsRouter+B15` and find every B15 callsite to update.
@MainActor
enum AgentsRouterB15 {
    /// Build the owner detail view. Pass an optional `AgentWithPerformance`
    /// so the screen can render its header instantly before the snapshot
    /// resolves (matches the RN behavior).
    @ViewBuilder
    static func ownerDetail(agentId: String, prefetched: AgentWithPerformance? = nil) -> some View {
        AgentDetailView(agentId: agentId, initialAgent: prefetched)
    }

    /// Build the public read-only detail view.
    @ViewBuilder
    static func publicDetail(agentId: String) -> some View {
        PublicAgentDetailView(agentId: agentId)
    }

    /// Build the settings sub-screen. Typically pushed from
    /// `AgentDetailView`'s toolbar.
    @ViewBuilder
    static func settings(agentId: String, prefetched: Agent? = nil) -> some View {
        AgentSettingsView(agentId: agentId, initialAgent: prefetched)
    }
}
