package com.wagerproof.app.features.onboarding

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.shared.TodoScreen

/**
 * Onboarding wizard. iOS `Features/Onboarding/OnboardingView`. Currently
 * hard-bypassed (RootRouter.temporarilyDisableOnboarding = true, doc 08 §7.1),
 * so this only renders via Secret Settings "Reset Onboarding". Placeholder.
 */
@Composable
fun OnboardingScreen(modifier: Modifier = Modifier) {
    TodoScreen(screenName = "Onboarding", detail = "Bypassed by default", modifier = modifier)
}
