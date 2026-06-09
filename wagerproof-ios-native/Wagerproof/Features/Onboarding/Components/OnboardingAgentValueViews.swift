// OnboardingAgentValueViews.swift
//
// Steps 11–14: four agent value-prop screens. Ports of:
//   - `AgentValue1_247.tsx`           — RN uses PixelOffice (not Lottie). Native keeps SF Symbol.
//   - `AgentValue2_VirtualAssistant.tsx` — RN uses `ChattingRobot.json` @ 190pt.
//   - `AgentValue3_MultipleStrategies.tsx` — RN uses `RobotAnalyzing.json` @ 190pt.
//   - `AgentValue4_Leaderboard.tsx`   — RN uses `Leaderboard.json` @ 190pt.
//
// The shared `AgentValueScaffold` accepts an optional Lottie asset name; when
// provided it replaces the SF Symbol header so the screen matches RN.
// PixelOffice (Value 1) is tracked under #001 and isn't a B02 concern.
//
// Chrome (back chevron / progress bar / Liquid Glass CTA) is owned by
// `OnboardingPageShell` — the scaffold reads the store directly so each
// sub-view stays a one-line construction site.

import SwiftUI
import WagerproofDesign
import WagerproofStores

// MARK: - Step 11: 24/7

struct OnboardingAgentValue247View: View {
    var body: some View {
        AgentValueScaffold(
            icon: "clock.fill",
            iconColor: Color.appPrimary,
            title: "Now lets create an agent that works for you 24/7",
            subtitle: "Your AI picks expert never sleeps. It scans every game, every line, and every edge — so you don't have to.",
            bullets: []
        )
    }
}

// MARK: - Step 12: Virtual assistant

struct OnboardingAgentValueAssistantView: View {
    var body: some View {
        AgentValueScaffold(
            icon: "person.crop.circle.fill.badge.checkmark",
            iconColor: Color.appPrimary,
            lottieName: "ChattingRobot",
            title: "Like having a full-time employee",
            subtitle: "Your agent learns your style, your preferences, and your risk tolerance — then researches the best picks for you.",
            bullets: [
                .init(icon: "gearshape.fill", text: "Tuned to your betting personality"),
                .init(icon: "chart.line.uptrend.xyaxis", text: "Powered by real model data and odds")
            ]
        )
    }
}

// MARK: - Step 13: Multiple strategies

struct OnboardingAgentValueStrategiesView: View {
    var body: some View {
        AgentValueScaffold(
            icon: "person.3.fill",
            iconColor: Color.appPrimary,
            lottieName: "RobotAnalyzing",
            title: "Create multiple agents with different strategies",
            subtitle: nil,
            bullets: [
                .init(icon: "flag.checkered", text: "Test different approaches simultaneously"),
                .init(icon: "arrow.left.arrow.right", text: "Compare strategies head-to-head"),
                .init(icon: "chart.bar.doc.horizontal", text: "Track performance for each agent")
            ]
        )
    }
}

// MARK: - Step 14: Leaderboard

struct OnboardingAgentValueLeaderboardView: View {
    var body: some View {
        AgentValueScaffold(
            icon: "trophy.fill",
            iconColor: Color.appPrimary,
            lottieName: "Leaderboard",
            title: "See the best agents from around the world",
            subtitle: "View a global leaderboard of top-performing agents. Copy their strategies, follow their picks, and learn from the best.",
            bullets: []
        )
    }
}

// MARK: - Shared scaffold

private struct AgentValueScaffold: View {
    @Environment(OnboardingStore.self) private var store

    let icon: String
    let iconColor: Color
    var lottieName: String? = nil
    let title: String
    let subtitle: String?
    let bullets: [Bullet]

    struct Bullet {
        let icon: String
        let text: String
    }

    // Deferred mount mirrors RN's `InteractionManager.runAfterInteractions`
    // pattern from the value screens: text/icons paint first, Lottie composes
    // after the screen transition settles.
    @State private var lottieReady = false

    var body: some View {
        OnboardingPageShell(
            progress: Double(store.currentStep.rawValue) / Double(OnboardingStep.allCases.count),
            continueTitle: "Continue",
            isCTAEnabled: !store.isTransitioning,
            isCTALoading: store.isTransitioning,
            canGoBack: store.currentStep.rawValue > 1,
            background: { Color.clear },
            content: {
                ScrollView {
                    VStack(spacing: 16) {
                        if let lottieName {
                            // RN renders the value-prop Lotties at a 190pt square.
                            ZStack {
                                if lottieReady {
                                    LottieView(name: lottieName)
                                }
                            }
                            .frame(width: 190, height: 190)
                            .padding(.top, 12)
                            .padding(.bottom, 16)
                        } else {
                            Image(systemName: icon)
                                .font(.system(size: 100))
                                .foregroundStyle(iconColor)
                                .padding(.top, 12)
                                .padding(.bottom, 16)
                                .symbolEffect(.pulse, options: .repeating)
                        }

                        Text(title)
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                            .lineSpacing(4)
                            .padding(.horizontal, 24)

                        if let subtitle {
                            Text(subtitle)
                                .font(.system(size: 16))
                                .foregroundStyle(Color.white.opacity(0.7))
                                .multilineTextAlignment(.center)
                                .lineSpacing(4)
                                .padding(.horizontal, 24)
                                .padding(.top, 4)
                        }

                        if !bullets.isEmpty {
                            VStack(spacing: 16) {
                                ForEach(bullets.indices, id: \.self) { idx in
                                    let b = bullets[idx]
                                    HStack(alignment: .top, spacing: 12) {
                                        Image(systemName: b.icon)
                                            .font(.system(size: 22))
                                            .foregroundStyle(iconColor)
                                        Text(b.text)
                                            .font(.system(size: 15))
                                            .foregroundStyle(Color.white.opacity(0.85))
                                            .lineSpacing(4)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                    }
                                }
                            }
                            .padding(.horizontal, 32)
                            .padding(.top, 24)
                        }
                        // Shell owns bottom-edge spacing; no Spacer needed.
                    }
                }
            },
            onContinue: { store.advance() },
            onBack: { store.back() }
        )
        .task {
            // Defer ~200ms so the screen transition finishes before we hand
            // the runloop to Lottie decoding. No-op for icon-only screens.
            guard lottieName != nil else { return }
            try? await Task.sleep(nanoseconds: 200_000_000)
            lottieReady = true
        }
    }
}
