// OnboardingRevealView.swift
//
// Step 15: the payoff. The generation theater fades out and the PIXEL GRID
// carries the transition (ripple finale from the genesis model) — no Lottie
// flood. Content then fades in over the still-rippling field: confetti, the
// user's REAL agent rendered with the same `AgentRowCard` the Agents tab
// uses, and the teaser tickets — actual recent picks with teams visible and
// every detail blurred behind a lock. The "See everything" CTA completes
// onboarding; RootView then presents the paywall over the main app, so the
// blurred tickets are the setup and the paywall is the ask.
//
// Renders from `model.createdAgent` when creation succeeded, degrading to a
// display-only agent built from the onboarding draft otherwise (including
// harness jumps straight here).

import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores
#if canImport(UIKit)
import UIKit
#endif

struct OnboardingRevealView: View {
    let model: OnboardingGenesisModel?
    var accent: Color = .appPrimary

    @Environment(OnboardingStore.self) private var store
    @Environment(\.glyphRippleEmitter) private var rippleEmitter
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var elementsOpacity: Double = 0
    @State private var revealComplete = false
    @State private var showConfetti = false
    @State private var shownTickets = 0

    // MARK: Display values (real agent → draft fallback)

    private var displayAgent: Agent {
        if let created = model?.createdAgent { return created }
        // Draft fallback — display-only shape for the row card when creation
        // failed or the harness landed here directly.
        let draft = store.agentDraft
        let name = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        return Agent(
            id: "onboarding-draft",
            userId: "onboarding-draft",
            name: name.isEmpty ? "Your Agent" : name,
            avatarEmoji: draft.avatarEmoji,
            avatarColor: draft.avatarColor,
            preferredSports: draft.preferredSports.compactMap { AgentSport(rawValue: $0.rawValue) },
            archetype: draft.archetype.flatMap { AgentArchetype(rawValue: $0) },
            personalityParams: draft.personalityParams,
            customInsights: draft.customInsights,
            createdAt: "",
            updatedAt: "",
            autoGenerate: draft.autoGenerate,
            spriteIndexOverride: draft.spriteIndex
        )
    }

    private var agentName: String { displayAgent.name }

    private var tickets: [AgentPick] {
        if let picks = model?.teaserPicks, !picks.isEmpty { return picks }
        return OnboardingGenesisModel.fixturePicks(sports: [])
    }

    var body: some View {
        ZStack {
            ScrollView {
                VStack(spacing: 18) {
                    Text("\(agentName) is live!")
                        .font(.system(size: 32, weight: .black))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.6)
                        .tracking(0.3)
                        .padding(.top, 60)
                        .padding(.horizontal, 24)

                    Text("First research run complete — here's a taste.")
                        .font(.system(size: 15))
                        .foregroundStyle(Color.white.opacity(0.85))

                    // The user's agent, exactly as it'll appear on the
                    // Agents tab — same component, display-only here.
                    AgentRowCard(
                        agent: AgentWithPerformance(agent: displayAgent, performance: nil),
                        onTap: {}
                    )
                    .allowsHitTesting(false)
                    .padding(.horizontal, 20)

                    // Teaser tickets — details blurred, teams visible.
                    VStack(spacing: 14) {
                        ForEach(Array(tickets.enumerated()), id: \.element.id) { index, pick in
                            AgentPickTicket(pick: pick, accent: accent, teaserBlur: true)
                                .rotationEffect(.degrees(index.isMultiple(of: 2) ? -1.2 : 1.4))
                                .opacity(shownTickets > index ? 1 : 0)
                                .offset(y: shownTickets > index ? 0 : 26)
                        }
                    }
                    .padding(.horizontal, 28)
                    .padding(.top, 6)

                    Spacer(minLength: 120)
                }
            }
            .scrollBounceBehavior(.basedOnSize)
            .opacity(elementsOpacity)
            .sensoryFeedback(.success, trigger: revealComplete)

            // CTA pinned above the home indicator, over the scroll.
            VStack {
                Spacer()
                ContinueCTAButton(
                    label: "See everything",
                    trailingGlyph: "→",
                    tint: .white,
                    foreground: .black,
                    surfaceOpacity: 0.92
                ) {
                    finish()
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 24)
            }
            .opacity(elementsOpacity)

            // One-shot confetti on top once the reveal lands.
            if showConfetti {
                LottieView(name: "confetti", loopMode: .playOnce)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                    .transition(.opacity)
            }
        }
        .task { await runRevealTimeline() }
    }

    // MARK: - Timeline

    /// The transition INTO this screen is the pixel grid itself: the genesis
    /// finale fades the theater and fires a ripple wave; we land with a few
    /// more ripples around the content as it fades in, then confetti + the
    /// tickets deal.
    private func runRevealTimeline() async {
        if reduceMotion {
            elementsOpacity = 1
            revealComplete = true
            shownTickets = tickets.count
            return
        }

        emitEntranceRipples()
        withAnimation(.easeInOut(duration: 0.65)) { elementsOpacity = 1 }
        try? await Task.sleep(nanoseconds: 700_000_000)
        revealComplete = true
        withAnimation(.easeInOut(duration: 0.3)) { showConfetti = true }
        for i in 1...max(1, tickets.count) {
            try? await Task.sleep(nanoseconds: 260_000_000)
            withAnimation(.appBouncy) { shownTickets = i }
        }
    }

    /// A welcome burst on the shared field — center-out, echoing the finale
    /// wave the generation screen just played.
    private func emitEntranceRipples() {
        #if canImport(UIKit)
        guard let emitter = rippleEmitter else { return }
        let bounds = UIScreen.main.bounds
        let points = [
            CGPoint(x: bounds.midX, y: bounds.height * 0.30),
            CGPoint(x: bounds.width * 0.22, y: bounds.height * 0.55),
            CGPoint(x: bounds.width * 0.78, y: bounds.height * 0.62)
        ]
        Task {
            for p in points {
                emitter.emit(at: p)
                try? await Task.sleep(nanoseconds: 200_000_000)
            }
        }
        #endif
    }

    private func finish() {
        // On to the time-value summary + fist bump (step 23). THAT step
        // marks onboarding complete; RootView then flips to `.ready` and
        // presents `PostOnboardingPaywall`. The blurred tickets here and
        // the summary's reclaim figure both set up that ask.
        store.advance()
    }
}
