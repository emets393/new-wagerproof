package com.wagerproof.app.features.shared

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors

/**
 * Launch-phase splash. Minimal port of iOS `SplashView` (doc 08 §1.2): solid
 * #0F1117 background + "Wager"(white)/"Proof"(brand green) wordmark. The full
 * animated progress bar is deferred to the shell-polish pass.
 */
@Composable
fun SplashScreen(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(AppColors.onboardingBackdropTop),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = buildAnnotatedString {
                withStyle(SpanStyle(color = Color.White, fontWeight = FontWeight.Black)) {
                    append("Wager")
                }
                withStyle(SpanStyle(color = AppColors.appPrimary, fontWeight = FontWeight.Black)) {
                    append("Proof")
                }
            },
            fontSize = 28.sp,
        )
    }
}
