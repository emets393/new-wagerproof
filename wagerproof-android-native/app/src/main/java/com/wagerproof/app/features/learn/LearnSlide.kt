package com.wagerproof.app.features.learn

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
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
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing

/**
 * Port of iOS `LearnSlide.swift`. Per-slide scaffold: glass title card
 * (green icon badge + title + description), custom mockup content, optional
 * "WHY THIS MATTERS" green-tinted value card.
 *
 * The iOS glass uses `.ultraThinMaterial`; Compose has no material blur, so we
 * approximate with `appSurfaceElevated` + a hairline border (established
 * translucent-surface substitution across this port).
 */
@Composable
fun LearnSlide(
    icon: ImageVector,
    title: String,
    description: String,
    valueProposition: String?,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Spacing.lg)
            .padding(top = Spacing.xs, bottom = Spacing.lg),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        titleCard(icon, title, description)
        content()
        valueProposition?.let { valueCard(it) }
    }
}

@Composable
private fun titleCard(icon: ImageVector, title: String, description: String) {
    Row(
        Modifier
            .clip(RoundedCornerShape(14.dp))
            .background(AppColors.appSurfaceElevated)
            .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(14.dp))
            .padding(horizontal = Spacing.lg, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(Brush.linearGradient(listOf(AppColors.appPrimary, AppColors.appPrimaryStrong))),
            contentAlignment = Alignment.Center,
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = Color.Black, modifier = Modifier.size(18.dp))
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
            Text(description, fontSize = 12.sp, color = AppColors.appTextSecondary)
        }
    }
}

@Composable
private fun valueCard(text: String) {
    Column(
        Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(
                Brush.linearGradient(
                    listOf(AppColors.appPrimary.copy(alpha = 0.10f), AppColors.appPrimaryStrong.copy(alpha = 0.05f)),
                ),
            )
            .border(1.dp, AppColors.appPrimary.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = com.wagerproof.core.design.icons.AppIcon.fromSystemName("lightbulb.fill")!!.imageVector,
                contentDescription = null,
                tint = AppColors.appPrimary,
                modifier = Modifier.size(13.dp),
            )
            Text(
                "WHY THIS MATTERS",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = AppColors.appPrimary,
            )
        }
        Text(text, fontSize = 12.sp, color = AppColors.appTextPrimary, lineHeight = 16.sp)
    }
}
