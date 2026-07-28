import Foundation
import WagerproofModels

/// Deterministic native widget summaries. Callers pass values already resolved
/// for display; these helpers never reinterpret signed source fields.
enum GameWidgetHeadlines {
    static func projectedScore(
        segment: String = "full",
        awayName: String,
        homeName: String,
        awayScore: Double?,
        homeScore: Double?
    ) -> String? {
        guard let awayScore, let homeScore,
              awayScore.isFinite, homeScore.isFinite,
              awayScore >= 0, homeScore >= 0 else { return nil }
        let prefix = segment == "f5" ? "Through five, the model projects" : "The model projects"
        if abs(awayScore - homeScore) < 0.25 {
            return "\(prefix) a near-even game: \(awayName) \(one(awayScore)), \(homeName) \(one(homeScore))."
        }
        let homeLeads = homeScore > awayScore
        return "\(prefix) \(homeLeads ? homeName : awayName) \(one(homeLeads ? homeScore : awayScore)), \(homeLeads ? awayName : homeName) \(one(homeLeads ? awayScore : homeScore))."
    }

    static func spread(
        team: String,
        modelSpread: Double?,
        marketSpread: Double?,
        edge: Double,
        probability: Double? = nil
    ) -> String? {
        guard edge.isFinite else { return nil }
        if let modelSpread, let marketSpread, modelSpread.isFinite, marketSpread.isFinite {
            return "Model makes \(team) \(signed(modelSpread)) versus \(signed(marketSpread)) at the market — a \(one(edge))-point edge."
        }
        if let probability, probability.isFinite {
            return "Model expects \(team) to cover at \(whole(probability * 100))%."
        }
        return "Model finds a \(one(edge))-point spread edge on \(team)."
    }

    static func total(
        segment: String = "full",
        direction: String,
        modelTotal: Double?,
        marketTotal: Double?,
        probability: Double? = nil
    ) -> String {
        let scope = segment == "f5" ? "Through five" : "Full game"
        if let modelTotal, let marketTotal, modelTotal.isFinite, marketTotal.isFinite {
            return "\(scope): model projects \(one(modelTotal)) versus \(one(marketTotal)) at the market — leans \(direction)."
        }
        if let probability, probability.isFinite {
            return "\(scope): model leans \(direction) at \(whole(probability * 100))%."
        }
        return "\(scope): model leans \(direction)."
    }

    static func moneyline(
        segment: String,
        pickAbbr: String,
        pickProbability: Double,
        impliedProbability: Double?,
        pickEdgePct: Double?
    ) -> String? {
        guard pickProbability.isFinite else { return nil }
        let scope = segment == "f5" ? "Through five" : "Full game"
        let modelPct = pickProbability * 100
        guard let edge = pickEdgePct, edge.isFinite else {
            return "\(scope): model leans \(pickAbbr) at \(one(modelPct))%."
        }
        if edge <= 0 {
            return "\(scope): no moneyline value on \(pickAbbr); the model does not beat the market price."
        }
        if modelPct < 50, let impliedProbability, impliedProbability.isFinite {
            return "\(scope): \(pickAbbr) is not the outright favorite, but the model's \(one(modelPct))% beats the market's \(one(impliedProbability * 100))% by \(one(edge)) points."
        }
        return "\(scope): model backs \(pickAbbr) at \(one(modelPct))%, a +\(one(edge))-point edge over the market."
    }

    static func injuries(
        awayAbbr: String,
        homeAbbr: String,
        awayImpact: Double,
        homeImpact: Double,
        count: Int
    ) -> String {
        guard count > 0 else { return "No injuries are currently reported for this matchup." }
        if abs(awayImpact - homeImpact) < 0.001 {
            return "\(count) reported injuries, with no clear impact advantage."
        }
        let healthier = awayImpact > homeImpact ? awayAbbr : homeAbbr
        return "\(count) reported injuries; the current impact scores favor \(healthier)."
    }

    static func teamStats(
        awayAbbr: String,
        homeAbbr: String,
        awayOffense: Double?,
        homeOffense: Double?
    ) -> String? {
        guard let awayOffense, let homeOffense,
              awayOffense.isFinite, homeOffense.isFinite else { return nil }
        if abs(awayOffense - homeOffense) < 0.05 {
            return "\(awayAbbr) and \(homeAbbr) are nearly even in adjusted offense."
        }
        let leader = awayOffense > homeOffense ? awayAbbr : homeAbbr
        return "\(leader) owns the stronger adjusted offense entering this matchup."
    }

    static func marketOdds() -> String {
        "Live public-market probabilities and movement for this matchup."
    }

    static func modelAccuracy() -> String {
        "How this model has performed on comparable predictions."
    }

    static func recentTrends(
        awayAbbr: String,
        homeAbbr: String,
        trends: NBAGameTrends?
    ) -> String? {
        guard let trends else { return nil }
        var findings: [String] = []

        if let away = trends.awayOvrRtg, let home = trends.homeOvrRtg,
           away.isFinite, home.isFinite {
            if abs(away - home) < 0.01 {
                findings.append("\(awayAbbr) and \(homeAbbr) are even in overall rating")
            } else {
                let leader = away > home ? awayAbbr : homeAbbr
                findings.append("\(leader) has the stronger recent overall rating")
            }
        }

        if let away = trends.awayAtsPct, let home = trends.homeAtsPct,
           away.isFinite, home.isFinite {
            findings.append("\(awayAbbr) has covered \(whole(away * 100))% versus \(whole(home * 100))% for \(homeAbbr)")
        }

        guard !findings.isEmpty else { return nil }
        return findings.joined(separator: "; ") + "."
    }

    static func regressionPicks(_ picks: [MLBSuggestedPick]) -> String? {
        guard let primary = picks.first else { return nil }
        let prefix = picks.count == 1
            ? "The regression report flags \(primary.pick)"
            : "\(picks.count) regression picks are available, led by \(primary.pick)"
        let market = regressionMarket(primary.betType)
        guard primary.bucketSample > 0 else {
            return "\(prefix) in the \(market) market."
        }
        return "\(prefix) in the \(market) market; its \(regressionBucket(primary.edgeBucket)) edge bucket has won \(whole(primary.bucketWinPct))% across \(primary.bucketSample) picks."
    }

    static func gameSignals(_ signals: [MLBSignalItem]) -> String? {
        guard !signals.isEmpty else { return nil }
        let overCount = signals.filter { $0.severity.lowercased() == "over" }.count
        let underCount = signals.filter { $0.severity.lowercased() == "under" }.count

        var categoryCounts: [String: Int] = [:]
        var categoryOrder: [String] = []
        for signal in signals {
            let category = signal.category
                .replacingOccurrences(of: "_", with: " ")
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            guard !category.isEmpty else { continue }
            if categoryCounts[category] == nil { categoryOrder.append(category) }
            categoryCounts[category, default: 0] += 1
        }
        let topCategories = categoryOrder
            .sorted {
                let left = categoryCounts[$0, default: 0]
                let right = categoryCounts[$1, default: 0]
                return left == right
                    ? categoryOrder.firstIndex(of: $0)! < categoryOrder.firstIndex(of: $1)!
                    : left > right
            }
            .prefix(2)

        var detail: [String] = []
        if !topCategories.isEmpty {
            detail.append("\(topCategories.joined(separator: " and ")) context")
        }
        if overCount > 0, underCount == 0 {
            detail.append("\(overCount) tagged OVER")
        } else if underCount > 0, overCount == 0 {
            detail.append("\(underCount) tagged UNDER")
        }

        let noun = signals.count == 1 ? "situational signal" : "situational signals"
        guard !detail.isEmpty else {
            return "\(signals.count) \(noun) flagged beyond the model's projections."
        }
        return "\(signals.count) \(noun) flagged — \(detail.joined(separator: ", "))."
    }

    static func one(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(1)))
    }

    private static func whole(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0)))
    }

    private static func signed(_ value: Double) -> String {
        value.formatted(.number.sign(strategy: .always()).precision(.fractionLength(1)))
    }

    private static func regressionMarket(_ betType: String) -> String {
        switch betType {
        case "full_ml": return "full-game moneyline"
        case "full_ou": return "full-game total"
        case "f5_ml": return "first-five moneyline"
        case "f5_ou": return "first-five total"
        default: return betType.replacingOccurrences(of: "_", with: " ")
        }
    }

    private static func regressionBucket(_ bucket: String) -> String {
        bucket.replacingOccurrences(of: "_", with: " ")
    }
}
