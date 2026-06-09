// AgentBornView.swift
//
// Step 21: agent reveal + "Let's go!" CTA. Port of `StepAgentBorn.tsx`.
// RN layers four Lotties:
//   - `WaveLinesAnimation.json` — full-screen ambient background
//   - `FullscreenGreen.json` — one-shot green wash that reveals the screen
//   - `pulselottie.json` — small ~32pt pulse next to AUTOPILOT ON
//   - `confetti.json` — one-shot celebration after reveal completes
//
// Native polish vs. the first port:
//   - The opening FullscreenGreen lottie now fills edge-to-edge (no fixed
//     frame) so the green wash actually covers the whole screen during the
//     reveal cinematic.
//   - The agent reveal card uses `.liquidGlassBackground(...)` with a soft
//     brand-green tint so it reads as Liquid Glass over the celebration
//     scene rather than a static ultraThinMaterial chip.
//   - The "Let's go!" CTA mirrors the onboarding `ContinueCTAButton` recipe
//     exactly — same Liquid Glass capsule + specular highlight + glass rim
//     overlays so the user perceives a single, consistent CTA affordance.

import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

struct AgentBornView: View {
    @Environment(OnboardingStore.self) private var store
    @Environment(RootRouter.self) private var router

    @State private var elementsOpacity: Double = 0
    @State private var revealComplete = false
    @State private var pulseReady = false
    @State private var showConfetti = false
    // Bumped each time we land on the screen so the reveal lottie restarts
    // (matches RN's `revealRunId` state).
    @State private var revealRunId = 0

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // Ambient WaveLines lottie — sits behind everything and loops.
            LottieView(name: "WaveLinesAnimation")
                .ignoresSafeArea()
                .allowsHitTesting(false)

            // Background teal wash on top of the wave lines.
            LinearGradient(
                stops: [
                    .init(color: .clear, location: 0.3),
                    .init(color: Color.appPrimary.opacity(0.14), location: 1)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)

            VStack(spacing: 28) {
                Spacer()

                Text("Agent is Born!")
                    .font(.system(size: 34, weight: .black))
                    .foregroundStyle(.white)
                    .tracking(0.3)
                Text("Your AI bettor is live and ready to cook.")
                    .font(.system(size: 15))
                    .foregroundStyle(Color.white.opacity(0.85))

                agentCard
                    .padding(.horizontal, 24)

                Spacer()

                letsGoCTA
                    .padding(.horizontal, 24)
                    .padding(.bottom, 40)
            }
            .opacity(elementsOpacity)
            .sensoryFeedback(.success, trigger: revealComplete)

            // One-shot confetti burst on top of content once the reveal
            // completes. Matches RN's `confetti.json` overlay.
            if showConfetti {
                LottieView(name: "confetti", loopMode: .playOnce)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                    .transition(.opacity)
            }

            // Full-screen green flood reveal — sits ON TOP and fades out
            // when the lottie finishes. Matches RN's `FullscreenGreen.json`.
            // Use `frame(maxWidth: .infinity, maxHeight: .infinity)` so the
            // animation stretches edge-to-edge instead of being aspect-fit
            // into a centered square (which left visible black bars on the
            // sides during the reveal).
            if !revealComplete {
                LottieView(name: "FullscreenGreen", loopMode: .playOnce)
                    .id(revealRunId)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                    .transition(.opacity)
            }
        }
        .task {
            // RN reveal timer: content opacity ramps in at 1s, reveal lottie
            // dismisses at 3s. We mirror those exact timings.
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            withAnimation(.easeInOut(duration: 0.65)) {
                elementsOpacity = 1
            }
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            withAnimation(.easeInOut(duration: 0.5)) {
                revealComplete = true
            }
            // Confetti and pulse mount just after the green flood clears so
            // we don't pay decode cost behind the lottie. Matches RN's 160ms
            // delay before showing the autopilot pulse.
            try? await Task.sleep(nanoseconds: 160_000_000)
            pulseReady = true
            showConfetti = true
        }
    }

    private var agentCard: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                // Sprite avatar (no id yet during onboarding — seed from name)
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(LinearGradient(
                            colors: AgentColorPalette.avatarGradient(for: store.agentDraft.avatarColor),
                            startPoint: .topLeading, endPoint: .bottomTrailing))
                    PixelSpriteAvatar(spriteIndex: AgentSpriteIndex.forSeed(store.agentDraft.name))
                        .padding(2)
                }
                .frame(width: 40, height: 40)

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 8) {
                        Text(store.agentDraft.name.isEmpty ? "Your Agent" : store.agentDraft.name)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        ForEach(store.agentDraft.preferredSports.prefix(2), id: \.self) { sport in
                            Image(systemName: sport.sfSymbol)
                                .font(.system(size: 12))
                                .frame(width: 22, height: 22)
                                .background(
                                    RoundedRectangle(cornerRadius: 6)
                                        .fill(Color.white.opacity(0.08))
                                )
                                .foregroundStyle(Color.white.opacity(0.7))
                        }
                    }
                    HStack(spacing: 10) {
                        Text("0-0").font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.6))
                        Text("+0.00u").font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.appPrimary)
                        Text("-").font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.6))
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 0) {
                    Toggle("", isOn: .constant(true))
                        .labelsHidden()
                        .tint(Color.appPrimary)
                        .scaleEffect(0.8)
                        .disabled(true)
                    HStack(spacing: 1) {
                        Text("AUTOPILOT ON")
                            .font(.system(size: 7, weight: .bold))
                            .tracking(0.3)
                            .foregroundStyle(Color.appPrimary)
                        // Matches RN's 32×32 autopilotLottie next to the label.
                        if pulseReady {
                            LottieView(name: "pulselottie")
                                .frame(width: 32, height: 32)
                        }
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 14)
            .padding(.bottom, 10)

            Divider().background(Color.white.opacity(0.06))

            HStack(spacing: 6) {
                Image(systemName: "clock")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.white.opacity(0.6))
                Text("Researching...")
                    .font(.system(size: 13))
                    .italic()
                    .foregroundStyle(Color.white.opacity(0.6))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
        }
        // Liquid Glass card surface — tinted with a soft brand green so
        // the celebration scene refracts through the container instead of
        // being painted over by a static ultraThinMaterial chip.
        .liquidGlassBackground(
            in: RoundedRectangle(cornerRadius: 24, style: .continuous),
            tint: Color.appPrimary.opacity(0.18)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [Color.white.opacity(0.32), Color.white.opacity(0.06)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
    }

    // MARK: - "Let's go!" CTA
    //
    // Mirrors the ContinueCTAButton recipe (lines 64-95 of
    // WagerproofDesign/Components/ContinueCTAButton.swift) so the user
    // perceives the same affordance as the onboarding Continue pill.
    private var letsGoCTA: some View {
        Button(action: finish) {
            HStack(spacing: 8) {
                Spacer(minLength: 0)
                Text("Let's go!")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)
                Text("🎉")
                    .font(.system(size: 22))
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity)
            .frame(height: 60)
            .contentShape(Capsule())
            .liquidGlassBackground(
                in: Capsule(),
                tint: Color.appPrimary.opacity(0.65),
                interactive: true
            )
            .overlay(
                // Specular highlight — white gradient fading top → mid.
                Capsule()
                    .fill(LinearGradient(
                        colors: [Color.white.opacity(0.22), Color.white.opacity(0.0)],
                        startPoint: .top,
                        endPoint: .center
                    ))
                    .allowsHitTesting(false)
            )
            .overlay(
                // Glass rim — stronger at top-leading, fades to
                // bottom-trailing. Identical to ContinueCTAButton so the
                // two pills read as the same component.
                Capsule()
                    .strokeBorder(
                        LinearGradient(
                            colors: [Color.white.opacity(0.45), Color.white.opacity(0.06)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
                    .allowsHitTesting(false)
            )
            .shadow(color: Color.appPrimary.opacity(0.30), radius: 8, x: 0, y: 4)
            .shadow(color: Color.black.opacity(0.08), radius: 2, x: 0, y: 1)
        }
        .buttonStyle(.plain)
    }

    private func finish() {
        // RN behaviour: completeOnboarding is local-instant; background sync
        // never blocks the user. We've already called markComplete() at the
        // tail of the agent builder, but call again here defensively in case
        // the user reaches step 21 via debug nav.
        store.markComplete()
        // The root router watches `OnboardingStore.isComplete` via
        // `WagerproofApp.onChange` and flips phase to `.ready`. No explicit
        // navigation call needed here.
        _ = router   // keep environment dep alive for future deep-link use
    }
}
