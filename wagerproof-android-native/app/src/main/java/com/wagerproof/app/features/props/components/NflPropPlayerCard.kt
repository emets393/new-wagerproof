package com.wagerproof.app.features.props.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.props.NFLPlayerPropSelection
import com.wagerproof.app.features.props.NFLPropFeedItem
import com.wagerproof.app.features.props.nflTeamColors
import com.wagerproof.app.features.shared.InitialsDisc
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NFLPlayerProps
import com.wagerproof.core.models.NFLPropMarket
import com.wagerproof.core.models.NFLPropPlayer
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.models.NFLTeams
import com.wagerproof.core.services.SportsbookPropMarketOdds
import com.wagerproof.core.services.SportsbookPropOddsService
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * NFL player-prop feed card — port of iOS `NFLPropPlayerCard.swift`. Mirrors
 * [PropPlayerCard]'s chrome; anytime-TD markets render a single yes-price pill
 * with an implied-probability caption instead of O/U pills. Appends a compact
 * prop-signal strip when the displayed market fired P-flags.
 */
@Composable
fun NflPropPlayerCard(
    item: NFLPropFeedItem,
    onSelect: (NFLPlayerPropSelection) -> Unit,
    modifier: Modifier = Modifier,
) {
    val haptics = LocalHapticFeedback.current
    val player = item.player
    val headline: NFLPropMarket? = item.displayMarket
    var liveOdds by remember(player.playerId, headline?.market) {
        mutableStateOf<SportsbookPropMarketOdds?>(null)
    }
    LaunchedEffect(player.playerId, headline?.market) {
        val playerId = player.playerId
        liveOdds = if (!playerId.isNullOrEmpty() && headline != null) {
            SportsbookPropOddsService.odds(playerId, headline.market)
        } else null
    }
    val (primary, secondary) = nflTeamColors(player.team ?: "")
    val shape = RoundedCornerShape(26.dp)

    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.92f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .clickable {
                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                onSelect(item.selection)
            }
            .padding(start = 12.dp, end = 14.dp, top = 9.dp, bottom = 9.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PropTeamAvatarNFL(
                content = {
                    NFLPlayerHeadshot(player.playerName, player.playerId, player.headshotUrl, 40.dp)
                },
                teamLogoUrl = player.team?.let { NFLTeamAssets.logo(it) },
                primary = primary,
                secondary = secondary,
            )
            Spacer(Modifier.width(10.dp))
            Column {
                Text(player.playerName, color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(subtitle(player), color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium, maxLines = 1)
            }
            Spacer(Modifier.weight(1f))
            OverUnderBlock(headline, liveOdds)
            Spacer(Modifier.width(10.dp))
            Column(horizontalAlignment = Alignment.End) {
                Text("L10 TREND", color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(3.dp))
                RecentFormStrip(
                    strip = headline?.miniStrip?.map { FormBar(it.cleared, it.value) } ?: emptyList(),
                    line = headline?.clearThreshold ?: 1.0,
                    modifier = Modifier.size(74.dp, 46.dp),
                )
            }
        }

        val flags = headline?.flags
        if (!flags.isNullOrEmpty()) {
            NFLPropSignalFeedStrip(flags)
        }

        Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.5f)))

        Row(verticalAlignment = Alignment.CenterVertically) {
            InfoItem(item.metricLabel, headline?.label ?: "-", AppColors.appPrimary)
            Spacer(Modifier.width(16.dp))
            InfoItem("L10", l10Label(headline), AppColors.appTextPrimary)
            Spacer(Modifier.width(16.dp))
            InfoItem("HIT", hitLabel(headline), hitColorNfl(headline))
            Spacer(Modifier.weight(1f))
            TimePill(nextGameLabel(player))
        }
    }
}

private fun subtitle(player: NFLPropPlayer): String {
    val opp = player.opponent?.let { opponent ->
        val prefix = if (player.isHome == true) "vs" else "@"
        "$prefix ${NFLTeams.abbr(opponent)}"
    }.orEmpty()
    val pos = player.position
    return if (!pos.isNullOrEmpty()) {
        if (opp.isEmpty()) pos else "$pos · $opp"
    } else {
        opp
    }
}

@Composable
private fun OverUnderBlock(headline: NFLPropMarket?, live: SportsbookPropMarketOdds?) {
    if (headline?.isYesNo == true) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            OuPill("TD", "", NFLPlayerProps.formatOdds(live?.over?.quotes?.firstOrNull()?.price ?: headline.overPrice ?: headline.bestOver.price), AppColors.appPrimary)
            headline.closeYesProb?.let { p ->
                Text("${NFLPlayerProps.formatPct(p)} implied", color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    } else {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            val over = live?.over?.quotes?.firstOrNull()
            val under = live?.under?.quotes?.firstOrNull()
            OuPill("O", NFLPlayerProps.formatLine(over?.line ?: headline?.closeLine ?: headline?.bestOver?.line), NFLPlayerProps.formatOdds(over?.price ?: headline?.overPrice ?: headline?.bestOver?.price), AppColors.appPrimary)
            OuPill("U", NFLPlayerProps.formatLine(under?.line ?: headline?.closeLine ?: headline?.bestUnder?.line), NFLPlayerProps.formatOdds(under?.price ?: headline?.underPrice ?: headline?.bestUnder?.price), AppColors.appTextSecondary)
        }
    }
}

private fun nextGameLabel(player: NFLPropPlayer): String {
    player.kickoff?.takeIf { it.isNotEmpty() }?.let { iso ->
        runCatching {
            val date = OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.of("America/New_York"))
            return date.format(DateTimeFormatter.ofPattern("M/d ha", Locale.US)).lowercase(Locale.US)
        }
    }
    return "TBD"
}

private fun l10Label(headline: NFLPropMarket?): String {
    val m = headline ?: return "-"
    val (hits, n) = m.l10Hits
    if (n <= 0) return "-"
    return "$hits/$n Over"
}

private fun hitLabel(headline: NFLPropMarket?): String {
    val rate = headline?.l10HitRate ?: return "-"
    return "${Math.round(rate * 100).toInt()}%"
}

private fun hitColorNfl(headline: NFLPropMarket?): Color {
    val rate = headline?.l10HitRate ?: return AppColors.appTextMuted
    val pct = rate * 100
    return when {
        pct >= 70 -> AppColors.appPrimary
        pct >= 55 -> Color(0xFFEAB308)
        else -> AppColors.appTextSecondary
    }
}

/**
 * NFL headshot with an initials-disc fallback. Prefers `headshotUrl`; otherwise
 * the numeric ESPN id, else initials. Port of iOS `NFLPlayerHeadshot`.
 */
@Composable
fun NFLPlayerHeadshot(
    playerName: String,
    playerId: String?,
    headshotUrl: String?,
    size: androidx.compose.ui.unit.Dp,
) {
    val url = headshotUrl ?: NFLTeams.headshotUrl(playerId)
    val initials = playerName.split(" ").mapNotNull { it.firstOrNull() }.take(2).joinToString("").uppercase()
    Box(Modifier.size(size).clip(CircleShape), contentAlignment = Alignment.Center) {
        RemoteImage(
            url = url,
            contentDescription = playerName,
            modifier = Modifier.size(size),
            contentScale = ContentScale.Crop,
            loading = { InitialsDisc(initials, size) },
            error = { InitialsDisc(initials, size) },
        )
    }
}
