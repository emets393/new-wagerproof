import SwiftUI
import WagerproofDesign

/// Native port of `wagerproof-mobile/components/WagerBotInsightPill.tsx`.
///
/// Pill-shaped CTA rendered in the sport-specific bottom sheet headers. RN's
/// implementation measures itself on press and asks `WagerBotSuggestionContext`
/// to "detach" the floating WagerBot bubble from the pill's position. The
/// Swift `WagerBotSuggestionStore` doesn't exist yet (Phase 5).
///
/// FIDELITY-WAIVER #100: this version takes a generic `onTap` closure
/// instead of pushing the pill's measured frame into a suggestion store.
/// Once `WagerBotSuggestionStore` ships, the closure goes away and the pill
/// computes its own frame and calls the store directly.
struct WagerBotInsightPill: View {
    /// Fired when the user taps the pill. Receives the pill's on-screen
    /// frame so the future bubble-detach animation can originate from the
    /// pill's exact position. Callers that don't need the frame can ignore
    /// it.
    var onTap: (CGRect) -> Void = { _ in }

    @State private var measuredFrame: CGRect = .zero

    /// Constant pill dimensions — matched 1:1 with RN's `PILL_WIDTH = 140`
    /// and `PILL_HEIGHT = 32`. The future detach animation reads these.
    private let pillWidth: CGFloat = 140
    private let pillHeight: CGFloat = 32

    var body: some View {
        Button {
            // Match RN's medium impact haptic on tap.
            #if canImport(UIKit)
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            #endif
            onTap(measuredFrame)
        } label: {
            HStack(spacing: 6) {
                ZStack {
                    Circle()
                        .fill(Color(hex: 0x00E676, opacity: 0.15))
                        .frame(width: 20, height: 20)
                    WagerBotIcon(size: 13)
                        .foregroundStyle(Color(hex: 0x00E676))
                }
                Text("Tap for insights")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 12)
            .frame(width: pillWidth, height: pillHeight)
            .background(
                // RN uses a solid 85%-opaque black regardless of theme so the
                // green accent always reads as the brand color. Keep parity.
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.black.opacity(0.85))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color(hex: 0x00E676, opacity: 0.3), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.3), radius: 8, y: 4)
        }
        .buttonStyle(.plain)
        // Capture the pill's on-screen frame for the future detach animation.
        // GeometryReader is the SwiftUI idiomatic way to surface a view's
        // bounds without `findNodeHandle` / `UIManager.measure`.
        .background(
            GeometryReader { proxy in
                Color.clear
                    .preference(key: PillFramePreferenceKey.self, value: proxy.frame(in: .global))
            }
        )
        .onPreferenceChange(PillFramePreferenceKey.self) { frame in
            measuredFrame = frame
        }
        .padding(.trailing, 12)
        .padding(.bottom, 8)
        .accessibilityLabel("Open WagerBot insight for this game")
    }
}

/// PreferenceKey used to surface the pill's measured frame from a
/// `GeometryReader` background into the outer view's `@State`. Standard
/// SwiftUI pattern for "I need to know where I rendered".
private struct PillFramePreferenceKey: PreferenceKey {
    static var defaultValue: CGRect = .zero
    static func reduce(value: inout CGRect, nextValue: () -> CGRect) {
        value = nextValue()
    }
}
