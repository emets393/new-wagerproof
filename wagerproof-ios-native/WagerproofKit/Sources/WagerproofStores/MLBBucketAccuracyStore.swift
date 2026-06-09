import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// Loads + caches the `mlb_model_bucket_accuracy` aggregation. Mirrors
/// RN `hooks/useMLBBucketAccuracy.ts`. The web hook is React Query; the
/// Swift store uses a 5-minute stale window + 10-minute refresh tick.
@Observable
@MainActor
public final class MLBBucketAccuracyStore {
    public private(set) var data: MLBBucketAccuracy?
    public private(set) var loading: Bool = false
    public private(set) var errorMessage: String?
    public private(set) var lastFetched: Date?

    /// 5-minute stale window — matches RN `staleTime: 5 * 60 * 1000`.
    private let staleWindow: TimeInterval = 5 * 60

    public init() {}

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
            let rows: [MLBBucketAccuracyRow] = try await cfb
                .from("mlb_model_bucket_accuracy")
                .select()
                .execute()
                .value
            self.data = MLBBucketAccuracyStore.aggregate(rows: rows)
            self.lastFetched = Date()
        } catch {
            errorMessage = "Failed to load model accuracy."
        }
        loading = false
    }

    /// Aggregate raw rows the same way the web hook does. Sums games / wins
    /// / units, then computes win% (round to 1 dp) and roi%. Mirrors
    /// RN `aggregate(rows)`.
    public static func aggregate(rows: [MLBBucketAccuracyRow]) -> MLBBucketAccuracy {
        var out = MLBBucketAccuracy()
        for r in rows {
            var bt: MLBBetTypeAccuracy
            switch r.betType {
            case "full_ml": bt = out.fullMl
            case "full_ou": bt = out.fullOu
            case "f5_ml": bt = out.f5Ml
            case "f5_ou": bt = out.f5Ou
            case "perfect_storm": bt = out.perfectStorm
            default: continue
            }
            bt.overall.games += r.games
            bt.overall.wins += r.wins
            bt.overall.unitsWon += r.unitsWon
            bt.byBucket.append(.init(
                bucket: r.bucket,
                side: r.side.isEmpty ? nil : r.side,
                favDog: r.favDog.isEmpty ? nil : r.favDog,
                direction: r.direction.isEmpty ? nil : r.direction,
                games: r.games,
                wins: r.wins,
                winPct: r.winPct,
                unitsWon: r.unitsWon,
                roiPct: r.roiPct
            ))
            switch r.betType {
            case "full_ml": out.fullMl = bt
            case "full_ou": out.fullOu = bt
            case "f5_ml": out.f5Ml = bt
            case "f5_ou": out.f5Ou = bt
            case "perfect_storm": out.perfectStorm = bt
            default: break
            }
        }
        out.fullMl = MLBBucketAccuracyStore.finalize(bt: out.fullMl)
        out.fullOu = MLBBucketAccuracyStore.finalize(bt: out.fullOu)
        out.f5Ml = MLBBucketAccuracyStore.finalize(bt: out.f5Ml)
        out.f5Ou = MLBBucketAccuracyStore.finalize(bt: out.f5Ou)
        out.perfectStorm = MLBBucketAccuracyStore.finalize(bt: out.perfectStorm)
        return out
    }

    private static func finalize(bt: MLBBetTypeAccuracy) -> MLBBetTypeAccuracy {
        var copy = bt
        let g = Double(copy.overall.games)
        if g > 0 {
            copy.overall.winPct = (Double(copy.overall.wins) / g * 1000).rounded() / 10
            copy.overall.unitsWon = (copy.overall.unitsWon * 100).rounded() / 100
            copy.overall.roiPct = (copy.overall.unitsWon / g * 1000).rounded() / 10
        }
        return copy
    }
}

// MARK: - Bucket lookup helpers

public enum MLBBucketHelper {
    /// Same thresholds the web app + Python pipeline uses. Mirrors
    /// `wagerproof-mobile/utils/mlbBucketAccuracy.ts`.
    public static let mlBuckets: [(Double, String)] = [(7, "7%+"), (4, "4-6.9%"), (2, "2-3.9%"), (0, "<2%")]
    public static let ouBuckets: [(Double, String)] = [(1.5, "1.5+"), (1.0, "1.0-1.49"), (0.5, "0.5-0.99"), (0, "<0.5")]
    public static let f5MlBuckets: [(Double, String)] = [(20, "20%+"), (10, "10-19.9%"), (5, "5-9.9%"), (0, "<5%")]
    public static let f5OuBuckets: [(Double, String)] = [(1.0, "1.0+"), (0.5, "0.5-0.99"), (0, "<0.5")]

    public static func bucketLabel(edge: Double, betType: String) -> String {
        let buckets: [(Double, String)]
        switch betType {
        case "full_ml": buckets = mlBuckets
        case "full_ou": buckets = ouBuckets
        case "f5_ml": buckets = f5MlBuckets
        case "f5_ou": buckets = f5OuBuckets
        default: buckets = mlBuckets
        }
        let absEdge = abs(edge)
        let prefix = edge < 0 ? "-" : "+"
        for (threshold, label) in buckets {
            if absEdge >= threshold { return "\(prefix)\(label)" }
        }
        return "\(prefix)\(buckets.last?.1 ?? "")"
    }

    /// Look up bucket accuracy for a given pick. Mirrors RN
    /// `lookupBucketAccuracy(...)` including the `games < 3` cutoff.
    public static func lookup(
        accuracy: MLBBucketAccuracy?,
        betType: String,
        edge: Double,
        side: String? = nil,
        favDog: String? = nil,
        direction: String? = nil
    ) -> MLBBucketLookup? {
        guard let accuracy else { return nil }
        let bt = accuracy.betType(betType)
        let label = bucketLabel(edge: edge, betType: betType)
        for b in bt.byBucket {
            if b.bucket != label { continue }
            if let side, let bs = b.side, !bs.isEmpty, bs != side { continue }
            if let favDog, let bf = b.favDog, !bf.isEmpty, bf != favDog { continue }
            if let direction, let bd = b.direction, !bd.isEmpty, bd != direction { continue }
            if b.games < 3 { continue }
            return MLBBucketLookup(
                winPct: b.winPct,
                roiPct: b.roiPct,
                record: "\(b.wins)-\(b.games - b.wins)"
            )
        }
        return nil
    }
}
