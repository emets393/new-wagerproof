package com.wagerproof.app.features.search

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.components.SkeletonCapsule
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.InsightTeaser
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.stores.SearchStore
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Rich MLB game result card for search: matchup header (tap = game-sheet
 * handoff) + a rail of insight chips (Trends / F5 / Props teasers, tap = local
 * push to the expanded surface). Absent kinds hide their chip, loading kinds
 * shimmer, neutral chips still navigate ("never hide the door"). Port of iOS
 * `Features/Search/Components/SearchMatchupCard.swift`.
 */
@Composable
fun SearchMatchupCard(
    result: SearchStore.SearchResult.Game,
    teasers: List<InsightTeaser>,
    loadingKinds: Set<InsightTeaser.Kind>,
    onOpenGame: () -> Unit,
    onOpenInsight: (InsightTeaser.Kind) -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(26.dp)
    Column(
        modifier
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.85f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Header(result, onOpenGame)
        if (teasers.isNotEmpty() || loadingKinds.isNotEmpty()) {
            ChipRail(teasers, loadingKinds, onOpenInsight)
        }
    }
}

@Composable
private fun Header(result: SearchStore.SearchResult.Game, onOpenGame: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onOpenGame),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LogoDisc(result, result.awayTeam)
        Spacer(Modifier.width(6.dp))
        LogoDisc(result, result.homeTeam)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                "${result.awayTeam} @ ${result.homeTeam}",
                color = AppColors.appTextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                subtitle(result),
                color = AppColors.appTextSecondary,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.width(6.dp))
        Icon(
            AppIcon.CHEVRON_RIGHT.imageVector,
            contentDescription = null,
            tint = AppColors.appTextMuted,
            modifier = Modifier.size(14.dp),
        )
    }
}

private fun subtitle(result: SearchStore.SearchResult.Game): String {
    val parts = mutableListOf(result.sport.label)
    result.gameTime?.takeIf { it.isNotEmpty() }?.let { parts.add(prettyTime(it)) }
    return parts.joinToString(" · ")
}

/** Upstream `gameTime` fields mix ISO 8601 and bare dates — surface what
 * parses, fall back to the raw string. */
private fun prettyTime(raw: String): String = try {
    val dt = OffsetDateTime.parse(raw)
    dt.format(DateTimeFormatter.ofPattern("EEE h:mm a", Locale.getDefault()))
} catch (_: Exception) {
    raw
}

@Composable
private fun LogoDisc(result: SearchStore.SearchResult.Game, team: String) {
    val info = if (result.sport == SearchStore.GamesStoreSport.MLB) MLBTeams.info(team) else null
    if (info != null) {
        Box(
            Modifier.size(24.dp).clip(CircleShape)
                .background(Color(info.primaryHex).copy(alpha = 0.4f)),
            contentAlignment = Alignment.Center,
        ) {
            RemoteImage(
                url = info.logoUrl,
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                contentScale = ContentScale.Fit,
            )
        }
    } else {
        Box(
            Modifier.size(24.dp).clip(CircleShape).background(AppColors.appSurfaceMuted),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                team.take(1),
                color = AppColors.appTextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun ChipRail(
    teasers: List<InsightTeaser>,
    loadingKinds: Set<InsightTeaser.Kind>,
    onOpenInsight: (InsightTeaser.Kind) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
        InsightTeaser.Kind.entries.forEach { kind ->
            val teaser = teasers.firstOrNull { it.kind == kind }
            when {
                teaser != null -> Box(Modifier.weight(1f)) {
                    InsightChip(teaser) { onOpenInsight(kind) }
                }
                loadingKinds.contains(kind) -> Box(Modifier.weight(1f)) {
                    SkeletonCapsule(height = 52.dp, modifier = Modifier.shimmering())
                }
            }
        }
    }
}

/** One insight teaser chip — tracking-caps kind title + tinted icon + the
 * teaser headline (or neutral copy). Always tappable. */
@Composable
private fun InsightChip(teaser: InsightTeaser, onTap: () -> Unit) {
    val title = when (teaser.kind) {
        InsightTeaser.Kind.TRENDS -> "TRENDS"
        InsightTeaser.Kind.F5 -> "FIRST 5"
        InsightTeaser.Kind.PROPS -> "PROPS"
    }
    val icon = when (teaser.kind) {
        InsightTeaser.Kind.TRENDS -> AppIcon.CHART_LINE_UPTREND
        InsightTeaser.Kind.F5 -> AppIcon.BASEBALL_DIAMOND_BASES
        InsightTeaser.Kind.PROPS -> AppIcon.FIGURE_BASEBALL
    }
    val tint = when (teaser.signal) {
        InsightTeaser.Signal.POSITIVE -> AppColors.appPrimary
        InsightTeaser.Signal.NEGATIVE -> AppColors.appAccentRed
        InsightTeaser.Signal.NEUTRAL -> AppColors.appTextSecondary
    }
    val headline = teaser.headline ?: when (teaser.kind) {
        InsightTeaser.Kind.TRENDS -> "Situational angles"
        InsightTeaser.Kind.F5 -> "F5 splits"
        InsightTeaser.Kind.PROPS -> "Props posted"
    }

    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.6f))
            .clickable(onClick = onTap)
            .heightIn(min = 52.dp)
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(icon.imageVector, contentDescription = null, tint = tint, modifier = Modifier.size(9.dp))
            Text(
                title,
                color = AppColors.appTextSecondary,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.6.sp,
            )
            if (teaser.smallSample) {
                Box(Modifier.size(4.dp).clip(CircleShape).background(AppColors.appAccentAmber))
            }
        }
        Text(
            headline,
            color = if (teaser.headline == null) AppColors.appTextSecondary else tint,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
