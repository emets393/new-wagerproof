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
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import java.util.Locale
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.math.floor

/** One timestamped snapshot from `cfb_betting_lines`. */
@Serializable
data class CFBLineMovementPoint(
    @SerialName("as_of_ts") val asOfTs: String,
    @SerialName("home_spread") val homeSpread: Double? = null,
    @SerialName("away_spread") val awaySpread: Double? = null,
    @SerialName("over_line") val overLine: Double? = null,
)

/**
 * Live CFB line history. This replaces the opening/current placeholder with
 * the production RN contract: ordered snapshots, movement summary, separate
 * away/home spread charts, and the over/under chart.
 */
@Composable
fun CFBLineMovementSection(game: CFBPrediction, modifier: Modifier = Modifier) {
    BettingLineMovementSection(
        trainingKey = game.trainingKey,
        table = "cfb_betting_lines",
        awayTeam = game.awayTeam,
        homeTeam = game.homeTeam,
        awayColor = CFBTeamColors.colorPair(game.awayTeam).primary,
        homeColor = CFBTeamColors.colorPair(game.homeTeam).primary,
        modifier = modifier,
    )
}

/** Shared NFL/CFB implementation; both betting-line tables have this schema. */
@Composable
fun BettingLineMovementSection(
    trainingKey: String,
    table: String,
    awayTeam: String,
    homeTeam: String,
    awayColor: Color,
    homeColor: Color,
    modifier: Modifier = Modifier,
) {
    var loading by remember(trainingKey, table) { mutableStateOf(true) }
    var points by remember(trainingKey, table) { mutableStateOf<List<CFBLineMovementPoint>>(emptyList()) }
    var failed by remember(trainingKey, table) { mutableStateOf(false) }

    LaunchedEffect(trainingKey, table) {
        loading = true
        failed = false
        val result = runCatching {
            SupabaseClients.cfb
                .from(table)
                .select(Columns.raw("as_of_ts,home_spread,away_spread,over_line")) {
                    filter { eq("training_key", trainingKey) }
                    order("as_of_ts", Order.ASCENDING)
                }
                .decodeList<CFBLineMovementPoint>()
        }
        points = result.getOrDefault(emptyList())
        failed = result.isFailure
        loading = false
    }

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        when {
            loading -> Box(Modifier.fillMaxWidth().height(92.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = AppColors.appPrimary)
            }
            points.isEmpty() -> EmptyLineMovement(failed)
            else -> LineMovementContent(awayTeam, homeTeam, awayColor, homeColor, points)
        }
    }
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
private fun LineMovementContent(
    awayTeam: String,
    homeTeam: String,
    awayColor: Color,
    homeColor: Color,
    points: List<CFBLineMovementPoint>,
) {
    val first = points.first()
    val latest = points.last()
    val spreadChange = change(first.homeSpread, latest.homeSpread)
    val totalChange = change(first.overLine, latest.overLine)
    val away = points.mapNotNull { it.awaySpread }
    val home = points.mapNotNull { it.homeSpread }
    val total = points.mapNotNull { it.overLine }

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        SummaryCard(
            title = "Movement",
            rows = listOf("Spread" to signed(spreadChange), "Total" to signed(totalChange)),
            tint = Color(0xFF3B82F6),
            modifier = Modifier.weight(1f),
        )
        SummaryCard(
            title = "Current",
            rows = listOf("Spread" to line(latest.homeSpread), "Total" to fmtHalfLine(latest.overLine)),
            tint = Color(0xFF22C55E),
            modifier = Modifier.weight(1f),
        )
    }

    if (away.isNotEmpty() || home.isNotEmpty()) {
        Text("SPREAD MOVEMENT", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp)
    }
    if (away.isNotEmpty()) {
        MovementChart(
            title = "$awayTeam Spread",
            values = away,
            tint = awayColor,
        )
    }
    if (home.isNotEmpty()) {
        MovementChart(
            title = "$homeTeam Spread",
            values = home,
            tint = homeColor,
        )
    }
    if (total.isNotEmpty()) {
        Text(
            "OVER/UNDER MOVEMENT",
            color = AppColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.5.sp,
        )
        MovementChart(title = "Total Line", values = total, tint = Color(0xFFF97316))
    }
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
private fun MovementChart(title: String, values: List<Double>, tint: Color) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .background(tint.copy(alpha = 0.10f), shape)
            .border(1.dp, tint.copy(alpha = 0.30f), shape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(title, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        Text(
            "Open: ${line(values.first())}  →  Now: ${line(values.last())}",
            color = AppColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            fontFamily = FontFamily.Monospace,
        )
        Sparkline(values, tint, Modifier.fillMaxWidth().height(118.dp))
        Row(Modifier.fillMaxWidth()) {
            Text("Open", color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            Text("Now", color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
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

private fun change(first: Double?, last: Double?): Double? = if (first != null && last != null) last - first else null

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
