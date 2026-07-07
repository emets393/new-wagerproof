package com.wagerproof.app.features.agents.creation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
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
        text = title,
        color = AppColors.appTextSecondary,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = modifier.padding(start = 4.dp, top = 20.dp, bottom = 8.dp),
    )
}

/** Grouped-form footer — the small caption below an inset card. */
@Composable
fun WizardSectionFooter(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        color = AppColors.appTextSecondary,
        fontSize = 13.sp,
        modifier = modifier.padding(start = 4.dp, top = 6.dp),
    )
}

/** Inset grouped-form card surface wrapping a section's rows. */
@Composable
fun WizardSectionCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(AppColors.appSurfaceElevated, RoundedCornerShape(12.dp))
            .padding(horizontal = 16.dp, vertical = 8.dp),
        content = content,
    )
}
