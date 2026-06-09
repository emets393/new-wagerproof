import Foundation

/// Canonical unit math — direct port of
/// `wagerproof-mobile/utils/unitsCalculation.ts` (~2026-03-08 hardening).
/// Matches SQL `recalculate_avatar_performance()` and the agent performance
/// service. **Do not invent variants.** When tweaks are needed, update web,
/// mobile, SQL, and this file in lockstep.
///
/// Risk model: the bettor always risks `units` (typically 1.0 for agents,
/// editor-supplied for editor picks).
///
///   Negative odds (favorite, e.g. -110):
///     Win  → +units * (100 / |odds|)
///     Loss → -units
///
///   Positive odds (underdog, e.g. +150):
///     Win  → +units * (odds / 100)
///     Loss → -units
///
///   Push / Pending → 0
public struct UnitsCalculationResult: Equatable, Sendable {
    public let unitsWon: Double
    public let unitsLost: Double
    public let netUnits: Double

    public init(unitsWon: Double, unitsLost: Double, netUnits: Double) {
        self.unitsWon = unitsWon
        self.unitsLost = unitsLost
        self.netUnits = netUnits
    }

    public static let zero = UnitsCalculationResult(unitsWon: 0, unitsLost: 0, netUnits: 0)
}

public enum UnitsCalculation {
    /// Parse American odds string (e.g. "-110", "+180"). Decimal odds rejected.
    /// Unsigned strings ("110") are treated as positive per US convention.
    public static func parseOdds(_ string: String?) -> Int? {
        guard let s = string?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty else {
            return nil
        }
        // Reject decimals (American odds are always integers).
        if s.contains(".") { return nil }
        guard let n = Int(s.hasPrefix("+") ? String(s.dropFirst()) : s),
              n != 0 else { return nil }
        return n
    }

    /// Canonical calculator. `odds` may be a string like "-110" or "+150".
    public static func calculate(
        result: PickResult?,
        odds: String?,
        units: Double?
    ) -> UnitsCalculationResult {
        guard let result, result != .pending,
              let units, units != 0, units.isFinite else {
            return .zero
        }
        if result == .push { return .zero }

        guard let oddsNum = parseOdds(odds) else { return .zero }

        switch result {
        case .won:
            if oddsNum < 0 {
                let won = units * (100.0 / Double(abs(oddsNum)))
                return UnitsCalculationResult(unitsWon: won, unitsLost: 0, netUnits: won)
            } else {
                let won = units * (Double(oddsNum) / 100.0)
                return UnitsCalculationResult(unitsWon: won, unitsLost: 0, netUnits: won)
            }
        case .lost:
            return UnitsCalculationResult(unitsWon: 0, unitsLost: units, netUnits: -units)
        default:
            return .zero
        }
    }
}
