import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Single conversation bubble in the roast transcript. Splits the RN
/// `messageBubble` styling into a dedicated SwiftUI view so the scroll's
/// `ForEach` is a flat list of named elements rather than an inline `if`
/// chain.
///
/// Visual rules (verbatim from `RoastScreen.tsx`):
/// - User: green 20% bg, right-aligned, bottom-right corner pinched to 4pt.
/// - Assistant: white 8% bg, left-aligned, bottom-left corner pinched to 4pt,
///   "THE BOOKIE" caption above the text.
/// - Live transcript variants: dashed border + 70/80% opacity on the text.
struct RoastMessageBubble: View {
    enum Variant: Equatable, Hashable {
        case finalized(role: RoastSessionStore.Message.Role)
        case liveUser
        case liveAssistant
    }

    let text: String
    let variant: Variant

    /// Resolves the underlying role so we can fork bg / alignment / etc.
    private var role: RoastSessionStore.Message.Role {
        switch variant {
        case .finalized(let role): return role
        case .liveUser: return .user
        case .liveAssistant: return .assistant
        }
    }

    private var isUser: Bool { role == .user }

    /// Base bubble color. Live transcripts get a softer wash.
    private var background: Color {
        switch variant {
        case .finalized(let role):
            return role == .user
                ? Color.appPrimary.opacity(0.2)
                : Color.white.opacity(0.08)
        case .liveUser:
            return Color.appPrimary.opacity(0.08)
        case .liveAssistant:
            return Color.white.opacity(0.08)
        }
    }

    private var textOpacity: Double {
        switch variant {
        case .finalized(let role): return role == .user ? 1.0 : 0.9
        case .liveUser: return 0.7
        case .liveAssistant: return 0.8
        }
    }

    /// Pinched corner toward the speaker's side. RN uses
    /// `borderBottomRightRadius: 4` (user) / `borderBottomLeftRadius: 4`
    /// (AI). We emulate via a `UnevenRoundedRectangle`.
    private var bubbleShape: UnevenRoundedRectangle {
        let topLeading: CGFloat = 16
        let topTrailing: CGFloat = 16
        let bottomLeading: CGFloat = isUser ? 16 : 4
        let bottomTrailing: CGFloat = isUser ? 4 : 16
        return UnevenRoundedRectangle(
            cornerRadii: .init(
                topLeading: topLeading,
                bottomLeading: bottomLeading,
                bottomTrailing: bottomTrailing,
                topTrailing: topTrailing
            )
        )
    }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 40) }

            VStack(alignment: .leading, spacing: 4) {
                if !isUser {
                    // "THE BOOKIE" caption. RN: 11pt 700 weight, all caps,
                    // 0.5 tracking, green tint. The label appears above every
                    // assistant bubble — including live transcripts.
                    Text("THE BOOKIE")
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.5)
                        .foregroundStyle(Color.appPrimary)
                }
                Text(text)
                    .font(.system(size: 15))
                    .foregroundStyle(.white.opacity(textOpacity))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                bubbleShape.fill(background)
            )
            .overlay(
                // Live transcripts get a dashed border to differentiate from
                // finalized turns. RN: dashed 1pt border on the user-live
                // variant. We extend the treatment to the live-assistant
                // variant as well for parity with the spec's animation note.
                bubbleShape.stroke(
                    variant == .liveUser
                        ? Color.appPrimary.opacity(0.3)
                        : Color.clear,
                    style: StrokeStyle(lineWidth: 1, dash: [5])
                )
            )
            .frame(maxWidth: 320, alignment: isUser ? .trailing : .leading)

            if !isUser { Spacer(minLength: 40) }
        }
        .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
    }
}

#if DEBUG
#Preview("Roast Bubbles") {
    ScrollView {
        VStack(spacing: 10) {
            RoastMessageBubble(text: "I bet $500 on the Lions ML.", variant: .finalized(role: .user))
            RoastMessageBubble(text: "The Lions? My condolences. That's not a parlay, that's a charity donation to the sportsbook.", variant: .finalized(role: .assistant))
            RoastMessageBubble(text: "And I parlayed it with the Bears…", variant: .liveUser)
            RoastMessageBubble(text: "Oh sweet summer child…", variant: .liveAssistant)
        }
        .padding()
    }
    .background(Color.black)
    .preferredColorScheme(.dark)
}
#endif
