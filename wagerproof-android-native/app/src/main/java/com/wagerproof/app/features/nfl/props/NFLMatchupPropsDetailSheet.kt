package com.wagerproof.app.features.nfl.props

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.nfl.NFLTeamColors
import com.wagerproof.app.features.props.NFLPlayerPropSelection
import com.wagerproof.app.features.props.NFLPropFeed
import com.wagerproof.app.features.props.NFLPropFeedItem
import com.wagerproof.app.features.props.components.NFLPlayerHeadshot
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.InsightThresholds
import com.wagerproof.core.models.NFLPlayerProps
import com.wagerproof.core.models.NFLTeams
import com.wagerproof.core.stores.PropsStore
import kotlin.math.roundToInt

/**
 * Full team-grouped player-prop list for one NFL matchup — expand target of
 * [NFLMatchupPropsWidget]. Rows push the existing NFL prop detail via [onSelect].
 */
@Composable
fun NFLMatchupPropsDetailSheet(
    awayTeam: String,
    homeTeam: String,
    propsStore: PropsStore,
    onSelect: (NFLPlayerPropSelection) -> Unit,
    modifier: Modifier = Modifier,
) {
    val awayAbbr = NFLTeams.abbr(awayTeam)
    val homeAbbr = NFLTeams.abbr(homeTeam)
    val items = remember(awayTeam, homeTeam, propsStore.nflPlayers) {
        NFLPropFeed.items(propsStore.nflPlayers(awayTeam, homeTeam))
    }
    val awayItems = items.filter { NFLTeams.matches(it.player.team.orEmpty(), awayTeam) }
    val homeItems = items.filter { NFLTeams.matches(it.player.team.orEmpty(), homeTeam) }

    Column(
        modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .verticalScroll(rememberScrollState())
            .padding(bottom = 32.dp),
    ) {
        Column(
            Modifier.padding(horizontal = 16.dp).padding(top = 20.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                "$awayAbbr @ $homeAbbr · Player Props",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.appTextPrimary,
            )
            Text(
                "${items.size} players",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.appTextSecondary,
            )
        }
        Column(Modifier.padding(horizontal = 16.dp)) {
            TeamGroup(awayAbbr, awayItems, onSelect)
            TeamGroup(homeAbbr, homeItems, onSelect)
        }
    }
}

@Composable
private fun TeamGroup(abbr: String, items: List<NFLPropFeedItem>, onSelect: (NFLPlayerPropSelection) -> Unit) {
    if (items.isEmpty()) return
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(abbr.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp, color = AppColors.appTextSecondary)
            Box(Modifier.weight(1f))
            Text("${items.size}", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextMuted)
        }
        items.forEachIndexed { idx, item ->
            if (idx > 0) Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.4f)))
            NFLMatchupPropListRow(item, onSelect)
        }
    }
}

@Composable
private fun NFLMatchupPropListRow(item: NFLPropFeedItem, onSelect: (NFLPlayerPropSelection) -> Unit) {
    val market = item.displayMarket
    val rate = market.l10HitRate
    val n = market.l10Hits.n
    val pct = rate?.let { it * 100 }
    val tint: Color = when {
        n < InsightThresholds.propSampleMin || pct == null -> AppColors.appTextSecondary
        pct >= InsightThresholds.propHot -> AppColors.appWin
        pct <= InsightThresholds.propCold -> AppColors.appAccentBlue
        pct >= 55 -> AppColors.appAccentAmber
        else -> AppColors.appTextSecondary
    }
    val ring = NFLTeamColors.colorPair(item.player.team.orEmpty()).primary
    val subtitle = if (market.isYesNo) {
        "${market.label} · Yes ${NFLPlayerProps.formatOdds(market.overPrice)}"
    } else {
        "${market.label} · Over ${NFLPlayerProps.formatLine(market.closeLine)}"
    }
    val pctLabel = rate?.let { "${(it * 100).roundToInt()}%" } ?: "—"
    val fractionLabel = if (n > 0) "${market.l10Hits.hits}/$n L10" else "—"

    Row(
        Modifier.fillMaxWidth().clickable { onSelect(item.selection) }.padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier.size(32.dp).clip(CircleShape).border(1.5.dp, ring.copy(alpha = 0.8f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            NFLPlayerHeadshot(item.player.playerName, item.player.playerId, item.player.headshotUrl, 32.dp)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(item.player.playerName, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary, maxLines = 1)
            Text(subtitle, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary, maxLines = 1)
        }
        Spacer(Modifier.size(6.dp))
        Column(horizontalAlignment = Alignment.End) {
            Text(pctLabel, fontSize = 16.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace, color = tint)
            Text(fractionLabel, fontSize = 9.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextMuted)
        }
        Icon(AppIcon.CHEVRON_RIGHT.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(11.dp))
    }
}
