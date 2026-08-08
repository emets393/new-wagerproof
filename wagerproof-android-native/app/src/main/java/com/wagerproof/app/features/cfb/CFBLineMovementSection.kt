package com.wagerproof.app.features.cfb

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.CFBTeamColors
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.CFBPrediction
import com.wagerproof.core.models.NFLPrediction
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import java.util.Locale
import kotlinx.coroutines.delay
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.math.floor

/**
 * One consensus snapshot from the game-keyed movement views
 * (`nfl_line_movement` / `cfb_line_movement`).
 *
 * These views are the ONLY valid series source. The raw per-book archives
 * (`nfl_historical_odds`, `ncaaf_odds_history`) are keyed by Odds-API event id /
 * city name — the views own that remap onto the dry-run `game_id`. And the
 * `*_betting_lines` slate-input tables are wiped and reinserted as one consensus
 * row per game every load, so they can never hold more than one point.
 * See .claude/docs/agents/24_LINE_MOVEMENT_ARCHIVE.md.
 */
@Serializable
data class LineMovementSnap(
    @SerialName("snap_ts") val snapTs: String,
    @SerialName("n_books") val nBooks: Int? = null,
    @SerialName("fg_spread_home") val fgSpreadHome: Double? = null,
    @SerialName("fg_total") val fgTotal: Double? = null,
)

/**
 * Slate scalars from `*_dryrun_games`. Only `fg_*_open` is a true opener; the
 * close is a stale model reference and must never be presented as the live line.
 */
data class LineSlateScalars(
    val spreadOpen: Double? = null,
    val totalOpen: Double? = null,
    val spreadClose: Double? = null,
    val totalClose: Double? = null,
)

private const val NFL_MOVEMENT_VIEW = "nfl_line_movement"
private const val CFB_MOVEMENT_VIEW = "cfb_line_movement"

/** Postgres `statement_timeout`. */
private const val STATEMENT_TIMEOUT_CODE = "57014"

/** Backoff between cold-cache retries, in ms. Mirrors the web client. */
private val RETRY_DELAYS_MS = longArrayOf(300, 700, 1500, 2500)

private const val TIMEOUT_MESSAGE =
    "Live line movement timed out while loading. The values below are the slate close."

/** Shown when a market's only value is the stale slate reference. */
private const val SLATE_CLOSE_LABEL = "Slate close"

/** Amber matches the OVER tint used on totals elsewhere in the stack. */
private val TOTAL_TINT = Color(0xFFF97316)

/** Live CFB line history off `cfb_line_movement`, keyed on the dry-run game id. */
@Composable
fun CFBLineMovementSection(game: CFBPrediction, modifier: Modifier = Modifier) {
    BettingLineMovementSection(
        gameId = game.gameId,
        season = game.season,
        movementView = CFB_MOVEMENT_VIEW,
        awayTeam = game.awayTeam,
        homeTeam = game.homeTeam,
        awayColor = CFBTeamColors.colorPair(game.awayTeam).primary,
        homeColor = CFBTeamColors.colorPair(game.homeTeam).primary,
        // Only `fg_*_open` off the dry-run row is a real opener. CFBPrediction's
        // `openingSpread` is set to the CURRENT spread on the legacy merge, so
        // reading it here would relabel today's line as the open.
        scalars = LineSlateScalars(
            spreadOpen = game.fgSpreadOpen,
            totalOpen = game.fgTotalOpen,
            spreadClose = game.fgSpreadClose ?: game.homeSpread,
            totalClose = game.fgTotalClose ?: game.overLine,
        ),
        modifier = modifier,
    )
}

/** Live NFL line history off `nfl_line_movement`, keyed on the dry-run game id. */
@Composable
fun NFLLineMovementSection(
    game: NFLPrediction,
    awayColor: Color,
    homeColor: Color,
    modifier: Modifier = Modifier,
) {
    BettingLineMovementSection(
        gameId = game.gameId,
        season = game.season,
        movementView = NFL_MOVEMENT_VIEW,
        awayTeam = game.awayTeam,
        homeTeam = game.homeTeam,
        awayColor = awayColor,
        homeColor = homeColor,
        scalars = LineSlateScalars(
            spreadOpen = game.fgSpreadOpen,
            totalOpen = game.fgTotalOpen,
            spreadClose = game.fgSpreadClose ?: game.homeSpread,
            totalClose = game.fgTotalClose ?: game.overLine,
        ),
        modifier = modifier,
    )
}

/**
 * Shared NFL/CFB implementation. Both movement views expose the same
 * `snap_ts / n_books / fg_spread_home / fg_total` shape.
 *
 * The slate `fg_*_open` value is the opener and is always labelled as such; a
 * market with no view row falls back to the slate close, relabelled so it never
 * reads as "now". A chart is only drawn once a series has ≥2 DISTINCT values —
 * a single repeated price is movement we haven't observed, not a flat line.
 */
@Composable
fun BettingLineMovementSection(
    gameId: String,
    season: Int?,
    movementView: String,
    awayTeam: String,
    homeTeam: String,
    awayColor: Color,
    homeColor: Color,
    scalars: LineSlateScalars,
    modifier: Modifier = Modifier,
) {
    val hasIdentity = gameId.isNotBlank()
    var loading by remember(gameId, movementView) { mutableStateOf(hasIdentity) }
    var snaps by remember(gameId, movementView) { mutableStateOf<List<LineMovementSnap>>(emptyList()) }
    var timedOut by remember(gameId, movementView) { mutableStateOf(false) }
    var failed by remember(gameId, movementView) { mutableStateOf(false) }

    LaunchedEffect(gameId, season, movementView) {
        if (!hasIdentity) {
            snaps = emptyList()
            loading = false
            return@LaunchedEffect
        }
        loading = true
        timedOut = false
        failed = false
        // The CFB view aggregates a 1.3M-row archive with no index on the
        // game_id lookup, so a cold read reliably blows the statement timeout
        // and the same query then returns in <10ms. Retrying through that
        // warm-up is the difference between a chart and an empty card.
        var result = fetchSnaps(movementView, gameId, season)
        for (backoff in RETRY_DELAYS_MS) {
            if (!isStatementTimeout(result.exceptionOrNull())) break
            delay(backoff)
            result = fetchSnaps(movementView, gameId, season)
        }
        snaps = result.getOrDefault(emptyList())
        timedOut = isStatementTimeout(result.exceptionOrNull())
        failed = result.isFailure && !timedOut
        loading = false
    }

    val series = remember(snaps, scalars, awayTeam, homeTeam, awayColor, homeColor) {
        buildMovementSeries(snaps, scalars, awayTeam, homeTeam, awayColor, homeColor)
    }
    val latestBooks = snaps.lastOrNull()?.nBooks

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        when {
            loading -> Box(Modifier.fillMaxWidth().height(92.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = AppColors.appPrimary)
            }
            series.none { it.open != null || it.current != null || it.values.isNotEmpty() } ->
                EmptyLineMovement(failed || timedOut)
            else -> {
                if (timedOut || failed) {
                    NoticeBanner(if (timedOut) TIMEOUT_MESSAGE else "Live line movement failed to load. The values below are the slate close.")
                }
                LineMovementContent(series, latestBooks)
            }
        }
    }
}

private suspend fun fetchSnaps(
    view: String,
    gameId: String,
    season: Int?,
): Result<List<LineMovementSnap>> = runCatching {
    SupabaseClients.cfb
        .from(view)
        .select(Columns.raw("snap_ts,n_books,fg_spread_home,fg_total")) {
            filter {
                eq("game_id", gameId)
                if (season != null) eq("season", season)
            }
            order("snap_ts", Order.ASCENDING)
        }
        .decodeList<LineMovementSnap>()
}

/** True when a fetch failed on the cold-cache statement timeout rather than legitimately. */
private fun isStatementTimeout(error: Throwable?): Boolean {
    val message = error?.message ?: return false
    return message.contains(STATEMENT_TIMEOUT_CODE) ||
        message.contains("statement timeout", ignoreCase = true)
}

/** One market's timeline: opener, current price, and the observed series. */
data class MovementSeries(
    val title: String,
    val tint: Color,
    val signed: Boolean,
    /** True opener from the slate's `fg_*_open`; null when never captured. */
    val open: Double?,
    /** Latest view value, or the slate close when the view has nothing. */
    val current: Double?,
    /** False when [current] is the stale slate close rather than a view row. */
    val isLive: Boolean,
    /** Non-null values in snapshot order. */
    val values: List<Double>,
) {
    /** ≥2 distinct values, or the "chart" is a straight line asserting no movement. */
    val chartable: Boolean get() = values.distinct().size >= 2

    /**
     * Movement off the opener — null when [current] is the slate close rather
     * than a live price, because a delta measured against a stale model
     * reference is not movement anyone observed. Matches web `MoveSummary`
     * (`isLive = !isSlateCloseFallback(market)` → delta null).
     */
    val change: Double? get() = if (isLive && open != null && current != null) current - open else null
}

fun buildMovementSeries(
    snaps: List<LineMovementSnap>,
    scalars: LineSlateScalars,
    awayTeam: String,
    homeTeam: String,
    awayColor: Color,
    homeColor: Color,
): List<MovementSeries> {
    val latest = snaps.lastOrNull()
    fun market(
        title: String,
        tint: Color,
        signed: Boolean,
        open: Double?,
        close: Double?,
        read: (LineMovementSnap) -> Double?,
    ): MovementSeries {
        val live = latest?.let(read)
        return MovementSeries(
            title = title,
            tint = tint,
            signed = signed,
            open = open,
            current = live ?: close,
            isLive = live != null,
            values = snaps.mapNotNull(read),
        )
    }

    return listOf(
        market("$awayTeam Spread", awayColor, true, scalars.spreadOpen?.let { -it }, scalars.spreadClose?.let { -it }) {
            it.fgSpreadHome?.let { home -> -home }
        },
        market("$homeTeam Spread", homeColor, true, scalars.spreadOpen, scalars.spreadClose) { it.fgSpreadHome },
        market("Total Line", TOTAL_TINT, false, scalars.totalOpen, scalars.totalClose) { it.fgTotal },
    )
}

@Composable
private fun EmptyLineMovement(failed: Boolean) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.45f), shape)
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.55f), shape)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(AppIcon.INFO_CIRCLE.imageVector, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(28.dp))
        Text(
            if (failed) "Line movement is temporarily unavailable" else "No line movement data available",
            color = AppColors.appTextSecondary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun NoticeBanner(message: String) {
    val shape = RoundedCornerShape(10.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .background(AppColors.appAccentAmber.copy(alpha = 0.10f), shape)
            .border(1.dp, AppColors.appAccentAmber.copy(alpha = 0.35f), shape)
            .padding(10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(AppIcon.INFO_CIRCLE.imageVector, null, tint = AppColors.appAccentAmber, modifier = Modifier.size(16.dp))
        Text(message, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun LineMovementContent(series: List<MovementSeries>, latestBooks: Int?) {
    val homeSpread = series.getOrNull(1)
    val total = series.getOrNull(2)

    // Spread and total are independent markets with their own `isLive` (a CFB
    // snap can carry fg_spread_home and a null fg_total), so a single card
    // heading can't describe both. Title from "is anything live", and mark the
    // odd row out — otherwise this card reads "Current" over the same number
    // MovementPanel below labels "Slate close".
    val anyLive = listOfNotNull(homeSpread, total).any { it.isLive }
    fun rowLabel(base: String, market: MovementSeries?): String =
        if (anyLive && market != null && !market.isLive) "$base (close)" else base

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        SummaryCard(
            title = "Movement",
            rows = listOf(
                "Spread" to signed(homeSpread?.change),
                "Total" to signed(total?.change),
            ),
            tint = Color(0xFF3B82F6),
            modifier = Modifier.weight(1f),
        )
        SummaryCard(
            title = if (anyLive) "Current" else SLATE_CLOSE_LABEL,
            rows = listOf(
                rowLabel("Spread", homeSpread) to line(homeSpread?.current),
                rowLabel("Total", total) to fmtHalfLine(total?.current),
            ),
            tint = Color(0xFF22C55E),
            modifier = Modifier.weight(1f),
        )
    }

    if (latestBooks != null && latestBooks > 0) {
        Text(
            "Consensus of $latestBooks ${if (latestBooks == 1) "book" else "books"}",
            color = AppColors.appTextMuted,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium,
        )
    }

    val spreads = series.take(2).filter { it.open != null || it.current != null || it.values.isNotEmpty() }
    if (spreads.isNotEmpty()) {
        SectionLabel("SPREAD MOVEMENT")
        spreads.forEach { MovementPanel(it) }
    }
    if (total != null && (total.open != null || total.current != null || total.values.isNotEmpty())) {
        SectionLabel("OVER/UNDER MOVEMENT")
        MovementPanel(total)
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        color = AppColors.appTextSecondary,
        fontSize = 11.sp,
        fontWeight = FontWeight.Black,
        letterSpacing = 0.5.sp,
    )
}

@Composable
private fun SummaryCard(
    title: String,
    rows: List<Pair<String, String>>,
    tint: Color,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier
            .background(tint.copy(alpha = 0.10f), shape)
            .border(1.dp, tint.copy(alpha = 0.30f), shape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(title.uppercase(Locale.US), color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp)
        rows.forEach { (label, value) ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(label, color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                Text(value, color = movementColor(value), fontSize = 15.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
            }
        }
    }
}

@Composable
private fun MovementPanel(market: MovementSeries) {
    val shape = RoundedCornerShape(12.dp)
    val fmt: (Double?) -> String = if (market.signed) ::line else ::fmtHalfLine
    Column(
        Modifier
            .fillMaxWidth()
            .background(market.tint.copy(alpha = 0.10f), shape)
            .border(1.dp, market.tint.copy(alpha = 0.30f), shape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(market.title, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        val currentLabel = if (market.isLive) "Now" else SLATE_CLOSE_LABEL
        Text(
            "Open: ${fmt(market.open)}  →  $currentLabel: ${fmt(market.current)}",
            color = AppColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            fontFamily = FontFamily.Monospace,
        )
        if (market.chartable) {
            Sparkline(market.values, market.tint, Modifier.fillMaxWidth().height(118.dp))
            // The chart plots ARCHIVED SNAPSHOTS only — `values` never contains
            // the slate `open` printed above it, and its last point is the last
            // snap, not necessarily the current price. Labelling the ends
            // "Open"/"Now" claimed otherwise.
            Row(Modifier.fillMaxWidth()) {
                Text("First snap", color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Text("Latest snap", color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
            }
        } else {
            // Never draw a flat line off one price — that asserts "no movement"
            // when the truth is "we only have one observation".
            Text(
                if (market.values.isEmpty()) {
                    "No archived snapshots for this market yet."
                } else {
                    "Only one price on record — nothing to chart yet."
                },
                color = AppColors.appTextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

@Composable
private fun Sparkline(values: List<Double>, tint: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val horizontalInset = 8.dp.toPx()
        val verticalInset = 12.dp.toPx()
        val chartWidth = (size.width - horizontalInset * 2).coerceAtLeast(1f)
        val chartHeight = (size.height - verticalInset * 2).coerceAtLeast(1f)
        repeat(4) { index ->
            val y = verticalInset + chartHeight * index / 3f
            drawLine(AppColors.appBorder.copy(alpha = 0.24f), Offset(horizontalInset, y), Offset(size.width - horizontalInset, y), strokeWidth = 1.dp.toPx())
        }
        val min = values.minOrNull() ?: 0.0
        val max = values.maxOrNull() ?: min
        val range = (max - min).takeIf { it > 0.001 } ?: 1.0
        val path = Path()
        values.forEachIndexed { index, value ->
            val x = horizontalInset + if (values.size == 1) chartWidth / 2f else chartWidth * index / (values.size - 1f)
            val y = verticalInset + chartHeight * (1f - ((value - min) / range).toFloat())
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(path, tint, style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
        values.forEachIndexed { index, value ->
            val x = horizontalInset + if (values.size == 1) chartWidth / 2f else chartWidth * index / (values.size - 1f)
            val y = verticalInset + chartHeight * (1f - ((value - min) / range).toFloat())
            drawCircle(tint, radius = 3.dp.toPx(), center = Offset(x, y))
            drawCircle(Color.White, radius = 1.2.dp.toPx(), center = Offset(x, y))
        }
    }
}

private fun signed(value: Double?): String = value?.let { String.format(Locale.US, "%+.1f", it) } ?: "N/A"

private fun movementColor(value: String): Color = when {
    value.startsWith("+") && value != "+0.0" -> Color(0xFF22C55E)
    value.startsWith("-") -> AppColors.appAccentRed
    else -> AppColors.appTextPrimary
}

private fun line(value: Double?): String = value?.let {
    val rounded = GameCardFormatting.roundToNearestHalf(it) ?: it
    val body = if (floor(rounded) == rounded) rounded.toInt().toString() else String.format(Locale.US, "%.1f", rounded)
    if (rounded > 0) "+$body" else body
} ?: "N/A"

private fun fmtHalfLine(value: Double?): String {
    val rounded = GameCardFormatting.roundToNearestHalf(value) ?: return "N/A"
    return if (floor(rounded) == rounded) rounded.toInt().toString() else String.format(Locale.US, "%.1f", rounded)
}
