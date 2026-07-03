import Foundation
import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Per-page descriptor for the carousel's SHARED chrome — one static table
/// instead of per-page shells. The closures read `@Observable` store state
/// inside the container's body, so CTA enablement updates live as a page
/// mutates the store (chip tap → `canAdvance` flips → pill brightens) with
/// zero extra plumbing.
///
/// Why not preference keys or page-driven `onAppear` mutation: during a
/// slide BOTH the outgoing and incoming pages are on screen, so any
/// page-pushed chrome state would flap. A step-keyed lookup is
/// deterministic.
struct OnboardingPageSpec {
    let ctaTitle: String
    let isCTAEnabled: @MainActor (OnboardingStore) -> Bool
    let onContinue: @MainActor (OnboardingStore) -> Void

    @MainActor
    static func spec(for step: OnboardingStore.Step) -> OnboardingPageSpec {
        switch step {
        case .terms:
            return OnboardingPageSpec(
                ctaTitle: "I agree — continue",
                isCTAEnabled: { $0.canAdvance(from: .terms) },
                onContinue: { store in
                    // Stamps termsAcceptedAt + the 18+ attestation (the
                    // checkbox copy covers both).
                    store.setTermsAccepted()
                    store.advance()
                }
            )
        case .agentValueIntro:
            return OnboardingPageSpec(
                ctaTitle: "Continue",
                isCTAEnabled: { _ in true },
                onContinue: { store in
                    // Step through every reason slide before leaving the
                    // page — the user reads all three.
                    if store.agentPitchSlide < OnboardingStore.agentPitchSlideCount - 1 {
                        withAnimation(.appCarousel) {
                            store.setAgentPitchSlide(store.agentPitchSlide + 1)
                        }
                    } else {
                        store.advance()
                    }
                }
            )
        case .builderIdentity:
            return OnboardingPageSpec(
                ctaTitle: "Create my agent",
                isCTAEnabled: { $0.canAdvance(from: .builderIdentity) },
                onContinue: { $0.advance() }
            )
        default:
            return OnboardingPageSpec(
                ctaTitle: "Continue",
                isCTAEnabled: { $0.canAdvance(from: step) },
                onContinue: { $0.advance() }
            )
        }
    }
}
