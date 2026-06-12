import Foundation

// MARK: - Trends signal payload

/// One ranked situational signal for the matchup-insight trends widget.
/// Produced by the per-sport `*TrendsInsight.summary` adapters below; the
/// widget renders `signals.prefix(3)` as `InsightSignalRow`s.
public struct TrendsSignal: Identifiable, Sendable {
    public enum Kind: Sendable {
        case side(leader: MatchupSide, abbr: String, gap: Double)
        case over(floor: Double), under(ceiling: Double)
    }

    public let id: String               // "{situationKey}-{metric}"
    public let situationTitle: String   // via formatMLBSituation / formatNBASituation
    public let metricLabel: String      // "Win%" | "Over%" | "ATS" | "O/U"
    public let kind: Kind
    public let awayPct: Double?, homePct: Double?
    public let awayDetail: String?, homeDetail: String?   // record strings NBA/NCAAB, nil MLB
    public let strength: Double

    public init(id: String, situationTitle: String, metricLabel: String, kind: Kind,
                awayPct: Double?, homePct: Double?, awayDetail: String?, homeDetail: String?, strength: Double) {
        self.id = id
        self.situationTitle = situationTitle
        self.metricLabel = metricLabel
        self.kind = kind
        self.awayPct = awayPct
        self.homePct = homePct
        self.awayDetail = awayDetail
        self.homeDetail = homeDetail
        self.strength = strength
    }
}

public struct TrendsInsightSummary: Sendable {
    public let verdicts: [InsightVerdict]       // 1–2
    public let badge: InsightVerdictBadge
    public let signals: [TrendsSignal]          // ALL fired, sorted desc; widget takes prefix(3)
    public let eligibleSidePairs: Int
    public let totalSituations: Int             // 7 MLB, 5 NBA/NCAAB

    public init(verdicts: [InsightVerdict], badge: InsightVerdictBadge,
                signals: [TrendsSignal], eligibleSidePairs: Int, totalSituations: Int) {
        self.verdicts = verdicts
        self.badge = badge
        self.signals = signals
        self.eligibleSidePairs = eligibleSidePairs
        self.totalSituations = totalSituations
    }
}

// MARK: - Shared engine

/// Sport-agnostic signal/verdict math. Each sport builds `Pair` inputs from
/// its trend rows; the engine owns every threshold so MLB/NBA/NCAAB cannot
/// drift (see InsightThresholds in MatchupInsightCore.swift).
private enum TrendsInsightEngine {
    struct Pair {
        let key: String
        let sideMetricLabel: String
        let ouMetricLabel: String
        let awayLabel: String       // formatted situation labels
        let homeLabel: String
        let awayTag: String?        // raw situation tags (teaser phrasing)
        let homeTag: String?
        let awaySidePct: Double?
        let homeSidePct: Double?
        let awaySideDetail: String?
        let homeSideDetail: String?
        let sideMinGames: Int?      // min(away, home) sample; nil = no gate (MLB)
        let awayOuPct: Double?
        let homeOuPct: Double?
        let awayOuDetail: String?
        let homeOuDetail: String?
        let ouMinGames: Int?

        var sideSampleOK: Bool {
            sideMinGames.map { $0 >= InsightThresholds.minGamesBasketball } ?? true
        }
        var ouSampleOK: Bool {
            ouMinGames.map { $0 >= InsightThresholds.minGamesBasketball } ?? true
        }
    }

    /// Raw situation tags carried alongside each fired signal so the MLB
    /// teaser can phrase headlines without re-deriving the pair.
    struct Meta {
        let awayTag: String?
        let homeTag: String?
        let leaderTag: String?
    }

    struct Output {
        let summary: TrendsInsightSummary
        let metas: [(signal: TrendsSignal, meta: Meta)]   // same order as summary.signals
    }

    static func compute(pairs: [Pair], awayAbbr: String, homeAbbr: String, basketball: Bool) -> Output {
        var fired: [(signal: TrendsSignal, meta: Meta)] = []
        var eligibleSidePairs = 0
        var awayLead = 0, homeLead = 0
        var awayMaxGap = 0.0, homeMaxGap = 0.0

        for pair in pairs {
            // Side signal (Win% MLB / ATS cover% NBA·NCAAB).
            if let a = pair.awaySidePct, let h = pair.homeSidePct, pair.sideSampleOK {
                eligibleSidePairs += 1
                let gap = a - h
                if abs(gap) >= InsightThresholds.sideGap {
                    // Leads count on gap alone; the signal additionally needs
                    // the leader at/above the 55% floor to actually fire.
                    if gap > 0 {
                        awayLead += 1
                        awayMaxGap = max(awayMaxGap, gap)
                    } else {
                        homeLead += 1
                        homeMaxGap = max(homeMaxGap, -gap)
                    }
                    let leaderIsAway = gap > 0
                    if max(a, h) >= InsightThresholds.leaderFloor {
                        let abbr = leaderIsAway ? awayAbbr : homeAbbr
                        fired.append((
                            TrendsSignal(
                                id: "\(pair.key)-side",
                                situationTitle: leaderIsAway ? pair.awayLabel : pair.homeLabel,
                                metricLabel: pair.sideMetricLabel,
                                kind: .side(leader: leaderIsAway ? .away : .home, abbr: abbr, gap: abs(gap)),
                                awayPct: a, homePct: h,
                                awayDetail: pair.awaySideDetail, homeDetail: pair.homeSideDetail,
                                strength: abs(gap)
                            ),
                            Meta(awayTag: pair.awayTag, homeTag: pair.homeTag,
                                 leaderTag: leaderIsAway ? pair.awayTag : pair.homeTag)
                        ))
                    }
                }
            }

            // O/U signal — consensus over rate on both sides.
            if let a = pair.awayOuPct, let h = pair.homeOuPct, pair.ouSampleOK {
                let title = ouTitle(pair)
                let meta = Meta(awayTag: pair.awayTag, homeTag: pair.homeTag, leaderTag: nil)
                if a >= InsightThresholds.ouHigh, h >= InsightThresholds.ouHigh {
                    fired.append((
                        TrendsSignal(
                            id: "\(pair.key)-ou", situationTitle: title,
                            metricLabel: pair.ouMetricLabel, kind: .over(floor: min(a, h)),
                            awayPct: a, homePct: h,
                            awayDetail: pair.awayOuDetail, homeDetail: pair.homeOuDetail,
                            strength: (min(a, h) - 50) * 2
                        ), meta
                    ))
                } else if a <= InsightThresholds.ouLow, h <= InsightThresholds.ouLow {
                    fired.append((
                        TrendsSignal(
                            id: "\(pair.key)-ou", situationTitle: title,
                            metricLabel: pair.ouMetricLabel, kind: .under(ceiling: max(a, h)),
                            awayPct: a, homePct: h,
                            awayDetail: pair.awayOuDetail, homeDetail: pair.homeOuDetail,
                            strength: (50 - max(a, h)) * 2
                        ), meta
                    ))
                }
            }
        }

        // Rank by strength desc; stable tiebreak keeps RN pair order.
        let ranked = fired.enumerated()
            .sorted { l, r in
                if l.element.signal.strength != r.element.signal.strength {
                    return l.element.signal.strength > r.element.signal.strength
                }
                return l.offset < r.offset
            }
            .map { $0.element }

        var verdicts: [InsightVerdict] = []

        // Side verdict — always present so the verdict line is never blank.
        let edgeNoun = basketball ? "ATS edge" : "edge"
        let maxLead = max(awayLead, homeLead)
        if maxLead >= 1 {
            let awayWins = awayLead > homeLead || (awayLead == homeLead && awayMaxGap >= homeMaxGap)
            let abbr = awayWins ? awayAbbr : homeAbbr
            let text = maxLead >= 2
                ? "\(abbr) \(edgeNoun) in \(maxLead) of \(eligibleSidePairs) angles"
                : "\(abbr) \(edgeNoun) in 1 angle"
            verdicts.append(InsightVerdict(
                text: text,
                lean: .team(abbr: abbr, side: awayWins ? .away : .home),
                strength: InsightThresholds.dots(awayWins ? awayMaxGap : homeMaxGap)
            ))
        } else {
            verdicts.append(InsightVerdict(
                text: basketball ? "No ATS edge" : "No side edge",
                lean: .none, strength: 0
            ))
        }

        // O/U verdict from fired consensus counts; omitted when mixed/empty.
        let overs = ranked.filter { if case .over = $0.signal.kind { return true }; return false }
        let unders = ranked.filter { if case .under = $0.signal.kind { return true }; return false }
        let o = overs.count, u = unders.count
        if o > u, o >= 2 {
            verdicts.append(InsightVerdict(
                text: "OVER leans \(o)–\(u)", lean: .over,
                strength: InsightThresholds.dots(overs.first?.signal.strength ?? 0)
            ))
        } else if u > o, u >= 2 {
            verdicts.append(InsightVerdict(
                text: "UNDER leans \(u)–\(o)", lean: .under,
                strength: InsightThresholds.dots(unders.first?.signal.strength ?? 0)
            ))
        } else if o + u == 1, let only = overs.first ?? unders.first {
            verdicts.append(InsightVerdict(
                text: "\(o == 1 ? "OVER" : "UNDER") lean (\(only.signal.situationTitle))",
                lean: o == 1 ? .over : .under,
                strength: InsightThresholds.dots(only.signal.strength)
            ))
        }

        let badge = ranked.isEmpty
            ? InsightVerdictBadge(text: "NO EDGE", tintHex: 0x9CA3AF)
            : InsightVerdictBadge(text: "\(ranked.count) SIGNAL\(ranked.count == 1 ? "" : "S")", tintHex: 0x22C55E)

        return Output(
            summary: TrendsInsightSummary(
                verdicts: verdicts,
                badge: badge,
                signals: ranked.map { $0.signal },
                eligibleSidePairs: eligibleSidePairs,
                totalSituations: pairs.count
            ),
            metas: ranked
        )
    }

    /// O/U signals belong to both teams — when the two sides sit in different
    /// situations (away "After Win" / home "After Loss") show both labels.
    private static func ouTitle(_ pair: Pair) -> String {
        pair.awayLabel == pair.homeLabel ? pair.awayLabel : "\(pair.awayLabel) / \(pair.homeLabel)"
    }
}

// MARK: - MLB

public enum MLBTrendsInsight {
    public static func summary(for game: MLBGameTrends) -> TrendsInsightSummary {
        compute(for: game).summary
    }

    /// Search-chip teaser. Signals where the matched team leads weigh +5;
    /// below strength 10 the chip stays neutral (`headline: nil`).
    public static func teaser(for game: MLBGameTrends, matchedAbbr: String?) -> InsightTeaser {
        let output = compute(for: game)
        let awayAbbr = abbr(game.awayTeam)
        let homeAbbr = abbr(game.homeTeam)

        var best: (signal: TrendsSignal, meta: TrendsInsightEngine.Meta, weighted: Double)?
        for entry in output.metas {
            var weighted = entry.signal.strength
            if let matched = matchedAbbr {
                switch entry.signal.kind {
                case .side(_, let leaderAbbr, _):
                    if matches(matched, leaderAbbr) { weighted += 5 }
                case .over, .under:
                    // O/U consensus involves both teams' cells.
                    if matches(matched, awayAbbr) || matches(matched, homeAbbr) { weighted += 5 }
                }
            }
            if best == nil || weighted > best!.weighted {
                best = (entry.signal, entry.meta, weighted)
            }
        }

        guard let best, best.weighted >= 10 else {
            return InsightTeaser(kind: .trends, headline: nil, signal: .neutral, smallSample: false)
        }

        // MLB trend views are percent-only — no sample counts to warn on.
        switch best.signal.kind {
        case .side(let leader, let leaderAbbr, _):
            let pct = (leader == .away ? best.signal.awayPct : best.signal.homePct) ?? 0
            let headline = trimmed("\(leaderAbbr) wins \(Int(pct.rounded()))% \(phrase(best.meta.leaderTag))")
            let signal: InsightTeaser.Signal = {
                guard let matched = matchedAbbr else { return .neutral }
                return matches(matched, leaderAbbr) ? .positive : .negative
            }()
            return InsightTeaser(kind: .trends, headline: headline, signal: signal, smallSample: false)
        case .over:
            let mean = (((best.signal.awayPct ?? 0) + (best.signal.homePct ?? 0)) / 2).rounded()
            let tag = teaserTag(best.meta, matchedAbbr: matchedAbbr, homeAbbr: homeAbbr)
            return InsightTeaser(
                kind: .trends,
                headline: trimmed("Overs hit \(Int(mean))% \(phrase(tag))"),
                signal: .positive, smallSample: false
            )
        case .under:
            let mean = ((best.signal.awayPct ?? 0) + (best.signal.homePct ?? 0)) / 2
            let tag = teaserTag(best.meta, matchedAbbr: matchedAbbr, homeAbbr: homeAbbr)
            return InsightTeaser(
                kind: .trends,
                headline: trimmed("Unders hit \(Int((100 - mean).rounded()))% \(phrase(tag))"),
                signal: .negative, smallSample: false
            )
        }
    }

    private static func compute(for game: MLBGameTrends) -> TrendsInsightEngine.Output {
        TrendsInsightEngine.compute(
            pairs: pairs(for: game),
            awayAbbr: abbr(game.awayTeam),
            homeAbbr: abbr(game.homeTeam),
            basketball: false
        )
    }

    private static func pairs(for game: MLBGameTrends) -> [TrendsInsightEngine.Pair] {
        let a = game.awayTeam, h = game.homeTeam
        // RN order, matching MLBTrendsMatrixAdapter's 7 sections.
        let configs: [(key: String,
                       tag: (MLBSituationalTrendRow) -> String?,
                       win: (MLBSituationalTrendRow) -> Double?,
                       over: (MLBSituationalTrendRow) -> Double?)] = [
            ("lastGame", { $0.lastGameSituation }, { $0.winPctLastGame }, { $0.overPctLastGame }),
            ("homeAway", { $0.homeAwaySituation }, { $0.winPctHomeAway }, { $0.overPctHomeAway }),
            ("favDog", { $0.favDogSituation }, { $0.winPctFavDog }, { $0.overPctFavDog }),
            ("restBucket", { $0.restBucket }, { $0.winPctRestBucket }, { $0.overPctRestBucket }),
            ("restComp", { $0.restComp }, { $0.winPctRestComp }, { $0.overPctRestComp }),
            ("league", { $0.leagueSituation }, { $0.winPctLeague }, { $0.overPctLeague }),
            ("division", { $0.divisionSituation }, { $0.winPctDivision }, { $0.overPctDivision })
        ]
        return configs.map { config in
            TrendsInsightEngine.Pair(
                key: config.key,
                sideMetricLabel: "Win%",
                ouMetricLabel: "Over%",
                awayLabel: formatMLBSituation(config.tag(a)),
                homeLabel: formatMLBSituation(config.tag(h)),
                awayTag: config.tag(a),
                homeTag: config.tag(h),
                awaySidePct: normalizePct(config.win(a)),
                homeSidePct: normalizePct(config.win(h)),
                awaySideDetail: nil,
                homeSideDetail: nil,
                sideMinGames: nil,        // MLB views are percent-only — no sample gate
                awayOuPct: normalizePct(config.over(a)),
                homeOuPct: normalizePct(config.over(h)),
                awayOuDetail: nil,
                homeOuDetail: nil,
                ouMinGames: nil
            )
        }
    }

    private static func abbr(_ row: MLBSituationalTrendRow) -> String {
        MLBTeams.displayById(row.teamId)?.abbrev
            ?? String(row.teamName.prefix(3)).uppercased()
    }

    /// RN `toTrendPct` — some rows come back fractional (0..1); rescale before math.
    private static func normalizePct(_ value: Double?) -> Double? {
        guard let value else { return nil }
        return value > 0 && value < 1 ? value * 100 : value
    }

    private static func matches(_ lhs: String, _ rhs: String) -> Bool {
        lhs.caseInsensitiveCompare(rhs) == .orderedSame
    }

    /// O/U teasers phrase from the matched team's own situation when known.
    private static func teaserTag(_ meta: TrendsInsightEngine.Meta, matchedAbbr: String?, homeAbbr: String) -> String? {
        if let matched = matchedAbbr, matches(matched, homeAbbr) { return meta.homeTag }
        return meta.awayTag
    }

    /// Situation tag → teaser phrase ("NYY wins 71% after a loss").
    private static func phrase(_ tag: String?) -> String {
        guard let tag, !tag.isEmpty else { return "" }
        let map: [String: String] = [
            "is_after_loss": "after a loss",
            "is_after_win": "after a win",
            "is_fav": "as a favorite",
            "is_dog": "as an underdog",
            "is_home_fav": "as a home favorite",
            "is_away_fav": "as an away favorite",
            "is_home_dog": "as a home dog",
            "is_away_dog": "as an away dog",
            "is_home": "at home",
            "is_away": "on the road",
            "one_day_off": "on 1 day off",
            "two_three_days_off": "on 2-3 days off",
            "four_plus_days_off": "on 4+ days off",
            "rest_advantage": "with a rest edge",
            "rest_disadvantage": "on short rest",
            "rest_equal": "on equal rest",
            "equal_rest": "on equal rest",
            "no_rest": "on no rest",
            "league": "in league play",
            "non_league": "in interleague play",
            "division": "in the division",
            "non_division": "outside the division"
        ]
        return map[tag] ?? formatMLBSituation(tag).lowercased()
    }

    private static func trimmed(_ text: String) -> String {
        text.trimmingCharacters(in: .whitespaces)
    }
}

// MARK: - NBA

public enum NBATrendsInsight {
    public static func summary(for game: NBAGameTrendsData) -> TrendsInsightSummary {
        TrendsInsightEngine.compute(
            pairs: pairs(for: game),
            awayAbbr: game.awayTeam.teamAbbr,
            homeAbbr: game.homeTeam.teamAbbr,
            basketball: true
        ).summary
    }

    private static func pairs(for game: NBAGameTrendsData) -> [TrendsInsightEngine.Pair] {
        let a = game.awayTeam, h = game.homeTeam
        // The 5 RN pairs the today view renders (no home/away columns).
        let configs: [(key: String,
                       tag: (NBASituationalTrendRow) -> String?,
                       atsRecord: (NBASituationalTrendRow) -> String?,
                       atsPct: (NBASituationalTrendRow) -> Double?,
                       ouRecord: (NBASituationalTrendRow) -> String?,
                       ouOver: (NBASituationalTrendRow) -> Double?)] = [
            ("lastGame", { $0.lastGameSituation }, { $0.atsLastGameRecord }, { $0.atsLastGameCoverPct },
             { $0.ouLastGameRecord }, { $0.ouLastGameOverPct }),
            ("favDog", { $0.favDogSituation }, { $0.atsFavDogRecord }, { $0.atsFavDogCoverPct },
             { $0.ouFavDogRecord }, { $0.ouFavDogOverPct }),
            ("sideFavDog", { $0.sideSpreadSituation }, { $0.atsSideFavDogRecord }, { $0.atsSideFavDogCoverPct },
             { $0.ouSideFavDogRecord }, { $0.ouSideFavDogOverPct }),
            ("restBucket", { $0.restBucket }, { $0.atsRestBucketRecord }, { $0.atsRestBucketCoverPct },
             { $0.ouRestBucketRecord }, { $0.ouRestBucketOverPct }),
            ("restComp", { $0.restComp }, { $0.atsRestCompRecord }, { $0.atsRestCompCoverPct },
             { $0.ouRestCompRecord }, { $0.ouRestCompOverPct })
        ]
        return configs.map { config in
            let awayATSRecord = config.atsRecord(a)
            let homeATSRecord = config.atsRecord(h)
            let awayOURecord = config.ouRecord(a)
            let homeOURecord = config.ouRecord(h)
            return TrendsInsightEngine.Pair(
                key: config.key,
                sideMetricLabel: "ATS",
                ouMetricLabel: "O/U",
                awayLabel: formatNBASituation(config.tag(a)),
                homeLabel: formatNBASituation(config.tag(h)),
                awayTag: config.tag(a),
                homeTag: config.tag(h),
                awaySidePct: config.atsPct(a),
                homeSidePct: config.atsPct(h),
                awaySideDetail: awayATSRecord,
                homeSideDetail: homeATSRecord,
                sideMinGames: min(parseNBARecord(awayATSRecord).total, parseNBARecord(homeATSRecord).total),
                awayOuPct: config.ouOver(a),
                homeOuPct: config.ouOver(h),
                awayOuDetail: awayOURecord,
                homeOuDetail: homeOURecord,
                ouMinGames: min(parseNBARecord(awayOURecord).total, parseNBARecord(homeOURecord).total)
            )
        }
    }
}

// MARK: - NCAAB

public enum NCAABTrendsInsight {
    public static func summary(for game: NCAABGameTrendsData) -> TrendsInsightSummary {
        TrendsInsightEngine.compute(
            pairs: pairs(for: game),
            awayAbbr: game.awayTeam.teamAbbr,
            homeAbbr: game.homeTeam.teamAbbr,
            basketball: true
        ).summary
    }

    private static func pairs(for game: NCAABGameTrendsData) -> [TrendsInsightEngine.Pair] {
        let a = game.awayTeam, h = game.homeTeam
        let configs: [(key: String,
                       tag: (NCAABSituationalTrendRow) -> String?,
                       atsRecord: (NCAABSituationalTrendRow) -> String?,
                       atsPct: (NCAABSituationalTrendRow) -> Double?,
                       ouRecord: (NCAABSituationalTrendRow) -> String?,
                       ouOver: (NCAABSituationalTrendRow) -> Double?)] = [
            ("lastGame", { $0.lastGameSituation }, { $0.atsLastGameRecord }, { $0.atsLastGameCoverPct },
             { $0.ouLastGameRecord }, { $0.ouLastGameOverPct }),
            ("favDog", { $0.favDogSituation }, { $0.atsFavDogRecord }, { $0.atsFavDogCoverPct },
             { $0.ouFavDogRecord }, { $0.ouFavDogOverPct }),
            ("sideFavDog", { $0.sideSpreadSituation }, { $0.atsSideFavDogRecord }, { $0.atsSideFavDogCoverPct },
             { $0.ouSideFavDogRecord }, { $0.ouSideFavDogOverPct }),
            ("restBucket", { $0.restBucket }, { $0.atsRestBucketRecord }, { $0.atsRestBucketCoverPct },
             { $0.ouRestBucketRecord }, { $0.ouRestBucketOverPct }),
            ("restComp", { $0.restComp }, { $0.atsRestCompRecord }, { $0.atsRestCompCoverPct },
             { $0.ouRestCompRecord }, { $0.ouRestCompOverPct })
        ]
        return configs.map { config in
            let awayATSRecord = config.atsRecord(a)
            let homeATSRecord = config.atsRecord(h)
            let awayOURecord = config.ouRecord(a)
            let homeOURecord = config.ouRecord(h)
            return TrendsInsightEngine.Pair(
                key: config.key,
                sideMetricLabel: "ATS",
                ouMetricLabel: "O/U",
                awayLabel: formatNCAABSituation(config.tag(a)),
                homeLabel: formatNCAABSituation(config.tag(h)),
                awayTag: config.tag(a),
                homeTag: config.tag(h),
                awaySidePct: config.atsPct(a),
                homeSidePct: config.atsPct(h),
                awaySideDetail: awayATSRecord,
                homeSideDetail: homeATSRecord,
                sideMinGames: min(parseNCAABRecord(awayATSRecord).total, parseNCAABRecord(homeATSRecord).total),
                awayOuPct: config.ouOver(a),
                homeOuPct: config.ouOver(h),
                awayOuDetail: awayOURecord,
                homeOuDetail: homeOURecord,
                ouMinGames: min(parseNCAABRecord(awayOURecord).total, parseNCAABRecord(homeOURecord).total)
            )
        }
    }
}
