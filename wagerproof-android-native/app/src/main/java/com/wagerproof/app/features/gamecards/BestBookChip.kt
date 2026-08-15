package com.wagerproof.app.features.gamecards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.SportsbookMarketQuotes
import com.wagerproof.core.models.SportsbookQuote
import java.time.Duration
import java.time.Instant

/**
 * Port of iOS `BestBookChip` / `SportsbookLinesSheet`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BestBookChip(
    quotes: SportsbookMarketQuotes,
    selectedBookKeys: Set<String>,
    marketTitle: String,
    selectionTitle: String,
    formatLine: (Double) -> String,
    modifier: Modifier = Modifier,
) {
    val shown = quotes.preferred(selectedBookKeys) ?: return
    val fromSelection = quotes.isFromSelection(selectedBookKeys)
    var showingBoard by remember { mutableStateOf(false) }
    val label = when {
        selectedBookKeys.isEmpty() -> "BEST LINE"
        fromSelection && selectedBookKeys.size == 1 -> "YOUR BOOK"
        fromSelection -> "YOUR BOOKS"
        else -> "NOT AT YOUR BOOKS"
    }

    Row(
        modifier
            .clip(CircleShape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.65f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.45f), CircleShape)
            .clickable { showingBoard = true }
            .padding(horizontal = 10.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        SportsbookLogoView(shown.bookKey, null, SportsbookLogoStyle.COMPACT)
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(label, color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Black)
            Text(
                priceLabel(shown, formatLine),
                color = AppColors.appTextPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
            )
        }
        Text("▾", color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Black)
    }

    if (showingBoard) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
        ModalBottomSheet(
            onDismissRequest = { showingBoard = false },
            sheetState = sheetState,
            containerColor = AppColors.appSurface,
        ) {
            SportsbookLinesSheet(
                quotes = quotes,
                selectedBookKeys = selectedBookKeys,
                marketTitle = marketTitle,
                selectionTitle = selectionTitle,
                formatLine = formatLine,
            )
        }
    }
}

@Composable
private fun SportsbookLinesSheet(
    quotes: SportsbookMarketQuotes,
    selectedBookKeys: Set<String>,
    marketTitle: String,
    selectionTitle: String,
    formatLine: (Double) -> String,
) {
    val mine = quotes.quotes.filter { it.bookKey in selectedBookKeys }
    val others = quotes.quotes.filter { it.bookKey !in selectedBookKeys }
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(marketTitle, color = AppColors.appTextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
        Spacer(Modifier.padding(6.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(0.dp)) {
            if (mine.isNotEmpty()) {
                item { SectionHeader("Your books") }
                items(mine, key = { it.bookKey }) { quote ->
                    QuoteRow(quote, quotes, selectedBookKeys, formatLine)
                }
            }
            item { SectionHeader(if (mine.isEmpty()) selectionTitle else "Everywhere else") }
            items(others, key = { it.bookKey }) { quote ->
                QuoteRow(quote, quotes, selectedBookKeys, formatLine)
            }
            item {
                Text(
                    capturedLabel(quotes.capturedAt),
                    color = AppColors.appTextMuted,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(vertical = 12.dp),
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        title.uppercase(),
        color = AppColors.appTextSecondary,
        fontSize = 11.sp,
        fontWeight = FontWeight.Black,
        modifier = Modifier.padding(top = 10.dp, bottom = 6.dp),
    )
}

@Composable
private fun QuoteRow(
    quote: SportsbookQuote,
    quotes: SportsbookMarketQuotes,
    selectedBookKeys: Set<String>,
    formatLine: (Double) -> String,
) {
    val isBest = quote.bookKey == quotes.best?.bookKey
    val isPinned = quote.bookKey in selectedBookKeys
    Row(
        Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SportsbookLogoView(quote.bookKey, null, SportsbookLogoStyle.COMPACT)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(quote.bookName, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            if (isPinned || isBest) {
                Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    if (isPinned) Tag("YOURS", AppColors.appAccentBlue)
                    if (isBest) Tag("BEST", AppColors.appPrimary)
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            quote.line?.let {
                Text(
                    formatLine(it),
                    color = if (isBest) AppColors.appPrimary else AppColors.appTextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                )
            }
            quote.price?.let {
                Text(
                    GameCardFormatting.formatMoneyline(it),
                    color = AppColors.appTextSecondary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                )
            }
        }
    }
}

@Composable
private fun Tag(text: String, tint: Color) {
    Text(
        text,
        color = tint,
        fontSize = 8.sp,
        fontWeight = FontWeight.Black,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(tint.copy(alpha = 0.14f))
            .padding(horizontal = 5.dp, vertical = 2.dp),
    )
}

private fun priceLabel(quote: SportsbookQuote, formatLine: (Double) -> String): String {
    val line = quote.line?.let(formatLine)
    val price = quote.price?.let { GameCardFormatting.formatMoneyline(it) }
    return listOfNotNull(line, price).joinToString("  ")
}

private fun capturedLabel(capturedAt: String?): String {
    if (capturedAt.isNullOrEmpty()) return "Confirm the number at the book before betting."
    val instant = runCatching { Instant.parse(capturedAt) }.getOrNull()
        ?: return "Confirm the number at the book before betting."
    val minutes = Duration.between(instant, Instant.now()).toMinutes()
    val rel = when {
        minutes < 1 -> "just now"
        minutes < 60 -> "$minutes min ago"
        minutes < 60 * 24 -> "${minutes / 60} hr ago"
        else -> "${minutes / (60 * 24)} days ago"
    }
    return "Lines captured $rel. Confirm at the book before betting."
}
