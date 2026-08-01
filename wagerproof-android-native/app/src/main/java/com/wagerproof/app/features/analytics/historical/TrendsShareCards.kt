package com.wagerproof.app.features.analytics.historical

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.SportsBaseball
import androidx.compose.material.icons.rounded.SportsFootball
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.components.WagerproofTicketFooter
import com.wagerproof.app.features.gamecards.CFBTeamColors
import com.wagerproof.app.features.gamecards.MLBTeamColors
import com.wagerproof.app.features.nfl.NFLTeamColors
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.HistoricalAnalysisBetType
import com.wagerproof.core.models.HistoricalAnalysisBreakdownRow
import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.models.NFLTeamAssets
import kotlin.math.max
import kotlin.math.min

/**
 * The five shareable Historical Trends cards — port of iOS
 * `HistoricalTrendsShareView.swift` (report / poster / gauge / chart / receipt).
 *
 * Every card prints on FIXED inks, never theme tokens: the exported PNG has to
 * look the same wherever it lands, and the card stock is always dark (or, for
 * the receipt, always cream). All numbers come from [TrendsShareContext], so a
 * card can never contradict the sentence printed above it.
 */

private val Ink = Color(0xFFF8FAFC)
private val InkSecondary = Color(0xFF9AA3B2)
private val CardTop = Color(0xFF17191E)
private val CardBottom = Color(0xFF0C0D10)
private val PosterBase = Color(0xFF0B0C10)
private val Hairline = Color(0x1AFFFFFF)

/** Team identity art for team-specific searches: brand color + logo + initials. */
internal data class TrendsTeamArt(
    val team: String,
    val primary: Color,
    val logoUrl: String?,
    val initials: String,
)

/**
 * Resolves the corner-art identity for a team. Unlike iOS — which must pre-fetch
 * a UIImage because ImageRenderer draws off-screen — the Android export captures
 * the card that is already on screen, so an ordinary async image is enough: what
 * the user sees in the pager is exactly what gets exported.
 */
internal fun trendsTeamArt(
    sport: HistoricalAnalysisSport,
    team: String,
    cfbLogos: Map<String, String>,
): TrendsTeamArt {
    val (primary, logo) = when (sport) {
        HistoricalAnalysisSport.NFL -> NFLTeamColors.colorPair(team).primary to NFLTeamAssets.logo(team)
        HistoricalAnalysisSport.MLB -> MLBTeamColors.colorPair(team).primary to MLBTeams.logoUrl(team)
        HistoricalAnalysisSport.CFB -> CFBTeamColors.colorPair(team).primary to cfbLogos[team]
    }
    val initials = team.split(' ').mapNotNull { it.firstOrNull() }.take(2).joinToString("").uppercase()
    return TrendsTeamArt(
        team = team,
        primary = primary,
        logoUrl = logo,
        initials = initials.ifEmpty { team.take(2).uppercase() },
    )
}

@Composable
internal fun TrendsShareCard(
    style: TrendsShareStyle,
    ctx: TrendsShareContext,
    teamArt: TrendsTeamArt?,
    modifier: Modifier = Modifier,
) {
    when (style) {
        TrendsShareStyle.REPORT -> TrendsReportCard(ctx, modifier)
        TrendsShareStyle.POSTER -> TrendsPosterCard(ctx, modifier)
        TrendsShareStyle.GAUGE -> TrendsGaugeCard(ctx, teamArt, modifier)
        TrendsShareStyle.CHART -> TrendsChartCard(ctx, teamArt, modifier)
        TrendsShareStyle.RECEIPT -> TrendsReceiptCard(ctx, modifier)
    }
}

// MARK: - Report

/** Narrative infographic: the sentence, the hero number, splits, and top-5 lists. */
@Composable
private fun TrendsReportCard(ctx: TrendsShareContext, modifier: Modifier = Modifier) {
    val metrics = ctx.metrics
    val analysis = ctx.analysis
    val delta = metrics.hitPct - analysis.baselinePct
    val significance = HistoricalAnalysisCopy.significance(metrics.n, metrics.hitPct).first
    Column(
        modifier
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.verticalGradient(listOf(CardTop, CardBottom)))
            .border(1.dp, Hairline, RoundedCornerShape(24.dp))
            .padding(22.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        CardHeader(ctx, "${ctx.sport.shortTitle} HISTORICAL TRENDS")
        NarrativeText(ctx, fontSize = 18)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(
                "${HistoricalAnalysisCopy.trimmed(metrics.hitPct)}%",
                color = HistoricalAnalysisCopy.hitPctColor(metrics.hitPct, neutral = Ink),
                fontSize = 38.sp, fontWeight = FontWeight.Black,
            )
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                StatLine("${metrics.wins} of ${metrics.n}", HistoricalAnalysisCopy.noun(ctx.snapshot))
                metrics.roi?.let {
                    StatLine(HistoricalAnalysisCopy.signedPct(it), "ROI", if (it >= 0) AppColors.appWin else AppColors.appLoss)
                }
                if (ctx.focus is InfographicFocus.Overall) StatLine("${analysis.coverage.nGames}", "games")
            }
        }
        Text(
            "${if (delta >= 0) "+" else ""}${HistoricalAnalysisCopy.trimmed(delta)} pts vs " +
                "${HistoricalAnalysisCopy.trimmed(analysis.baselinePct)}% league baseline · $significance",
            color = InkSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium,
        )

        val bars = HistoricalAnalysisFilterBuilder.shownBars(analysis.bars, ctx.snapshot)
        if (bars.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SectionTitle("BY SITUATION")
                bars.forEach { bar ->
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            HistoricalAnalysisCopy.dimensionLabels[bar.dimension] ?: bar.dimension,
                            color = InkSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
                        )
                        bar.options.forEach { option ->
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        HistoricalAnalysisCopy.sideLabel(ctx.snapshot.betType, option.side),
                                        color = Ink, fontSize = 12.sp, fontWeight = FontWeight.Medium,
                                        modifier = Modifier.weight(1f),
                                    )
                                    Text(
                                        "${HistoricalAnalysisCopy.trimmed(option.hitPct)}% (${option.wins} of ${option.n})",
                                        color = HistoricalAnalysisCopy.hitPctColor(option.hitPct, neutral = Ink),
                                        fontSize = 12.sp, fontWeight = FontWeight.Bold,
                                    )
                                }
                                InfographicBar(option.hitPct, analysis.baselinePct, Modifier.fillMaxWidth().height(7.dp))
                            }
                        }
                    }
                }
            }
        }

        TopLists(ctx)

        Box(Modifier.fillMaxWidth().height(1.dp).background(Hairline))
        CardFooter()
    }
}

@Composable
private fun TopLists(ctx: TrendsShareContext) {
    val analysis = ctx.analysis
    val teams = TrendsShareContext.qualifyingSorted(analysis.byTeam)
    if (teams.size >= 3) {
        TopList(ctx, "TOP TEAMS IN THIS SPOT", teams.take(5), teams)
    }
    val secondary: Pair<String, List<HistoricalAnalysisBreakdownRow>> = when (ctx.sport) {
        HistoricalAnalysisSport.NFL -> "TOP COACHES" to TrendsShareContext.qualifyingSorted(analysis.byCoach.orEmpty())
        HistoricalAnalysisSport.CFB -> "TOP CONFERENCES" to TrendsShareContext.qualifyingSorted(analysis.byConference.orEmpty())
        HistoricalAnalysisSport.MLB -> "TOP VENUES" to TrendsShareContext.qualifyingSorted(analysis.byVenue.orEmpty())
    }
    if (secondary.second.size >= 3) {
        TopList(ctx, secondary.first, secondary.second.take(5), secondary.second)
    }
}

@Composable
private fun TopList(
    ctx: TrendsShareContext,
    title: String,
    rows: List<HistoricalAnalysisBreakdownRow>,
    allRows: List<HistoricalAnalysisBreakdownRow>,
) {
    // A focused team outside the top 5 still belongs on its own card — append it
    // with its true rank rather than pretending it isn't ranked.
    val focusedTeam = (ctx.focus as? InfographicFocus.Team)?.team
    val extra = if (focusedTeam != null && title.startsWith("TOP TEAMS") && rows.none { it.team == focusedTeam }) {
        allRows.indexOfFirst { it.team == focusedTeam }.takeIf { it >= 0 }?.let { it + 1 to allRows[it] }
    } else null

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionTitle(title)
        rows.forEachIndexed { index, row -> TopRow(index + 1, row, ctx, focusedTeam) }
        if (extra != null) {
            Text("···", color = InkSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 2.dp))
            TopRow(extra.first, extra.second, ctx, focusedTeam)
        }
    }
}

@Composable
private fun TopRow(rank: Int, row: HistoricalAnalysisBreakdownRow, ctx: TrendsShareContext, focusedTeam: String?) {
    val isFocused = focusedTeam != null && row.team == focusedTeam
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("$rank", color = InkSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(16.dp))
        Text(
            row.label,
            color = if (isFocused) AppColors.appPrimary else Ink,
            fontSize = 13.sp, fontWeight = if (isFocused) FontWeight.Bold else FontWeight.Medium,
            maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
        )
        InfographicBar(row.hitPct, ctx.analysis.baselinePct, Modifier.width(56.dp).height(6.dp))
        Text(
            "${HistoricalAnalysisCopy.trimmed(row.hitPct)}%",
            color = HistoricalAnalysisCopy.hitPctColor(row.hitPct, neutral = Ink),
            fontSize = 13.sp, fontWeight = FontWeight.Bold,
            textAlign = TextAlign.End, modifier = Modifier.width(44.dp),
        )
        Text("${row.n}g", color = InkSecondary, fontSize = 11.sp, textAlign = TextAlign.End, modifier = Modifier.width(28.dp))
    }
}

// MARK: - Poster

/** Big-number social poster: one giant hit rate over a color aura. Loud on purpose. */
@Composable
private fun TrendsPosterCard(ctx: TrendsShareContext, modifier: Modifier = Modifier) {
    val metrics = ctx.metrics
    val (subject, verb) = ctx.subjectVerb
    val accent = HistoricalAnalysisCopy.hitPctColor(metrics.hitPct, neutral = Ink)
    Column(
        modifier
            .clip(RoundedCornerShape(28.dp))
            .background(PosterBase)
            .drawBehind {
                drawCircle(
                    Brush.radialGradient(
                        listOf(accent.copy(alpha = .32f), Color.Transparent),
                        center = Offset(size.width * .85f, size.height * .28f),
                        radius = 260.dp.toPx(),
                    ),
                    radius = 260.dp.toPx(),
                    center = Offset(size.width * .85f, size.height * .28f),
                )
                drawCircle(
                    Brush.radialGradient(
                        listOf(AppColors.appPrimary.copy(alpha = .20f), Color.Transparent),
                        center = Offset(size.width * .05f, size.height * .95f),
                        radius = 300.dp.toPx(),
                    ),
                    radius = 300.dp.toPx(),
                    center = Offset(size.width * .05f, size.height * .95f),
                )
            }
            .border(1.dp, Hairline, RoundedCornerShape(28.dp))
            .padding(24.dp),
    ) {
        CardHeader(ctx, "${ctx.sport.shortTitle} TRENDS")
        Spacer(Modifier.height(26.dp))
        Text(
            ctx.situationLine(capitalized = true).uppercase(),
            color = InkSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold,
            letterSpacing = 1.1.sp, lineHeight = 16.sp, maxLines = 3, overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            "${HistoricalAnalysisCopy.trimmed(metrics.hitPct)}%",
            color = accent, fontSize = 74.sp, lineHeight = 80.sp, fontWeight = FontWeight.Black,
        )
        Spacer(Modifier.height(4.dp))
        Text("$subject $verb", color = Ink, fontSize = 21.sp, lineHeight = 26.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(18.dp))
        // Wrapping chips instead of iOS's ViewThatFits: a 273–197 record plus ROI
        // overflows one row on a narrow card, and a clipped record is worse than
        // a second line.
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PosterChip("${metrics.wins}–${metrics.n - metrics.wins}", "record")
                metrics.roi?.let {
                    PosterChip(HistoricalAnalysisCopy.signedPct(it), "ROI", if (it >= 0) AppColors.appWin else AppColors.appLoss)
                }
            }
            PosterChip("${metrics.n}", HistoricalAnalysisCopy.noun(ctx.snapshot))
        }
        Spacer(Modifier.height(22.dp))
        Box(Modifier.fillMaxWidth().height(1.dp).background(Hairline))
        Spacer(Modifier.height(12.dp))
        CardFooter()
    }
}

@Composable
private fun PosterChip(value: String, label: String, color: Color = Ink) {
    Row(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(Color(0x12FFFFFF))
            .border(1.dp, Hairline, RoundedCornerShape(50))
            .padding(horizontal = 11.dp, vertical = 7.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(value, color = color, fontSize = 13.sp, fontWeight = FontWeight.Black, maxLines = 1)
        Text(label, color = InkSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium, maxLines = 1)
    }
}

// MARK: - Gauge

/** Ring gauge: hit rate as a donut arc against the league baseline tick. */
@Composable
private fun TrendsGaugeCard(ctx: TrendsShareContext, teamArt: TrendsTeamArt?, modifier: Modifier = Modifier) {
    val metrics = ctx.metrics
    val (subject, verb) = ctx.subjectVerb
    val accent = HistoricalAnalysisCopy.hitPctColor(metrics.hitPct, neutral = Ink)
    GraphCardstock(teamArt, ctx.sport, accent, modifier) {
        CardHeader(ctx, "${ctx.sport.shortTitle} TRENDS")
        Spacer(Modifier.height(24.dp))
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            GaugeRing(ctx, accent)
        }
        Spacer(Modifier.height(20.dp))
        Text(
            "$subject $verb — ${ctx.situationLine(capitalized = false)}",
            color = Ink, fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            GaugeStat("${metrics.wins}–${metrics.n - metrics.wins}", "record")
            metrics.roi?.let {
                GaugeStat(HistoricalAnalysisCopy.signedPct(it), "ROI", if (it >= 0) AppColors.appWin else AppColors.appLoss)
            }
            GaugeStat("${ctx.analysis.coverage.nGames}", "games")
        }
        Spacer(Modifier.height(20.dp))
        Box(Modifier.fillMaxWidth().height(1.dp).background(Hairline))
        Spacer(Modifier.height(12.dp))
        CardFooter()
    }
}

@Composable
private fun GaugeRing(ctx: TrendsShareContext, accent: Color) {
    val metrics = ctx.metrics
    val pct = (metrics.hitPct.coerceIn(0.0, 100.0) / 100.0).toFloat()
    val baseline = (ctx.analysis.baselinePct.coerceIn(0.0, 100.0) / 100.0).toFloat()
    Box(Modifier.size(190.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(190.dp)) {
            val stroke = 17.dp.toPx()
            val radius = size.minDimension / 2f - stroke / 2f
            val topLeft = Offset(size.width / 2f - radius, size.height / 2f - radius)
            val arcSize = Size(radius * 2, radius * 2)
            drawArc(
                color = Color(0x14FFFFFF), startAngle = 0f, sweepAngle = 360f, useCenter = false,
                topLeft = topLeft, size = arcSize, style = Stroke(width = stroke),
            )
            // rotate() carries the sweep gradient with the arc, so the ramp starts
            // at 12 o'clock alongside the fill instead of at 3 o'clock.
            rotate(-90f) {
                drawArc(
                    brush = Brush.sweepGradient(listOf(accent.copy(alpha = .55f), accent, accent), center = center),
                    startAngle = 0f, sweepAngle = 360f * pct, useCenter = false,
                    topLeft = topLeft, size = arcSize,
                    style = Stroke(width = stroke, cap = StrokeCap.Round),
                )
            }
            // Baseline tick — where the league sits on the same ring. Drawn from
            // 12 o'clock OUTSIDE the arc's -90° rotation, then rotated by its own
            // share of the circle.
            rotate(360f * baseline) {
                drawLine(
                    color = Color(0xD9FFFFFF),
                    start = Offset(center.x, center.y - radius - stroke / 2f),
                    end = Offset(center.x, center.y - radius + stroke / 2f),
                    strokeWidth = 2.5.dp.toPx(),
                )
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("${HistoricalAnalysisCopy.trimmed(metrics.hitPct)}%", color = accent, fontSize = 42.sp, fontWeight = FontWeight.Black)
            Text("${metrics.wins} of ${metrics.n}", color = Ink, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            Text(HistoricalAnalysisCopy.noun(ctx.snapshot), color = InkSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun GaugeStat(value: String, label: String, color: Color = Ink) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(value, color = color, fontSize = 16.sp, fontWeight = FontWeight.Black, maxLines = 1)
        Text(label, color = InkSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = .6.sp)
    }
}

// MARK: - Chart

/** Bar-graph card: splits and top performers as chunky bars — graph first, words second. */
@Composable
private fun TrendsChartCard(ctx: TrendsShareContext, teamArt: TrendsTeamArt?, modifier: Modifier = Modifier) {
    val metrics = ctx.metrics
    val (subject, verb) = ctx.subjectVerb
    val accent = HistoricalAnalysisCopy.hitPctColor(metrics.hitPct, neutral = Ink)
    GraphCardstock(teamArt, ctx.sport, accent, modifier) {
        CardHeader(ctx, "${ctx.sport.shortTitle} TRENDS")
        Spacer(Modifier.height(18.dp))
        Text(
            buildAnnotatedString {
                append("$subject $verb ")
                withStyle(SpanStyle(color = accent, fontWeight = FontWeight.Black)) {
                    append("${HistoricalAnalysisCopy.trimmed(metrics.hitPct)}%")
                }
                withStyle(SpanStyle(color = InkSecondary)) {
                    append("  ·  ${metrics.wins}–${metrics.n - metrics.wins}")
                }
            },
            color = Ink, fontSize = 18.sp, lineHeight = 23.sp, fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(18.dp))

        val bars = HistoricalAnalysisFilterBuilder.shownBars(ctx.analysis.bars, ctx.snapshot)
        if (bars.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(13.dp)) {
                SectionTitle("BY SITUATION")
                bars.forEach { bar ->
                    bar.options.forEach { option ->
                        ChunkyBar(
                            label = HistoricalAnalysisCopy.sideLabel(ctx.snapshot.betType, option.side),
                            pct = option.hitPct,
                            detail = "${option.wins} of ${option.n}",
                            baseline = ctx.analysis.baselinePct,
                        )
                    }
                }
            }
            Spacer(Modifier.height(18.dp))
        }

        // Top performers: teams when there are enough, else the sport's secondary breakdown.
        val teams = TrendsShareContext.qualifyingSorted(ctx.analysis.byTeam)
        val (title, rows) = if (teams.size >= 3) {
            "TOP TEAMS IN THIS SPOT" to teams.take(5)
        } else when (ctx.sport) {
            HistoricalAnalysisSport.NFL ->
                "TOP COACHES" to TrendsShareContext.qualifyingSorted(ctx.analysis.byCoach.orEmpty()).take(5)
            HistoricalAnalysisSport.CFB ->
                "TOP CONFERENCES" to TrendsShareContext.qualifyingSorted(ctx.analysis.byConference.orEmpty()).take(5)
            HistoricalAnalysisSport.MLB ->
                "TOP VENUES" to TrendsShareContext.qualifyingSorted(ctx.analysis.byVenue.orEmpty()).take(5)
        }
        if (rows.size >= 3) {
            Column(verticalArrangement = Arrangement.spacedBy(11.dp)) {
                SectionTitle(title)
                rows.forEach { ChunkyBar(it.label, it.hitPct, "${it.n}g", ctx.analysis.baselinePct) }
            }
            Spacer(Modifier.height(18.dp))
        }

        Box(Modifier.fillMaxWidth().height(1.dp).background(Hairline))
        Spacer(Modifier.height(12.dp))
        CardFooter()
    }
}

@Composable
private fun ChunkyBar(label: String, pct: Double, detail: String, baseline: Double) {
    val colors = when {
        pct >= 52.4 -> listOf(AppColors.appWin.copy(alpha = .55f), AppColors.appWin)
        pct < 47.6 -> listOf(AppColors.appLoss.copy(alpha = .5f), AppColors.appLoss.copy(alpha = .85f))
        else -> listOf(Color(0x40FFFFFF), Color(0x66FFFFFF))
    }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(label, color = Ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Spacer(Modifier.width(8.dp))
            Text(detail, color = InkSecondary, fontSize = 10.sp, fontWeight = FontWeight.Medium)
        }
        Box(Modifier.fillMaxWidth().height(16.dp), contentAlignment = Alignment.CenterStart) {
            Canvas(Modifier.fillMaxWidth().height(16.dp)) {
                val h = size.height
                drawRoundRect(Color(0x12FFFFFF), size = size, cornerRadius = CornerRadius(h / 2))
                val fill = max(size.width * (pct.coerceIn(0.0, 100.0) / 100.0).toFloat(), 14.dp.toPx())
                drawRoundRect(
                    Brush.horizontalGradient(colors, startX = 0f, endX = fill),
                    size = Size(fill, h), cornerRadius = CornerRadius(h / 2),
                )
                val tick = size.width * (baseline.coerceIn(0.0, 100.0) / 100.0).toFloat()
                drawLine(Color(0xA6FFFFFF), Offset(tick, 0f), Offset(tick, h), strokeWidth = 1.5.dp.toPx())
            }
            // In-bar % label, kept inside the fill.
            BoxWithPctLabel(pct)
        }
    }
}

/** The bar's own percentage, right-aligned inside the filled portion. */
@Composable
private fun BoxWithPctLabel(pct: Double) {
    val fraction = (pct.coerceIn(0.0, 100.0) / 100.0).toFloat()
    Box(Modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth(fraction.coerceAtLeast(.16f)), contentAlignment = Alignment.CenterEnd) {
            Text(
                "${HistoricalAnalysisCopy.trimmed(pct)}%",
                color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black,
                modifier = Modifier.padding(end = 6.dp),
            )
        }
    }
}

// MARK: - Receipt

/** Betting-slip receipt on cream paper: every active filter printed as a line item. */
@Composable
private fun TrendsReceiptCard(ctx: TrendsShareContext, modifier: Modifier = Modifier) {
    val paper = Color(0xFFF3EFE4)
    val inkDark = Color(0xFF1B1D22)
    val inkMuted = Color(0xFF77716A)
    val metrics = ctx.metrics
    val (subject, verb) = ctx.subjectVerb
    val filters = ctx.filterLabels

    Column(
        modifier
            .clip(RoundedCornerShape(10.dp))
            .background(paper)
            .padding(horizontal = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(22.dp))
        Text("WAGERPROOF", color = inkDark, fontSize = 20.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black, letterSpacing = 4.sp)
        Spacer(Modifier.height(3.dp))
        Text("* HISTORICAL TRENDS RECEIPT *", color = inkMuted, fontSize = 10.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.SemiBold)

        DashedDivider(inkMuted)
        ReceiptRow("SPORT", ctx.sport.shortTitle.uppercase(), inkDark, inkMuted)
        ReceiptRow("MARKET", HistoricalAnalysisBetType.from(ctx.snapshot.betType).label.uppercase(), inkDark, inkMuted)
        ReceiptRow("SEASONS", HistoricalAnalysisCopy.yearRange(ctx.analysis.coverage.seasonMin, ctx.analysis.coverage.seasonMax), inkDark, inkMuted)
        ReceiptRow("SUBJECT", subject.uppercase(), inkDark, inkMuted)

        DashedDivider(inkMuted)
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            if (filters.isEmpty()) {
                Text("NO FILTERS — FULL HISTORY", color = inkMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.SemiBold)
            } else {
                filters.forEach { label ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                        Text(
                            label.uppercase(), color = inkDark, fontSize = 11.sp, fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text("✓", color = inkMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        DashedDivider(inkMuted)
        ReceiptRow("GAMES", "${ctx.analysis.coverage.nGames}", inkDark, inkMuted)
        ReceiptRow("RECORD", "${metrics.wins}–${metrics.n - metrics.wins}", inkDark, inkMuted)
        metrics.roi?.let { ReceiptRow("ROI", HistoricalAnalysisCopy.signedPct(it), inkDark, inkMuted) }

        Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${subject.uppercase()} ${verb.uppercase()}", color = inkDark, fontSize = 11.sp,
                fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold,
                maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                "${HistoricalAnalysisCopy.trimmed(metrics.hitPct)}%",
                // Win rate above the vig → green stamp, below water → red, else neutral.
                color = when {
                    metrics.hitPct >= 52.4 -> Color(0xFF14803C)
                    metrics.hitPct < 47.6 -> Color(0xFFB42318)
                    else -> inkDark
                },
                fontSize = 30.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black,
            )
        }

        DashedDivider(inkMuted)
        Barcode(ctx, inkDark, Modifier.fillMaxWidth().padding(horizontal = 26.dp).height(30.dp))
        Spacer(Modifier.height(6.dp))
        Text("wagerproof.bet", color = inkMuted, fontSize = 9.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(18.dp))
    }
}

@Composable
private fun ReceiptRow(label: String, value: String, inkDark: Color, inkMuted: Color) {
    Row(Modifier.fillMaxWidth().padding(vertical = 1.dp), verticalAlignment = Alignment.Top) {
        Text(label, color = inkMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.width(8.dp))
        Text(
            value, color = inkDark, fontSize = 11.sp, fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun DashedDivider(color: Color) {
    Canvas(Modifier.fillMaxWidth().height(25.dp)) {
        val dash = 4.dp.toPx()
        val gap = 3.dp.toPx()
        var x = 0f
        val y = size.height / 2f
        while (x < size.width) {
            drawLine(color.copy(alpha = .5f), Offset(x, y), Offset(min(x + dash, size.width), y), strokeWidth = 1.dp.toPx())
            x += dash + gap
        }
    }
}

/**
 * Decorative barcode. Bar widths are derived from the search itself, so each
 * receipt's code looks unique and renders identically preview → export.
 */
@Composable
private fun Barcode(ctx: TrendsShareContext, color: Color, modifier: Modifier = Modifier) {
    val seed = "${ctx.sport.raw}|${ctx.snapshot.betType}|${ctx.filterLabels.joinToString("")}"
    val widths = seed.take(44).map { (it.code % 3) + 1 }
    Canvas(modifier) {
        val gap = 1.5.dp.toPx()
        val unit = ((size.width - gap * (widths.size - 1)) / widths.sum().toFloat()).coerceAtLeast(.5f)
        var x = 0f
        widths.forEach { w ->
            val barWidth = unit * w
            drawRect(color, topLeft = Offset(x, 0f), size = Size(barWidth, size.height))
            x += barWidth + gap
        }
    }
}

// MARK: - Shared chrome

@Composable
private fun CardHeader(ctx: TrendsShareContext, title: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = AppColors.appPrimary, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
        Spacer(Modifier.weight(1f))
        Text(
            "${HistoricalAnalysisBetType.from(ctx.snapshot.betType).label} · " +
                HistoricalAnalysisCopy.yearRange(ctx.analysis.coverage.seasonMin, ctx.analysis.coverage.seasonMax),
            color = InkSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun NarrativeText(ctx: TrendsShareContext, fontSize: Int) {
    val metrics = ctx.metrics
    val (subject, verb) = ctx.subjectVerb
    Text(
        buildAnnotatedString {
            append("${ctx.narrativePrefix()}$subject $verb ")
            withStyle(
                SpanStyle(
                    color = HistoricalAnalysisCopy.hitPctColor(metrics.hitPct, neutral = Ink),
                    fontWeight = FontWeight.Black,
                ),
            ) {
                append("${HistoricalAnalysisCopy.trimmed(metrics.hitPct)}%")
            }
            append(" of the time.")
        },
        color = Ink, fontSize = fontSize.sp, lineHeight = (fontSize + 6).sp, fontWeight = FontWeight.SemiBold,
    )
}

@Composable
private fun StatLine(value: String, label: String, valueColor: Color = Ink) {
    Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.Bottom) {
        Text(value, color = valueColor, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Text(label, color = InkSecondary, fontSize = 12.sp)
    }
}

@Composable
private fun SectionTitle(title: String) {
    Text(title, color = InkSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
}

@Composable
private fun CardFooter() {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        WagerproofTicketFooter()
        Spacer(Modifier.weight(1f))
        Text("wagerproof.bet", color = InkSecondary.copy(alpha = .8f), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** Fixed-palette hit-rate bar for the dark cards (baseline tick included). */
@Composable
private fun InfographicBar(pct: Double, baseline: Double, modifier: Modifier = Modifier) {
    val fill = when {
        pct > 50 -> AppColors.appWin.copy(alpha = .65f)
        pct < 50 -> AppColors.appLoss.copy(alpha = .55f)
        else -> Color(0x59FFFFFF)
    }
    Canvas(modifier) {
        val h = size.height
        drawRoundRect(Color(0x14FFFFFF), size = size, cornerRadius = CornerRadius(h / 2))
        val width = size.width * (pct.coerceIn(0.0, 100.0) / 100.0).toFloat()
        drawRoundRect(fill, size = Size(width, h), cornerRadius = CornerRadius(h / 2))
        val tick = size.width * (baseline.coerceIn(0.0, 100.0) / 100.0).toFloat()
        drawLine(Color(0x80FFFFFF), Offset(tick, 0f), Offset(tick, h), strokeWidth = 1.5.dp.toPx())
    }
}

/**
 * Dark cardstock with a team-tinted aura and giant faded corner art — the team
 * logo when the search is team-specific, colored initials when the logo is
 * missing (CFB), otherwise the sport's ball.
 */
@Composable
private fun GraphCardstock(
    teamArt: TrendsTeamArt?,
    sport: HistoricalAnalysisSport,
    fallbackTint: Color,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val tint = teamArt?.primary ?: fallbackTint
    Box(
        modifier
            .clip(RoundedCornerShape(28.dp))
            .background(PosterBase)
            .drawBehind {
                val auraCenter = Offset(size.width * .88f, size.height * .10f)
                drawCircle(
                    Brush.radialGradient(listOf(tint.copy(alpha = .30f), Color.Transparent), center = auraCenter, radius = 300.dp.toPx()),
                    radius = 300.dp.toPx(),
                    center = auraCenter,
                )
            }
            .border(1.dp, Hairline, RoundedCornerShape(28.dp)),
    ) {
        Box(Modifier.align(Alignment.TopEnd)) { CornerArt(teamArt, sport) }
        Column(Modifier.padding(24.dp), content = content)
    }
}

@Composable
private fun CornerArt(teamArt: TrendsTeamArt?, sport: HistoricalAnalysisSport, artSize: Dp = 190.dp) {
    Box(
        Modifier
            .size(artSize)
            .offset(x = 52.dp, y = (-38).dp)
            .graphicsLayer { rotationZ = -12f },
        contentAlignment = Alignment.Center,
    ) {
        val logo = teamArt?.logoUrl
        when {
            teamArt == null -> Icon(
                if (sport == HistoricalAnalysisSport.MLB) Icons.Rounded.SportsBaseball else Icons.Rounded.SportsFootball,
                contentDescription = null,
                tint = Color(0x0DFFFFFF),
                modifier = Modifier.size(150.dp),
            )
            logo != null -> RemoteImage(
                url = logo,
                contentDescription = null,
                modifier = Modifier.size(artSize).alpha(.16f),
                contentScale = ContentScale.Fit,
                error = { TeamInitialsArt(teamArt) },
            )
            else -> TeamInitialsArt(teamArt)
        }
    }
}

@Composable
private fun TeamInitialsArt(art: TrendsTeamArt) {
    Text(art.initials, color = art.primary.copy(alpha = .30f), fontSize = 108.sp, fontWeight = FontWeight.Black)
}
