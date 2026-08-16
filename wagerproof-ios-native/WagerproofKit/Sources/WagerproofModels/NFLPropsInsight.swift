import Foundation

/// One posted NFL prop signal surfaced on a matchup digest.
public struct NFLPropSignal: Identifiable, Hashable, Sendable {
    public let playerId: String
    public let playerName: String
    public let teamAbbr: String
    public let position: String?
    public let isHome: Bool?
    public let opponent: String?
    public let headshotUrl: String?
    public let market: NFLPropMarket

    public var id: String { playerId }

    public init(
        playerId: String,
        playerName: String,
        teamAbbr: String,
        position: String?,
        isHome: Bool?,
        opponent: String?,
        headshotUrl: String?,
        market: NFLPropMarket
    ) {
        self.playerId = playerId
        self.playerName = playerName
        self.teamAbbr = teamAbbr
        self.position = position
        self.isHome = isHome
        self.opponent = opponent
        self.headshotUrl = headshotUrl
        self.market = market
    }
}

/// Player-props digest for the NFL game-detail widget.
public struct NFLPropsInsightSummary: Sendable {
    public let verdict: InsightVerdict
    public let badge: InsightVerdictBadge?
    public let signals: [NFLPropSignal]
    public let totalProps: Int
    public let featuredPlayerId: String?
    public let headline: String
    public let explainer: String

    public init(
        verdict: InsightVerdict,
        badge: InsightVerdictBadge?,
        signals: [NFLPropSignal],
        totalProps: Int,
        featuredPlayerId: String?,
        headline: String,
        explainer: String
    ) {
        self.verdict = verdict
        self.badge = badge
        self.signals = signals
        self.totalProps = totalProps
        self.featuredPlayerId = featuredPlayerId
        self.headline = headline
        self.explainer = explainer
    }
}

public enum NFLPropsInsight {
    /// Nil when the matchup has no usable player markets — the widget hides.
    public static func summary(for players: [NFLPropPlayer], maxRows: Int = 5) -> NFLPropsInsightSummary? {
        let pool = players.compactMap(signal(from:))
        guard !pool.isEmpty else { return nil }

        let qualified = pool.filter { $0.market.l10Hits.n >= InsightThresholds.propSampleMin }
        // Best positive streaks first — never promote a 0/10 just because
        // it's the furthest from 50%.
        let ranked = qualified.sorted { lhs, rhs in
            if pct(lhs) != pct(rhs) { return pct(lhs) > pct(rhs) }
            return lhs.market.l10Hits.n > rhs.market.l10Hits.n
        }
        let positive = ranked.filter { pct($0) >= InsightThresholds.leaderFloor }
        let hot = ranked.filter { pct($0) >= InsightThresholds.propHot }
        let signals = Array((positive.isEmpty ? ranked : positive).prefix(maxRows))

        let featured = signals.first
        let streaks = hot.count
        let badge: InsightVerdictBadge? = streaks >= 1
            ? InsightVerdictBadge(
                text: "\(streaks) STREAK\(streaks == 1 ? "" : "S")",
                tintHex: 0x22C55E
            )
            : nil

        return NFLPropsInsightSummary(
            verdict: verdict(featured: featured, streaks: streaks),
            badge: badge,
            signals: signals,
            totalProps: pool.count,
            featuredPlayerId: featured?.playerId,
            headline: summaryHeadline(featured: featured),
            explainer: "Each percentage is the share of recent games that finished above today's posted line. Green bars finished above it; blue bars finished at or below it."
        )
    }

    /// Headline market for the digest: strongest L10 among markets that have
    /// a posted line (or anytime-TD). Falls back to `bestMarket`.
    public static func displayMarket(for player: NFLPropPlayer) -> NFLPropMarket? {
        let usable = player.markets.filter { $0.closeLine != nil || $0.isYesNo }
        let pool = usable.isEmpty ? player.markets : usable
        return pool.enumerated().max { lhs, rhs in
            let leftRate = lhs.element.l10HitRate ?? -1
            let rightRate = rhs.element.l10HitRate ?? -1
            if leftRate != rightRate { return leftRate < rightRate }
            let leftN = lhs.element.l10Hits.n
            let rightN = rhs.element.l10Hits.n
            if leftN != rightN { return leftN < rightN }
            return lhs.offset > rhs.offset
        }?.element
    }

    // MARK: - Internals

    private static func signal(from player: NFLPropPlayer) -> NFLPropSignal? {
        guard let market = displayMarket(for: player) else { return nil }
        return NFLPropSignal(
            playerId: player.playerId ?? player.playerName,
            playerName: player.playerName,
            teamAbbr: NFLTeams.abbr(for: player.team ?? ""),
            position: player.position,
            isHome: player.isHome,
            opponent: player.opponent,
            headshotUrl: player.headshotUrl,
            market: market
        )
    }

    private static func pct(_ signal: NFLPropSignal) -> Double {
        (signal.market.l10HitRate ?? 0) * 100
    }

    private static func distance(_ signal: NFLPropSignal) -> Double {
        abs(pct(signal) - 50)
    }

    private static func lastName(_ name: String) -> String {
        name.split(separator: " ").last.map(String.init) ?? name
    }

    private static func verdict(featured: NFLPropSignal?, streaks: Int) -> InsightVerdict {
        guard let featured else {
            return InsightVerdict(text: "Posted player props for this matchup", lean: .none, strength: 0)
        }
        let (hits, n) = featured.market.l10Hits
        let line = NFLPlayerProps.formatLine(featured.market.closeLine ?? featured.market.clearThreshold)
        let market = NFLPlayerProps.marketAbbr(featured.market.market)
        var text = "\(lastName(featured.playerName)) \(hits)/\(n) over \(line) \(market)"
        if streaks > 1 {
            text += " · \(streaks - 1) more streak\(streaks - 1 == 1 ? "" : "s")"
        }
        let lean: InsightVerdict.Lean = pct(featured) <= InsightThresholds.propCold ? .under : .over
        return InsightVerdict(text: text, lean: lean, strength: InsightThresholds.dots(distance(featured)))
    }

    private static func summaryHeadline(featured: NFLPropSignal?) -> String {
        guard let featured else {
            return "Posted player props for this matchup."
        }
        let (hits, n) = featured.market.l10Hits
        let market = NFLPlayerProps.marketLabel(featured.market.market).lowercased()
        if featured.market.isYesNo {
            return "\(featured.playerName) scored a TD in \(hits) of \(n) recent games, the clearest prop pattern in this matchup."
        }
        let line = NFLPlayerProps.formatLine(featured.market.closeLine)
        if pct(featured) <= InsightThresholds.propCold {
            return "\(featured.playerName) finished over the \(line) \(market) line in only \(hits) of \(n) recent games, so the recent pattern points to the Under."
        }
        return "\(featured.playerName) finished over the \(line) \(market) line in \(hits) of \(n) recent games, the clearest prop pattern in this matchup."
    }
}
