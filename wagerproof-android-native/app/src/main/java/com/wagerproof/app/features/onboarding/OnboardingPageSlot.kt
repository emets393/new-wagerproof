package com.wagerproof.app.features.onboarding

import androidx.compose.runtime.staticCompositionLocalOf

/**
 * Port of iOS `OnboardingPageSlot.swift`'s `\.onboardingPageIsActive`
 * environment entry. True while a page is the active carousel page. With the
 * button-driven slide pager only the active page is mounted, so this defaults
 * to true — pages gate their entrance choreography (`pageEntrance(index:)`) and
 * one-shot animations on it, and the trigger fires at mount, which is exactly
 * when the page starts sliding in.
 */
val LocalOnboardingPageIsActive = staticCompositionLocalOf { true }
