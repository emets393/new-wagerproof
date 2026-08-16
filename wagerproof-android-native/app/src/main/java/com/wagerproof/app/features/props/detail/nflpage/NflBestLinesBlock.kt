package com.wagerproof.app.features.props.detail.nflpage

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.BestBookChip
import com.wagerproof.app.features.props.SportsbookLogo
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NFLPlayerProps
import com.wagerproof.core.models.NFLPropBestQuote
import com.wagerproof.core.models.NFLPropMarket
import com.wagerproof.core.models.SportsbookMarketQuotes
import com.wagerproof.core.services.SportsbookPropMarketOdds
import com.wagerproof.core.stores.SportsbookPreferenceStore

/**
 * Best Lines widget body — the cross-book board rows extracted from the
 * pre-redesign `NflPropDetailScreen`. Live `nfl_player_props` boards win;
 * the loader's precomputed best-shop quotes are the fallback.
 */
@Composable
fun NflBestLinesBlock(market: NFLPropMarket, live: SportsbookPropMarketOdds?) {
    if (live != null) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (market.isYesNo) {
                LiveBookRow("Yes", live.over, market)
            } else {
                LiveBookRow("Over", live.over, market)
                LiveBookRow("Under", live.under, market)
            }
        }
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (market.isYesNo) {
            if (!market.bestOver.isEmpty) BestBookRow("Yes", market.bestOver, showLine = false)
        } else {
            if (!market.bestOver.isEmpty) BestBookRow("Over", market.bestOver, showLine = true)
            if (!market.bestUnder.isEmpty) BestBookRow("Under", market.bestUnder, showLine = true)
        }
    }
}

@Composable
private fun LiveBookRow(sideLabel: String, quotes: SportsbookMarketQuotes, market: NFLPropMarket) {
    if (quotes.best == null) return
    val shape = RoundedCornerShape(12.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.35f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.45f), shape)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(sideLabel, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Black)
        Spacer(Modifier.weight(1f))
        BestBookChip(
            quotes = quotes,
            selectedBookKeys = SportsbookPreferenceStore.selectedKeys,
            marketTitle = market.label,
            selectionTitle = "$sideLabel ${market.label}",
            formatLine = { NFLPlayerProps.formatLine(it) },
        )
    }
}

@Composable
private fun BestBookRow(sideLabel: String, quote: NFLPropBestQuote, showLine: Boolean) {
    val shape = RoundedCornerShape(12.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.35f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.45f), shape)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(sideLabel, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Black)
            Text(
                bestBookLineValue(quote, showLine),
                color = AppColors.appPrimary, fontSize = 14.sp,
                fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace,
            )
        }
        Spacer(Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("@", color = AppColors.appTextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            SportsbookLogo(quote.bookLogoUrl, quote.bookKey, quote.bookName)
            Text(
                quote.bookName ?: quote.bookKey ?: "Book",
                color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1,
            )
        }
    }
}

private fun bestBookLineValue(quote: NFLPropBestQuote, showLine: Boolean): String {
    val odds = NFLPlayerProps.formatOdds(quote.price)
    val line = quote.line
    return if (showLine && line != null) "${NFLPlayerProps.formatLine(line)} $odds" else odds
}
