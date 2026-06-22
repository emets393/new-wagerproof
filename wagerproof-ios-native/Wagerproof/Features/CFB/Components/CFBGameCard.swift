import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices

/// CFB game row rendered in the home Games feed list. This intentionally uses
/// the same shared `GameRowCard` shell as NFL so the sport pages scan the same;
/// CFB-specific data (official 137-team abbreviations/logos/colors) feeds the
/// adapter below.
struct CFBGameCard: View {
    let game: CFBPrediction
    var onPress: () -> Void = {}
    @State private var slatePicks: [CFBSlatePickRow] = []

    var body: some View {
        GameRowCard(model: rowModel, onPress: onPress)
            .id("\(game.gameId)-mammoth-\(hasMammothPlay)")
            .task(id: game.gameId) {
                await loadSlatePicks()
            }
    }

    private var rowModel: GameRowCard.Model {
        let awayAbbr = CFBTeamAssets.abbr(for: game.awayTeam)
        let homeAbbr = CFBTeamAssets.abbr(for: game.homeTeam)
        return GameRowCard.Model(
            id: game.id,
            league: "cfb",
            dateLabel: GameCardFormatting.formatCompactDate(game.kickoff ?? game.gameDate),
            timeLabel: GameCardFormatting.convertTimeToEST(game.kickoff ?? game.gameTime),
            away: GameRowCard.TeamSide(
                abbr: awayAbbr,
                initials: awayAbbr,
                moneyline: game.awayMl,
                spread: game.awaySpread,
                logoURL: CFBTeamAssets.logo(for: game.awayTeam),
                colors: CFBTeamColors.colorPair(for: game.awayTeam)
            ),
            home: GameRowCard.TeamSide(
                abbr: homeAbbr,
                initials: homeAbbr,
                moneyline: game.homeMl,
                spread: game.homeSpread,
                logoURL: CFBTeamAssets.logo(for: game.homeTeam),
                colors: CFBTeamColors.colorPair(for: game.homeTeam)
            ),
            overLine: game.overLine,
            mlEdge: nil,
            ouEdge: GameEdgeMath.ouEdge(
                modelFairTotal: game.fgPredTotal ?? game.predTotal,
                marketLine: game.overLine,
                ouResultProb: game.ouResultProb
            ),
            awayTeamFullName: game.awayTeam,
            homeTeamFullName: game.homeTeam,
            slatePicks: predictionPills,
            oddsBreakdown: oddsBreakdown(awayAbbr: awayAbbr, homeAbbr: homeAbbr),
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
                abbr: CFBTeamAssets.abbr(for: team),
                logoURL: CFBTeamAssets.logo(for: team),
                line: spreadLineForTeam(team, line: game.fgSpreadClose),
                colors: CFBTeamColors.colorPair(for: team)
            )
        }
        return GameRowCard.SlateSpreadPick(
            abbr: CFBTeamAssets.abbr(for: team),
            logoURL: CFBTeamAssets.logo(for: team),
            line: GameCardFormatting.formatSpread(pick.bestLine ?? pick.vegasLine),
            colors: CFBTeamColors.colorPair(for: team)
        )
    }

    private func oddsBreakdown(awayAbbr: String, homeAbbr: String) -> GameRowCard.OddsBreakdown {
        let totalText = GameCardFormatting.roundToNearestHalf(game.overLine)
        let hasTotal = game.overLine != nil
        return GameRowCard.OddsBreakdown(
            away: GameRowCard.OddsBreakdown.Row(
                abbr: awayAbbr,
                spread: GameCardFormatting.formatSpread(game.awaySpread),
                moneyline: GameCardFormatting.formatMoneyline(game.awayMl),
                total: hasTotal ? "O\(totalText)" : "—"
            ),
            home: GameRowCard.OddsBreakdown.Row(
                abbr: homeAbbr,
                spread: GameCardFormatting.formatSpread(game.homeSpread),
                moneyline: GameCardFormatting.formatMoneyline(game.homeMl),
                total: hasTotal ? "U\(totalText)" : "—"
            )
        )
    }

    private func teamName(forSide side: String?) -> String? {
        guard let side else { return nil }
        let upper = side.uppercased()
        if upper.contains("HOME") { return game.homeTeam }
        if upper.contains("AWAY") { return game.awayTeam }
        return nil
    }

    private func spreadLineForTeam(_ team: String, line: Double?) -> String {
        guard let line else { return "—" }
        let homeLine = line
        return GameCardFormatting.formatSpread(team == game.homeTeam ? homeLine : -homeLine)
    }

    private func pickDirection(_ raw: String?) -> String? {
        let upper = (raw ?? "").uppercased()
        if upper.contains("UNDER") { return "UNDER" }
        if upper.contains("OVER") { return "OVER" }
        return nil
    }

    private func loadSlatePicks() async {
        let cfb = await CFBSupabase.shared.client
        guard let rows: [CFBSlatePickRow] = try? await cfb
            .from("cfb_dryrun_picks")
            .select("game_id,card_group,pick_team,pick_side,pick_label,best_line,vegas_line,conviction,is_mammoth,signal_keys,has_play,sort_order")
            .eq("game_id", value: game.gameId)
            .order("sort_order", ascending: true)
            .execute()
            .value
        else { return }
        slatePicks = rows
    }

    private struct CFBSlatePickRow: Decodable, Sendable {
        let gameId: FlexibleText
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
            case gameId = "game_id"
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
            gameId = try c.decode(FlexibleText.self, forKey: .gameId)
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

    private struct FlexibleText: Decodable, Sendable {
        let value: String

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let s = try? c.decode(String.self) {
                value = s
            } else if let i = try? c.decode(Int.self) {
                value = String(i)
            } else if let d = try? c.decode(Double.self) {
                value = d.rounded() == d ? String(Int(d)) : String(d)
            } else {
                value = ""
            }
        }
    }
}
