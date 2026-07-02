import Foundation

/// Which metric the Agents "Platform Statistics" screen is distributing. Win
/// rate is available overall AND per sport (derived from `stats_by_sport`); net
/// units only exists at the overall level in `avatar_performance_cache`, so the
/// per-sport section is win-rate only (see AgentStatsView).
public enum StatMetric: String, Sendable, CaseIterable, Hashable {
    case winRate
    case netUnits

    public var label: String {
        switch self {
        case .winRate: return "Win Rate"
        case .netUnits: return "Net Units"
        }
    }
}

/// A fitted normal (bell) curve: the sample mean + SD of a cohort's metric
/// values, in the metric's own units (win rate is 0…1, net units is signed u).
/// `isEstimated` flags a synthetic fit (the NFL placeholder — see the screen)
/// so the UI can badge it rather than present it as observed.
public struct NormalFit: Sendable, Equatable {
    public let mean: Double
    public let sd: Double
    public let count: Int
    public let isEstimated: Bool

    public init(mean: Double, sd: Double, count: Int, isEstimated: Bool = false) {
        self.mean = mean
        self.sd = sd
        self.count = count
        self.isEstimated = isEstimated
    }

    /// Standard normal probability density at `x`. Returns 0 for a degenerate
    /// fit (SD ≤ 0) so callers can safely map it across a domain.
    public func pdf(_ x: Double) -> Double {
        guard sd > 0 else { return 0 }
        let z = (x - mean) / sd
        return (1.0 / (sd * (2.0 * Double.pi).squareRoot())) * exp(-0.5 * z * z)
    }

    /// Curve height on the SAME axis as a *share* histogram (fraction of the
    /// cohort per bin): the continuous density × bin width ≈ the share expected
    /// in a bin of that width. Lets the bell curve overlay share-scaled bars.
    public func share(at x: Double, binWidth: Double) -> Double {
        pdf(x) * binWidth
    }

    /// Curve height normalized so the peak (at the mean) is 1. Used by the
    /// multi-sport overlay where only shape + spread matter, not cohort size.
    public func normalizedDensity(at x: Double) -> Double {
        guard sd > 0 else { return x == mean ? 1 : 0 }
        let z = (x - mean) / sd
        return exp(-0.5 * z * z)
    }
}

/// One histogram bar. `share` is the fraction of the cohort (0…1) that fell in
/// `[lower, upper)` — NOT a raw count. The screen never surfaces population
/// sizes, so bars and axes are expressed as share of agents.
public struct DistributionBucket: Identifiable, Sendable, Equatable {
    public let lower: Double
    public let upper: Double
    public let share: Double

    public init(lower: Double, upper: Double, share: Double) {
        self.lower = lower
        self.upper = upper
        self.share = share
    }

    public var mid: Double { (lower + upper) / 2 }
    public var id: Double { lower }
}

/// A sampled point on a fitted curve, ready to feed a Swift Charts `LineMark`.
public struct CurvePoint: Identifiable, Sendable, Equatable {
    public let x: Double
    public let y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }

    public var id: Double { x }
}

/// Pure, dependency-free distribution math shared by the stats screen and its
/// unit tests. No Foundation types beyond `Double`/`ClosedRange`.
public enum DistributionStatistics {
    /// Sample mean + SD (÷ n−1) over finite values. `nil` for an empty input.
    /// SD is 0 when there are fewer than 2 values (a single point has no spread).
    public static func fit(_ values: [Double], isEstimated: Bool = false) -> NormalFit? {
        let finite = values.filter { $0.isFinite }
        guard !finite.isEmpty else { return nil }
        let n = finite.count
        let mean = finite.reduce(0, +) / Double(n)
        let sd: Double
        if n < 2 {
            sd = 0
        } else {
            let ss = finite.reduce(0) { $0 + ($1 - mean) * ($1 - mean) }
            sd = (ss / Double(n - 1)).squareRoot()
        }
        return NormalFit(mean: mean, sd: sd, count: n, isEstimated: isEstimated)
    }

    /// Fixed-width bucketing over `domain`. Every bin in the domain is emitted
    /// (including empties) so the bars are contiguous. Values outside the domain
    /// are clamped into the edge bins so nothing is silently dropped. Heights are
    /// shares (bin count ÷ total count).
    public static func histogram(
        _ values: [Double],
        domain: ClosedRange<Double>,
        binWidth: Double
    ) -> [DistributionBucket] {
        guard binWidth > 0, domain.upperBound > domain.lowerBound else { return [] }
        let finite = values.filter { $0.isFinite }
        guard !finite.isEmpty else { return [] }

        let span = domain.upperBound - domain.lowerBound
        let binCount = max(1, Int(ceil(span / binWidth)))
        var counts = [Int](repeating: 0, count: binCount)
        for v in finite {
            var idx = Int(floor((v - domain.lowerBound) / binWidth))
            idx = min(max(idx, 0), binCount - 1)
            counts[idx] += 1
        }

        let total = Double(finite.count)
        return (0..<binCount).map { i in
            let lower = domain.lowerBound + Double(i) * binWidth
            let upper = min(lower + binWidth, domain.upperBound)
            return DistributionBucket(lower: lower, upper: upper, share: Double(counts[i]) / total)
        }
    }

    /// Smooth curve points across `domain`, scaled to a share histogram of the
    /// given bin width (so it overlays the bars). `samples` points, evenly spaced.
    public static func curvePoints(
        fit: NormalFit,
        domain: ClosedRange<Double>,
        binWidth: Double,
        samples: Int = 120
    ) -> [CurvePoint] {
        sampled(domain: domain, samples: samples) { fit.share(at: $0, binWidth: binWidth) }
    }

    /// Smooth curve points normalized so the peak is 1 — for the multi-sport
    /// overlay comparison (shape + spread, cohort-size independent).
    public static func normalizedCurvePoints(
        fit: NormalFit,
        domain: ClosedRange<Double>,
        samples: Int = 160
    ) -> [CurvePoint] {
        sampled(domain: domain, samples: samples) { fit.normalizedDensity(at: $0) }
    }

    private static func sampled(
        domain: ClosedRange<Double>,
        samples: Int,
        _ f: (Double) -> Double
    ) -> [CurvePoint] {
        guard samples > 1, domain.upperBound > domain.lowerBound else { return [] }
        let step = (domain.upperBound - domain.lowerBound) / Double(samples - 1)
        return (0..<samples).map { i in
            let x = domain.lowerBound + Double(i) * step
            return CurvePoint(x: x, y: f(x))
        }
    }
}
