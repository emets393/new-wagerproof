import Foundation

/// Routes addressable from the Agents `NavigationStack`. Keep these as values
/// so SwiftUI's path machinery can serialize them.
///
/// `.agentDetail` / `.createAgent` / `.publicAgentDetail` all currently land
/// on placeholder views in B13. They become real screens in:
///   - B14 — Agent creation wizard (`createAgent`).
///   - B15 — Owner detail screen (`agentDetail`).
///   - B16 — Public detail / leaderboard tap-throughs (`publicAgentDetail`).
enum AgentsRoute: Hashable {
    case agentDetail(agentId: String)
    case createAgent
    case publicAgentDetail(agentId: String)
    /// Jump straight into an existing agent's editor (the swipe "Edit" action),
    /// skipping the detail screen's gear tap.
    case editAgent(agentId: String)
}
