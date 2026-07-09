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
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
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
import kotlin.math.roundToInt
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
    val isBreakdown = model.oddsBreakdown != null

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
            .shadow(
                elevation = if (model.isMammoth) 10.dp else 4.dp,
                shape = shape,
                ambientColor = if (model.isMammoth) MammothOrange.copy(alpha = 0.32f) else Color.Black.copy(alpha = 0.06f),
                spotColor = if (model.isMammoth) MammothOrange.copy(alpha = 0.32f) else Color.Black.copy(alpha = 0.06f),
            )
            .semantics(mergeDescendants = true) {
                role = Role.Button
                contentDescription = "${model.away.abbr} at ${model.home.abbr}, ${model.dateLabel}, ${model.timeLabel}. Open game details"
            }
            .clickable {
                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                onPress()
            }
            // These asymmetric insets are intentional. They are the exact iOS
            // card geometry: the diagonal away logo is concentric with the
            // 26pt corner while the market chart sits tight to the trailing
            // edge. A blanket 14dp inset made the 344dp MLB scan row overflow
            // on 393dp phones and was the source of the clipped columns.
            .padding(
                start = if (isBreakdown) BreakdownMetrics.contentInset else 12.dp,
                top = if (isBreakdown) BreakdownMetrics.contentInset else 9.dp,
                end = if (isBreakdown) 16.dp else 6.dp,
                bottom = 9.dp,
            ),
    ) {
        if (model.oddsBreakdown != null) {
            BreakdownLayout(model)
        } else {
            StandardLayout(model)
        }
        if (model.oddsBreakdown == null) {
            TimePill(model.timeLabel, Modifier.align(Alignment.TopEnd))
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
    val hs = model.home.spread
    val as_ = model.away.spread
    val spread = when {
        hs != null && as_ != null && hs < as_ -> model.home.abbr to hs
        hs != null && as_ != null && as_ < hs -> model.away.abbr to as_
        hs != null && as_ != null -> "SPRD" to hs
        hs != null && hs <= 0 -> model.home.abbr to hs
        hs != null -> model.away.abbr to -hs
        as_ != null && as_ <= 0 -> model.away.abbr to as_
        as_ != null -> model.home.abbr to -as_
        else -> "SPRD" to null
    }
    Column(horizontalAlignment = Alignment.End) {
        LinePill(label = spread.first, value = GameCardFormatting.formatSpread(spread.second))
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
        BreakdownScanRegion(model, bd)
        BottomRow(model)
    }
}

@Composable
private fun BreakdownScanRegion(model: GameRowCardModel, bd: GameRowCardModel.OddsBreakdown) {
    // iOS overlaps the labels into the six points of centering whitespace under
    // the 60dp diagonal-logo block. A fixed 64dp region expresses that same
    // geometry in Compose without adding six unwanted dp to every card.
    Box(Modifier.fillMaxWidth().height(BreakdownMetrics.scanRegionH)) {
        Row(
            Modifier.fillMaxWidth().height(BreakdownMetrics.logoBlockH),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            DiagonalLogos(model)
            SixPackGroup(model, bd)
            PolymarketSparkline(
                league = model.league,
                awayTeam = model.awayTeamFullName ?: model.away.abbr,
                homeTeam = model.homeTeamFullName ?: model.home.abbr,
                awayColor = model.away.colors.primary,
                homeColor = model.home.colors.primary,
                awayAbbr = model.away.abbr,
                homeAbbr = model.home.abbr,
                modifier = Modifier.width(BreakdownMetrics.sparkW).height(BreakdownMetrics.chartH),
            )
        }
        BreakdownLabelsRow(Modifier.align(Alignment.BottomStart))
    }
}

@Composable
private fun DiagonalLogos(model: GameRowCardModel) {
    Box(Modifier.width(BreakdownMetrics.logoColW).height(BreakdownMetrics.logoBlockH)) {
        GlassAvatar(model.away, BreakdownMetrics.logoSize, Modifier.align(Alignment.TopStart))
        GlassAvatar(
            model.home,
            BreakdownMetrics.logoSize,
            Modifier.align(Alignment.TopStart).offset(
                x = BreakdownMetrics.logoXOffset,
                y = BreakdownMetrics.rowPitch,
            ),
        )
    }
}

@Composable
private fun SixPackGroup(model: GameRowCardModel, bd: GameRowCardModel.OddsBreakdown) {
    Row(
        Modifier.width(BreakdownMetrics.sixPackW),
        horizontalArrangement = Arrangement.spacedBy(BreakdownMetrics.innerGap),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AbbrColumn(model.away.abbr, model.home.abbr)
        BdColumn(bd.awaySpread, bd.homeSpread)
        BdColumn(bd.awayML, bd.homeML)
        BdColumn(bd.awayTotal, bd.homeTotal)
    }
}

@Composable
private fun AbbrColumn(away: String, home: String) {
    Column(Modifier.width(BreakdownMetrics.abbrW)) {
        AbbrCell(away)
        AbbrCell(home)
    }
}

@Composable
private fun AbbrCell(text: String) {
    Box(Modifier.fillMaxWidth().height(BreakdownMetrics.rowPitch), contentAlignment = Alignment.CenterStart) {
        Text(
            text,
            color = AppColors.appTextSecondary,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
        )
    }
}

@Composable
private fun BdColumn(away: String, home: String) {
    Column(Modifier.width(BreakdownMetrics.cellW), horizontalAlignment = Alignment.CenterHorizontally) {
        BdCell(away)
        BdCell(home)
    }
}

@Composable
private fun BdCell(text: String) {
    Box(
        Modifier
            .width(BreakdownMetrics.cellW)
            .height(BreakdownMetrics.rowPitch)
            .clip(RoundedCornerShape(6.dp))
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.6f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.6f), RoundedCornerShape(6.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text,
            color = AppColors.appTextPrimary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            maxLines = 1,
        )
    }
}

@Composable
private fun BreakdownLabelsRow(modifier: Modifier = Modifier) {
    Row(
        modifier.fillMaxWidth().height(BreakdownMetrics.labelH),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Spacer(Modifier.width(BreakdownMetrics.logoColW))
        Row(
            Modifier.width(BreakdownMetrics.sixPackW),
            horizontalArrangement = Arrangement.spacedBy(BreakdownMetrics.innerGap),
        ) {
            Spacer(Modifier.width(BreakdownMetrics.abbrW))
            BreakdownHeader("Spread", BreakdownMetrics.cellW)
            BreakdownHeader("ML", BreakdownMetrics.cellW)
            BreakdownHeader("TOT", BreakdownMetrics.cellW)
        }
        BreakdownHeader("PRED MKT", BreakdownMetrics.sparkW)
    }
}

@Composable
private fun BreakdownHeader(text: String, width: androidx.compose.ui.unit.Dp) {
    Text(
        text,
        color = AppColors.appTextMuted,
        fontSize = 8.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.4.sp,
        textAlign = TextAlign.Center,
        maxLines = 1,
        modifier = Modifier.width(width),
    )
}

private object BreakdownMetrics {
    val logoSize = 38.dp
    val logoXOffset = 19.dp
    val rowPitch = 22.dp
    val logoColW = 57.dp
    val logoBlockH = 60.dp
    val abbrW = 33.dp
    val cellW = 44.dp
    val innerGap = 4.dp
    val sixPackW = 177.dp
    val sparkW = 98.dp
    val chartH = 52.dp
    val scanRegionH = 64.dp
    val labelH = 10.dp
    val contentInset = 7.dp
}

// MARK: - Bottom row (edge pills OR slate picks)

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun BottomRow(model: GameRowCardModel) {
    Spacer(Modifier.height(8.dp))
    Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.4f)))
    Spacer(Modifier.height(8.dp))

    val slate = model.slatePicks
    if (slate != null) {
        // iOS reserves the trailing time first, then gives the picks/badges a
        // two-row leading stack. The old flattened Row let picks and badges
        // consume every pixel; TimePill then wrapped character-by-character
        // and inflated some NFL cards to almost 300dp tall.
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Column(
                Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    slate.totalLabel?.let { label ->
                        val color = when (slate.totalIsOver) {
                            true -> PickOverGreen
                            false -> PickUnderRed
                            null -> AppColors.appTextSecondary
                        }
                        SlatePickPill {
                            Text(label, color = color, fontSize = 10.sp, fontWeight = FontWeight.Black, maxLines = 1, softWrap = false)
                        }
                    }
                    slate.spreadLabel?.let { label ->
                        SlatePickPill {
                            slate.spreadLogoURL?.let {
                                RemoteImage(it, "spread pick", Modifier.size(18.dp).clip(CircleShape))
                            }
                            Text(label, color = AppColors.appTextPrimary, fontSize = 10.sp, fontWeight = FontWeight.Black, maxLines = 1, softWrap = false)
                        }
                    }
                }
                if (slate.hasMammoth || slate.highCount > 0 || slate.signalCount > 0) {
                    ConvictionBadges(slate.hasMammoth, slate.highCount, slate.signalCount)
                }
            }
            if (model.oddsBreakdown != null) TimePill(model.timeLabel)
        }
    } else {
        Row(verticalAlignment = Alignment.CenterVertically) {
            EdgePill("O/U") {
                val ou = model.ouEdge
                if (ou == null) {
                    Text("—", color = AppColors.appTextMuted, fontSize = 10.sp)
                } else {
                    Text(if (ou.isOver) "OVER" else "UNDER", color = ou.color, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    ou.delta?.let { delta ->
                        Text("${if (delta >= 0) "+" else ""}${String.format("%.1f", delta)}", color = ou.color, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                    }
                    ou.probability?.let { probability ->
                        Text("${(probability * 100).roundToInt()}%", color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace)
                    }
                }
            }
            Spacer(Modifier.width(6.dp))
            EdgePill("ML") {
                val ml = model.mlEdge
                if (ml == null) {
                    Text("—", color = AppColors.appTextMuted, fontSize = 10.sp)
                } else {
                    Text(ml.abbr, color = AppColors.appTextPrimary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text("+${String.format("%.1f", abs(ml.edgePoints))}%", color = ml.color, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                }
            }
            Spacer(Modifier.weight(1f))
            if (model.oddsBreakdown != null) TimePill(model.timeLabel)
        }
    }
}

@Composable
private fun SlatePickPill(content: @Composable RowScope.() -> Unit) {
    Row(
        Modifier
            .clip(CircleShape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.6f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.6f), CircleShape)
            .padding(horizontal = 8.dp, vertical = 5.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

@Composable
private fun EdgePill(label: String, content: @Composable RowScope.() -> Unit) {
    Row(
        Modifier
            .clip(CircleShape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.6f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.6f), CircleShape)
            .padding(horizontal = 8.dp, vertical = 5.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        content()
    }
}

@Composable
private fun TimePill(label: String, modifier: Modifier = Modifier) {
    Text(
        label,
        color = AppColors.appTextSecondary,
        fontSize = 9.sp,
        fontWeight = FontWeight.Bold,
        fontFamily = FontFamily.Monospace,
        maxLines = 1,
        softWrap = false,
        modifier = modifier
            .clip(CircleShape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.65f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.6f), CircleShape)
            .padding(horizontal = 7.dp, vertical = 3.dp),
    )
}

/** Mammoth/high-conviction and signal badges may coexist, matching iOS. */
@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun ConvictionBadges(hasMammoth: Boolean, highCount: Int, signalCount: Int) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (hasMammoth) {
            Row(
                Modifier
                    .clip(CircleShape)
                    .background(Brush.horizontalGradient(listOf(MammothOrange, MammothGold)))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("🔥 MAMMOTH PLAY", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black, maxLines = 1, softWrap = false)
            }
        } else if (highCount > 0) {
            BadgePill("🔥 $highCount High Conviction", MammothOrange)
        }
        if (signalCount > 0) BadgePill("⚡ $signalCount Signals", AppColors.appTextSecondary)
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
        Text(text, color = tint, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1, softWrap = false)
    }
}

// MARK: - Glass avatar (with luminance contrast plate)

@Composable
fun GlassAvatar(side: GameRowCardModel.TeamSide, diameter: androidx.compose.ui.unit.Dp, modifier: Modifier = Modifier) {
    val tint = side.colors.primary.teamVisible(0.5f)
    val contrastPlate = side.logoURL != null && side.colors.primary.luminance() < 0.45f
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
            modifier = Modifier
                .size(diameter * 0.82f)
                .then(if (contrastPlate) Modifier.background(Color.White.copy(alpha = 0.15f), CircleShape) else Modifier),
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
                if (leaderPct != null) "$leaderAbbr $leaderPct%" else "POLY ML",
                color = if (leaderPct != null) leaderColor else AppColors.appTextMuted,
                fontSize = 8.sp, fontWeight = FontWeight.Bold,
            )
        }
        Spacer(Modifier.height(2.dp))
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when {
                !loaded -> Box(Modifier.fillMaxWidth().height(20.dp).clip(RoundedCornerShape(6.dp)).background(AppColors.appSkeleton))
                points.size < 2 -> Text("—", color = AppColors.appTextMuted, fontSize = 12.sp, modifier = Modifier.align(Alignment.Center))
                else -> androidx.compose.foundation.Canvas(Modifier.fillMaxWidth().height(24.dp)) {
                    val awayValues = points.map { it.p.toFloat() }
                    val homeValues = awayValues.map { 1f - it }
                    val combined = awayValues + homeValues
                    val minP = combined.min()
                    val maxP = combined.max()
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
                    drawPath(path(awayValues), awayVis, alpha = if (awayLead) 1f else 0.55f, style = Stroke(width = if (awayLead) 1.8.dp.toPx() else 1.0.dp.toPx(), cap = StrokeCap.Round))
                    drawPath(path(homeValues), homeVis, alpha = if (awayLead) 0.55f else 1f, style = Stroke(width = if (awayLead) 1.0.dp.toPx() else 1.8.dp.toPx(), cap = StrokeCap.Round))
                }
            }
        }
    }
}
