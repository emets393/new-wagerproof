package com.wagerproof.app.features.analytics

import android.text.format.DateUtils
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.outliers.OutlierTeamPalette
import com.wagerproof.app.features.paywall.LocalFeatureGatePreview
import com.wagerproof.app.features.paywall.PaywallDialogHost
import com.wagerproof.app.features.shared.InitialsDisc
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.CFBTeamAssets
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.models.NFLTeams
import com.wagerproof.core.models.PublicBetting
import com.wagerproof.core.models.PublicBettingGame
import com.wagerproof.core.models.PublicBoardSort
import com.wagerproof.core.models.PublicCategory
import com.wagerproof.core.models.PublicEmphasis
import com.wagerproof.core.models.PublicMarket
import com.wagerproof.core.models.PublicMarketRead
import com.wagerproof.core.models.PublicMoneyGap
import com.wagerproof.core.models.PublicSide
import com.wagerproof.core.models.SportLeague
import com.wagerproof.core.models.SubscriptionTier
import com.wagerproof.core.services.PublicBettingService
import com.wagerproof.core.stores.GamesStore
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.roundToInt

@Composable
fun PublicBettingScreen(sport: GamesStore.Sport, modifier: Modifier = Modifier) {
    val access = appGraph().proAccess
    val unlocked = LocalFeatureGatePreview.current || (!access.isLoading && access.hasAccess(SubscriptionTier.PREMIUM))
    val locked = !LocalFeatureGatePreview.current && !access.isLoading && !access.hasAccess(SubscriptionTier.PREMIUM)
    var games by remember { mutableStateOf<List<PublicBettingGame>>(emptyList()) }
    var market by remember { mutableStateOf(PublicMarket.spread) }
    var sharpOnly by remember { mutableStateOf(false) }
    var sort by remember { mutableStateOf(PublicBoardSort.sharp) }
    var query by remember { mutableStateOf("") }
    var marketOpen by remember { mutableStateOf(false) }
    var readsOpen by remember { mutableStateOf(false) }
    var sortOpen by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var failed by remember { mutableStateOf(false) }
    var showPaywall by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<PublicBettingGame?>(null) }
    val scope = rememberCoroutineScope()

    suspend fun load() {
        failed = false
        if (games.isEmpty()) loading = true
        runCatching { PublicBettingService.loadBoard() }
            .onSuccess { games = it; failed = false }
            .onFailure { failed = games.isEmpty() }
        loading = false
    }

    LaunchedEffect(Unit) { load() }
    LaunchedEffect(sport) { selected = null }

    val visible = PublicBetting.ordered(games, sport.name, market, sharpOnly, query, sort)
    val captured = visible.mapNotNull { it.capturedAt }.maxOrNull()
    val capturedLabel = if (captured == null) {
        "Action Network"
    } else {
        val relative = DateUtils.getRelativeTimeSpanString(captured, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS)
        "Action Network · captured $relative"
    }
    val openGame = selected

    Column(
        modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Spacing.lg)
            .padding(top = Spacing.md, bottom = Spacing.xxl),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (openGame != null) {
            TextButton(onClick = { selected = null }) { Text("Back", color = AppColors.appPrimary, fontWeight = FontWeight.SemiBold) }
            Text("${openGame.away} @ ${openGame.home}", color = AppColors.appTextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text(startLabel(openGame.startTime), color = AppColors.appTextMuted, fontSize = 13.sp)
            if (locked) {
                Text(
                    "Unlock the read",
                    color = Color.Black,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(AppColors.appPrimary)
                        .clickable { showPaywall = true }
                        .padding(vertical = 14.dp),
                )
            }
            val markets = PublicMarket.entries.filter { openGame.reads[it] != null }.let { present ->
                val index = present.indexOf(market)
                if (index <= 0) present else listOf(present[index]) + present.filterIndexed { i, _ -> i != index }
            }
            for (item in markets) {
                val read = openGame.reads[item] ?: continue
                Text("${marketMark(item)} ${item.label}", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                PublicBettingCard(openGame, item, read, unlocked, false, showsSentence = true, onClick = {})
            }
        } else {
            Text("Public Betting", color = AppColors.appTextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Row(
                Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                FilterMenu(market.label, "Market", marketOpen, { marketOpen = it }) {
                    PublicMarket.entries.forEach { item ->
                        DropdownMenuItem(
                            text = { Text(item.label) },
                            onClick = { market = item; marketOpen = false },
                        )
                    }
                }
                FilterMenu(if (sharpOnly) "Sharp money only" else "All", "Reads", readsOpen, { readsOpen = it }) {
                    DropdownMenuItem(text = { Text("All") }, onClick = { sharpOnly = false; readsOpen = false })
                    DropdownMenuItem(text = { Text("Sharp money only") }, onClick = { sharpOnly = true; readsOpen = false })
                }
                FilterMenu(sort.label, "Sort", sortOpen, { sortOpen = it }) {
                    PublicBoardSort.entries.forEach { item ->
                        DropdownMenuItem(
                            text = { Text(item.label) },
                            onClick = { sort = item; sortOpen = false },
                        )
                    }
                }
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(36.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(AppColors.appSurfaceMuted)
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                    Icon(Icons.Filled.Search, contentDescription = null, tint = AppColors.appTextMuted, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Box(Modifier.weight(1f)) {
                        if (query.isEmpty()) {
                            Text("Search teams", color = AppColors.appTextMuted, fontSize = 13.sp)
                        }
                        BasicTextField(
                            value = query,
                            onValueChange = { query = it },
                            singleLine = true,
                            textStyle = TextStyle(color = AppColors.appTextPrimary, fontSize = 13.sp),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    if (query.isNotEmpty()) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = "Clear search",
                            tint = AppColors.appTextMuted,
                            modifier = Modifier.size(16.dp).clickable { query = "" },
                        )
                    }
            }
            HowToRead()
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(capturedLabel, color = AppColors.appTextMuted, fontSize = 12.sp, modifier = Modifier.weight(1f))
                TextButton(onClick = { scope.launch { load() } }) {
                    Text("Refresh", color = AppColors.appPrimary, fontWeight = FontWeight.SemiBold)
                }
            }
            when {
                loading && games.isEmpty() -> Box(Modifier.fillMaxWidth().padding(top = 48.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AppColors.appPrimary)
                }
                failed && games.isEmpty() -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Couldn’t load the public splits.", color = AppColors.appTextPrimary, fontWeight = FontWeight.SemiBold)
                    TextButton(onClick = { scope.launch { load() } }) { Text("Try again", color = AppColors.appPrimary) }
                }
                visible.isEmpty() -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(emptyTitle(query, sharpOnly, market, sport), color = AppColors.appTextPrimary, fontWeight = FontWeight.SemiBold)
                    Text(emptyBody(query, sharpOnly), color = AppColors.appTextMuted, fontSize = 13.sp)
                }
                else -> {
                    for (game in visible) {
                        val read = game.reads[market] ?: continue
                        PublicBettingCard(game, market, read, unlocked, locked, showsSentence = false) { selected = game }
                    }
                }
            }
        }
    }
    PaywallDialogHost(showPaywall, "tier_upgrade_premium", { showPaywall = false }, SubscriptionTier.PREMIUM)
}

@Composable
private fun FilterMenu(
    title: String,
    accessibility: String,
    expanded: Boolean,
    onExpanded: (Boolean) -> Unit,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Box {
        Row(
            Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(AppColors.appSurfaceMuted)
                .clickable { onExpanded(true) }
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(title, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1)
            Icon(
                Icons.Filled.KeyboardArrowDown,
                contentDescription = accessibility,
                tint = AppColors.appTextPrimary,
                modifier = Modifier.size(16.dp),
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { onExpanded(false) }, content = content)
    }
}

@Composable
private fun HowToRead() {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(AppColors.appSurfaceElevated)
            .border(1.dp, AppColors.appBorder, RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("👀 HOW TO READ THIS", color = AppColors.appTextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text(
            "🎟️ is the share of bets. 💵 is the share of dollars. The line between them is the gap, and ➡️ is the move from the open to the current number.",
            color = AppColors.appTextPrimary.copy(alpha = 0.9f),
            fontSize = 13.sp,
        )
    }
}

@Composable
private fun PublicBettingCard(
    game: PublicBettingGame,
    market: PublicMarket,
    read: PublicMarketRead,
    unlocked: Boolean,
    locked: Boolean,
    showsSentence: Boolean,
    onClick: () -> Unit,
) {
    val colors = PublicBarColors.sides(game.sport, market, game.away, game.home)
    val confirm = when (read.moneyTiltSide) {
        PublicSide.away -> colors.first
        PublicSide.home -> colors.second
        null -> colors.first
    }
    val arrow = when (read.movedToward) {
        PublicSide.away -> colors.first
        PublicSide.home -> colors.second
        null -> AppColors.appTextSecondary
    }
    val rail = if (read.category == PublicCategory.sharpMoney) confirm else arrow
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(AppColors.appSurfaceElevated)
            .border(1.dp, AppColors.appBorder, RoundedCornerShape(16.dp))
            .clickable(enabled = !showsSentence, onClick = onClick)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TeamMark(game.sport, game.away, 32.dp)
            TeamMark(game.sport, game.home, 32.dp, Modifier.offset((-9).dp))
            Spacer(Modifier.width(4.dp))
            Column(Modifier.weight(1f)) {
                Text(startLabel(game.startTime), color = AppColors.appTextMuted, fontSize = 11.sp, maxLines = 1)
                Text(
                    "${game.away} @ ${game.home}",
                    color = AppColors.appTextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (unlocked && read.emphasis != PublicEmphasis.none && read.chip.isNotEmpty()) {
            TierChip(read, if (read.category == PublicCategory.sharpMoney) confirm else null)
        } else if (locked && read.emphasis != PublicEmphasis.none) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Lock, contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(6.dp))
                Text("Unlock the read", color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Column(
            if (read.category == PublicCategory.sharpMoney) {
                Modifier.border(1.dp, confirm, RoundedCornerShape(16.dp)).padding(8.dp)
            } else {
                Modifier
            },
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            DivergenceBars(game, market, read, colors.first, colors.second)
            LineRail(game, market, read, rail)
        }
        if (showsSentence && unlocked && read.sentence.isNotEmpty()) {
            Text(read.sentence, color = AppColors.appTextPrimary, fontSize = 13.sp)
        }
        if (showsSentence) {
            read.tickets?.takeIf { it > 0 }?.let { tickets ->
                Text(
                    "🎟️ ${grouped(tickets)} tickets on this market",
                    color = AppColors.appTextMuted,
                    fontSize = 11.sp,
                )
            }
        }
    }
}

@Composable
private fun TierChip(read: PublicMarketRead, ring: Color?) {
    val loud = read.emphasis == PublicEmphasis.loud
    val medium = read.emphasis == PublicEmphasis.medium
    val fg = when {
        loud -> AppColors.appSurface
        medium -> AppColors.appTextPrimary
        else -> AppColors.appTextMuted
    }
    val bg = when {
        loud -> AppColors.appTextPrimary
        medium -> AppColors.appTextPrimary.copy(alpha = 0.10f)
        else -> Color.Transparent
    }
    Text(
        read.chip,
        color = fg,
        fontSize = 11.sp,
        fontWeight = if (read.emphasis == PublicEmphasis.quiet) FontWeight.SemiBold else FontWeight.Bold,
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (loud && ring != null) ring.copy(alpha = 0.22f) else Color.Transparent)
            .padding(if (loud && ring != null) 3.dp else 0.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .border(
                1.dp,
                when {
                    loud && ring != null -> ring
                    medium -> AppColors.appTextPrimary.copy(alpha = 0.25f)
                    read.emphasis == PublicEmphasis.quiet -> AppColors.appBorder
                    else -> Color.Transparent
                },
                RoundedCornerShape(999.dp),
            )
            .padding(horizontal = 10.dp, vertical = 6.dp),
    )
}

@Composable
internal fun DivergenceBars(
    game: PublicBettingGame,
    market: PublicMarket,
    read: PublicMarketRead,
    awayColor: Color,
    homeColor: Color,
) {
    val gap = PublicBetting.moneyGap(read)
    val differenceColor = when (gap?.side) {
        PublicSide.away -> awayColor
        PublicSide.home -> homeColor
        null -> null
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (market != PublicMarket.total) TeamMark(game.sport, game.away, 22.dp)
        Column(Modifier.weight(1f).padding(horizontal = 6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Ends(read.betsAway, read.betsHome, "🎟️ TICKETS", awayColor, homeColor)
            SplitTrack(share(read.betsAway, read.betsHome), awayColor, homeColor)
            if (gap != null && differenceColor != null) {
                DifferenceMark(share(read.betsAway, read.betsHome), share(read.moneyAway, read.moneyHome), differenceColor)
                DifferenceCaption(gap, differenceColor)
            }
            SplitTrack(share(read.moneyAway, read.moneyHome), awayColor, homeColor)
            Ends(read.moneyAway, read.moneyHome, "💵 MONEY", awayColor, homeColor)
        }
        if (market != PublicMarket.total) TeamMark(game.sport, game.home, 22.dp)
    }
}

@Composable
private fun Ends(left: Double, right: Double, label: String, awayColor: Color, homeColor: Color) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text("${left.roundToInt()}%", color = awayColor, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        Text(
            label,
            color = AppColors.appTextMuted,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f),
        )
        Text("${right.roundToInt()}%", color = homeColor, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun SplitTrack(leftPct: Double, away: Color, home: Color) {
    val left = leftPct.toFloat().coerceIn(0f, 100f)
    Box(Modifier.fillMaxWidth().height(12.dp)) {
        Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Box(Modifier.weight(left.coerceAtLeast(0.01f)).fillMaxHeight().clip(CircleShape).background(away))
            Box(Modifier.weight((100f - left).coerceAtLeast(0.01f)).fillMaxHeight().clip(CircleShape).background(home))
        }
        Box(
            Modifier
                .align(Alignment.Center)
                .width(1.dp)
                .fillMaxHeight()
                .background(AppColors.appTextPrimary.copy(alpha = 0.25f)),
        )
    }
}

@Composable
private fun DifferenceMark(betSplit: Double, moneySplit: Double, color: Color) {
    Canvas(Modifier.fillMaxWidth().height(8.dp)) {
        val start = min(betSplit, moneySplit).toFloat() / 100f * size.width
        val width = abs(moneySplit - betSplit).toFloat() / 100f * size.width
        val path = Path().apply {
            if (moneySplit >= betSplit) {
                moveTo(start, 0f)
                lineTo(start + width, size.height)
                lineTo(start, size.height)
            } else {
                moveTo(start + width, 0f)
                lineTo(start, size.height)
                lineTo(start + width, size.height)
            }
            close()
        }
        drawPath(path, color.copy(alpha = 0.55f))
    }
}

@Composable
private fun DifferenceCaption(gap: PublicMoneyGap, color: Color) {
    Text(
        buildAnnotatedString {
            withStyle(SpanStyle(color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)) {
                append("⚡ DIFFERENCE")
            }
            withStyle(SpanStyle(color = color, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)) {
                append("  ${gap.points}%")
            }
            withStyle(SpanStyle(color = AppColors.appTextPrimary.copy(alpha = 0.8f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)) {
                append(" more money than tickets on ")
            }
            withStyle(SpanStyle(color = color, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)) {
                append(gap.name)
            }
        },
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
internal fun LineRail(game: PublicBettingGame, market: PublicMarket, read: PublicMarketRead, color: Color) {
    val caption = PublicBetting.lineCaption(market, read) ?: return
    val flat = caption.flat
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(AppColors.appTextPrimary.copy(alpha = 0.04f))
            .border(1.dp, AppColors.appBorder, RoundedCornerShape(16.dp))
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (caption.openerMissing) {
            Text("NOW", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            Text(nowOnly(market, game.away, read.current), color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        } else {
            Row(Modifier.fillMaxWidth()) {
                Text("OPEN", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                Text("NOW", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (market == PublicMarket.total) {
                        QuoteCell(null, market, read.open, false, color, TextAlign.Center)
                    } else {
                        QuoteCell(game.away, market, read.open, false, color, TextAlign.Start)
                        QuoteCell(game.home, market, read.homeOpen, false, color, TextAlign.Start)
                    }
                }
                Text(
                    if (read.current == null) "" else if (flat) "➖" else "➡️",
                    color = if (flat) AppColors.appTextMuted else color,
                    fontSize = 18.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.width(28.dp),
                )
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (market == PublicMarket.total) {
                        QuoteCell(null, market, read.current, !flat && read.current != null, color, TextAlign.Center)
                    } else {
                        QuoteCell(game.away, market, read.current, !flat && read.movedToward == PublicSide.away, color, TextAlign.End)
                        QuoteCell(game.home, market, read.homeCurrent, !flat && read.movedToward == PublicSide.home, color, TextAlign.End)
                    }
                }
            }
        }
        Text(
            "${caption.mark} ${caption.text}",
            color = if (flat) AppColors.appTextSecondary else color,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun QuoteCell(
    name: String?,
    market: PublicMarket,
    value: Double?,
    emphasize: Boolean,
    color: Color,
    align: TextAlign,
) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(if (emphasize) color.copy(alpha = 0.16f) else Color.Transparent)
            .drawBehind {
                val strokeColor = if (emphasize) color.copy(alpha = 0.7f) else AppColors.appTextPrimary.copy(alpha = 0.18f)
                drawRoundRect(
                    color = strokeColor,
                    style = Stroke(
                        width = 1.dp.toPx(),
                        pathEffect = if (emphasize) null else PathEffect.dashPathEffect(floatArrayOf(8f, 6f), 0f),
                    ),
                    cornerRadius = CornerRadius(12.dp.toPx(), 12.dp.toPx()),
                )
            }
            .padding(horizontal = 10.dp, vertical = 8.dp),
    ) {
        if (name != null) {
            Text(
                name.uppercase(Locale.US),
                color = if (emphasize) color.copy(alpha = 0.8f) else AppColors.appTextMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = align,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Text(
            value?.let { PublicBetting.formatLine(market, it) } ?: "—",
            color = if (emphasize) color else AppColors.appTextPrimary,
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
            textAlign = align,
            maxLines = 1,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun TeamMark(sport: String, name: String, size: androidx.compose.ui.unit.Dp, modifier: Modifier = Modifier) {
    val url = when (sport) {
        "nfl" -> NFLTeamAssets.logo(name) ?: NFLTeams.logoUrl(name)
        "nba" -> OutlierTeamPalette.logoURL(name, SportLeague.NBA) ?: nbaNicknameLogo(name)
        "cfb", "ncaab" -> CFBTeamAssets.logo(PublicBarColors.canonicalCollege(name))
        else -> null
    }
    val initials = name.split(" ").take(2).mapNotNull { it.firstOrNull()?.uppercase() }.joinToString("").ifEmpty { "—" }
    Box(
        modifier.size(size).clip(CircleShape).background(Color.White).border(1.dp, Color.Black.copy(alpha = 0.1f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        RemoteImage(
            url = url,
            contentDescription = name,
            modifier = Modifier.size(size * 0.7f),
            error = { InitialsDisc(initials, size * 0.7f) },
            loading = { InitialsDisc(initials, size * 0.7f) },
        )
    }
}

private fun nbaNicknameLogo(name: String): String? {
    val slug = mapOf(
        "hawks" to "atl", "celtics" to "bos", "nets" to "bkn", "hornets" to "cha",
        "bulls" to "chi", "cavaliers" to "cle", "cavs" to "cle", "mavericks" to "dal", "mavs" to "dal",
        "nuggets" to "den", "pistons" to "det", "warriors" to "gs", "rockets" to "hou",
        "pacers" to "ind", "clippers" to "lac", "lakers" to "lal", "grizzlies" to "mem",
        "heat" to "mia", "bucks" to "mil", "timberwolves" to "min", "wolves" to "min",
        "pelicans" to "no", "knicks" to "ny", "thunder" to "okc", "magic" to "orl",
        "76ers" to "phi", "sixers" to "phi", "suns" to "phx", "trail blazers" to "por", "blazers" to "por",
        "kings" to "sac", "spurs" to "sa", "raptors" to "tor", "jazz" to "utah", "wizards" to "wsh",
    )[name.trim().lowercase(Locale.US)] ?: return null
    return "https://a.espncdn.com/i/teamlogos/nba/500/$slug.png"
}

private fun share(left: Double, right: Double): Double {
    val sum = left + right
    if (sum <= 0) return 50.0
    return left / sum * 100
}

private fun nowOnly(market: PublicMarket, away: String, current: Double?): String {
    if (current == null) return "—"
    val number = PublicBetting.formatLine(market, current)
    return if (market == PublicMarket.total) number else "$away $number"
}

private fun marketMark(market: PublicMarket) = when (market) {
    PublicMarket.spread -> "📐"
    PublicMarket.total -> "🎯"
    PublicMarket.ml -> "💰"
}

private fun emptyTitle(query: String, sharpOnly: Boolean, market: PublicMarket, sport: GamesStore.Sport): String {
    val needle = query.trim()
    if (needle.isNotEmpty()) return "No teams match that search."
    if (sharpOnly) return "No sharp-money reads on the ${market.label.lowercase()}."
    return "No usable ${market.label.lowercase()} splits for ${sport.label}."
}

private fun emptyBody(query: String, sharpOnly: Boolean): String {
    if (query.trim().isNotEmpty()) return "Try a city, a nickname, or an abbreviation."
    if (sharpOnly) return "Sharp money needs heavy tickets one way, the dollars the other way, and the line moving with the dollars."
    return "A 0/100 split and a thin ticket count stay off the feed."
}

private fun startLabel(iso: String?): String {
    if (iso.isNullOrBlank()) return "Time TBD"
    val instant = runCatching { Instant.parse(iso) }.getOrNull()
        ?: runCatching { Instant.parse(iso.replace(" ", "T")) }.getOrNull()
        ?: return "Time TBD"
    val formatted = DateTimeFormatter.ofPattern("EEE, MMM d, h:mm a", Locale.US)
        .withZone(ZoneId.of("America/New_York"))
        .format(instant)
    return "$formatted ET"
}

private fun grouped(value: Double): String =
    NumberFormat.getIntegerInstance(Locale.US).format(value.roundToInt())
