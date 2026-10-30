package com.wagerproof.app.features.props

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.NBATeams
import com.wagerproof.app.features.gamecards.SportsbookLogoStyle
import com.wagerproof.app.features.gamecards.SportsbookLogoView
import com.wagerproof.app.features.shared.InitialsDisc
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NbaBookPrice
import com.wagerproof.core.models.NbaBookQuote
import com.wagerproof.core.models.NbaPickSide
import com.wagerproof.core.models.NbaPropDef
import com.wagerproof.core.models.NbaPropFeedFilters
import com.wagerproof.core.models.NbaPropListCard
import com.wagerproof.core.models.NbaPropGameOption
import com.wagerproof.core.models.NbaPropMarketOption
import com.wagerproof.core.models.NbaRecentBar
import com.wagerproof.core.models.NbaSlateProp
import com.wagerproof.core.models.SportsbookCatalog
import com.wagerproof.core.models.nbaAthleteNames
import com.wagerproof.core.models.nbaBestQuote
import com.wagerproof.core.models.nbaClearedCount
import com.wagerproof.core.models.nbaFilter
import com.wagerproof.core.models.nbaFormatAmerican
import com.wagerproof.core.models.nbaFormatNumber
import com.wagerproof.core.models.nbaLineMovement
import com.wagerproof.core.models.nbaPickLabel
import com.wagerproof.core.models.nbaPickSide
import com.wagerproof.core.models.nbaPlayerSignalCount
import com.wagerproof.core.models.nbaRecentForm
import com.wagerproof.core.models.nbaSignalLines
import com.wagerproof.core.models.nbaSignalSentence
import com.wagerproof.core.models.nbaSiblings
import com.wagerproof.core.services.NBAPropsService
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun NbaPropBoard(
    rows: List<NbaSlateProp>,
    defs: Map<String, NbaPropDef>,
    loading: Boolean,
    error: String?,
    filters: NbaPropFeedFilters,
    query: String,
    onSelect: (NbaSlateProp) -> Unit,
    modifier: Modifier = Modifier,
) {
    val names = remember(rows) { nbaAthleteNames(rows) }
    val visible = remember(rows, filters, query) { nbaFilter(rows, filters, query) }
    when {
        loading && rows.isEmpty() -> Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        error != null && rows.isEmpty() -> Text(error, color = AppColors.appTextSecondary, modifier = modifier.padding(16.dp))
        visible.isEmpty() -> {
            val searching = query.isNotBlank()
            Column(modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 36.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(AppIcon.CHART_BAR.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(28.dp))
                Text(if (searching) "No players match that search" else "No NBA props on the board", color = AppColors.appTextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                Text(
                    when {
                        searching -> "Try a different name or team."
                        filters.isActive -> "Nothing in this game, market, or signal filter."
                        else -> "Today and tomorrow are empty."
                    },
                    color = AppColors.appTextSecondary, fontSize = 13.sp,
                )
            }
        }
        else -> Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            visible.forEach { card ->
                val reasons = if (filters.market == null) {
                    nbaSiblings(rows, card.featured).flatMap { nbaSignalLines(it, defs, names) }.distinct()
                } else {
                    nbaSignalLines(card.featured, defs, names)
                }
                NbaPropCard(card, defs, nbaPlayerSignalCount(rows, card.featured), reasons) { onSelect(card.featured) }
            }
        }
    }
}

@Composable
private fun NbaPropCard(
    card: NbaPropListCard,
    defs: Map<String, NbaPropDef>,
    signalCount: Int,
    reasons: List<String>,
    onClick: () -> Unit,
) {
    val row = card.chart
    val form = remember(row) { nbaRecentForm(row) }
    val highlighted = card.highlighted
    val matchup = if (!row.team.isNullOrBlank() && !row.opponent.isNullOrBlank()) "${row.team} vs ${row.opponent}" else row.game.orEmpty()
    Column(
        Modifier
            .padding(horizontal = 12.dp)
            .fillMaxWidth()
            .alpha(if (row.isOut) 0.5f else 1f)
            .background(AppColors.appSurfaceElevated, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            NbaHeadshot(row.playerName, row.headshotUrl, row.position, 40.dp)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(row.playerName ?: "Player", color = AppColors.appTextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(listOfNotNull(row.position, matchup).filter { it.isNotBlank() }.joinToString(" · "), color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Text(
                nbaPickLabel(card.featured, defs),
                color = if (highlighted) Color(0xFFB45309) else AppColors.appTextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                maxLines = 1,
                modifier = Modifier
                    .background(if (highlighted) Color(0xFFF59E0B).copy(alpha = 0.18f) else AppColors.appSurfaceMuted, RoundedCornerShape(8.dp))
                    .then(if (highlighted) Modifier.border(1.dp, Color(0xFFF59E0B).copy(alpha = 0.45f), RoundedCornerShape(8.dp)) else Modifier)
                    .padding(horizontal = 8.dp, vertical = 5.dp),
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                if (form.bars.isEmpty()) Box(Modifier.size(width = 36.dp, height = 10.dp).background(AppColors.appSurfaceMuted, RoundedCornerShape(1.dp)))
                form.bars.forEach { bar ->
                    Box(Modifier.size(4.dp, 10.dp).background(if (bar.cleared) AppColors.appPrimary else AppColors.appTextMuted.copy(alpha = 0.45f), RoundedCornerShape(1.dp)))
                }
            }
            Text(if (form.games > 0) "${form.hits}/${form.games}" else "—", color = AppColors.appPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            if (signalCount > 0) {
                Row(
                    Modifier.background(Color(0xFFF59E0B).copy(alpha = 0.18f), RoundedCornerShape(6.dp)).padding(horizontal = 7.dp, vertical = 3.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    Icon(AppIcon.BOLT_FILL.imageVector, null, tint = Color(0xFFB45309), modifier = Modifier.size(12.dp))
                    Text("$signalCount Signal${if (signalCount == 1) "" else "s"}", color = Color(0xFFB45309), fontWeight = FontWeight.Black, fontSize = 11.sp)
                }
            }
            if (row.isOut) Text("OUT", color = AppColors.appTextMuted, fontWeight = FontWeight.Bold, fontSize = 10.sp)
        }
        reasons.forEach { reason ->
            Text(reason, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
fun NbaPropDetailScreen(row: NbaSlateProp, rows: List<NbaSlateProp>, defs: Map<String, NbaPropDef>, onMarket: (NbaSlateProp) -> Unit, onBack: () -> Unit) {
    var books by remember(row.id) { mutableStateOf<List<NbaBookQuote>>(emptyList()) }
    var history by remember(row.id) { mutableStateOf<List<NbaBookQuote>>(emptyList()) }
    var booksLoading by remember(row.id) { mutableStateOf(true) }
    LaunchedEffect(row.id) {
        booksLoading = true
        val loaded = NBAPropsService.books(row)
        books = loaded.first
        history = loaded.second
        booksLoading = false
    }
    val names = remember(rows) { nbaAthleteNames(rows) }
    val siblings = remember(rows, row.id) { nbaSiblings(rows, row) }
    val form = remember(row) { nbaRecentForm(row) }
    val last5 = remember(row) { nbaRecentForm(row, 5) }
    val side = nbaPickSide(row, defs)
    val lineText = nbaFormatNumber(row.line)
    val market = row.marketLabel ?: row.market ?: "Prop"
    val bestOver = nbaBestQuote(books, NbaPickSide.OVER)
    val bestUnder = nbaBestQuote(books, NbaPickSide.UNDER)
    val hero = if (side == NbaPickSide.UNDER) bestUnder else if (side == NbaPickSide.OVER) bestOver else null
    val heroPrice = hero?.price ?: if (side == NbaPickSide.UNDER) row.underPrice else if (side == NbaPickSide.OVER) row.overPrice else null
    LazyColumn(Modifier.fillMaxSize().background(AppColors.appSurface).alpha(if (row.isOut) 0.6f else 1f), contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(AppIcon.CHEVRON_LEFT.imageVector, "Back", tint = AppColors.appPrimary, modifier = Modifier.size(28.dp).clickable(onClick = onBack))
                Spacer(Modifier.width(8.dp))
                NbaHeadshot(row.playerName, row.headshotUrl, row.position, 56.dp)
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(row.playerName ?: "Player", color = AppColors.appTextPrimary, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                    Text(listOfNotNull(row.position, if (!row.team.isNullOrBlank() && !row.opponent.isNullOrBlank()) "${row.team} vs ${row.opponent}" else row.game, tipLabel(row.commenceTime)).filter { !it.isNullOrBlank() }.joinToString(" · "), color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    if (row.isOut) Text("Out", color = AppColors.appTextMuted, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
        }
        if (siblings.size > 1) {
            item {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    siblings.forEach { sibling ->
                        val active = sibling.id == row.id
                        Text(
                            "${sibling.marketLabel ?: sibling.market ?: "Prop"} ${nbaFormatNumber(sibling.line)}",
                            color = if (active) Color.White else AppColors.appTextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(if (active) AppColors.appPrimary else AppColors.appSurfaceElevated)
                                .clickable { onMarket(sibling) }
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                        )
                    }
                }
            }
        }
        item {
            Text(market.uppercase(), color = AppColors.appTextMuted, fontWeight = FontWeight.Bold, fontSize = 11.sp)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(if (side == null) lineText else "${if (side == NbaPickSide.OVER) "Over" else "Under"} $lineText", color = AppColors.appPrimary, fontWeight = FontWeight.Black, fontSize = 32.sp)
                if (side != null) {
                    Spacer(Modifier.width(10.dp))
                    NbaBookMark(hero?.book)
                    Spacer(Modifier.width(4.dp))
                    Text(nbaFormatAmerican(heroPrice), color = AppColors.appTextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PricePill("Over", lineText, bestOver?.price ?: row.overPrice, bestOver?.book, side != NbaPickSide.UNDER)
                PricePill("Under", lineText, bestUnder?.price ?: row.underPrice, bestUnder?.book, side == NbaPickSide.UNDER)
            }
        }
        items(row.flagKeys()) { key -> SignalCard(key, row, defs, names) }
        item {
            Text(form.pct?.let { "${kotlin.math.round(it).toInt()}%" } ?: "—", color = AppColors.appPrimary, fontWeight = FontWeight.Black, fontSize = 32.sp)
            Text(if (form.games > 0) "Cleared the line · ${form.hits}/${form.games} last ${form.games}" else "Cleared the line", color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
        item {
            if (row.line == null) Text("No line posted", color = AppColors.appTextMuted, fontSize = 13.sp)
            else if (form.bars.isEmpty()) Text("No recent games logged.", color = AppColors.appTextMuted, fontSize = 13.sp)
            else RecentChart(form.bars, row.line ?: 0.0)
        }
        item { ShopCard(books, booksLoading, bestOver, bestUnder) }
        item { MovementCard(history, booksLoading, row.openLine, row.line) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FormStat("Last 5 games", market, row.l5Avg, if (last5.games > 0) last5.hits else null, if (last5.games > 0) last5.games else null, lineText, Modifier.weight(1f))
                FormStat("Last 10 games", market, row.l10Avg, if (form.games > 0) form.hits else null, if (form.games > 0) form.games else null, lineText, Modifier.weight(1f))
                FormStat("This season", market, row.sznAvg, nbaClearedCount(row.overRateSzn, row.gpPrior), row.gpPrior?.toInt(), lineText, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun SignalCard(key: String, row: NbaSlateProp, defs: Map<String, NbaPropDef>, names: Map<String, String>) {
    val def = defs[key]
    val specific = nbaSignalSentence(key, row.flagDetail) { names[it] }
    Column(Modifier.fillMaxWidth().background(AppColors.appPrimary.copy(alpha = 0.08f), RoundedCornerShape(16.dp)).padding(12.dp)) {
        Text(def?.displayName ?: key, color = AppColors.appTextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        def?.oneLiner?.takeIf { it.isNotBlank() }?.let { Text(it, color = AppColors.appTextPrimary, fontSize = 13.sp) }
        if (specific != null && specific != def?.oneLiner?.trim()) Text(specific, color = AppColors.appTextPrimary, fontSize = 13.sp)
        def?.definition?.takeIf { it.isNotBlank() && it != def.oneLiner }?.let { Text(it, color = AppColors.appTextSecondary, fontSize = 12.sp) }
        def?.whyItWorks?.takeIf { it.isNotBlank() && it != def.definition && it != def.oneLiner }?.let { Text(it, color = AppColors.appTextSecondary, fontSize = 12.sp) }
        listOfNotNull(def?.seasonRecordText, def?.recordText).filter { it.isNotBlank() }.takeIf { it.isNotEmpty() }?.let {
            Text(it.joinToString(" · "), color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun PricePill(label: String, line: String, price: Double?, book: String?, emphasis: Boolean) {
    Row(
        Modifier.background(if (emphasis) AppColors.appPrimary.copy(alpha = 0.12f) else AppColors.appSurfaceMuted, RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        NbaBookMark(book)
        Text("$label $line", color = if (emphasis) AppColors.appTextPrimary else AppColors.appTextSecondary, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
        Text(nbaFormatAmerican(price), color = if (emphasis) AppColors.appPrimary else AppColors.appTextPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
    }
}

@Composable
private fun ShopCard(books: List<NbaBookQuote>, loading: Boolean, bestOver: NbaBookPrice?, bestUnder: NbaBookPrice?) {
    Column(Modifier.fillMaxWidth().background(AppColors.appSurfaceElevated, RoundedCornerShape(16.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("SHOP THE LINE", color = AppColors.appTextMuted, fontWeight = FontWeight.Bold, fontSize = 11.sp)
        when {
            loading -> Text("Loading posted prices…", color = AppColors.appTextSecondary, fontSize = 12.sp)
            books.isEmpty() -> Text("No posted prices yet.", color = AppColors.appTextSecondary, fontSize = 12.sp)
            else -> books.sortedBy { it.bookmaker.orEmpty() }.forEach { quote ->
                val book = quote.bookmaker.orEmpty()
                val overBest = bestOver?.book == book && bestOver.price == quote.overOdds
                val underBest = bestUnder?.book == book && bestUnder.price == quote.underOdds
                val key = SportsbookCatalog.key(book) ?: book.lowercase()
                Row(verticalAlignment = Alignment.Top) {
                    SportsbookLogoView(key, null, SportsbookLogoStyle.REGULAR)
                    Spacer(Modifier.width(8.dp))
                    Column {
                        Text(SportsbookCatalog.name(key), color = AppColors.appTextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, maxLines = 1)
                        Text(
                            "${nbaFormatNumber(quote.line)}   O ${nbaFormatAmerican(quote.overOdds)}${if (overBest) " Best" else ""}   U ${nbaFormatAmerican(quote.underOdds)}${if (underBest) " Best" else ""}",
                            color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MovementCard(history: List<NbaBookQuote>, loading: Boolean, openLine: Double?, currentLine: Double?) {
    val summary = remember(history) { nbaLineMovement(history) }
    val openValue = summary.open?.line ?: openLine
    val currentValue = summary.current?.line ?: currentLine
    Column(Modifier.fillMaxWidth().background(AppColors.appSurfaceElevated, RoundedCornerShape(16.dp)).padding(12.dp)) {
        Text("LINE MOVEMENT", color = AppColors.appTextMuted, fontWeight = FontWeight.Bold, fontSize = 11.sp)
        Spacer(Modifier.height(8.dp))
        when {
            loading -> Text("Loading the line history…", color = AppColors.appTextSecondary, fontSize = 12.sp)
            openValue == null && currentValue == null -> Text("Not charted.", color = AppColors.appTextSecondary, fontSize = 12.sp)
            else -> {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Stamp("Opening", openValue)
                    summary.mid?.let { Stamp("Middle", it.line) }
                    Stamp("Current", currentValue)
                }
                MovementLine(
                    summary.moves.map { it.line }.ifEmpty { listOfNotNull(openValue, currentValue) },
                )
            }
        }
    }
}

@Composable
private fun MovementLine(lines: List<Double>) {
    if (lines.size < 2) return
    val minLine = lines.min()
    val maxLine = lines.max()
    val span = (maxLine - minLine).coerceAtLeast(0.5)
    Canvas(Modifier.fillMaxWidth().height(72.dp).padding(top = 8.dp)) {
        val path = Path()
        lines.forEachIndexed { index, line ->
            val x = size.width * index / (lines.size - 1)
            val y = size.height - ((line - minLine) / span).toFloat() * (size.height - 8f) - 4f
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(
            path,
            AppColors.appPrimary,
            style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
        )
    }
}

@Composable
private fun Stamp(title: String, value: Double?) {
    Column {
        Text(title.uppercase(), color = AppColors.appTextMuted, fontWeight = FontWeight.Bold, fontSize = 9.sp)
        Text(nbaFormatNumber(value), color = AppColors.appTextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
    }
}

@Composable
private fun RecentChart(bars: List<NbaRecentBar>, line: Double) {
    val peak = maxOf(bars.maxOf { it.value }, line)
    Row(Modifier.fillMaxWidth().height(150.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.Bottom) {
        bars.forEach { bar ->
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
                Text(nbaFormatNumber(bar.value), color = if (bar.cleared) AppColors.appPrimary else AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Box(Modifier.fillMaxWidth().height((bar.value / peak * 88).dp.coerceAtLeast(8.dp)).background(if (bar.cleared) AppColors.appPrimary else AppColors.appTextMuted.copy(alpha = 0.35f), RoundedCornerShape(3.dp)))
                RemoteImage(NBATeams.logoURL(bar.opponent.orEmpty()), bar.opponent, Modifier.size(16.dp).padding(top = 4.dp), ContentScale.Fit)
                Text(shortDate(bar.date), color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun FormStat(window: String, market: String, avg: Double?, hits: Int?, games: Int?, line: String, modifier: Modifier) {
    Column(modifier.background(AppColors.appSurfaceElevated, RoundedCornerShape(14.dp)).padding(8.dp)) {
        Text(window.uppercase(), color = AppColors.appTextMuted, fontWeight = FontWeight.Bold, fontSize = 9.sp, maxLines = 2)
        Text(if (avg == null) "—" else String.format("%.1f", avg), color = AppColors.appTextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Text("$market per game", color = AppColors.appTextSecondary, fontSize = 11.sp, maxLines = 2)
        if (hits != null && games != null && games > 0) Text("Over $line in $hits of $games", color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun NbaHeadshot(name: String?, url: String?, position: String?, size: Dp) {
    val initials = (name ?: position ?: "NBA").split(" ").mapNotNull { it.firstOrNull() }.take(2).joinToString("").uppercase()
    Box(Modifier.size(size).clip(CircleShape), contentAlignment = Alignment.Center) {
        RemoteImage(url, name, Modifier.size(size), ContentScale.Crop, loading = { InitialsDisc(initials, size) }, error = { InitialsDisc(initials, size) })
    }
}

@Composable
private fun NbaBookMark(book: String?) {
    val key = SportsbookCatalog.key(book) ?: return
    SportsbookLogoView(key, null, SportsbookLogoStyle.COMPACT)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NbaMatchupSheet(options: List<NbaPropGameOption>, selection: String?, onSelect: (String?) -> Unit, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = AppColors.appSurfaceElevated) {
        LazyColumn(Modifier.fillMaxWidth().padding(bottom = 24.dp)) {
            item {
                Text("All games", color = AppColors.appTextPrimary, fontWeight = FontWeight.SemiBold, modifier = Modifier.fillMaxWidth().clickable { onSelect(null); onDismiss() }.padding(16.dp))
            }
            items(options, key = { it.key }) { option ->
                Row(Modifier.fillMaxWidth().clickable { onSelect(option.key); onDismiss() }.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    option.away?.let { MiniTeam(it) }
                    option.home?.let { MiniTeam(it) }
                    Text(option.label, color = AppColors.appTextPrimary, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 8.dp))
                    if (selection == option.key) {
                        Spacer(Modifier.weight(1f))
                        Icon(AppIcon.CHECKMARK.imageVector, null, tint = AppColors.appPrimary)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NbaMarketSheet(markets: List<NbaPropMarketOption>, selection: String?, onSelect: (String?) -> Unit, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = AppColors.appSurfaceElevated) {
        LazyColumn(Modifier.fillMaxWidth().padding(bottom = 24.dp)) {
            item { Text("All markets", color = AppColors.appTextPrimary, fontWeight = FontWeight.SemiBold, modifier = Modifier.fillMaxWidth().clickable { onSelect(null); onDismiss() }.padding(16.dp)) }
            items(markets, key = { it.key }) { market ->
                Text(
                    "${nbaMarketEmoji(market.key)}  ${market.label}",
                    color = AppColors.appTextPrimary,
                    fontWeight = if (selection == market.key) FontWeight.Bold else FontWeight.Medium,
                    modifier = Modifier.fillMaxWidth().clickable { onSelect(market.key); onDismiss() }.padding(horizontal = 16.dp, vertical = 12.dp),
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NbaSignalSheet(playerCount: Int, signalsOnly: Boolean, onSelect: (Boolean) -> Unit, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = AppColors.appSurfaceElevated) {
        Column(Modifier.fillMaxWidth().padding(bottom = 24.dp)) {
            Text("All players", color = AppColors.appTextPrimary, fontWeight = if (!signalsOnly) FontWeight.Bold else FontWeight.Medium, modifier = Modifier.fillMaxWidth().clickable { onSelect(false); onDismiss() }.padding(16.dp))
            Text("Has a signal · $playerCount", color = AppColors.appTextPrimary, fontWeight = if (signalsOnly) FontWeight.Bold else FontWeight.Medium, modifier = Modifier.fillMaxWidth().clickable { onSelect(true); onDismiss() }.padding(16.dp))
        }
    }
}

@Composable
private fun MiniTeam(abbr: String) {
    RemoteImage(NBATeams.logoURL(abbr), abbr, Modifier.padding(end = 4.dp).size(28.dp), ContentScale.Fit)
}

private fun nbaMarketEmoji(key: String) = when (key) {
    "player_points" -> "🏀"
    "player_rebounds" -> "💪"
    "player_assists" -> "🎯"
    "player_threes" -> "🔥"
    "player_blocks" -> "🛑"
    "player_steals" -> "🧤"
    "player_points_rebounds_assists" -> "📊"
    "player_points_rebounds" -> "📈"
    "player_points_assists" -> "🤝"
    "player_rebounds_assists" -> "🧩"
    else -> "🎯"
}

private fun shortDate(iso: String?): String {
    if (iso == null || iso.length < 10) return ""
    val month = iso.substring(5, 7).toIntOrNull() ?: return ""
    val day = iso.substring(8, 10).toIntOrNull() ?: return ""
    return "$month/$day"
}

private fun tipLabel(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return null
    val formatter = DateTimeFormatter.ofPattern("EEE MMM d h:mm a", Locale.US).withZone(ZoneId.of("America/New_York"))
    return "${formatter.format(instant)} ET"
}
