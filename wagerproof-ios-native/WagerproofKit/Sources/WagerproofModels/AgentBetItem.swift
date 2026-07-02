import Foundation

/// One entry in a unified bet feed — a straight pick OR a parlay ticket.
/// Lets the pick-history folder, today's rail, and performance chart operate
/// on one interleaved list without caring which shape each row is.
public enum AgentBetItem: Identifiable, Hashable, Sendable {
    case pick(AgentPick)
    case parlay(AgentParlay)

    // Prefixed so a pick and a parlay can never collide in ForEach identity.
    public var id: String {
        switch self {
        case .pick(let p): return "pick_\(p.id)"
        case .parlay(let p): return "parlay_\(p.id)"
        }
    }

    /// The date used for today/history bucketing (pick: game date;
    /// parlay: target date, falling back to the earliest leg date).
    public var gameDate: String {
        switch self {
        case .pick(let p): return p.gameDate
        case .parlay(let p): return p.displayDate
        }
    }

    public var createdAt: String {
        switch self {
        case .pick(let p): return p.createdAt
        case .parlay(let p): return p.createdAt
        }
    }

    /// Ticket-level result. A parlay's per-leg results live on its legs; this
    /// is the rolled-up outcome, so W-L-P style filtering counts each parlay once.
    public var result: AgentPick.PickResultStatus {
        switch self {
        case .pick(let p): return p.result
        case .parlay(let p): return p.result
        }
    }

    /// Stake for the whole item — a parlay has ONE stake for the whole ticket.
    public var units: Double {
        switch self {
        case .pick(let p): return p.units
        case .parlay(let p): return p.units
        }
    }

    public var confidence: Int {
        switch self {
        case .pick(let p): return p.confidence
        case .parlay(let p): return p.confidence
        }
    }

    /// Sport for filter pills. Nil for a true multi-sport parlay — those only
    /// surface under "All", never under a specific sport's filter.
    public var sportForFilter: AgentSport? {
        switch self {
        case .pick(let p): return p.sport
        case .parlay(let p): return p.sport.asAgentSport
        }
    }

    /// Signed net-units effect of this settled item (0 while pending/push).
    /// Matches the server's Formula B (`recalculate_avatar_performance`):
    ///   pick   won → units × american multiplier(odds), lost → −units
    ///   parlay won → units × (settled decimal − 1), lost → −units
    /// A won parlay prefers the grader's `settled_decimal` (drop-and-reprice on
    /// pushed legs) over the pre-grade `combined_odds`; each settled parlay
    /// contributes exactly once — never per leg.
    public var netUnitsContribution: Double {
        switch self {
        case .pick(let p):
            switch p.result {
            case .won:
                // Missing odds default to a -110 payout (parity with the chart's
                // old local formula and the SQL fallback).
                return p.units * (Self.americanWinMultiplier(p.odds) ?? (100.0 / 110.0))
            case .lost: return -p.units
            case .push, .pending: return 0
            }
        case .parlay(let p):
            switch p.result {
            case .won:
                if let settled = p.settledDecimalOdds, settled > 1 {
                    return p.units * (settled - 1)
                }
                // Fallback chain matches SQL: combined_odds, then even money.
                return p.units * (Self.americanWinMultiplier(p.combinedOdds) ?? 1.0)
            case .lost: return -p.units
            case .push, .pending: return 0
            }
        }
    }

    /// Profit multiplier for a 1-unit win at the given American odds
    /// (+150 → 1.5, -200 → 0.5). Nil when the odds string doesn't parse.
    public static func americanWinMultiplier(_ odds: String?) -> Double? {
        guard let oddsStr = odds,
              let oddsInt = Int(oddsStr.replacingOccurrences(of: "+", with: "")),
              oddsInt != 0
        else { return nil }
        if oddsInt > 0 { return Double(oddsInt) / 100.0 }
        return 100.0 / Double(abs(oddsInt))
    }
}
