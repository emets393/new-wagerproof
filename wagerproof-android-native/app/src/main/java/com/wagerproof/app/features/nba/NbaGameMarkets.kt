package com.wagerproof.app.features.nba

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.components.WidgetCollapsingSection
import com.wagerproof.core.design.components.EdgeScale
import com.wagerproof.core.design.components.PickSignalPillModel
import com.wagerproof.core.design.components.PickSignalsSection
import com.wagerproof.core.design.components.SpreadCoverBar
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.BasketballSignalMarket
import com.wagerproof.core.models.NBAFirstHalfMarket
import com.wagerproof.core.models.NBASlateSignal

@Composable
fun NbaFirstHalfSection(
    markets: List<NBAFirstHalfMarket>,
    signals: List<NBASlateSignal> = emptyList(),
    homeName: String = "",
    awayName: String = "",
) {
    if (markets.isEmpty()) return
    WidgetCollapsingSection("First half", icon = AppIcon.fromSystemName("timer"), iconTint = AppColors.appPrimary) {
        Column(verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp)) {
            markets.forEach { market ->
                Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Row(Modifier.fillMaxWidth()) {
                        Text(market.title, color = AppColors.appTextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp, modifier = Modifier.weight(1f))
                        market.tier?.let { Text(it.uppercase(), color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                    }
                    val pick = if (market.id == "h1_spread") spreadPick(market) else null
                    if (pick != null) {
                        SpreadCoverBar(
                            line = pick.line,
                            modelMargin = pick.modelMargin,
                            scale = EdgeScale.nba,
                            pickAbbrev = pick.pick,
                            opponentAbbrev = pick.opponent,
                            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                        )
                    } else {
                        Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
                            Number("Model", market.modelNumber, false, false, Modifier.weight(1f))
                            Number("Market", market.marketNumber, false, true, Modifier.weight(1f))
                        }
                    }
                    if (market.trackingOnly) {
                        Text("Tracking only. The first-half total is never a bet.", color = AppColors.appTextSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                    }
                    val modelNumber = market.modelNumber
                    val marketNumber = market.marketNumber
                    val likesOver = if (market.id == "h1_total" && modelNumber != null && marketNumber != null) {
                        modelNumber > marketNumber
                    } else null
                    val likesHome = if (market.id == "h1_spread") spreadPick(market)?.let { it.pick == market.homeAbbr } else null
                    NbaMarketSignals(
                        signals = signals.filter { it.market == market.id },
                        market = market.id,
                        modelLikesHome = likesHome,
                        modelLikesOver = likesOver,
                        homeName = homeName,
                        awayName = awayName,
                        homeAbbr = market.homeAbbr.orEmpty(),
                        awayAbbr = market.awayAbbr.orEmpty(),
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NbaMarketSignals(
    signals: List<NBASlateSignal>,
    market: String,
    modelLikesHome: Boolean? = null,
    modelLikesOver: Boolean? = null,
    homeName: String = "",
    awayName: String = "",
    homeAbbr: String = "",
    awayAbbr: String = "",
) {
    if (signals.isEmpty()) return
    val ordered = remember(signals, market, modelLikesHome, modelLikesOver, homeName, awayName, homeAbbr, awayAbbr) {
        BasketballSignalMarket.supportingFirst(signals) { signal ->
            BasketballSignalMarket.contradicts(
                side = signal.side,
                market = market,
                modelLikesHome = modelLikesHome,
                modelLikesOver = modelLikesOver,
                homeName = homeName,
                awayName = awayName,
                homeAbbr = homeAbbr,
                awayAbbr = awayAbbr,
            )
        }
    }
    var selected by remember { mutableStateOf<NBASlateSignal?>(null) }
    PickSignalsSection(
        signals = ordered.map { signal ->
            PickSignalPillModel(
                id = signal.id,
                title = signal.title,
                contradicts = BasketballSignalMarket.contradicts(
                    side = signal.side,
                    market = market,
                    modelLikesHome = modelLikesHome,
                    modelLikesOver = modelLikesOver,
                    homeName = homeName,
                    awayName = awayName,
                    homeAbbr = homeAbbr,
                    awayAbbr = awayAbbr,
                ),
            )
        },
        onSelect = { pill -> selected = ordered.firstOrNull { it.id == pill.id } },
    )
    selected?.let { signal ->
        ModalBottomSheet(onDismissRequest = { selected = null }, sheetState = rememberModalBottomSheetState()) {
            Column(Modifier.padding(16.dp)) {
                Text(signal.title, color = AppColors.appTextPrimary, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                signal.side?.let { Text(it, color = AppColors.appTextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp)) }
                signal.definition?.let { Text(it, color = AppColors.appTextSecondary, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp)) }
                Text("BACK-TEST", color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
                Text(signal.recordText ?: "—", color = AppColors.appTextPrimary, fontSize = 13.sp)
                Text("THIS SEASON", color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 10.dp))
                Text(signal.seasonRecordText ?: "—", color = AppColors.appTextPrimary, fontSize = 13.sp, modifier = Modifier.padding(bottom = 24.dp))
            }
        }
    }
}

private data class SpreadPick(val line: Double, val modelMargin: Double, val pick: String, val opponent: String)

/** Same orientation as the full-game cover bar: line and margin are the picked team's. */
private fun spreadPick(market: NBAFirstHalfMarket): SpreadPick? {
    val modelHome = market.modelNumber ?: return null
    val marketHome = market.marketNumber ?: return null
    val home = market.homeAbbr ?: return null
    val away = market.awayAbbr ?: return null
    val pickIsHome = (marketHome - modelHome) > 0
    val line = if (pickIsHome) marketHome else -marketHome
    val modelSpread = if (pickIsHome) modelHome else -modelHome
    return SpreadPick(line, -modelSpread, if (pickIsHome) home else away, if (pickIsHome) away else home)
}

@Composable
private fun Number(label: String, value: Double?, signed: Boolean, accent: Boolean, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(label, color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        val text = when {
            value == null -> "—"
            signed -> String.format("%+.1f", value)
            else -> String.format("%.1f", value)
        }
        Text(text, color = if (accent) Color(0xFF0EA5E9) else AppColors.appTextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
    }
}
