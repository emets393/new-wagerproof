import Foundation

// First-5-innings digest for the MLB game sheet widget + search teaser chips.
// Pure math over `MLBF5Matchup` — see spec §1c. The away team is judged by its
// AWAY games vs tonight's opposing starter hand; the home team by HOME games.

public struct MLBF5Matchup: Identifiable, Sendable {
    public let game: MLBF5Game
    public let awaySplit: MLBF5SplitRow?
    public let homeSplit: MLBF5SplitRow?
    public var id: Int { game.gamePk }

    public init(game: MLBF5Game, awaySplit: MLBF5SplitRow?, homeSplit: MLBF5SplitRow?) {
        self.game = game
        self.awaySplit = awaySplit
        self.homeSplit = homeSplit
    }
}

public struct F5CompareRow: Identifiable, Sendable {
    public enum Metric: String, Sendable { case winPct, runsScored, runsAllowed }
    public let metric: Metric
    public let title: String                            // "F5 WIN %"
    public let awayValue: Double?, homeValue: Double?   // normalized bar inputs
    public let awayNumeral: String, homeNumeral: String
    public let awayDelta: Double?, homeDelta: Double?   // nil for winPct row
    public let goodWhenNegative: Bool
    public let advantage: MatchupSide?
    public var id: String { metric.rawValue }

    public init(metric: Metric, title: String, awayValue: Double?, homeValue: Double?,
                awayNumeral: String, homeNumeral: String, awayDelta: Double?, homeDelta: Double?,
                goodWhenNegative: Bool, advantage: MatchupSide?) {
        self.metric = metric
        self.title = title
        self.awayValue = awayValue
        self.homeValue = homeValue
        self.awayNumeral = awayNumeral
        self.homeNumeral = homeNumeral
        self.awayDelta = awayDelta
        self.homeDelta = homeDelta
        self.goodWhenNegative = goodWhenNegative
        self.advantage = advantage
    }
}

public struct F5InsightSummary: Sendable {
    public let verdicts: [InsightVerdict]
    public let badge: InsightVerdictBadge
    public let qualifier: String
    public let rows: [F5CompareRow]                     // exactly the 3 rows of §1c
    public let sampleWarning: String?

    public init(verdicts: [InsightVerdict], badge: InsightVerdictBadge, qualifier: String,
                rows: [F5CompareRow], sampleWarning: String?) {
        self.verdicts = verdicts
        self.badge = badge
        self.qualifier = qualifier
        self.rows = rows
        self.sampleWarning = sampleWarning
    }
}

public enum MLBF5Insight {

    /// nil → widget hidden (no split clears the 2-game showable floor).
    public static func summary(for matchup: MLBF5Matchup) -> F5InsightSummary? {
        let game = matchup.game
        let away = matchup.awaySplit
        let home = matchup.homeSplit
        let awayOk = MLBF5.isShowable(away?.games)
        let homeOk = MLBF5.isShowable(home?.games)
        guard awayOk || homeOk else { return nil }

        let awayShown = awayOk ? away : nil
        let homeShown = homeOk ? home : nil

        var verdicts: [InsightVerdict] = []

        // Side verdict — suppressed entirely when either side lacks a sample.
        var sideVerdict: InsightVerdict?
        if let a = awayShown?.f5WinPct, let h = homeShown?.f5WinPct {
            let gap = a - h
            let leaderIsAway = gap > 0
            let abbr = leaderIsAway ? game.awayAbbr : game.homeAbbr
            let leader = leaderIsAway ? awayShown : homeShown
            let record = leader?.f5Record ?? "-"
            var strength: Int
            let text: String
            switch abs(gap) {
            case InsightThresholds.f5Own...:
                text = "\(abbr) owns the F5 (\(record))"; strength = 3
            case InsightThresholds.f5Edge...:
                text = "\(abbr) has the F5 edge (\(record))"; strength = 2
            case InsightThresholds.f5Slight...:
                text = "Slight F5 lean \(abbr)"; strength = 1
            default:
                text = "Even F5 matchup"; strength = 0
            }
            // Thin leader sample (under 10 games) downgrades confidence a dot.
            if strength > 0, (leader?.games ?? 0) < MLBF5.Sample.small {
                strength = max(1, strength - 1)
            }
            sideVerdict = InsightVerdict(
                text: text,
                lean: strength > 0 ? .team(abbr: abbr, side: leaderIsAway ? .away : .home) : .none,
                strength: strength
            )
            verdicts.append(sideVerdict!)
        }

        // O/U verdict — two conditions (over% consensus + season delta): both met
        // → s2/s3, exactly one met → s1, neither → omitted (spec §1c).
        let overPcts = [awayShown?.f5OverPct, homeShown?.f5OverPct].compactMap { $0 }
        let degraded = !(awayOk && homeOk)
        if !overPcts.isEmpty {
            let avgOver = overPcts.reduce(0, +) / Double(overPcts.count)
            let deltaSum = (awayShown?.totalDiffVsSeason ?? 0) + (homeShown?.totalDiffVsSeason ?? 0)
            var ouVerdict: InsightVerdict?
            if avgOver >= InsightThresholds.ouHigh {
                var s = deltaSum > 0 ? (avgOver >= 60 ? 3 : 2) : 1
                if degraded { s = min(s, 1) }   // single-sided sample caps confidence
                ouVerdict = InsightVerdict(text: "F5 OVER lean", lean: .over, strength: s)
            } else if avgOver <= InsightThresholds.ouLow {
                var s = deltaSum < 0 ? (avgOver <= 40 ? 3 : 2) : 1
                if degraded { s = min(s, 1) }
                ouVerdict = InsightVerdict(text: "F5 UNDER lean", lean: .under, strength: s)
            } else if deltaSum > 0 {
                // Delta-only lean: season deltas point over without over% consensus.
                ouVerdict = InsightVerdict(text: "F5 OVER lean", lean: .over, strength: 1)
            } else if deltaSum < 0 {
                ouVerdict = InsightVerdict(text: "F5 UNDER lean", lean: .under, strength: 1)
            }
            if let ouVerdict { verdicts.append(ouVerdict) }
        }

        if verdicts.isEmpty {
            verdicts.append(InsightVerdict(text: "Even F5 matchup", lean: .none, strength: 0))
        }

        // Badge — side edge wins, then O/U lean, else EVEN.
        let badge: InsightVerdictBadge
        if let sideVerdict, sideVerdict.strength > 0, case .team(let abbr, _) = sideVerdict.lean {
            badge = InsightVerdictBadge(text: "\(abbr) EDGE", tintHex: 0x22C55E)
        } else if let ou = verdicts.first(where: { $0.lean == .over || $0.lean == .under }) {
            badge = ou.lean == .over
                ? InsightVerdictBadge(text: "F5 OVER LEAN", tintHex: 0x22C55E)
                : InsightVerdictBadge(text: "F5 UNDER LEAN", tintHex: 0x3B82F6)
        } else {
            badge = InsightVerdictBadge(text: "EVEN", tintHex: 0x9CA3AF)
        }

        let qualifier = "\(game.awayAbbr) away vs \(MLBF5.pitchHandLabel(game.homeSpHand)) · "
            + "\(game.homeAbbr) home vs \(MLBF5.pitchHandLabel(game.awaySpHand))"

        let rows = compareRows(game: game, away: awayShown, home: homeShown)
        let warning = sampleWarning(game: game, away: away, home: home, awayOk: awayOk, homeOk: homeOk)

        return F5InsightSummary(verdicts: verdicts, badge: badge, qualifier: qualifier,
                                rows: rows, sampleWarning: warning)
    }

    public static func teaser(for matchup: MLBF5Matchup, matchedAbbr: String?) -> InsightTeaser? {
        struct Candidate {
            let abbr: String
            let delta: Double
            let phrase: String
            let positive: Bool
            let games: Int
        }
        var candidates: [Candidate] = []

        func collect(split: MLBF5SplitRow?, abbr: String, ownHand: MLBF5PitchHand?, oppHand: MLBF5PitchHand?) {
            guard let split, MLBF5.isShowable(split.games) else { return }
            let hand = MLBF5.pitchHandLabel(oppHand)
            if let rs = split.rsDiffVsSeason {
                candidates.append(Candidate(abbr: abbr, delta: rs,
                                            phrase: "F5 runs vs \(hand)", positive: rs > 0, games: split.games))
            }
            if let total = split.totalDiffVsSeason {
                candidates.append(Candidate(abbr: abbr, delta: total,
                                            phrase: "F5 total vs \(hand)", positive: total > 0, games: split.games))
            }
            let ownRa = ownHand == .left ? split.raDiffVsSeasonWhenOwnLhp : split.raDiffVsSeasonWhenOwnRhp
            let ownGames = ownHand == .left ? split.gamesWithOwnLhp : split.gamesWithOwnRhp
            if let ra = ownRa, ownGames > 0 {
                candidates.append(Candidate(abbr: abbr, delta: ra,
                                            phrase: "F5 runs allowed", positive: ra < 0, games: ownGames))
            }
        }

        let game = matchup.game
        if matchedAbbr == nil || matchedAbbr?.caseInsensitiveCompare(game.awayAbbr) == .orderedSame {
            collect(split: matchup.awaySplit, abbr: game.awayAbbr, ownHand: game.awaySpHand, oppHand: game.homeSpHand)
        }
        if matchedAbbr == nil || matchedAbbr?.caseInsensitiveCompare(game.homeAbbr) == .orderedSame {
            collect(split: matchup.homeSplit, abbr: game.homeAbbr, ownHand: game.homeSpHand, oppHand: game.awaySpHand)
        }

        guard let best = candidates.max(by: { abs($0.delta) < abs($1.delta) }),
              abs(best.delta) >= InsightThresholds.f5DeltaMin else {
            return InsightTeaser(kind: .f5, headline: nil, signal: .neutral, smallSample: false)
        }
        let headline = "\(best.abbr) \(MLBF5.formatDiff(best.delta, digits: 1)) \(best.phrase)"
        return InsightTeaser(
            kind: .f5,
            headline: headline,
            signal: best.positive ? .positive : .negative,
            smallSample: best.games < MLBF5.Sample.small
        )
    }

    // MARK: - Rows

    private static func compareRows(game: MLBF5Game, away: MLBF5SplitRow?, home: MLBF5SplitRow?) -> [F5CompareRow] {
        // 1. F5 WIN %
        let winAdvantage: MatchupSide? = {
            guard let a = away?.f5WinPct, let h = home?.f5WinPct, a != h else { return nil }
            return a > h ? .away : .home
        }()
        let winRow = F5CompareRow(
            metric: .winPct, title: "F5 WIN %",
            awayValue: away?.f5WinPct, homeValue: home?.f5WinPct,
            awayNumeral: away != nil ? MLBF5.recordWithPct(away) : "—",
            homeNumeral: home != nil ? MLBF5.recordWithPct(home) : "—",
            awayDelta: nil, homeDelta: nil,
            goodWhenNegative: false, advantage: winAdvantage
        )

        // 2. RUNS SCORED — normalized so the longer half maxes at ~83% of track.
        let rsMax = max(away?.avgF5Rs ?? 0, home?.avgF5Rs ?? 0)
        let rsScale = rsMax > 0 ? rsMax * 1.2 : 1
        let rsAdvantage: MatchupSide? = {
            guard let a = away?.avgF5Rs, let h = home?.avgF5Rs, a != h else { return nil }
            return a > h ? .away : .home
        }()
        let rsRow = F5CompareRow(
            metric: .runsScored, title: "RUNS SCORED",
            awayValue: (away?.avgF5Rs).map { $0 / rsScale },
            homeValue: (home?.avgF5Rs).map { $0 / rsScale },
            awayNumeral: away?.avgF5Rs != nil ? MLBF5.formatNumber(away?.avgF5Rs, digits: 1) : "—",
            homeNumeral: home?.avgF5Rs != nil ? MLBF5.formatNumber(home?.avgF5Rs, digits: 1) : "—",
            awayDelta: away?.rsDiffVsSeason, homeDelta: home?.rsDiffVsSeason,
            goodWhenNegative: false, advantage: rsAdvantage
        )

        // 3. RUNS ALLOWED — own starter hand split; lower is better.
        func ownRa(_ split: MLBF5SplitRow?, hand: MLBF5PitchHand?) -> (value: Double?, delta: Double?, games: Int) {
            guard let split, let hand else { return (nil, nil, 0) }
            let games = hand == .left ? split.gamesWithOwnLhp : split.gamesWithOwnRhp
            guard games > 0 else { return (nil, nil, 0) }
            let value = hand == .left ? split.avgF5RaWhenOwnLhp : split.avgF5RaWhenOwnRhp
            let delta = hand == .left ? split.raDiffVsSeasonWhenOwnLhp : split.raDiffVsSeasonWhenOwnRhp
            return (value, delta, games)
        }
        let awayRa = ownRa(away, hand: game.awaySpHand)
        let homeRa = ownRa(home, hand: game.homeSpHand)
        let raMax = max(awayRa.value ?? 0, homeRa.value ?? 0)
        let raScale = raMax > 0 ? raMax * 1.2 : 1
        let raAdvantage: MatchupSide? = {
            guard let a = awayRa.value, let h = homeRa.value, a != h else { return nil }
            return a < h ? .away : .home
        }()
        let raRow = F5CompareRow(
            metric: .runsAllowed, title: "RUNS ALLOWED",
            awayValue: awayRa.value.map { $0 / raScale },
            homeValue: homeRa.value.map { $0 / raScale },
            awayNumeral: awayRa.value != nil ? MLBF5.formatNumber(awayRa.value, digits: 1) : "—",
            homeNumeral: homeRa.value != nil ? MLBF5.formatNumber(homeRa.value, digits: 1) : "—",
            awayDelta: awayRa.delta, homeDelta: homeRa.delta,
            goodWhenNegative: true, advantage: raAdvantage
        )

        return [winRow, rsRow, raRow]
    }

    private static func sampleWarning(game: MLBF5Game, away: MLBF5SplitRow?, home: MLBF5SplitRow?,
                                      awayOk: Bool, homeOk: Bool) -> String? {
        var parts: [String] = []
        if !awayOk {
            parts.append("Not enough \(game.awayAbbr) games in this split (\(away?.games ?? 0))")
        } else if let a = away, a.games < MLBF5.Sample.small {
            parts.append("\(game.awayAbbr): only \(a.games) away games vs \(MLBF5.pitchHandLabel(game.homeSpHand))")
        }
        if !homeOk {
            parts.append("Not enough \(game.homeAbbr) games in this split (\(home?.games ?? 0))")
        } else if let h = home, h.games < MLBF5.Sample.small {
            parts.append("\(game.homeAbbr): only \(h.games) home games vs \(MLBF5.pitchHandLabel(game.awaySpHand))")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}
