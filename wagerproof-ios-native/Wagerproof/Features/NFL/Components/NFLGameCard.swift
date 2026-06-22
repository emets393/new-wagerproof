import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices

/// NFL game row rendered in the home Games feed list. Thin wrapper around
/// `GameRowCard` — populates the model ML edge from `homeAwayMlProb` vs
/// vegas implied probabilities. NFL's predictions table doesn't publish a
/// fair-total figure, so the O/U row surfaces direction + confidence only.
struct NFLGameCard: View {
    let game: NFLPrediction
    var onPress: () -> Void = {}
    @State private var slatePicks: [NFLSlatePickRow] = []

    var body: some View {
        GameRowCard(model: rowModel, onPress: onPress)
            .id("\(game.gameId)-mammoth-\(hasMammothPlay)")
            .task(id: game.gameId) {
                await loadSlatePicks()
            }
    }

    private var rowModel: GameRowCard.Model {
        // Canonical abbr + logo come from the `nfl_teams` reference table
        // (NFLTeamAssets, hydrated by the NFL fetch paths), with the static
        // identity map as the fallback.
        let awayAbbr = game.awayAb ?? NFLTeamAssets.abbr(for: game.awayTeam)
        let homeAbbr = game.homeAb ?? NFLTeamAssets.abbr(for: game.homeTeam)
        return GameRowCard.Model(
            id: game.id,
            league: "nfl",
            dateLabel: GameCardFormatting.formatCompactDate(game.kickoff ?? game.gameDate),
            timeLabel: GameCardFormatting.convertTimeToEST(game.kickoff ?? game.gameTime),
            away: GameRowCard.TeamSide(
                abbr: awayAbbr,
                initials: awayAbbr,
                moneyline: game.awayMl,
                spread: game.awaySpread,
                logoURL: NFLTeamAssets.logo(for: game.awayTeam),
                colors: NFLTeamColors.colorPair(for: game.awayTeam)
            ),
            home: GameRowCard.TeamSide(
                abbr: homeAbbr,
                initials: homeAbbr,
                moneyline: game.homeMl,
                spread: game.homeSpread,
                logoURL: NFLTeamAssets.logo(for: game.homeTeam),
                colors: NFLTeamColors.colorPair(for: game.homeTeam)
            ),
            overLine: game.overLine,
            mlEdge: nil,
            // Dry-run pipeline publishes a fair total (`fg_pred_total`); the
            // legacy pipeline publishes a direction probability instead.
            ouEdge: GameEdgeMath.ouEdge(
                modelFairTotal: game.predTotal,
                marketLine: game.overLine,
                ouResultProb: game.ouResultProb
            ),
            awayTeamFullName: game.awayTeam,
            homeTeamFullName: game.homeTeam,
            slatePicks: predictionPills,
            oddsBreakdown: oddsBreakdown,
            isMammoth: hasMammothPlay
        )
    }

    private var hasMammothPlay: Bool {
        if game.mammoth { return true }
        return slatePicks.contains { pick in
            pick.hasPlay == true
                && (pick.isMammoth == true || (pick.conviction ?? "").lowercased() == "mammoth")
        }
    }

    private var predictionPills: GameRowCard.SlatePicks {
        GameRowCard.SlatePicks(
            total: totalSlatePick,
            spread: spreadSlatePick,
            badges: slateBadges
        )
    }

    private var slateBadges: [GameRowCard.SlateBadge] {
        let highCount = slatePicks.filter { pick in
            pick.hasPlay == true && (pick.conviction ?? "").lowercased() == "high"
        }.count
        let signalCount = Set(slatePicks.flatMap(\.signalKeys)).count
        return GameRowCard.convictionBadges(
            hasMammoth: hasMammothPlay,
            highCount: highCount,
            signalCount: signalCount
        )
    }

    private var totalSlatePick: GameRowCard.SlateTotalPick? {
        guard let pick = slatePicks.first(where: { $0.cardGroup == "total" }),
              let direction = pickDirection(pick.pickSide ?? pick.pickLabel)
        else {
            guard let direction = pickDirection(game.fgTotalPick) else { return nil }
            return GameRowCard.SlateTotalPick(
                direction: direction,
                line: GameCardFormatting.roundToNearestHalf(game.fgTotalClose),
                color: direction == "UNDER" ? Color.appAccentRed : Color.appPrimary
            )
        }
        return GameRowCard.SlateTotalPick(
            direction: direction,
            line: GameCardFormatting.roundToNearestHalf(pick.bestLine ?? pick.vegasLine),
            color: direction == "UNDER" ? Color.appAccentRed : Color.appPrimary
        )
    }

    private var spreadSlatePick: GameRowCard.SlateSpreadPick? {
        guard let pick = slatePicks.first(where: { $0.cardGroup == "spread" }),
              let team = pick.pickTeam ?? teamName(forSide: game.fgSpreadPick)
        else {
            guard let team = teamName(forSide: game.fgSpreadPick) else { return nil }
            return GameRowCard.SlateSpreadPick(
                abbr: teamAbbr(team),
                logoURL: NFLTeamAssets.logo(for: team),
                line: spreadLineForTeam(team, line: game.fgSpreadClose),
                colors: NFLTeamColors.colorPair(for: team)
            )
        }
        return GameRowCard.SlateSpreadPick(
            abbr: teamAbbr(team),
            logoURL: NFLTeamAssets.logo(for: team),
            line: GameCardFormatting.formatSpread(pick.bestLine ?? pick.vegasLine),
            colors: NFLTeamColors.colorPair(for: team)
        )
    }

    /// Spread / Money / Total table — matches the MLB card layout. Over on the
    /// away row, Under on the home row.
    private var oddsBreakdown: GameRowCard.OddsBreakdown {
        let totalText = GameCardFormatting.roundToNearestHalf(game.overLine)
        let hasTotal = game.overLine != nil
        return GameRowCard.OddsBreakdown(
            away: GameRowCard.OddsBreakdown.Row(
                abbr: NFLTeamAssets.abbr(for: game.awayTeam),
                spread: GameCardFormatting.formatSpread(game.awaySpread),
                moneyline: GameCardFormatting.formatMoneyline(game.awayMl),
                total: hasTotal ? "O\(totalText)" : "—"
            ),
            home: GameRowCard.OddsBreakdown.Row(
                abbr: NFLTeamAssets.abbr(for: game.homeTeam),
                spread: GameCardFormatting.formatSpread(game.homeSpread),
                moneyline: GameCardFormatting.formatMoneyline(game.homeMl),
                total: hasTotal ? "U\(totalText)" : "—"
            )
        )
    }

    private func loadSlatePicks() async {
        guard (game.runId ?? "").localizedCaseInsensitiveContains("dryrun") else { return }
        let cfb = await CFBSupabase.shared.client
        guard let rows: [NFLSlatePickRow] = try? await cfb
            .from("nfl_dryrun_picks")
            .select("game_id,card_group,pick_team,pick_side,pick_label,best_line,vegas_line,conviction,is_mammoth,signal_keys,has_play,sort_order")
            .eq("game_id", value: game.gameId)
            .order("sort_order", ascending: true)
            .execute()
            .value
        else { return }
        slatePicks = rows
    }

    private func teamName(forSide side: String?) -> String? {
        let upper = (side ?? "").uppercased()
        if upper.contains("HOME") { return game.homeTeam }
        if upper.contains("AWAY") { return game.awayTeam }
        return nil
    }

    private func spreadLineForTeam(_ team: String, line: Double?) -> String {
        guard let line else { return "—" }
        return GameCardFormatting.formatSpread(team == game.homeTeam ? line : -line)
    }

    private func pickDirection(_ raw: String?) -> String? {
        let upper = (raw ?? "").uppercased()
        if upper.contains("UNDER") { return "UNDER" }
        if upper.contains("OVER") { return "OVER" }
        return nil
    }

    private func teamAbbr(_ team: String) -> String {
        if team == game.homeTeam, let homeAb = game.homeAb { return homeAb }
        if team == game.awayTeam, let awayAb = game.awayAb { return awayAb }
        return NFLTeamAssets.abbr(for: team)
    }

    private struct NFLSlatePickRow: Decodable, Sendable {
        let cardGroup: String?
        let pickTeam: String?
        let pickSide: String?
        let pickLabel: String?
        let bestLine: Double?
        let vegasLine: Double?
        let conviction: String?
        let isMammoth: Bool?
        let signalKeys: [String]
        let hasPlay: Bool?

        enum CodingKeys: String, CodingKey {
            case cardGroup = "card_group"
            case pickTeam = "pick_team"
            case pickSide = "pick_side"
            case pickLabel = "pick_label"
            case bestLine = "best_line"
            case vegasLine = "vegas_line"
            case conviction
            case isMammoth = "is_mammoth"
            case signalKeys = "signal_keys"
            case hasPlay = "has_play"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            cardGroup = try c.decodeIfPresent(String.self, forKey: .cardGroup)
            pickTeam = try c.decodeIfPresent(String.self, forKey: .pickTeam)
            pickSide = try c.decodeIfPresent(String.self, forKey: .pickSide)
            pickLabel = try c.decodeIfPresent(String.self, forKey: .pickLabel)
            bestLine = try c.decodeIfPresent(Double.self, forKey: .bestLine)
            vegasLine = try c.decodeIfPresent(Double.self, forKey: .vegasLine)
            conviction = try c.decodeIfPresent(String.self, forKey: .conviction)
            isMammoth = try c.decodeIfPresent(Bool.self, forKey: .isMammoth)
            signalKeys = (try? c.decodeIfPresent(FlexibleStringList.self, forKey: .signalKeys))?.values ?? []
            hasPlay = try c.decodeIfPresent(Bool.self, forKey: .hasPlay)
        }
    }

    private struct FlexibleStringList: Decodable, Sendable {
        let values: [String]

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let array = try? c.decode([String].self) {
                values = array.filter { !$0.isEmpty }
            } else if let string = try? c.decode(String.self) {
                if let data = string.data(using: .utf8),
                   let parsed = try? JSONDecoder().decode([String].self, from: data) {
                    values = parsed.filter { !$0.isEmpty }
                } else {
                    values = string
                        .split(separator: ",")
                        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                        .filter { !$0.isEmpty }
                }
            } else {
                values = []
            }
        }
    }
}
