package com.wagerproof.app.features.gamecards

import androidx.compose.ui.graphics.Color
import androidx.core.graphics.ColorUtils
import com.wagerproof.core.models.CFBTeamAssets
import com.wagerproof.core.models.NCAABSchoolColors
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

    /** ESPN mark. Exact name, nickname, city, or abbreviation — no substring scan. */
    fun logoURL(team: String): String? {
        val slug = logoSlugs[team.lowercase(Locale.US).trim()] ?: return null
        return "https://a.espncdn.com/i/teamlogos/nba/500/$slug.png"
    }

    /** Display code (NYK, PHI, GSW). Logo slugs stay separate. */
    fun abbreviation(team: String): String {
        val key = team.lowercase(Locale.US).trim()
        return abbreviations[key] ?: key.take(3).uppercase(Locale.US)
    }

    /** Nil when the name is not a known franchise. */
    fun knownAbbreviation(team: String): String? =
        abbreviations[team.lowercase(Locale.US).trim()]

    private val abbreviations: Map<String, String> = mapOf(
        "atlanta hawks" to "ATL", "atlanta" to "ATL", "hawks" to "ATL", "atl" to "ATL",
        "boston celtics" to "BOS", "boston" to "BOS", "celtics" to "BOS", "bos" to "BOS",
        "brooklyn nets" to "BKN", "brooklyn" to "BKN", "nets" to "BKN", "bkn" to "BKN",
        "charlotte hornets" to "CHA", "charlotte" to "CHA", "hornets" to "CHA", "cha" to "CHA",
        "chicago bulls" to "CHI", "chicago" to "CHI", "bulls" to "CHI", "chi" to "CHI",
        "cleveland cavaliers" to "CLE", "cleveland" to "CLE", "cavaliers" to "CLE", "cavs" to "CLE", "cle" to "CLE",
        "dallas mavericks" to "DAL", "dallas" to "DAL", "mavericks" to "DAL", "mavs" to "DAL", "dal" to "DAL",
        "denver nuggets" to "DEN", "denver" to "DEN", "nuggets" to "DEN", "den" to "DEN",
        "detroit pistons" to "DET", "detroit" to "DET", "pistons" to "DET", "det" to "DET",
        "golden state warriors" to "GSW", "golden state" to "GSW", "warriors" to "GSW", "gsw" to "GSW", "gs" to "GSW",
        "houston rockets" to "HOU", "houston" to "HOU", "rockets" to "HOU", "hou" to "HOU",
        "indiana pacers" to "IND", "indiana" to "IND", "pacers" to "IND", "ind" to "IND",
        "la clippers" to "LAC", "los angeles clippers" to "LAC", "clippers" to "LAC", "lac" to "LAC",
        "la lakers" to "LAL", "los angeles lakers" to "LAL", "lakers" to "LAL", "lal" to "LAL",
        "memphis grizzlies" to "MEM", "memphis" to "MEM", "grizzlies" to "MEM", "mem" to "MEM",
        "miami heat" to "MIA", "miami" to "MIA", "heat" to "MIA", "mia" to "MIA",
        "milwaukee bucks" to "MIL", "milwaukee" to "MIL", "bucks" to "MIL", "mil" to "MIL",
        "minnesota timberwolves" to "MIN", "minnesota" to "MIN", "timberwolves" to "MIN", "wolves" to "MIN", "min" to "MIN",
        "new orleans pelicans" to "NOP", "new orleans" to "NOP", "pelicans" to "NOP", "nop" to "NOP", "no" to "NOP",
        "new york knicks" to "NYK", "new york" to "NYK", "knicks" to "NYK", "nyk" to "NYK", "ny" to "NYK",
        "oklahoma city thunder" to "OKC", "oklahoma city" to "OKC", "thunder" to "OKC", "okc" to "OKC",
        "orlando magic" to "ORL", "orlando" to "ORL", "magic" to "ORL", "orl" to "ORL",
        "philadelphia 76ers" to "PHI", "philadelphia" to "PHI", "76ers" to "PHI", "sixers" to "PHI", "phi" to "PHI",
        "phoenix suns" to "PHX", "phoenix" to "PHX", "suns" to "PHX", "phx" to "PHX",
        "portland trail blazers" to "POR", "portland" to "POR", "trail blazers" to "POR", "blazers" to "POR", "por" to "POR",
        "sacramento kings" to "SAC", "sacramento" to "SAC", "kings" to "SAC", "sac" to "SAC",
        "san antonio spurs" to "SAS", "san antonio" to "SAS", "spurs" to "SAS", "sas" to "SAS", "sa" to "SAS",
        "toronto raptors" to "TOR", "toronto" to "TOR", "raptors" to "TOR", "tor" to "TOR",
        "utah jazz" to "UTA", "utah" to "UTA", "jazz" to "UTA", "uta" to "UTA",
        "washington wizards" to "WAS", "washington" to "WAS", "wizards" to "WAS", "was" to "WAS", "wsh" to "WAS",
    )

    private val logoSlugs: Map<String, String> = mapOf(
        "atlanta hawks" to "atl", "atlanta" to "atl", "hawks" to "atl", "atl" to "atl",
        "boston celtics" to "bos", "boston" to "bos", "celtics" to "bos", "bos" to "bos",
        "brooklyn nets" to "bkn", "brooklyn" to "bkn", "nets" to "bkn", "bkn" to "bkn",
        "charlotte hornets" to "cha", "charlotte" to "cha", "hornets" to "cha", "cha" to "cha",
        "chicago bulls" to "chi", "chicago" to "chi", "bulls" to "chi", "chi" to "chi",
        "cleveland cavaliers" to "cle", "cleveland" to "cle", "cavaliers" to "cle", "cavs" to "cle", "cle" to "cle",
        "dallas mavericks" to "dal", "dallas" to "dal", "mavericks" to "dal", "mavs" to "dal", "dal" to "dal",
        "denver nuggets" to "den", "denver" to "den", "nuggets" to "den", "den" to "den",
        "detroit pistons" to "det", "detroit" to "det", "pistons" to "det", "det" to "det",
        "golden state warriors" to "gs", "golden state" to "gs", "warriors" to "gs", "gs" to "gs", "gsw" to "gs",
        "houston rockets" to "hou", "houston" to "hou", "rockets" to "hou", "hou" to "hou",
        "indiana pacers" to "ind", "indiana" to "ind", "pacers" to "ind", "ind" to "ind",
        "la clippers" to "lac", "los angeles clippers" to "lac", "clippers" to "lac", "lac" to "lac",
        "la lakers" to "lal", "los angeles lakers" to "lal", "lakers" to "lal", "lal" to "lal",
        "memphis grizzlies" to "mem", "memphis" to "mem", "grizzlies" to "mem", "mem" to "mem",
        "miami heat" to "mia", "miami" to "mia", "heat" to "mia", "mia" to "mia",
        "milwaukee bucks" to "mil", "milwaukee" to "mil", "bucks" to "mil", "mil" to "mil",
        "minnesota timberwolves" to "min", "minnesota" to "min", "timberwolves" to "min", "wolves" to "min", "min" to "min",
        "new orleans pelicans" to "no", "new orleans" to "no", "pelicans" to "no", "nop" to "no", "no" to "no",
        "new york knicks" to "ny", "knicks" to "ny", "nyk" to "ny", "ny" to "ny",
        "oklahoma city thunder" to "okc", "oklahoma city" to "okc", "thunder" to "okc", "okc" to "okc",
        "orlando magic" to "orl", "orlando" to "orl", "magic" to "orl", "orl" to "orl",
        "philadelphia 76ers" to "phi", "philadelphia" to "phi", "76ers" to "phi", "sixers" to "phi", "phi" to "phi",
        "phoenix suns" to "phx", "phoenix" to "phx", "suns" to "phx", "phx" to "phx",
        "portland trail blazers" to "por", "portland" to "por", "trail blazers" to "por", "blazers" to "por", "por" to "por",
        "sacramento kings" to "sac", "sacramento" to "sac", "kings" to "sac", "sac" to "sac",
        "san antonio spurs" to "sa", "san antonio" to "sa", "spurs" to "sa", "sas" to "sa", "sa" to "sa",
        "toronto raptors" to "tor", "toronto" to "tor", "raptors" to "tor", "tor" to "tor",
        "utah jazz" to "utah", "utah" to "utah", "jazz" to "utah", "uta" to "utah",
        "washington wizards" to "wsh", "washington" to "wsh", "wizards" to "wsh", "was" to "wsh", "wsh" to "wsh",
    )

    fun colorPair(team: String): TeamColorPair {
        if (team.isEmpty()) return FallbackTeamColor.colorPair(team)
        val key = team.lowercase(Locale.US).trim()
        fullNameTable[key]?.let { return it }
        val code = abbreviations[key]
        if (code != null) {
            fullNameTable.entries.firstOrNull { entry ->
                abbreviations[entry.key.lowercase(Locale.US)] == code && entry.key.contains(" ")
            }?.let { return it.value }
        }
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
        NCAABSchoolColors.hex(name)?.let { school ->
            val espn = parseHex(school.primary) ?: return@let
            return TeamColorPair(espn, parseHex(school.secondary) ?: espn)
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
