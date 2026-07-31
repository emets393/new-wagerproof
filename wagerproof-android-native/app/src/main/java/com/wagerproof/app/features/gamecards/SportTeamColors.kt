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
 * hex from `CFBTeamAssets`; NCAAB shares that college identity resolver, as in
 * the production mobile client. A deterministic fallback is retained only for
 * schools absent from the upstream team-assets dataset (which supplies no
 * color fields in `ncaab_team_mapping`).
 */

private fun hex(value: Long): Color = Color(0xFF000000 or value)

object NBATeams {
    /**
     * Full-team-name table, checked FIRST. The adapters pass full names
     * ("Charlotte Hornets"), and a nickname-only table made that miss and fall
     * into the substring scan, where "nets" matched before "hornets" and
     * painted Charlotte in Brooklyn's black/white on every NBA surface.
     * Mirrors iOS `NBATeams.table`.
     */
    private val fullNameTable: Map<String, TeamColorPair> = mapOf(
        "atlanta hawks" to TeamColorPair(hex(0xE03A3E), hex(0xC1D32F)),
        "boston celtics" to TeamColorPair(hex(0x007A33), hex(0xBA9653)),
        "brooklyn nets" to TeamColorPair(hex(0x1A1A1A), hex(0xFFFFFF)),
        "charlotte hornets" to TeamColorPair(hex(0x1D1160), hex(0x00788C)),
        "chicago bulls" to TeamColorPair(hex(0xCE1141), hex(0x000000)),
        "cleveland cavaliers" to TeamColorPair(hex(0x860038), hex(0xFDBB30)),
        "dallas mavericks" to TeamColorPair(hex(0x00538C), hex(0x0053BC)),
        "denver nuggets" to TeamColorPair(hex(0x0E2240), hex(0xFEC524)),
        "detroit pistons" to TeamColorPair(hex(0xC8102E), hex(0x1D42BA)),
        "golden state warriors" to TeamColorPair(hex(0x1D428A), hex(0xFFC72C)),
        "houston rockets" to TeamColorPair(hex(0xCE1141), hex(0x2C7AC3)),
        "indiana pacers" to TeamColorPair(hex(0x002D62), hex(0xFDBB30)),
        "la clippers" to TeamColorPair(hex(0xC8102E), hex(0x1D428A)),
        "los angeles clippers" to TeamColorPair(hex(0xC8102E), hex(0x1D428A)),
        "los angeles lakers" to TeamColorPair(hex(0x552583), hex(0xFDB927)),
        "memphis grizzlies" to TeamColorPair(hex(0x5D76A9), hex(0x12173F)),
        "miami heat" to TeamColorPair(hex(0x98002E), hex(0xF9A01B)),
        "milwaukee bucks" to TeamColorPair(hex(0x00471B), hex(0xEEE1C6)),
        "minnesota timberwolves" to TeamColorPair(hex(0x0C2340), hex(0x236192)),
        "new orleans pelicans" to TeamColorPair(hex(0x0C2340), hex(0xC8102E)),
        "new york knicks" to TeamColorPair(hex(0x006BB6), hex(0xF58426)),
        "oklahoma city thunder" to TeamColorPair(hex(0x007AC1), hex(0xEF3B24)),
        "orlando magic" to TeamColorPair(hex(0x0077C0), hex(0xC4CED4)),
        "philadelphia 76ers" to TeamColorPair(hex(0x006BB6), hex(0xED174C)),
        "phoenix suns" to TeamColorPair(hex(0x1D1160), hex(0xE56020)),
        "portland trail blazers" to TeamColorPair(hex(0xE03A3E), hex(0x1A1A1A)),
        "sacramento kings" to TeamColorPair(hex(0x5A2D81), hex(0x63727A)),
        "san antonio spurs" to TeamColorPair(hex(0x8A8D8F), hex(0x1A1A1A)),
        "toronto raptors" to TeamColorPair(hex(0xCE1141), hex(0x1A1A1A)),
        "utah jazz" to TeamColorPair(hex(0x002B5C), hex(0xF9A01B)),
        "washington wizards" to TeamColorPair(hex(0x002B5C), hex(0xE31837)),
    )

    /** Nickname fallback for feeds that publish "Lakers" rather than the full name. */
    private val nicknameTable: Map<String, TeamColorPair> = mapOf(
        "hawks" to TeamColorPair(hex(0xE03A3E), hex(0xC1D32F)),
        "celtics" to TeamColorPair(hex(0x007A33), hex(0xBA9653)),
        "nets" to TeamColorPair(hex(0x1A1A1A), hex(0xFFFFFF)),
        "hornets" to TeamColorPair(hex(0x1D1160), hex(0x00788C)),
        "bulls" to TeamColorPair(hex(0xCE1141), hex(0x000000)),
        "cavaliers" to TeamColorPair(hex(0x860038), hex(0xFDBB30)),
        "mavericks" to TeamColorPair(hex(0x00538C), hex(0x0053BC)),
        "nuggets" to TeamColorPair(hex(0x0E2240), hex(0xFEC524)),
        "pistons" to TeamColorPair(hex(0xC8102E), hex(0x1D42BA)),
        "warriors" to TeamColorPair(hex(0x1D428A), hex(0xFFC72C)),
        "rockets" to TeamColorPair(hex(0xCE1141), hex(0x2C7AC3)),
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
        "trail blazers" to TeamColorPair(hex(0xE03A3E), hex(0x1A1A1A)),
        "blazers" to TeamColorPair(hex(0xE03A3E), hex(0x1A1A1A)),
        "kings" to TeamColorPair(hex(0x5A2D81), hex(0x63727A)),
        "spurs" to TeamColorPair(hex(0x8A8D8F), hex(0x1A1A1A)),
        "raptors" to TeamColorPair(hex(0xCE1141), hex(0x1A1A1A)),
        "jazz" to TeamColorPair(hex(0x002B5C), hex(0xF9A01B)),
        "wizards" to TeamColorPair(hex(0x002B5C), hex(0xE31837)),
    )

    fun colorPair(team: String): TeamColorPair {
        if (team.isEmpty()) return FallbackTeamColor.colorPair(team)
        val key = team.lowercase(Locale.US).trim()
        fullNameTable[key]?.let { return it }
        nicknameTable[key]?.let { return it }
        // Longest match wins: a short nickname can be a substring of another
        // team's full name ("nets" inside "charlotte hornets"), and map
        // iteration order must not decide which one paints the card.
        nicknameTable.entries
            .filter { key.contains(it.key) }
            .maxByOrNull { it.key.length }
            ?.let { return it.value }
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
