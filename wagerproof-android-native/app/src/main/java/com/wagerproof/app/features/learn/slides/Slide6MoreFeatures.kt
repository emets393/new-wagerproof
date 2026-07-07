package com.wagerproof.app.features.learn.slides

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.Spacing

/**
 * Port of iOS `Slide6_MoreFeatures.swift`. 2x2 grid of gradient feature cards
 * (Discord blurple / purple / emerald / amber). Hardcoded marketing content.
 */
@Composable
fun Slide6MoreFeatures(modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
            card(features[0], Modifier.weight(1f))
            card(features[1], Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
            card(features[2], Modifier.weight(1f))
            card(features[3], Modifier.weight(1f))
        }
    }
}

private data class MoreFeature(
    val icon: ImageVector,
    val title: String,
    val description: String,
    val colors: List<Color>,
)

private val features: List<MoreFeature> = listOf(
    MoreFeature(
        AppIcon.fromSystemName("bubble.left.and.bubble.right.fill")!!.imageVector,
        "Discord Community",
        "Join 500+ bettors for real-time alerts",
        listOf(Color(0xFF5865F2), Color(0xFF7289DA)),
    ),
    MoreFeature(
        AppIcon.fromSystemName("chart.line.uptrend.xyaxis")!!.imageVector,
        "Betting Trends",
        "NBA situational trends, ATS records",
        listOf(Color(0xFF8B5CF6), Color(0xFFA78BFA)),
    ),
    MoreFeature(
        AppIcon.fromSystemName("sportscourt.fill")!!.imageVector,
        "Live Scoreboard",
        "Real-time scores with prediction overlay",
        listOf(Color(0xFF10B981), Color(0xFF34D399)),
    ),
    MoreFeature(
        AppIcon.fromSystemName("checkmark.seal.fill")!!.imageVector,
        "Bet Slip Grader",
        "Grade your parlays before placing",
        listOf(Color(0xFFF59E0B), Color(0xFFFBBF24)),
    ),
)

@Composable
private fun card(f: MoreFeature, modifier: Modifier = Modifier) {
    Column(
        modifier
            .heightIn(min = 110.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Brush.linearGradient(f.colors))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center,
        ) {
            androidx.compose.material3.Icon(
                imageVector = f.icon,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(22.dp),
            )
        }
        Text(f.title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
        Text(
            f.description,
            fontSize = 11.sp,
            color = Color.White.copy(alpha = 0.85f),
            lineHeight = 15.sp,
        )
        Spacer(Modifier.weight(1f))
    }
}
