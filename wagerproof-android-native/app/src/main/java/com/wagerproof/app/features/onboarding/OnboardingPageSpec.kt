package com.wagerproof.app.features.onboarding

import com.wagerproof.core.stores.OnboardingStore

/**
 * Port of iOS `OnboardingPageSpec.swift`. Per-step descriptor for the carousel's
 * SHARED chrome — one static table instead of per-page shells. [isCTAEnabled]
 * and [onContinue] read live [OnboardingStore] state, so CTA enablement updates
 * as a page mutates the store (chip tap → `canAdvance` flips → pill brightens)
 * with zero extra plumbing.
 *
 * A step-keyed lookup is deterministic: during a slide BOTH the outgoing and
 * incoming pages are on screen, so any page-pushed chrome state would flap.
 */
class OnboardingPageSpec(
    val ctaTitle: String,
    val isCTAEnabled: (OnboardingStore) -> Boolean,
    val onContinue: (OnboardingStore) -> Unit,
) {
    companion object {
        fun specFor(step: OnboardingStore.Step): OnboardingPageSpec = when (step) {
            OnboardingStore.Step.TERMS -> OnboardingPageSpec(
                ctaTitle = "I agree — continue",
                isCTAEnabled = { it.canAdvance(OnboardingStore.Step.TERMS) },
                onContinue = { store ->
                    // Stamps termsAcceptedAt + the 18+ attestation (the checkbox
                    // copy covers both), then advances.
                    store.setTermsAccepted()
                    store.advance()
                },
            )

            OnboardingStore.Step.AGENT_VALUE_INTRO -> OnboardingPageSpec(
                ctaTitle = "Continue",
                isCTAEnabled = { true },
                onContinue = { store ->
                    // Step through every reason slide before leaving the page —
                    // the user reads all three.
                    if (store.agentPitchSlide < OnboardingStore.agentPitchSlideCount - 1) {
                        store.setAgentPitchSlide(store.agentPitchSlide + 1)
                    } else {
                        store.advance()
                    }
                },
            )

            OnboardingStore.Step.BUILDER_IDENTITY -> OnboardingPageSpec(
                ctaTitle = "Create my agent",
                isCTAEnabled = { it.canAdvance(OnboardingStore.Step.BUILDER_IDENTITY) },
                onContinue = { it.advance() },
            )

            else -> OnboardingPageSpec(
                ctaTitle = "Continue",
                isCTAEnabled = { it.canAdvance(step) },
                onContinue = { it.advance() },
            )
        }
    }
}
