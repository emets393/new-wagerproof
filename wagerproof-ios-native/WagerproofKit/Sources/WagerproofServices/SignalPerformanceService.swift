import Foundation
import Supabase
import WagerproofModels

public enum SignalSport: String, Sendable {
    case nfl, cfb
}

/// Loads season-to-date signal records from `signal_performance` (CFB Supabase).
/// Refreshed weekly server-side via `refresh_all_signal_performance(season)`.
public actor SignalPerformanceService {
    public static let shared = SignalPerformanceService()

    private var cache: [String: [String: SignalPerformance]] = [:]

    public init() {}

    /// Current football season: year, rolling over in March (matches the pipelines).
    public static func currentFootballSeason(now: Date = Date()) -> Int {
        let c = Calendar(identifier: .gregorian).dateComponents([.year, .month], from: now)
        return (c.month ?? 1) >= 3 ? (c.year ?? 2026) : (c.year ?? 2026) - 1
    }

    /// All performance rows for a sport + season, keyed by `signal_key`.
    public func performances(for sport: SignalSport, season: Int) async -> [String: SignalPerformance] {
        let cacheKey = "\(sport.rawValue)|\(season)"
        if let cached = cache[cacheKey] { return cached }

        let cfb = await CFBSupabase.shared.client
        guard let rows: [SignalPerformance] = try? await cfb
            .from("signal_performance")
            .select()
            .eq("sport", value: sport.rawValue)
            .eq("season", value: season)
            .execute()
            .value
        else {
            cache[cacheKey] = [:]
            return [:]
        }

        let indexed = Dictionary(uniqueKeysWithValues: rows.map { ($0.signalKey, $0) })
        cache[cacheKey] = indexed
        return indexed
    }
}
