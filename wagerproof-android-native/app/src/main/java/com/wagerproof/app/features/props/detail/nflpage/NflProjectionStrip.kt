package com.wagerproof.app.features.props.detail.nflpage

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NFLPropProjection
import com.wagerproof.core.models.NFLPropVerdicts
import com.wagerproof.core.models.NFLPropFormat
import kotlin.math.abs
import kotlin.math.ceil

private val Amber = Color(0xFFF59E0B)

/**
 * WagerProof Projection widget body — the native `ModelStrip`. The verdict
 * sentence lives in the section headline; this body renders the status chip
 * plus the projection-vs-Vegas number line (probability space for ATD).
 * Mirrors iOS `NFLProjectionStrip.swift`.
 */
@Composable
fun NflProjectionStrip(
    projection: NFLPropProjection?,
    rookie: Boolean,
    marketKey: String,
    /** Today's chart line (posted close, else best over-board line). */
    line: Double?,
    /** Best over-board price, for the Vegas marker caption / ATD implied %. */
    vegasOdds: Double?,
) {
    if (rookie || projection == null) {
        Text(
            "Projection coming soon",
            color = AppColors.appTextMuted,
            fontSize = 13.sp,
            fontStyle = FontStyle.Italic,
            modifier = Modifier.fillMaxWidth(),
        )
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        StatusRow(projection)
        when (projection) {
            is NFLPropProjection.Point -> PointLine(projection.value, marketKey, line, vegasOdds)
            is NFLPropProjection.Rate -> ProbabilityLine(projection.scoreRate, vegasOdds)
        }
    }
}

@Composable
private fun StatusRow(projection: NFLPropProjection) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            "PROJECTION COMPARISON",
            color = AppColors.appTextMuted,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
        )
        Spacer(Modifier.weight(1f))
        val isModel = projection.isModel
        val tint = if (isModel) AppColors.appWin else Amber
        Text(
            if (isModel) "MODEL" else "PREVIEW",
            color = tint,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier
                .background(tint.copy(alpha = 0.14f), CircleShape)
                .padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}

@Composable
private fun PointLine(value: Double, marketKey: String, line: Double?, vegasOdds: Double?) {
    // Web PointStrip scale: padding = max(span*0.18, 1 for yardage / 0.25).
    val span = line?.let { abs(value - it) } ?: 1.0
    val unitFloor = if (marketKey.contains("yds")) 1.0 else 0.25
    val padding = maxOf(maxOf(span, 1.0) * 0.18, unitFloor)
    val (primaryFraction, secondaryFraction) = nflPropNumberLineFractions(value, line, padding)
    val delta = line?.let { value - it }
    val tone = when {
        delta == null || delta == 0.0 -> NflPropNumberLineTone.NEUTRAL
        delta > 0 -> NflPropNumberLineTone.UP
        else -> NflPropNumberLineTone.DOWN
    }
    val unit = NFLPropVerdicts.shortUnit(marketKey)

    NflPropNumberLine(
        primary = NflPropNumberLineMarker(
            label = "WagerProof",
            value = NFLPropFormat.perGame(value),
            unit = unit.ifEmpty { null },
        ),
        primaryFraction = primaryFraction,
        secondary = line?.let {
            NflPropNumberLineMarker(
                label = "Vegas line",
                value = NFLPropFormat.perGame(it),
                caption = vegasOdds?.let(NFLPropFormat::american),
            )
        },
        secondaryFraction = secondaryFraction,
        tone = tone,
        deltaText = delta?.takeIf { it != 0.0 }?.let { d ->
            val digits = if (abs(d) < 1) 2 else 1
            val suffix = if (unit.isEmpty()) "" else " $unit"
            "${if (d > 0) "+" else "-"}${NFLPropFormat.perGame(abs(d), digits)}$suffix"
        },
        leadingCaption = "Lower total",
        trailingCaption = "Higher total",
    )
}

@Composable
private fun ProbabilityLine(scoreRate: Double, vegasOdds: Double?) {
    val modelPct = scoreRate * 100
    val fairOdds = NFLPropFormat.probabilityToAmerican(scoreRate)
    val vegasPct = vegasOdds?.let(NFLPropFormat::americanToProbability)?.let { it * 100 }
    // Web TouchdownOddsComparison scale: padding = max(0.5, gap*0.5); the
    // no-Vegas domain runs 0…max(20, model rounded up to 5s).
    val padding = if (vegasPct != null) {
        maxOf(0.5, abs(modelPct - vegasPct) * 0.5)
    } else {
        maxOf(20.0, ceil(modelPct / 5) * 5) - modelPct
    }
    val (primaryFraction, secondaryFraction) =
        nflPropNumberLineFractions(modelPct, vegasPct, maxOf(padding, 0.5))
    val delta = vegasPct?.let { modelPct - it }
    val tone = when {
        delta == null -> NflPropNumberLineTone.NEUTRAL
        delta > 0.05 -> NflPropNumberLineTone.UP
        delta < -0.05 -> NflPropNumberLineTone.DOWN
        else -> NflPropNumberLineTone.NEUTRAL
    }

    NflPropNumberLine(
        primary = NflPropNumberLineMarker(
            label = "WagerProof",
            value = "${NFLPropFormat.perGame(modelPct)}%",
            caption = fairOdds?.let(NFLPropFormat::american),
        ),
        primaryFraction = primaryFraction,
        secondary = vegasPct?.let {
            NflPropNumberLineMarker(
                label = "Vegas",
                value = "${NFLPropFormat.perGame(it)}%",
                caption = vegasOdds?.let(NFLPropFormat::american),
            )
        },
        secondaryFraction = secondaryFraction,
        tone = tone,
        deltaText = delta?.let { "${if (it > 0) "+" else ""}${NFLPropFormat.perGame(it)} pts" },
        leadingCaption = "No score",
        trailingCaption = "Scores TD",
        primaryValueSize = 20f,
    )
}
