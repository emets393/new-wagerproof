package com.wagerproof.app.features.onboarding.cinematic

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.onboarding.OnboardingCarouselCtaForegroundColor
import com.wagerproof.app.features.onboarding.OnboardingCarouselCtaSurfaceColor
import com.wagerproof.app.features.onboarding.onboardingPressable

/**
 * The bright payoff CTA shared by the two closing onboarding cinematics.
 *
 * This is deliberately an almost-solid surface rather than Liquid Glass.
 * [com.wagerproof.core.design.components.liquidGlassBackground] treats its
 * tint as an 18% wash over the dark fallback material, so passing white there
 * does not produce the white CTA used by the iOS flow.
 */
@Composable
internal fun CinematicCtaButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    trailingGlyph: String? = null,
) {
    Box(
        modifier = modifier
            .height(60.dp)
            .clip(CircleShape)
            .background(OnboardingCarouselCtaSurfaceColor)
            .onboardingPressable(onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = label,
                color = OnboardingCarouselCtaForegroundColor,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
            if (trailingGlyph != null) {
                Text(
                    text = trailingGlyph,
                    color = OnboardingCarouselCtaForegroundColor,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}
