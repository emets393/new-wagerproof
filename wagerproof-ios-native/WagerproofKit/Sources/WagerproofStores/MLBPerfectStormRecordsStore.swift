import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// Season-to-date W-L + ROI per Perfect Storm tier (hammer / ps / lean /
/// watch), aggregated client-side from `mlb_graded_picks`. Mirrors RN
/// `hooks/useMLBPerfectStormRecords.ts` — same rounding, same null win%
/// when a tier has no graded picks.
@Observable
@MainActor
public final class MLBPerfectStormRecordsStore {
    public private(set) var records: MLBPerfectStormRecords?
    public private(set) var loading: Bool = false
    public private(set) var errorMessage: String?
    public private(set) var lastFetched: Date?

    /// 10-minute stale window — matches RN `staleTime: 10 * 60 * 1000`.
    private let staleWindow: TimeInterval = 10 * 60

    public init() {}

    private struct GradedPickRow: Decodable {
        let perfectStormTier: String?
        let result: String?
        let unitsWon: Double?

        enum CodingKeys: String, CodingKey {
            case perfectStormTier = "perfect_storm_tier"
            case result
            case unitsWon = "units_won"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            perfectStormTier = try c.decodeIfPresent(String.self, forKey: .perfectStormTier)
            result = try c.decodeIfPresent(String.self, forKey: .result)
            if let d = try? c.decodeIfPresent(Double.self, forKey: .unitsWon) {
                unitsWon = d
            } else if let s = try? c.decodeIfPresent(String.self, forKey: .unitsWon) {
                unitsWon = Double(s)
            } else {
                unitsWon = nil
            }
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
            let rows: [GradedPickRow] = try await cfb
                .from("mlb_graded_picks")
                .select("perfect_storm_tier, result, units_won")
                .in("perfect_storm_tier", values: ["hammer", "ps", "lean", "watch"])
                .execute()
                .value
            self.records = MLBPerfectStormRecordsStore.aggregate(rows: rows)
            self.lastFetched = Date()
        } catch {
            errorMessage = "Failed to load Perfect Storm records."
        }
        loading = false
    }

    private static func aggregate(rows: [GradedPickRow]) -> MLBPerfectStormRecords {
        var out = MLBPerfectStormRecords()

        func apply(_ tier: MLBPerfectStormTier, _ mutate: (inout MLBPerfectStormRecord) -> Void) {
            switch tier {
            case .hammer: mutate(&out.hammer)
            case .ps: mutate(&out.ps)
            case .lean: mutate(&out.lean)
            case .watch: mutate(&out.watch)
            }
        }

        for row in rows {
            guard let raw = row.perfectStormTier, let tier = MLBPerfectStormTier(rawValue: raw) else { continue }
            apply(tier) { r in
                r.picks += 1
                switch row.result {
                case "won": r.wins += 1
                case "lost": r.losses += 1
                case "push": r.pushes += 1
                default: break
                }
                r.units += row.unitsWon ?? 0
            }
        }

        for tier in MLBPerfectStormTier.allCases {
            apply(tier) { r in
                let graded = r.wins + r.losses
                // Same rounding as RN: 1 dp on pct, 2 dp on units.
                r.winPct = graded > 0 ? (100 * Double(r.wins) / Double(graded) * 10).rounded() / 10 : nil
                r.roiPct = graded > 0 ? (100 * r.units / Double(graded) * 10).rounded() / 10 : nil
                r.units = (r.units * 100).rounded() / 100
            }
        }
        return out
    }

    #if DEBUG
    public func debugSet(records: MLBPerfectStormRecords) {
        self.records = records
        self.lastFetched = Date()
    }
    #endif
}
