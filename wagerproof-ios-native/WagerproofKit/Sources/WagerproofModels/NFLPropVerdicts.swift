import Foundation

// MARK: - Formatting (ported from src/features/propBreakdown/format.ts)

public enum NFLPropFormat {
    /// `formatPerGame`: fixed decimals with a bare trailing ".0" stripped.
    public static func perGame(_ value: Double?, digits: Int = 1) -> String {
        guard let value, value.isFinite else { return "—" }
        var out = String(format: "%.\(digits)f", value)
        if out.hasSuffix(".0") { out = String(out.dropLast(2)) }
        return out
    }

    /// "0.62" → "62%".
    public static func ratePct(_ rate: Double?) -> String {
        guard let rate, rate.isFinite else { return "—" }
        return "\(Int((rate * 100).rounded()))%"
    }

    /// "62nd" ordinal percentile.
    public static func pctileOrdinal(_ pctile: Double?) -> String {
        guard let pctile, pctile.isFinite else { return "—" }
        let n = Int(pctile.rounded())
        let mod = n % 10, mod100 = n % 100
        let suffix = mod == 1 && mod100 != 11 ? "st"
            : mod == 2 && mod100 != 12 ? "nd"
            : mod == 3 && mod100 != 13 ? "rd" : "th"
        return "\(n)\(suffix)"
    }

    /// American odds with an explicit plus sign.
    public static func american(_ odds: Double?) -> String {
        guard let odds, odds.isFinite else { return "—" }
        let n = Int(odds.rounded())
        return n > 0 ? "+\(n)" : "\(n)"
    }

    public static func american(_ odds: Int?) -> String {
        american(odds.map(Double.init))
    }

    /// 0.34 → fair American odds (+194); nil outside (0, 1).
    public static func probabilityToAmerican(_ probability: Double) -> Double? {
        guard probability > 0, probability < 1 else { return nil }
        return probability >= 0.5
            ? -((probability / (1 - probability)) * 100).rounded()
            : (((1 - probability) / probability) * 100).rounded()
    }

    /// -110 → implied 0.524; nil for 0/non-finite.
    public static func americanToProbability(_ odds: Double) -> Double? {
        guard odds.isFinite, odds != 0 else { return nil }
        return odds > 0 ? 100 / (odds + 100) : abs(odds) / (abs(odds) + 100)
    }
}

// MARK: - Verdict headlines
//
// Deterministic per-widget headline sentences for the NFL prop detail —
// the NFL analog of `MLBPlayerProps.buildVerdict`. Sentences restate what
// the widget body already renders (web `ModelStrip` / `Last10Strip` /
// `ComparisonBlock` / `VsTeamCluster` / `SituationsDrawer` copy).

public enum NFLPropVerdicts {
    /// Projection sentence noun ("passing yards"), ported from `PointStrip`.
    public static func projectedNoun(_ marketKey: String, marketLabel: String) -> String {
        switch marketKey {
        case "player_reception_yds": return "receiving yards"
        case "player_receptions": return "receptions"
        case "player_rush_yds": return "rushing yards"
        case "player_pass_yds": return "passing yards"
        case "player_rush_attempts": return "rushing attempts"
        case "player_pass_attempts": return "passing attempts"
        case "player_pass_completions": return "pass completions"
        case "player_pass_tds": return "passing touchdowns"
        default: return marketLabel.lowercased()
        }
    }

    /// Number-line unit suffix ("yds"), ported from `PointStrip`.
    public static func shortUnit(_ marketKey: String) -> String {
        if marketKey.contains("yds") { return "yds" }
        if marketKey.contains("attempts") { return "att" }
        if marketKey.contains("completions") { return "cmp" }
        if marketKey.contains("receptions") { return "rec" }
        if marketKey.contains("tds") { return "TDs" }
        return ""
    }

    /// TD-verb markets ("scored" instead of "over"), per `VsTeamCluster`.
    public static func isTdVerbMarket(_ marketKey: String) -> Bool {
        marketKey.contains("anytime_td") || marketKey.contains("pass_td")
    }

    private static func deltaDigits(_ delta: Double) -> Int { abs(delta) < 1 ? 2 : 1 }

    /// WagerProof Projection headline. Nil for rookie/missing projections —
    /// the body renders "Projection coming soon" instead.
    public static func projectionHeadline(
        projection: NFLPropProjection?,
        marketKey: String,
        marketLabel: String,
        line: Double?,
        vegasOdds: Double?
    ) -> String? {
        guard let projection else { return nil }
        switch projection {
        case .point(let value, _, _):
            let noun = projectedNoun(marketKey, marketLabel: marketLabel)
            guard let line else {
                return "We project \(NFLPropFormat.perGame(value)) \(noun)."
            }
            let delta = value - line
            if delta == 0 {
                return "We project \(NFLPropFormat.perGame(value)) \(noun) — even with Vegas' \(NFLPropFormat.perGame(line)) line."
            }
            let direction = delta > 0 ? "above" : "below"
            return "We project \(NFLPropFormat.perGame(value)) \(noun) — \(NFLPropFormat.perGame(abs(delta), digits: deltaDigits(delta))) \(direction) Vegas' \(NFLPropFormat.perGame(line)) line."
        case .rate(let scoreRate, _, _):
            let pct = NFLPropFormat.perGame(scoreRate * 100, digits: 1)
            let fair = NFLPropFormat.probabilityToAmerican(scoreRate).map(NFLPropFormat.american) ?? "—"
            guard let vegasOdds, let vegasProb = NFLPropFormat.americanToProbability(vegasOdds) else {
                return "We calculate a \(pct)% chance to score — fair odds \(fair)."
            }
            let delta = scoreRate * 100 - vegasProb * 100
            let direction = delta > 0.05 ? "more likely to score than Vegas thinks"
                : delta < -0.05 ? "less likely to score than Vegas thinks"
                : "about as likely to score as Vegas thinks"
            return "We calculate a \(pct)% chance to score — fair odds \(fair) — \(direction)."
        }
    }

    /// Recent Games headline: the MLB verdict tone applied to the Last-10
    /// grading vs today's line. Nil when nothing is graded (no line).
    public static func recentGamesHeadline(hits: Int, graded: Int, isTd: Bool, hasLine: Bool) -> String? {
        guard hasLine, graded > 0 else { return nil }
        if isTd {
            let emoji = hits >= 7 ? "🔥 " : (hits >= 5 ? "📈 " : "")
            return "\(emoji)Scored in \(hits) of the last \(graded)."
        }
        if hits >= 7 { return "🔥 Cleared in \(hits) of the last \(graded)." }
        if hits >= 5 { return "📈 Hit \(hits)/\(graded) over the last \(graded)." }
        return "\(hits)/\(graded) over the last \(graded)."
    }

    /// Matchup headline: the ComparisonBlock header sentence.
    public static func matchupHeadline(opponent: String, identity: String?) -> String {
        guard let identity, !identity.isEmpty else { return "Facing \(opponent)." }
        let capped = identity.prefix(1).uppercased() + identity.dropFirst()
        return "Facing \(opponent): \(capped)."
    }

    /// Head-to-Head headline; nil below the web's gates (meetings ≥ 2, n ≥ 2).
    public static func headToHeadHeadline(
        matchup: NFLPropTrendMatchup?,
        marketKey: String,
        opponent: String
    ) -> String? {
        guard let matchup, matchup.meetings >= 2,
              let rec = matchup.byMarket[marketKey], rec.n >= 2 else { return nil }
        let verb = isTdVerbMarket(marketKey) ? "scored" : "over"
        let pct = rec.pct.map { " · \(Int(($0 * 100).rounded()))%" } ?? ""
        return "\(rec.h)/\(rec.n) \(verb) vs \(opponent)\(pct) · \(matchup.meetings) career meetings."
    }

    /// Situations headline from the overall bucket record.
    public static func situationsHeadline(overall: NFLPropSituationRecord?, marketKey: String) -> String? {
        guard let overall else { return nil }
        let action = marketKey == "player_anytime_td" ? "Scored" : "Cleared the line"
        let noun = overall.n == 1 ? "game" : "games"
        return "\(action) in \(overall.h) of \(overall.n) recent \(noun)."
    }
}
