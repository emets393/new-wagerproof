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
    public enum Metric: String, Sendable { case winPct, overPct, runsScored, runsAllowed }
    public let metric: Metric
    public let title: String                            // "F5 WIN %"
    public let awayValue: Double?, homeValue: Double?   // pct rows: 0...100; run rows: raw averages
    public let awayNumeral: String, homeNumeral: String
    public let awayDelta: Double?, homeDelta: Double?   // nil for winPct row
    public let awayReferenceValue: Double?, homeReferenceValue: Double?
    public let scaleMaximum: Double?
    public let goodWhenNegative: Bool
    public let advantage: MatchupSide?
    public var id: String { metric.rawValue }

    public init(metric: Metric, title: String, awayValue: Double?, homeValue: Double?,
                awayNumeral: String, homeNumeral: String, awayDelta: Double?, homeDelta: Double?,
                goodWhenNegative: Bool, advantage: MatchupSide?,
                awayReferenceValue: Double? = nil, homeReferenceValue: Double? = nil,
                scaleMaximum: Double? = nil) {
        self.metric = metric
        self.title = title
        self.awayValue = awayValue
        self.homeValue = homeValue
        self.awayNumeral = awayNumeral
        self.homeNumeral = homeNumeral
        self.awayDelta = awayDelta
        self.homeDelta = homeDelta
        self.awayReferenceValue = awayReferenceValue
        self.homeReferenceValue = homeReferenceValue
        self.scaleMaximum = scaleMaximum
        self.goodWhenNegative = goodWhenNegative
        self.advantage = advantage
    }
}

public struct F5InsightSummary: Sendable {
    public let headline: String
    public let awayAbbr: String
    public let homeAbbr: String
    public let awaySampleSize: Int?
    public let homeSampleSize: Int?
    public let verdicts: [InsightVerdict]
    public let badge: InsightVerdictBadge
    public let qualifier: String
    public let rows: [F5CompareRow]
    public let sampleWarning: String?

    public init(
        headline: String,
        awayAbbr: String,
        homeAbbr: String,
        awaySampleSize: Int?,
        homeSampleSize: Int?,
        verdicts: [InsightVerdict],
        badge: InsightVerdictBadge,
        qualifier: String,
        rows: [F5CompareRow],
        sampleWarning: String?
    ) {
        self.headline = headline
        self.awayAbbr = awayAbbr
        self.homeAbbr = homeAbbr
        self.awaySampleSize = awaySampleSize
        self.homeSampleSize = homeSampleSize
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
        let averageOverPct = overPcts.isEmpty ? nil : overPcts.reduce(0, +) / Double(overPcts.count)
        let totalDeltaSum = (awayShown?.totalDiffVsSeason ?? 0) + (homeShown?.totalDiffVsSeason ?? 0)
        let degraded = !(awayOk && homeOk)
        var ouVerdict: InsightVerdict?
        if let avgOver = averageOverPct {
            if avgOver >= InsightThresholds.ouHigh {
                var s = totalDeltaSum > 0 ? (avgOver >= 60 ? 3 : 2) : 1
                if degraded { s = min(s, 1) }   // single-sided sample caps confidence
                ouVerdict = InsightVerdict(text: "F5 OVER lean", lean: .over, strength: s)
            } else if avgOver <= InsightThresholds.ouLow {
                var s = totalDeltaSum < 0 ? (avgOver <= 40 ? 3 : 2) : 1
                if degraded { s = min(s, 1) }
                ouVerdict = InsightVerdict(text: "F5 UNDER lean", lean: .under, strength: s)
            } else if totalDeltaSum > 0 {
                // Delta-only lean: season deltas point over without over% consensus.
                ouVerdict = InsightVerdict(text: "F5 OVER lean", lean: .over, strength: 1)
            } else if totalDeltaSum < 0 {
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

        let qualifier = "Matched samples: \(game.awayAbbr) road games vs \(handDescription(game.homeSpHand)) · "
            + "\(game.homeAbbr) home games vs \(handDescription(game.awaySpHand))"

        let rows = compareRows(game: game, away: awayShown, home: homeShown)
        let warning = sampleWarning(game: game, away: away, home: home, awayOk: awayOk, homeOk: homeOk)
        let headline = summaryHeadline(
            game: game,
            away: awayShown,
            home: homeShown,
            sideVerdict: sideVerdict,
            ouVerdict: ouVerdict,
            averageOverPct: averageOverPct,
            totalDeltaSum: totalDeltaSum
        )

        return F5InsightSummary(
            headline: headline,
            awayAbbr: game.awayAbbr,
            homeAbbr: game.homeAbbr,
            awaySampleSize: away?.games,
            homeSampleSize: home?.games,
            verdicts: verdicts,
            badge: badge,
            qualifier: qualifier,
            rows: rows,
            sampleWarning: warning
        )
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
            awayNumeral: MLBF5.formatPct(away?.f5WinPct),
            homeNumeral: MLBF5.formatPct(home?.f5WinPct),
            awayDelta: nil, homeDelta: nil,
            goodWhenNegative: false, advantage: winAdvantage
        )

        // 2. F5 OVER RATE — direct evidence for the O/U verdict.
        let overAdvantage: MatchupSide? = {
            guard let a = away?.f5OverPct, let h = home?.f5OverPct, a != h else { return nil }
            return a > h ? .away : .home
        }()
        let overRow = F5CompareRow(
            metric: .overPct, title: "F5 OVER RATE",
            awayValue: away?.f5OverPct, homeValue: home?.f5OverPct,
            awayNumeral: MLBF5.formatPct(away?.f5OverPct),
            homeNumeral: MLBF5.formatPct(home?.f5OverPct),
            awayDelta: nil, homeDelta: nil,
            goodWhenNegative: false, advantage: overAdvantage
        )

        // 3. RUNS SCORED — scale includes each season baseline so the reference
        // marker always remains visible, even when the matched split is lower.
        let awayRsReference = seasonReference(value: away?.avgF5Rs, delta: away?.rsDiffVsSeason)
        let homeRsReference = seasonReference(value: home?.avgF5Rs, delta: home?.rsDiffVsSeason)
        let rsMax = [
            away?.avgF5Rs,
            home?.avgF5Rs,
            awayRsReference,
            homeRsReference
        ]
        .compactMap { $0 }
        .max() ?? 0
        let rsScaleMaximum = runScaleMaximum(rsMax)
        let rsAdvantage: MatchupSide? = {
            guard let a = away?.avgF5Rs, let h = home?.avgF5Rs, a != h else { return nil }
            return a > h ? .away : .home
        }()
        let rsRow = F5CompareRow(
            metric: .runsScored, title: "RUNS SCORED",
            awayValue: away?.avgF5Rs,
            homeValue: home?.avgF5Rs,
            awayNumeral: away?.avgF5Rs != nil ? MLBF5.formatNumber(away?.avgF5Rs, digits: 1) : "—",
            homeNumeral: home?.avgF5Rs != nil ? MLBF5.formatNumber(home?.avgF5Rs, digits: 1) : "—",
            awayDelta: away?.rsDiffVsSeason, homeDelta: home?.rsDiffVsSeason,
            goodWhenNegative: false, advantage: rsAdvantage,
            awayReferenceValue: awayRsReference,
            homeReferenceValue: homeRsReference,
            scaleMaximum: rsScaleMaximum
        )

        // 4. RUNS ALLOWED — own starter hand split; lower is better.
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
        let awayRaReference = seasonReference(value: awayRa.value, delta: awayRa.delta)
        let homeRaReference = seasonReference(value: homeRa.value, delta: homeRa.delta)
        let raMax = [
            awayRa.value,
            homeRa.value,
            awayRaReference,
            homeRaReference
        ]
        .compactMap { $0 }
        .max() ?? 0
        let raScaleMaximum = runScaleMaximum(raMax)
        let raAdvantage: MatchupSide? = {
            guard let a = awayRa.value, let h = homeRa.value, a != h else { return nil }
            return a < h ? .away : .home
        }()
        let raRow = F5CompareRow(
            metric: .runsAllowed, title: "RUNS ALLOWED",
            awayValue: awayRa.value,
            homeValue: homeRa.value,
            awayNumeral: awayRa.value != nil ? MLBF5.formatNumber(awayRa.value, digits: 1) : "—",
            homeNumeral: homeRa.value != nil ? MLBF5.formatNumber(homeRa.value, digits: 1) : "—",
            awayDelta: awayRa.delta, homeDelta: homeRa.delta,
            goodWhenNegative: true, advantage: raAdvantage,
            awayReferenceValue: awayRaReference,
            homeReferenceValue: homeRaReference,
            scaleMaximum: raScaleMaximum
        )

        return [winRow, overRow, rsRow, raRow]
    }

    private static func seasonReference(value: Double?, delta: Double?) -> Double? {
        guard let value, let delta, value.isFinite, delta.isFinite else { return nil }
        return max(0, value - delta)
    }

    private static func runScaleMaximum(_ largestValue: Double) -> Double {
        max(4, ceil(largestValue + 0.5))
    }

    // MARK: - Summary copy

    private static func summaryHeadline(
        game: MLBF5Game,
        away: MLBF5SplitRow?,
        home: MLBF5SplitRow?,
        sideVerdict: InsightVerdict?,
        ouVerdict: InsightVerdict?,
        averageOverPct: Double?,
        totalDeltaSum: Double
    ) -> String {
        let sideRead: String = {
            guard let awayPct = away?.f5WinPct, let homePct = home?.f5WinPct else {
                return "There is not enough matched data to separate the first-five side."
            }
            if let sideVerdict, sideVerdict.strength > 0,
               case .team(let leader, _) = sideVerdict.lean {
                let leaderPct = leader == game.awayAbbr ? awayPct : homePct
                let trailer = leader == game.awayAbbr ? game.homeAbbr : game.awayAbbr
                let trailerPct = leader == game.awayAbbr ? homePct : awayPct
                return "\(leader) has the stronger first-five win rate at \(MLBF5.formatPct(leaderPct)), compared with \(trailer) at \(MLBF5.formatPct(trailerPct))."
            }
            return "The first-five side is nearly even: \(game.awayAbbr) \(MLBF5.formatPct(awayPct)) and \(game.homeAbbr) \(MLBF5.formatPct(homePct))."
        }()

        let totalRead: String = {
            guard let ouVerdict else {
                return "The total indicators do not show a clear Over or Under lean."
            }
            switch ouVerdict.lean {
            case .over:
                if let averageOverPct, averageOverPct >= InsightThresholds.ouHigh {
                    return "The matched splits average \(MLBF5.formatPct(averageOverPct)) Over, creating an Over lean."
                }
                if totalDeltaSum > 0 {
                    return "First-five scoring in these splits is above season baselines, creating an Over lean."
                }
            case .under:
                if let averageOverPct, averageOverPct <= InsightThresholds.ouLow {
                    return "The matched splits average only \(MLBF5.formatPct(averageOverPct)) Over, creating an Under lean."
                }
                if totalDeltaSum < 0 {
                    return "First-five scoring in these splits is below season baselines, creating an Under lean."
                }
            default:
                break
            }
            return "The total indicators do not show a clear Over or Under lean."
        }()

        return "\(sideRead) \(totalRead)"
    }

    private static func handDescription(_ hand: MLBF5PitchHand?) -> String {
        switch hand {
        case .right: return "right-handed starters"
        case .left: return "left-handed starters"
        case nil: return "the opposing starter"
        }
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
