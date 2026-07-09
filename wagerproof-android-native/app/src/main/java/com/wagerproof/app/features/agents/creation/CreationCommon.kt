package com.wagerproof.app.features.agents.creation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors

/**
 * Grouped-form section header — the small caps label above an inset card, the
 * Compose stand-in for a SwiftUI `Section` header.
 */
@Composable
fun WizardSectionHeader(title: String, modifier: Modifier = Modifier) {
    Text(
        text = title.uppercase(),
        color = AppColors.appTextSecondary,
        fontSize = 13.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 0.45.sp,
        modifier = modifier.padding(start = 4.dp, end = 4.dp, top = 22.dp, bottom = 7.dp),
    )
}

/** Grouped-form footer — the small caption below an inset card. */
@Composable
fun WizardSectionFooter(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        color = AppColors.appTextSecondary,
        fontSize = 13.sp,
        lineHeight = 17.sp,
        modifier = modifier.padding(start = 4.dp, end = 4.dp, top = 7.dp),
    )
}

/**
 * iOS-style inset grouped-form surface. Children form a contiguous group;
 * callers use [GroupedFormDivider] between logical controls instead of giving
 * every row its own floating box.
 */
@Composable
fun WizardSectionCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(11.dp))
            .background(AppColors.appSurfaceElevated)
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.55f), RoundedCornerShape(11.dp))
            .padding(horizontal = 16.dp, vertical = 5.dp),
        content = content,
    )
}

/** Hairline separator aligned with the grouped form's row content. */
@Composable
fun GroupedFormDivider(modifier: Modifier = Modifier) {
    Box(
        modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(AppColors.appBorder.copy(alpha = 0.58f)),
    )
}
