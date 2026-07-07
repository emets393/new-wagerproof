package com.wagerproof.app.features.learn.slides

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import kotlinx.coroutines.delay

/**
 * Port of iOS `Slide3_WagerBot.swift`. Dynamic-Island-style bubble with an
 * animated countdown ring + typewriter suggestion, followed by 4 feature rows.
 */
private const val SUGGESTION =
    "The Lakers have covered the spread in 8 of their last 10 home games. Consider Lakers -4.5 tonight!"

@Composable
fun Slide3WagerBot(modifier: Modifier = Modifier) {
    // Ring fills 0 -> 1 over 8s (visual cue only). Kick off on first composition.
    var started by remember { mutableIntStateOf(0) }
    val ringProgress by animateFloatAsState(
        targetValue = if (started > 0) 1f else 0f,
        animationSpec = tween(8000, easing = LinearEasing),
        label = "ring",
    )
    var typedCount by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        started = 1
        // Typewriter ~25ms/char, matching RN speed=25.
        while (typedCount < SUGGESTION.length) {
            delay(25)
            typedCount += 1
        }
    }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(Spacing.lg)) {
        bubble(ringProgress, typedCount)
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            features.forEach { featureRow(it) }
        }
    }
}

private data class WBFeature(val icon: ImageVector, val label: String, val desc: String)

private val features: List<WBFeature> = listOf(
    WBFeature(AppIcon.fromSystemName("brain.head.profile")!!.imageVector, "Auto-Generated Insights", "WagerBot scans games automatically"),
    WBFeature(AppIcon.fromSystemName("hand.tap.fill")!!.imageVector, "Tap to View Game", "Jump to full game details"),
    WBFeature(AppIcon.fromSystemName("timer")!!.imageVector, "Auto-Dismiss Timer", "Green ring shows countdown"),
    WBFeature(AppIcon.fromSystemName("arrow.down")!!.imageVector, "Pull to Detach", "Floating assistant mode"),
)

@Composable
private fun bubble(ringProgress: Float, typedCount: Int) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Color(0xFF1A1A1A)),
    ) {
        Row(
            Modifier.padding(horizontal = 14.dp, vertical = Spacing.md),
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Countdown ring + robot glyph.
            Box(Modifier.size(44.dp), contentAlignment = Alignment.Center) {
                val ringColor = AppColors.appPrimary
                Canvas(Modifier.size(44.dp)) {
                    val stroke = 3.dp.toPx()
                    drawArc(
                        color = Color.White.copy(alpha = 0.2f),
                        startAngle = 0f,
                        sweepAngle = 360f,
                        useCenter = false,
                        topLeft = androidx.compose.ui.geometry.Offset(stroke / 2, stroke / 2),
                        size = androidx.compose.ui.geometry.Size(size.width - stroke, size.height - stroke),
                        style = Stroke(width = stroke),
                    )
                    drawArc(
                        color = ringColor,
                        startAngle = -90f,
                        sweepAngle = 360f * ringProgress,
                        useCenter = false,
                        topLeft = androidx.compose.ui.geometry.Offset(stroke / 2, stroke / 2),
                        size = androidx.compose.ui.geometry.Size(size.width - stroke, size.height - stroke),
                        style = Stroke(width = stroke, cap = StrokeCap.Round),
                    )
                }
                Icon(
                    imageVector = AppIcon.fromSystemName("brain.head.profile")!!.imageVector,
                    contentDescription = null,
                    tint = AppColors.appPrimary,
                    modifier = Modifier.size(18.dp),
                )
            }

            // Typewriter text + caret.
            val prefix = SUGGESTION.take(typedCount)
            val caret = if (typedCount < SUGGESTION.length) "|" else ""
            Text(
                prefix + caret,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = Color.White,
                maxLines = 4,
                lineHeight = 16.sp,
                modifier = Modifier.weight(1f),
            )
        }
        // Bottom drag handle.
        Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 4.dp)) {
            Box(Modifier.width(32.dp).height(4.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.3f)))
        }
    }
}

@Composable
private fun featureRow(f: WBFeature) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(AppColors.appSurfaceElevated)
            .padding(10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(36.dp).clip(CircleShape).background(AppColors.appPrimary.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(imageVector = f.icon, contentDescription = null, tint = AppColors.appPrimary, modifier = Modifier.size(16.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(f.label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary)
            Text(f.desc, fontSize = 11.sp, color = AppColors.appTextSecondary)
        }
    }
}
