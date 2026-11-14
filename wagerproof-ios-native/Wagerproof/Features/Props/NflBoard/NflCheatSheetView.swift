import SwiftUI
import WagerproofDesign
import WagerproofModels

struct NflCheatSheetView: View {
    let rows: [NflCheatRow]
    let trenches: [NflTrenchRow]
    @Environment(\.dismiss) private var dismiss
    @State private var family = "rushing"
    @State private var side = "defense"
    @State private var position = "RB"
    @State private var alignment = ""
    @State private var team = ""

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                filters
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                Text(description)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
                DisclosureGroup("What these numbers mean") {
                    columnGuide
                        .padding(.top, 8)
                }
                .font(.system(size: 13, weight: .bold))
                .tint(Color.appTextPrimary)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                ScrollView(.vertical) {
                    LazyVStack(spacing: 10) {
                        if family == "trenches" {
                            if trenchVisible.isEmpty {
                                emptyLine("Trenches are not charted this week.")
                            } else {
                                ForEach(trenchVisible) { row in
                                    trenchCard(row)
                                }
                            }
                        } else if visibleRows.isEmpty {
                            emptyLine("This cut is not charted this week.")
                        } else {
                            ForEach(visibleRows) { row in
                                metricCard(row)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 28)
                }
            }
            .background(Color.appSurface.ignoresSafeArea())
            .navigationTitle("Cheat sheet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private var filters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                menu("Family", familyLabel) {
                    pick("Trenches", "trenches", $family)
                    pick("Passing", "passing", $family)
                    pick("Rushing", "rushing", $family)
                    pick("Receiving", "receiving", $family)
                }
                if family != "trenches" {
                    menu("Side", side == "defense" ? "Defense" : "Offense") {
                        pick("Offense", "offense", $side)
                        pick("Defense", "defense", $side)
                    }
                }
                if showsPosition {
                    menu("Position", position) {
                        ForEach(positions, id: \.self) { value in
                            Button(value) { position = value; alignment = "" }
                        }
                    }
                }
                if family == "receiving" && side == "defense" {
                    menu("Alignment", alignment.isEmpty ? "Any" : alignment.capitalized) {
                        Button("Any") { alignment = "" }
                        Button("Slot") { alignment = "slot" }
                        Button("Wide") { alignment = "wide" }
                    }
                }
                menu("Team", team.isEmpty ? "All teams" : team) {
                    Button("All teams") { team = "" }
                    ForEach(teams, id: \.self) { value in
                        Button(value) { team = value }
                    }
                }
            }
        }
    }

    private var description: String {
        if family == "trenches" {
            return "Offensive line against this week's front. Positive pass or run edge favors the line on the row."
        }
        let who = team.isEmpty ? "Every team" : team
        let cut = alignment.isEmpty ? (showsPosition ? position : "") : alignment
        return "\(who) \(side), \(family)\(cut.isEmpty ? "" : " · \(cut)"). Green helps the side on screen. 1st is best for that side."
    }

    private var tableKey: String {
        if !alignment.isEmpty, family == "receiving" { return alignment == "slot" ? "recv_def_slot" : "recv_def_wide" }
        switch (family, side) {
        case ("passing", "offense"): return "pass_off"
        case ("passing", "defense"): return "pass_def"
        case ("rushing", "offense"): return "rush_off"
        case ("rushing", "defense"): return position == "QB" ? "rush_def_QB" : "rush_def_RB"
        case ("receiving", "offense"): return "recv_off"
        default:
            switch position {
            case "TE": return "recv_def_TE"
            case "RB": return "recv_def_RB"
            default: return "recv_def_WR"
            }
        }
    }

    private var columns: [String] { NflCheatSheetMath.columns[tableKey] ?? [] }

    private var visibleRows: [NflCheatRow] {
        let filtered = rows.filter { row in
            row.tableKey == tableKey && (team.isEmpty || row.team == team)
        }
        guard let key = columns.first else { return filtered }
        return filtered.sorted { lhs, rhs in
            let left = lhs.metrics[key].flatMap { NflCheatSheetMath.teamEdge(side: side, key: key, metric: $0) } ?? -.infinity
            let right = rhs.metrics[key].flatMap { NflCheatSheetMath.teamEdge(side: side, key: key, metric: $0) } ?? -.infinity
            return left > right
        }
    }

    private var trenchVisible: [NflTrenchRow] {
        trenches.filter { team.isEmpty || $0.team == team }
    }

    private var teams: [String] {
        let names = family == "trenches" ? trenches.map(\.team) : rows.map(\.team)
        return Array(Set(names)).sorted()
    }

    private var showsPosition: Bool {
        (family == "rushing" && side == "defense") || (family == "receiving" && side == "defense" && alignment.isEmpty)
    }

    private var positions: [String] {
        family == "rushing" ? ["RB", "QB"] : ["WR", "TE", "RB"]
    }

    private var familyLabel: String {
        switch family {
        case "trenches": return "Trenches"
        case "passing": return "Passing"
        case "receiving": return "Receiving"
        default: return "Rushing"
        }
    }

    private var columnGuide: some View {
        VStack(alignment: .leading, spacing: 8) {
            if family == "trenches" {
                guideLine("Pass edge", "Positive means this offensive line is favored. A gap under 1 percentage point is a wash.")
                guideLine("Run edge", "Positive means this line opens more yards before contact. Under 0.15 yards is a wash.")
            } else {
                ForEach(columns, id: \.self) { key in
                    guideLine(NflCheatSheetMath.label(key), NflCheatSheetMath.helpText(key))
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func guideLine(_ title: String, _ help: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.system(size: 12, weight: .bold))
            Text(help)
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func metricCard(_ row: NflCheatRow) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            teamLockup(team: row.team, opponent: row.opponent, kickoff: row.kickoff)
                .padding(.bottom, 6)
            ForEach(columns, id: \.self) { key in
                metricLine(
                    title: NflCheatSheetMath.label(key),
                    metric: row.metrics[key],
                    key: key
                )
            }
        }
        .sheetCard()
        .overlay(alignment: .leading) {
            UnevenRoundedRectangle(topLeadingRadius: 18, bottomLeadingRadius: 18, bottomTrailingRadius: 0, topTrailingRadius: 0)
                .fill(NFLTeamColors.colorPair(for: row.team).primary)
                .frame(width: 4)
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func trenchCard(_ row: NflTrenchRow) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            teamLockup(team: row.team, opponent: row.opponent, kickoff: row.kickoff)
            edgeLine("Pass edge", "Positive means this offensive line is favored against the front it faces.", NflCheatSheetMath.formatTrenchEdge(pass: true, value: row.passEdge))
            edgeLine("Run edge", "Positive means this offensive line opens more yards before contact.", NflCheatSheetMath.formatTrenchEdge(pass: false, value: row.runEdge))
            metricLine(title: "Pressure faced", metric: row.pressure, key: "sack_rate")
            metricLine(title: "Yards before contact", metric: row.yardsBeforeContact, key: "yoe_per_target")
            metricLine(title: "Front pressure", metric: row.frontPressure, key: "sack_rate")
            metricLine(title: "Front yards", metric: row.frontYards, key: "yoe_per_target")
        }
        .sheetCard()
        .overlay(alignment: .leading) {
            UnevenRoundedRectangle(topLeadingRadius: 18, bottomLeadingRadius: 18, bottomTrailingRadius: 0, topTrailingRadius: 0)
                .fill(NFLTeamColors.colorPair(for: row.team).primary)
                .frame(width: 4)
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func teamLockup(team: String, opponent: String, kickoff: String?) -> some View {
        HStack(spacing: 10) {
            GameCardTeamAvatar(teamName: team, sport: "nfl", size: 36, colors: NFLTeamColors.colorPair(for: team))
            VStack(alignment: .leading, spacing: 2) {
                Text(team)
                    .font(.system(size: 17, weight: .bold))
                Text(versusLine(opponent: opponent, kickoff: kickoff))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.appTextMuted)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
    }

    private func versusLine(opponent: String, kickoff: String?) -> String {
        let kick = NflPropBoardCopy.kickoffLabel(kickoff)
        if opponent.isEmpty { return kick ?? "Bye" }
        if let kick { return "vs \(opponent) · \(kick)" }
        return "vs \(opponent)"
    }

    private func metricLine(title: String, metric: NflCheatMetric?, key: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let metric, let actual = metric.actual {
                VStack(alignment: .trailing, spacing: 1) {
                    Text(NflCheatSheetMath.formatActual(key, actual))
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                    if let gap = NflCheatSheetMath.gap(side: side, key: key, metric: metric) {
                        Text("\(gap.text) vs league")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(tone(gap.tone))
                    }
                    if let rank = NflCheatSheetMath.rankLabel(side: side, key: key, metric: metric) {
                        let gapTone = NflCheatSheetMath.gap(side: side, key: key, metric: metric)?.tone ?? .nilTone
                        Text(rank)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(tone(gapTone))
                    }
                }
            } else {
                Text("not charted this week")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.appTextMuted)
                    .multilineTextAlignment(.trailing)
            }
        }
        .padding(.vertical, 8)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.appBorder.opacity(0.35)).frame(height: 1)
        }
    }

    private func edgeLine(_ title: String, _ help: String, _ edge: (text: String, tone: NflCheatSheetMath.Tone)?) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .frame(maxWidth: .infinity, alignment: .leading)
            if let edge {
                Text(edge.text)
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(tone(edge.tone))
            } else {
                Text("not charted this week")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.appTextMuted)
            }
        }
        .padding(.vertical, 8)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.appBorder.opacity(0.35)).frame(height: 1)
        }
        .accessibilityHint(help)
    }

    private func emptyLine(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(Color.appTextMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 12)
    }

    private func tone(_ tone: NflCheatSheetMath.Tone) -> Color {
        switch tone {
        case .pos: return NflCardInk.green
        case .neg: return NflCardInk.red
        case .nilTone: return Color.appTextMuted
        }
    }

    private func menu<Content: View>(_ title: String, _ value: String, @ViewBuilder content: () -> Content) -> some View {
        Menu {
            content()
        } label: {
            HStack(spacing: 6) {
                Text(value)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Color.appTextMuted)
            }
            .padding(.horizontal, 14)
            .frame(height: 36)
            .liquidGlassBackground(in: Capsule(), interactive: true)
            .overlay(Capsule().stroke(Color.appBorder.opacity(0.35), lineWidth: 1))
        }
        .accessibilityLabel(title)
    }

    private func pick(_ label: String, _ value: String, _ binding: Binding<String>) -> some View {
        Button(label) { binding.wrappedValue = value }
    }
}

private extension View {
    func sheetCard() -> some View {
        padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(light: 0xFFFFFF, dark: 0x202024), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color.appBorder.opacity(0.6), lineWidth: 1))
    }
}
