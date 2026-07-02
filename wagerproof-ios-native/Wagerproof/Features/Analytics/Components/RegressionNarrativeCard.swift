import SwiftUI
import WagerproofDesign

/// AI Analysis Summary body — full block-level markdown (headings, bullets,
/// blockquotes) via the app's shared `WagerBotMarkdownText` renderer. The
/// narrative ships as GitHub-style markdown with emoji headers; inline-only
/// `AttributedString` rendering used to flatten it (waiver #110).
///
/// Renders as plain flowing text (no card chrome) so the narrative reads
/// like an article intro and gets the full content width — the pinned
/// "AI Analysis Summary" header above already provides the section framing.
struct RegressionNarrativeCard: View {
    let text: String

    var body: some View {
        WagerBotMarkdownText(
            text,
            baseFont: .system(size: 14),
            // RN styles narrative blockquotes purple-tinted, not chat-gray.
            quoteAccent: Regression.accentPurple
        )
        .lineSpacing(4)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
