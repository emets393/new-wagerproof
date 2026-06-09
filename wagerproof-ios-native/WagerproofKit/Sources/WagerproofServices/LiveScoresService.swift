import Foundation
import WagerproofModels

/// Live scores service. Mirrors `wagerproof-mobile/services/liveScoresService.ts`
/// byte-for-byte at the call-site level: same tables, same selects, same
/// pred-vs-score math for hitting badges. Two-step:
///
///   1. Fetch `live_scores` rows from the main Supabase project (auth/user data).
///   2. Fetch the latest model predictions for each league from the CFB
///      Supabase project, merge into the games, and compute `hasAnyHitting`.
///
/// Anyone calling `getLiveScores()` gets a fully-enriched `[LiveGame]` ready
/// for display. Failures in any single league's prediction fetch degrade
/// gracefully — the live scores themselves still render, just without the
/// hitting/missing badges.
public actor LiveScoresService {
    public static let shared = LiveScoresService()

    public init() {}

    /// Public entry point. Wire to `LiveScoresStore.refresh()`.
    /// Hard fails only on the `live_scores` fetch itself — prediction
    /// enrichment is best-effort to match the RN behaviour.
    public func getLiveScores() async throws -> [LiveGame] {
        let games = try await fetchLiveScores()
        return await enrichGamesWithPredictions(games)
    }

    // MARK: - Live scores fetch

    private func fetchLiveScores() async throws -> [LiveGame] {
        let client = await MainSupabase.shared.client
        let rows: [LiveScoreRow] = try await client
            .from("live_scores")
            .select()
            .eq("is_live", value: true)
            .order("league", ascending: true)
            .order("away_abbr", ascending: true)
            .execute()
            .value

        // Normalize wire row → LiveGame. RN's normalization also defaults
        // game_id to id, period defaults to empty string, etc.
        return rows.map { row in
            LiveGame(
                id: row.id,
                gameId: row.gameId ?? row.id,
                league: row.league,
                homeTeam: row.homeTeam,
                awayTeam: row.awayTeam,
                homeAbbr: row.homeAbbr,
                awayAbbr: row.awayAbbr,
                homeScore: row.homeScore,
                awayScore: row.awayScore,
                quarter: row.period ?? "",
                period: row.period ?? "",
                timeRemaining: row.timeRemaining ?? "",
                isLive: row.isLive,
                gameStatus: row.status ?? "",
                lastUpdated: row.lastUpdated ?? ISO8601DateFormatter().string(from: Date())
            )
        }
    }

    // MARK: - Prediction enrichment

    private func enrichGamesWithPredictions(_ games: [LiveGame]) async -> [LiveGame] {
        guard !games.isEmpty else { return games }

        // Fan out the four prediction fetches concurrently. Mirrors RN's
        // `Promise.all([...])`. Each fetch swallows its own errors and
        // returns [] so a single league outage doesn't blank the board.
        async let nfl = fetchNFLPredictions()
        async let cfb = fetchCFBPredictions()
        async let nba = fetchNBAPredictions()
        async let ncaab = fetchNCAABPredictions()

        let nflPredictions = await nfl
        let cfbPredictions = await cfb
        let nbaPredictions = await nba
        let ncaabPredictions = await ncaab

        return games.map { game in
            switch game.league.uppercased() {
            case "NFL":
                if let match = nflPredictions.first(where: { gamesMatch(game, $0.homeTeam, $0.awayTeam) }) {
                    return game.applying(predictions: computePredictions(game: game, prediction: .nfl(match)))
                }
            case "CFB", "NCAAF":
                if let match = cfbPredictions.first(where: { gamesMatch(game, $0.homeTeam, $0.awayTeam) }) {
                    return game.applying(predictions: computePredictions(game: game, prediction: .cfb(match)))
                }
            case "NBA":
                if let match = matchNBA(game: game, predictions: nbaPredictions) {
                    return game.applying(predictions: computePredictions(game: game, prediction: .nba(match)))
                }
            case "NCAAB":
                if let match = matchNCAAB(game: game, predictions: ncaabPredictions) {
                    return game.applying(predictions: computePredictions(game: game, prediction: .ncaab(match)))
                }
            default:
                break
            }
            return game
        }
    }

    // MARK: - NFL

    private struct NFLPrediction: Decodable, Sendable {
        let trainingKey: String
        let homeTeam: String
        let awayTeam: String
        let homeAwayMlProb: Double?
        let homeAwaySpreadCoverProb: Double?
        let ouResultProb: Double?
        var homeSpread: Double?
        var awaySpread: Double?
        var overLine: Double?

        enum CodingKeys: String, CodingKey {
            case trainingKey = "training_key"
            case homeTeam = "home_team"
            case awayTeam = "away_team"
            case homeAwayMlProb = "home_away_ml_prob"
            case homeAwaySpreadCoverProb = "home_away_spread_cover_prob"
            case ouResultProb = "ou_result_prob"
            case homeSpread = "home_spread"
            case awaySpread = "away_spread"
            case overLine = "over_line"
        }
    }

    private struct NFLRunRow: Decodable, Sendable {
        let runId: String?
        enum CodingKeys: String, CodingKey { case runId = "run_id" }
    }

    private struct NFLBettingLine: Decodable, Sendable {
        let trainingKey: String
        let homeSpread: Double?
        let awaySpread: Double?
        let overLine: Double?
        enum CodingKeys: String, CodingKey {
            case trainingKey = "training_key"
            case homeSpread = "home_spread"
            case awaySpread = "away_spread"
            case overLine = "over_line"
        }
    }

    private func fetchNFLPredictions() async -> [NFLPrediction] {
        do {
            let client = await CFBSupabase.shared.client
            let today = isoDateString(Date())

            // Find latest run_id for today onwards (mirror RN single() call)
            let runs: [NFLRunRow] = try await client
                .from("nfl_predictions_epa")
                .select("run_id")
                .gte("game_date", value: today)
                .order("run_id", ascending: false)
                .limit(1)
                .execute()
                .value
            guard let runId = runs.first?.runId else { return [] }

            var preds: [NFLPrediction] = try await client
                .from("nfl_predictions_epa")
                .select("training_key, home_team, away_team, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob")
                .gte("game_date", value: today)
                .eq("run_id", value: runId)
                .execute()
                .value

            let lines: [NFLBettingLine] = (try? await client
                .from("nfl_betting_lines")
                .select("training_key, home_spread, away_spread, over_line")
                .execute()
                .value) ?? []

            let lineByKey = Dictionary(uniqueKeysWithValues: lines.map { ($0.trainingKey, $0) })
            for i in preds.indices {
                if let line = lineByKey[preds[i].trainingKey] {
                    preds[i].homeSpread = line.homeSpread
                    preds[i].awaySpread = line.awaySpread
                    preds[i].overLine = line.overLine
                }
            }
            return preds
        } catch {
            return []
        }
    }

    // MARK: - CFB

    private struct CFBInputRow: Decodable, Sendable {
        let id: Int?
        let homeTeam: String
        let awayTeam: String
        let predMlProba: Double?
        let predSpreadProba: Double?
        let predTotalProba: Double?
        let apiSpread: Double?
        let apiOverLine: Double?
        let predHomeScore: Double?
        let predAwayScore: Double?

        enum CodingKeys: String, CodingKey {
            case id
            case homeTeam = "home_team"
            case awayTeam = "away_team"
            case predMlProba = "pred_ml_proba"
            case predSpreadProba = "pred_spread_proba"
            case predTotalProba = "pred_total_proba"
            case apiSpread = "api_spread"
            case apiOverLine = "api_over_line"
            case predHomeScore = "pred_home_score"
            case predAwayScore = "pred_away_score"
        }
    }

    private struct CFBApiPredictionRow: Decodable, Sendable {
        let id: Int?
        let homeSpreadDiff: Double?
        let overLineDiff: Double?
        let predHomeScore: Double?
        let predAwayScore: Double?

        enum CodingKeys: String, CodingKey {
            case id
            case homeSpreadDiff = "home_spread_diff"
            case overLineDiff = "over_line_diff"
            case predHomeScore = "pred_home_score"
            case predAwayScore = "pred_away_score"
        }
    }

    private struct CFBPrediction: Sendable {
        let homeTeam: String
        let awayTeam: String
        let predMlProba: Double?
        let predSpreadProba: Double?
        let predTotalProba: Double?
        let apiSpread: Double?
        let apiOverLine: Double?
        let homeSpreadDiff: Double?
        let overLineDiff: Double?
        let predHomeScore: Double?
        let predAwayScore: Double?
    }

    private func fetchCFBPredictions() async -> [CFBPrediction] {
        do {
            let client = await CFBSupabase.shared.client
            let inputs: [CFBInputRow] = try await client
                .from("cfb_live_weekly_inputs")
                .select()
                .execute()
                .value

            let apiPreds: [CFBApiPredictionRow] = (try? await client
                .from("cfb_api_predictions")
                .select()
                .execute()
                .value) ?? []

            let apiById = Dictionary(uniqueKeysWithValues: apiPreds.compactMap { row -> (Int, CFBApiPredictionRow)? in
                guard let id = row.id else { return nil }
                return (id, row)
            })

            return inputs.map { row in
                let api = row.id.flatMap { apiById[$0] }
                return CFBPrediction(
                    homeTeam: row.homeTeam,
                    awayTeam: row.awayTeam,
                    predMlProba: row.predMlProba,
                    predSpreadProba: row.predSpreadProba,
                    predTotalProba: row.predTotalProba,
                    apiSpread: row.apiSpread,
                    apiOverLine: row.apiOverLine,
                    homeSpreadDiff: api?.homeSpreadDiff,
                    overLineDiff: api?.overLineDiff,
                    predHomeScore: api?.predHomeScore ?? row.predHomeScore,
                    predAwayScore: api?.predAwayScore ?? row.predAwayScore
                )
            }
        } catch {
            return []
        }
    }

    // MARK: - NBA / NCAAB

    private struct NBARunRow: Decodable, Sendable {
        let runId: Int?
        enum CodingKeys: String, CodingKey { case runId = "run_id" }
    }

    private struct NBAPredictionRow: Decodable, Sendable {
        let gameId: Int
        let homeTeam: String
        let awayTeam: String
        let homeWinProb: Double?
        let awayWinProb: Double?
        let modelFairHomeSpread: Double?
        let modelFairTotal: Double?

        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case homeTeam = "home_team"
            case awayTeam = "away_team"
            case homeWinProb = "home_win_prob"
            case awayWinProb = "away_win_prob"
            case modelFairHomeSpread = "model_fair_home_spread"
            case modelFairTotal = "model_fair_total"
        }
    }

    private struct NBAInputRow: Decodable, Sendable {
        let gameId: Int
        let homeSpread: Double?
        let totalLine: Double?
        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case homeSpread = "home_spread"
            case totalLine = "total_line"
        }
    }

    private struct NBAPrediction: Sendable {
        let gameId: Int
        let homeTeam: String
        let awayTeam: String
        let homeWinProb: Double?
        let homeSpread: Double?
        let overLine: Double?
        let homeAwaySpreadCoverProb: Double?
        let ouResultProb: Double?
        let modelFairHomeSpread: Double?
        let predTotalPoints: Double?
    }

    private func fetchNBAPredictions() async -> [NBAPrediction] {
        do {
            let client = await CFBSupabase.shared.client
            let runs: [NBARunRow] = try await client
                .from("nba_predictions")
                .select("run_id, as_of_ts_utc")
                .order("as_of_ts_utc", ascending: false)
                .limit(1)
                .execute()
                .value
            guard let runId = runs.first?.runId else { return [] }

            let preds: [NBAPredictionRow] = try await client
                .from("nba_predictions")
                .select("game_id, home_team, away_team, home_win_prob, away_win_prob, model_fair_home_spread, model_fair_total, run_id")
                .eq("run_id", value: runId)
                .execute()
                .value

            let inputs: [NBAInputRow] = (try? await client
                .from("nba_input_values_view")
                .select("game_id, home_spread, total_line")
                .execute()
                .value) ?? []
            let inputById = Dictionary(uniqueKeysWithValues: inputs.map { ($0.gameId, $0) })

            return preds.map { pred in
                let input = inputById[pred.gameId]

                // RN's heuristic: derive spread cover prob from |modelFair vs vegas|,
                // capped at 0.85. Falls back to home_win_prob if model spread missing.
                var spreadCoverProb: Double? = nil
                if let modelSpread = pred.modelFairHomeSpread,
                   let vegasSpread = input?.homeSpread {
                    let diff = vegasSpread - modelSpread
                    if modelSpread < vegasSpread {
                        spreadCoverProb = 0.5 + min(abs(diff) * 0.05, 0.35)
                    } else {
                        spreadCoverProb = 0.5 - min(abs(diff) * 0.05, 0.35)
                    }
                } else if let homeWinProb = pred.homeWinProb {
                    spreadCoverProb = homeWinProb
                }

                var ouProb: Double? = nil
                if let modelTotal = pred.modelFairTotal,
                   let vegasTotal = input?.totalLine {
                    let diff = modelTotal - vegasTotal
                    if diff > 0 {
                        ouProb = 0.5 + min(abs(diff) * 0.02, 0.35)
                    } else {
                        ouProb = 0.5 - min(abs(diff) * 0.02, 0.35)
                    }
                }

                return NBAPrediction(
                    gameId: pred.gameId,
                    homeTeam: pred.homeTeam,
                    awayTeam: pred.awayTeam,
                    homeWinProb: pred.homeWinProb,
                    homeSpread: input?.homeSpread,
                    overLine: input?.totalLine,
                    homeAwaySpreadCoverProb: spreadCoverProb,
                    ouResultProb: ouProb,
                    modelFairHomeSpread: pred.modelFairHomeSpread,
                    predTotalPoints: pred.modelFairTotal
                )
            }
        } catch {
            return []
        }
    }

    private struct NCAABPredictionRow: Decodable, Sendable {
        let gameId: Int
        let homeTeam: String
        let awayTeam: String
        let homeWinProb: Double?
        let awayWinProb: Double?
        let vegasHomeSpread: Double?
        let vegasTotal: Double?
        let predTotalPoints: Double?
        let modelFairHomeSpread: Double?

        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case homeTeam = "home_team"
            case awayTeam = "away_team"
            case homeWinProb = "home_win_prob"
            case awayWinProb = "away_win_prob"
            case vegasHomeSpread = "vegas_home_spread"
            case vegasTotal = "vegas_total"
            case predTotalPoints = "pred_total_points"
            case modelFairHomeSpread = "model_fair_home_spread"
        }
    }

    private struct NCAABPrediction: Sendable {
        let gameId: Int
        let homeTeam: String
        let awayTeam: String
        let homeWinProb: Double?
        let vegasHomeSpread: Double?
        let vegasTotal: Double?
        let homeAwaySpreadCoverProb: Double?
        let ouResultProb: Double?
        let predTotalPoints: Double?
        let modelFairHomeSpread: Double?
    }

    private func fetchNCAABPredictions() async -> [NCAABPrediction] {
        do {
            let client = await CFBSupabase.shared.client
            let runs: [NBARunRow] = try await client
                .from("ncaab_predictions")
                .select("run_id, as_of_ts_utc")
                .order("as_of_ts_utc", ascending: false)
                .limit(1)
                .execute()
                .value
            guard let runId = runs.first?.runId else { return [] }

            let preds: [NCAABPredictionRow] = try await client
                .from("ncaab_predictions")
                .select("game_id, home_team, away_team, home_win_prob, away_win_prob, vegas_home_spread, vegas_total, pred_total_points, model_fair_home_spread, run_id")
                .eq("run_id", value: runId)
                .execute()
                .value

            return preds.map { pred in
                var ouProb: Double? = nil
                if let total = pred.predTotalPoints, let vegas = pred.vegasTotal {
                    ouProb = total > vegas ? 0.6 : 0.4
                }
                return NCAABPrediction(
                    gameId: pred.gameId,
                    homeTeam: pred.homeTeam,
                    awayTeam: pred.awayTeam,
                    homeWinProb: pred.homeWinProb,
                    vegasHomeSpread: pred.vegasHomeSpread,
                    vegasTotal: pred.vegasTotal,
                    homeAwaySpreadCoverProb: pred.homeWinProb,
                    ouResultProb: ouProb,
                    predTotalPoints: pred.predTotalPoints,
                    modelFairHomeSpread: pred.modelFairHomeSpread
                )
            }
        } catch {
            return []
        }
    }

    // MARK: - Matching helpers

    /// Fuzzy team-name match. Mirrors RN's `utils/teamMatching` `gamesMatch`:
    /// home/away sides both match if either the abbreviated or full name's
    /// first token appears in the other side's name.
    private func gamesMatch(_ game: LiveGame, _ homeTeam: String, _ awayTeam: String) -> Bool {
        let normalize: (String) -> String = { $0.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) }
        let homeA = normalize(game.homeTeam)
        let awayA = normalize(game.awayTeam)
        let homeB = normalize(homeTeam)
        let awayB = normalize(awayTeam)

        if homeA == homeB && awayA == awayB { return true }

        // Token-prefix match: split on whitespace, check first word
        // containment in either direction. Mirrors RN's loose check.
        func looseMatch(_ a: String, _ b: String) -> Bool {
            if a == b { return true }
            let aFirst = a.split(separator: " ").first.map(String.init) ?? a
            let bFirst = b.split(separator: " ").first.map(String.init) ?? b
            return a.contains(bFirst) || b.contains(aFirst)
        }
        return looseMatch(homeA, homeB) && looseMatch(awayA, awayB)
    }

    /// NBA/NCAAB games have numeric `game_id`s (e.g. "NBA-401704933"). Try
    /// numeric match first; fall back to fuzzy team-name match. Mirrors RN.
    private func matchNBA(game: LiveGame, predictions: [NBAPrediction]) -> NBAPrediction? {
        let raw = game.gameId ?? game.id
        let stripped = raw.hasPrefix("NBA-") ? String(raw.dropFirst(4)) : raw
        if let id = Int(stripped), let hit = predictions.first(where: { $0.gameId == id }) {
            return hit
        }
        return predictions.first { gamesMatch(game, $0.homeTeam, $0.awayTeam) }
    }

    private func matchNCAAB(game: LiveGame, predictions: [NCAABPrediction]) -> NCAABPrediction? {
        let raw = game.gameId ?? game.id
        let stripped = raw.hasPrefix("NCAAB-") ? String(raw.dropFirst(6)) : raw
        if let id = Int(stripped), let hit = predictions.first(where: { $0.gameId == id }) {
            return hit
        }
        return predictions.first { gamesMatch(game, $0.homeTeam, $0.awayTeam) }
    }

    // MARK: - Prediction status math
    //
    // Internal sum type so calculatePredictionStatus can route per-league.
    // Mirrors the discriminated AnyPrediction union in RN.

    private enum PredictionSource: Sendable {
        case nfl(NFLPrediction)
        case cfb(CFBPrediction)
        case nba(NBAPrediction)
        case ncaab(NCAABPrediction)
    }

    /// Direct port of RN's `calculatePredictionStatus`. Walks all three
    /// prediction types and produces a `GamePredictions` with `isHitting`
    /// computed against the current score. Returns nil if no prediction
    /// fields are populated — that signals "no model yet" to the UI.
    private func computePredictions(game: LiveGame, prediction: PredictionSource) -> GamePredictions {
        let awayScore = Double(game.awayScore)
        let homeScore = Double(game.homeScore)
        let totalScore = awayScore + homeScore
        let scoreDiff = homeScore - awayScore

        var result = GamePredictions()

        // --- ML
        var mlProb: Double? = nil
        switch prediction {
        case .nfl(let p): mlProb = p.homeAwayMlProb
        case .cfb(let p):
            if let direct = p.predMlProba {
                mlProb = direct
            } else if let predHome = p.predHomeScore, let predAway = p.predAwayScore {
                mlProb = predHome > predAway ? 0.6 : 0.4
            }
        case .nba(let p): mlProb = p.homeWinProb
        case .ncaab(let p): mlProb = p.homeWinProb
        }

        if let prob = mlProb {
            let pickedHome = prob > 0.5
            let isHitting = pickedHome ? homeScore > awayScore : awayScore > homeScore
            result.moneyline = PredictionStatus(
                predicted: pickedHome ? .home : .away,
                isHitting: isHitting,
                probability: pickedHome ? prob : (1 - prob),
                line: nil,
                currentDifferential: scoreDiff
            )
            if isHitting { result.hasAnyHitting = true }
        }

        // --- Spread
        var spreadProb: Double? = nil
        var spreadLine: Double? = nil
        switch prediction {
        case .nfl(let p):
            spreadProb = p.homeAwaySpreadCoverProb
            spreadLine = p.homeSpread
        case .cfb(let p):
            spreadProb = p.predSpreadProba
            spreadLine = p.apiSpread
            if spreadProb == nil, let diff = p.homeSpreadDiff {
                spreadProb = diff > 0 ? 0.6 : 0.4
            }
        case .nba(let p):
            spreadProb = p.homeAwaySpreadCoverProb
            spreadLine = p.homeSpread
            if spreadProb == nil, let model = p.modelFairHomeSpread, let line = p.homeSpread {
                spreadProb = (line - model) < 0 ? 0.6 : 0.4
            }
        case .ncaab(let p):
            spreadProb = p.homeAwaySpreadCoverProb
            spreadLine = p.vegasHomeSpread
            if spreadProb == nil, let model = p.modelFairHomeSpread, let line = p.vegasHomeSpread {
                spreadProb = (line - model) < 0 ? 0.6 : 0.4
            }
        }

        if let prob = spreadProb, let line = spreadLine {
            let pickedHome = prob > 0.5
            let adjustedDiff = scoreDiff + line
            let isHitting = pickedHome ? adjustedDiff > 0 : adjustedDiff < 0
            result.spread = PredictionStatus(
                predicted: pickedHome ? .home : .away,
                isHitting: isHitting,
                probability: pickedHome ? prob : (1 - prob),
                line: line,
                currentDifferential: adjustedDiff
            )
            if isHitting { result.hasAnyHitting = true }
        }

        // --- O/U
        var ouLine: Double? = nil
        var ouProb: Double? = nil
        switch prediction {
        case .nfl(let p):
            ouLine = p.overLine
            ouProb = p.ouResultProb
        case .cfb(let p):
            ouLine = p.apiOverLine
            ouProb = p.predTotalProba
            if ouProb == nil, let diff = p.overLineDiff {
                ouProb = diff > 0 ? 0.6 : 0.4
            }
        case .nba(let p):
            ouLine = p.overLine
            ouProb = p.ouResultProb
            if ouProb == nil, let total = p.predTotalPoints, let line = p.overLine {
                ouProb = total > line ? 0.6 : 0.4
            }
        case .ncaab(let p):
            ouLine = p.vegasTotal
            ouProb = p.ouResultProb
            if ouProb == nil, let total = p.predTotalPoints, let line = p.vegasTotal {
                ouProb = total > line ? 0.6 : 0.4
            }
        }

        if let prob = ouProb, let line = ouLine {
            let isOver = prob > 0.5
            let isHitting = isOver ? totalScore > line : totalScore < line
            result.overUnder = PredictionStatus(
                predicted: isOver ? .over : .under,
                isHitting: isHitting,
                probability: isOver ? prob : (1 - prob),
                line: line,
                currentDifferential: totalScore - line
            )
            if isHitting { result.hasAnyHitting = true }
        }

        return result
    }

    private func isoDateString(_ date: Date) -> String {
        let fmt = DateFormatter()
        fmt.calendar = Calendar(identifier: .gregorian)
        fmt.timeZone = TimeZone(identifier: "UTC")
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: date)
    }
}

private extension LiveGame {
    /// Returns a copy of the game with `predictions` set. Keeps LiveGame's
    /// immutability while letting the enrichment pipeline produce new values.
    func applying(predictions: GamePredictions) -> LiveGame {
        var copy = self
        copy.predictions = predictions
        return copy
    }
}
