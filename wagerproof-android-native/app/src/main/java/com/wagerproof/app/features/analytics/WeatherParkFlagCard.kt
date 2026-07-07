package com.wagerproof.app.features.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBWeatherParkFlag

/**
 * One game's weather/park impact card: cyan icon chip (icon inferred from flag
 * text), matchup + venue, then wrapping flag chips. Port of iOS
 * `WeatherParkFlagCard`.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WeatherParkFlagCard(flag: MLBWeatherParkFlag, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(AppColors.appSurfaceElevated)
            .border(1.dp, AppColors.appBorder, RoundedCornerShape(14.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(Regression.accentCyan.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = iconFor(flag.flags),
                contentDescription = null,
                tint = Regression.accentCyan,
                modifier = Modifier.size(18.dp),
            )
        }

        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(flag.matchup, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
            Text(flag.venue, fontSize = 12.sp, color = AppColors.appTextSecondary)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                flag.flags.forEach { text ->
                    Text(
                        text = text,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = AppColors.appTextPrimary,
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(AppColors.appSurfaceMuted)
                            .padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
            }
        }
    }
}

// Same heuristic as RN `weatherIconForFlags`. Most weather SF Symbols aren't in
// the Android icon set (see report) — fall back to WIND (the one mapped weather
// glyph) so the cyan chip always renders.
private fun iconFor(flags: List<String>) = run {
    val joined = flags.joinToString(" ").lowercase()
    val name = when {
        joined.contains("rain") -> "cloud.heavyrain.fill"
        joined.contains("wind") -> "wind"
        joined.contains("cold") || joined.contains("snow") -> "snowflake"
        joined.contains("hot") || joined.contains("heat") -> "sun.max.fill"
        joined.contains("dome") || joined.contains("roof") -> "house.fill"
        joined.contains("humid") -> "humidity.fill"
        else -> "cloud.sun.fill"
    }
    Regression.icon(name, AppIcon.WIND)
}
