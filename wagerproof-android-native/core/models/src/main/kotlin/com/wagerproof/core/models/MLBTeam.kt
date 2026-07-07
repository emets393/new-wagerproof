package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FlexibleDoubleOrZeroSerializer
import com.wagerproof.core.models.serialization.FlexibleIntOrZeroSerializer
import com.wagerproof.core.models.serialization.PercentFlexibleDoubleSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Port of iOS MLBTeam.swift: team mapping row, static brand map, situational
// trends, bucket accuracy and the regression-report JSONB payload types.

/**
 * MLB team mapping row. Mirrors RN `MLBTeamMapping` in
 * `wagerproof-mobile/types/mlb.ts`. Hydrated from `mlb_team_mapping`.
 */
@Serializable
data class MLBTeamMapping(
    @SerialName("mlb_api_id") val mlbApiId: Int,
    val team: String,
    @SerialName("team_name") val teamName: String,
    @SerialName("logo_url") val logoUrl: String? = null,
)

/**
 * Static MLB team color + abbreviation map. Mirrors RN
 * `wagerproof-mobile/constants/mlbTeams.ts`. Used both as the primary
 * color source for gradients/avatars and as a fallback when the
 * `mlb_team_mapping` table is empty.
 */
object MLBTeams {
    data class TeamInfo(
        val team: String,
        val logoUrl: String,
        val primaryHex: Long,
        val secondaryHex: Long,
    )

    /** MLB Stats API team_id → (abbrev, espnSlug). */
    data class Brand(val abbrev: String, val espnSlug: String)

    /** Resolved (abbrev, logoUrl) pair for a team_id. */
    data class Display(val abbrev: String, val logoUrl: String)

    /** Primary/secondary hex color pair. */
    data class ColorPair(val primary: Long, val secondary: Long)

    val byNormalizedName: Map<String, TeamInfo> = mapOf(
        "arizona diamondbacks" to TeamInfo("ARI", "https://a.espncdn.com/i/teamlogos/mlb/500/ari.png", 0xA71930L, 0xE3D4ADL),
        "atlanta braves" to TeamInfo("ATL", "https://a.espncdn.com/i/teamlogos/mlb/500/atl.png", 0xCE1141L, 0x13274FL),
        "baltimore orioles" to TeamInfo("BAL", "https://a.espncdn.com/i/teamlogos/mlb/500/bal.png", 0xDF4601L, 0x27251FL),
        "boston red sox" to TeamInfo("BOS", "https://a.espncdn.com/i/teamlogos/mlb/500/bos.png", 0xBD3039L, 0x0C2340L),
        "chicago cubs" to TeamInfo("CHC", "https://a.espncdn.com/i/teamlogos/mlb/500/chc.png", 0x0E3386L, 0xCC3433L),
        "chicago white sox" to TeamInfo("CWS", "https://a.espncdn.com/i/teamlogos/mlb/500/cws.png", 0x27251FL, 0xC4CED4L),
        "cincinnati reds" to TeamInfo("CIN", "https://a.espncdn.com/i/teamlogos/mlb/500/cin.png", 0xC6011FL, 0x27251FL),
        "cleveland guardians" to TeamInfo("CLE", "https://a.espncdn.com/i/teamlogos/mlb/500/cle.png", 0x00385DL, 0xE31937L),
        "colorado rockies" to TeamInfo("COL", "https://a.espncdn.com/i/teamlogos/mlb/500/col.png", 0x333366L, 0xC4CED4L),
        "detroit tigers" to TeamInfo("DET", "https://a.espncdn.com/i/teamlogos/mlb/500/det.png", 0x0C2340L, 0xFA4616L),
        "houston astros" to TeamInfo("HOU", "https://a.espncdn.com/i/teamlogos/mlb/500/hou.png", 0x002D62L, 0xEB6E1FL),
        "kansas city royals" to TeamInfo("KC", "https://a.espncdn.com/i/teamlogos/mlb/500/kc.png", 0x004687L, 0xBD9B60L),
        "los angeles angels" to TeamInfo("LAA", "https://a.espncdn.com/i/teamlogos/mlb/500/laa.png", 0xBA0021L, 0x003263L),
        "los angeles dodgers" to TeamInfo("LAD", "https://a.espncdn.com/i/teamlogos/mlb/500/lad.png", 0x005A9CL, 0xEF3E42L),
        "miami marlins" to TeamInfo("MIA", "https://a.espncdn.com/i/teamlogos/mlb/500/mia.png", 0x00A3E0L, 0xEF3340L),
        "milwaukee brewers" to TeamInfo("MIL", "https://a.espncdn.com/i/teamlogos/mlb/500/mil.png", 0xFFC52FL, 0x12284BL),
        "minnesota twins" to TeamInfo("MIN", "https://a.espncdn.com/i/teamlogos/mlb/500/min.png", 0x002B5CL, 0xD31145L),
        "new york mets" to TeamInfo("NYM", "https://a.espncdn.com/i/teamlogos/mlb/500/nym.png", 0x002D72L, 0xFF5910L),
        "new york yankees" to TeamInfo("NYY", "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png", 0x003087L, 0x132448L),
        "oakland athletics" to TeamInfo("OAK", "https://a.espncdn.com/i/teamlogos/mlb/500/oak.png", 0x003831L, 0xEFB21EL),
        "philadelphia phillies" to TeamInfo("PHI", "https://a.espncdn.com/i/teamlogos/mlb/500/phi.png", 0xE81828L, 0x002D72L),
        "pittsburgh pirates" to TeamInfo("PIT", "https://a.espncdn.com/i/teamlogos/mlb/500/pit.png", 0x27251FL, 0xFDB827L),
        "san diego padres" to TeamInfo("SD", "https://a.espncdn.com/i/teamlogos/mlb/500/sd.png", 0x2F241DL, 0xFFC425L),
        "san francisco giants" to TeamInfo("SF", "https://a.espncdn.com/i/teamlogos/mlb/500/sf.png", 0xFD5A1EL, 0x27251FL),
        "seattle mariners" to TeamInfo("SEA", "https://a.espncdn.com/i/teamlogos/mlb/500/sea.png", 0x0C2C56L, 0x005C5CL),
        "st louis cardinals" to TeamInfo("STL", "https://a.espncdn.com/i/teamlogos/mlb/500/stl.png", 0xC41E3AL, 0x0C2340L),
        "tampa bay rays" to TeamInfo("TB", "https://a.espncdn.com/i/teamlogos/mlb/500/tb.png", 0x092C5CL, 0x8FBCE6L),
        "texas rangers" to TeamInfo("TEX", "https://a.espncdn.com/i/teamlogos/mlb/500/tex.png", 0x003278L, 0xC0111FL),
        "toronto blue jays" to TeamInfo("TOR", "https://a.espncdn.com/i/teamlogos/mlb/500/tor.png", 0x134A8EL, 0x1D2D5CL),
        "washington nationals" to TeamInfo("WSH", "https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png", 0xAB0003L, 0x14225AL),
    )

    /**
     * MLB Stats API `team_id` → `(abbrev, espnSlug)`. Used by the betting trends
     * flow which carries `team_id` (not `team_name`) from
     * `mlb_situational_trends_today`. Mirrors RN `MLB_TEAM_BY_ID`.
     */
    val brandById: Map<Int, Brand> = mapOf(
        108 to Brand("LAA", "laa"), 109 to Brand("ARI", "ari"), 110 to Brand("BAL", "bal"),
        111 to Brand("BOS", "bos"), 112 to Brand("CHC", "chc"), 113 to Brand("CIN", "cin"),
        114 to Brand("CLE", "cle"), 115 to Brand("COL", "col"), 116 to Brand("DET", "det"),
        117 to Brand("HOU", "hou"), 118 to Brand("KC", "kc"), 119 to Brand("LAD", "lad"),
        120 to Brand("WSH", "wsh"), 121 to Brand("NYM", "nym"), 133 to Brand("ATH", "ath"),
        134 to Brand("PIT", "pit"), 135 to Brand("SD", "sd"), 136 to Brand("SEA", "sea"),
        137 to Brand("SF", "sf"), 138 to Brand("STL", "stl"), 139 to Brand("TB", "tb"),
        140 to Brand("TEX", "tex"), 141 to Brand("TOR", "tor"), 142 to Brand("MIN", "min"),
        143 to Brand("PHI", "phi"), 144 to Brand("ATL", "atl"), 145 to Brand("CWS", "cws"),
        146 to Brand("MIA", "mia"), 147 to Brand("NYY", "nyy"), 158 to Brand("MIL", "mil"),
    )

    /**
     * Normalize a team name for lookup (trim, lowercase, strip apostrophes,
     * collapse whitespace). Matches RN `normalizeTeamNameKey`.
     */
    fun normalize(name: String): String {
        val stripped = name.trim().lowercase()
            .replace(".", "")
            .replace("'", "")
            .replace("’", "")
        return stripped.split(" ").filter { it.isNotEmpty() }.joinToString(" ")
    }

    /**
     * Team info by full name (with fuzzy fallback). Mirrors RN
     * `getMLBFallbackTeamInfo`.
     */
    fun info(teamName: String): TeamInfo? {
        val normalized = normalize(teamName)
        byNormalizedName[normalized]?.let { return it }
        // Fuzzy: substring either direction, best = longest min-length match.
        var best: TeamInfo? = null
        var bestScore = 0
        for ((key, info) in byNormalizedName) {
            if (key.contains(normalized) || normalized.contains(key)) {
                val score = minOf(key.length, normalized.length)
                if (score > bestScore) {
                    bestScore = score
                    best = info
                }
            }
        }
        return best
    }

    /**
     * Resolve `(abbrev, logoUrl)` from MLB Stats API team_id. Returns null
     * when the team_id isn't in the static brand map.
     */
    fun displayById(teamId: Int): Display? {
        val brand = brandById[teamId] ?: return null
        return Display(brand.abbrev, "https://a.espncdn.com/i/teamlogos/mlb/500/${brand.espnSlug}.png")
    }

    /** Short display name — e.g. "Marlins", "White Sox", "Red Sox". */
    fun nickname(nameOrAbbrev: String): String {
        val upper = nameOrAbbrev.uppercase()
        byNormalizedName.entries.firstOrNull { it.value.team == upper }?.let { return mascot(it.key) }
        return mascot(normalize(nameOrAbbrev))
    }

    private val twoTokenMascots = setOf("red sox", "white sox", "blue jays")

    private fun mascot(normalized: String): String {
        val tokens = normalized.split(" ").filter { it.isNotEmpty() }
        if (tokens.size < 2) {
            return tokens.firstOrNull()?.let { capitalizeToken(it) } ?: capitalizeToken(normalized)
        }
        val lastTwo = tokens.takeLast(2).joinToString(" ")
        if (lastTwo in twoTokenMascots) {
            // Two-token mascots preserved ("Red Sox"), else last token capitalized.
            return lastTwo.split(" ").joinToString(" ") { capitalizeToken(it) }
        }
        return capitalizeToken(tokens.last())
    }

    // Mirrors Swift's `.capitalized` on a single token (first upper, rest lower).
    private fun capitalizeToken(token: String): String =
        token.lowercase().replaceFirstChar { it.uppercaseChar() }

    /**
     * Team primary/secondary hex colors by name or abbreviation. Falls
     * back to a neutral pair if nothing matches. Matches RN
     * `getMLBTeamColors`.
     */
    fun colors(nameOrAbbrev: String): ColorPair {
        val upper = nameOrAbbrev.uppercase()
        byNormalizedName.values.firstOrNull { it.team == upper }?.let {
            return ColorPair(it.primaryHex, it.secondaryHex)
        }
        info(nameOrAbbrev)?.let { return ColorPair(it.primaryHex, it.secondaryHex) }
        return ColorPair(0x1F2937L, 0x6B7280L)
    }

    /** ESPN logo URL by abbreviation or full team name. */
    fun logoUrl(nameOrAbbrev: String): String? {
        val upper = nameOrAbbrev.uppercase()
        byNormalizedName.values.firstOrNull { it.team == upper }?.let { return it.logoUrl }
        return info(nameOrAbbrev)?.logoUrl
    }
}

// Trends -------------------------------------------------------------------

/**
 * One row from `mlb_situational_trends_today` (or fallback table).
 * Mirrors RN `MLBSituationalTrendRow`. PostgREST returns numeric or string
 * for the pct columns (sometimes with a `%` suffix) — accept both.
 */
@Serializable
data class MLBSituationalTrendRow(
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    @SerialName("game_pk") val gamePk: Int = 0,
    @SerialName("game_date_et") val gameDateEt: String = "",
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    @SerialName("team_id") val teamId: Int = 0,
    @SerialName("team_name") val teamName: String = "",
    /** "home" | "away" */
    @SerialName("team_side") val teamSide: String = "",

    @SerialName("last_game_situation") val lastGameSituation: String? = null,
    @SerialName("home_away_situation") val homeAwaySituation: String? = null,
    @SerialName("fav_dog_situation") val favDogSituation: String? = null,
    @SerialName("rest_bucket") val restBucket: String? = null,
    @SerialName("rest_comp") val restComp: String? = null,
    @SerialName("league_situation") val leagueSituation: String? = null,
    @SerialName("division_situation") val divisionSituation: String? = null,

    // win % (moneyline)
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    @SerialName("win_pct_last_game") val winPctLastGame: Double? = null,
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    @SerialName("win_pct_home_away") val winPctHomeAway: Double? = null,
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    @SerialName("win_pct_fav_dog") val winPctFavDog: Double? = null,
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    @SerialName("win_pct_rest_bucket") val winPctRestBucket: Double? = null,
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    @SerialName("win_pct_rest_comp") val winPctRestComp: Double? = null,
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    @SerialName("win_pct_league") val winPctLeague: Double? = null,
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    @SerialName("win_pct_division") val winPctDivision: Double? = null,

    // over %
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    @SerialName("over_pct_last_game") val overPctLastGame: Double? = null,
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    @SerialName("over_pct_home_away") val overPctHomeAway: Double? = null,
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    @SerialName("over_pct_fav_dog") val overPctFavDog: Double? = null,
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    @SerialName("over_pct_rest_bucket") val overPctRestBucket: Double? = null,
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    @SerialName("over_pct_rest_comp") val overPctRestComp: Double? = null,
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    @SerialName("over_pct_league") val overPctLeague: Double? = null,
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    @SerialName("over_pct_division") val overPctDivision: Double? = null,
)

/** Per-game trends bundle: home + away rows. Client-built, not serialized. */
data class MLBGameTrends(
    val gamePk: Int,
    val gameDateEt: String,
    var gameTimeEt: String? = null,
    val awayTeam: MLBSituationalTrendRow,
    val homeTeam: MLBSituationalTrendRow,
    var ouConsensusScore: Double = 0.0,
    var mlDominanceScore: Double = 0.0,
) {
    val id: Int get() = gamePk
}

enum class MLBSituationType(val raw: String) {
    LAST_GAME("lastGame"),
    HOME_AWAY("homeAway"),
    FAV_DOG("favDog"),
    REST_BUCKET("restBucket"),
    REST_COMP("restComp"),
    LEAGUE("league"),
    DIVISION("division"),
}

enum class MLBTrendsSortMode(val raw: String) {
    TIME("time"),
    OU_CONSENSUS("ouConsensus"),
    ML_DOMINANCE("mlDominance"),
}

private val mlbSituationLabels: Map<String, String> = mapOf(
    "is_after_loss" to "After Loss",
    "is_after_win" to "After Win",
    "is_fav" to "Favorite",
    "is_dog" to "Underdog",
    "is_home_fav" to "Home Favorite",
    "is_away_fav" to "Away Favorite",
    "is_home_dog" to "Home Underdog",
    "is_away_dog" to "Away Underdog",
    "one_day_off" to "1 Day Off",
    "two_three_days_off" to "2-3 Days Off",
    "four_plus_days_off" to "4+ Days Off",
    "rest_advantage" to "Rest Advantage",
    "rest_disadvantage" to "Rest Disadvantage",
    "rest_equal" to "Equal Rest",
    "is_home" to "Home",
    "is_away" to "Away",
    "no_rest" to "No Rest",
    "equal_rest" to "Equal Rest",
    "non_league" to "Non-League",
    "non_division" to "Non-Division",
    "league" to "League",
    "division" to "Division",
)

/**
 * Convert an encoded MLB situation tag into its display label. Mirrors RN
 * `formatMLBSituation` (`types/mlbBettingTrends.ts`) — the shared map plus
 * the MLB-only home/rest/league/division entries; unknown tags fall back to
 * title-cased words, null to an em dash.
 */
fun formatMLBSituation(situation: String?): String {
    if (situation.isNullOrEmpty()) return "—"
    mlbSituationLabels[situation]?.let { return it }
    return situation.replace("_", " ")
        .split(" ")
        .filter { it.isNotEmpty() }
        .joinToString(" ") { it.replaceFirstChar { c -> c.uppercaseChar() } }
}

// Bucket accuracy ------------------------------------------------------------

/** One row from `mlb_model_bucket_accuracy`. Mirrors RN `BucketAccuracyRow`. */
@Serializable
data class MLBBucketAccuracyRow(
    /** full_ml | full_ou | f5_ml | f5_ou | perfect_storm */
    @SerialName("bet_type") val betType: String = "",
    val bucket: String = "",
    val side: String = "",
    @SerialName("fav_dog") val favDog: String = "",
    val direction: String = "",
    val games: Int = 0,
    val wins: Int = 0,
    val losses: Int = 0,
    val pushes: Int = 0,
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    @SerialName("units_won") val unitsWon: Double = 0.0,
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    @SerialName("win_pct") val winPct: Double = 0.0,
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    @SerialName("roi_pct") val roiPct: Double = 0.0,
    @SerialName("updated_at") val updatedAt: String? = null,
)

/** Client-only aggregation shell. */
data class MLBBucketTally(
    var games: Int = 0,
    var wins: Int = 0,
    var winPct: Double = 0.0,
    var unitsWon: Double = 0.0,
    var roiPct: Double = 0.0,
)

data class MLBBucketBucket(
    val bucket: String,
    val side: String? = null,
    val favDog: String? = null,
    val direction: String? = null,
    val games: Int,
    val wins: Int,
    val winPct: Double,
    val unitsWon: Double,
    val roiPct: Double,
)

data class MLBBetTypeAccuracy(
    var overall: MLBBucketTally = MLBBucketTally(),
    var byBucket: List<MLBBucketBucket> = emptyList(),
)

/** Final aggregated table. Mirrors RN `MLBBucketAccuracy`. */
data class MLBBucketAccuracy(
    var fullMl: MLBBetTypeAccuracy = MLBBetTypeAccuracy(),
    var fullOu: MLBBetTypeAccuracy = MLBBetTypeAccuracy(),
    var f5Ml: MLBBetTypeAccuracy = MLBBetTypeAccuracy(),
    var f5Ou: MLBBetTypeAccuracy = MLBBetTypeAccuracy(),
    var perfectStorm: MLBBetTypeAccuracy = MLBBetTypeAccuracy(),
) {
    fun betType(key: String): MLBBetTypeAccuracy = when (key) {
        "full_ml" -> fullMl
        "full_ou" -> fullOu
        "f5_ml" -> f5Ml
        "f5_ou" -> f5Ou
        "perfect_storm" -> perfectStorm
        else -> MLBBetTypeAccuracy()
    }
}

/** One bucket lookup result. Mirrors RN `BucketAccuracyResult`. */
data class MLBBucketLookup(
    val winPct: Double,
    val roiPct: Double,
    val record: String,
)

// Regression report payloads (mirrors RN; these live inside a JSONB report row) --

@Serializable
data class MLBPitcherRegression(
    @SerialName("pitcher_name") val pitcherName: String,
    @SerialName("team_name") val teamName: String,
    val opponent: String? = null,
    val starts: Int,
    val ip: Double,
    val era: Double,
    val xfip: Double,
    val xera: Double? = null,
    val fip: Double? = null,
    val whip: Double? = null,
    @SerialName("era_minus_xfip") val eraMinusXfip: Double,
    val xwoba: Double? = null,
    @SerialName("k_pct") val kPct: Double? = null,
    @SerialName("bb_pct") val bbPct: Double? = null,
    @SerialName("hard_hit_pct") val hardHitPct: Double? = null,
    @SerialName("barrel_pct") val barrelPct: Double? = null,
    @SerialName("hr_per_9") val hrPer9: Double? = null,
    @SerialName("l3_era") val l3Era: Double? = null,
    @SerialName("l3_xfip") val l3Xfip: Double? = null,
    @SerialName("l3_xera") val l3Xera: Double? = null,
    @SerialName("l3_xwoba") val l3Xwoba: Double? = null,
    @SerialName("l3_fip") val l3Fip: Double? = null,
    @SerialName("l3_whip") val l3Whip: Double? = null,
    @SerialName("trend_era") val trendEra: Double? = null,
    @SerialName("trend_xfip") val trendXfip: Double? = null,
    @SerialName("trend_xera") val trendXera: Double? = null,
    @SerialName("trend_xwoba") val trendXwoba: Double? = null,
    @SerialName("trend_fip") val trendFip: Double? = null,
    @SerialName("trend_whip") val trendWhip: Double? = null,
    val severity: String,
    @SerialName("severity_score") val severityScore: Double,
)

@Serializable
data class MLBBattingRegression(
    @SerialName("team_name") val teamName: String,
    @SerialName("today_vs_pitcher") val todayVsPitcher: String? = null,
    val games: Int,
    @SerialName("batting_avg") val battingAvg: Double? = null,
    val babip: Double,
    val xwobacon: Double? = null,
    val woba: Double? = null,
    @SerialName("woba_gap") val wobaGap: Double? = null,
    @SerialName("hard_hit_pct") val hardHitPct: Double? = null,
    @SerialName("barrel_pct") val barrelPct: Double? = null,
    @SerialName("avg_ev") val avgEv: Double? = null,
    @SerialName("launch_angle") val launchAngle: Double? = null,
    val slg: Double? = null,
    val obp: Double? = null,
    @SerialName("k_pct") val kPct: Double? = null,
    @SerialName("bb_pct") val bbPct: Double? = null,
    val hr: Int? = null,
    @SerialName("hr_per_game") val hrPerGame: Double? = null,
    @SerialName("l5_woba") val l5Woba: Double? = null,
    @SerialName("l5_xwobacon") val l5Xwobacon: Double? = null,
    @SerialName("l5_hard_hit_pct") val l5HardHitPct: Double? = null,
    @SerialName("l5_barrel_pct") val l5BarrelPct: Double? = null,
    @SerialName("l5_avg_ev") val l5AvgEv: Double? = null,
    @SerialName("l5_bb_pct") val l5BbPct: Double? = null,
    @SerialName("trend_woba") val trendWoba: Double? = null,
    @SerialName("trend_xwobacon") val trendXwobacon: Double? = null,
    @SerialName("trend_hard_hit_pct") val trendHardHitPct: Double? = null,
    @SerialName("trend_barrel_pct") val trendBarrelPct: Double? = null,
    @SerialName("trend_avg_launch_speed") val trendAvgLaunchSpeed: Double? = null,
    val severity: String? = null,
    @SerialName("severity_score") val severityScore: Double? = null,
)

@Serializable
data class MLBBullpenFatigue(
    @SerialName("team_name") val teamName: String,
    @SerialName("bp_ip_last3d") val bpIpLast3d: Double,
    @SerialName("bp_ip_last5d") val bpIpLast5d: Double,
    @SerialName("bp_ip_last7d") val bpIpLast7d: Double,
    @SerialName("season_bp_xfip") val seasonBpXfip: Double? = null,
    @SerialName("trend_bp_xfip") val trendBpXfip: Double? = null,
    @SerialName("season_bp_xera") val seasonBpXera: Double? = null,
    @SerialName("trend_bp_xera") val trendBpXera: Double? = null,
    val flag: String,
    val flags: List<String>,
    val trending: String? = null,
)

@Serializable
data class MLBSuggestedPick(
    @SerialName("game_pk") val gamePk: Int,
    /** full_ml | full_ou | f5_ml | f5_ou */
    @SerialName("bet_type") val betType: String,
    val pick: String,
    val matchup: String,
    @SerialName("home_team") val homeTeam: String,
    @SerialName("away_team") val awayTeam: String,
    @SerialName("game_time_et") val gameTimeEt: String? = null,
    @SerialName("game_number") val gameNumber: Int? = null,
    @SerialName("model_prob") val modelProb: Double? = null,
    @SerialName("fair_value") val fairValue: Double? = null,
    @SerialName("edge_at_suggestion") val edgeAtSuggestion: Double,
    @SerialName("line_at_suggestion") val lineAtSuggestion: Double? = null,
    @SerialName("edge_bucket") val edgeBucket: String,
    @SerialName("bucket_win_pct") val bucketWinPct: Double,
    @SerialName("bucket_sample") val bucketSample: Int,
    /** "high" | "moderate" */
    @SerialName("confidence_at_suggestion") val confidenceAtSuggestion: String,
    val reasoning: String? = null,
    @SerialName("home_sp") val homeSp: String? = null,
    @SerialName("away_sp") val awaySp: String? = null,
    @SerialName("first_suggested_at") val firstSuggestedAt: String? = null,
    val locked: Boolean? = null,
    /** hammer | ps | lean | watch — drives the tier badge + accent color. */
    @SerialName("perfect_storm_tier") val perfectStormTier: String? = null,
    @SerialName("is_doubleheader") val isDoubleheader: Boolean? = null,
) {
    val id: String get() = "$gamePk-$betType"
}

@Serializable
data class MLBYesterdayRecap(
    @SerialName("game_pk") val gamePk: Int,
    @SerialName("bet_type") val betType: String,
    val pick: String,
    val matchup: String,
    /** "won" | "lost" | "push" */
    val result: String,
    @SerialName("actual_score") val actualScore: String,
    val confidence: String? = null,
    @SerialName("edge_bucket") val edgeBucket: String? = null,
)

@Serializable
data class MLBCumulativeBucket(
    val wins: Int,
    val losses: Int,
    val pushes: Int,
    @SerialName("units_won") val unitsWon: Double,
    @SerialName("win_pct") val winPct: Double,
    @SerialName("roi_pct") val roiPct: Double,
)

@Serializable
data class MLBCumulativeDaily(
    val date: String,
    val wins: Int,
    val losses: Int,
    val pushes: Int,
    @SerialName("units_won") val unitsWon: Double? = null,
    @SerialName("cumulative_win_pct") val cumulativeWinPct: Double,
    @SerialName("cumulative_units") val cumulativeUnits: Double? = null,
)

@Serializable
data class MLBCumulativeRecord(
    val total: MLBCumulativeBucket,
    @SerialName("by_bet_type") val byBetType: Map<String, MLBCumulativeBucket>? = null,
    @SerialName("daily_log") val dailyLog: List<MLBCumulativeDaily>? = null,
)

@Serializable
data class MLBPerfectStorm(
    @SerialName("game_pk") val gamePk: Int,
    val matchup: String,
    val direction: String,
    @SerialName("storm_score") val stormScore: Double,
    /** Batting-only storms omit the opposing SP regression block. */
    val pitcher: MLBPitcherRegression? = null,
    /**
     * Pitcher-only storms omit the batting regression block — the ETL can
     * emit either side as null (see jun-2026 payloads with mixed nulls).
     */
    val batting: MLBBattingRegression? = null,
    val narrative: String,
)

@Serializable
data class MLBWeatherParkFlag(
    @SerialName("game_pk") val gamePk: Int,
    val matchup: String,
    val venue: String,
    @SerialName("temperature_f") val temperatureF: Double? = null,
    @SerialName("wind_speed_mph") val windSpeedMph: Double? = null,
    @SerialName("wind_direction") val windDirection: String? = null,
    @SerialName("park_factor_runs") val parkFactorRuns: Double? = null,
    val flags: List<String>,
)

@Serializable
data class MLBLRSplitEntry(
    @SerialName("team_name") val teamName: String,
    val opponent: String,
    @SerialName("opponent_sp") val opponentSp: String? = null,
    @SerialName("opponent_sp_hand") val opponentSpHand: String,
    val facing: String,
    @SerialName("home_away") val homeAway: String,
    @SerialName("f5_games") val f5Games: Int,
    @SerialName("avg_f5_runs") val avgF5Runs: Double,
    @SerialName("f5_wins") val f5Wins: Int,
    @SerialName("f5_losses") val f5Losses: Int,
    @SerialName("f5_ties") val f5Ties: Int,
    @SerialName("f5_win_pct") val f5WinPct: Double? = null,
    @SerialName("is_notable") val isNotable: Boolean,
)

/** Full daily regression report row. Mirrors RN `MLBRegressionReport`. */
@Serializable
data class MLBRegressionReport(
    @SerialName("report_date") val reportDate: String,
    val season: Int? = null,
    @SerialName("pitcher_negative_regression") val pitcherNegativeRegression: List<MLBPitcherRegression>? = null,
    @SerialName("pitcher_positive_regression") val pitcherPositiveRegression: List<MLBPitcherRegression>? = null,
    @SerialName("batting_heat_up") val battingHeatUp: List<MLBBattingRegression>? = null,
    @SerialName("batting_cool_down") val battingCoolDown: List<MLBBattingRegression>? = null,
    @SerialName("bullpen_fatigue") val bullpenFatigue: List<MLBBullpenFatigue>? = null,
    @SerialName("perfect_storm_matchups") val perfectStormMatchups: List<MLBPerfectStorm>? = null,
    @SerialName("suggested_picks") val suggestedPicks: List<MLBSuggestedPick>? = null,
    @SerialName("yesterday_recap") val yesterdayRecap: List<MLBYesterdayRecap>? = null,
    @SerialName("cumulative_record") val cumulativeRecord: MLBCumulativeRecord? = null,
    @SerialName("weather_park_flags") val weatherParkFlags: List<MLBWeatherParkFlag>? = null,
    @SerialName("lr_splits_today") val lrSplitsToday: List<MLBLRSplitEntry>? = null,
    @SerialName("narrative_text") val narrativeText: String? = null,
    @SerialName("narrative_model") val narrativeModel: String? = null,
    @SerialName("generated_at") val generatedAt: String? = null,
    @SerialName("generation_version") val generationVersion: Int? = null,
)
