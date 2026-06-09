import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Learn & Discover hub. Adopts Honeydew's `LearnAndDiscoverView` visual
/// language (intro paragraph + topic cards + settings card) with Wagerproof
/// brand tokens.
///
/// Unlike the RN app — which only exposes the carousel as a bottom sheet —
/// this view also surfaces an explicit "hub" page that a user can navigate to
/// from settings or the side menu. Tapping any topic card opens the
/// `LearnWagerProofBottomSheet` at the matching slide via the shared
/// `LearnWagerProofStore`. The RN walkthrough sheet remains the canonical
/// experience; this hub is purely an additional entry point.
///
/// Empty / loaded / error states:
///   - The hub has no async data — it's static walkthrough content — so the
///     "empty" + "error" parity screenshots show degenerate variants (no pro
///     access state showing the upsell banner vs. pro state hiding it).
struct LearnWagerProofView: View {
    @Environment(LearnWagerProofStore.self) private var learnStore

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.lg) {
                intro

                topicCard(
                    topic: .createAgent,
                    accent: Color.appPrimary,
                    systemImage: "brain.head.profile",
                    title: "Create a 24/7 Agent",
                    subtitle: "Build agents that research games and find picks for you all day, every day."
                )

                topicCard(
                    topic: .gameCards,
                    accent: Color.appAccentBlue,
                    systemImage: "rectangle.stack.fill",
                    title: "Game Predictions",
                    subtitle: "Our AI model analyzes thousands of data points so green = strong pick."
                )

                topicCard(
                    topic: .gameDetails,
                    accent: Color.appAccentPurple,
                    systemImage: "chart.bar.fill",
                    title: "Game Details",
                    subtitle: "Tap any game card to reveal full analysis and public betting sentiment."
                )

                topicCard(
                    topic: .wagerBot,
                    accent: Color.appAccentAmber,
                    systemImage: "brain.head.profile",
                    title: "WagerBot Assistant",
                    subtitle: "WagerBot watches for trends, streaks, and situational edges in real time."
                )

                topicCard(
                    topic: .outliers,
                    accent: Color(hex: 0x10B981),
                    systemImage: "chart.line.uptrend.xyaxis",
                    title: "Outliers & Alerts",
                    subtitle: "Spot value where prediction markets disagree with Vegas — or fade overconfident models."
                )

                topicCard(
                    topic: .moreFeatures,
                    accent: Color(hex: 0x5865F2),
                    systemImage: "square.grid.2x2.fill",
                    title: "More Features",
                    subtitle: "Discord, trends, live scores, bet-slip grader, and more."
                )
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.bottom, Spacing.xxl)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle("Learn & Discover")
        .navigationBarTitleDisplayMode(.large)
    }

    // MARK: - Intro

    private var intro: some View {
        Text("Explore the features, signals, and shortcuts that get the most out of WagerProof.")
            .font(.system(size: 15))
            .foregroundStyle(Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, Spacing.xs)
    }

    // MARK: - Topic card

    private func topicCard(
        topic: LearnWagerProofStore.Topic,
        accent: Color,
        systemImage: String,
        title: String,
        subtitle: String
    ) -> some View {
        Button {
            learnStore.openSheet(topic)
        } label: {
            VStack(spacing: 0) {
                // Hero block — matches Honeydew's pattern: tinted block above the
                // title text, illustration centered. We use a large SF Symbol
                // here because Wagerproof has no bundled illustrations yet —
                // brand assets are tracked in #004 (logo).
                ZStack {
                    accent
                    Image(systemName: systemImage)
                        .font(.system(size: 80, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.9))
                        .padding(.vertical, 32)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 180)

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(subtitle)
                        .font(.system(size: 14))
                        .lineSpacing(2)
                        .foregroundStyle(Color.white.opacity(0.85))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.sm)
                .padding(.bottom, Spacing.lg)
                .frame(maxWidth: .infinity)
                .background(accent)
            }
            .frame(maxWidth: .infinity)
            .background(accent)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .shadow(color: .black.opacity(0.15), radius: 14, x: 0, y: 6)
            .contentShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.impact(weight: .medium), trigger: learnStore.activeTopic)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(subtitle)")
    }
}
