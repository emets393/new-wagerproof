package com.wagerproof.core.models

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// MARK: - Trends signal payload

/**
 * One ranked situational signal for the matchup-insight trends widget.
 * Produced by the per-sport `*TrendsInsight.summary` adapters below; the
 * widget renders the first 3 signals as insight rows.
 */
data class TrendsSignal(
    val id: String,               // "{situationKey}-{metric}"
    val situationTitle: String,   // via formatMLBSituation / formatNBASituation
    val metricLabel: String,      // "Win%" | "Over%" | "ATS" | "O/U"
    val kind: Kind,
    val awayPct: Double?,
    val homePct: Double?,
    val awayDetail: String?,      // record strings NBA/NCAAB, null MLB
    val homeDetail: String?,
    val strength: Double,
) {
    sealed class Kind {
        data class Side(val leader: MatchupSide, val abbr: String, val gap: Double) : Kind()
        data class Over(val floor: Double) : Kind()
        data class Under(val ceiling: Double) : Kind()
    }
}

data class TrendsInsightSummary(
    val verdicts: List<InsightVerdict>,   // 1-2
    val badge: InsightVerdictBadge,
    val signals: List<TrendsSignal>,      // ALL fired, sorted desc; widget takes first 3
    val eligibleSidePairs: Int,
    val totalSituations: Int,             // 7 MLB, 5 NBA/NCAAB
)

// MARK: - Shared engine

/**
 * Sport-agnostic signal/verdict math. Each sport builds [Pair] inputs from
 * its trend rows; the engine owns every threshold so MLB/NBA/NCAAB cannot
 * drift (see InsightThresholds in MatchupInsightCore.kt).
 */
private object TrendsInsightEngine {
    data class Pair(
        val key: String,
        val sideMetricLabel: String,
        val ouMetricLabel: String,
        val awayLabel: String,        // formatted situation labels
        val homeLabel: String,
        val awayTag: String?,         // raw situation tags (teaser phrasing)
        val homeTag: String?,
        val awaySidePct: Double?,
        val homeSidePct: Double?,
        val awaySideDetail: String?,
        val homeSideDetail: String?,
        val sideMinGames: Int?,       // min(away, home) sample; null = no gate (MLB)
        val awayOuPct: Double?,
        val homeOuPct: Double?,
        val awayOuDetail: String?,
        val homeOuDetail: String?,
        val ouMinGames: Int?,
    ) {
        val sideSampleOK: Boolean
            get() = sideMinGames?.let { it >= InsightThresholds.minGamesBasketball } ?: true
        val ouSampleOK: Boolean
            get() = ouMinGames?.let { it >= InsightThresholds.minGamesBasketball } ?: true
    }

    /**
     * Raw situation tags carried alongside each fired signal so the MLB
     * teaser can phrase headlines without re-deriving the pair.
     */
    data class Meta(
        val awayTag: String?,
        val homeTag: String?,
        val leaderTag: String?,
    )

    // Swift tuple (signal, meta) → small data class per porting conventions.
    data class SignalMeta(val signal: TrendsSignal, val meta: Meta)

    data class Output(
        val summary: TrendsInsightSummary,
        val metas: List<SignalMeta>,   // same order as summary.signals
    )

    fun compute(pairs: List<Pair>, awayAbbr: String, homeAbbr: String, basketball: Boolean): Output {
        val fired = mutableListOf<SignalMeta>()
        var eligibleSidePairs = 0
        var awayLead = 0
        var homeLead = 0
        var awayMaxGap = 0.0
        var homeMaxGap = 0.0

        for (pair in pairs) {
            // Side signal (Win% MLB / ATS cover% NBA·NCAAB).
            val aSide = pair.awaySidePct
            val hSide = pair.homeSidePct
            if (aSide != null && hSide != null && pair.sideSampleOK) {
                eligibleSidePairs += 1
                val gap = aSide - hSide
                if (abs(gap) >= InsightThresholds.sideGap) {
                    // Leads count on gap alone; the signal additionally needs
                    // the leader at/above the 55% floor to actually fire.
                    if (gap > 0) {
                        awayLead += 1
                        awayMaxGap = max(awayMaxGap, gap)
                    } else {
                        homeLead += 1
                        homeMaxGap = max(homeMaxGap, -gap)
                    }
                    val leaderIsAway = gap > 0
                    if (max(aSide, hSide) >= InsightThresholds.leaderFloor) {
                        val abbr = if (leaderIsAway) awayAbbr else homeAbbr
                        fired += SignalMeta(
                            TrendsSignal(
                                id = "${pair.key}-side",
                                situationTitle = if (leaderIsAway) pair.awayLabel else pair.homeLabel,
                                metricLabel = pair.sideMetricLabel,
                                kind = TrendsSignal.Kind.Side(
                                    leader = if (leaderIsAway) MatchupSide.AWAY else MatchupSide.HOME,
                                    abbr = abbr,
                                    gap = abs(gap),
                                ),
                                awayPct = aSide,
                                homePct = hSide,
                                awayDetail = pair.awaySideDetail,
                                homeDetail = pair.homeSideDetail,
                                strength = abs(gap),
                            ),
                            Meta(
                                awayTag = pair.awayTag,
                                homeTag = pair.homeTag,
                                leaderTag = if (leaderIsAway) pair.awayTag else pair.homeTag,
                            ),
                        )
                    }
                }
            }

            // O/U signal — consensus over rate on both sides.
            val aOu = pair.awayOuPct
            val hOu = pair.homeOuPct
            if (aOu != null && hOu != null && pair.ouSampleOK) {
                val title = ouTitle(pair)
                val meta = Meta(awayTag = pair.awayTag, homeTag = pair.homeTag, leaderTag = null)
                if (aOu >= InsightThresholds.ouHigh && hOu >= InsightThresholds.ouHigh) {
                    fired += SignalMeta(
                        TrendsSignal(
                            id = "${pair.key}-ou",
                            situationTitle = title,
                            metricLabel = pair.ouMetricLabel,
                            kind = TrendsSignal.Kind.Over(floor = min(aOu, hOu)),
                            awayPct = aOu,
                            homePct = hOu,
                            awayDetail = pair.awayOuDetail,
                            homeDetail = pair.homeOuDetail,
                            strength = (min(aOu, hOu) - 50) * 2,
                        ),
                        meta,
                    )
                } else if (aOu <= InsightThresholds.ouLow && hOu <= InsightThresholds.ouLow) {
                    fired += SignalMeta(
                        TrendsSignal(
                            id = "${pair.key}-ou",
                            situationTitle = title,
                            metricLabel = pair.ouMetricLabel,
                            kind = TrendsSignal.Kind.Under(ceiling = max(aOu, hOu)),
                            awayPct = aOu,
                            homePct = hOu,
                            awayDetail = pair.awayOuDetail,
                            homeDetail = pair.homeOuDetail,
                            strength = (50 - max(aOu, hOu)) * 2,
                        ),
                        meta,
                    )
                }
            }
        }

        // Rank by strength desc; sortedByDescending is stable so ties keep RN pair order.
        val ranked = fired.sortedByDescending { it.signal.strength }

        val verdicts = mutableListOf<InsightVerdict>()

        // Side verdict — always present so the verdict line is never blank.
        val edgeNoun = if (basketball) "ATS edge" else "edge"
        val maxLead = max(awayLead, homeLead)
        if (maxLead >= 1) {
            val awayWins = awayLead > homeLead || (awayLead == homeLead && awayMaxGap >= homeMaxGap)
            val abbr = if (awayWins) awayAbbr else homeAbbr
            val text = if (maxLead >= 2) {
                "$abbr $edgeNoun in $maxLead of $eligibleSidePairs angles"
            } else {
                "$abbr $edgeNoun in 1 angle"
            }
            verdicts += InsightVerdict(
                text = text,
                lean = InsightVerdict.Lean.Team(abbr, if (awayWins) MatchupSide.AWAY else MatchupSide.HOME),
                strength = InsightThresholds.dots(if (awayWins) awayMaxGap else homeMaxGap),
            )
        } else {
            verdicts += InsightVerdict(
                text = if (basketball) "No ATS edge" else "No side edge",
                lean = InsightVerdict.Lean.None,
                strength = 0,
            )
        }

        // O/U verdict from fired consensus counts; omitted when mixed/empty.
        val overs = ranked.filter { it.signal.kind is TrendsSignal.Kind.Over }
        val unders = ranked.filter { it.signal.kind is TrendsSignal.Kind.Under }
        val o = overs.size
        val u = unders.size
        if (o > u && o >= 2) {
            verdicts += InsightVerdict(
                text = "OVER leans $o–$u",
                lean = InsightVerdict.Lean.Over,
                strength = InsightThresholds.dots(overs.firstOrNull()?.signal?.strength ?: 0.0),
            )
        } else if (u > o && u >= 2) {
            verdicts += InsightVerdict(
                text = "UNDER leans $u–$o",
                lean = InsightVerdict.Lean.Under,
                strength = InsightThresholds.dots(unders.firstOrNull()?.signal?.strength ?: 0.0),
            )
        } else if (o + u == 1) {
            val only = overs.firstOrNull() ?: unders.firstOrNull()
            if (only != null) {
                verdicts += InsightVerdict(
                    text = "${if (o == 1) "OVER" else "UNDER"} lean (${only.signal.situationTitle})",
                    lean = if (o == 1) InsightVerdict.Lean.Over else InsightVerdict.Lean.Under,
                    strength = InsightThresholds.dots(only.signal.strength),
                )
            }
        }

        val badge = if (ranked.isEmpty()) {
            InsightVerdictBadge("NO EDGE", 0x9CA3AFL)
        } else {
            InsightVerdictBadge("${ranked.size} SIGNAL${if (ranked.size == 1) "" else "S"}", 0x22C55EL)
        }

        return Output(
            summary = TrendsInsightSummary(
                verdicts = verdicts,
                badge = badge,
                signals = ranked.map { it.signal },
                eligibleSidePairs = eligibleSidePairs,
                totalSituations = pairs.size,
            ),
            metas = ranked,
        )
    }

    /**
     * O/U signals belong to both teams — when the two sides sit in different
     * situations (away "After Win" / home "After Loss") show both labels.
     */
    private fun ouTitle(pair: Pair): String =
        if (pair.awayLabel == pair.homeLabel) pair.awayLabel else "${pair.awayLabel} / ${pair.homeLabel}"
}

// MARK: - MLB

private class MLBTrendConfig(
    val key: String,
    val tag: (MLBSituationalTrendRow) -> String?,
    val win: (MLBSituationalTrendRow) -> Double?,
    val over: (MLBSituationalTrendRow) -> Double?,
)

object MLBTrendsInsight {
    fun summary(game: MLBGameTrends): TrendsInsightSummary = compute(game).summary

    /**
     * Search-chip teaser. Signals where the matched team leads weigh +5;
     * below strength 10 the chip stays neutral (`headline = null`).
     */
    fun teaser(game: MLBGameTrends, matchedAbbr: String?): InsightTeaser {
        val output = compute(game)
        val awayAbbr = abbr(game.awayTeam)
        val homeAbbr = abbr(game.homeTeam)

        var best: Triple<TrendsSignal, TrendsInsightEngine.Meta, Double>? = null
        for (entry in output.metas) {
            var weighted = entry.signal.strength
            if (matchedAbbr != null) {
                when (val kind = entry.signal.kind) {
                    is TrendsSignal.Kind.Side ->
                        if (matches(matchedAbbr, kind.abbr)) weighted += 5
                    is TrendsSignal.Kind.Over, is TrendsSignal.Kind.Under ->
                        // O/U consensus involves both teams' cells.
                        if (matches(matchedAbbr, awayAbbr) || matches(matchedAbbr, homeAbbr)) weighted += 5
                }
            }
            val current = best
            if (current == null || weighted > current.third) {
                best = Triple(entry.signal, entry.meta, weighted)
            }
        }

        val top = best
        if (top == null || top.third < 10) {
            return InsightTeaser(
                kind = InsightTeaser.Kind.TRENDS,
                headline = null,
                signal = InsightTeaser.Signal.NEUTRAL,
                smallSample = false,
            )
        }

        // MLB trend views are percent-only — no sample counts to warn on.
        return when (val kind = top.first.kind) {
            is TrendsSignal.Kind.Side -> {
                val pct = (if (kind.leader == MatchupSide.AWAY) top.first.awayPct else top.first.homePct) ?: 0.0
                val headline = trimmed("${kind.abbr} wins ${pct.roundToInt()}% ${phrase(top.second.leaderTag)}")
                val signal = when {
                    matchedAbbr == null -> InsightTeaser.Signal.NEUTRAL
                    matches(matchedAbbr, kind.abbr) -> InsightTeaser.Signal.POSITIVE
                    else -> InsightTeaser.Signal.NEGATIVE
                }
                InsightTeaser(
                    kind = InsightTeaser.Kind.TRENDS,
                    headline = headline,
                    signal = signal,
                    smallSample = false,
                )
            }
            is TrendsSignal.Kind.Over -> {
                val mean = (((top.first.awayPct ?: 0.0) + (top.first.homePct ?: 0.0)) / 2).roundToInt()
                val tag = teaserTag(top.second, matchedAbbr, homeAbbr)
                InsightTeaser(
                    kind = InsightTeaser.Kind.TRENDS,
                    headline = trimmed("Overs hit $mean% ${phrase(tag)}"),
                    signal = InsightTeaser.Signal.POSITIVE,
                    smallSample = false,
                )
            }
            is TrendsSignal.Kind.Under -> {
                val mean = ((top.first.awayPct ?: 0.0) + (top.first.homePct ?: 0.0)) / 2
                val tag = teaserTag(top.second, matchedAbbr, homeAbbr)
                InsightTeaser(
                    kind = InsightTeaser.Kind.TRENDS,
                    headline = trimmed("Unders hit ${(100 - mean).roundToInt()}% ${phrase(tag)}"),
                    signal = InsightTeaser.Signal.NEGATIVE,
                    smallSample = false,
                )
            }
        }
    }

    private fun compute(game: MLBGameTrends): TrendsInsightEngine.Output =
        TrendsInsightEngine.compute(
            pairs = pairs(game),
            awayAbbr = abbr(game.awayTeam),
            homeAbbr = abbr(game.homeTeam),
            basketball = false,
        )

    private fun pairs(game: MLBGameTrends): List<TrendsInsightEngine.Pair> {
        val a = game.awayTeam
        val h = game.homeTeam
        // RN order, matching MLBTrendsMatrixAdapter's 7 sections.
        val configs = listOf(
            MLBTrendConfig("lastGame", { it.lastGameSituation }, { it.winPctLastGame }, { it.overPctLastGame }),
            MLBTrendConfig("homeAway", { it.homeAwaySituation }, { it.winPctHomeAway }, { it.overPctHomeAway }),
            MLBTrendConfig("favDog", { it.favDogSituation }, { it.winPctFavDog }, { it.overPctFavDog }),
            MLBTrendConfig("restBucket", { it.restBucket }, { it.winPctRestBucket }, { it.overPctRestBucket }),
            MLBTrendConfig("restComp", { it.restComp }, { it.winPctRestComp }, { it.overPctRestComp }),
            MLBTrendConfig("league", { it.leagueSituation }, { it.winPctLeague }, { it.overPctLeague }),
            MLBTrendConfig("division", { it.divisionSituation }, { it.winPctDivision }, { it.overPctDivision }),
        )
        return configs.map { config ->
            TrendsInsightEngine.Pair(
                key = config.key,
                sideMetricLabel = "Win%",
                ouMetricLabel = "Over%",
                awayLabel = formatMLBSituation(config.tag(a)),
                homeLabel = formatMLBSituation(config.tag(h)),
                awayTag = config.tag(a),
                homeTag = config.tag(h),
                awaySidePct = normalizePct(config.win(a)),
                homeSidePct = normalizePct(config.win(h)),
                awaySideDetail = null,
                homeSideDetail = null,
                sideMinGames = null,      // MLB views are percent-only — no sample gate
                awayOuPct = normalizePct(config.over(a)),
                homeOuPct = normalizePct(config.over(h)),
                awayOuDetail = null,
                homeOuDetail = null,
                ouMinGames = null,
            )
        }
    }

    private fun abbr(row: MLBSituationalTrendRow): String =
        MLBTeams.displayById(row.teamId)?.abbrev
            ?: row.teamName.take(3).uppercase()

    /** RN `toTrendPct` — some rows come back fractional (0..1); rescale before math. */
    private fun normalizePct(value: Double?): Double? {
        if (value == null) return null
        return if (value > 0 && value < 1) value * 100 else value
    }

    private fun matches(lhs: String, rhs: String): Boolean =
        lhs.equals(rhs, ignoreCase = true)

    /** O/U teasers phrase from the matched team's own situation when known. */
    private fun teaserTag(meta: TrendsInsightEngine.Meta, matchedAbbr: String?, homeAbbr: String): String? {
        if (matchedAbbr != null && matches(matchedAbbr, homeAbbr)) return meta.homeTag
        return meta.awayTag
    }

    /** Situation tag → teaser phrase ("NYY wins 71% after a loss"). */
    private fun phrase(tag: String?): String {
        if (tag.isNullOrEmpty()) return ""
        val map = mapOf(
            "is_after_loss" to "after a loss",
            "is_after_win" to "after a win",
            "is_fav" to "as a favorite",
            "is_dog" to "as an underdog",
            "is_home_fav" to "as a home favorite",
            "is_away_fav" to "as an away favorite",
            "is_home_dog" to "as a home dog",
            "is_away_dog" to "as an away dog",
            "is_home" to "at home",
            "is_away" to "on the road",
            "one_day_off" to "on 1 day off",
            "two_three_days_off" to "on 2-3 days off",
            "four_plus_days_off" to "on 4+ days off",
            "rest_advantage" to "with a rest edge",
            "rest_disadvantage" to "on short rest",
            "rest_equal" to "on equal rest",
            "equal_rest" to "on equal rest",
            "no_rest" to "on no rest",
            "league" to "in league play",
            "non_league" to "in interleague play",
            "division" to "in the division",
            "non_division" to "outside the division",
        )
        return map[tag] ?: formatMLBSituation(tag).lowercase()
    }

    private fun trimmed(text: String): String = text.trim()
}

// MARK: - NBA

private class NBATrendConfig(
    val key: String,
    val tag: (NBASituationalTrendRow) -> String?,
    val atsRecord: (NBASituationalTrendRow) -> String?,
    val atsPct: (NBASituationalTrendRow) -> Double?,
    val ouRecord: (NBASituationalTrendRow) -> String?,
    val ouOver: (NBASituationalTrendRow) -> Double?,
)

object NBATrendsInsight {
    fun summary(game: NBAGameTrendsData): TrendsInsightSummary =
        TrendsInsightEngine.compute(
            pairs = pairs(game),
            awayAbbr = game.awayTeam.teamAbbr,
            homeAbbr = game.homeTeam.teamAbbr,
            basketball = true,
        ).summary

    private fun pairs(game: NBAGameTrendsData): List<TrendsInsightEngine.Pair> {
        val a = game.awayTeam
        val h = game.homeTeam
        // The 5 RN pairs the today view renders (no home/away columns).
        val configs = listOf(
            NBATrendConfig(
                "lastGame", { it.lastGameSituation }, { it.atsLastGameRecord }, { it.atsLastGameCoverPct },
                { it.ouLastGameRecord }, { it.ouLastGameOverPct },
            ),
            NBATrendConfig(
                "favDog", { it.favDogSituation }, { it.atsFavDogRecord }, { it.atsFavDogCoverPct },
                { it.ouFavDogRecord }, { it.ouFavDogOverPct },
            ),
            NBATrendConfig(
                "sideFavDog", { it.sideSpreadSituation }, { it.atsSideFavDogRecord }, { it.atsSideFavDogCoverPct },
                { it.ouSideFavDogRecord }, { it.ouSideFavDogOverPct },
            ),
            NBATrendConfig(
                "restBucket", { it.restBucket }, { it.atsRestBucketRecord }, { it.atsRestBucketCoverPct },
                { it.ouRestBucketRecord }, { it.ouRestBucketOverPct },
            ),
            NBATrendConfig(
                "restComp", { it.restComp }, { it.atsRestCompRecord }, { it.atsRestCompCoverPct },
                { it.ouRestCompRecord }, { it.ouRestCompOverPct },
            ),
        )
        return configs.map { config ->
            val awayATSRecord = config.atsRecord(a)
            val homeATSRecord = config.atsRecord(h)
            val awayOURecord = config.ouRecord(a)
            val homeOURecord = config.ouRecord(h)
            TrendsInsightEngine.Pair(
                key = config.key,
                sideMetricLabel = "ATS",
                ouMetricLabel = "O/U",
                awayLabel = formatNBASituation(config.tag(a)),
                homeLabel = formatNBASituation(config.tag(h)),
                awayTag = config.tag(a),
                homeTag = config.tag(h),
                awaySidePct = config.atsPct(a),
                homeSidePct = config.atsPct(h),
                awaySideDetail = awayATSRecord,
                homeSideDetail = homeATSRecord,
                sideMinGames = min(parseNBARecord(awayATSRecord).total, parseNBARecord(homeATSRecord).total),
                awayOuPct = config.ouOver(a),
                homeOuPct = config.ouOver(h),
                awayOuDetail = awayOURecord,
                homeOuDetail = homeOURecord,
                ouMinGames = min(parseNBARecord(awayOURecord).total, parseNBARecord(homeOURecord).total),
            )
        }
    }
}

// MARK: - NCAAB

private class NCAABTrendConfig(
    val key: String,
    val tag: (NCAABSituationalTrendRow) -> String?,
    val atsRecord: (NCAABSituationalTrendRow) -> String?,
    val atsPct: (NCAABSituationalTrendRow) -> Double?,
    val ouRecord: (NCAABSituationalTrendRow) -> String?,
    val ouOver: (NCAABSituationalTrendRow) -> Double?,
)

object NCAABTrendsInsight {
    fun summary(game: NCAABGameTrendsData): TrendsInsightSummary =
        TrendsInsightEngine.compute(
            pairs = pairs(game),
            awayAbbr = game.awayTeam.teamAbbr,
            homeAbbr = game.homeTeam.teamAbbr,
            basketball = true,
        ).summary

    private fun pairs(game: NCAABGameTrendsData): List<TrendsInsightEngine.Pair> {
        val a = game.awayTeam
        val h = game.homeTeam
        val configs = listOf(
            NCAABTrendConfig(
                "lastGame", { it.lastGameSituation }, { it.atsLastGameRecord }, { it.atsLastGameCoverPct },
                { it.ouLastGameRecord }, { it.ouLastGameOverPct },
            ),
            NCAABTrendConfig(
                "favDog", { it.favDogSituation }, { it.atsFavDogRecord }, { it.atsFavDogCoverPct },
                { it.ouFavDogRecord }, { it.ouFavDogOverPct },
            ),
            NCAABTrendConfig(
                "sideFavDog", { it.sideSpreadSituation }, { it.atsSideFavDogRecord }, { it.atsSideFavDogCoverPct },
                { it.ouSideFavDogRecord }, { it.ouSideFavDogOverPct },
            ),
            NCAABTrendConfig(
                "restBucket", { it.restBucket }, { it.atsRestBucketRecord }, { it.atsRestBucketCoverPct },
                { it.ouRestBucketRecord }, { it.ouRestBucketOverPct },
            ),
            NCAABTrendConfig(
                "restComp", { it.restComp }, { it.atsRestCompRecord }, { it.atsRestCompCoverPct },
                { it.ouRestCompRecord }, { it.ouRestCompOverPct },
            ),
        )
        return configs.map { config ->
            val awayATSRecord = config.atsRecord(a)
            val homeATSRecord = config.atsRecord(h)
            val awayOURecord = config.ouRecord(a)
            val homeOURecord = config.ouRecord(h)
            TrendsInsightEngine.Pair(
                key = config.key,
                sideMetricLabel = "ATS",
                ouMetricLabel = "O/U",
                awayLabel = formatNCAABSituation(config.tag(a)),
                homeLabel = formatNCAABSituation(config.tag(h)),
                awayTag = config.tag(a),
                homeTag = config.tag(h),
                awaySidePct = config.atsPct(a),
                homeSidePct = config.atsPct(h),
                awaySideDetail = awayATSRecord,
                homeSideDetail = homeATSRecord,
                sideMinGames = min(parseNCAABRecord(awayATSRecord).total, parseNCAABRecord(homeATSRecord).total),
                awayOuPct = config.ouOver(a),
                homeOuPct = config.ouOver(h),
                awayOuDetail = awayOURecord,
                homeOuDetail = homeOURecord,
                ouMinGames = min(parseNCAABRecord(awayOURecord).total, parseNCAABRecord(homeOURecord).total),
            )
        }
    }
}
