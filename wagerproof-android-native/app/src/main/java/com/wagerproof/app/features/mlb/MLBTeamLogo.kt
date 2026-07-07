package com.wagerproof.app.features.mlb

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.TeamColorPair
import com.wagerproof.app.features.gamecards.relativeLuminance
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.models.MLBTeams
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * MLB team avatar — port of iOS `MLBTeamLogo`. A gradient team-color disc with a
 * 2dp primary border, the team logo (or abbr initials) on top, plus the same
 * faint contrast plate the feed avatars use so a same-color logo separates from
 * the disc. Used by the MLB detail sheet, betting-trends card, and projections.
 */
@Composable
fun MLBTeamLogo(
    logoUrl: String?,
    abbrev: String,
    name: String,
    size: Dp,
    modifier: Modifier = Modifier,
) {
    val pair = mlbTeamColorPair(name.ifEmpty { abbrev })
    val primary = pair.primary
    val secondary = pair.secondary
    // Dark theme only (app is dark) — plate a dark logo with a faint light wash.
    val plate: Color? = if (primary.relativeLuminance() < 0.45f) Color.White.copy(alpha = 0.15f) else null
    Box(
        modifier
            .size(size)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(primary, secondary)))
            .border(2.dp, primary, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        RemoteImage(
            url = logoUrl,
            contentDescription = abbrev,
            modifier = Modifier.size(size).padding(size * 0.08f),
            error = {
                Text(
                    abbrev,
                    color = contrastingText(primary),
                    fontSize = (size.value * 0.32f).sp,
                    fontWeight = FontWeight.Bold,
                )
            },
        )
        if (plate != null && !logoUrl.isNullOrBlank()) {
            // Faint plate lives behind the logo image; RemoteImage draws over it.
            Box(Modifier.size(size * 0.84f).clip(CircleShape).background(plate))
        }
    }
}

/** Luminance-contrast text color, mirroring iOS `contrastingText` (threshold 0.5). */
private fun contrastingText(primary: Color): Color =
    if (primary.relativeLuminance() > 0.5f) Color.Black else Color.White

/** Resolve MLB team colors (stored as 0xRRGGBB longs) into a Compose [TeamColorPair]. */
fun mlbTeamColorPair(nameOrAbbrev: String): TeamColorPair {
    val c = MLBTeams.colors(nameOrAbbrev)
    return TeamColorPair(hexColor(c.primary), hexColor(c.secondary))
}

/**
 * MLB-specific formatting helpers — port of iOS `MLBFormatting`. Mirrors the
 * moneyline / run-line / total / date / game-time display used across the sheet.
 */
object MLBFormatting {
    fun moneyline(ml: Int?): String {
        if (ml == null) return "-"
        return if (ml > 0) "+$ml" else "$ml"
    }

    fun spread(s: Double?): String {
        if (s == null || s.isNaN()) return "-"
        val body = if (s == Math.rint(s)) s.toInt().toString() else String.format(Locale.US, "%.1f", s)
        return if (s > 0) "+$body" else body
    }

    fun line(value: Double?): String {
        if (value == null) return "-"
        return if (value == Math.rint(value)) value.toInt().toString()
        else String.format(Locale.US, "%.1f", value)
    }

    private val et: ZoneId = ZoneId.of("America/New_York")

    /** "EEE, MMM d" in ET from a `yyyy-MM-dd` official date. */
    fun dateLabel(raw: String): String = try {
        val date = java.time.LocalDate.parse(raw)
        date.format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US))
    } catch (_: Exception) {
        raw
    }

    /** ISO UTC → "h:mm a ET"; "TBD" when missing/unparseable. */
    fun gameTime(raw: String?): String {
        if (raw.isNullOrEmpty()) return "TBD"
        return try {
            val instant = runCatching { ZonedDateTime.parse(raw).toInstant() }
                .getOrElse { java.time.Instant.parse(raw) }
            val zoned = instant.atZone(et)
            zoned.format(DateTimeFormatter.ofPattern("h:mm a", Locale.US)) + " ET"
        } catch (_: Exception) {
            "TBD"
        }
    }
}
