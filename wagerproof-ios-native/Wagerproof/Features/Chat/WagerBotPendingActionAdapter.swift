import Foundation
import WagerproofModels

/// Adapter that turns a chat widget into a `WagerBotActionPreview`-ready
/// payload. Honeydew uses an equivalent
/// `ChatV3PendingActionAdapter.build(...)` to map between the V3 content
/// block model and the older `AssistantV2ActionPreview` data shape.
///
/// We don't currently have multiple action shapes — every widget is just
/// "open the game sheet" — but this seam lets us add saved-pick / share
/// flows later without touching the bubble view.
enum WagerBotPendingActionAdapter {
    struct Decision {
        let widget: WagerBotChatWidget
        let openSheet: Bool
    }

    static func build(widget: WagerBotChatWidget) -> Decision {
        // Today every widget is a tap-to-open-the-game-sheet
        // affordance. We still wrap it in this adapter so when we later
        // add e.g. "save this pick" / "share with agent" widget kinds
        // the dispatch lives in one place instead of fanning out
        // through the bubble.
        Decision(widget: widget, openSheet: true)
    }
}
