import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Larger, "full detail" pick card. Ports `components/agents/AgentPickCard.tsx`
/// which RN uses on Today's Picks where the user expects full reasoning +
/// key factors + result visibility.
///
/// Internally this is a thin wrapper around `AgentPickItem` with `.full`
/// reasoning enabled — keeps a single source of truth for the visual rhythm
/// of pick cards across the app.
struct AgentPickCard: View {
    let pick: AgentPick
    var loading: Bool = false
    var onTap: (() -> Void)? = nil

    var body: some View {
        AgentPickItem(
            pick: pick,
            showReasoning: .full,
            loading: loading,
            onTap: onTap
        )
    }
}
