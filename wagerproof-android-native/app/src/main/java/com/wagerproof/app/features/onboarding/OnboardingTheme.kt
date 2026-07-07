package com.wagerproof.app.features.onboarding

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import com.wagerproof.app.features.agents.colorFromHexString
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.stores.OnboardingStore

/**
 * Port of iOS `OnboardingTheme.swift`. Maps onboarding selections to the accent
 * color that tints the reactive pixelwave background, the CTA pill, and per-page
 * highlights. The default is brand green so the entry state stays visually
 * continuous with the login screen's pixelwave (same tint).
 */
object OnboardingTheme {

    /** Bettor-type accent — null/casual green, serious blue, professional purple. */
    fun accent(type: OnboardingStore.BettorType?): Color = when (type) {
        null, OnboardingStore.BettorType.Casual -> AppColors.appPrimary
        OnboardingStore.BettorType.Serious -> AppColors.appAccentBlue
        OnboardingStore.BettorType.Professional -> AppColors.appAccentPurple
    }

    /** Archetype rows carry their own hex accent (`PresetArchetypeRow.color`). */
    fun archetypeAccent(hex: String?): Color? = hex?.let { colorFromHexString(it) }

    /**
     * Slightly white-lifted accent used while the generation cinematic runs —
     * reads as "energized" without touching the glyph field's grid params.
     * iOS `accent.mix(with: .white, by: 0.15)`.
     */
    fun generationBoost(accent: Color): Color = lerp(accent, Color.White, 0.15f)
}
