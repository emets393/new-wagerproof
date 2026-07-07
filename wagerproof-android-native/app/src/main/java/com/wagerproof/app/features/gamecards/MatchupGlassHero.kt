package com.wagerproof.app.features.gamecards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.tokens.AppColors

/** One side of a [MatchupGlassHero]. */
data class MatchupHeroSide(
    val logoURL: String?,
    val abbr: String,
    val colors: TeamColorPair,
    val moneyline: Int?,
)

/** A center stat column: label over away/home values. */
data class HeroStat(val label: String, val away: String, val home: String)

/**
 * Collapsing matchup centerpiece — port of iOS `MatchupGlassHero.swift`.
 *
 * `progress` 0→1: two big glass discs (80→40dp) start fused center and flow
 * apart to opposite edges. Expanded stats fade out; collapsed stats + per-team
 * abbr/ML labels fade in when split. FIDELITY-WAIVER: the metaball fusion is
 * approximated with overlapping discs (no Compose primitive).
 */
@Composable
fun MatchupGlassHero(
    away: MatchupHeroSide,
    home: MatchupHeroSide,
    progress: Float,
    expandedStats: List<HeroStat>,
    collapsedStats: List<HeroStat>,
    fusedTitle: String,
    modifier: Modifier = Modifier,
) {
    val split = ((progress - 0.18f) / 0.60f).coerceIn(0f, 1f)
    val discSize = (80f - 40f * progress).dp
    val expandedAlpha = (1f - progress / 0.53f).coerceIn(0f, 1f)
    val collapsedAlpha = split

    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.fillMaxWidth().height(84.dp)) {
            // Discs: flow from center to edges as split ramps.
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = if (split > 0.5f) Arrangement.SpaceBetween else Arrangement.Center,
            ) {
                HeroDisc(away, discSize, split)
                if (split <= 0.5f) Spacer(Modifier.width((16f * (1f - split)).dp))
                HeroDisc(home, discSize, split)
            }
            // Fused title (only while fused).
            Text(
                fusedTitle,
                color = AppColors.appTextPrimary,
                fontSize = 17.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.align(Alignment.Center).alpha((1f - split * 2f).coerceIn(0f, 1f)),
            )
        }
        // Per-team abbr + ML labels appear when split.
        if (collapsedAlpha > 0f) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 24.dp).alpha(collapsedAlpha), horizontalArrangement = Arrangement.SpaceBetween) {
                TeamLabel(away)
                TeamLabel(home)
            }
        }
        Spacer(Modifier.height(8.dp))
        Box(contentAlignment = Alignment.Center) {
            if (expandedAlpha > 0f) StatRow(expandedStats, Modifier.alpha(expandedAlpha))
            if (collapsedAlpha > 0f) StatRow(collapsedStats, Modifier.alpha(collapsedAlpha))
        }
    }
}

@Composable
private fun HeroDisc(side: MatchupHeroSide, size: androidx.compose.ui.unit.Dp, split: Float) {
    val tint = side.colors.primary.teamVisible(0.5f)
    Box(
        Modifier
            .size(size)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(tint.copy(alpha = 0.55f), side.colors.secondary.copy(alpha = 0.35f))))
            .border(1.dp, Color.White.copy(alpha = 0.18f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        RemoteImage(
            side.logoURL, side.abbr, Modifier.size(size * 0.82f),
            error = { Text(TeamInitials.from(side.abbr), color = Color.White, fontWeight = FontWeight.Bold, fontSize = (size.value * 0.34f).sp) },
        )
    }
}

@Composable
private fun TeamLabel(side: MatchupHeroSide) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(side.abbr, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Black)
        Text(GameCardFormatting.formatMoneyline(side.moneyline), color = AppColors.appTextSecondary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
    }
}

@Composable
private fun StatRow(stats: List<HeroStat>, modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
        stats.forEach { s ->
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(s.label, color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Text("${s.away}  ${s.home}", color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
