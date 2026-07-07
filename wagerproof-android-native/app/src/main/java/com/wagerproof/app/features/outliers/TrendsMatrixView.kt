package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors
import kotlin.math.roundToInt

// Shared, sport-agnostic situational-trends matrix renderer. All three
// betting-trends surfaces (MLB 7-pair, NBA/NCAAB 5-pair) feed this view through
// small per-sport adapters (see `*TrendsMatrixAdapter.kt`) so the layout, color
// thresholds, and consensus badges never drift apart. Port of iOS
// TrendsMatrixView.swift.

/** Which side of the matchup a team avatar/cell belongs to. */
enum class TrendsTeamSide { away, home }

/**
 * Per-situation consensus chip (ML/ATS leader or O/U direction). Computed by the
 * adapters using the same thresholds as the RN list-sort formulas.
 */
data class TrendsConsensusBadge(
    val text: String,
    val systemImage: String,
    /** 0xRRGGBB tint — resolved through [hexColor]. */
    val colorHex: Long,
) {
    val color: Color get() = hexColor(colorHex)
}

/**
 * One cell payload — mirrors the three RN cell shapes exactly.
 */
sealed class TrendsMatrixCell {
    /** Percentage-only badge (MLB — the today view has no records). */
    data class Pct(val v: Double?) : TrendsMatrixCell()

    /** "W-L-P" record over a colored cover-% badge (ATS). */
    data class RecordPct(val record: String, val pct: Double?) : TrendsMatrixCell()

    /** "O-U-P" record over the "x%O / y%U" split line. */
    data class RecordOU(val record: String, val over: Double?, val under: Double?) : TrendsMatrixCell()
}

/**
 * One metric row inside a situation section (WIN% / OVER% for MLB, ATS / O/U for
 * NBA+NCAAB).
 */
data class TrendsMatrixMetricRow(
    val id: String,
    val label: String,
    val awayCell: TrendsMatrixCell,
    val homeCell: TrendsMatrixCell,
)

/**
 * One situational pair (e.g. "Last Game Situation") with per-team labels, metric
 * rows, and pre-computed consensus badges.
 */
data class TrendsMatrixSection(
    val id: String,
    val title: String,
    val systemImage: String,
    val tooltip: String?,
    val awayLabel: String,
    val homeLabel: String,
    val rows: List<TrendsMatrixMetricRow>,
    val badges: List<TrendsConsensusBadge>,
    val hasData: Boolean,
)

/** RN `getPctColor` / `getATSColor` thresholds — shared by every cell. */
fun trendsPctColor(pct: Double?): Color {
    if (pct == null) return hexColor(0x9CA3AFL)
    if (pct >= 55) return hexColor(0x22C55EL)
    if (pct >= 45) return hexColor(0xEAB308L)
    return hexColor(0xEF4444L)
}

/**
 * Renders a list of situation sections — the full detail-sheet treatment (glass
 * cards, 40dp avatars, tooltips). `avatar` injects the per-side team disc; null
 * falls back to the AWAY/HOME abbreviations.
 */
@Composable
fun TrendsMatrixView(
    sections: List<TrendsMatrixSection>,
    accent: Color,
    modifier: Modifier = Modifier,
    awayAbbr: String = "",
    homeAbbr: String = "",
    avatar: (@Composable (TrendsTeamSide, Dp) -> Unit)? = null,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        sections.forEach { section ->
            TrendsMatrixSectionCard(
                section = section,
                accent = accent,
                awayAbbr = awayAbbr,
                homeAbbr = homeAbbr,
                avatar = avatar,
            )
        }
    }
}

private val gutterWidth = 48.dp

@Composable
private fun TrendsMatrixSectionCard(
    section: TrendsMatrixSection,
    accent: Color,
    awayAbbr: String,
    homeAbbr: String,
    avatar: (@Composable (TrendsTeamSide, Dp) -> Unit)?,
) {
    val shape = RoundedCornerShape(16.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .liquidGlassBackground(shape, hairline = true),
    ) {
        // Header
        Column(
            Modifier.padding(horizontal = 12.dp).padding(top = 12.dp, bottom = 8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(outlierSymbol(section.systemImage), null, tint = accent, modifier = Modifier.size(15.dp))
                Text(section.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary)
            }
            if (section.badges.isNotEmpty()) {
                BadgesRow(section.badges)
            }
        }

        if (section.hasData) {
            Box(
                Modifier
                    .padding(horizontal = 12.dp)
                    .padding(bottom = if (section.tooltip == null) 12.dp else 8.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(AppColors.appTextMuted.copy(alpha = 0.03f))
                    .padding(12.dp),
            ) {
                Matrix(section, awayAbbr, homeAbbr, avatar)
            }
        } else {
            Box(
                Modifier
                    .padding(horizontal = 12.dp)
                    .padding(bottom = if (section.tooltip == null) 12.dp else 8.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(AppColors.appTextMuted.copy(alpha = 0.05f))
                    .padding(16.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("No data available", fontSize = 13.sp, color = AppColors.appTextSecondary)
            }
        }

        section.tooltip?.let { tip ->
            Row(
                Modifier.padding(horizontal = 12.dp).padding(bottom = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(outlierSymbol("info.circle"), null, tint = AppColors.appTextSecondary, modifier = Modifier.size(11.dp))
                Text(
                    tip,
                    fontSize = 11.sp,
                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                    color = AppColors.appTextSecondary,
                    lineHeight = 15.sp,
                )
            }
        }
    }
}

@Composable
private fun BadgesRow(badges: List<TrendsConsensusBadge>) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        badges.forEach { badge ->
            Row(
                Modifier
                    .clip(RoundedCornerShape(percent = 50))
                    .background(badge.color.copy(alpha = 0.14f))
                    .padding(horizontal = 8.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Icon(outlierSymbol(badge.systemImage), null, tint = badge.color, modifier = Modifier.size(8.dp))
                Text(badge.text, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = badge.color)
            }
        }
    }
}

@Composable
private fun Matrix(
    section: TrendsMatrixSection,
    awayAbbr: String,
    homeAbbr: String,
    avatar: (@Composable (TrendsTeamSide, Dp) -> Unit)?,
) {
    Column {
        // Team header row — avatars (or abbrs) + the per-team situation label.
        Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), verticalAlignment = Alignment.Top) {
            Box(Modifier.width(gutterWidth).height(1.dp))
            TeamHeader(Modifier.weight(1f), TrendsTeamSide.away, awayAbbr, section.awayLabel, avatar)
            TeamHeader(Modifier.weight(1f), TrendsTeamSide.home, homeAbbr, section.homeLabel, avatar)
        }
        section.rows.forEach { row -> MetricRow(row) }
    }
}

@Composable
private fun TeamHeader(
    modifier: Modifier,
    side: TrendsTeamSide,
    abbr: String,
    label: String,
    avatar: (@Composable (TrendsTeamSide, Dp) -> Unit)?,
) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (avatar != null) {
            avatar(side, 40.dp)
        } else {
            Text(
                abbr.ifEmpty { if (side == TrendsTeamSide.away) "AWAY" else "HOME" },
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = AppColors.appTextPrimary,
            )
        }
        Text(
            label,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.appTextSecondary,
            textAlign = TextAlign.Center,
            maxLines = 2,
            modifier = Modifier.widthIn(max = 110.dp),
        )
    }
}

@Composable
private fun MetricRow(row: TrendsMatrixMetricRow) {
    Column(Modifier.fillMaxWidth()) {
        // 1dp 0.08 hairline above each row.
        Box(Modifier.fillMaxWidth().height(1.dp).background(AppColors.appTextMuted.copy(alpha = 0.08f)))
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                row.label,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.5.sp,
                color = AppColors.appTextSecondary,
                modifier = Modifier.width(gutterWidth),
            )
            Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { Cell(row.awayCell) }
            Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { Cell(row.homeCell) }
        }
    }
}

@Composable
private fun Cell(cell: TrendsMatrixCell) {
    when (cell) {
        is TrendsMatrixCell.Pct -> PctBadge(cell.v)
        is TrendsMatrixCell.RecordPct -> Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(cell.record, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
            PctBadge(cell.pct)
        }
        is TrendsMatrixCell.RecordOU -> Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(cell.record, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
            Text(
                ouSplit(cell.over, cell.under),
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                color = AppColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun PctBadge(pct: Double?) {
    val color = trendsPctColor(pct)
    Text(
        formatPct(pct),
        fontSize = 13.sp,
        fontWeight = FontWeight.Bold,
        color = color,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(color.copy(alpha = 0.125f))
            .padding(horizontal = 10.dp, vertical = 3.dp),
    )
}

private fun formatPct(pct: Double?): String = if (pct == null) "—" else "${pct.roundToInt()}%"

private fun ouSplit(over: Double?, under: Double?): String =
    if (over == null || under == null) "-" else "${over.roundToInt()}%O / ${under.roundToInt()}%U"
