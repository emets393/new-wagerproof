package com.wagerproof.app.features.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

/** A single game reference summarised by the pill. */
data class WagerBotGameReference(
    val id: String,
    val sport: String,
    val awayAbbr: String,
    val homeAbbr: String,
)

/**
 * Port of iOS `WagerBotGameReferencesPill.swift`. Compact pill of up to 4
 * overlapping sport-glyph circles + "N game(s)" + chevron. Tapping a thumbnail
 * opens that game via [onTap].
 */
@Composable
fun WagerBotGameReferencesPill(
    references: List<WagerBotGameReference>,
    modifier: Modifier = Modifier,
    onTap: ((WagerBotGameReference) -> Unit)? = null,
) {
    if (references.isEmpty()) return
    Row(
        modifier = modifier
            .clip(CircleShape)
            .background(AppColors.appPrimary.copy(alpha = 0.08f))
            .border(1.dp, AppColors.appPrimary.copy(alpha = 0.18f), CircleShape)
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        val visible = references.take(4)
        Row(horizontalArrangement = Arrangement.spacedBy((-10).dp)) {
            visible.forEachIndexed { idx, ref ->
                Avatar(
                    ref = ref,
                    modifier = Modifier
                        .zIndex((visible.size - idx).toFloat())
                        .then(if (onTap != null) Modifier.clickable { onTap(ref) } else Modifier),
                )
            }
        }
        Text(
            text = if (references.size == 1) "1 game" else "${references.size} games",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.appTextSecondary,
        )
        Icon(
            AppIcon.CHEVRON_RIGHT.imageVector,
            contentDescription = null,
            tint = AppColors.appTextSecondary.copy(alpha = 0.6f),
            modifier = Modifier.size(9.dp),
        )
    }
}

@Composable
private fun Avatar(ref: WagerBotGameReference, modifier: Modifier = Modifier) {
    val color = sportColor(ref.sport)
    val icon = chatIcon(sportIcon(ref.sport))
    Box(
        modifier
            .size(26.dp)
            .clip(CircleShape)
            .background(color.copy(alpha = 0.20f))
            .border(2.dp, AppColors.appSurface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(11.dp))
    }
}

private fun sportIcon(sport: String): String = when (sport.lowercase()) {
    "nba", "ncaab" -> "basketball.fill"
    "nfl", "cfb" -> "football.fill"
    "mlb" -> "baseball.fill"
    else -> "sportscourt.fill"
}

private fun sportColor(sport: String): Color = when (sport.lowercase()) {
    "nba" -> AppColors.appAccentAmber
    "nfl" -> AppColors.appAccentBlue
    "cfb" -> AppColors.appAccentPurple
    "ncaab" -> AppColors.appAccentRed
    "mlb" -> AppColors.appAccentBlue
    else -> AppColors.appPrimary
}
