import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Row of tappable dots driving the LearnWagerProof carousel. Mirrors
/// `wagerproof-mobile/components/learn-wagerproof/SlideProgressIndicator.tsx`.
///
/// The active dot is 8pt brand green, inactive dots are 6pt at 30% / 20% white
/// or black depending on color scheme. The RN version uses different sizes
/// (10/8) at the top — the bottom-sheet header uses 8/6 to fit alongside the
/// close + next buttons, which is the form we render here.
struct SlideProgressIndicator: View {
    let currentSlide: Int
    let onDotPress: (Int) -> Void

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<LearnWagerProofStore.totalSlides, id: \.self) { index in
                Button {
                    onDotPress(index)
                } label: {
                    let isActive = index == currentSlide
                    Circle()
                        .fill(
                            isActive
                                ? Color.appPrimary
                                : (colorScheme == .dark
                                    ? Color.white.opacity(0.3)
                                    : Color.black.opacity(0.2))
                        )
                        .frame(width: isActive ? 8 : 6, height: isActive ? 8 : 6)
                        .contentShape(Rectangle().inset(by: -6))
                }
                .buttonStyle(.plain)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Slide \(currentSlide + 1) of \(LearnWagerProofStore.totalSlides)")
    }
}
