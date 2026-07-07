package com.wagerproof.app.features.learn.slides

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing

/**
 * Port of iOS `Slide1_Create247Agent.swift`.
 *
 * FIDELITY-WAIVER #063 — iOS/RN render a Lottie robot; the port draws a static
 * SF-symbol robot with a gentle scale pulse (established Lottie-replacement waiver).
 */
@Composable
fun Slide1Create247Agent(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "robotPulse")
    val pulse by transition.animateFloat(
        initialValue = 0.95f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(tween(1600), RepeatMode.Reverse),
        label = "pulse",
    )

    Column(modifier, verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
        Box(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 150.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(AppColors.appSurfaceElevated),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = AppIcon.fromSystemName("brain.head.profile")!!.imageVector,
                contentDescription = null,
                tint = AppColors.appPrimary,
                modifier = Modifier.size(72.dp).scale(pulse),
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            bullets.forEach { bulletCard(it) }
        }
    }
}

private data class Bullet(val icon: ImageVector, val title: String, val description: String)

private val bullets: List<Bullet> = listOf(
    Bullet(
        AppIcon.fromSystemName("brain.head.profile")!!.imageVector,
        "Build multiple agents",
        "Create as many agents as you want, each with a different betting strategy.",
    ),
    Bullet(
        AppIcon.fromSystemName("clock.fill")!!.imageVector,
        "24/7 research",
        "Your agents continuously research games and surface picks around the clock.",
    ),
    Bullet(
        AppIcon.fromSystemName("trophy.fill")!!.imageVector,
        "Global leaderboard",
        "View the world's best agents, their records, and their latest picks.",
    ),
)

@Composable
private fun bulletCard(bullet: Bullet) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(AppColors.appSurfaceElevated)
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(26.dp)
                    .clip(CircleShape)
                    .background(AppColors.appPrimary.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = bullet.icon,
                    contentDescription = null,
                    tint = AppColors.appPrimary,
                    modifier = Modifier.size(14.dp),
                )
            }
            Text(bullet.title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
        }
        Text(bullet.description, fontSize = 11.sp, color = AppColors.appTextSecondary, lineHeight = 15.sp)
    }
}
