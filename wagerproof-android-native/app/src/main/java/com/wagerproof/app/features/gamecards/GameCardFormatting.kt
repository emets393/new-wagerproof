package com.wagerproof.app.features.gamecards

import androidx.compose.ui.graphics.Color
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Shared card formatting + team-color helpers — port of iOS
 * `GameCards/Components/GameCardFormatting.swift` (pure logic, no UI).
 *
 * All numeric/date formatting used by the sport card adapters funnels through
 * here so every league's row reads identically.
 */
object GameCardFormatting {

    private val ET: ZoneId = ZoneId.of("America/New_York")

    /** "+150" / "-180" / "—". */
    fun formatMoneyline(ml: Int?): String {
        if (ml == null) return "—"
        return if (ml > 0) "+$ml" else ml.toString()
    }

    /** Signed spread: whole when integral, else 1dp. */
    fun formatSpread(spread: Double?): String {
        if (spread == null) return "—"
        val rounded = if (spread == spread.toLong().toDouble()) {
            spread.toLong().toString()
        } else {
            String.format(Locale.US, "%.1f", spread)
        }
        return if (spread > 0) "+$rounded" else rounded
    }

    /** O/U display rounded to nearest half-point. */
    fun roundToNearestHalf(value: Double?): Double? {
        if (value == null) return null
        return (value * 2.0).roundToInt() / 2.0
    }

    /** "EEE, MMM d" in ET (e.g. "Sun, Nov 24"). */
    fun formatCompactDate(raw: String?): String {
        val instant = parseInstant(raw) ?: return raw ?: ""
        return DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
            .withZone(ET).format(instant)
    }

    /** "h:mm a ET" in ET (e.g. "1:00 PM ET"). */
    fun convertTimeToEST(raw: String?): String {
        val instant = parseInstant(raw) ?: return raw ?: ""
        val t = DateTimeFormatter.ofPattern("h:mm a", Locale.US).withZone(ET).format(instant)
        return "$t ET"
    }

    /** 4-tier confidence palette shared with `confidenceColor` on iOS. */
    fun confidenceColor(percent: Double): Color = when {
        percent >= 80 -> Color(0.13f, 0.77f, 0.37f)
        percent >= 70 -> Color(0.52f, 0.80f, 0.09f)
        percent >= 60 -> Color(0.92f, 0.70f, 0.03f)
        else -> Color(0.98f, 0.45f, 0.09f)
    }

    /**
     * Tolerant timestamp parse: ISO8601 (±fractional), "yyyy-MM-dd HH:mm:ss",
     * "yyyy-MM-dd". Returns null when unparseable.
     */
    fun parseInstant(raw: String?): Instant? {
        val s = raw?.trim().orEmpty()
        if (s.isEmpty()) return null
        runCatching { OffsetDateTime.parse(s).toInstant() }.getOrNull()?.let { return it }
        runCatching { Instant.parse(s) }.getOrNull()?.let { return it }
        runCatching {
            LocalDateTime.parse(s, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                .toInstant(ZoneOffset.UTC)
        }.getOrNull()?.let { return it }
        for (pattern in listOf("HH:mm:ss", "HH:mm")) {
            runCatching {
                LocalTime.parse(s, DateTimeFormatter.ofPattern(pattern))
                    .atDate(LocalDate.of(2001, 1, 1))
                    .toInstant(ZoneOffset.UTC)
            }.getOrNull()?.let { return it }
        }
        runCatching {
            LocalDate.parse(s, DateTimeFormatter.ofPattern("yyyy-MM-dd"))
                .atStartOfDay(ET).toInstant()
        }.getOrNull()?.let { return it }
        return null
    }
}

/** Swift `TeamColorPair` — primary/secondary brand colors for a team. */
data class TeamColorPair(val primary: Color, val secondary: Color)

/**
 * City/nickname split helpers — port of iOS `TeamInitials`.
 */
object TeamInitials {

    /** First letters of the first two words, or the first three letters. */
    fun from(name: String): String {
        val cleaned = name.replace("()", "").trim()
        val words = cleaned.split(Regex("\\s+")).filter { it.isNotEmpty() }
        return if (words.size >= 2) {
            words.take(2).mapNotNull { it.firstOrNull() }.joinToString("").uppercase(Locale.US)
        } else {
            cleaned.take(3).uppercase(Locale.US)
        }
    }

    /**
     * (city, nickname) split. 3-word names ("New York Knicks") put the first
     * two words as city, last as nickname; otherwise first/rest.
     */
    fun parts(name: String): Pair<String, String> {
        val words = name.trim().split(" ").filter { it.isNotEmpty() }
        return when {
            words.isEmpty() -> "" to ""
            words.size == 1 -> words[0] to words[0]
            words.size == 2 -> words[0] to words[1]
            else -> words.dropLast(1).joinToString(" ") to words.last()
        }
    }
}
