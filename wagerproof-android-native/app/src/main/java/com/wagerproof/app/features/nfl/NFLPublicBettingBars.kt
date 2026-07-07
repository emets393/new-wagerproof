package com.wagerproof.app.features.nfl

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.TeamColorPair
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NFLPrediction
import com.wagerproof.core.models.NFLTeams
import java.util.Locale
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * NFL "Public Lean" widget — port of iOS `NFLPublicBettingBars.swift`.
 * Three stacked sections (Moneyline / Spread / Total): each row shows % of
 * bets and % of money per side via a 5-segment speedometer gauge, with an
 * indicator badge when the pipeline published a `*_splits_label`.
 *
 * FIDELITY-WAIVER #290: like iOS, this widget is NOT wired into
 * `NFLGameDetailPage`'s section list — it's ported as an available component
 * only (the current dry-run detail page doesn't surface public splits).
 */
@Composable
fun NFLPublicBettingBars(prediction: NFLPrediction, modifier: Modifier = Modifier) {
    NFLPublicBettingBars(
        homeMlBets = prediction.homeMlBets, awayMlBets = prediction.awayMlBets,
        homeMlHandle = prediction.homeMlHandle, awayMlHandle = prediction.awayMlHandle,
        mlSplitsLabel = prediction.mlSplitsLabel,
        homeSpreadBets = prediction.homeSpreadBets, awaySpreadBets = prediction.awaySpreadBets,
        homeSpreadHandle = prediction.homeSpreadHandle, awaySpreadHandle = prediction.awaySpreadHandle,
        spreadSplitsLabel = prediction.spreadSplitsLabel,
        overBets = prediction.overBets, underBets = prediction.underBets,
        overHandle = prediction.overHandle, underHandle = prediction.underHandle,
        totalSplitsLabel = prediction.totalSplitsLabel,
        homeTeam = prediction.homeTeam, awayTeam = prediction.awayTeam,
        modifier = modifier,
    )
}

@Composable
fun NFLPublicBettingBars(
    homeMlBets: String? = null, awayMlBets: String? = null,
    homeMlHandle: String? = null, awayMlHandle: String? = null,
    mlSplitsLabel: String? = null,
    homeSpreadBets: String? = null, awaySpreadBets: String? = null,
    homeSpreadHandle: String? = null, awaySpreadHandle: String? = null,
    spreadSplitsLabel: String? = null,
    overBets: String? = null, underBets: String? = null,
    overHandle: String? = null, underHandle: String? = null,
    totalSplitsLabel: String? = null,
    homeTeam: String, awayTeam: String,
    modifier: Modifier = Modifier,
) {
    val hasMl = anyNonEmpty(homeMlBets, awayMlBets, homeMlHandle, awayMlHandle, mlSplitsLabel)
    val hasSpread = anyNonEmpty(homeSpreadBets, awaySpreadBets, homeSpreadHandle, awaySpreadHandle, spreadSplitsLabel)
    val hasTotal = anyNonEmpty(overBets, underBets, overHandle, underHandle, totalSplitsLabel)
    // RN renders nothing when no section has data — preserve that early exit.
    if (!hasMl && !hasSpread && !hasTotal) return

    Column(modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (hasMl) {
                SplitsSection("Moneyline", "chart.line.uptrend.xyaxis", hexColor(0x3B82F6), mlSplitsLabel) {
                    TeamRow(awayTeam, percent(awayMlBets), percent(awayMlHandle))
                    TeamRow(homeTeam, percent(homeMlBets), percent(homeMlHandle))
                }
            }
            if (hasSpread) {
                SplitsSection("Spread", "target", hexColor(0x22C55E), spreadSplitsLabel) {
                    TeamRow(awayTeam, percent(awaySpreadBets), percent(awaySpreadHandle))
                    TeamRow(homeTeam, percent(homeSpreadBets), percent(homeSpreadHandle))
                }
            }
            if (hasTotal) {
                SplitsSection("Total", "chart.bar.fill", hexColor(0xF97316), totalSplitsLabel) {
                    TotalRow(isOver = true, percent(overBets), percent(overHandle))
                    TotalRow(isOver = false, percent(underBets), percent(underHandle))
                }
            }
        }
        ExplanationSection(Modifier.padding(top = 16.dp))
    }
}

// MARK: - Section / row builders

@Composable
private fun SplitsSection(
    title: String,
    icon: String,
    iconColor: Color,
    splitsLabel: String?,
    rows: @Composable () -> Unit,
) {
    val slate = hexColor(0x64748B)
    val shape = RoundedCornerShape(12.dp)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            AppIcon.fromSystemName(icon)?.let { Icon(it.imageVector, null, tint = iconColor, modifier = Modifier.size(11.dp)) }
            Text(title, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
        Row(
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(slate.copy(alpha = 0.08f))
                .border(1.dp, slate.copy(alpha = 0.20f), shape),
        ) {
            Column(Modifier.weight(1f)) {
                HeaderRow()
                rows()
            }
            val label = splitsLabel?.trim().takeUnless { it.isNullOrEmpty() }
            if (label != null) {
                Box(Modifier.width(100.dp)) {
                    Box(Modifier.width(1.dp).height(96.dp).background(slate.copy(alpha = 0.15f)))
                    IndicatorBadge(label)
                }
            }
        }
    }
}

@Composable
private fun HeaderRow() {
    val slate = hexColor(0x64748B)
    Column {
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp).padding(end = 10.dp)) {
            HeaderText("TEAM", Modifier.weight(1f).padding(start = 10.dp), TextAlign.Start)
            HeaderText("BETS", Modifier.weight(1f), TextAlign.Center)
            HeaderText("MONEY", Modifier.weight(1f), TextAlign.Center)
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(slate.copy(alpha = 0.15f)))
    }
}

@Composable
private fun HeaderText(text: String, modifier: Modifier, align: TextAlign) {
    Text(
        text,
        color = AppColors.appTextSecondary,
        fontSize = 10.sp,
        fontWeight = FontWeight.SemiBold,
        textAlign = align,
        modifier = modifier,
    )
}

@Composable
private fun TeamRow(team: String, betsPercent: Int?, handlePercent: Int?) {
    val colors = NFLTeamColors.colorPair(team)
    Row(
        Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(Modifier.weight(1f).padding(start = 10.dp), contentAlignment = Alignment.CenterStart) {
            Box(
                Modifier
                    .size(26.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(colors.primary, colors.secondary))),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    NFLTeamColors.initials(team),
                    color = NFLTeamColors.contrastingTextColor(colors.primary, colors.secondary),
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { SemiGauge(betsPercent) }
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { SemiGauge(handlePercent) }
    }
}

@Composable
private fun TotalRow(isOver: Boolean, betsPercent: Int?, handlePercent: Int?) {
    val iconColor = if (isOver) hexColor(0xF97316) else hexColor(0x3B82F6)
    Row(
        Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(Modifier.weight(1f).padding(start = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(Modifier.size(26.dp).background(iconColor.copy(alpha = 0.15f), CircleShape), contentAlignment = Alignment.Center) {
                val icon = AppIcon.fromSystemName(if (isOver) "arrow.up" else "arrow.down")
                icon?.let { Icon(it.imageVector, null, tint = iconColor, modifier = Modifier.size(12.dp)) }
            }
            Text(if (isOver) "Over" else "Under", color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { SemiGauge(betsPercent) }
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { SemiGauge(handlePercent) }
    }
}

@Composable
private fun IndicatorBadge(label: String) {
    val green = hexColor(0x22C55E)
    val shape = RoundedCornerShape(8.dp)
    Column(
        Modifier
            .padding(8.dp)
            .fillMaxWidth()
            .clip(shape)
            .background(green.copy(alpha = 0.15f))
            .border(1.dp, green.copy(alpha = 0.30f), shape)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        AppIcon.fromSystemName("info.circle.fill")?.let { Icon(it.imageVector, null, tint = green, modifier = Modifier.size(12.dp)) }
        Text(label, color = green, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
    }
}

// MARK: - Explanation legend

@Composable
private fun ExplanationSection(modifier: Modifier = Modifier) {
    val slate = hexColor(0x64748B)
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(slate.copy(alpha = 0.20f)))
        Row(
            Modifier.padding(top = 8.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            AppIcon.fromSystemName("info.circle")?.let { Icon(it.imageVector, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(11.dp)) }
            Text("HOW TO READ", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        ExplanationItem("Bets", AppColors.appTextPrimary, "% of total bets placed on each side")
        ExplanationItem("Money", AppColors.appTextPrimary, "% of total dollars wagered on each side")
        Box(Modifier.fillMaxWidth().padding(vertical = 8.dp).height(1.dp).background(slate.copy(alpha = 0.15f)))
        Text("Indicators:", color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 4.dp))
        ExplanationItem("Consensus", hexColor(0x22C55E), "Both bets and money heavily favor one side")
        ExplanationItem("Sharp", hexColor(0x3B82F6), "Public bets one way, but smart money goes the other — follow the money")
        ExplanationItem("Public", hexColor(0xF97316), "Money is split evenly, but casual bettors lean heavily one way")
    }
}

@Composable
private fun ExplanationItem(label: String, labelColor: Color, text: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, color = labelColor, fontSize = 12.sp, fontWeight = FontWeight.Black)
        Text(text, color = AppColors.appTextSecondary, fontSize = 11.sp)
    }
}

// MARK: - Semi-gauge speedometer

/**
 * 5-segment colored arc + needle pinned at the exact percentage — hand-drawn
 * Canvas port of RN/iOS `SemiGauge` (36×24, stroke 5, needle len r−4).
 */
@Composable
private fun SemiGauge(percent: Int?) {
    val segmentColors = listOf(
        hexColor(0xEF4444), hexColor(0xF97316), hexColor(0xEAB308),
        hexColor(0x84CC16), hexColor(0x22C55E),
    )
    val position = gaugePosition(percent)
    Canvas(Modifier.width(36.dp).height(24.dp)) {
        val sizePx = 36.dp.toPx()
        val strokePx = 5.dp.toPx()
        val radius = (sizePx - strokePx) / 2f
        val centerX = sizePx / 2f
        val centerY = sizePx / 2f + 2.dp.toPx()
        val arcRect = Rect(centerX - radius, centerY - radius, centerX + radius, centerY + radius)

        // 5 equal arcs across the top half-disk: compose angles run clockwise
        // from 3 o'clock, so the half-disk is startAngle 180°..360°.
        for (seg in 0 until 5) {
            drawArc(
                color = segmentColors[seg].copy(alpha = if (seg == position) 1f else 0.4f),
                startAngle = 180f + 36f * seg,
                sweepAngle = 36f,
                useCenter = false,
                topLeft = arcRect.topLeft,
                size = arcRect.size,
                style = Stroke(width = strokePx, cap = StrokeCap.Butt),
            )
        }

        // Needle — math angle π(1 − p/100): π = left edge, 0 = right edge.
        val actual = (percent ?: 50).toDouble()
        val needleAngle = Math.PI * (1 - actual / 100.0)
        val needleLength = radius - 4.dp.toPx()
        val end = Offset(
            x = centerX + (needleLength * cos(needleAngle)).toFloat(),
            y = centerY - (needleLength * sin(needleAngle)).toFloat(),
        )
        val color = segmentColors[position.coerceIn(0, 4)]
        drawLine(color, Offset(centerX, centerY), end, strokeWidth = 2.dp.toPx(), cap = StrokeCap.Round)
        drawCircle(color, radius = 3.dp.toPx(), center = Offset(centerX, centerY))
    }
}

/** 0–100% → one of 5 colored buckets; nil → middle bucket (needle at 50). */
private fun gaugePosition(percent: Int?): Int = when {
    percent == null -> 2
    percent <= 20 -> 0
    percent <= 40 -> 1
    percent <= 60 -> 2
    percent <= 80 -> 3
    else -> 4
}

// MARK: - Helpers

private fun anyNonEmpty(vararg values: String?): Boolean = values.any { !it.isNullOrEmpty() }

/** "0.61" → 61. Mirrors RN's `toPercent`. */
private fun percent(raw: String?): Int? = raw?.toDoubleOrNull()?.let { (it * 100).roundToInt() }

// MARK: - NFL team colors

/**
 * NFL team color + initials lookup — port of the `NFLTeamColors` enum that
 * lives in iOS `NFLPublicBettingBars.swift` and is reused app-wide for NFL
 * auras/avatars. Full 32-team map keyed by both city and full team name.
 */
object NFLTeamColors {

    private val fallback = TeamColorPair(hexColor(0x6B7280), hexColor(0x9CA3AF))

    private fun pair(primary: Long, secondary: Long) = TeamColorPair(hexColor(primary), hexColor(secondary))

    private val cityMap: Map<String, TeamColorPair> = mapOf(
        "Arizona" to pair(0x97233F, 0x000000),
        "Atlanta" to pair(0xA71930, 0x000000),
        "Baltimore" to pair(0x241773, 0x9E7C0C),
        "Buffalo" to pair(0x00338D, 0xC60C30),
        "Carolina" to pair(0x0085CA, 0x101820),
        "Chicago" to pair(0x0B162A, 0xC83803),
        "Cincinnati" to pair(0xFB4F14, 0x000000),
        "Cleveland" to pair(0x311D00, 0xFF3C00),
        "Dallas" to pair(0x003594, 0x869397),
        "Denver" to pair(0xFB4F14, 0x002244),
        "Detroit" to pair(0x0076B6, 0xB0B7BC),
        "Green Bay" to pair(0x203731, 0xFFB612),
        "Houston" to pair(0x03202F, 0xA71930),
        "Indianapolis" to pair(0x002C5F, 0xA2AAAD),
        "Jacksonville" to pair(0x101820, 0xD7A22A),
        "Kansas City" to pair(0xE31837, 0xFFB81C),
        "Las Vegas" to pair(0x000000, 0xA5ACAF),
        "Los Angeles Chargers" to pair(0x0080C6, 0xFFC20E),
        "Los Angeles Rams" to pair(0x003594, 0xFFA300),
        "LA Chargers" to pair(0x0080C6, 0xFFC20E),
        "LA Rams" to pair(0x003594, 0xFFA300),
        "Miami" to pair(0x008E97, 0xFC4C02),
        "Minnesota" to pair(0x4F2683, 0xFFC62F),
        "New England" to pair(0x002244, 0xC60C30),
        "New Orleans" to pair(0x101820, 0xD3BC8D),
        "NY Giants" to pair(0x0B2265, 0xA71930),
        "NY Jets" to pair(0x125740, 0x000000),
        "Philadelphia" to pair(0x004C54, 0xA5ACAF),
        "Pittsburgh" to pair(0xFFB612, 0x101820),
        "San Francisco" to pair(0xAA0000, 0xB3995D),
        "Seattle" to pair(0x002244, 0x69BE28),
        "Tampa Bay" to pair(0xD50A0A, 0xFF7900),
        "Tennessee" to pair(0x0C2340, 0x4B92DB),
        "Washington" to pair(0x5A1414, 0xFFB612),
    )

    private val fullNameMap: Map<String, TeamColorPair> = mapOf(
        "Arizona Cardinals" to pair(0x97233F, 0x000000),
        "Atlanta Falcons" to pair(0xA71930, 0x000000),
        "Baltimore Ravens" to pair(0x241773, 0x9E7C0C),
        "Buffalo Bills" to pair(0x00338D, 0xC60C30),
        "Carolina Panthers" to pair(0x0085CA, 0x101820),
        "Chicago Bears" to pair(0x0B162A, 0xC83803),
        "Cincinnati Bengals" to pair(0xFB4F14, 0x000000),
        "Cleveland Browns" to pair(0x311D00, 0xFF3C00),
        "Dallas Cowboys" to pair(0x003594, 0x869397),
        "Denver Broncos" to pair(0xFB4F14, 0x002244),
        "Detroit Lions" to pair(0x0076B6, 0xB0B7BC),
        "Green Bay Packers" to pair(0x203731, 0xFFB612),
        "Houston Texans" to pair(0x03202F, 0xA71930),
        "Indianapolis Colts" to pair(0x002C5F, 0xA2AAAD),
        "Jacksonville Jaguars" to pair(0x101820, 0xD7A22A),
        "Kansas City Chiefs" to pair(0xE31837, 0xFFB81C),
        "Las Vegas Raiders" to pair(0x000000, 0xA5ACAF),
        "Miami Dolphins" to pair(0x008E97, 0xFC4C02),
        "Minnesota Vikings" to pair(0x4F2683, 0xFFC62F),
        "New England Patriots" to pair(0x002244, 0xC60C30),
        "New Orleans Saints" to pair(0x101820, 0xD3BC8D),
        "New York Giants" to pair(0x0B2265, 0xA71930),
        "New York Jets" to pair(0x125740, 0x000000),
        "Philadelphia Eagles" to pair(0x004C54, 0xA5ACAF),
        "Pittsburgh Steelers" to pair(0xFFB612, 0x101820),
        "San Francisco 49ers" to pair(0xAA0000, 0xB3995D),
        "Seattle Seahawks" to pair(0x002244, 0x69BE28),
        "Tampa Bay Buccaneers" to pair(0xD50A0A, 0xFF7900),
        "Tennessee Titans" to pair(0x0C2340, 0x4B92DB),
        "Washington Commanders" to pair(0x5A1414, 0xFFB612),
        "Washington Football Team" to pair(0x5A1414, 0xFFB612),
    )

    private val mascots = listOf(
        "Cardinals", "Falcons", "Ravens", "Bills", "Panthers", "Bears", "Bengals",
        "Browns", "Cowboys", "Broncos", "Lions", "Packers", "Texans", "Colts",
        "Jaguars", "Chiefs", "Raiders", "Chargers", "Rams", "Dolphins", "Vikings",
        "Patriots", "Saints", "Giants", "Jets", "Eagles", "Steelers", "49ers",
        "Seahawks", "Buccaneers", "Titans", "Commanders", "Football Team",
    )

    fun colorPair(team: String): TeamColorPair {
        if (team.isEmpty()) return fallback
        cityMap[team]?.let { return it }
        fullNameMap[team]?.let { return it }
        // Abbr / alias formats resolve through the static franchise map first.
        NFLTeams.fullName(team)?.let { full -> fullNameMap[full]?.let { return it } }
        // Strip trailing mascot → city-only key ("Kansas City Chiefs" → "Kansas City").
        for (mascot in mascots) {
            val suffix = " $mascot"
            if (team.endsWith(suffix)) {
                cityMap[team.dropLast(suffix.length)]?.let { return it }
            }
        }
        return fallback
    }

    private val initialsMap: Map<String, String> = mapOf(
        "Arizona" to "ARI", "Atlanta" to "ATL", "Baltimore" to "BAL", "Buffalo" to "BUF",
        "Carolina" to "CAR", "Chicago" to "CHI", "Cincinnati" to "CIN", "Cleveland" to "CLE",
        "Dallas" to "DAL", "Denver" to "DEN", "Detroit" to "DET", "Green Bay" to "GB",
        "Houston" to "HOU", "Indianapolis" to "IND", "Jacksonville" to "JAX", "Kansas City" to "KC",
        "Las Vegas" to "LV", "Los Angeles Chargers" to "LAC", "Los Angeles Rams" to "LAR",
        "LA Chargers" to "LAC", "LA Rams" to "LAR", "Miami" to "MIA", "Minnesota" to "MIN",
        "New England" to "NE", "New Orleans" to "NO", "NY Giants" to "NYG", "NY Jets" to "NYJ",
        "New York Giants" to "NYG", "New York Jets" to "NYJ",
        "Philadelphia" to "PHI", "Pittsburgh" to "PIT", "San Francisco" to "SF", "Seattle" to "SEA",
        "Tampa Bay" to "TB", "Tennessee" to "TEN", "Washington" to "WAS",
    )

    fun initials(team: String): String {
        if (team.isEmpty()) return "TBD"
        initialsMap[team]?.let { return it }
        for (mascot in mascots) {
            val suffix = " $mascot"
            if (team.endsWith(suffix)) {
                initialsMap[team.dropLast(suffix.length)]?.let { return it }
            }
        }
        val first = team.split(" ").firstOrNull() ?: team
        return first.take(3).uppercase(Locale.US)
    }

    /** Dark or white foreground for the gradient team disc (avg luminance heuristic). */
    fun contrastingTextColor(primary: Color, secondary: Color): Color {
        val lum = (luminance(primary) + luminance(secondary)) / 2
        return if (lum > 0.5) Color.Black else Color.White
    }

    private fun luminance(c: Color): Double =
        0.299 * c.red + 0.587 * c.green + 0.114 * c.blue
}
