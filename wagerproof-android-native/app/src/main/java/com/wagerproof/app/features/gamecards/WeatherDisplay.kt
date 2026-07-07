package com.wagerproof.app.features.gamecards

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import kotlin.math.roundToInt

/**
 * Legacy inline weather row — port of iOS `WeatherDisplay.swift`. Up to 3 chips
 * (temperature, wind, precipitation when >0). Newer sheets render their own hero
 * weather chips instead.
 */
@Composable
fun WeatherDisplay(
    temperatureF: Double?,
    windMph: Double?,
    precipitationPct: Double?,
    modifier: Modifier = Modifier,
) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        temperatureF?.let { WeatherChip(AppIcon.THERMOMETER_MEDIUM, "${it.roundToInt()}°F") }
        windMph?.let { WeatherChip(AppIcon.WIND, "${it.roundToInt()} mph") }
        precipitationPct?.takeIf { it > 0 }?.let { WeatherChip(AppIcon.INFO_CIRCLE, "${it.roundToInt()}%") }
    }
}

@Composable
private fun WeatherChip(icon: AppIcon, value: String) {
    Row(
        Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(AppColors.appAccentBlue.copy(alpha = 0.06f))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon.imageVector, null, tint = AppColors.appAccentBlue, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(4.dp))
        Text(value, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}
