package com.wagerproof.core.models

/**
 * Parlay God domain model. Port of iOS `WagerproofModels/ParlayGod.swift`.
 *
 * The feature assembles "perfect streak" parlays: every leg is backed by a
 * 100% (N of N) historical streak in one dimension, and a ticket is 3-5
 * conflict-free legs in the same category. See `.claude/docs/16_parlay_god.md`.
 *
 * Pure data — no Android dependencies — so the engine and its tests run on the
 * JVM. Pro gating lives entirely on the surfaces (`ProContentSection`), not here.
 */

// MARK: - Sports

/**
 * Which league a leg/ticket is built from. The rail mixes sports side by side
 * (per-sport tickets, never cross-sport legs — slates rarely share dates).
 */
enum class ParlaySport(val raw: String) {
    MLB("mlb"),
    NFL("nfl");

    val id: String get() = raw

    val shortLabel: String
        get() = when (this) {
            MLB -> "MLB"
            NFL -> "NFL"
        }

    // iOS SF Symbol name, kept for cross-platform parity; Android maps it
    // through `AppIcon.fromSystemName` at the render site (same convention as
    // `SportLeague.sfSymbol`).
    val sfSymbol: String
        get() = when (this) {
            MLB -> "baseball.fill"
            NFL -> "football.fill"
        }

    companion object {
        /** Header display order for the "Supports" icon cluster. */
        val displayOrder: List<ParlaySport> = listOf(MLB, NFL)

        fun fromRaw(raw: String): ParlaySport? = entries.firstOrNull { it.raw == raw }
    }
}

// MARK: - Categories

/**
 * The "why it's perfect" axis for Parlay God legs. Each rail card is one
 * category: every leg on it is backed by a 100% streak in that dimension.
 */
enum class ParlayGodCategory(val raw: String) {
    VERSUS_OPPONENT("versusOpponent"),
    RECENT_FORM("recentForm"),
    ALTERNATE_LINES("alternateLines"),
    HOME_AWAY("homeAway"),
    TEAM_FORM("teamForm"),
    FAV_DOG("favDog"),
    DAY_NIGHT("dayNight"),
    FIRST_FIVE("firstFive"),
    FIRST_HALF("firstHalf"),
    ARM_TYPE("armType");

    val id: String get() = raw

    val title: String
        get() = when (this) {
            VERSUS_OPPONENT -> "100% Versus Opponent"
            RECENT_FORM -> "100% Recent Form"
            ALTERNATE_LINES -> "100% Alternate Lines"
            HOME_AWAY -> "100% Home/Away"
            TEAM_FORM -> "100% Team Form"
            FAV_DOG -> "100% Fav vs Dog"
            DAY_NIGHT -> "100% Day/Night"
            FIRST_FIVE -> "100% First 5"
            FIRST_HALF -> "100% First Half"
            ARM_TYPE -> "100% vs Arm Type"
        }

    // SF Symbol name for parity; resolved via `AppIcon.fromSystemName`.
    val sfSymbol: String
        get() = when (this) {
            VERSUS_OPPONENT -> "shield.lefthalf.filled"
            RECENT_FORM -> "flame.fill"
            ALTERNATE_LINES -> "slider.horizontal.3"
            HOME_AWAY -> "house.fill"
            TEAM_FORM -> "chart.line.uptrend.xyaxis"
            FAV_DOG -> "pawprint.fill"
            DAY_NIGHT -> "moon.stars.fill"
            FIRST_FIVE -> "5.circle.fill"
            FIRST_HALF -> "circle.lefthalf.filled"
            ARM_TYPE -> "figure.baseball"
        }

    companion object {
        /** Rail display order — the user-confirmed five first, extras after. */
        val displayOrder: List<ParlayGodCategory> = listOf(
            VERSUS_OPPONENT, RECENT_FORM, ALTERNATE_LINES, HOME_AWAY, TEAM_FORM,
            FAV_DOG, DAY_NIGHT, FIRST_FIVE, FIRST_HALF, ARM_TYPE,
        )

        fun fromRaw(raw: String): ParlayGodCategory? = entries.firstOrNull { it.raw == raw }
    }
}

// MARK: - Legs

/**
 * One bettable selection backed by a perfect (100%) streak. Legs are the atoms
 * the engine assembles into [ParlayTicket]s.
 */
data class ParlayLeg(
    val kind: Kind,
    val sport: ParlaySport = ParlaySport.MLB,
    val category: ParlayGodCategory,
    /**
     * `game_pk.toString()` — matches both `OutliersTrendsGame.id` (MLB) and
     * `MLBPropMatchup.gamePk.toString()`, so same-game rules join cleanly.
     * NFL team legs use `nfl_dryrun_games.game_id` ("2025_12_CLE_LV").
     */
    val gameKey: String,
    val matchupLabel: String,
    val gameTimeEt: String?,
    /** Display name: team nickname ("White Sox") or short player name ("A. Kirk"). */
    val subject: String,
    /** Team whose logo/colors decorate the row (player's team for props). */
    val teamAbbr: String?,
    /** MLB player id for headshots on prop legs. */
    val playerId: Int?,
    /** Direct headshot URL (NFL props ship one; MLB resolves off [playerId]). */
    val headshotUrl: String? = null,
    /** The actual bet: "CWS ML", "TOR -1.5", "Over 8.5", "2+ Hits", "Under 1.5 Walks". */
    val betText: String,
    val odds: Int,
    /** Streak credential: "Won 5 straight as underdog", "Hit in 10 straight games". */
    val evidence: String,
    val streakN: Int,
    /** Market key for per-card diversity capping: "ml", "rl", "ou", "f5_ml", "batter_hits", ... */
    val marketKey: String,
    /**
     * Team the bet backs (ML/RL sides). Same-game legs backing different teams
     * conflict; totals legs leave this null.
     */
    val backedTeamAbbr: String? = null,
    /** Set for totals legs so Over/Under of the same market can't share a card. */
    val totalsFamily: String? = null,
    val totalsSide: String? = null,
) {
    enum class Kind(val raw: String) { TEAM("team"), PROP("prop") }

    val id: String get() = "${category.raw}|$gameKey|$subject|$betText"

    val oddsText: String get() = if (odds > 0) "+$odds" else "$odds"

    /** "5/5", "10/10" — perfect streaks are always N of N. */
    val fractionText: String get() = "$streakN/$streakN"
}

// MARK: - Tickets

/** An assembled parlay: 3-5 conflict-free legs plus the combined price. */
data class ParlayTicket(
    val id: String,
    /**
     * Sports contributing legs, in [ParlaySport.displayOrder]. One entry for a
     * per-sport ticket; several when concurrent live slates merged into one
     * cross-sport card.
     */
    val sports: List<ParlaySport> = listOf(ParlaySport.MLB),
    val category: ParlayGodCategory,
    val legs: List<ParlayLeg>,
    val combinedOddsText: String,
) {
    /** True when every leg comes from the same game (matchup-widget tickets). */
    val isSameGame: Boolean get() = legs.map { it.gameKey }.toSet().size == 1
}

// MARK: - NFL slate odds

/**
 * ML + first-half closes for one NFL slate game.
 *
 * iOS carries these on `OutliersTrendsGame.nflContext`, hydrated by
 * `OutliersTrendsService` because its NFL game select includes the
 * `fg_ml_*` / `h1_*` columns. Android's `OutliersTrendsService` selects a
 * narrower column list (the Outliers trend cards never needed them), so Parlay
 * God fetches these separately via `ParlayGodNflOddsService` and the engine
 * takes them as a `game_id`-keyed lookup instead of reading them off the game.
 *
 * Missing entry → [EMPTY]: ML and H1 legs drop out, full-game spread/total legs
 * still price off `fgSpreadClose`/`fgTotalClose` at the book-standard juice.
 */
data class ParlayGodNFLContext(
    val homeMl: Double? = null,
    val awayMl: Double? = null,
    /** Home-relative H1 spread (negative = home favored), matching `h1_spread_close`. */
    val h1SpreadClose: Double? = null,
    val h1SpreadHomePrice: Double? = null,
    val h1SpreadAwayPrice: Double? = null,
    val h1TotalClose: Double? = null,
    val h1TotalOverPrice: Double? = null,
    val h1TotalUnderPrice: Double? = null,
) {
    companion object {
        val EMPTY = ParlayGodNFLContext()
    }
}
