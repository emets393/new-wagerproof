package com.wagerproof.app.features.gamecards

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.components.LiquidGlassCapsule
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.PolymarketGameMarkets
import com.wagerproof.core.services.PolymarketService
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * The universal feed card — port of iOS `GameCards/Components/GameRowCard.swift`.
 *
 * Two layouts driven by [GameRowCardModel.oddsBreakdown]:
 *  - null → standard row (overlapping glass avatars + line pills + sparkline)
 *  - non-null → scan-line breakdown table (MLB always; NFL/CFB/NBA/NCAAB too)
 *
 * Glass-disc metaball fusion has no Compose primitive (FIDELITY-WAIVER: renders
 * as overlapping tinted discs, the iOS pre-26 fallback).
 */
@Composable
fun GameRowCard(
    model: GameRowCardModel,
    onPress: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val haptics = LocalHapticFeedback.current
    val shape = RoundedCornerShape(26.dp)

    val container = if (model.isMammoth) {
        Modifier
            .clip(shape)
            .background(
                Brush.verticalGradient(
                    listOf(MammothOrange.copy(alpha = 0.20f), MammothOrange.copy(alpha = 0.08f)),
                ),
            )
            .border(1.2.dp, MammothOrange.copy(alpha = 0.55f), shape)
    } else {
        Modifier
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.55f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.4f), shape)
    }

    Box(
        modifier
            .fillMaxWidth()
            .then(container)
            .then(if (model.isMammoth) Modifier.mammothElectricBorder(shape) else Modifier)
            .clickable {
                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                onPress()
            }
            .padding(14.dp),
    ) {
        if (model.oddsBreakdown != null) {
            BreakdownLayout(model)
        } else {
            StandardLayout(model)
        }
    }
}

// MARK: - Standard layout

@Composable
private fun StandardLayout(model: GameRowCardModel) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TeamsBlock(model, Modifier.width(96.dp))
            Spacer(Modifier.weight(1f))
            LinesBlock(model)
            Spacer(Modifier.width(10.dp))
            PolymarketSparkline(
                league = model.league,
                awayTeam = model.awayTeamFullName ?: model.away.abbr,
                homeTeam = model.homeTeamFullName ?: model.home.abbr,
                awayColor = model.away.colors.primary,
                homeColor = model.home.colors.primary,
                awayAbbr = model.away.abbr,
                homeAbbr = model.home.abbr,
                modifier = Modifier.width(98.dp).height(38.dp),
            )
        }
        BottomRow(model)
    }
}

@Composable
private fun TeamsBlock(model: GameRowCardModel, modifier: Modifier = Modifier) {
    Column(modifier) {
        Row {
            GlassAvatar(model.away, 34.dp)
            Spacer(Modifier.width((-10).dp))
            GlassAvatar(model.home, 34.dp)
        }
        Spacer(Modifier.height(6.dp))
        Text(
            text = "${model.away.abbr} @ ${model.home.abbr}",
            color = AppColors.appTextPrimary,
            fontSize = 9.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Row {
            MlChip(model.away.moneyline)
            Spacer(Modifier.width(6.dp))
            MlChip(model.home.moneyline)
        }
    }
}

@Composable
private fun MlChip(ml: Int?) {
    val color = when {
        ml == null -> AppColors.appTextMuted
        ml < 0 -> AppColors.appAccentBlue
        else -> AppColors.appPrimary
    }
    Text(
        text = GameCardFormatting.formatMoneyline(ml),
        color = color,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        fontFamily = FontFamily.Monospace,
    )
}

@Composable
private fun LinesBlock(model: GameRowCardModel) {
    val favAbbr = if ((model.home.spread ?: 0.0) < 0) model.home.abbr else model.away.abbr
    val favSpread = min(model.home.spread ?: 0.0, model.away.spread ?: 0.0)
    Column(horizontalAlignment = Alignment.End) {
        LinePill(label = favAbbr, value = GameCardFormatting.formatSpread(favSpread))
        Spacer(Modifier.height(4.dp))
        LinePill(
            label = "O/U",
            value = GameCardFormatting.roundToNearestHalf(model.overLine)?.let {
                if (it == it.toLong().toDouble()) it.toLong().toString() else it.toString()
            } ?: "—",
        )
    }
}

@Composable
private fun LinePill(label: String, value: String) {
    Row(
        Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.6f))
            .border(0.5.dp, AppColors.appBorder, RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.width(4.dp))
        Text(
            value,
            color = AppColors.appTextPrimary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
        )
    }
}

// MARK: - Breakdown layout (scan-line table)

@Composable
private fun BreakdownLayout(model: GameRowCardModel) {
    val bd = model.oddsBreakdown!!
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Diagonal logos (away upper-left, home lower-right).
            Box(Modifier.size(56.dp)) {
                GlassAvatar(model.away, 38.dp, Modifier.align(Alignment.TopStart))
                GlassAvatar(model.home, 38.dp, Modifier.align(Alignment.BottomEnd))
            }
            Spacer(Modifier.width(8.dp))
            Column(Modifier.width(36.dp)) {
                Text(model.away.abbr, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(10.dp))
                Text(model.home.abbr, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.width(6.dp))
            BdColumn(bd.awaySpread, bd.homeSpread)
            BdColumn(bd.awayML, bd.homeML)
            BdColumn(bd.awayTotal, bd.homeTotal)
            Spacer(Modifier.weight(1f))
            PolymarketSparkline(
                league = model.league,
                awayTeam = model.awayTeamFullName ?: model.away.abbr,
                homeTeam = model.homeTeamFullName ?: model.home.abbr,
                awayColor = model.away.colors.primary,
                homeColor = model.home.colors.primary,
                awayAbbr = model.away.abbr,
                homeAbbr = model.home.abbr,
                modifier = Modifier.width(98.dp).height(52.dp),
            )
        }
        Spacer(Modifier.height(4.dp))
        Row {
            Spacer(Modifier.width(106.dp))
            listOf("Spread", "ML", "TOT").forEach {
                Box(Modifier.width(44.dp)) {
                    Text(it, color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                }
            }
        }
        BottomRow(model)
    }
}

@Composable
private fun BdColumn(away: String, home: String) {
    Column(Modifier.width(44.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        BdCell(away)
        Spacer(Modifier.height(4.dp))
        BdCell(home)
    }
}

@Composable
private fun BdCell(text: String) {
    Box(
        Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.6f))
            .padding(horizontal = 6.dp, vertical = 3.dp),
    ) {
        Text(text, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
    }
}

// MARK: - Bottom row (edge pills OR slate picks)

@Composable
private fun BottomRow(model: GameRowCardModel) {
    Spacer(Modifier.height(8.dp))
    Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.4f)))
    Spacer(Modifier.height(8.dp))

    val slate = model.slatePicks
    if (slate != null) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            slate.totalLabel?.let { label ->
                val color = when (slate.totalIsOver) {
                    true -> PickOverGreen
                    false -> PickUnderRed
                    null -> AppColors.appTextSecondary
                }
                Text(label, color = color, fontSize = 13.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.width(10.dp))
            }
            slate.spreadLabel?.let { label ->
                slate.spreadLogoURL?.let {
                    RemoteImage(it, "spread pick", Modifier.size(22.dp).clip(CircleShape))
                    Spacer(Modifier.width(4.dp))
                }
                Text(label, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.weight(1f))
            ConvictionBadges(slate.hasMammoth, slate.highCount, slate.signalCount)
        }
    } else {
        Row(verticalAlignment = Alignment.CenterVertically) {
            model.ouEdge?.let { ou ->
                Text(
                    "O/U ${if (ou.isOver) "OVER" else "UNDER"} " +
                        "${if (ou.delta >= 0) "+" else ""}${String.format("%.1f", ou.delta)} " +
                        "${(ou.probability * 100).toInt()}%",
                    color = ou.color, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace,
                )
                Spacer(Modifier.width(12.dp))
            }
            model.mlEdge?.let { ml ->
                Text(
                    "ML ${ml.abbr} +${String.format("%.1f", ml.edgePoints)}%",
                    color = ml.color, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace,
                )
            }
        }
    }
}

/** Mammoth trumps high conviction; high trumps generic signals. */
@Composable
private fun ConvictionBadges(hasMammoth: Boolean, highCount: Int, signalCount: Int) {
    when {
        hasMammoth -> Row(
            Modifier
                .clip(CircleShape)
                .background(Brush.horizontalGradient(listOf(MammothOrange, MammothGold)))
                .padding(horizontal = 10.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("🔥 MAMMOTH PLAY", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black)
        }
        highCount > 0 -> BadgePill("🔥 $highCount High Conviction", MammothOrange)
        signalCount > 0 -> BadgePill("⚡ $signalCount Signals", AppColors.appTextSecondary)
    }
}

@Composable
private fun BadgePill(text: String, tint: Color) {
    Box(
        Modifier
            .clip(CircleShape)
            .background(tint.copy(alpha = 0.15f))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(text, color = tint, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

// MARK: - Glass avatar (with luminance contrast plate)

@Composable
fun GlassAvatar(side: GameRowCardModel.TeamSide, diameter: androidx.compose.ui.unit.Dp, modifier: Modifier = Modifier) {
    val tint = side.colors.primary.teamVisible(0.5f)
    Box(
        modifier
            .size(diameter)
            .clip(CircleShape)
            .background(
                Brush.linearGradient(listOf(tint.copy(alpha = 0.55f), side.colors.secondary.copy(alpha = 0.35f))),
            )
            .border(1.dp, Color.White.copy(alpha = 0.18f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        RemoteImage(
            url = side.logoURL,
            contentDescription = side.abbr,
            modifier = Modifier.size(diameter * 0.82f),
            error = {
                Text(side.initials, color = Color.White, fontWeight = FontWeight.Bold, fontSize = (diameter.value * 0.34f).sp)
            },
        )
    }
}

// MARK: - Mammoth electric border (30fps spin + sine pulse)

/** Spinning angular ring + pulsing opacity — the iOS `MammothElectricBorder`. */
fun Modifier.mammothElectricBorder(shape: androidx.compose.ui.graphics.Shape): Modifier =
    composed {
        val transition = rememberInfiniteTransition(label = "mammoth")
        // 95°/s spin → full turn ≈ 3.79s.
        val angle by transition.animateFloat(
            0f, 360f,
            infiniteRepeatable(tween(3789, easing = LinearEasing), RepeatMode.Restart),
            label = "spin",
        )
        val pulse by transition.animateFloat(
            0f, (2 * Math.PI).toFloat(),
            infiniteRepeatable(tween(1142, easing = LinearEasing), RepeatMode.Restart),
            label = "pulse",
        )
        val pulseAlpha = 0.55f + 0.45f * sin(5.5f * pulse)
        drawBehind {
            val stroke = Stroke(width = 2.5.dp.toPx())
            val brush = Brush.sweepGradient(
                listOf(MammothOrange, MammothGold, MammothOrange),
                center = center,
            )
            val outline = shape.createOutline(size, layoutDirection, this)
            rotate(angle, pivot = center) {
                drawOutline(outline, brush = brush, alpha = pulseAlpha, style = stroke)
            }
        }
    }

// MARK: - Polymarket sparkline

@Composable
fun PolymarketSparkline(
    league: String,
    awayTeam: String,
    homeTeam: String,
    awayColor: Color,
    homeColor: Color,
    awayAbbr: String,
    homeAbbr: String,
    modifier: Modifier = Modifier,
) {
    var markets by remember(league, awayTeam, homeTeam) { mutableStateOf<PolymarketGameMarkets?>(null) }
    var loaded by remember(league, awayTeam, homeTeam) { mutableStateOf(false) }

    LaunchedEffect(league, awayTeam, homeTeam) {
        markets = PolymarketService.shared.markets(league, awayTeam, homeTeam)
        loaded = true
    }

    val ml = markets?.moneyline
    val points = ml?.priceHistory?.takeLast(40) ?: emptyList()

    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        // Leader badge.
        val leaderIsAway = (points.lastOrNull()?.p ?: 0.5) >= 0.5
        val leaderColor = (if (leaderIsAway) awayColor else homeColor).teamVisible(0.72f)
        val leaderAbbr = if (leaderIsAway) awayAbbr else homeAbbr
        val leaderPct = points.lastOrNull()?.let {
            if (leaderIsAway) (it.p * 100).toInt() else ((1 - it.p) * 100).toInt()
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(5.dp).clip(CircleShape).background(leaderColor))
            Spacer(Modifier.width(3.dp))
            Text(
                if (points.size >= 2 && leaderPct != null) "$leaderAbbr $leaderPct%" else "POLY ML",
                color = if (points.size >= 2) leaderColor else AppColors.appTextMuted,
                fontSize = 8.sp, fontWeight = FontWeight.Bold,
            )
        }
        Spacer(Modifier.height(2.dp))
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when {
                !loaded -> Box(Modifier.fillMaxWidth().height(20.dp).clip(RoundedCornerShape(6.dp)).background(AppColors.appSkeleton))
                points.size < 2 -> Text("—", color = AppColors.appTextMuted, fontSize = 12.sp, modifier = Modifier.align(Alignment.Center))
                else -> androidx.compose.foundation.Canvas(Modifier.fillMaxWidth().height(24.dp)) {
                    val ps = points.map { it.p.toFloat() }
                    val minP = ps.min()
                    val maxP = ps.max()
                    val range = max(maxP - minP, 0.01f)
                    fun path(values: List<Float>): androidx.compose.ui.graphics.Path {
                        val p = androidx.compose.ui.graphics.Path()
                        values.forEachIndexed { i, v ->
                            val x = size.width * i / (values.size - 1)
                            val y = size.height * (1f - (v - minP) / range)
                            if (i == 0) p.moveTo(x, y) else p.lineTo(x, y)
                        }
                        return p
                    }
                    val awayVis = awayColor.teamVisible(0.72f)
                    val homeVis = homeColor.teamVisible(0.72f)
                    val awayLead = leaderIsAway
                    drawPath(path(ps), homeVis, alpha = if (awayLead) 0.55f else 1f, style = Stroke(width = if (awayLead) 1.0.dp.toPx() else 1.8.dp.toPx(), cap = StrokeCap.Round))
                    drawPath(path(ps.map { 1f - it }), awayVis, alpha = if (awayLead) 1f else 0.55f, style = Stroke(width = if (awayLead) 1.8.dp.toPx() else 1.0.dp.toPx(), cap = StrokeCap.Round))
                }
            }
        }
    }
}
