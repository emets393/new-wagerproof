package com.wagerproof.app.features.props.detail.nflpage

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NFLPropFPModel
import com.wagerproof.core.models.NFLPropReport
import com.wagerproof.core.models.NFLPropResearch
import kotlin.math.abs

private val Green = AppColors.appWin
private val Red = AppColors.appLoss

/**
 * Fantasy-Points prop model + Player Prop Report for one market.
 *
 * ADDITIVE to [NflProjectionStrip], never a replacement. The two cover different ground: the
 * projection runs on nearly every player and market, this runs on roughly a third of players
 * across five markets, because the rest were backtested and killed. Callers must gate on
 * [NFLPropResearch.hasContent] — this renders nothing when there is no data, rather than an
 * empty shell. Mirrors iOS `NFLPropResearchStrip.swift` and web `FpResearchStrip.tsx`.
 */
@Composable
fun NflPropResearchStrip(research: NFLPropResearch?) {
    val model = research?.model
    val report = research?.report
    if (model == null && report == null) return

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        model?.let { ModelBlock(it) }
        report?.let {
            if (model != null) HorizontalDivider(color = AppColors.appBorder.copy(alpha = 0.4f))
            ReportBlock(it)
        }
    }
}

@Composable
private fun ModelBlock(m: NFLPropFPModel) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Chip(
                text = if (m.fires) "EDGE LIVE" else "NO EDGE",
                tint = if (m.fires) Green else AppColors.appTextSecondary,
            )
            // `tier` is a backtested hit rate like "61.0%", or the word "robust" where no single
            // rate was pinned — only show it when it actually reads as a rate.
            if (m.fires && m.tier.any { it.isDigit() }) {
                Spacer(Modifier.width(6.dp))
                Text(
                    m.tier,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Green,
                )
            }
        }

        Text(
            sentence(m),
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.appTextPrimary,
        )

        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Chip(
                text = "${if (m.edge > 0) "+" else ""}${fmt(m.edge)} edge",
                tint = if (m.edge > 0) Green else Red,
            )
            Chip(text = "needs ${fmt(m.threshold)}", tint = AppColors.appTextSecondary)
        }
    }
}

private fun sentence(m: NFLPropFPModel): String {
    val line = m.line ?: return "Projects ${fmt(m.pred)}."
    val side = if (m.edge > 0) "over" else "under"
    return "Projects ${fmt(m.pred)} against a ${fmt(line)} line — ${fmt(abs(m.edge))} $side."
}

@Composable
private fun ReportBlock(r: NFLPropReport) {
    val isUnder = r.read.lowercase() == "under"
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "PLAYER PROP REPORT",
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.sp,
                color = AppColors.appTextSecondary,
            )
            Spacer(Modifier.width(8.dp))
            Chip(
                text = r.line?.let { "${r.read.uppercase()} ${fmt(it)}" } ?: r.read.uppercase(),
                tint = if (isUnder) Red else Green,
            )
            Spacer(Modifier.weight(1f))
            // n_for / n_against count INDEPENDENT tells, so the split is the confidence read
            Text(
                "${r.nFor} for · ${r.nAgainst} against",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.appTextSecondary,
            )
        }

        r.summary?.takeIf { it.isNotBlank() }?.let {
            Text(it, fontSize = 13.sp, color = AppColors.appTextPrimary)
        }

        r.tells.forEach { tell ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Spacer(
                    Modifier
                        .padding(top = 6.dp)
                        .size(6.dp)
                        .background(
                            if (tell.dir.lowercase() == r.read.lowercase()) Green else Red,
                            CircleShape,
                        )
                )
                Text(
                    "${tell.src.uppercase()} ${tell.text}",
                    fontSize = 12.sp,
                    color = AppColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun Chip(text: String, tint: Color) {
    Text(
        text,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        color = tint,
        modifier = Modifier
            .background(tint.copy(alpha = 0.15f), RoundedCornerShape(50))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

private fun fmt(v: Double): String =
    if (abs(v) < 1 && v != 0.0) String.format("%.2f", v) else String.format("%.1f", v)
