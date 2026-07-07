package com.wagerproof.app.features.outliers

import androidx.compose.ui.graphics.Color
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.models.MLBF5
import com.wagerproof.core.models.MLBF5Game
import com.wagerproof.core.models.MLBF5SplitRow
import com.wagerproof.core.models.MLBGameTrends
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.stores.MLBF5SplitsStore
import kotlin.math.abs

/**
 * One game that fired one or more outlier signals, plus the payloads its detail
 * page needs. Merged, per-game unit behind the redesigned Outliers hub — every
 * source contributes `OutlierSignal`s keyed by `gamePk`. Built by
 * [OutlierAggregator]. Port of iOS OutlierFeed.swift.
 *
 * Identity is the game key only (the payloads don't participate in equality), so
 * this is a plain class with id-based equals/hashCode, not a data class.
 */
class OutlierFeedItem(
    val id: String,            // "mlb-<gamePk>" — string so other sports slot in later
    val sport: String,         // "mlb" for now
    val gamePk: Int,
    val gameTimeEt: String?,
    val away: Team,
    val home: Team,
    val signals: List<OutlierSignal>,
    // Detail-page payloads (one per signal source that fired).
    val trends: MLBGameTrends?,
    val f5: MLBF5Game?,
    /** Just this game's two F5 split rows, keyed the way the F5 card looks them up. */
    val f5Lookup: Map<String, MLBF5SplitRow>,
    /** Combined severity used to rank the merged list. */
    val severity: Double,
) {
    data class Team(
        val name: String,
        val abbr: String,
        val logoURL: String?,
        val primary: Color,
        val secondary: Color,
    )

    override fun equals(other: Any?): Boolean = other is OutlierFeedItem && other.id == id
    override fun hashCode(): Int = id.hashCode()
}

/**
 * A single reason a game was flagged. `badge` shows on the list tile; `headline`
 * explains it on the detail page.
 */
data class OutlierSignal(
    val kind: Kind,
    val badge: String,
    val tintHex: Long,
    val headline: String,
    val severity: Double,
) {
    enum class Kind { value, fade, trends, f5, accuracy, pitcher }

    val tint: Color get() = hexColor(tintHex)
}

/**
 * Merges per-sport outlier sources into a single ranked, per-game feed. Phase 1
 * wires MLB Betting Trends + MLB F5 Splits. Swift's `@MainActor` isolation
 * becomes plain functions here — the F5 store is passed in.
 */
object OutlierAggregator {
    fun build(
        trends: List<MLBGameTrends>,
        f5Games: List<MLBF5Game>,
        f5Store: MLBF5SplitsStore,
    ): List<OutlierFeedItem> {
        // Bucket both sources by game key.
        data class Bucket(var trends: MLBGameTrends? = null, var f5: MLBF5Game? = null)
        val buckets = LinkedHashMap<Int, Bucket>()
        for (t in trends) buckets.getOrPut(t.gamePk) { Bucket() }.trends = t
        for (f in f5Games) buckets.getOrPut(f.gamePk) { Bucket() }.f5 = f

        val items = mutableListOf<OutlierFeedItem>()
        for ((pk, pair) in buckets) {
            val signals = mutableListOf<OutlierSignal>()
            var severity = 0.0

            pair.trends?.let { t -> trendsSignal(t)?.let { signals += it; severity += it.severity } }
            pair.f5?.let { f -> f5Signal(f, f5Store)?.let { signals += it; severity += it.severity } }
            if (signals.isEmpty()) continue

            val (away, home, timeEt) = resolveTeams(pair.trends, pair.f5)

            // Carry just this game's two F5 split rows under the keys the F5 card
            // recomputes, so the widget renders standalone.
            val f5Lookup = mutableMapOf<String, MLBF5SplitRow>()
            pair.f5?.let { f ->
                f5Store.split(f, "away")?.let { row ->
                    MLBF5.splitLookupKey(f.awayAbbr, "away", f.homeSpHand)?.let { key -> f5Lookup[key] = row }
                }
                f5Store.split(f, "home")?.let { row ->
                    MLBF5.splitLookupKey(f.homeAbbr, "home", f.awaySpHand)?.let { key -> f5Lookup[key] = row }
                }
            }

            items += OutlierFeedItem(
                id = "mlb-$pk",
                sport = "mlb",
                gamePk = pk,
                gameTimeEt = timeEt,
                away = away,
                home = home,
                signals = signals.sortedByDescending { it.severity },
                trends = pair.trends,
                f5 = pair.f5,
                f5Lookup = f5Lookup,
                severity = severity,
            )
        }
        return items.sortedByDescending { it.severity }
    }

    // MARK: - Per-source signal extraction

    /**
     * Flags a game when its situational splits line up — a strong moneyline edge
     * across spots, or both teams' over/under splits leaning the same way.
     */
    private fun trendsSignal(t: MLBGameTrends): OutlierSignal? {
        val ou = t.ouConsensusScore
        val ml = t.mlDominanceScore
        // Moderate gate: surface games with a real lean, not every matchup.
        if (!(ou >= 50 || ml >= 10)) return null
        val leansOU = ou * 0.25 >= ml
        val headline = if (leansOU) {
            "Both sides' situational over/under splits lean the same direction on the total."
        } else {
            "A consistent moneyline edge shows up across this game's situational splits."
        }
        return OutlierSignal(
            kind = OutlierSignal.Kind.trends,
            badge = "TRENDS",
            tintHex = 0x0EA5E9L,
            headline = headline,
            severity = ou * 0.25 + ml,
        )
    }

    /**
     * Flags a game when first-five run production diverges from the posted F5
     * line, judged off each team's home/away splits vs the opposing starter.
     */
    private fun f5Signal(f: MLBF5Game, store: MLBF5SplitsStore): OutlierSignal? {
        val away = store.split(f, "away")
        val home = store.split(f, "home")
        if (!(MLBF5.isShowable(away?.games) || MLBF5.isShowable(home?.games))) return null
        val magnitudes = listOfNotNull(away?.f5LineEdge, home?.f5LineEdge, away?.rsDiffVsSeason, home?.rsDiffVsSeason)
            .map { abs(it) }
        val peak = magnitudes.maxOrNull() ?: 0.0
        if (peak <= 0) return null
        return OutlierSignal(
            kind = OutlierSignal.Kind.f5,
            badge = "F5",
            tintHex = 0xF97316L,
            headline = "First-five run production is running off its season line for this matchup.",
            severity = peak * 10,
        )
    }

    // MARK: - Team resolution

    private fun resolveTeams(
        trends: MLBGameTrends?,
        f5: MLBF5Game?,
    ): Triple<OutlierFeedItem.Team, OutlierFeedItem.Team, String?> {
        if (f5 != null) {
            return Triple(
                team(f5.awayTeamName, f5.awayAbbr, null),
                team(f5.homeTeamName, f5.homeAbbr, null),
                f5.gameTimeEt ?: trends?.gameTimeEt,
            )
        }
        val t = trends!!
        return Triple(
            team(t.awayTeam.teamName, null, t.awayTeam.teamId),
            team(t.homeTeam.teamName, null, t.homeTeam.teamId),
            t.gameTimeEt,
        )
    }

    /**
     * Resolve a team's logo/abbr/colors from the shared `MLBTeams` table, using
     * whichever identifier the source carries (name, abbr, or team id).
     */
    private fun team(name: String, abbr: String?, id: Int?): OutlierFeedItem.Team {
        val info = MLBTeams.info(name)
        val byId = id?.let { MLBTeams.displayById(it) }
        val logo = info?.logoUrl ?: byId?.logoUrl
        val resolvedAbbr = abbr ?: info?.team ?: byId?.abbrev ?: name.take(3).uppercase()
        val c = MLBTeams.colors(name)
        return OutlierFeedItem.Team(
            name = name,
            abbr = resolvedAbbr,
            logoURL = logo,
            primary = hexColor(c.primary),
            secondary = hexColor(c.secondary),
        )
    }
}
