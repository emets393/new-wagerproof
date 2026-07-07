package com.wagerproof.app.features.onboarding

import com.wagerproof.core.stores.OnboardingStore

/**
 * View-side alias for `OnboardingStore.Step` — port of iOS `OnboardingStep.swift`.
 * Lets page composables reference steps without repeating the store qualifier.
 * The carousel mapping helpers (`carouselIndex`, `carouselPageCount`,
 * `progress`, `isCinematic`) live on the enum itself in `OnboardingStore`.
 */
typealias OnboardingStep = OnboardingStore.Step
