package com.wagerproof.app.features.mlb.props

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
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamewidgets.InsightExpandFooter
import com.wagerproof.app.features.gamewidgets.InsightVerdictLine
import com.wagerproof.app.features.gamewidgets.MiniHitStrip
import com.wagerproof.app.features.props.PlayerPropFeed
import com.wagerproof.app.features.props.PlayerPropSelection
import com.wagerproof.app.features.props.components.PlayerHeadshot
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBPlayerProps
import com.wagerproof.core.models.MLBPropMatchup
import com.wagerproof.core.models.MLBPropsInsight
import com.wagerproof.core.models.PropSignal

/**
 * "Player Props" insight widget for the MLB detail sheet — port of iOS
 * `MLBMatchupPropsWidget`. Renders the `MLBPropsInsight` digest (verdict + ≤5
 * slot-ordered player rows); tapping a row selects the player's prop for the
 * carousel to push its detail page. The expand footer opens the full list.
 */
@Composable
fun MLBMatchupPropsWidget(
    matchup: MLBPropMatchup,
    onSelect: (PlayerPropSelection) -> Unit,
    onExpand: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val summary = MLBPropsInsight.summary(matchup) ?: return
    val items = PlayerPropFeed.items(listOf(matchup))
    val itemsById = items.associateBy { it.selection.playerId }

    val shape = RoundedCornerShape(18.dp)
    Column(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.92f))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(
                AppIcon.fromSystemName("figure.baseball")?.imageVector ?: AppIcon.CHART_BAR_FILL.imageVector,
                null, tint = AppColors.appPrimary, modifier = Modifier.size(16.dp),
            )
            Text("Player Props", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary)
            Box(Modifier.weight(1f))
            summary.badge?.let { badge ->
                val badgeColor = hexColor(badge.tintHex)
                Text(
                    badge.text, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = badgeColor,
                    modifier = Modifier.clip(CircleShape).background(badgeColor.copy(alpha = 0.16f)).padding(horizontal = 8.dp, vertical = 3.dp),
                )
            }
        }
        InsightVerdictLine(listOf(summary.verdict))
        Column(Modifier.fillMaxWidth()) {
            summary.signals.forEachIndexed { idx, signal ->
                if (idx > 0) Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.4f)))
                val item = itemsById[signal.playerId]
                if (item != null) {
                    PropSignalRow(signal, item.teamPrimaryHex, onTap = { onSelect(item.selection) })
                }
            }
        }
        InsightExpandFooter(label = "All ${summary.totalProps} props", onTap = onExpand)
    }
}

/** One digest row: headshot ringed with team color · name + L10 strip · line + pct. */
@Composable
fun PropSignalRow(
    signal: PropSignal,
    teamPrimaryHex: Long,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val computed = signal.headline.computed
    val lowConfidence = computed.l10.lowConfidence
    val pct = computed.l10.pct
    val pctColor: Color = when {
        lowConfidence || pct == null -> AppColors.appTextSecondary
        pct >= 70 -> hexColor(0x22C55EL)
        pct >= 55 -> hexColor(0xEAB308L)
        pct <= 30 -> hexColor(0xEF4444L)
        else -> AppColors.appTextSecondary
    }
    Row(
        modifier.fillMaxWidth().clickable(onClick = onTap).padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier.size(28.dp).clip(CircleShape).border(1.5.dp, hexColor(teamPrimaryHex).copy(alpha = 0.8f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PlayerHeadshot(playerId = signal.playerId, size = 28.dp)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(signal.playerName, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary, maxLines = 1)
            if (computed.miniStrip.isEmpty()) {
                Text(
                    if (signal.isPitcher) "SP" else signal.battingOrder?.let { "#$it" } ?: "",
                    fontSize = 10.sp, fontWeight = FontWeight.Medium, color = AppColors.appTextMuted,
                )
            } else {
                MiniHitStrip(computed.miniStrip.map { it.cleared })
            }
            if (lowConfidence) {
                Text("small sample", fontSize = 9.sp, fontWeight = FontWeight.Medium, color = AppColors.appTextMuted)
            }
        }
        Spacer(Modifier.width(8.dp))
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                "${MLBPropsInsight.marketShort(signal.headline.row.market)} ${MLBPlayerProps.formatLine(computed.line)}",
                fontSize = 12.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace, color = AppColors.appTextPrimary, maxLines = 1,
            )
            Text(
                computed.l10.pctLabel, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = pctColor,
                modifier = Modifier.clip(CircleShape).background(pctColor.copy(alpha = 0.13f)).padding(horizontal = 6.dp, vertical = 1.dp),
            )
        }
        Icon(AppIcon.CHEVRON_RIGHT.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(11.dp))
    }
}
