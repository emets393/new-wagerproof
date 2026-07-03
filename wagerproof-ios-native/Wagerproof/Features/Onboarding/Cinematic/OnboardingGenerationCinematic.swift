// OnboardingGenerationCinematic.swift
//
// Step 14: the canned generation theater, assembled from the SAME pieces the
// in-app pick-generation card uses (WorkingDeskAvatar, GlyphMatrix3x3,
// GenerationLoadingBar, ToolActivityStack) so the agent the user watches
// being born is visually the one they'll watch research in the app.
//
// TRANSPARENT by design — no opaque base, no backdrop Lottie. The root
// pixelwave (energized by the genesis model's ripple bursts + tint boost)
// IS the scene; only foreground content renders here.

import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

struct OnboardingGenerationCinematic: View {
    /// Created by OnboardingView on entry to `.generation`. Optional only
    /// for exotic paths (harness landing directly here) — renders a static
    /// frame if nil.
    let model: OnboardingGenesisModel?
    var accent: Color = .appPrimary

    @Environment(OnboardingStore.self) private var store

    private var spriteIndex: Int {
        store.agentDraft.spriteIndex ?? AgentSpriteIndex.forSeed(store.agentDraft.name)
    }

    private var agentName: String {
        let name = store.agentDraft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? "Your agent" : name
    }

    var body: some View {
        VStack(spacing: 0) {
            // Console lines — newest on top, older fade (same recipe as the
            // v1 generation screen and the in-app card).
            VStack(spacing: 8) {
                // id by offset (row slot), not content — the script cycles
                // on slow networks and repeated lines would collide as IDs.
                ForEach(Array((model?.statusLines ?? []).enumerated()), id: \.offset) { i, line in
                    Text(line)
                        .font(.system(size: 15, weight: .bold, design: .monospaced))
                        .foregroundStyle(.white)
                        .opacity(opacityFor(rowIndex: i))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .transition(.asymmetric(
                            insertion: .move(edge: .top).combined(with: .opacity),
                            removal: .opacity
                        ))
                }
            }
            .frame(height: 110, alignment: .top)
            .padding(.horizontal, 28)
            .padding(.top, 70)

            Spacer()

            // The agent at work.
            WorkingDeskAvatar(spriteIndex: spriteIndex, accent: accent, charHeight: 130)

            HStack(spacing: 10) {
                GlyphMatrix3x3(accent: accent, cycleSeconds: 0.7)
                Text("Building \(agentName)...")
                    .font(.system(size: 16, weight: .heavy))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .padding(.top, 22)

            GenerationLoadingBar(fraction: model?.progressFraction ?? 0, accent: accent)
                .frame(width: 220)
                .padding(.top, 14)

            Spacer()

            // Skeleton tickets deal in as the "research" lands — the same
            // fanning deck the live generation card uses.
            ToolActivityStack(count: model?.toolCallCount ?? 0, accent: accent)
                .padding(.horizontal, 24)
                .padding(.bottom, 70)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Finale: the theater dissolves and hands the screen to the pixel
        // grid's ripple wave before the reveal cross-fades in.
        .opacity(model?.isFinale == true ? 0 : 1)
        .animation(.easeOut(duration: 0.45), value: model?.isFinale ?? false)
        .sensoryFeedback(.impact(weight: .light), trigger: model?.hapticTick ?? 0)
    }

    private func opacityFor(rowIndex: Int) -> Double {
        // Newest (index 0) brightest; older rows fade.
        max(0.3, 1.0 - Double(rowIndex) * 0.24)
    }
}
