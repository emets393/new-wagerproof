package com.wagerproof.core.models

import kotlinx.serialization.json.Json
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Decode + resolution tests for the NFL player-analysis contract, mirroring
 * the iOS `NFLPropPlayerPageTests` fixtures. The jsonb columns are
 * generator-produced and have drifted before — a mis-decode must degrade to
 * a missing widget, never a failed row.
 */
class NFLPropPlayerPageTest {

    private val json = Json { ignoreUnknownKeys = true }

    private fun decodePage(raw: String): NFLPropPlayerPage =
        json.decodeFromString<NFLPropPlayerPageRow>(raw).toPage()

    private fun decodeTrends(raw: String): NFLPropTrendsDetail =
        json.decodeFromString<NFLPropTrendsDetailRow>(raw).toDetail()

    @Test
    fun decodesFullPageRow() {
        val page = decodePage(
            """
            {
              "player_id": "00-0036322", "season": 2026, "week": 1,
              "player_name": "Justin Jefferson", "position": "WR", "team": "MIN", "opponent": "CHI",
              "is_home": true, "game_label": "CHI @ MIN", "kickoff": "2026-09-13T17:00:00Z",
              "headshot_url": "https://example.com/jj.png", "rookie": false,
              "markets": [
                {"key": "player_anytime_td", "label": "Anytime TD", "line": null, "over_price": 145, "under_price": null, "status": "posted"},
                {"key": "player_reception_yds", "label": "Receiving Yards", "line": 84.5, "over_price": -112, "under_price": -108, "status": "posted", "signals": [{"key": "P12", "label": "Featured WR", "direction": "OVER", "record": "18-10 · 64%"}]},
                {"key": "player_receptions", "label": "Receptions", "line": null, "over_price": null, "under_price": null, "status": "pending"}
              ],
              "projection": {
                "player_reception_yds": {"kind": "point", "value": 91.3, "status": "live", "source": "model"},
                "player_anytime_td": {"kind": "rate", "score_rate": 0.42, "n": 16, "status": "live", "source": "2025 games"}
              },
              "scheme": {
                "opponent": "CHI", "kind": "receiving",
                "defense": {"identity": "zone-heavy, two-high", "man": {"rate": 0.24, "pctile": 18}, "two_high": {"rate": 0.61, "pctile": 88}, "pressure": {"rate": 0.31, "pctile": 44}},
                "player_overall": {"ypt": 9.4, "targets": 612, "pctile": 97, "sample": "ok"},
                "player_splits": {
                  "zone": {"ypt": 9.9, "targets": 300, "pctile": 96, "delta_ypt": 0.5, "sample": "ok"},
                  "man": {"ypt": 8.1, "targets": 0}
                },
                "look_focus": ["zone", "two_high"],
                "look_hit_rates": {"zone_heavy": {"player_reception_yds": {"h": 5, "n": 7, "pct": 0.71}}}
              },
              "scheme_game_splits": {
                "overall": {"n": 16, "rec_yds": 96.1, "receptions": 7.1},
                "splits": {
                  "zone_heavy": {"n": 6, "rec_yds": 104.2, "delta": {"rec_yds": 8.1}},
                  "two_high_heavy": {"n": 2, "insufficient": true, "rec_yds": 60.0}
                },
                "applicable": ["zone_heavy", "two_high_heavy"], "window": "2024-2025"
              }
            }
            """.trimIndent(),
        )

        assertEquals(3, page.markets.size)
        assertNull(page.markets[0].line)
        assertTrue(page.markets[0].isPosted)
        assertEquals(84.5, page.markets[1].line)
        assertEquals(1, page.markets[1].signals.size)
        assertEquals("P12", page.markets[1].signals.first().key)
        assertEquals("18-10 · 64%", page.markets[1].signals.first().record)
        assertEquals(listOf("P12"), page.markets[1].flagKeys)
        assertTrue(page.markets[0].signals.isEmpty())
        assertEquals(false, page.markets[2].isPosted)

        // Generator writes status "live" + source "model"; must read as model.
        assertEquals(true, page.projection["player_reception_yds"]?.isModel)
        assertEquals(false, page.projection["player_anytime_td"]?.isModel)
        assertEquals(91.3, (page.projection["player_reception_yds"] as NFLPropProjection.Point).value)

        assertEquals("zone-heavy, two-high", page.scheme?.defense?.identity)
        assertEquals(0.24, page.scheme?.defense?.dims?.get("man")?.rate)
        assertEquals(0.5, page.scheme?.playerSplits?.get("zone")?.deltaYpt)
        assertEquals(listOf("zone", "two_high"), page.scheme?.lookFocus)
        assertEquals(5, page.scheme?.lookHitRates?.get("zone_heavy")?.get("player_reception_yds")?.h)
        assertEquals(8.1, page.schemeGameSplits?.splits?.get("zone_heavy")?.delta?.get("rec_yds"))

        // Scheme compare: two_high focus has no split → only zone survives.
        val resolved = NFLPropSchemeCompare.resolve(page, "player_reception_yds")!!
        assertEquals(NFLSchemeCompareMode.RECEIVING, resolved.mode)
        assertEquals(9.4, resolved.overallValue)
        assertEquals(listOf("zone"), resolved.lookRows.map { it.key })
        assertEquals(0.35, resolved.lookRows[0].deltaThreshold)
        assertTrue(resolved.hasCompare)

        // Defense tiles: zone synthesized as the complement of the man rate.
        val tiles = NFLPropSchemeCompare.defenseTiles(page, NFLSchemeCompareMode.RECEIVING)
        assertEquals("zone", tiles.first().key)
        assertTrue(abs(tiles.first().rate - 0.76) < 0.0001)
        assertTrue(abs(tiles.first().pctile - 82.0) < 0.0001)

        // Game split: insufficient bucket skipped; pass TDs has no stat key.
        val split = NFLPropSchemeCompare.gameSplit(page, "player_reception_yds")!!
        assertEquals(104.2, split.entry.stats["rec_yds"])
        assertEquals(listOf("zone-heavy"), split.bucketLabels)
        assertNull(NFLPropSchemeCompare.gameSplit(page, "player_pass_tds"))
    }

    /** The historical generator drift: a dict where `markets` expects an array. */
    @Test
    fun malformedMarketsDegradeToEmpty() {
        val page = decodePage(
            """
            {"player_id": "x", "season": 2026, "week": 1, "player_name": "Drift",
             "markets": {"player_receptions": {"line": 4.5}}, "projection": null,
             "scheme": {"opponent": "DEN"}}
            """.trimIndent(),
        )
        assertTrue(page.markets.isEmpty())
        assertTrue(page.projection.isEmpty())
        assertEquals("DEN", page.scheme?.opponent)
        assertNull(page.scheme?.defense)
        assertNull(page.schemeGameSplits)
    }

    @Test
    fun decodesTrendsAndEnriches() {
        val trends = decodeTrends(
            """
            {"player_id": "00-0036322",
             "recent_game_log": [
               {"season": 2025, "week": 18, "opp": "GB", "is_home": true, "markets": {"player_reception_yds": "O"}, "lines": {"player_reception_yds": 79.5}},
               {"season": 2025, "week": 17, "opp": "DET", "is_primetime": true}
             ],
             "matchups": {"CHI": {"meetings": 8, "player_reception_yds": {"h": 6, "n": 7, "pct": 0.857}}},
             "splits": {"player_reception_yds": {"overall": {"5": {"h": 4, "l": 1, "n": 5, "pct": 0.8}}, "home": {"7": {"h": 5, "n": 7, "pct": 0.714}}, "bogus": "nope"}}}
            """.trimIndent(),
        )

        assertEquals(2, trends.recentGameLog.size)
        assertEquals("O", trends.recentGameLog[0].markets["player_reception_yds"])
        assertEquals(79.5, trends.recentGameLog[0].lines["player_reception_yds"])
        assertEquals(8, trends.matchups["CHI"]?.meetings)
        assertEquals(6, trends.matchups["CHI"]?.byMarket?.get("player_reception_yds")?.h)
        assertEquals(4, NFLPropTrendsDetail.preferredWindow(trends.splits["player_reception_yds"]!!["overall"]!!)?.h)
        assertNull(trends.splits["player_reception_yds"]?.get("bogus"))

        val enriched = NFLPropTrendsEnrichment.enrich(
            trends.recentGameLog,
            listOf(
                NFLPlayerGameLogRow(
                    playerId = "00-0036322", season = 2025, week = 18,
                    rushTds = 0.0, recYds = 92.0, recTds = 1.0, receptions = 8.0,
                ),
            ),
        )
        assertEquals(92.0, enriched[0].actuals["player_reception_yds"])
        assertEquals(8.0, enriched[0].actuals["player_receptions"])
        // ATD synthesized from rushing + receiving TDs.
        assertEquals(1.0, enriched[0].actuals["player_anytime_td"])
        // No stats row for week 17 → untouched.
        assertNull(enriched[1].actuals["player_reception_yds"])
    }

    @Test
    fun rushMarketWinsOverQbKind() {
        val page = NFLPropPlayerPage(
            playerId = "p2", season = 2026, week = 1, playerName = "Test QB", position = "QB",
            scheme = NFLPropScheme(
                opponent = "DEN", kind = "qb", defense = null,
                playerOverall = null, playerSplits = emptyMap(), lookFocus = emptyList(),
                rushOverall = NFLPropSchemeSplit(ypc = 5.1, epaRush = 0.11, carries = 80),
                rushSplits = emptyMap(), rushLookFocus = emptyList(), lookHitRates = emptyMap(),
            ),
        )
        assertEquals(NFLSchemeCompareMode.RUSH, NFLPropSchemeCompare.resolveMode(page, "player_rush_yds"))
        assertEquals(NFLSchemeCompareMode.QB, NFLPropSchemeCompare.resolveMode(page, "player_pass_yds"))
        // ATD chain: qb wins for a QB.
        assertEquals(NFLSchemeCompareMode.QB, NFLPropSchemeCompare.resolveMode(page, "player_anytime_td"))
    }

    @Test
    fun verdictHeadlines() {
        assertEquals(
            "We project 271.4 passing yards — 20.9 above Vegas' 250.5 line.",
            NFLPropVerdicts.projectionHeadline(
                NFLPropProjection.Point(271.4, "live", "model"),
                "player_pass_yds", "Pass Yards", 250.5, null,
            ),
        )
        assertEquals(
            "We project 6.5 receptions.",
            NFLPropVerdicts.projectionHeadline(
                NFLPropProjection.Point(6.5, "preview", "2025 form"),
                "player_receptions", "Receptions", null, null,
            ),
        )
        assertEquals(
            "We calculate a 42% chance to score — fair odds +138 — more likely to score than Vegas thinks.",
            NFLPropVerdicts.projectionHeadline(
                NFLPropProjection.Rate(0.42, "live", "2025 games"),
                "player_anytime_td", "Anytime TD", null, 145.0,
            ),
        )
        assertNull(
            NFLPropVerdicts.projectionHeadline(null, "player_pass_yds", "Pass Yards", 250.5, null),
        )

        assertEquals(
            "🔥 Cleared in 8 of the last 10.",
            NFLPropVerdicts.recentGamesHeadline(8, 10, isTd = false, hasLine = true),
        )
        assertEquals(
            "📈 Scored in 6 of the last 10.",
            NFLPropVerdicts.recentGamesHeadline(6, 10, isTd = true, hasLine = true),
        )
        assertNull(NFLPropVerdicts.recentGamesHeadline(0, 5, isTd = false, hasLine = false))

        val matchup = NFLPropTrendMatchup(
            meetings = 6,
            byMarket = mapOf("player_reception_yds" to NFLPropHitRate(4, 6, 0.667)),
        )
        assertEquals(
            "4/6 over vs DEN · 67% · 6 career meetings.",
            NFLPropVerdicts.headToHeadHeadline(matchup, "player_reception_yds", "DEN"),
        )
        val thin = NFLPropTrendMatchup(
            meetings = 4,
            byMarket = mapOf("player_reception_yds" to NFLPropHitRate(1, 1, 1.0)),
        )
        assertNull(NFLPropVerdicts.headToHeadHeadline(thin, "player_reception_yds", "DEN"))
    }
}
