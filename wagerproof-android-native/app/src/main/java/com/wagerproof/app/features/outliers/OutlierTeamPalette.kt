package com.wagerproof.app.features.outliers

import androidx.compose.ui.graphics.Color
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.models.SportLeague
import java.util.Locale

/**
 * Static team-color palette shared by every Outliers card (and, per the parity
 * doc, Chat's component cards too). Port of iOS `OutlierTeamPalette` (defined
 * inside `Components/OutlierMatchupCard.swift`), which itself ports RN
 * `utils/teamColors.ts` + `constants/mlbTeams.ts`.
 *
 * Each side of a matchup card's gradient (and its glass disc tint) takes the
 * team's primary *brand* color — the color that reads off its logo — so the
 * square is tinted to the matchup. MLB resolves through the shared [MLBTeams]
 * table; NFL/NBA through the brand maps below.
 *
 * // FIDELITY-WAIVER #024: CFB/NCAAB have no name-keyed color/logo table here
 * // (they're DB-id mapped), so they fall back to a sport tint / initials.
 */
object OutlierTeamPalette {
    enum class Slot { away, home }

    fun color(team: String, sport: SportLeague, slot: Slot): Color {
        // Real brand color first — this is what tints the square to the logos.
        brandPrimary(team, sport)?.let { return hexColor(it) }
        // Sport-tint fallback for CFB/NCAAB and any unmatched name.
        return when (sport) {
            SportLeague.NFL -> if (slot == Slot.away) hexColor(0x013369) else hexColor(0x002244)
            SportLeague.CFB -> if (slot == Slot.away) hexColor(0xC8102E) else hexColor(0x7A0000)
            SportLeague.NBA -> if (slot == Slot.away) hexColor(0x1D428A) else hexColor(0x0B1F4D)
            SportLeague.NCAAB -> if (slot == Slot.away) hexColor(0xF58426) else hexColor(0x7A3A05)
            SportLeague.MLB -> if (slot == Slot.away) hexColor(0x002D72) else hexColor(0x001F50)
        }
    }

    /**
     * Team primary brand color (matches the logo) by name + sport. null when the
     * sport has no name-keyed table here (CFB/NCAAB) or the name doesn't match.
     */
    private fun brandPrimary(team: String, sport: SportLeague): Long? = when (sport) {
        // MLBTeams.colors returns a neutral pair when unmatched, so gate on a
        // real table hit — otherwise we'd paint the neutral as a brand color.
        SportLeague.MLB -> if (MLBTeams.info(team) != null) MLBTeams.colors(team).primary else null
        SportLeague.NFL -> lookupColor(nflColorsLower, team)
        SportLeague.NBA -> lookupColor(nbaColorsLower, team)
        SportLeague.CFB, SportLeague.NCAAB -> null
    }

    /**
     * Exact (case-insensitive) match, then longest contained-key match so
     * "Buffalo Bills" resolves off the "buffalo" key. Keys are pre-lowercased.
     */
    private fun lookupColor(map: Map<String, Long>, team: String): Long? {
        val key = team.trim().lowercase(Locale.US)
        map[key]?.let { return it }
        var best: Long? = null
        var bestLen = 0
        for ((k, v) in map) {
            if (key.contains(k) && k.length > bestLen) {
                best = v
                bestLen = k.length
            }
        }
        return best
    }

    // lazy: nflPrimary/nbaPrimary are declared further down this object, so eager
    // init here would read them before they're assigned.
    private val nflColorsLower: Map<String, Long> by lazy {
        nflPrimary.entries.associate { it.key.lowercase(Locale.US) to it.value }
    }
    private val nbaColorsLower: Map<String, Long> by lazy {
        nbaPrimary.entries.associate { it.key.lowercase(Locale.US) to it.value }
    }

    /** Two-letter team initials. Drops common stop words to keep them tight. */
    fun initials(team: String): String {
        val stop = setOf("the", "of")
        val words = team.split(Regex("\\s+"))
            .filter { it.isNotEmpty() && !stop.contains(it.lowercase(Locale.US)) }
        if (words.size >= 2) {
            return words[0].take(1).uppercase(Locale.US) + words[1].take(1).uppercase(Locale.US)
        }
        return team.take(2).uppercase(Locale.US)
    }

    /**
     * Resolve an ESPN logo URL from a team name + sport. Ports RN `resolveLogoUrl`
     * so the discs show real logos when the caller only has matchup names (Top
     * Agent Picks feed). NFL matchups carry city names, NBA full+city names, MLB
     * full names (fuzzy via the shared [MLBTeams] table). CFB/NCAAB return null.
     */
    fun logoURL(team: String, sport: SportLeague): String? = when (sport) {
        SportLeague.NFL -> nflLogo[team]?.let { "https://a.espncdn.com/i/teamlogos/nfl/500/$it.png" }
        SportLeague.NBA -> nbaLogo[team]?.let { "https://a.espncdn.com/i/teamlogos/nba/500/$it.png" }
        SportLeague.MLB -> MLBTeams.info(team)?.logoUrl
        SportLeague.CFB, SportLeague.NCAAB -> null
    }

    // ESPN slug maps. NFL keyed by city; NBA carries both full and city keys.
    private val nflLogo: Map<String, String> = mapOf(
        "Arizona" to "ari", "Atlanta" to "atl", "Baltimore" to "bal", "Buffalo" to "buf",
        "Carolina" to "car", "Chicago" to "chi", "Cincinnati" to "cin", "Cleveland" to "cle",
        "Dallas" to "dal", "Denver" to "den", "Detroit" to "det", "Green Bay" to "gb",
        "Houston" to "hou", "Indianapolis" to "ind", "Jacksonville" to "jax", "Kansas City" to "kc",
        "Las Vegas" to "lv", "Los Angeles Chargers" to "lac", "Los Angeles Rams" to "lar",
        "LA Chargers" to "lac", "LA Rams" to "lar", "Miami" to "mia", "Minnesota" to "min",
        "New England" to "ne", "New Orleans" to "no", "NY Giants" to "nyg", "NY Jets" to "nyj",
        "Philadelphia" to "phi", "Pittsburgh" to "pit", "San Francisco" to "sf",
        "Seattle" to "sea", "Tampa Bay" to "tb", "Tennessee" to "ten", "Washington" to "wsh",
    )

    private val nbaLogo: Map<String, String> = mapOf(
        "Atlanta Hawks" to "atl", "Atlanta" to "atl", "Boston Celtics" to "bos", "Boston" to "bos",
        "Brooklyn Nets" to "bkn", "Brooklyn" to "bkn", "Charlotte Hornets" to "cha", "Charlotte" to "cha",
        "Chicago Bulls" to "chi", "Chicago" to "chi", "Cleveland Cavaliers" to "cle", "Cleveland" to "cle",
        "Dallas Mavericks" to "dal", "Dallas" to "dal", "Denver Nuggets" to "den", "Denver" to "den",
        "Detroit Pistons" to "det", "Detroit" to "det", "Golden State Warriors" to "gs", "Golden State" to "gs",
        "Houston Rockets" to "hou", "Houston" to "hou", "Indiana Pacers" to "ind", "Indiana" to "ind",
        "LA Clippers" to "lac", "Los Angeles Clippers" to "lac", "LA Lakers" to "lal", "Los Angeles Lakers" to "lal",
        "Memphis Grizzlies" to "mem", "Memphis" to "mem", "Miami Heat" to "mia", "Miami" to "mia",
        "Milwaukee Bucks" to "mil", "Milwaukee" to "mil", "Minnesota Timberwolves" to "min", "Minnesota" to "min",
        "New Orleans Pelicans" to "no", "New Orleans" to "no", "New York Knicks" to "ny", "New York" to "ny",
        "Oklahoma City Thunder" to "okc", "Oklahoma City" to "okc", "Orlando Magic" to "orl", "Orlando" to "orl",
        "Philadelphia 76ers" to "phi", "Philadelphia" to "phi", "Phoenix Suns" to "phx", "Phoenix" to "phx",
        "Portland Trail Blazers" to "por", "Portland" to "por", "Sacramento Kings" to "sac", "Sacramento" to "sac",
        "San Antonio Spurs" to "sa", "San Antonio" to "sa", "Toronto Raptors" to "tor", "Toronto" to "tor",
        "Utah Jazz" to "utah", "Utah" to "utah", "Washington Wizards" to "wsh", "Washington" to "wsh",
    )

    // Primary brand colors (city + full-name keys). Mirror of RN
    // getNFLTeamColors / getNBATeamColors — only the primary is needed since the
    // gradient blends away→home primaries.
    private val nflPrimary: Map<String, Long> = mapOf(
        "Arizona" to 0x97233F, "Arizona Cardinals" to 0x97233F, "Atlanta" to 0xA71930, "Atlanta Falcons" to 0xA71930,
        "Baltimore" to 0x241773, "Baltimore Ravens" to 0x241773, "Buffalo" to 0x00338D, "Buffalo Bills" to 0x00338D,
        "Carolina" to 0x0085CA, "Carolina Panthers" to 0x0085CA, "Chicago" to 0x0B162A, "Chicago Bears" to 0x0B162A,
        "Cincinnati" to 0xFB4F14, "Cincinnati Bengals" to 0xFB4F14, "Cleveland" to 0x311D00, "Cleveland Browns" to 0x311D00,
        "Dallas" to 0x003594, "Dallas Cowboys" to 0x003594, "Denver" to 0xFB4F14, "Denver Broncos" to 0xFB4F14,
        "Detroit" to 0x0076B6, "Detroit Lions" to 0x0076B6, "Green Bay" to 0x203731, "Green Bay Packers" to 0x203731,
        "Houston" to 0x03202F, "Houston Texans" to 0x03202F, "Indianapolis" to 0x002C5F, "Indianapolis Colts" to 0x002C5F,
        "Jacksonville" to 0x101820, "Jacksonville Jaguars" to 0x101820, "Kansas City" to 0xE31837, "Kansas City Chiefs" to 0xE31837,
        "Las Vegas" to 0x000000, "Las Vegas Raiders" to 0x000000, "Los Angeles Chargers" to 0x0080C6, "LA Chargers" to 0x0080C6,
        "Los Angeles Rams" to 0x003594, "LA Rams" to 0x003594, "Miami" to 0x008E97, "Miami Dolphins" to 0x008E97,
        "Minnesota" to 0x4F2683, "Minnesota Vikings" to 0x4F2683, "New England" to 0x002244, "New England Patriots" to 0x002244,
        "New Orleans" to 0x101820, "New Orleans Saints" to 0x101820, "NY Giants" to 0x0B2265, "New York Giants" to 0x0B2265,
        "NY Jets" to 0x125740, "New York Jets" to 0x125740, "Philadelphia" to 0x004C54, "Philadelphia Eagles" to 0x004C54,
        "Pittsburgh" to 0xFFB612, "Pittsburgh Steelers" to 0xFFB612, "San Francisco" to 0xAA0000, "San Francisco 49ers" to 0xAA0000,
        "Seattle" to 0x002244, "Seattle Seahawks" to 0x002244, "Tampa Bay" to 0xD50A0A, "Tampa Bay Buccaneers" to 0xD50A0A,
        "Tennessee" to 0x0C2340, "Tennessee Titans" to 0x0C2340, "Washington" to 0x5A1414, "Washington Commanders" to 0x5A1414,
    )

    private val nbaPrimary: Map<String, Long> = mapOf(
        "Atlanta Hawks" to 0xE03A3E, "Atlanta" to 0xE03A3E, "Boston Celtics" to 0x007A33, "Boston" to 0x007A33,
        "Brooklyn Nets" to 0x000000, "Brooklyn" to 0x000000, "Charlotte Hornets" to 0x1D1160, "Charlotte" to 0x1D1160,
        "Chicago Bulls" to 0xCE1141, "Chicago" to 0xCE1141, "Cleveland Cavaliers" to 0x860038, "Cleveland" to 0x860038,
        "Dallas Mavericks" to 0x00538C, "Dallas" to 0x00538C, "Denver Nuggets" to 0x0E2240, "Denver" to 0x0E2240,
        "Detroit Pistons" to 0xC8102E, "Detroit" to 0xC8102E, "Golden State Warriors" to 0x1D428A, "Golden State" to 0x1D428A,
        "Houston Rockets" to 0xCE1141, "Houston" to 0xCE1141, "Indiana Pacers" to 0x002D62, "Indiana" to 0x002D62,
        "LA Clippers" to 0xC8102E, "Los Angeles Clippers" to 0xC8102E, "LA Lakers" to 0x552583, "Los Angeles Lakers" to 0x552583,
        "Memphis Grizzlies" to 0x5D76A9, "Memphis" to 0x5D76A9, "Miami Heat" to 0x98002E, "Miami" to 0x98002E,
        "Milwaukee Bucks" to 0x00471B, "Milwaukee" to 0x00471B, "Minnesota Timberwolves" to 0x0C2340, "Minnesota" to 0x0C2340,
        "New Orleans Pelicans" to 0x0C2340, "New Orleans" to 0x0C2340, "New York Knicks" to 0x006BB6, "New York" to 0x006BB6,
        "Oklahoma City Thunder" to 0x007AC1, "Oklahoma City" to 0x007AC1, "Orlando Magic" to 0x0077C0, "Orlando" to 0x0077C0,
        "Philadelphia 76ers" to 0x006BB6, "Philadelphia" to 0x006BB6, "Phoenix Suns" to 0x1D1160, "Phoenix" to 0x1D1160,
        "Portland Trail Blazers" to 0xE03A3E, "Portland" to 0xE03A3E, "Sacramento Kings" to 0x5A2D81, "Sacramento" to 0x5A2D81,
        "San Antonio Spurs" to 0xC4CED4, "San Antonio" to 0xC4CED4, "Toronto Raptors" to 0xCE1141, "Toronto" to 0xCE1141,
        "Utah Jazz" to 0x002B5C, "Utah" to 0x002B5C, "Washington Wizards" to 0x002B5C, "Washington" to 0x002B5C,
    )
}
