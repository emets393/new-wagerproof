package com.wagerproof.app.features.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBPerfectStormTier
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Shared visual + formatting vocabulary for the MLB Regression Report — the
 * Compose port of iOS `Components/RegressionPrimitives.swift`. One source of
 * truth so every card colors win%, severity, and ROI the same way RN does.
 * Ported as a single file to keep every card in lockstep.
 */
object Regression {
    // RN color tokens (mlb-regression-report.tsx). Kept as explicit hexes here
    // (not AppColors) so they stay pinned to the web palette even if the
    // shared design tokens drift.
    val winGreen = Color(0xFF22C55E)
    val lossRed = Color(0xFFEF4444)
    val warnAmber = Color(0xFFF59E0B)
    val neutralGray = Color(0xFF6B7280)
    val accentBlue = Color(0xFF3B82F6)
    val accentPurple = Color(0xFFA855F7)
    val accentIndigo = Color(0xFF6366F1)
    val accentCyan = Color(0xFF06B6D4)
    val accentYellow = Color(0xFFEAB308)
    val accentOrange = Color(0xFFF97316)
    val hammerPurple = Color(0xFFA78BFA)

    fun winPctColor(pct: Double): Color = when {
        pct >= 65 -> winGreen
        pct >= 55 -> accentYellow
        pct >= 50 -> accentOrange
        else -> lossRed
    }

    fun severityColor(severity: String?): Color = when (severity) {
        "severe" -> lossRed
        "moderate" -> warnAmber
        else -> winGreen
    }

    fun roiColor(value: Double): Color = if (value >= 0) winGreen else lossRed

    fun betTypeLabel(bt: String): String = when (bt) {
        "full_ml" -> "Full ML"
        "full_ou" -> "Full O/U"
        "f5_ml" -> "F5 ML"
        "f5_ou" -> "F5 O/U"
        else -> bt.uppercase()
    }

    val betTypes: List<Pair<String, String>> = listOf(
        "full_ml" to "Full ML",
        "full_ou" to "Full O/U",
        "f5_ml" to "F5 ML",
        "f5_ou" to "F5 O/U",
    )

    /** JS-style number printing: "55.6", "4", "-1.25" — no trailing zeros. */
    fun trimmed(value: Double): String {
        if (value == value.roundToInt().toDouble()) return value.roundToInt().toString()
        var s = String.format(Locale.US, "%.2f", value)
        while (s.endsWith("0")) s = s.dropLast(1)
        if (s.endsWith(".")) s = s.dropLast(1)
        return s
    }

    fun signed(value: Double, decimals: Int): String =
        (if (value > 0) "+" else "") + String.format(Locale.US, "%.${decimals}f", value)

    /** "+55.6%" style for raw-numeric pcts (no fixed decimals, RN parity). */
    fun signedTrimmedPct(value: Double): String =
        (if (value > 0) "+" else "") + trimmed(value) + "%"

    // ISO-8601 with fractional seconds, a UTC offset, or a bare local datetime —
    // the report ETL emits any of the three. Try each in turn (RN/iOS parity).
    private fun parseInstant(raw: String?): Instant? {
        if (raw.isNullOrEmpty()) return null
        return runCatching { Instant.parse(raw) }.getOrNull()
            ?: runCatching { OffsetDateTime.parse(raw).toInstant() }.getOrNull()
            ?: runCatching {
                java.time.LocalDateTime.parse(raw).atZone(ET).toInstant()
            }.getOrNull()
    }

    /** RN `timeAgo`: "just now", "{m}m ago", "{h}h {m}m ago". */
    fun timeAgo(fromISO: String?): String? {
        val date = parseInstant(fromISO) ?: return null
        val minutes = ((Instant.now().toEpochMilli() - date.toEpochMilli()) / 60000L).toInt()
        if (minutes < 1) return "just now"
        if (minutes < 60) return "${minutes}m ago"
        return "${minutes / 60}h ${minutes % 60}m ago"
    }

    /** "7:05 PM ET" from an ISO timestamp, rendered in America/New_York. */
    fun gameTimeET(raw: String?): String? {
        val date = parseInstant(raw) ?: return null
        return TIME_FMT.format(date.atZone(ET)) + " ET"
    }

    val ET: ZoneId = ZoneId.of("America/New_York")
    private val TIME_FMT = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

    /**
     * Resolve an SF Symbol name coming from transplanted Swift; fall back to
     * the closest mapped glyph when the app's icon set has no match.
     */
    fun icon(systemName: String, fallback: AppIcon): ImageVector =
        AppIcon.fromSystemName(systemName)?.imageVector ?: fallback.imageVector
}

/** Canonical display config per Perfect Storm tier (lockstep with web/RN). */
object PerfectStormTierDisplay {
    data class Config(val badge: String, val cardLabel: String, val color: Color)

    fun config(tier: MLBPerfectStormTier): Config = when (tier) {
        MLBPerfectStormTier.HAMMER -> Config("PERFECT STORM HAMMER", "Hammer Record", Regression.hammerPurple)
        MLBPerfectStormTier.PS -> Config("PERFECT STORM", "Perfect Storm Record", Regression.winGreen)
        MLBPerfectStormTier.LEAN -> Config("STRONG LEAN", "Lean Record", Regression.accentBlue)
        MLBPerfectStormTier.WATCH -> Config("WATCH", "Watch Record", Regression.warnAmber)
    }

    fun config(forRaw: String?): Config {
        val tier = MLBPerfectStormTier.entries.firstOrNull { it.raw == forRaw } ?: MLBPerfectStormTier.WATCH
        return config(tier)
    }
}

// MARK: - Primitives -----------------------------------------------------------

/**
 * Elevated-surface card with a color-tinted border — the report's dominant row
 * chrome (RN `AccentBarRow`). Severity/tier is already communicated by each
 * card's pill badge, so the border tint is enough context.
 */
@Composable
fun RegressionAccentRow(
    color: Color,
    modifier: Modifier = Modifier,
    dim: Boolean = false,
    content: @Composable () -> Unit,
) {
    Box(
        modifier
            .fillMaxWidth()
            .alpha(if (dim) 0.6f else 1f)
            .clip(RoundedCornerShape(14.dp))
            .background(AppColors.appSurfaceElevated)
            .border(1.dp, color.copy(alpha = 0.28f), RoundedCornerShape(14.dp))
            .padding(12.dp),
    ) { content() }
}

/** 10pt uppercase label over a bold tabular value (RN `Stat`). */
@Composable
fun RegressionStat(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    color: Color? = null,
) {
    Column(modifier.fillMaxWidth()) {
        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.6.sp,
            color = AppColors.appTextSecondary,
        )
        Text(
            text = value,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = color ?: AppColors.appTextPrimary,
        )
    }
}

@Composable
fun RegressionPill(text: String, color: Color) {
    Text(
        text = text,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.4.sp,
        color = color,
        modifier = Modifier
            .clip(CircleShape)
            .background(color.copy(alpha = 0.15f))
            .border(1.dp, color.copy(alpha = 0.55f), CircleShape)
            .padding(horizontal = 7.dp, vertical = 2.dp),
    )
}

/** Big record tile used by the recap hero row (RN `HeroTile`). */
@Composable
fun RegressionHeroTile(
    label: String,
    primary: String,
    modifier: Modifier = Modifier,
    secondary: @Composable () -> Unit,
) {
    Column(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.4f))
            .padding(14.dp),
    ) {
        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
            color = AppColors.appTextSecondary,
        )
        Text(
            text = primary,
            fontSize = 24.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = (-0.5).sp,
            color = AppColors.appTextPrimary,
        )
        secondary()
    }
}

/** Group divider inside a section ("DUE FOR NEGATIVE REGRESSION" etc.). */
@Composable
fun RegressionGroupLabel(
    label: String,
    count: Int,
    modifier: Modifier = Modifier,
    color: Color? = null,
    note: String? = null,
) {
    Column(modifier) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (color != null) {
                Box(
                    Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(color),
                )
                Spacer(Modifier.size(6.dp))
            }
            Text(
                text = label,
                fontSize = 11.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 0.8.sp,
                color = color ?: AppColors.appTextSecondary,
            )
            Spacer(Modifier.weight(1f))
            Text(
                text = count.toString(),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.appTextSecondary,
            )
        }
        if (note != null) {
            Text(
                text = note,
                fontSize = 11.sp,
                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                color = AppColors.appTextSecondary,
            )
        }
    }
}

/** iOS-style segmented control used by accuracy + breakdown sections. */
@Composable
fun RegressionSegmentedTabs(
    options: List<Pair<String, String>>,
    selection: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(AppColors.appSurfaceMuted)
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        for ((key, label) in options) {
            val active = selection == key
            Text(
                text = label,
                fontSize = 12.sp,
                fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                color = if (active) AppColors.appTextPrimary else AppColors.appTextSecondary,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { onSelect(key) }
                    .background(if (active) AppColors.appSurface else Color.Transparent)
                    .padding(vertical = 7.dp),
            )
        }
    }
}
