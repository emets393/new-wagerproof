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
