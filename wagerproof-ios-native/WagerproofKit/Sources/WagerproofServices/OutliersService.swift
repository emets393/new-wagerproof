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
        do {
            let nflRows: [NFLInputRow] = try await cfb
                .from("v_input_values_with_epa")
                .select()
                .order("game_date", ascending: true)
                .order("game_time", ascending: true)
                .execute()
                .value

            let bettingLines: [NFLBettingLine] = (try? await cfb
                .from("nfl_betting_lines")
                .select("training_key, home_ml, away_ml, home_spread, over_line, game_time_et, home_ml_handle, away_ml_handle, home_ml_bets, away_ml_bets, ml_splits_label, home_spread_handle, away_spread_handle, home_spread_bets, away_spread_bets, spread_splits_label, over_handle, under_handle, over_bets, under_bets, total_splits_label")
                .order("as_of_ts", ascending: false)
                .execute()
                .value) ?? []

            // Keep only most-recent line per training_key, matching RN's
            // `if (!bettingLinesMap.has(line.training_key))` guard.
            var lineMap: [String: NFLBettingLine] = [:]
            for line in bettingLines where lineMap[line.trainingKey] == nil {
                lineMap[line.trainingKey] = line
            }

            for game in nflRows {
                guard let date = game.gameDate, date >= dates.today, date <= dates.weekFromNow else { continue }
                let line = lineMap[game.homeAwayUnique]
                let gameTimeValue: String? = {
                    if let t = line?.gameTimeEt { return t }
                    if let d = game.gameDate, let t = game.gameTime { return "\(d)T\(t)" }
                    return nil
                }()
                let homeSpread = line?.homeSpread ?? game.homeSpread
                let awaySpread = homeSpread.map { -$0 }
                games.append(OutlierGame(
                    gameId: game.homeAwayUnique,
                    sport: .nfl,
                    awayTeam: game.awayTeam ?? "",
                    homeTeam: game.homeTeam ?? "",
                    gameTime: gameTimeValue,
                    awaySpread: awaySpread,
                    homeSpread: homeSpread,
                    totalLine: line?.overLine ?? game.ouVegasLine,
                    awayMl: line?.awayMl,
                    homeMl: line?.homeMl
                ))
            }
        } catch {
            // Best-effort per sport — one sport's outage doesn't blank the feed.
        }

        // 2. CFB ----------------------------------------------------------
        do {
            let rows: [CFBInputRow] = try await cfb
                .from("cfb_live_weekly_inputs")
                .select()
                .execute()
                .value

            for game in rows {
                let raw = game.startDate ?? game.startTime ?? game.gameDatetime ?? game.datetime ?? game.date
                guard let raw,
                      let etDate = OutliersService.formatETDate(raw),
                      etDate >= dates.today, etDate <= dates.weekFromNow else { continue }
                let homeSpread = game.homeSpread ?? game.apiSpread
                let awaySpread = game.awaySpread ?? game.apiSpread.map { -$0 }
                games.append(OutlierGame(
                    gameId: game.trainingKey ?? "\(game.id ?? 0)",
                    sport: .cfb,
                    awayTeam: game.awayTeam ?? "",
                    homeTeam: game.homeTeam ?? "",
                    gameTime: raw,
                    awaySpread: awaySpread,
                    homeSpread: homeSpread,
                    totalLine: game.totalLine ?? game.apiOverLine,
                    awayMl: game.awayMoneyline ?? game.awayMl,
                    homeMl: game.homeMoneyline ?? game.homeMl
                ))
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
        let nflIds = games.filter { $0.sport == .nfl }.map { $0.gameId }
        if !nflIds.isEmpty {
            do {
                struct RunRow: Decodable, Sendable { let runId: Int; enum CodingKeys: String, CodingKey { case runId = "run_id" } }
                let latestRun: RunRow? = try? await cfb
                    .from("nfl_predictions_epa")
                    .select("run_id")
                    .order("run_id", ascending: false)
                    .limit(1)
                    .execute()
                    .value
                if let runId = latestRun?.runId {
                    let preds: [NFLPredictionRow] = (try? await cfb
                        .from("nfl_predictions_epa")
                        .select()
                        .eq("run_id", value: runId)
                        .in("training_key", values: nflIds)
                        .execute()
                        .value) ?? []
                    for p in preds {
                        guard let idx = indexed[p.trainingKey] else { continue }
                        let g = out[idx]
                        out[idx] = OutlierGame(
                            gameId: g.gameId, sport: g.sport,
                            awayTeam: g.awayTeam, homeTeam: g.homeTeam,
                            gameTime: g.gameTime,
                            awaySpread: g.awaySpread, homeSpread: g.homeSpread,
                            totalLine: g.totalLine, awayMl: g.awayMl, homeMl: g.homeMl,
                            awayTeamLogo: g.awayTeamLogo, homeTeamLogo: g.homeTeamLogo,
                            awayTeamAbbrev: g.awayTeamAbbrev, homeTeamAbbrev: g.homeTeamAbbrev,
                            homeAwaySpreadCoverProb: p.homeAwaySpreadCoverProb,
                            ouResultProb: p.ouResultProb,
                            homeAwayMlProb: p.homeAwayMlProb,
                            homeSpreadDiff: g.homeSpreadDiff,
                            overLineDiff: g.overLineDiff
                        )
                    }
                }
            }
        }

        // ── CFB ────────────────────────────────────────────────
        let cfbGames = games.filter { $0.sport == .cfb }
        if !cfbGames.isEmpty {
            let preds: [CFBPredictionRow] = (try? await cfb
                .from("cfb_api_predictions")
                .select()
                .execute()
                .value) ?? []
            let predMap = Dictionary(uniqueKeysWithValues: preds.compactMap { p -> (Int, CFBPredictionRow)? in
                guard let id = p.id else { return nil }
                return (id, p)
            })
            for game in cfbGames {
                guard let cfbId = Int(game.gameId), let p = predMap[cfbId], let idx = indexed[game.gameId] else { continue }
                let g = out[idx]
                out[idx] = OutlierGame(
                    gameId: g.gameId, sport: g.sport,
                    awayTeam: g.awayTeam, homeTeam: g.homeTeam,
                    gameTime: g.gameTime,
                    awaySpread: g.awaySpread, homeSpread: g.homeSpread,
                    totalLine: g.totalLine, awayMl: g.awayMl, homeMl: g.homeMl,
                    awayTeamLogo: g.awayTeamLogo, homeTeamLogo: g.homeTeamLogo,
                    awayTeamAbbrev: g.awayTeamAbbrev, homeTeamAbbrev: g.homeTeamAbbrev,
                    homeAwaySpreadCoverProb: p.homeAwaySpreadCoverProb,
                    ouResultProb: p.ouResultProb,
                    homeAwayMlProb: p.homeAwayMlProb,
                    homeSpreadDiff: p.homeSpreadDiff,
                    overLineDiff: p.overLineDiff
                )
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

private struct NFLInputRow: Decodable, Sendable {
    let homeAwayUnique: String
    let awayTeam: String?
    let homeTeam: String?
    let gameDate: String?
    let gameTime: String?
    let homeSpread: Double?
    let ouVegasLine: Double?
    let id: String?
    let uniqueId: String?

    enum CodingKeys: String, CodingKey {
        case homeAwayUnique = "home_away_unique"
        case awayTeam = "away_team"
        case homeTeam = "home_team"
        case gameDate = "game_date"
        case gameTime = "game_time"
        case homeSpread = "home_spread"
        case ouVegasLine = "ou_vegas_line"
        case id
        case uniqueId = "unique_id"
    }
}

private struct NFLBettingLine: Decodable, Sendable {
    let trainingKey: String
    let homeMl: Int?
    let awayMl: Int?
    let homeSpread: Double?
    let overLine: Double?
    let gameTimeEt: String?

    enum CodingKeys: String, CodingKey {
        case trainingKey = "training_key"
        case homeMl = "home_ml"
        case awayMl = "away_ml"
        case homeSpread = "home_spread"
        case overLine = "over_line"
        case gameTimeEt = "game_time_et"
    }
}

private struct CFBInputRow: Decodable, Sendable {
    let id: Int?
    let trainingKey: String?
    let awayTeam: String?
    let homeTeam: String?
    let startDate: String?
    let startTime: String?
    let gameDatetime: String?
    let datetime: String?
    let date: String?
    let homeSpread: Double?
    let awaySpread: Double?
    let apiSpread: Double?
    let totalLine: Double?
    let apiOverLine: Double?
    let awayMoneyline: Int?
    let homeMoneyline: Int?
    let awayMl: Int?
    let homeMl: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case trainingKey = "training_key"
        case awayTeam = "away_team"
        case homeTeam = "home_team"
        case startDate = "start_date"
        case startTime = "start_time"
        case gameDatetime = "game_datetime"
        case datetime
        case date
        case homeSpread = "home_spread"
        case awaySpread = "away_spread"
        case apiSpread = "api_spread"
        case totalLine = "total_line"
        case apiOverLine = "api_over_line"
        case awayMoneyline = "away_moneyline"
        case homeMoneyline = "home_moneyline"
        case awayMl = "away_ml"
        case homeMl = "home_ml"
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

private struct NFLPredictionRow: Decodable, Sendable {
    let trainingKey: String
    let homeAwaySpreadCoverProb: Double?
    let ouResultProb: Double?
    let homeAwayMlProb: Double?

    enum CodingKeys: String, CodingKey {
        case trainingKey = "training_key"
        case homeAwaySpreadCoverProb = "home_away_spread_cover_prob"
        case ouResultProb = "ou_result_prob"
        case homeAwayMlProb = "home_away_ml_prob"
    }
}

private struct CFBPredictionRow: Decodable, Sendable {
    let id: Int?
    let homeAwaySpreadCoverProb: Double?
    let ouResultProb: Double?
    let homeAwayMlProb: Double?
    let homeSpreadDiff: Double?
    let overLineDiff: Double?

    enum CodingKeys: String, CodingKey {
        case id
        case homeAwaySpreadCoverProb = "home_away_spread_cover_prob"
        case ouResultProb = "ou_result_prob"
        case homeAwayMlProb = "home_away_ml_prob"
        case homeSpreadDiff = "home_spread_diff"
        case overLineDiff = "over_line_diff"
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
