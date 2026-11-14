package com.wagerproof.app.features.ncaab

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.wagerproof.app.features.components.WidgetCollapsingSection
import com.wagerproof.app.features.games.GameConsensusKey
import com.wagerproof.app.features.gamewidgets.AgentConsensusSection
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NCAABGame
import com.wagerproof.core.stores.GamesStore

private val better = Color(0xFF059669)
private val worse = AppColors.appTextMuted
private val loss = Color(0xFFDC2626)

fun LazyListScope.ncaabWiredItems(
    game: NCAABGame,
    store: NCAABGameDetailStore,
    awayAbbr: String,
    homeAbbr: String,
    onShowCatalog: () -> Unit,
) {
    val board = store.board
    when {
        store.failed -> item { NoteCard("College board", "Couldn’t load this game’s college board.") }
        board == null -> item { NoteCard("College board", "Loading the board…") }
        else -> {
            item { ModelCard("Full game", board.fullGame) }
            item { ModelCard("First half", board.firstHalf) }
            item { SignalsCard(board, onShowCatalog) }
            item {
                MarketsCard(
                    "Head to head",
                    "Season records. Series records are from the home side when that meeting is on file.",
                    board,
                    awayAbbr,
                    homeAbbr,
                    chips = false,
                )
            }
            item {
                MarketsCard(
                    "Last 5",
                    "Newest first. Opening week still shows last season.",
                    board,
                    awayAbbr,
                    homeAbbr,
                    chips = true,
                )
            }
            item { RatingsCard(board, awayAbbr, homeAbbr) }
            item { ThrillCard(board) }
        }
    }
    item {
        AgentConsensusSection(
            sport = GamesStore.Sport.ncaab,
            gameId = GameConsensusKey.of(game),
            gameDate = game.gameDate,
        )
    }
    if (board?.earlySeason == true) {
        item { NoteCard("Early season", NCAABCopy.earlyNote) }
    }
}

@Composable
fun NCAABSignalsIndexDialog(rows: List<NcaabCatalogLine>, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(16.dp)
                .background(AppColors.appSurface, RoundedCornerShape(20.dp))
                .padding(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("College signals", color = AppColors.appTextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                TextButton(onClick = onDismiss) { Text("Done") }
            }
            Text(
                "Every college basketball read, with its back-test and this season.",
                color = AppColors.appTextSecondary,
                fontSize = 14.sp,
            )
            LazyColumn(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (rows.isEmpty()) {
                    item { Text("No signals are on file yet.", color = AppColors.appTextSecondary, fontSize = 14.sp) }
                }
                items(rows.size) { index ->
                    val row = rows[index]
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .background(AppColors.appTextPrimary.copy(alpha = 0.04f), RoundedCornerShape(16.dp))
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Row(verticalAlignment = Alignment.Top) {
                            Text(row.name, color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                            Text(
                                if (row.active) "ACTIVE" else "TRACKING",
                                color = if (row.active) Color.White else AppColors.appTextSecondary,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier
                                    .background(if (row.active) better else AppColors.appTextPrimary.copy(alpha = 0.08f), CircleShape)
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                            )
                        }
                        if (row.market.isNotBlank()) {
                            Text(row.market.uppercase(), color = AppColors.appTextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        }
                        if (row.oneLiner.isNotBlank()) Text(row.oneLiner, color = AppColors.appTextPrimary, fontSize = 14.sp)
                        if (row.record.isNotBlank()) Text(row.record, color = AppColors.appTextSecondary, fontSize = 12.sp)
                        if (row.seasonRecord.isNotBlank()) Text(row.seasonRecord, color = AppColors.appTextSecondary, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun ModelCard(title: String, lines: List<NcaabModelLine>) {
    WidgetCollapsingSection(title, icon = AppIcon.fromSystemName("sportscourt"), iconTint = AppColors.appPrimary) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            lines.forEach { line ->
                Column(
                    Modifier
                        .fillMaxWidth()
                        .background(AppColors.appTextPrimary.copy(alpha = 0.04f), RoundedCornerShape(12.dp))
                        .padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(line.label.uppercase(), color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        if (line.play) PlayBadge()
                    }
                    Row {
                        Labeled("Model", line.model, Modifier.weight(1f))
                        Labeled("Line", line.posted, Modifier.weight(1f))
                    }
                    if (line.disagreement.isNotBlank()) {
                        Text(line.disagreement, color = AppColors.appTextSecondary, fontSize = 12.sp)
                    }
                    line.betSide?.let { Text(it, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold) }
                }
            }
        }
    }
}

@Composable
private fun SignalsCard(board: NCAABDetailBoard, onShowCatalog: () -> Unit) {
    WidgetCollapsingSection(title = "Signals", icon = AppIcon.fromSystemName("flag.fill"), iconTint = AppColors.appPrimary) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            TextButton(onClick = onShowCatalog, modifier = Modifier.align(Alignment.End)) { Text("All signals") }
            if (board.signals.isEmpty()) {
                Text("No signals on this game.", color = AppColors.appTextSecondary, fontSize = 14.sp)
            }
            board.signals.forEach { signal ->
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Row(verticalAlignment = Alignment.Top) {
                        Column(Modifier.weight(1f)) {
                            Text(signal.name, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            if (signal.side.isNotBlank()) Text(signal.side, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                        }
                        if (signal.play) PlayBadge()
                    }
                    if (signal.trigger.isNotBlank()) Text(signal.trigger, color = AppColors.appTextSecondary, fontSize = 12.sp)
                    if (signal.record.isNotBlank()) Text(signal.record, color = AppColors.appTextMuted, fontSize = 11.sp)
                    if (signal.seasonRecord.isNotBlank()) Text(signal.seasonRecord, color = AppColors.appTextMuted, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun MarketsCard(
    title: String,
    caption: String,
    board: NCAABDetailBoard,
    awayAbbr: String,
    homeAbbr: String,
    chips: Boolean,
) {
    WidgetCollapsingSection(title, icon = AppIcon.fromSystemName("chart.bar.xaxis"), iconTint = AppColors.appPrimary) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(caption, color = AppColors.appTextSecondary, fontSize = 12.sp)
            board.markets.forEach { market ->
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(market.label.uppercase(), color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TeamTrend(awayAbbr, market.awayRecord, market.awayChips, chips, Modifier.weight(1f))
                        TeamTrend(homeAbbr, market.homeRecord, market.homeChips, chips, Modifier.weight(1f))
                    }
                    if (!chips) Text(market.series, color = AppColors.appTextSecondary, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun TeamTrend(abbr: String, record: String, chips: List<String>, showChips: Boolean, modifier: Modifier) {
    Column(
        modifier
            .background(AppColors.appTextPrimary.copy(alpha = 0.04f), RoundedCornerShape(12.dp))
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(abbr, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            if (!showChips) {
                Text(record, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
            }
        }
        if (showChips) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                if (chips.isEmpty()) {
                    Text("No L5", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                } else {
                    Text("L${chips.take(5).size}", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    chips.take(5).forEach { chip ->
                        Text(
                            chip.take(1).uppercase(),
                            color = Color.White,
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier
                                .size(17.dp)
                                .background(chipColor(chip), CircleShape)
                                .padding(top = 2.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RatingsCard(board: NCAABDetailBoard, awayAbbr: String, homeAbbr: String) {
    WidgetCollapsingSection("Ratings", icon = AppIcon.fromSystemName("chart.bar.fill"), iconTint = AppColors.appPrimary) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(awayAbbr, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                Text("at", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.weight(1f))
                Text(homeAbbr, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
            if (board.awayRecord != null || board.homeRecord != null) {
                RatingRow("Record", board.awayRecord ?: "—", board.homeRecord ?: "—", null)
            }
            board.ratings.forEach { row -> RatingRow(row.label, row.away, row.home, row.better) }
        }
    }
}

@Composable
private fun RatingRow(label: String, away: String, home: String, betterSide: String?) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(away, color = sideColor(betterSide, "away"), fontSize = 13.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.weight(1f))
        Text(label.uppercase(), color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        Text(home, color = sideColor(betterSide, "home"), fontSize = 13.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.End)
    }
}

@Composable
private fun ThrillCard(board: NCAABDetailBoard) {
    WidgetCollapsingSection("Thrill score", icon = AppIcon.fromSystemName("sparkles"), iconTint = AppColors.appPrimary) {
        if (board.thrillScore != null) {
            Column {
                Text(board.thrillScore, color = AppColors.appTextPrimary, fontSize = 36.sp, fontWeight = FontWeight.Bold)
                if (board.thrillDetail.isNotBlank()) {
                    Text(board.thrillDetail, color = AppColors.appTextSecondary, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp))
                }
            }
        } else {
            Text(NCAABCopy.thrillEmpty, color = AppColors.appTextSecondary, fontSize = 14.sp)
        }
    }
}

@Composable
private fun NoteCard(title: String, text: String) {
    WidgetCollapsingSection(title, icon = AppIcon.fromSystemName("info.circle"), iconTint = AppColors.appPrimary) {
        Text(text, color = AppColors.appTextSecondary, fontSize = 14.sp)
    }
}

@Composable
private fun Labeled(title: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(title.uppercase(), color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        Text(value, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun PlayBadge() {
    Text(
        "PLAY",
        color = Color.White,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.background(better, CircleShape).padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

private fun sideColor(betterSide: String?, side: String): Color = when {
    betterSide == null -> AppColors.appTextPrimary
    betterSide == side -> better
    else -> worse
}

private fun chipColor(raw: String): Color = when (raw.uppercase().take(1)) {
    "W", "O", "C" -> better
    "L", "U" -> loss
    else -> AppColors.appTextMuted
}
