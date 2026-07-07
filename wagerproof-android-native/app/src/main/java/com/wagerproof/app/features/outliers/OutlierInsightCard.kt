package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
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
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.InsightVerdictBadge

// FIDELITY-WAIVER #241: iOS uses LiquidGlassMergeContainer + teamGlassDisc for
// the fused overlapping discs — not ported. Rendered as plain overlapping
// OutlierGlassTeamAvatar discs (offset overlap) instead.

/**
 * Compact matchup card for the Outliers hub's primitive-typed carousels (Trends
 * / First-5). Shows the matchup + that primitive's verdict badge and one-line
 * takeaway. Port of iOS OutlierInsightCard.swift.
 */
@Composable
fun OutlierInsightCard(
    awayAbbr: String,
    homeAbbr: String,
    awayLogoURL: String?,
    homeLogoURL: String?,
    awayColor: Color,
    homeColor: Color,
    badge: InsightVerdictBadge?,
    verdict: String,
    timeLabel: String?,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
    stretches: Boolean = false,
) {
    val shape = RoundedCornerShape(20.dp)
    val widthMod = if (stretches) Modifier.fillMaxWidth() else Modifier.width(178.dp)
    Column(
        modifier
            .then(widthMod)
            .clip(shape)
            .liquidGlassBackground(shape, hairline = true)
            .clickable(onClick = onTap)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Discs(awayLogoURL, homeLogoURL, awayColor, homeColor, awayAbbr, homeAbbr)
            Text(
                "$awayAbbr @ $homeAbbr",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.appTextPrimary,
                maxLines = 1,
            )
            Box(Modifier.weight(1f))
        }
        if (badge != null) {
            val tint = hexColor(badge.tintHex)
            Text(
                badge.text,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.4.sp,
                color = tint,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(tint.copy(alpha = 0.16f))
                    .padding(horizontal = 7.dp, vertical = 3.dp),
            )
        }
        Text(
            verdict,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.appTextPrimary,
            maxLines = 2,
            modifier = Modifier.fillMaxWidth(),
        )
        if (timeLabel != null) {
            Text(timeLabel, fontSize = 10.sp, fontWeight = FontWeight.Medium, color = AppColors.appTextSecondary)
        }
    }
}

private const val DISC = 30

@Composable
private fun Discs(
    awayLogoURL: String?,
    homeLogoURL: String?,
    awayColor: Color,
    homeColor: Color,
    awayAbbr: String,
    homeAbbr: String,
) {
    Row {
        OutlierGlassTeamAvatar(awayLogoURL, awayAbbr.take(2), awayColor, DISC.dp)
        OutlierGlassTeamAvatar(homeLogoURL, homeAbbr.take(2), homeColor, DISC.dp, Modifier.offset(x = (-8).dp))
    }
}
