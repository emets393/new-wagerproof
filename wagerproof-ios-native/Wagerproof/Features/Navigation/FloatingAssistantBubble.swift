import SwiftUI
import WagerproofDesign

/// Floating WagerBot launcher overlaid on every tab content view. RN renders
/// this from `(drawer)/(tabs)/_layout.tsx`'s `WagerBotSuggestionBubble` +
/// `FloatingAssistantBubble`. The full draggable, typewriter-animated detached
/// bubble lives in batch B17 (Chat) — this batch ships the always-on launcher
/// button only, which is what tab content sees as a floating overlay.
///
/// Spec: docs/wagerproof-migration/08-screen-native-spec.md §7 ("Floating
/// WagerBot launcher"). Brand color is `#00E676` per the RN source.
struct FloatingAssistantBubble: View {
    /// Fired when the user taps the bubble. The tab shell pushes the
    /// `WagerbotChatView` route in B17; for now it can be a no-op.
    var onTap: () -> Void = {}

    var body: some View {
        Button {
            onTap()
        } label: {
            ZStack {
                Circle()
                    .fill(LinearGradient(
                        colors: [Color(hex: 0x00E676), Color(hex: 0x16A34A)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                    .frame(width: 56, height: 56)
                    .shadow(color: Color(hex: 0x00E676, opacity: 0.45), radius: 16, x: 0, y: 6)
                    .shadow(color: .black.opacity(0.25), radius: 4, x: 0, y: 2)

                Image(systemName: "bubble.left.and.text.bubble.right.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.white)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open WagerBot chat")
        .padding(.trailing, Spacing.lg)
        .padding(.bottom, Spacing.sm)
    }
}

#Preview {
    ZStack {
        Color.appSurface.ignoresSafeArea()
        Color.appSurface
            .overlay(alignment: .bottomTrailing) {
                FloatingAssistantBubble()
            }
    }
}
