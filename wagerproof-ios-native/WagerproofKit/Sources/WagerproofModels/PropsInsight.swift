import Foundation

// Player-props digest for the MLB game sheet widget + search teaser chips.
// Pure math over `MLBPropMatchup` — see spec §1b for the slot algorithm.

public struct PropSignal: Identifiable, Sendable {
    public enum Slot: Sendable { case starterK, hotBat, coldBat, lineupFill }
    public let playerId: Int
    public let playerName: String
    public let isPitcher: Bool
    public let teamAbbr: String
    public let side: MatchupSide
    public let battingOrder: Int?
    public let headline: MLBHeadlineProp        // carries row + computed (l10, miniStrip, line)
    public let slot: Slot
    public var id: Int { playerId }

    public init(playerId: Int, playerName: String, isPitcher: Bool, teamAbbr: String,
                side: MatchupSide, battingOrder: Int?, headline: MLBHeadlineProp, slot: Slot) {
        self.playerId = playerId
        self.playerName = playerName
        self.isPitcher = isPitcher
        self.teamAbbr = teamAbbr
        self.side = side
        self.battingOrder = battingOrder
        self.headline = headline
        self.slot = slot
    }
}

public struct PropsInsightSummary: Sendable {
    public let verdict: InsightVerdict
    public let badge: InsightVerdictBadge?      // nil = no header accessory
    public let signals: [PropSignal]            // ≤ 5, slot-ordered (starters → extremes → fill)
    public let totalProps: Int                  // players with a headline (footer count)

    public init(verdict: InsightVerdict, badge: InsightVerdictBadge?, signals: [PropSignal], totalProps: Int) {
        self.verdict = verdict
        self.badge = badge
        self.signals = signals
        self.totalProps = totalProps
    }
}

public enum MLBPropsInsight {

    /// nil = no headline props at all → widget hidden.
    public static func summary(for matchup: MLBPropMatchup, maxRows: Int = 5) -> PropsInsightSummary? {
        let pool = buildPool(matchup)
        guard !pool.isEmpty else { return nil }

        // Slot 1 — starters' K-market headline, always shown (even at 50%).
        var signals: [PropSignal] = pool.filter { $0.slot == .starterK }

        // Slot 2 — extreme bats: ≥5-game sample AND ≥70 hot / ≤30 cold.
        let extremes = pool
            .filter { $0.slot == .hotBat || $0.slot == .coldBat }
            .sorted { lhs, rhs in
                let l = distance(lhs), r = distance(rhs)
                if l != r { return l > r }
                // Tiebreak: batting order asc, nil last.
                switch (lhs.battingOrder, rhs.battingOrder) {
                case let (.some(a), .some(b)): return a < b
                case (.some, .none): return true
                case (.none, .some): return false
                case (.none, .none): return lhs.playerId < rhs.playerId
                }
            }
        let extremeSlots = Array(extremes.prefix(3))
        signals.append(contentsOf: extremeSlots)

        // Slot 3 — lineup backfill (top of the order, pct desc). The only
        // place lowConfidence items may enter.
        if extremeSlots.count < 3 {
            let taken = Set(signals.map(\.playerId))
            let fills = pool
                .filter { $0.slot == .lineupFill && !taken.contains($0.playerId) }
                .filter { ($0.battingOrder ?? 99) <= 3 && ($0.battingOrder ?? 0) >= 1 }
                .sorted { pct($0) > pct($1) }
            signals.append(contentsOf: fills.prefix(3 - extremeSlots.count))
        }

        signals = Array(signals.prefix(maxRows))

        // Streak counts across the WHOLE pool, not just rendered rows.
        let hot = pool.filter { $0.slot == .hotBat }.count
        let cold = pool.filter { $0.slot == .coldBat }.count
        let streaks = hot + cold

        let verdict: InsightVerdict
        if let best = extremes.first {
            let l10 = best.headline.computed.l10
            var text = "\(lastName(best.playerName)) \(l10.fractionLabel) over "
            text += "\(MLBPlayerProps.formatLine(best.headline.computed.line)) \(marketShort(best.headline.row.market))"
            if streaks > 1 {
                text += " · \(streaks - 1) more streak\(streaks - 1 == 1 ? "" : "s")"
            }
            verdict = InsightVerdict(
                text: text,
                lean: best.slot == .hotBat ? .over : .under,
                strength: InsightThresholds.dots(distance(best))
            )
        } else {
            verdict = InsightVerdict(text: "Starter K props + top of the order", lean: .none, strength: 0)
        }

        // "NO EDGE" reads wrong over starter rows — omit the accessory instead.
        let badge: InsightVerdictBadge? = streaks >= 1
            ? InsightVerdictBadge(text: "\(streaks) STREAK\(streaks == 1 ? "" : "S")", tintHex: 0x22C55E)
            : nil

        return PropsInsightSummary(verdict: verdict, badge: badge, signals: signals, totalProps: pool.count)
    }

    public static func teaser(for matchup: MLBPropMatchup) -> InsightTeaser? {
        let pool = buildPool(matchup)
        guard !pool.isEmpty else { return nil }
        let candidates = pool.filter { $0.headline.computed.l10.games > 0 }
        guard let top = candidates.max(by: { pct($0) < pct($1) }), pct(top) >= InsightThresholds.leaderFloor else {
            return InsightTeaser(kind: .props, headline: nil, signal: .neutral, smallSample: false)
        }
        let computed = top.headline.computed
        let headline = "\(lastName(top.playerName)) \(marketShort(top.headline.row.market)) o\(MLBPlayerProps.formatLine(computed.line)) · \(Int(pct(top)))% L10"
        return InsightTeaser(
            kind: .props,
            headline: headline,
            signal: pct(top) >= InsightThresholds.propHot ? .positive : .neutral,
            smallSample: computed.l10.games < InsightThresholds.propSampleMin
        )
    }

    /// Compact market label shared by the widget rows + verdict + teaser.
    public static func marketShort(_ market: String) -> String {
        switch market {
        case "pitcher_strikeouts": return "Ks"
        case "batter_total_bases": return "TB"
        case "batter_hits": return "H"
        case "batter_home_runs": return "HR"
        case "batter_runs_scored": return "R"
        case "batter_rbis": return "RBI"
        case "batter_hits_runs_rbis": return "H+R+RBI"
        default: return MLBPlayerProps.marketLabel(market)
        }
    }

    // MARK: - Pool

    /// Every player with a headline prop, pre-classified into their slot
    /// candidacy (starterK / hotBat / coldBat / lineupFill).
    private static func buildPool(_ m: MLBPropMatchup) -> [PropSignal] {
        var out: [PropSignal] = []

        for (starter, side, abbr) in [(m.awayStarter, MatchupSide.away, m.awayAbbr),
                                      (m.homeStarter, MatchupSide.home, m.homeAbbr)] {
            let props = m.pitcherProps(for: starter.pitcherId)
            let kProps = props.filter { $0.market == "pitcher_strikeouts" }
            guard let headline = MLBPlayerProps.pickHeadlineProp(kProps.isEmpty ? props : kProps) else { continue }
            out.append(PropSignal(
                playerId: starter.pitcherId, playerName: starter.name, isPitcher: true,
                teamAbbr: abbr, side: side, battingOrder: nil, headline: headline, slot: .starterK
            ))
        }

        func appendBatter(playerId: Int, name: String, side: MatchupSide, abbr: String, order: Int?, props: [MLBPlayerPropRow]) {
            guard let headline = MLBPlayerProps.pickHeadlineProp(props) else { return }
            let l10 = headline.computed.l10
            let slot: PropSignal.Slot
            if l10.games >= InsightThresholds.propSampleMin, let p = l10.pct, Double(p) >= InsightThresholds.propHot {
                slot = .hotBat
            } else if l10.games >= InsightThresholds.propSampleMin, let p = l10.pct, Double(p) <= InsightThresholds.propCold {
                slot = .coldBat
            } else {
                slot = .lineupFill
            }
            out.append(PropSignal(
                playerId: playerId, playerName: name, isPitcher: false,
                teamAbbr: abbr, side: side, battingOrder: order, headline: headline, slot: slot
            ))
        }

        for row in m.awayLineup {
            appendBatter(playerId: row.playerId, name: row.playerName, side: .away,
                         abbr: m.awayAbbr, order: row.battingOrder, props: m.batterProps(for: row.playerId))
        }
        for row in m.homeLineup {
            appendBatter(playerId: row.playerId, name: row.playerName, side: .home,
                         abbr: m.homeAbbr, order: row.battingOrder, props: m.batterProps(for: row.playerId))
        }
        // Posted-but-unlisted batters — team side unknown, no batting order, so
        // they only ever surface through the extreme slots.
        for group in m.extraBatterGroups {
            appendBatter(playerId: group.playerId, name: group.props.first?.playerName ?? "Player",
                         side: .away, abbr: "", order: nil, props: group.props)
        }
        return out
    }

    private static func pct(_ s: PropSignal) -> Double {
        Double(s.headline.computed.l10.pct ?? 0)
    }

    private static func distance(_ s: PropSignal) -> Double {
        abs(pct(s) - 50)
    }

    private static func lastName(_ full: String) -> String {
        let suffixes: Set<String> = ["jr.", "jr", "sr.", "sr", "ii", "iii", "iv"]
        let tokens = full.split(separator: " ").map(String.init)
        guard let last = tokens.last else { return full }
        if suffixes.contains(last.lowercased()), tokens.count >= 2 {
            return tokens[tokens.count - 2]
        }
        return last
    }
}
