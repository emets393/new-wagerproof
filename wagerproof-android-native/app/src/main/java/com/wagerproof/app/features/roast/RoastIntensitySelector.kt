package com.wagerproof.app.features.roast

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.CornerRadius
import com.wagerproof.core.stores.RoastSessionStore

/**
 * Port of iOS `RoastIntensitySelectorView.swift`. Three pills ordered Savage /
 * Medium / Light; active = green 20% bg + green border/text.
 */
@Composable
fun RoastIntensitySelector(
    intensity: RoastSessionStore.Intensity,
    onChange: (RoastSessionStore.Intensity) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        listOf(
            RoastSessionStore.Intensity.savage,
            RoastSessionStore.Intensity.medium,
            RoastSessionStore.Intensity.light,
        ).forEach { option ->
            pill(option, isActive = intensity == option, onClick = { onChange(option) })
        }
    }
}

@Composable
private fun pill(
    option: RoastSessionStore.Intensity,
    isActive: Boolean,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .clip(RoundedCornerShape(CornerRadius.pill))
            .background(if (isActive) AppColors.appPrimary.copy(alpha = 0.2f) else Color.White.copy(alpha = 0.08f))
            .border(
                1.dp,
                if (isActive) AppColors.appPrimary else Color.White.copy(alpha = 0.1f),
                RoundedCornerShape(CornerRadius.pill),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(option.emoji, fontSize = 16.sp)
        Text(
            option.label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (isActive) AppColors.appPrimary else Color.White.copy(alpha = 0.6f),
        )
    }
}
