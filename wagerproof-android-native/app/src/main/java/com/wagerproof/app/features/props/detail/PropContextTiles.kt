package com.wagerproof.app.features.props.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBPropComputedAtLine
import com.wagerproof.core.models.MLBPropHitSplit
import com.wagerproof.core.models.MLBPlayerPropRow

/**
 * Contextual hit-rate tiles under the chart: L10 (always), day/night split, and
 * (batters only) the vs-archetype split. Low-confidence splits (< 5 games) dim
 * to 0.75. Port of iOS `PropContextTiles.swift`.
 */
@Composable
fun PropContextTiles(row: MLBPlayerPropRow, computed: MLBPropComputedAtLine) {
    val tiles = buildList {
        add(Triple("L10", computed.l10, "Over"))
        computed.contextualDayNight?.let {
            add(Triple(if (row.gameIsDay) "☀️ Day" else "🌙 Night", it, "Over"))
        }
        val arch = computed.contextualArchetype
        val archName = row.oppArchetypeToday
        if (arch != null && archName != null) {
            add(Triple("vs $archName SP", arch, "Starters"))
        }
    }
    // Three-column grid (pad the trailing row so tiles keep equal width).
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tiles.chunked(3).forEach { rowTiles ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                rowTiles.forEach { (label, split, subtitle) ->
                    ContextTile(label, split, subtitle, Modifier.weight(1f))
                }
                repeat(3 - rowTiles.size) { androidx.compose.foundation.layout.Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun ContextTile(label: String, split: MLBPropHitSplit, subtitle: String, modifier: Modifier) {
    val shape = RoundedCornerShape(10.dp)
    Column(
        modifier
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.6f), shape)
            .border(1.dp, AppColors.appBorder, shape)
            .padding(10.dp)
            .alpha(if (split.lowConfidence) 0.75f else 1f),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(label.uppercase(), color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        Text(split.fractionLabel, color = AppColors.appPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
        Text("$subtitle · ${split.pctLabel}", color = AppColors.appTextMuted, fontSize = 10.sp, maxLines = 1)
    }
}
