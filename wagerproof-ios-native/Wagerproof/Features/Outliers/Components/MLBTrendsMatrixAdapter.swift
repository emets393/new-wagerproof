import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Maps an `MLBGameTrends` bundle into the shared `TrendsMatrixSection`
/// rows. MLB renders all 7 situational pairs with WIN% + OVER% per team
/// (the `mlb_situational_trends_today` view is percent-only — no records,
/// no sample counts; see RN `types/mlbBettingTrends.ts`).
enum MLBTrendsMatrixAdapter {
    /// RN MLB trends header icon color (`#16a34a`).
    static let accent = Color(hex: 0x16A34A)

    static func sections(for game: MLBGameTrends) -> [TrendsMatrixSection] {
        // (id, title, icon, tooltip, label, win pct, over pct) — RN order.
        let configs: [(
            id: String, title: String, icon: String, tip: String,
            label: (MLBSituationalTrendRow) -> String?,
            win: (MLBSituationalTrendRow) -> Double?,
            over: (MLBSituationalTrendRow) -> Double?
        )] = [
            ("lastGame", "Last Game Situation", "clock",
             "How each team performs after a win vs. after a loss. Look for momentum or bounce-back patterns.",
             { $0.lastGameSituation }, { $0.winPctLastGame }, { $0.overPctLastGame }),
            ("homeAway", "Home / Away", "house",
             "Win rate and over rate when playing at home vs. on the road. Home-field advantage varies by park.",
             { $0.homeAwaySituation }, { $0.winPctHomeAway }, { $0.overPctHomeAway }),
            ("favDog", "Favorite / Underdog", "rosette",
             "Performance when favored vs. as underdog. Big win% gaps between the two teams suggest an ML edge.",
             { $0.favDogSituation }, { $0.winPctFavDog }, { $0.overPctFavDog }),
            ("restBucket", "Rest Bucket", "calendar.badge.clock",
             "Performance based on days of rest (1, 2-3, or 4+). Pitching rotations are heavily affected by rest.",
             { $0.restBucket }, { $0.winPctRestBucket }, { $0.overPctRestBucket }),
            ("restComp", "Rest Comparison", "scale.3d",
             "Rest advantage vs. opponent. Teams with more rest may have a pitching edge.",
             { $0.restComp }, { $0.winPctRestComp }, { $0.overPctRestComp }),
            ("league", "League Situation", "shield",
             "Performance in league (AL/NL) vs. non-league games. Interleague games can shift dynamics.",
             { $0.leagueSituation }, { $0.winPctLeague }, { $0.overPctLeague }),
            ("division", "Division Situation", "trophy",
             "Performance in division vs. non-division games. Divisional familiarity can impact results.",
             { $0.divisionSituation }, { $0.winPctDivision }, { $0.overPctDivision })
        ]

        let awayAbbr = abbr(game.awayTeam)
        let homeAbbr = abbr(game.homeTeam)

        return configs.map { config in
            let awayWin = normalizePct(config.win(game.awayTeam))
            let homeWin = normalizePct(config.win(game.homeTeam))
            let awayOver = normalizePct(config.over(game.awayTeam))
            let homeOver = normalizePct(config.over(game.homeTeam))
            return TrendsMatrixSection(
                id: config.id,
                title: config.title,
                systemImage: config.icon,
                tooltip: config.tip,
                awayLabel: formatMLBSituation(config.label(game.awayTeam)),
                homeLabel: formatMLBSituation(config.label(game.homeTeam)),
                rows: [
                    TrendsMatrixMetricRow(id: "\(config.id)-win", label: "WIN%",
                                          away: .pct(awayWin), home: .pct(homeWin)),
                    TrendsMatrixMetricRow(id: "\(config.id)-over", label: "OVER%",
                                          away: .pct(awayOver), home: .pct(homeOver))
                ],
                badges: badges(awayWin: awayWin, homeWin: homeWin,
                               awayOver: awayOver, homeOver: homeOver,
                               awayAbbr: awayAbbr, homeAbbr: homeAbbr),
                hasData: awayWin != nil || homeWin != nil || awayOver != nil || homeOver != nil
            )
        }
    }

    static func avatarProvider(for game: MLBGameTrends) -> (TrendsTeamSide, CGFloat) -> AnyView {
        { side, size in
            let row = side == .away ? game.awayTeam : game.homeTeam
            let display = MLBTeams.displayById(row.teamId)
            return AnyView(MLBTeamLogo(
                logoUrl: display?.logoUrl,
                abbrev: display?.abbrev ?? "MLB",
                name: row.teamName,
                size: size
            ))
        }
    }

    static func stripeColors(for game: MLBGameTrends) -> [Color] {
        let aw = MLBTeams.colors(for: game.awayTeam.teamName)
        let hm = MLBTeams.colors(for: game.homeTeam.teamName)
        return [Color(hex: Int(aw.primary)), Color(hex: Int(aw.secondary)),
                Color(hex: Int(hm.primary)), Color(hex: Int(hm.secondary))]
    }

    static func timeDisplay(for game: MLBGameTrends) -> String {
        guard let raw = game.gameTimeEt, !raw.isEmpty else { return "TBD" }
        return MLBFormatting.gameTime(raw)
    }

    static func abbr(_ row: MLBSituationalTrendRow) -> String {
        MLBTeams.displayById(row.teamId)?.abbrev
            ?? String(row.teamName.prefix(3)).uppercased()
    }

    /// RN `toTrendPct` — fractional values (0..1) come back from some rows;
    /// scale to 0..100 before thresholds/format.
    private static func normalizePct(_ value: Double?) -> Double? {
        guard let value else { return nil }
        return value > 0 && value < 1 ? value * 100 : value
    }

    /// Per-situation consensus chips, using the same thresholds as the RN
    /// list-sort formulas (`MIN_DIFF = 10` for ML dominance; both >55 / both
    /// <45 for O/U consensus). MLB has no sample-size gate — no records exist.
    private static func badges(
        awayWin: Double?, homeWin: Double?,
        awayOver: Double?, homeOver: Double?,
        awayAbbr: String, homeAbbr: String
    ) -> [TrendsConsensusBadge] {
        var out: [TrendsConsensusBadge] = []
        if let a = awayWin, let h = homeWin, abs(a - h) >= 10 {
            out.append(TrendsConsensusBadge(
                text: "ML \(a > h ? awayAbbr : homeAbbr)",
                systemImage: "bolt.fill",
                colorHex: 0x22C55E
            ))
        }
        if let a = awayOver, let h = homeOver {
            if a > 55, h > 55 {
                out.append(TrendsConsensusBadge(text: "Over lean", systemImage: "arrow.up", colorHex: 0x22C55E))
            } else if a < 45, h < 45 {
                out.append(TrendsConsensusBadge(text: "Under lean", systemImage: "arrow.down", colorHex: 0x3B82F6))
            }
        }
        return out
    }
}
