import XCTest
@testable import WagerproofModels

/// Decode + resolution tests for the NFL player-analysis contract
/// (`nfl_prop_player_pages`, `nfl_player_prop_trends`, game-log enrichment,
/// scheme-compare resolution, verdict headlines). The jsonb columns are
/// generator-produced and have drifted before — a mis-decode must degrade to
/// a missing widget, never a failed row.
final class NFLPropPlayerPageTests: XCTestCase {

    private func decodePage(_ json: String) throws -> NFLPropPlayerPage {
        try JSONDecoder().decode(NFLPropPlayerPage.self, from: Data(json.utf8))
    }

    private func decodeTrends(_ json: String) throws -> NFLPropTrendsDetail {
        try JSONDecoder().decode(NFLPropTrendsDetail.self, from: Data(json.utf8))
    }

    // MARK: Page decode

    func testDecodesFullPageRow() throws {
        let page = try decodePage("""
        {
          "player_id": "00-0036322",
          "season": 2026,
          "week": 1,
          "player_name": "Justin Jefferson",
          "position": "WR",
          "team": "MIN",
          "opponent": "CHI",
          "is_home": true,
          "game_label": "CHI @ MIN",
          "kickoff": "2026-09-13T17:00:00Z",
          "headshot_url": "https://example.com/jj.png",
          "rookie": false,
          "markets": [
            {"key": "player_anytime_td", "label": "Anytime TD", "line": null, "over_price": 145, "under_price": null, "status": "posted"},
            {"key": "player_reception_yds", "label": "Receiving Yards", "line": 84.5, "over_price": -112, "under_price": -108, "status": "posted"},
            {"key": "player_receptions", "label": "Receptions", "line": null, "over_price": null, "under_price": null, "status": "pending"}
          ],
          "projection": {
            "player_reception_yds": {"kind": "point", "value": 91.3, "status": "live", "source": "model"},
            "player_anytime_td": {"kind": "rate", "score_rate": 0.42, "n": 16, "status": "live", "source": "2025 games"}
          },
          "scheme": {
            "opponent": "CHI",
            "kind": "receiving",
            "defense": {
              "identity": "zone-heavy, two-high",
              "man": {"rate": 0.24, "pctile": 18},
              "two_high": {"rate": 0.61, "pctile": 88},
              "pressure": {"rate": 0.31, "pctile": 44}
            },
            "player_overall": {"ypt": 9.4, "targets": 612, "pctile": 97, "sample": "ok"},
            "player_splits": {
              "zone": {"ypt": 9.9, "targets": 300, "pctile": 96, "delta_ypt": 0.5, "sample": "ok"},
              "man": {"ypt": 8.1, "targets": 150, "pctile": 90, "delta_ypt": -1.3, "insufficient": false}
            },
            "look_focus": ["zone", "two_high"],
            "look_hit_rates": {
              "zone_heavy": {"player_reception_yds": {"h": 5, "n": 7, "pct": 0.71}},
              "two_high": {"player_reception_yds": {"h": 1, "n": 2, "pct": 0.5}}
            }
          },
          "scheme_game_splits": {
            "overall": {"n": 16, "rec_yds": 96.1, "receptions": 7.1},
            "splits": {
              "zone_heavy": {"n": 6, "rec_yds": 104.2, "delta": {"rec_yds": 8.1}},
              "two_high_heavy": {"n": 2, "insufficient": true, "rec_yds": 60.0}
            },
            "applicable": ["zone_heavy", "two_high_heavy"],
            "window": "2024-2025"
          }
        }
        """)

        XCTAssertEqual(page.playerId, "00-0036322")
        XCTAssertEqual(page.markets.count, 3)
        XCTAssertEqual(page.markets[0].key, "player_anytime_td")
        XCTAssertNil(page.markets[0].line)
        XCTAssertTrue(page.markets[0].isPosted)
        XCTAssertEqual(page.markets[1].line, 84.5)
        XCTAssertFalse(page.markets[2].isPosted)
        XCTAssertFalse(page.rookie)

        guard case .point(let value, _, _)? = page.projection["player_reception_yds"] else {
            return XCTFail("expected point projection")
        }
        XCTAssertEqual(value, 91.3)
        // Generator writes status "live" + source "model"; must read as model.
        XCTAssertEqual(page.projection["player_reception_yds"]?.isModel, true)
        XCTAssertEqual(page.projection["player_anytime_td"]?.isModel, false)

        let scheme = try XCTUnwrap(page.scheme)
        XCTAssertEqual(scheme.kind, "receiving")
        XCTAssertEqual(scheme.defense?.identity, "zone-heavy, two-high")
        XCTAssertEqual(scheme.defense?.dims["man"]?.rate, 0.24)
        XCTAssertEqual(scheme.playerOverall?.ypt, 9.4)
        XCTAssertEqual(scheme.playerSplits["zone"]?.deltaYpt, 0.5)
        XCTAssertEqual(scheme.lookFocus, ["zone", "two_high"])
        XCTAssertEqual(scheme.lookHitRates["zone_heavy"]?["player_reception_yds"]?.h, 5)

        let gs = try XCTUnwrap(page.schemeGameSplits)
        XCTAssertEqual(gs.overall?.stats["rec_yds"], 96.1)
        XCTAssertEqual(gs.splits["zone_heavy"]?.delta["rec_yds"], 8.1)
        XCTAssertEqual(gs.applicable, ["zone_heavy", "two_high_heavy"])
    }

    /// The historical generator drift: a dict where `markets` expects an array.
    func testMalformedMarketsDegradeToEmpty() throws {
        let page = try decodePage("""
        {
          "player_id": "00-0000001", "season": 2026, "week": 1, "player_name": "Drift Case",
          "markets": {"player_receptions": {"line": 4.5}},
          "projection": null,
          "scheme": {"opponent": "DEN"}
        }
        """)
        XCTAssertEqual(page.markets, [])
        XCTAssertEqual(page.projection, [:])
        XCTAssertEqual(page.scheme?.opponent, "DEN")
        XCTAssertNil(page.scheme?.defense)
        XCTAssertNil(page.schemeGameSplits)
    }

    // MARK: Trends decode + enrichment

    func testDecodesTrendsAndEnriches() throws {
        var trends = try decodeTrends("""
        {
          "player_id": "00-0036322",
          "recent_game_log": [
            {"season": 2025, "week": 18, "opp": "GB", "is_home": true, "is_div": true,
             "markets": {"player_reception_yds": "O"}, "actuals": {}, "lines": {"player_reception_yds": 79.5}},
            {"season": 2025, "week": 17, "opp": "DET", "is_primetime": true,
             "markets": {"player_reception_yds": "U"}}
          ],
          "matchups": {
            "CHI": {"meetings": 8, "player_reception_yds": {"h": 6, "n": 7, "pct": 0.857}}
          },
          "splits": {
            "player_reception_yds": {
              "overall": {"5": {"h": 4, "l": 1, "n": 5, "pct": 0.8}},
              "home": {"7": {"h": 5, "l": 2, "n": 7, "pct": 0.714}},
              "bogus": "not-an-object"
            }
          }
        }
        """)

        XCTAssertEqual(trends.recentGameLog.count, 2)
        XCTAssertEqual(trends.recentGameLog[0].markets["player_reception_yds"], "O")
        XCTAssertEqual(trends.recentGameLog[0].lines["player_reception_yds"], 79.5)
        XCTAssertEqual(trends.matchups["CHI"]?.meetings, 8)
        XCTAssertEqual(trends.matchups["CHI"]?.byMarket["player_reception_yds"]?.h, 6)
        let overall = try XCTUnwrap(trends.splits["player_reception_yds"]?["overall"])
        XCTAssertEqual(NFLPropTrendsDetail.preferredWindow(overall)?.h, 4)
        XCTAssertNil(trends.splits["player_reception_yds"]?["bogus"])

        trends.recentGameLog = NFLPropTrendsEnrichment.enrich(
            trends.recentGameLog,
            gameLogs: [
                NFLPlayerGameLogRow(
                    playerId: "00-0036322", season: 2025, week: 18,
                    rushTds: 0, recYds: 92, recTds: 1, receptions: 8
                ),
            ]
        )
        XCTAssertEqual(trends.recentGameLog[0].actuals["player_reception_yds"], 92)
        XCTAssertEqual(trends.recentGameLog[0].actuals["player_receptions"], 8)
        // ATD synthesized from rushing + receiving TDs.
        XCTAssertEqual(trends.recentGameLog[0].actuals["player_anytime_td"], 1)
        // No stats row for week 17 → untouched.
        XCTAssertNil(trends.recentGameLog[1].actuals["player_reception_yds"])
    }

    // MARK: Scheme-compare resolution

    private func receiverPage(lookFocus: [String] = ["zone", "man"]) -> NFLPropPlayerPage {
        NFLPropPlayerPage(
            playerId: "p1", season: 2026, week: 1, playerName: "Test WR", position: "WR",
            scheme: NFLPropScheme(
                opponent: "CHI", kind: "receiving",
                defense: NFLPropDefense(identity: "zone-heavy", dims: [
                    "man": NFLPropDefenseDim(rate: 0.24, pctile: 18),
                    "two_high": NFLPropDefenseDim(rate: 0.61, pctile: 88),
                ]),
                playerOverall: NFLPropSchemeSplit(ypt: 9.4, targets: 612, pctile: 97),
                playerSplits: [
                    "zone": NFLPropSchemeSplit(ypt: 9.9, targets: 300, deltaYpt: 0.5),
                    "man": NFLPropSchemeSplit(ypt: 8.1, targets: 0),
                ],
                lookFocus: lookFocus,
                rushOverall: nil, rushSplits: [:], rushLookFocus: [],
                lookHitRates: [:]
            )
        )
    }

    func testReceivingCompareFiltersRows() throws {
        let resolved = try XCTUnwrap(
            NFLPropSchemeCompare.resolve(page: receiverPage(), marketKey: "player_reception_yds")
        )
        XCTAssertEqual(resolved.mode, .receiving)
        XCTAssertEqual(resolved.overallValue, 9.4)
        // "man" row dropped: 0 targets fails the ≥1 gate.
        XCTAssertEqual(resolved.lookRows.map(\.key), ["zone"])
        XCTAssertEqual(resolved.lookRows[0].deltaThreshold, 0.35)
        XCTAssertTrue(resolved.hasCompare)
    }

    /// Rush-market check must run before the QB check (a QB's rush yards
    /// market uses the rush layer when rush_overall exists).
    func testRushMarketWinsOverQbKind() {
        let page = NFLPropPlayerPage(
            playerId: "p2", season: 2026, week: 1, playerName: "Test QB", position: "QB",
            scheme: NFLPropScheme(
                opponent: "DEN", kind: "qb", defense: nil,
                playerOverall: nil, playerSplits: [:], lookFocus: [],
                rushOverall: NFLPropSchemeSplit(ypc: 5.1, epaRush: 0.11, carries: 80),
                rushSplits: [:], rushLookFocus: [], lookHitRates: [:]
            )
        )
        XCTAssertEqual(NFLPropSchemeCompare.resolveMode(page: page, marketKey: "player_rush_yds"), .rush)
        XCTAssertEqual(NFLPropSchemeCompare.resolveMode(page: page, marketKey: "player_pass_yds"), .qb)
        // ATD chain: qb wins for a QB.
        XCTAssertEqual(NFLPropSchemeCompare.resolveMode(page: page, marketKey: "player_anytime_td"), .qb)
    }

    func testDefenseTilesSynthesizeZoneAndRelabelOneHigh() {
        let page = receiverPage(lookFocus: ["zone", "one_high"])
        let tiles = NFLPropSchemeCompare.defenseTiles(page: page, mode: .receiving)
        XCTAssertEqual(tiles.count, 2)
        // zone = complement of the served man rate.
        XCTAssertEqual(tiles[0].key, "zone")
        XCTAssertEqual(tiles[0].rate, 0.76, accuracy: 0.0001)
        XCTAssertEqual(tiles[0].pctile, 82, accuracy: 0.0001)
        // one_high reuses the two-high axis relabeled.
        XCTAssertEqual(tiles[1].label, "Single-high shell")
        XCTAssertEqual(tiles[1].rate, 0.61)
    }

    func testDefenseTilesFallBackToExtremes() {
        let page = receiverPage(lookFocus: ["neutral"])
        let tiles = NFLPropSchemeCompare.defenseTiles(page: page, mode: .receiving)
        // Focus produced nothing → extreme dims (pctile ≥60 or ≤40) in fixed order.
        XCTAssertEqual(tiles.map(\.key), ["man", "two_high"])
    }

    func testGameSplitSkipsInsufficientBuckets() throws {
        let page = NFLPropPlayerPage(
            playerId: "p3", season: 2026, week: 1, playerName: "Test",
            schemeGameSplits: NFLPropGameSplits(
                overall: NFLPropGameSplitEntry(n: 16, insufficient: false, stats: ["rec_yds": 96.1], delta: [:]),
                splits: [
                    "two_high_heavy": NFLPropGameSplitEntry(n: 2, insufficient: true, stats: ["rec_yds": 60], delta: [:]),
                    "zone_heavy": NFLPropGameSplitEntry(n: 6, insufficient: false, stats: ["rec_yds": 104.2], delta: ["rec_yds": 8.1]),
                ],
                applicable: ["two_high_heavy", "zone_heavy"],
                window: nil
            )
        )
        let split = try XCTUnwrap(NFLPropSchemeCompare.gameSplit(page: page, marketKey: "player_reception_yds"))
        XCTAssertEqual(split.entry.stats["rec_yds"], 104.2)
        XCTAssertEqual(split.bucketLabels, ["zone-heavy"])
        // Markets without a stat key show no block (web parity).
        XCTAssertNil(NFLPropSchemeCompare.gameSplit(page: page, marketKey: "player_pass_tds"))
    }

    // MARK: Verdict headlines

    func testProjectionHeadlines() {
        let above = NFLPropVerdicts.projectionHeadline(
            projection: .point(value: 271.4, status: "live", source: "model"),
            marketKey: "player_pass_yds", marketLabel: "Pass Yards",
            line: 250.5, vegasOdds: nil
        )
        XCTAssertEqual(above, "We project 271.4 passing yards — 20.9 above Vegas' 250.5 line.")

        let noLine = NFLPropVerdicts.projectionHeadline(
            projection: .point(value: 6.5, status: "preview", source: "2025 form"),
            marketKey: "player_receptions", marketLabel: "Receptions",
            line: nil, vegasOdds: nil
        )
        XCTAssertEqual(noLine, "We project 6.5 receptions.")

        let atd = NFLPropVerdicts.projectionHeadline(
            projection: .rate(scoreRate: 0.42, status: "live", source: "2025 games"),
            marketKey: "player_anytime_td", marketLabel: "Anytime TD",
            line: nil, vegasOdds: 145
        )
        // 42% model vs ~40.8% implied by +145 → more likely than Vegas.
        XCTAssertEqual(atd, "We calculate a 42% chance to score — fair odds +138 — more likely to score than Vegas thinks.")

        XCTAssertNil(NFLPropVerdicts.projectionHeadline(
            projection: nil, marketKey: "player_pass_yds", marketLabel: "Pass Yards",
            line: 250.5, vegasOdds: nil
        ))
    }

    func testRecentGamesHeadlineTiers() {
        XCTAssertEqual(
            NFLPropVerdicts.recentGamesHeadline(hits: 8, graded: 10, isTd: false, hasLine: true),
            "🔥 Cleared in 8 of the last 10."
        )
        XCTAssertEqual(
            NFLPropVerdicts.recentGamesHeadline(hits: 6, graded: 10, isTd: false, hasLine: true),
            "📈 Hit 6/10 over the last 10."
        )
        XCTAssertEqual(
            NFLPropVerdicts.recentGamesHeadline(hits: 3, graded: 9, isTd: false, hasLine: true),
            "3/9 over the last 9."
        )
        XCTAssertEqual(
            NFLPropVerdicts.recentGamesHeadline(hits: 6, graded: 10, isTd: true, hasLine: true),
            "📈 Scored in 6 of the last 10."
        )
        XCTAssertNil(NFLPropVerdicts.recentGamesHeadline(hits: 0, graded: 5, isTd: false, hasLine: false))
    }

    func testHeadToHeadHeadlineGates() {
        let matchup = NFLPropTrendMatchup(
            meetings: 6,
            byMarket: ["player_reception_yds": NFLPropHitRate(h: 4, n: 6, pct: 0.667)]
        )
        XCTAssertEqual(
            NFLPropVerdicts.headToHeadHeadline(matchup: matchup, marketKey: "player_reception_yds", opponent: "DEN"),
            "4/6 over vs DEN · 67% · 6 career meetings."
        )
        // n < 2 on the market → nil.
        let thin = NFLPropTrendMatchup(
            meetings: 4,
            byMarket: ["player_reception_yds": NFLPropHitRate(h: 1, n: 1, pct: 1)]
        )
        XCTAssertNil(NFLPropVerdicts.headToHeadHeadline(matchup: thin, marketKey: "player_reception_yds", opponent: "DEN"))
        XCTAssertNil(NFLPropVerdicts.headToHeadHeadline(matchup: nil, marketKey: "player_reception_yds", opponent: "DEN"))
    }
}
