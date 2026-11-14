import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices

struct NflPropNarrativesView: View {
    @State private var rows: [FootballPropNarrative] = []
    @State private var loading = true
    @State private var filter = "ALL"

    private var shown: [FootballPropNarrative] {
        let latest = rows.map(\.week).max() ?? 0
        let current = rows.filter { $0.week == latest && $0.result == nil }
        let graded = rows.filter { $0.result != nil }.prefix(20)
        let pool = current + graded
        switch filter {
        case "QB": return pool.filter { $0.position == "QB" }
        case "WR/TE": return pool.filter { $0.position == "WR" || $0.position == "TE" }
        case "RB": return pool.filter { $0.position == "RB" }
        default: return pool
        }
    }

    var body: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 12) {
                Picker("Position", selection: $filter) {
                    Text("All").tag("ALL")
                    Text("QB").tag("QB")
                    Text("WR/TE").tag("WR/TE")
                    Text("RB").tag("RB")
                }
                .pickerStyle(.segmented)
                if loading && rows.isEmpty {
                    ProgressView("Loading the player prop report")
                        .frame(maxWidth: .infinity)
                        .padding(.top, 32)
                } else if shown.isEmpty {
                    Text("No prop reads on this week's report.")
                        .foregroundStyle(Color.appTextMuted)
                } else {
                    ForEach(shown) { row in
                        narrativeCard(row)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 110)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle("Player Prop Report")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            rows = await FootballRegressionService.shared.narratives()
            loading = false
        }
    }

    private func narrativeCard(_ row: FootballPropNarrative) -> some View {
        let over = row.direction != "under"
        let accent = over ? NflCardInk.green : NflCardInk.red
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                NFLPlayerHeadshot(playerName: row.playerName, playerId: nil, headshotUrl: row.headshotUrl, size: 48)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(row.playerName).font(.system(size: 15, weight: .black))
                        if let position = row.position {
                            Text(position)
                                .font(.system(size: 10, weight: .bold))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.appSurfaceMuted, in: Capsule())
                        }
                        Text("numbers point \(row.direction ?? "")")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(accent)
                    }
                    HStack(spacing: 4) {
                        GameCardTeamAvatar(teamName: row.team ?? "", sport: "nfl", size: 16)
                        Text(row.team ?? "")
                        Text("vs")
                        GameCardTeamAvatar(teamName: row.opp ?? "", sport: "nfl", size: 16)
                        Text(row.opp ?? "")
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
                    Text("\(marketLabel(row.market)) \(row.line.map(NflPropBoardCopy.formatLine) ?? "")")
                        .font(.system(size: 14, weight: .bold))
                    priceLine(row)
                }
            }
            if let result = row.result {
                Text(result == "win" ? "✅ Read was right" : result == "loss" ? "❌ Read was wrong" : "➖ Push")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(result == "win" ? NflCardInk.green : result == "loss" ? NflCardInk.red : Color.appTextMuted)
                if let actual = row.actual {
                    Text("actual \(NflPropBoardCopy.formatLine(actual)) vs \(row.line.map(NflPropBoardCopy.formatLine) ?? "")")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextMuted)
                }
            } else if let kick = row.kickoff, let date = NflPropBoardCopy.isoDate(kick), date <= Date() {
                Text("⏳ Game under way · result lands after the final whistle")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color(hex: 0xD97706))
            }
            if let summary = row.summary, !summary.isEmpty {
                Text(summary).font(.system(size: 13)).foregroundStyle(Color.appTextMuted)
            }
            if let body = row.body, !body.isEmpty {
                DisclosureGroup("See every number behind this") {
                    WagerBotMarkdownText(body)
                }
                .font(.system(size: 13, weight: .bold))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(light: 0xFFFFFF, dark: 0x202024), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(alignment: .leading) {
            Rectangle().fill(accent).frame(width: 4)
        }
    }

    @ViewBuilder
    private func priceLine(_ row: FootballPropNarrative) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            if let line = row.bestOverLine {
                Text("Over \(NflPropBoardCopy.formatLine(line)) \(american(row.bestOverPrice)) \(row.bestOverBook ?? "")")
            }
            if let line = row.bestUnderLine {
                Text("Under \(NflPropBoardCopy.formatLine(line)) \(american(row.bestUnderPrice)) \(row.bestUnderBook ?? "")")
            }
        }
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(Color.appTextMuted)
    }

    private func american(_ price: Double?) -> String {
        guard let price else { return "" }
        let rounded = Int(price.rounded())
        return rounded > 0 ? "+\(rounded)" : "\(rounded)"
    }

    private func marketLabel(_ key: String) -> String {
        switch key {
        case "player_reception_yds": return "Receiving yards"
        case "player_receptions": return "Receptions"
        case "player_rush_yds": return "Rushing yards"
        case "player_rush_attempts": return "Rushing attempts"
        case "player_pass_yds": return "Passing yards"
        case "player_pass_completions": return "Completions"
        case "player_pass_attempts": return "Pass attempts"
        default: return key
        }
    }
}
