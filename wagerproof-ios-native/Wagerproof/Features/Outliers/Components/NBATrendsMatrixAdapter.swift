import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Maps an `NBAGameTrendsData` bundle into the shared `TrendsMatrixSection`
/// rows. NBA renders the 5 RN situational pairs (the `_today` view has no
/// home/away columns) with ATS record + cover% and O/U record + over/under
/// split per team.
enum NBATrendsMatrixAdapter {
    /// RN NBA trends header icon color (`#3b82f6`).
    static let accent = Color(hex: 0x3B82F6)

    static func sections(for game: NBAGameTrendsData) -> [TrendsMatrixSection] {
        let configs: [(
            id: String, title: String, icon: String, tip: String,
            label: (NBASituationalTrendRow) -> String?,
            atsRecord: (NBASituationalTrendRow) -> String?,
            atsPct: (NBASituationalTrendRow) -> Double?,
            ouRecord: (NBASituationalTrendRow) -> String?,
            ouOver: (NBASituationalTrendRow) -> Double?,
            ouUnder: (NBASituationalTrendRow) -> Double?
        )] = [
            ("lastGame", "Last Game Situation", "clock",
             "How each team performs ATS and O/U after a win vs. after a loss. Look for momentum patterns.",
             { $0.lastGameSituation }, { $0.atsLastGameRecord }, { $0.atsLastGameCoverPct },
             { $0.ouLastGameRecord }, { $0.ouLastGameOverPct }, { $0.ouLastGameUnderPct }),
            ("favDog", "Favorite/Underdog Situation", "rosette",
             "Performance when favored vs. as underdog. Strong ATS contrast (≥15%) suggests an edge.",
             { $0.favDogSituation }, { $0.atsFavDogRecord }, { $0.atsFavDogCoverPct },
             { $0.ouFavDogRecord }, { $0.ouFavDogOverPct }, { $0.ouFavDogUnderPct }),
            ("sideFavDog", "Side Spread Situation", "house",
             "Combines home/away with favorite/underdog role. Home favorites and away underdogs often have distinct patterns.",
             { $0.sideSpreadSituation }, { $0.atsSideFavDogRecord }, { $0.atsSideFavDogCoverPct },
             { $0.ouSideFavDogRecord }, { $0.ouSideFavDogOverPct }, { $0.ouSideFavDogUnderPct }),
            ("restBucket", "Rest Bucket", "calendar.badge.clock",
             "Performance based on days of rest (1, 2-3, or 4+). Fatigue or rust can impact both ATS and totals.",
             { $0.restBucket }, { $0.atsRestBucketRecord }, { $0.atsRestBucketCoverPct },
             { $0.ouRestBucketRecord }, { $0.ouRestBucketOverPct }, { $0.ouRestBucketUnderPct }),
            ("restComp", "Rest Comparison", "scale.3d",
             "Rest advantage vs. opponent. Teams with more rest often cover, but totals can swing either way.",
             { $0.restComp }, { $0.atsRestCompRecord }, { $0.atsRestCompCoverPct },
             { $0.ouRestCompRecord }, { $0.ouRestCompOverPct }, { $0.ouRestCompUnderPct })
        ]

        return configs.map { config in
            // RN coalesces empty strings too (`record || '-'`), not just null.
            let awayATSRecord = normalizeRecord(config.atsRecord(game.awayTeam))
            let homeATSRecord = normalizeRecord(config.atsRecord(game.homeTeam))
            let awayATSPct = config.atsPct(game.awayTeam)
            let homeATSPct = config.atsPct(game.homeTeam)
            let awayOURecord = normalizeRecord(config.ouRecord(game.awayTeam))
            let homeOURecord = normalizeRecord(config.ouRecord(game.homeTeam))
            let awayOver = config.ouOver(game.awayTeam)
            let homeOver = config.ouOver(game.homeTeam)
            let awayUnder = config.ouUnder(game.awayTeam)
            let homeUnder = config.ouUnder(game.homeTeam)

            return TrendsMatrixSection(
                id: config.id,
                title: config.title,
                systemImage: config.icon,
                tooltip: config.tip,
                awayLabel: formatNBASituation(config.label(game.awayTeam)),
                homeLabel: formatNBASituation(config.label(game.homeTeam)),
                rows: [
                    TrendsMatrixMetricRow(
                        id: "\(config.id)-ats", label: "ATS",
                        away: .recordPct(record: awayATSRecord, pct: awayATSPct),
                        home: .recordPct(record: homeATSRecord, pct: homeATSPct)
                    ),
                    TrendsMatrixMetricRow(
                        id: "\(config.id)-ou", label: "O/U",
                        away: .recordOU(record: awayOURecord, over: awayOver, under: awayUnder),
                        home: .recordOU(record: homeOURecord, over: homeOver, under: homeUnder)
                    )
                ],
                badges: badges(
                    awayATSPct: awayATSPct, homeATSPct: homeATSPct,
                    awayATSGames: parseNBARecord(awayATSRecord).total,
                    homeATSGames: parseNBARecord(homeATSRecord).total,
                    awayOver: awayOver, homeOver: homeOver,
                    awayUnder: awayUnder, homeUnder: homeUnder,
                    awayOUGames: parseNBARecord(awayOURecord).total,
                    homeOUGames: parseNBARecord(homeOURecord).total,
                    awayAbbr: game.awayTeam.teamAbbr, homeAbbr: game.homeTeam.teamAbbr
                ),
                // RN `hasData`: at least one side carries an ATS record string.
                hasData: awayATSRecord != "-" || homeATSRecord != "-"
            )
        }
    }

    static func avatarProvider(for game: NBAGameTrendsData) -> (TrendsTeamSide, CGFloat) -> AnyView {
        { side, size in
            let row = side == .away ? game.awayTeam : game.homeTeam
            // The trends view carries no logo column — resolve the ESPN slug
            // by name (same table the Outliers cards use), initials fallback.
            return AnyView(TrendsTeamAvatar(
                logoUrl: OutlierTeamPalette.logoURL(for: row.teamName, sport: .nba),
                teamName: row.teamName,
                sport: "nba",
                size: size,
                colors: NBATeams.colorPair(for: row.teamName)
            ))
        }
    }

    /// Per-team brand stripe (RN A.7: away pair → home pair) from the full
    /// 30-team `NBATeams` table.
    static func stripeColors(for game: NBAGameTrendsData) -> [Color] {
        let aw = NBATeams.colorPair(for: game.awayTeam.teamName)
        let hm = NBATeams.colorPair(for: game.homeTeam.teamName)
        return [aw.primary, aw.secondary, hm.primary, hm.secondary]
    }

    static func timeDisplay(for game: NBAGameTrendsData) -> String {
        guard let raw = game.tipoffTime, !raw.isEmpty else { return "TBD" }
        return GameCardFormatting.convertTimeToEST(raw)
    }

    static func normalizeRecord(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "-" }
        return raw
    }

    /// Per-situation consensus chips, gated exactly like the RN list-sort
    /// formulas: ATS needs ≥5 games on BOTH sides and a >10pt cover gap;
    /// O/U needs both sides >55% the same direction with ≥5-game samples.
    static func badges(
        awayATSPct: Double?, homeATSPct: Double?,
        awayATSGames: Int, homeATSGames: Int,
        awayOver: Double?, homeOver: Double?,
        awayUnder: Double?, homeUnder: Double?,
        awayOUGames: Int, homeOUGames: Int,
        awayAbbr: String, homeAbbr: String
    ) -> [TrendsConsensusBadge] {
        var out: [TrendsConsensusBadge] = []
        if let a = awayATSPct, let h = homeATSPct,
           min(awayATSGames, homeATSGames) >= 5, abs(a - h) > 10 {
            out.append(TrendsConsensusBadge(
                text: "ATS \(a > h ? awayAbbr : homeAbbr)",
                systemImage: "bolt.fill",
                colorHex: 0x22C55E
            ))
        }
        let ouSampled = min(awayOUGames, homeOUGames) >= 5
        if ouSampled, let ao = awayOver, let ho = homeOver, ao > 55, ho > 55 {
            out.append(TrendsConsensusBadge(text: "Over lean", systemImage: "arrow.up", colorHex: 0x22C55E))
        } else if ouSampled, let au = awayUnder, let hu = homeUnder, au > 55, hu > 55 {
            out.append(TrendsConsensusBadge(text: "Under lean", systemImage: "arrow.down", colorHex: 0x3B82F6))
        }
        return out
    }
}
