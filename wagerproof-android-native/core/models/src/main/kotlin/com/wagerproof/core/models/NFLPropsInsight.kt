package com.wagerproof.core.models

/** One posted NFL prop signal surfaced on a matchup digest. */
data class NFLPropSignal(
    val playerId: String,
    val playerName: String,
    val teamAbbr: String,
    val position: String?,
    val isHome: Boolean?,
    val opponent: String?,
    val headshotUrl: String?,
    val market: NFLPropMarket,
) {
    val id: String get() = playerId
}

/** Player-props digest for the NFL game-detail widget. */
data class NFLPropsInsightSummary(
    val verdict: InsightVerdict,
    val badge: InsightVerdictBadge?,
    val signals: List<NFLPropSignal>,
    val totalProps: Int,
    val featuredPlayerId: String?,
    val headline: String,
    val explainer: String,
)

object NFLPropsInsight {
    /** Null when the matchup has no usable player markets — the widget hides. */
    fun summary(players: List<NFLPropPlayer>, maxRows: Int = 5): NFLPropsInsightSummary? {
        val pool = players.mapNotNull { signal(it) }
        if (pool.isEmpty()) return null

        val qualified = pool.filter { it.market.l10Hits.n >= InsightThresholds.propSampleMin }
        // Best positive streaks first — never promote a 0/10 just because
        // it's the furthest from 50%.
        val ranked = qualified.sortedWith(
            compareByDescending<NFLPropSignal> { pct(it) }
                .thenByDescending { it.market.l10Hits.n },
        )
        val positive = ranked.filter { pct(it) >= InsightThresholds.leaderFloor }
        val hot = ranked.filter { pct(it) >= InsightThresholds.propHot }
        val signals = (if (positive.isEmpty()) ranked else positive).take(maxRows)

        val featured = signals.firstOrNull()
        val streaks = hot.size
        val badge = if (streaks >= 1) {
            InsightVerdictBadge(
                text = "$streaks STREAK${if (streaks == 1) "" else "S"}",
                tintHex = 0x22C55E,
            )
        } else {
            null
        }

        return NFLPropsInsightSummary(
            verdict = verdict(featured, streaks),
            badge = badge,
            signals = signals,
            totalProps = pool.size,
            featuredPlayerId = featured?.playerId,
            headline = summaryHeadline(featured),
            explainer = "Each percentage is the share of recent games that finished above today's posted line. Green bars finished above it; blue bars finished at or below it.",
        )
    }

    /**
     * Headline market for the digest: strongest L10 among markets that have
     * a posted line (or anytime-TD). Falls back to `bestMarket`.
     */
    fun displayMarket(player: NFLPropPlayer): NFLPropMarket? {
        val usable = player.markets.filter { it.closeLine != null || it.isYesNo }
        val pool = usable.ifEmpty { player.markets }
        return pool.withIndex().maxWithOrNull(
            compareBy<IndexedValue<NFLPropMarket>>(
                { it.value.l10HitRate ?: -1.0 },
                { it.value.l10Hits.n },
                { -it.index },
            ),
        )?.value
    }

    private fun signal(player: NFLPropPlayer): NFLPropSignal? {
        val market = displayMarket(player) ?: return null
        return NFLPropSignal(
            playerId = player.playerId ?: player.playerName,
            playerName = player.playerName,
            teamAbbr = NFLTeams.abbr(player.team.orEmpty()),
            position = player.position,
            isHome = player.isHome,
            opponent = player.opponent,
            headshotUrl = player.headshotUrl,
            market = market,
        )
    }

    private fun pct(signal: NFLPropSignal): Double = (signal.market.l10HitRate ?: 0.0) * 100.0

    private fun distance(signal: NFLPropSignal): Double = kotlin.math.abs(pct(signal) - 50.0)

    private fun lastName(name: String): String = name.split(" ").lastOrNull()?.takeIf { it.isNotEmpty() } ?: name

    private fun verdict(featured: NFLPropSignal?, streaks: Int): InsightVerdict {
        if (featured == null) {
            return InsightVerdict(text = "Posted player props for this matchup", lean = InsightVerdict.Lean.None, strength = 0)
        }
        val (hits, n) = featured.market.l10Hits
        val line = NFLPlayerProps.formatLine(featured.market.closeLine ?: featured.market.clearThreshold)
        val market = NFLPlayerProps.marketAbbr(featured.market.market)
        var text = "${lastName(featured.playerName)} $hits/$n over $line $market"
        if (streaks > 1) {
            val extra = streaks - 1
            text += " · $extra more streak${if (extra == 1) "" else "s"}"
        }
        val lean = if (pct(featured) <= InsightThresholds.propCold) InsightVerdict.Lean.Under else InsightVerdict.Lean.Over
        return InsightVerdict(text = text, lean = lean, strength = InsightThresholds.dots(distance(featured)))
    }

    private fun summaryHeadline(featured: NFLPropSignal?): String {
        if (featured == null) return "Posted player props for this matchup."
        val (hits, n) = featured.market.l10Hits
        val market = NFLPlayerProps.marketLabel(featured.market.market).lowercase()
        if (featured.market.isYesNo) {
            return "${featured.playerName} scored a TD in $hits of $n recent games, the clearest prop pattern in this matchup."
        }
        val line = NFLPlayerProps.formatLine(featured.market.closeLine)
        if (pct(featured) <= InsightThresholds.propCold) {
            return "${featured.playerName} finished over the $line $market line in only $hits of $n recent games, so the recent pattern points to the Under."
        }
        return "${featured.playerName} finished over the $line $market line in $hits of $n recent games, the clearest prop pattern in this matchup."
    }
}
