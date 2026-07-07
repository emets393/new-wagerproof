package com.wagerproof.app.features.mlb.props

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.props.PlayerPropFeed
import com.wagerproof.app.features.props.PlayerPropFeedItem
import com.wagerproof.app.features.props.PlayerPropSelection
import com.wagerproof.app.features.props.components.PlayerHeadshot
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBPlayerProps
import com.wagerproof.core.models.MLBPropMatchup
import com.wagerproof.app.features.mlb.MLBFormatting

/**
 * Full team-grouped player-prop list — port of iOS `MatchupPropsDetailSheet` /
 * `MatchupPropsListBody`. The expand target of [MLBMatchupPropsWidget]; rows
 * push the player's prop detail via [onSelect]. Rendered as a full screen.
 */
@Composable
fun MatchupPropsDetailSheet(
    matchup: MLBPropMatchup,
    onSelect: (PlayerPropSelection) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .verticalScroll(rememberScrollState())
            .padding(bottom = 32.dp),
    ) {
        Column(Modifier.padding(horizontal = 16.dp).padding(top = 20.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "${matchup.awayAbbr} @ ${matchup.homeAbbr} · Player Props",
                fontSize = 18.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary,
            )
            Text(
                "${MLBFormatting.dateLabel(matchup.officialDate)} · ${MLBFormatting.gameTime(matchup.gameTimeEt)}",
                fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary,
            )
        }
        Spacer(Modifier.height(8.dp))
        MatchupPropsListBody(matchup, onSelect, Modifier.padding(horizontal = 16.dp))
    }
}

@Composable
fun MatchupPropsListBody(
    matchup: MLBPropMatchup,
    onSelect: (PlayerPropSelection) -> Unit,
    modifier: Modifier = Modifier,
) {
    val items = PlayerPropFeed.items(listOf(matchup))
    val awayItems = items.filter { it.selection.teamAbbr == matchup.awayAbbr }
    val homeItems = items.filter { it.selection.teamAbbr == matchup.homeAbbr }
    // Extra (bench/pinch-hit) batters get teamAbbr "" — render as a third group.
    val extraItems = items.filter { it.selection.teamAbbr != matchup.awayAbbr && it.selection.teamAbbr != matchup.homeAbbr }

    Column(modifier.fillMaxWidth()) {
        TeamGroup(matchup.awayAbbr, matchup.awayLogoUrl, awayItems, onSelect)
        TeamGroup(matchup.homeAbbr, matchup.homeLogoUrl, homeItems, onSelect)
        TeamGroup("More props", null, extraItems, onSelect)
    }
}

@Composable
private fun TeamGroup(abbr: String, logo: String?, items: List<PlayerPropFeedItem>, onSelect: (PlayerPropSelection) -> Unit) {
    if (items.isEmpty()) return
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (logo != null) {
                RemoteImage(logo, abbr, Modifier.size(16.dp))
            }
            Text(abbr.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp, color = AppColors.appTextSecondary)
            Box(Modifier.weight(1f))
            Text("${items.size}", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextMuted)
        }
        items.forEachIndexed { idx, item ->
            if (idx > 0) Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.4f)))
            MatchupPropListRow(item, onSelect)
        }
    }
}

@Composable
private fun MatchupPropListRow(item: PlayerPropFeedItem, onSelect: (PlayerPropSelection) -> Unit) {
    val sel = item.selection
    val computed = item.headline.computed
    val pct = computed.l10.pct
    val hitColor: Color = when {
        pct == null -> AppColors.appTextMuted
        pct >= 70 -> AppColors.appPrimary
        pct >= 55 -> hexColor(0xEAB308L)
        else -> AppColors.appTextSecondary
    }
    val roleLabel = sel.position?.takeIf { it.isNotEmpty() } ?: if (sel.isPitcher) "SP" else ""
    val opp = if (sel.opponentAbbr.isEmpty()) "" else "vs ${sel.opponentAbbr}"
    val subtitle = when {
        roleLabel.isEmpty() -> opp
        opp.isEmpty() -> roleLabel
        else -> "$roleLabel · $opp"
    }
    Row(
        Modifier.fillMaxWidth().clickable { onSelect(sel) }.padding(vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PlayerHeadshot(playerId = sel.playerId, size = 32.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(sel.playerName, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary, maxLines = 1)
            Text(subtitle, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = AppColors.appTextSecondary, maxLines = 1)
        }
        Spacer(Modifier.width(8.dp))
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "${MLBPlayerProps.marketLabel(item.headline.row.market)} ${MLBPlayerProps.formatLine(computed.line)}",
                fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary, maxLines = 1,
            )
            Text("L10 ${computed.l10.pctLabel}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = hitColor)
        }
        Icon(AppIcon.CHEVRON_RIGHT.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(12.dp))
    }
}
