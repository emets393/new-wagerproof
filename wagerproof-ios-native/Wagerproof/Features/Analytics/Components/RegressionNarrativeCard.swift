import SwiftUI
import WagerproofDesign

/// AI Analysis Summary body — full block-level markdown (headings, bullets,
/// blockquotes) via the app's shared `WagerBotMarkdownText` renderer. The
/// narrative ships as GitHub-style markdown with emoji headers; inline-only
/// `AttributedString` rendering used to flatten it (waiver #110).
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
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceMuted.opacity(0.4), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            // Purple accent edge mirrors RN's purple-tinted narrative chrome.
            RoundedRectangle(cornerRadius: 14)
                .stroke(Regression.accentPurple.opacity(0.25), lineWidth: 1)
        )
    }
}
