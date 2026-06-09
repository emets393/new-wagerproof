import SwiftUI
import WagerproofDesign
import WagerproofStores

/// SwiftUI port of `wagerproof-mobile/components/learn-wagerproof/LearnWagerProofBottomSheet.tsx`.
///
/// Presented globally from `MainTabView` as a `.sheet(item: $store.activeTopic)` —
/// the active topic seeds the slide index, then the user can swipe through all
/// 6 slides via the native `TabView(.page)` carousel.
///
/// Native primitives:
///   - `TabView(.page)` replaces the RN horizontal `FlatList`. Page indicator
///     is hidden in favor of the custom `SlideProgressIndicator` so taps on a
///     dot can jump straight to that slide (parity with RN behavior).
///   - The bottom-sheet container is a regular `.sheet` (no third-party gorhom
///     bottom sheet library required). Drag handle comes free via
///     `.presentationDragIndicator(.visible)`.
///   - `presentationDetents([.large])` matches the RN 90% snap point closely
///     enough — `.medium` clips the slide content on smaller phones.
struct LearnWagerProofBottomSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Bindable var store: LearnWagerProofStore

    var body: some View {
        VStack(spacing: 0) {
            header
            carousel
        }
        .background(.ultraThinMaterial)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(.regularMaterial)
        .interactiveDismissDisabled(false)
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button {
                store.markAsSeen()
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(width: 40, height: 32, alignment: .leading)
            }
            .accessibilityLabel("Close")

            Spacer()

            SlideProgressIndicator(currentSlide: store.currentSlide) { index in
                withAnimation(.easeInOut(duration: 0.25)) {
                    store.goToSlide(index)
                }
            }

            Spacer()

            Button {
                handleNext()
            } label: {
                Text(store.isLastSlide ? "Done" : "Next")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
                    .frame(width: 40, height: 32, alignment: .trailing)
            }
            .accessibilityLabel(store.isLastSlide ? "Finish walkthrough" : "Next slide")
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.vertical, 6)
    }

    // MARK: - Carousel

    private var carousel: some View {
        TabView(selection: $store.currentSlide) {
            // Slide 0 — Create a 24/7 Agent.
            LearnSlide(
                systemImage: "brain.head.profile",
                title: "Create a 24/7 Agent",
                description: "Build agents that research games and find picks for you all day, every day.",
                valueProposition: "Create multiple agents, run different strategies in parallel, and track the world's best agents with full records and picks on the leaderboard."
            ) {
                Slide1_Create247Agent()
            }
            .tag(0)

            // Slide 1 — Game Predictions.
            LearnSlide(
                systemImage: "rectangle.stack.fill",
                title: "Game Predictions",
                description: "Our AI model analyzes thousands of data points. Green confidence = strong pick.",
                valueProposition: "Stop guessing. Our models process historical data, player stats, and situational factors to give you an edge over the average bettor. Higher confidence means higher historical accuracy."
            ) {
                Slide1_GameCards()
            }
            .tag(1)

            // Slide 2 — Game Details.
            LearnSlide(
                systemImage: "chart.bar.fill",
                title: "Game Details",
                description: "Tap any game card to reveal full betting analysis and public betting sentiment.",
                valueProposition: "See where the smart money is going. When our model disagrees with Vegas, that's where value lives. Public betting percentages help you fade the crowd when they're wrong."
            ) {
                Slide2_GameDetails()
            }
            .tag(2)

            // Slide 3 — WagerBot Assistant.
            LearnSlide(
                systemImage: "brain.head.profile",
                title: "WagerBot Assistant",
                description: "WagerBot automatically surfaces insights as you browse.",
                valueProposition: "Never miss a key insight. WagerBot watches for trends, streaks, and situational edges so you don't have to dig through stats yourself. It's like having a research assistant in your pocket."
            ) {
                Slide3_WagerBot()
            }
            .tag(3)

            // Slide 4 — Outliers & Alerts.
            LearnSlide(
                systemImage: "chart.line.uptrend.xyaxis",
                title: "Outliers & Alerts",
                description: "Find value where prediction markets disagree with Vegas, or when model overconfidence signals a fade.",
                valueProposition: "Exploit market inefficiencies. When Polymarket odds differ significantly from Vegas, or when our model shows extreme confidence, these are historically profitable opportunities."
            ) {
                Slide5_Outliers()
            }
            .tag(4)

            // Slide 5 — More Features (no value prop card in RN).
            LearnSlide(
                systemImage: "square.grid.2x2.fill",
                title: "More Features",
                description: "Explore all these features to maximize your betting edge.",
                valueProposition: nil
            ) {
                Slide6_MoreFeatures()
            }
            .tag(5)
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .animation(.easeInOut(duration: 0.25), value: store.currentSlide)
    }

    // MARK: - Actions

    private func handleNext() {
        if store.isLastSlide {
            store.markAsSeen()
            dismiss()
        } else {
            withAnimation(.easeInOut(duration: 0.25)) {
                store.nextSlide()
            }
        }
    }
}
