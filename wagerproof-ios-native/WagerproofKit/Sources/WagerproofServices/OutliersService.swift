import Foundation
import Supabase
import WagerproofModels

/// Ports `wagerproof-mobile/services/outliersService.ts` byte-identical.
/// Three public entry points mirror the RN exports:
///
///   - `fetchWeekGames()` — pulls NFL / CFB / NBA / NCAAB game rows from the
///     CFB Supabase project (`v_input_values_with_epa`, `cfb_live_weekly_inputs`,
///     `nba_input_values_view`, `v_cbb_input_values`), filters to the next
///     7 days in America/New_York, hydrates predictions, returns the merged
///     summary list.
///   - `fetchValueAlerts(weekGames:)` — joins each game against the cached
///     `polymarket_markets` table on `main` Supabase, applies the same
///     spread/total/moneyline thresholds, returns alerts.
///   - `fetchFadeAlerts(weekGames:)` — runs the per-sport confidence/edge
///     thresholds against the predictions already merged into each game.
///
/// MLB is intentionally **not** ported in this batch — the RN service file
/// also has no MLB branch; the MLB trends section gets its data from the
/// (separate) `mlbBettingTrendsService` which lands with B12.
public actor OutliersService {
    public static let shared = OutliersService()

    private init() {}

    // MARK: - Public API

    public func fetchWeekGames() async throws -> [OutlierGame] {
        let dates = OutliersService.getDateWindow()
        var games: [OutlierGame] = []

        let cfb = await CFBSupabase.shared.client

        // 1. NFL ----------------------------------------------------------
        // NEW model's weekly output: nfl_dryrun_games at the current week
        // (latest season/week present). Legacy v_input_values_with_epa +
        // nfl_betting_lines retired. The dry-run slate is already a single
        // week, so no 7-day date window is applied.
        do {
            if let slate = try await Self.fetchDryrunAnchor(cfb, table: "nfl_dryrun_games") {
                let rows: [NFLDryrunOutlierRow] = try await cfb
                    .from("nfl_dryrun_games")
                    .select("game_id, home_team, away_team, kickoff, fg_spread_close, fg_total_close, fg_ml_home_close, fg_ml_away_close")
                    .eq("season", value: slate.season)
                    .eq("week", value: slate.week)
                    .order("kickoff", ascending: true)
                    .execute()
                    .value
                for row in rows {
                    let homeSpread = row.fgSpreadClose
                    games.append(OutlierGame(
                        gameId: row.gameId ?? "",
                        sport: .nfl,
                        awayTeam: row.awayTeam ?? "",
                        homeTeam: row.homeTeam ?? "",
                        gameTime: row.kickoff,
                        awaySpread: homeSpread.map { -$0 },
                        homeSpread: homeSpread,
                        totalLine: row.fgTotalClose,
                        awayMl: row.fgMlAwayClose.map { Int($0.rounded()) },
                        homeMl: row.fgMlHomeClose.map { Int($0.rounded()) }
                    ))
                }
            }
        } catch {
            // Best-effort per sport — one sport's outage doesn't blank the feed.
        }

        // 2. CFB ----------------------------------------------------------
        // NEW model's weekly output: cfb_dryrun_games at the current week.
        // Legacy cfb_live_weekly_inputs + cfb_api_predictions retired.
        do {
            if let slate = try await Self.fetchDryrunAnchor(cfb, table: "cfb_dryrun_games") {
                let rows: [CFBDryrunOutlierRow] = try await cfb
                    .from("cfb_dryrun_games")
                    .select("game_id, home_team, away_team, kickoff, fg_spread_close, fg_total_close, fg_ml_home_close, fg_ml_away_close")
                    .eq("season", value: slate.season)
                    .eq("week", value: slate.week)
                    .order("kickoff", ascending: true)
                    .execute()
                    .value
                for row in rows {
                    let homeSpread = row.fgSpreadClose
                    games.append(OutlierGame(
                        gameId: row.gameId.value,
                        sport: .cfb,
                        awayTeam: row.awayTeam ?? "",
                        homeTeam: row.homeTeam ?? "",
                        gameTime: row.kickoff,
                        awaySpread: homeSpread.map { -$0 },
                        homeSpread: homeSpread,
                        totalLine: row.fgTotalClose,
                        awayMl: row.fgMlAwayClose.map { Int($0.rounded()) },
                        homeMl: row.fgMlHomeClose.map { Int($0.rounded()) }
                    ))
                }
            }
        } catch {
            // ignore
        }

        // 3. NBA ----------------------------------------------------------
        do {
            let rows: [NBAInputRow] = try await cfb
                .from("nba_input_values_view")
                .select()
                .order("game_date", ascending: true)
                .execute()
                .value

            for game in rows {
                var gameDate = game.gameDate
                if let tip = game.tipoffTimeEt, let etDate = OutliersService.formatETDate(tip) {
                    gameDate = etDate
                }
                guard let gameDate, gameDate >= dates.today, gameDate <= dates.weekFromNow else { continue }
                let homeML = game.homeMoneyline
                // RN: prefer explicit away_moneyline column; complement is fallback.
                let awayML: Int? = game.awayMoneyline ?? homeML.map { ml in
                    ml > 0 ? -(ml + 100) : 100 - ml
                }
                let homeSpread = game.homeSpread
                let awaySpread = homeSpread.map { -$0 }
                let idStr = game.trainingKey ?? game.uniqueId ?? "\(game.gameId)"
                games.append(OutlierGame(
                    gameId: idStr,
                    sport: .nba,
                    awayTeam: game.awayTeam ?? "",
                    homeTeam: game.homeTeam ?? "",
                    gameTime: game.tipoffTimeEt ?? game.gameDate,
                    awaySpread: awaySpread,
                    homeSpread: homeSpread,
                    totalLine: game.totalLine,
                    awayMl: awayML,
                    homeMl: homeML,
                    awayTeamAbbrev: (game.awayAbbr?.trimmingCharacters(in: .whitespaces).isEmpty == false) ? game.awayAbbr : game.awayTeam,
                    homeTeamAbbrev: (game.homeAbbr?.trimmingCharacters(in: .whitespaces).isEmpty == false) ? game.homeAbbr : game.homeTeam
                ))
            }
        } catch {
            // ignore
        }

        // 4. NCAAB --------------------------------------------------------
        do {
            async let ncaabRowsTask: [NCAABInputRow] = cfb
                .from("v_cbb_input_values")
                .select()
                .order("game_date_et", ascending: true)
                .execute()
                .value

            async let teamMappingTask: [NCAABTeamMapping] = cfb
                .from("ncaab_team_mapping")
                .select("api_team_id, espn_team_id, team_abbrev")
                .execute()
                .value

            let (rows, mappings) = try await (ncaabRowsTask, teamMappingTask)

            var teamMap: [String: (logo: String?, abbrev: String?)] = [:]
            for m in mappings {
                let key = String(m.apiTeamId)
                let logo = m.espnTeamId.map { "https://a.espncdn.com/i/teamlogos/ncaa/500/\($0).png" }
                teamMap[key] = (logo, m.teamAbbrev)
            }

            for game in rows {
                var gameDate = game.gameDateEt
                let dtSource = game.startUtc ?? game.tipoffTimeEt
                if let dtSource, let etDate = OutliersService.formatETDate(dtSource) {
                    gameDate = etDate
                }
                guard let gameDate, gameDate >= dates.today, gameDate <= dates.weekFromNow else { continue }
                let homeMap = game.homeTeamId.flatMap { teamMap[String($0)] }
                let awayMap = game.awayTeamId.flatMap { teamMap[String($0)] }
                let idStr = game.trainingKey ?? game.uniqueId ?? "\(game.gameId)"
                let homeSpread = game.spread
                let awaySpread = homeSpread.map { -$0 }
                games.append(OutlierGame(
                    gameId: idStr,
                    sport: .ncaab,
                    awayTeam: game.awayTeam ?? "",
                    homeTeam: game.homeTeam ?? "",
                    gameTime: game.startUtc ?? game.tipoffTimeEt ?? game.gameDateEt,
                    awaySpread: awaySpread,
                    homeSpread: homeSpread,
                    totalLine: game.overUnder,
                    awayMl: game.awayMoneyline,
                    homeMl: game.homeMoneyline,
                    awayTeamLogo: awayMap?.logo ?? nil,
                    homeTeamLogo: homeMap?.logo ?? nil,
                    awayTeamAbbrev: awayMap?.abbrev ?? nil,
                    homeTeamAbbrev: homeMap?.abbrev ?? nil
                ))
            }
        } catch {
            // ignore
        }

        // Hydrate predictions so fade alerts can run their thresholds.
        games = await hydratePredictions(games)
        return games
    }

    public func fetchValueAlerts(weekGames: [OutlierGame]) async -> [OutlierValueAlert] {
        guard !weekGames.isEmpty else { return [] }
        var alerts: [OutlierValueAlert] = []

        // RN groups by league because polymarket markets query takes (league + game_keys[]).
        var byLeague: [SportLeague: [OutlierGame]] = [:]
        for g in weekGames { byLeague[g.sport, default: []].append(g) }

        let main = await MainSupabase.shared.client
        var marketsByGameKey: [String: [PolymarketMarket]] = [:]

        for (league, games) in byLeague {
            let gameKeys = Array(Set(games.map { "\(league.rawValue)_\($0.awayTeam)_\($0.homeTeam)" }))
            guard !gameKeys.isEmpty else { continue }
            do {
                let markets: [PolymarketMarket] = try await main
                    .from("polymarket_markets")
                    .select("game_key, market_type, current_away_odds, current_home_odds")
                    .eq("league", value: league.rawValue)
                    .in("game_key", values: gameKeys)
                    .execute()
                    .value
                for m in markets {
                    marketsByGameKey[m.gameKey, default: []].append(m)
                }
            } catch {
                continue
            }
        }

        for game in weekGames {
            let key = "\(game.sport.rawValue)_\(game.awayTeam)_\(game.homeTeam)"
            guard let markets = marketsByGameKey[key] else { continue }
            for market in markets {
                let awayOdds = market.currentAwayOdds ?? 0
                let homeOdds = market.currentHomeOdds ?? 0
                // RN skip rule: stale / resolved / no-liquidity markets.
                if awayOdds >= 95 || homeOdds >= 95 ||
                    awayOdds <= 5 || homeOdds <= 5 ||
                    awayOdds + homeOdds < 80 {
                    continue
                }

                switch market.marketType {
                case "spread":
                    if awayOdds > 57 {
                        alerts.append(OutlierValueAlert(
                            gameId: game.gameId, sport: game.sport,
                            awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                            marketType: .spread, side: game.awayTeam,
                            percentage: awayOdds, game: game
                        ))
                    }
                    if homeOdds > 57 {
                        alerts.append(OutlierValueAlert(
                            gameId: game.gameId, sport: game.sport,
                            awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                            marketType: .spread, side: game.homeTeam,
                            percentage: homeOdds, game: game
                        ))
                    }
                case "total":
                    if awayOdds > 57 {
                        alerts.append(OutlierValueAlert(
                            gameId: game.gameId, sport: game.sport,
                            awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                            marketType: .total, side: "Over",
                            percentage: awayOdds, game: game
                        ))
                    }
                    if homeOdds > 57 {
                        alerts.append(OutlierValueAlert(
                            gameId: game.gameId, sport: game.sport,
                            awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                            marketType: .total, side: "Under",
                            percentage: homeOdds, game: game
                        ))
                    }
                case "moneyline":
                    // Skip if book odds are -200 or worse (heavy favorite = no value).
                    let awayOddsHaveValue = (game.awayMl ?? 0) == 0 || (game.awayMl ?? 0) > -200
                    if awayOdds >= 85 && awayOddsHaveValue {
                        alerts.append(OutlierValueAlert(
                            gameId: game.gameId, sport: game.sport,
                            awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                            marketType: .moneyline, side: game.awayTeam,
                            percentage: awayOdds, game: game
                        ))
                    }
                    let homeOddsHaveValue = (game.homeMl ?? 0) == 0 || (game.homeMl ?? 0) > -200
                    if homeOdds >= 85 && homeOddsHaveValue {
                        alerts.append(OutlierValueAlert(
                            gameId: game.gameId, sport: game.sport,
                            awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                            marketType: .moneyline, side: game.homeTeam,
                            percentage: homeOdds, game: game
                        ))
                    }
                default:
                    continue
                }
            }
        }
        return alerts
    }

    public func fetchFadeAlerts(weekGames: [OutlierGame]) async -> [OutlierFadeAlert] {
        var alerts: [OutlierFadeAlert] = []
        for game in weekGames {
            switch game.sport {
            case .nfl:
                if let p = game.homeAwaySpreadCoverProb {
                    let isHome = p > 0.5
                    let conf = Int(((isHome ? p : 1 - p) * 100).rounded())
                    if conf >= 80 {
                        alerts.append(OutlierFadeAlert(
                            gameId: game.gameId, sport: .nfl,
                            awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                            pickType: .spread,
                            predictedTeam: isHome ? game.homeTeam : game.awayTeam,
                            confidence: conf, game: game
                        ))
                    }
                }
                if let p = game.ouResultProb {
                    let isOver = p > 0.5
                    let conf = Int(((isOver ? p : 1 - p) * 100).rounded())
                    if conf >= 80 {
                        alerts.append(OutlierFadeAlert(
                            gameId: game.gameId, sport: .nfl,
                            awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                            pickType: .total,
                            predictedTeam: isOver ? "Over" : "Under",
                            confidence: conf, game: game
                        ))
                    }
                }
            case .cfb:
                if let edge = game.homeSpreadDiff, abs(edge) > 10 {
                    alerts.append(OutlierFadeAlert(
                        gameId: game.gameId, sport: .cfb,
                        awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                        pickType: .spread,
                        predictedTeam: edge > 0 ? game.homeTeam : game.awayTeam,
                        confidence: Int(abs(edge).rounded()), game: game
                    ))
                }
                if let edge = game.overLineDiff, abs(edge) > 10 {
                    alerts.append(OutlierFadeAlert(
                        gameId: game.gameId, sport: .cfb,
                        awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                        pickType: .total,
                        predictedTeam: edge > 0 ? "Over" : "Under",
                        confidence: Int(abs(edge).rounded()), game: game
                    ))
                }
            case .nba:
                // RN: NBA only spread fades, threshold 9.5.
                if let edge = game.homeSpreadDiff, abs(edge) >= 9.5 {
                    alerts.append(OutlierFadeAlert(
                        gameId: game.gameId, sport: .nba,
                        awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                        pickType: .spread,
                        predictedTeam: edge > 0 ? game.homeTeam : game.awayTeam,
                        confidence: Int(abs(edge).rounded()), game: game
                    ))
                }
            case .ncaab:
                if let edge = game.homeSpreadDiff, abs(edge) > 5 {
                    alerts.append(OutlierFadeAlert(
                        gameId: game.gameId, sport: .ncaab,
                        awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                        pickType: .spread,
                        predictedTeam: edge > 0 ? game.homeTeam : game.awayTeam,
                        confidence: Int(abs(edge).rounded()), game: game
                    ))
                }
                if let edge = game.overLineDiff, abs(edge) > 5 {
                    alerts.append(OutlierFadeAlert(
                        gameId: game.gameId, sport: .ncaab,
                        awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                        pickType: .total,
                        predictedTeam: edge > 0 ? "Over" : "Under",
                        confidence: Int(abs(edge).rounded()), game: game
                    ))
                }
            case .mlb:
                break // MLB fade alerts not implemented in RN service either.
            }
        }
        return alerts
    }

    // MARK: - Predictions hydration
    //
    // Mirrors RN's `hydratePredictions(...)`. Per sport we pull the latest
    // run and merge the win-prob / spread-diff / over-diff columns onto each
    // game. The view re-creates the `OutlierGame` value type with the merged
    // fields because Swift structs are value types.

    private func hydratePredictions(_ games: [OutlierGame]) async -> [OutlierGame] {
        let cfb = await CFBSupabase.shared.client
        let indexed = Dictionary(uniqueKeysWithValues: games.enumerated().map { ($1.gameId, $0) })
        var out = games

        // ── NFL ────────────────────────────────────────────────
        // NEW model probabilities/edges from nfl_dryrun_games (current week).
        // The new NFL model has no O/U probability column, so ouResultProb is
        // nil; the spread fade keys off fg_home_cover_prob.
        let nflGames = games.filter { $0.sport == .nfl }
        if !nflGames.isEmpty {
            do {
                if let slate = try await Self.fetchDryrunAnchor(cfb, table: "nfl_dryrun_games") {
                    let preds: [NFLDryrunPredRow] = (try? await cfb
                        .from("nfl_dryrun_games")
                        .select("game_id, fg_home_win_prob, fg_home_cover_prob, fg_spread_edge, fg_total_edge")
                        .eq("season", value: slate.season)
                        .eq("week", value: slate.week)
                        .execute()
                        .value) ?? []
                    let predMap = Dictionary(uniqueKeysWithValues: preds.compactMap { p -> (String, NFLDryrunPredRow)? in
                        guard let id = p.gameId else { return nil }
                        return (id, p)
                    })
                    for game in nflGames {
                        guard let p = predMap[game.gameId], let idx = indexed[game.gameId] else { continue }
                        let g = out[idx]
                        out[idx] = OutlierGame(
                            gameId: g.gameId, sport: g.sport,
                            awayTeam: g.awayTeam, homeTeam: g.homeTeam,
                            gameTime: g.gameTime,
                            awaySpread: g.awaySpread, homeSpread: g.homeSpread,
                            totalLine: g.totalLine, awayMl: g.awayMl, homeMl: g.homeMl,
                            awayTeamLogo: g.awayTeamLogo, homeTeamLogo: g.homeTeamLogo,
                            awayTeamAbbrev: g.awayTeamAbbrev, homeTeamAbbrev: g.homeTeamAbbrev,
                            homeAwaySpreadCoverProb: p.fgHomeCoverProb,
                            ouResultProb: nil,
                            homeAwayMlProb: p.fgHomeWinProb,
                            homeSpreadDiff: p.fgSpreadEdge,
                            overLineDiff: p.fgTotalEdge
                        )
                    }
                }
            }
        }

        // ── CFB ────────────────────────────────────────────────
        // NEW model probabilities/edges from cfb_dryrun_games (current week).
        // Legacy cfb_api_predictions retired. CFB fade keys off fg_spread_edge /
        // fg_total_edge; fg_home_cover_prob feeds the cover prob.
        let cfbGames = games.filter { $0.sport == .cfb }
        if !cfbGames.isEmpty {
            if let slate = try? await Self.fetchDryrunAnchor(cfb, table: "cfb_dryrun_games") {
                let preds: [CFBDryrunPredRow] = (try? await cfb
                    .from("cfb_dryrun_games")
                    .select("game_id, fg_home_win_prob, fg_home_cover_prob, fg_spread_edge, fg_total_edge")
                    .eq("season", value: slate.season)
                    .eq("week", value: slate.week)
                    .execute()
                    .value) ?? []
                let predMap = Dictionary(uniqueKeysWithValues: preds.map { ($0.gameId.value, $0) })
                for game in cfbGames {
                    guard let p = predMap[game.gameId], let idx = indexed[game.gameId] else { continue }
                    let g = out[idx]
                    out[idx] = OutlierGame(
                        gameId: g.gameId, sport: g.sport,
                        awayTeam: g.awayTeam, homeTeam: g.homeTeam,
                        gameTime: g.gameTime,
                        awaySpread: g.awaySpread, homeSpread: g.homeSpread,
                        totalLine: g.totalLine, awayMl: g.awayMl, homeMl: g.homeMl,
                        awayTeamLogo: g.awayTeamLogo, homeTeamLogo: g.homeTeamLogo,
                        awayTeamAbbrev: g.awayTeamAbbrev, homeTeamAbbrev: g.homeTeamAbbrev,
                        homeAwaySpreadCoverProb: p.fgHomeCoverProb,
                        ouResultProb: nil,
                        homeAwayMlProb: p.fgHomeWinProb,
                        homeSpreadDiff: p.fgSpreadEdge,
                        overLineDiff: p.fgTotalEdge
                    )
                }
            }
        }

        // ── NBA ────────────────────────────────────────────────
        let nbaGames = games.filter { $0.sport == .nba }
        if !nbaGames.isEmpty {
            let preds: [NBAPredictionRow] = (try? await cfb
                .from("nba_predictions")
                .select("game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread, run_id, as_of_ts_utc")
                .execute()
                .value) ?? []
            // Keep latest per game_id.
            var predMap: [Int: NBAPredictionRow] = [:]
            for p in preds {
                if let existing = predMap[p.gameId],
                   let existingTs = existing.asOfTsUtc,
                   let candidateTs = p.asOfTsUtc {
                    if candidateTs > existingTs { predMap[p.gameId] = p }
                } else if predMap[p.gameId] == nil {
                    predMap[p.gameId] = p
                }
            }
            for game in nbaGames {
                // gameId might be training_key — look up by suffix matching numeric segment.
                let candidateGameId = Int(game.gameId.split(separator: "_").last.map(String.init) ?? "") ?? Int(game.gameId)
                guard let gid = candidateGameId, let p = predMap[gid], let idx = indexed[game.gameId] else { continue }
                let g = out[idx]

                // Spread cover prob (mirrors RN's home_away_spread_cover_prob synthesis).
                var coverProb: Double? = nil
                if let fairSpread = p.modelFairHomeSpread, let homeSpread = g.homeSpread {
                    let diff = abs(fairSpread - homeSpread)
                    coverProb = fairSpread < homeSpread
                        ? 0.5 + min(diff * 0.05, 0.35)
                        : 0.5 - min(diff * 0.05, 0.35)
                } else if let win = p.homeWinProb {
                    coverProb = win
                }
                // O/U prob.
                var ouProb: Double? = nil
                if let fairTotal = p.modelFairTotal, let total = g.totalLine {
                    let diff = fairTotal - total
                    ouProb = diff > 0
                        ? 0.5 + min(abs(diff) * 0.02, 0.35)
                        : 0.5 - min(abs(diff) * 0.02, 0.35)
                }
                let spreadDiff = (p.modelFairHomeSpread != nil && g.homeSpread != nil) ? (p.modelFairHomeSpread! - g.homeSpread!) : nil
                let totalDiff = (p.modelFairTotal != nil && g.totalLine != nil) ? (p.modelFairTotal! - g.totalLine!) : nil

                out[idx] = OutlierGame(
                    gameId: g.gameId, sport: g.sport,
                    awayTeam: g.awayTeam, homeTeam: g.homeTeam,
                    gameTime: g.gameTime,
                    awaySpread: g.awaySpread, homeSpread: g.homeSpread,
                    totalLine: g.totalLine, awayMl: g.awayMl, homeMl: g.homeMl,
                    awayTeamLogo: g.awayTeamLogo, homeTeamLogo: g.homeTeamLogo,
                    awayTeamAbbrev: g.awayTeamAbbrev, homeTeamAbbrev: g.homeTeamAbbrev,
                    homeAwaySpreadCoverProb: coverProb,
                    ouResultProb: ouProb,
                    homeAwayMlProb: p.homeWinProb,
                    homeSpreadDiff: spreadDiff,
                    overLineDiff: totalDiff
                )
            }
        }

        // ── NCAAB ──────────────────────────────────────────────
        let ncaabGames = games.filter { $0.sport == .ncaab }
        if !ncaabGames.isEmpty {
            struct RunRow: Decodable, Sendable {
                let runId: Int?
                enum CodingKeys: String, CodingKey { case runId = "run_id" }
            }
            let latestRun: RunRow? = try? await cfb
                .from("ncaab_predictions")
                .select("run_id")
                .order("as_of_ts_utc", ascending: false)
                .limit(1)
                .execute()
                .value

            if let runId = latestRun?.runId {
                let preds: [NCAABPredictionRow] = (try? await cfb
                    .from("ncaab_predictions")
                    .select()
                    .eq("run_id", value: runId)
                    .execute()
                    .value) ?? []
                var predMap: [Int: NCAABPredictionRow] = [:]
                for p in preds where predMap[p.gameId] == nil { predMap[p.gameId] = p }

                for game in ncaabGames {
                    let candidateGameId = Int(game.gameId.split(separator: "_").last.map(String.init) ?? "") ?? Int(game.gameId)
                    guard let gid = candidateGameId, let p = predMap[gid], let idx = indexed[game.gameId] else { continue }
                    let g = out[idx]

                    // NCAAB: use home_win_prob as spread cover proxy.
                    let coverProb = p.homeAwaySpreadCoverProb ?? p.homeWinProb
                    let vegasTotal = p.vegasTotal ?? g.totalLine
                    var ouProb = p.ouResultProb
                    if ouProb == nil, let pred = p.predTotalPoints, let total = vegasTotal {
                        ouProb = pred > total ? 0.6 : 0.4
                    }
                    out[idx] = OutlierGame(
                        gameId: g.gameId, sport: g.sport,
                        awayTeam: g.awayTeam, homeTeam: g.homeTeam,
                        gameTime: g.gameTime,
                        awaySpread: p.vegasHomeSpread.map { -$0 } ?? g.awaySpread,
                        homeSpread: p.vegasHomeSpread ?? g.homeSpread,
                        totalLine: p.vegasTotal ?? g.totalLine,
                        awayMl: p.vegasAwayMoneyline ?? g.awayMl,
                        homeMl: p.vegasHomeMoneyline ?? g.homeMl,
                        awayTeamLogo: g.awayTeamLogo, homeTeamLogo: g.homeTeamLogo,
                        awayTeamAbbrev: g.awayTeamAbbrev, homeTeamAbbrev: g.homeTeamAbbrev,
                        homeAwaySpreadCoverProb: coverProb,
                        ouResultProb: ouProb,
                        homeAwayMlProb: p.homeWinProb,
                        homeSpreadDiff: p.homeSpreadDiff,
                        overLineDiff: p.overLineDiff
                    )
                }
            }
        }

        return out
    }

    // MARK: - Dry-run slate anchor

    /// Resolve the current-week anchor for a dry-run table: the latest
    /// (season, week) present. The pipeline delete-then-inserts per (season,
    /// week), so the newest slate is the current week. Mirrors the web
    /// `fetchSlateAnchor` helper.
    private static func fetchDryrunAnchor(_ cfb: SupabaseClient, table: String) async throws -> (season: Int, week: Int)? {
        let anchor: [OutliersDryrunAnchorRow] = try await cfb
            .from(table)
            .select("season, week")
            .order("season", ascending: false)
            .order("week", ascending: false)
            .limit(1)
            .execute()
            .value
        guard let row = anchor.first, let season = row.season, let week = row.week else { return nil }
        return (season, week)
    }

    // MARK: - Date helpers (America/New_York window — 7 days forward)

    public struct DateWindow: Sendable {
        public let today: String
        public let weekFromNow: String
    }

    public static func getDateWindow() -> DateWindow {
        let cal = Calendar(identifier: .gregorian)
        let now = Date()
        let oneWeek = cal.date(byAdding: .day, value: 7, to: now) ?? now
        return DateWindow(today: formatET(now), weekFromNow: formatET(oneWeek))
    }

    private static let etFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "America/New_York")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static func formatET(_ date: Date) -> String { etFormatter.string(from: date) }

    /// Parse arbitrary date strings (ISO 8601, YYYY-MM-DD, etc) to YYYY-MM-DD
    /// in America/New_York. Mirrors RN's `Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', ... })`.
    static func formatETDate(_ raw: String) -> String? {
        // Try ISO 8601 first.
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: raw) { return formatET(d) }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: raw) { return formatET(d) }

        // Bare YYYY-MM-DD: trust it.
        if raw.count >= 10, raw.prefix(10).contains("-") {
            return String(raw.prefix(10))
        }
        // Space-separated ISO ("2026-05-20 19:00:00+00").
        if let d = iso.date(from: raw.replacingOccurrences(of: " ", with: "T")) { return formatET(d) }
        return nil
    }
}

// MARK: - Row models

/// Decodes an int/double/string game_id uniformly to a String — CFB dry-run
/// ids may arrive as strings or numbers depending on the row source.
private struct OutliersFlexibleString: Decodable, Sendable {
    let value: String
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) { value = s }
        else if let i = try? c.decode(Int.self) { value = String(i) }
        else if let d = try? c.decode(Double.self) { value = d.rounded(.towardZero) == d ? String(Int(d)) : String(d) }
        else { value = "" }
    }
}

/// Latest (season, week) anchor row from a dry-run table.
private struct OutliersDryrunAnchorRow: Decodable, Sendable {
    let season: Int?
    let week: Int?
}

/// One `nfl_dryrun_games` row projected onto the Outliers feed shape.
private struct NFLDryrunOutlierRow: Decodable, Sendable {
    let gameId: String?
    let homeTeam: String?
    let awayTeam: String?
    let kickoff: String?
    let fgSpreadClose: Double?
    let fgTotalClose: Double?
    let fgMlHomeClose: Double?
    let fgMlAwayClose: Double?

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case homeTeam = "home_team"
        case awayTeam = "away_team"
        case kickoff
        case fgSpreadClose = "fg_spread_close"
        case fgTotalClose = "fg_total_close"
        case fgMlHomeClose = "fg_ml_home_close"
        case fgMlAwayClose = "fg_ml_away_close"
    }
}

/// One `cfb_dryrun_games` row projected onto the Outliers feed shape.
private struct CFBDryrunOutlierRow: Decodable, Sendable {
    let gameId: OutliersFlexibleString
    let homeTeam: String?
    let awayTeam: String?
    let kickoff: String?
    let fgSpreadClose: Double?
    let fgTotalClose: Double?
    let fgMlHomeClose: Double?
    let fgMlAwayClose: Double?

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case homeTeam = "home_team"
        case awayTeam = "away_team"
        case kickoff
        case fgSpreadClose = "fg_spread_close"
        case fgTotalClose = "fg_total_close"
        case fgMlHomeClose = "fg_ml_home_close"
        case fgMlAwayClose = "fg_ml_away_close"
    }
}

/// Model probabilities/edges pulled from nfl_dryrun_games for hydration.
private struct NFLDryrunPredRow: Decodable, Sendable {
    let gameId: String?
    let fgHomeWinProb: Double?
    let fgHomeCoverProb: Double?
    let fgSpreadEdge: Double?
    let fgTotalEdge: Double?

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case fgHomeWinProb = "fg_home_win_prob"
        case fgHomeCoverProb = "fg_home_cover_prob"
        case fgSpreadEdge = "fg_spread_edge"
        case fgTotalEdge = "fg_total_edge"
    }
}

/// Model probabilities/edges pulled from cfb_dryrun_games for hydration.
private struct CFBDryrunPredRow: Decodable, Sendable {
    let gameId: OutliersFlexibleString
    let fgHomeWinProb: Double?
    let fgHomeCoverProb: Double?
    let fgSpreadEdge: Double?
    let fgTotalEdge: Double?

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case fgHomeWinProb = "fg_home_win_prob"
        case fgHomeCoverProb = "fg_home_cover_prob"
        case fgSpreadEdge = "fg_spread_edge"
        case fgTotalEdge = "fg_total_edge"
    }
}

private struct NBAInputRow: Decodable, Sendable {
    let gameId: Int
    let trainingKey: String?
    let uniqueId: String?
    let awayTeam: String?
    let homeTeam: String?
    let awayAbbr: String?
    let homeAbbr: String?
    let gameDate: String?
    let tipoffTimeEt: String?
    let homeSpread: Double?
    let totalLine: Double?
    let homeMoneyline: Int?
    let awayMoneyline: Int?

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case trainingKey = "training_key"
        case uniqueId = "unique_id"
        case awayTeam = "away_team"
        case homeTeam = "home_team"
        case awayAbbr = "away_abbr"
        case homeAbbr = "home_abbr"
        case gameDate = "game_date"
        case tipoffTimeEt = "tipoff_time_et"
        case homeSpread = "home_spread"
        case totalLine = "total_line"
        case homeMoneyline = "home_moneyline"
        case awayMoneyline = "away_moneyline"
    }
}

private struct NCAABInputRow: Decodable, Sendable {
    let gameId: Int
    let trainingKey: String?
    let uniqueId: String?
    let awayTeam: String?
    let homeTeam: String?
    let awayTeamId: Int?
    let homeTeamId: Int?
    let gameDateEt: String?
    let startUtc: String?
    let tipoffTimeEt: String?
    let spread: Double?
    let overUnder: Double?
    let homeMoneyline: Int?
    let awayMoneyline: Int?

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case trainingKey = "training_key"
        case uniqueId = "unique_id"
        case awayTeam = "away_team"
        case homeTeam = "home_team"
        case awayTeamId = "away_team_id"
        case homeTeamId = "home_team_id"
        case gameDateEt = "game_date_et"
        case startUtc = "start_utc"
        case tipoffTimeEt = "tipoff_time_et"
        case spread
        case overUnder = "over_under"
        case homeMoneyline = "homeMoneyline"
        case awayMoneyline = "awayMoneyline"
    }
}

private struct NCAABTeamMapping: Decodable, Sendable {
    let apiTeamId: Int
    let espnTeamId: Int?
    let teamAbbrev: String?

    enum CodingKeys: String, CodingKey {
        case apiTeamId = "api_team_id"
        case espnTeamId = "espn_team_id"
        case teamAbbrev = "team_abbrev"
    }
}

private struct PolymarketMarket: Decodable, Sendable {
    let gameKey: String
    let marketType: String
    let currentAwayOdds: Double?
    let currentHomeOdds: Double?

    enum CodingKeys: String, CodingKey {
        case gameKey = "game_key"
        case marketType = "market_type"
        case currentAwayOdds = "current_away_odds"
        case currentHomeOdds = "current_home_odds"
    }
}

private struct NBAPredictionRow: Decodable, Sendable {
    let gameId: Int
    let homeWinProb: Double?
    let modelFairTotal: Double?
    let modelFairHomeSpread: Double?
    let asOfTsUtc: String?

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case homeWinProb = "home_win_prob"
        case modelFairTotal = "model_fair_total"
        case modelFairHomeSpread = "model_fair_home_spread"
        case asOfTsUtc = "as_of_ts_utc"
    }
}

private struct NCAABPredictionRow: Decodable, Sendable {
    let gameId: Int
    let homeWinProb: Double?
    let homeAwaySpreadCoverProb: Double?
    let ouResultProb: Double?
    let predTotalPoints: Double?
    let modelFairHomeSpread: Double?
    let homeSpreadDiff: Double?
    let overLineDiff: Double?
    let vegasHomeSpread: Double?
    let vegasTotal: Double?
    let vegasHomeMoneyline: Int?
    let vegasAwayMoneyline: Int?

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case homeWinProb = "home_win_prob"
        case homeAwaySpreadCoverProb = "home_away_spread_cover_prob"
        case ouResultProb = "ou_result_prob"
        case predTotalPoints = "pred_total_points"
        case modelFairHomeSpread = "model_fair_home_spread"
        case homeSpreadDiff = "home_spread_diff"
        case overLineDiff = "over_line_diff"
        case vegasHomeSpread = "vegas_home_spread"
        case vegasTotal = "vegas_total"
        case vegasHomeMoneyline = "vegas_home_moneyline"
        case vegasAwayMoneyline = "vegas_away_moneyline"
    }
}
