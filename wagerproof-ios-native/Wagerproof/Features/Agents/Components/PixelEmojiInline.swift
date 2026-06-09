import SwiftUI

/// Native port of `components/agents/PixelEmojiInline.tsx`. RN renders an
/// inline pixel-art emoji with a baseline-adjusted offset so it sits on the
/// same line as surrounding text. SwiftUI does that natively when an emoji
/// is rendered inside a `Text` view — but the RN component also adds a small
/// drop-shadow + scale tweak. We replicate that here so chat surfaces feel
/// consistent.
struct PixelEmojiInline: View {
    let emoji: String
    var size: CGFloat = 16

    var body: some View {
        Text(emoji)
            .font(.system(size: size))
            .shadow(color: .black.opacity(0.18), radius: 1, x: 0, y: 1)
            // Pull the baseline up a touch so the emoji sits centered with
            // surrounding capitals.
            .baselineOffset(-1)
    }
}

#Preview {
    HStack(spacing: 0) {
        Text("Agent ")
        PixelEmojiInline(emoji: "🤖", size: 18)
        Text(" is thinking…")
    }
    .padding()
}
