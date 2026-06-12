import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Maps an `NCAABGameTrendsData` bundle into the shared
/// `TrendsMatrixSection` rows. RN renders the same 5 situational pairs as
/// NBA for college (the NCAAB sheet literally imports the NBA section
/// component), so the section configs mirror `NBATrendsMatrixAdapter`.
enum NCAABTrendsMatrixAdapter {
    /// Same blue as the NBA trends accent — RN shares the component.
    static let accent = Color(hex: 0x3B82F6)

    static func sections(for game: NCAABGameTrendsData) -> [TrendsMatrixSection] {
        let configs: [(
            id: String, title: String, icon: String, tip: String,
            label: (NCAABSituationalTrendRow) -> String?,
            atsRecord: (NCAABSituationalTrendRow) -> String?,
            atsPct: (NCAABSituationalTrendRow) -> Double?,
            ouRecord: (NCAABSituationalTrendRow) -> String?,
            ouOver: (NCAABSituationalTrendRow) -> Double?,
            ouUnder: (NCAABSituationalTrendRow) -> Double?
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
            let awayATSRecord = NBATrendsMatrixAdapter.normalizeRecord(config.atsRecord(game.awayTeam))
            let homeATSRecord = NBATrendsMatrixAdapter.normalizeRecord(config.atsRecord(game.homeTeam))
            let awayATSPct = config.atsPct(game.awayTeam)
            let homeATSPct = config.atsPct(game.homeTeam)
            let awayOURecord = NBATrendsMatrixAdapter.normalizeRecord(config.ouRecord(game.awayTeam))
            let homeOURecord = NBATrendsMatrixAdapter.normalizeRecord(config.ouRecord(game.homeTeam))
            let awayOver = config.ouOver(game.awayTeam)
            let homeOver = config.ouOver(game.homeTeam)
            let awayUnder = config.ouUnder(game.awayTeam)
            let homeUnder = config.ouUnder(game.homeTeam)

            return TrendsMatrixSection(
                id: config.id,
                title: config.title,
                systemImage: config.icon,
                tooltip: config.tip,
                awayLabel: formatNCAABSituation(config.label(game.awayTeam)),
                homeLabel: formatNCAABSituation(config.label(game.homeTeam)),
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
                // Same gates as NBA — RN shares one consensus implementation.
                badges: NBATrendsMatrixAdapter.badges(
                    awayATSPct: awayATSPct, homeATSPct: homeATSPct,
                    awayATSGames: parseNCAABRecord(awayATSRecord).total,
                    homeATSGames: parseNCAABRecord(homeATSRecord).total,
                    awayOver: awayOver, homeOver: homeOver,
                    awayUnder: awayUnder, homeUnder: homeUnder,
                    awayOUGames: parseNCAABRecord(awayOURecord).total,
                    homeOUGames: parseNCAABRecord(homeOURecord).total,
                    awayAbbr: game.awayTeam.teamAbbr, homeAbbr: game.homeTeam.teamAbbr
                ),
                hasData: awayATSRecord != "-" || homeATSRecord != "-"
            )
        }
    }

    static func avatarProvider(for game: NCAABGameTrendsData) -> (TrendsTeamSide, CGFloat) -> AnyView {
        { side, size in
            let row = side == .away ? game.awayTeam : game.homeTeam
            // ESPN logo from ncaab_team_mapping (resolved by the store) —
            // initials only when the mapping has no row for this team.
            return AnyView(TrendsTeamAvatar(
                logoUrl: side == .away ? game.awayTeamLogo : game.homeTeamLogo,
                teamName: row.teamName,
                sport: "ncaab",
                size: size,
                colors: FallbackTeamColor.colorPair(for: row.teamName)
            ))
        }
    }

    /// Per-team stripe (RN A.7: away pair → home pair). No NCAAB brand table
    /// exists — hashed stable colors, same convention as the detail pages.
    static func stripeColors(for game: NCAABGameTrendsData) -> [Color] {
        let aw = FallbackTeamColor.colorPair(for: game.awayTeam.teamName)
        let hm = FallbackTeamColor.colorPair(for: game.homeTeam.teamName)
        return [aw.primary, aw.secondary, hm.primary, hm.secondary]
    }

    static func timeDisplay(for game: NCAABGameTrendsData) -> String {
        guard let raw = game.tipoffTime, !raw.isEmpty else { return "TBD" }
        return GameCardFormatting.convertTimeToEST(raw)
    }
}
