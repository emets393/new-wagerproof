package com.wagerproof.app.features.chat

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.background
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
import com.wagerproof.core.models.WagerBotChatGameCard

/**
 * Port of iOS `WagerBotSuggestedGamesCarousel.swift`. Horizontal carousel of
 * 260dp mini game cards from a `gameCards` block (held until stream end by the
 * bubble). Tapping a card fires [onTap].
 */
@Composable
fun WagerBotSuggestedGamesCarousel(
    cards: List<WagerBotChatGameCard>,
    ui: WagerBotUiTokens,
    modifier: Modifier = Modifier,
    onTap: ((WagerBotChatGameCard) -> Unit)? = null,
) {
    LazyRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 4.dp, vertical = 4.dp),
    ) {
        items(count = cards.size) { idx ->
            val card = cards[idx]
            MiniCard(card, ui, modifier = Modifier.width(260.dp).then(
                if (onTap != null) Modifier.clickable { onTap(card) } else Modifier,
            ))
        }
    }
}

@Composable
private fun MiniCard(card: WagerBotChatGameCard, ui: WagerBotUiTokens, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        modifier = modifier
            .clip(shape)
            .background(ui.hintChipBackground)
            .border(1.dp, ui.borderColor, shape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Top row: sport badge + game time.
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = card.sport.uppercase(),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = ui.accent,
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(ui.accent.copy(alpha = 0.15f))
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            )
            Spacer(Modifier.weight(1f))
            Text(card.gameTime, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = ui.mutedText)
        }

        // Matchup rows.
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            TeamRow(card.awayAbbr, card.awaySpread, ui)
            TeamRow(card.homeAbbr, card.homeSpread, ui)
        }

        // Model pick row when present.
        card.spreadPick?.takeIf { it.isNotEmpty() }?.let { pick ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                WagerBotIcon(size = 12.dp, tint = ui.accent)
                Text("Model: $pick", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = ui.mutedText, maxLines = 1)
            }
        }
    }
}

@Composable
private fun TeamRow(abbr: String, spread: Double?, ui: WagerBotUiTokens) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(abbr, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = ui.primaryText)
        Spacer(Modifier.weight(1f))
        spread?.let {
            Text(
                text = if (it > 0) "+${formatNumber(it)}" else formatNumber(it),
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                fontFamily = FontFamily.Monospace,
                color = ui.mutedText,
            )
        }
    }
}

private fun formatNumber(value: Double): String =
    if (value % 1.0 == 0.0) value.toInt().toString() else String.format("%.1f", value)
