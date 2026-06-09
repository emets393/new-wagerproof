import SwiftUI
import WagerproofDesign

/// Renders a `SportTool` as a HoneydewOptionCard — the same drifting-symbol
/// gradient promo card the Settings membership/Discord banners use. Routing is
/// the caller's concern (the card just fires `onTap`).
struct ToolBannerCard: View {
    let tool: SportTool
    let onTap: () -> Void

    var body: some View {
        HoneydewOptionCard(
            title: tool.title,
            subtitle: tool.subtitle,
            actionWord: tool.actionWord,
            primaryColor: tool.primaryColor,
            secondaryColor: tool.secondaryColor,
            symbols: tool.symbols,
            seed: tool.seed,
            speedFactor: tool.speedFactor,
            yJitter: tool.yJitter,
            onTap: onTap
        )
    }
}
