import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// MLB series-position signals (G2/G3 carryover) from `mlb_game_signals`.
/// Mirrors RN `hooks/useMLBSeriesSignals.ts`: each `home_signals` /
/// `away_signals` entry is a JSON-encoded string; only entries whose parsed
/// `category == "series"` (with a message) survive.
@Observable
@MainActor
public final class MLBSeriesSignalsStore {
    public private(set) var signals: [MLBSeriesSignal] = []
    public private(set) var loading: Bool = false
    public private(set) var errorMessage: String?
    public private(set) var lastFetched: Date?

    /// 5-minute stale window — matches RN `staleTime: 5 * 60 * 1000`.
    private let staleWindow: TimeInterval = 5 * 60

    public init() {}

    private struct GameSignalsRow: Decodable {
        let gamePk: Int
        let homeTeamName: String
        let awayTeamName: String
        let homeSignals: [String]?
        let awaySignals: [String]?

        enum CodingKeys: String, CodingKey {
            case gamePk = "game_pk"
            case homeTeamName = "home_team_name"
            case awayTeamName = "away_team_name"
            case homeSignals = "home_signals"
            case awaySignals = "away_signals"
        }
    }

    public func refreshIfStale(force: Bool = false) async {
        if !force, let last = lastFetched, Date().timeIntervalSince(last) < staleWindow {
            return
        }
        await refresh()
    }

    public func refresh() async {
        loading = true
        errorMessage = nil
        do {
            let cfb = await CFBSupabase.shared.client
            let rows: [GameSignalsRow] = try await cfb
                .from("mlb_game_signals")
                .select("game_pk, home_team_name, away_team_name, home_signals, away_signals")
                .execute()
                .value
            self.signals = MLBSeriesSignalsStore.parse(rows: rows)
            self.lastFetched = Date()
        } catch {
            errorMessage = "Failed to load series signals."
        }
        loading = false
    }

    private static func parse(rows: [GameSignalsRow]) -> [MLBSeriesSignal] {
        var out: [MLBSeriesSignal] = []
        for row in rows {
            let matchup = "\(row.awayTeamName) @ \(row.homeTeamName)"
            func collect(_ raws: [String]?, side: String, team: String) {
                for raw in raws ?? [] {
                    guard let data = raw.data(using: .utf8),
                          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                          obj["category"] as? String == "series",
                          let message = obj["message"] as? String, !message.isEmpty
                    else { continue } // skip malformed entries silently, RN parity
                    let severity = (obj["severity"] as? String) == "positive" ? "positive" : "negative"
                    out.append(MLBSeriesSignal(
                        gamePk: row.gamePk,
                        matchup: matchup,
                        teamName: team,
                        teamSide: side,
                        severity: severity,
                        message: message
                    ))
                }
            }
            collect(row.homeSignals, side: "home", team: row.homeTeamName)
            collect(row.awaySignals, side: "away", team: row.awayTeamName)
        }
        return out
    }

    #if DEBUG
    public func debugSet(signals: [MLBSeriesSignal]) {
        self.signals = signals
        self.lastFetched = Date()
    }
    #endif
}
