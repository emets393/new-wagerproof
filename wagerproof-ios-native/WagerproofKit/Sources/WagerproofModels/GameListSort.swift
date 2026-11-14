import Foundation

/// One game's signal standing for the list sort.
/// `bestRoi` is percentage points (`+43.2` → `43.2`). Nil means the game's
/// signals have a count but no ROI we can read.
public struct SignalBoardRank: Equatable, Sendable {
    public var bestRoi: Double?
    public var count: Int

    public init(bestRoi: Double?, count: Int) {
        self.bestRoi = bestRoi
        self.count = count
    }

    public static let empty = SignalBoardRank(bestRoi: nil, count: 0)
}

/// Shared list-sort maths. Each sport feeds its own edge into these helpers.
public enum GameListSort {
    public static func magnitude(_ value: Double?) -> Double? {
        guard let value, value.isFinite else { return nil }
        return abs(value)
    }

    /// Absolute model-versus-market gap, in the market's own units.
    public static func gap(_ model: Double?, _ market: Double?) -> Double? {
        guard let model, let market, model.isFinite, market.isFinite else { return nil }
        return abs(model - market)
    }

    /// Absolute size of the moneyline edge the list pill prints, in percentage points.
    /// The side with the larger model-minus-market edge is the one on the card.
    public static func moneylineValue(homeProb: Double?, homeMl: Int?, awayMl: Int?) -> Double? {
        guard let homeProb, homeProb.isFinite, homeProb > 0, homeProb < 1 else { return nil }
        let homeEdge = (homeProb - (homeMl.map(implied) ?? (1 - homeProb))) * 100
        let awayEdge = ((1 - homeProb) - (awayMl.map(implied) ?? homeProb)) * 100
        let chosen = max(homeEdge, awayEdge)
        guard chosen.isFinite else { return nil }
        return abs(chosen)
    }

    /// One signal's rating. A graded season row wins. Otherwise the season
    /// prose, then the backtest prose. Returns percentage points.
    public static func rating(
        seasonRoiFraction: Double?,
        seasonSample: Int,
        seasonText: String?,
        backtestText: String?
    ) -> Double? {
        if seasonSample > 0, let fraction = seasonRoiFraction, fraction.isFinite {
            return fraction * 100
        }
        if let season = SignalRoi.percent(in: seasonText) { return season }
        return SignalRoi.percent(in: backtestText)
    }

    public static func boardRank(count: Int, ratings: [Double?]) -> SignalBoardRank {
        SignalBoardRank(bestRoi: ratings.compactMap { $0 }.max(), count: count)
    }

    /// Higher value first. A missing number sorts after a real one.
    public static func higherFirst(_ lhs: Double?, _ rhs: Double?, tie: () -> Bool) -> Bool {
        switch (lhs, rhs) {
        case let (a?, b?) where a != b:
            return a > b
        case (_?, nil):
            return true
        case (nil, _?):
            return false
        default:
            return tie()
        }
    }

    /// Highest-rated signal first. When nothing on the board has an ROI,
    /// the signal count decides. Two games with no signals keep `tie`.
    public static func signalsFirst(
        _ lhs: SignalBoardRank,
        _ rhs: SignalBoardRank,
        anyRated: Bool,
        tie: () -> Bool
    ) -> Bool {
        if lhs.count == 0 && rhs.count == 0 { return tie() }
        if lhs.count == 0 { return false }
        if rhs.count == 0 { return true }
        if anyRated {
            switch (lhs.bestRoi, rhs.bestRoi) {
            case let (a?, b?) where a != b:
                return a > b
            case (_?, nil):
                return true
            case (nil, _?):
                return false
            default:
                break
            }
        }
        if lhs.count != rhs.count { return lhs.count > rhs.count }
        return tie()
    }

    private static func implied(_ ml: Int) -> Double {
        if ml < 0 { return Double(-ml) / Double(-ml + 100) }
        return 100.0 / Double(ml + 100)
    }
}
