package com.wagerproof.app.features.gamecards

import androidx.compose.ui.graphics.Color
import androidx.core.graphics.ColorUtils
import com.wagerproof.core.models.CFBTeamAssets
import com.wagerproof.core.models.MLBTeams
import java.util.Locale

/**
 * Per-sport team-color resolution — port of iOS
 * `GameCards/Components/SportTeamColors.swift`.
 *
 * NBA has a full 30-team table; MLB delegates to `MLBTeams.colors`; CFB parses
 * hex from `CFBTeamAssets`; NCAAB (and any miss) uses the deterministic FNV-1a
 * hash fallback (FIDELITY-WAIVER #008 — no real NCAAB color source).
 */

private fun hex(value: Long): Color = Color(0xFF000000 or value)

object NBATeams {
    // 30-team primary/secondary table (contains-match fallback on nickname).
    private val table: Map<String, TeamColorPair> = mapOf(
        "hawks" to TeamColorPair(hex(0xE03A3E), hex(0xC1D32F)),
        "celtics" to TeamColorPair(hex(0x007A33), hex(0xBA9653)),
        "nets" to TeamColorPair(hex(0x000000), hex(0xFFFFFF)),
        "hornets" to TeamColorPair(hex(0x1D1160), hex(0x00788C)),
        "bulls" to TeamColorPair(hex(0xCE1141), hex(0x000000)),
        "cavaliers" to TeamColorPair(hex(0x860038), hex(0xFDBB30)),
        "mavericks" to TeamColorPair(hex(0x00538C), hex(0xB8C4CA)),
        "nuggets" to TeamColorPair(hex(0x0E2240), hex(0xFEC524)),
        "pistons" to TeamColorPair(hex(0xC8102E), hex(0x1D42BA)),
        "warriors" to TeamColorPair(hex(0x1D428A), hex(0xFFC72C)),
        "rockets" to TeamColorPair(hex(0xCE1141), hex(0xC4CED4)),
        "pacers" to TeamColorPair(hex(0x002D62), hex(0xFDBB30)),
        "clippers" to TeamColorPair(hex(0xC8102E), hex(0x1D428A)),
        "lakers" to TeamColorPair(hex(0x552583), hex(0xFDB927)),
        "grizzlies" to TeamColorPair(hex(0x5D76A9), hex(0x12173F)),
        "heat" to TeamColorPair(hex(0x98002E), hex(0xF9A01B)),
        "bucks" to TeamColorPair(hex(0x00471B), hex(0xEEE1C6)),
        "timberwolves" to TeamColorPair(hex(0x0C2340), hex(0x236192)),
        "pelicans" to TeamColorPair(hex(0x0C2340), hex(0xC8102E)),
        "knicks" to TeamColorPair(hex(0x006BB6), hex(0xF58426)),
        "thunder" to TeamColorPair(hex(0x007AC1), hex(0xEF3B24)),
        "magic" to TeamColorPair(hex(0x0077C0), hex(0xC4CED4)),
        "76ers" to TeamColorPair(hex(0x006BB6), hex(0xED174C)),
        "sixers" to TeamColorPair(hex(0x006BB6), hex(0xED174C)),
        "suns" to TeamColorPair(hex(0x1D1160), hex(0xE56020)),
        "trail blazers" to TeamColorPair(hex(0xE03A3E), hex(0x000000)),
        "blazers" to TeamColorPair(hex(0xE03A3E), hex(0x000000)),
        "kings" to TeamColorPair(hex(0x5A2D81), hex(0x63727A)),
        "spurs" to TeamColorPair(hex(0xC4CED4), hex(0x000000)),
        "raptors" to TeamColorPair(hex(0xCE1141), hex(0x000000)),
        "jazz" to TeamColorPair(hex(0x002B5C), hex(0x00471B)),
        "wizards" to TeamColorPair(hex(0x002B5C), hex(0xE31837)),
    )

    fun colorPair(team: String): TeamColorPair {
        val key = team.lowercase(Locale.US)
        table[key]?.let { return it }
        table.entries.firstOrNull { key.contains(it.key) }?.let { return it.value }
        return FallbackTeamColor.colorPair(team)
    }
}

object MLBTeamColors {
    fun colorPair(nameOrAbbrev: String): TeamColorPair {
        val c = MLBTeams.colors(nameOrAbbrev)
        return TeamColorPair(hex(c.primary), hex(c.secondary))
    }
}

object CFBTeamColors {
    fun colorPair(name: String): TeamColorPair {
        val hexes = CFBTeamAssets.colorHex(name)
        val primary = parseHex(hexes.primary)
        val secondary = parseHex(hexes.secondary)
        if (primary != null) {
            return TeamColorPair(primary, secondary ?: primary)
        }
        return FallbackTeamColor.colorPair(name)
    }

    private fun parseHex(raw: String?): Color? {
        val s = raw?.trim()?.removePrefix("#") ?: return null
        if (s.length != 6) return null
        val v = s.toLongOrNull(16) ?: return null
        return hex(v)
    }
}

/**
 * FNV-1a hash of the team name → stable hue. Deterministic per team so the
 * same school always draws the same color (FIDELITY-WAIVER #008).
 */
object FallbackTeamColor {
    fun colorPair(name: String): TeamColorPair {
        val hue = (fnv1a(name.lowercase(Locale.US)) % 360u).toFloat()
        val primary = hsb(hue, 0.62f, 0.78f)
        val secondary = hsb(hue, 0.5f, 0.6f)
        return TeamColorPair(primary, secondary)
    }

    private fun fnv1a(s: String): UInt {
        var hash = 2166136261u
        for (c in s) {
            hash = hash xor c.code.toUInt()
            hash *= 16777619u
        }
        return hash
    }

    private fun hsb(hueDeg: Float, sat: Float, bri: Float): Color {
        // Convert HSB → HSL for ColorUtils (which takes HSL).
        val l = bri * (1f - sat / 2f)
        val sl = if (l == 0f || l == 1f) 0f else (bri - l) / minOf(l, 1f - l)
        return Color(ColorUtils.HSLToColor(floatArrayOf(hueDeg, sl.coerceIn(0f, 1f), l.coerceIn(0f, 1f))))
    }
}
