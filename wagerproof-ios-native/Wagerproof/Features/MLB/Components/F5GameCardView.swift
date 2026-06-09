import SwiftUI
import WagerproofDesign
import WagerproofModels

/// One game's First-Five splits comparison card. Ports the RN `F5GameCard`
/// in `app/(drawer)/(tabs)/mlb-f5-splits.tsx`, restyled to the MLB feed card
/// shell (cornerRadius-26 glass surface). Away team on the left, home on the
/// right, with three stat sections (pitching matchup, first-five offense,
/// first-five defense). Green = stronger side; metric labels open a help alert.
struct F5GameCardView: View {
    let game: MLBF5Game
    let lookup: [String: MLBF5SplitRow]

    @State private var helpItem: F5MetricHelp?

    private var awaySplit: MLBF5SplitRow? {
        MLBF5.findSplitRow(lookup, teamAbbr: game.awayAbbr, homeAway: "away", oppSpHand: game.homeSpHand)
    }
    private var homeSplit: MLBF5SplitRow? {
        MLBF5.findSplitRow(lookup, teamAbbr: game.homeAbbr, homeAway: "home", oppSpHand: game.awaySpHand)
    }

    var body: some View {
        let awaySplit = self.awaySplit
        let homeSplit = self.homeSplit
        let awayOk = MLBF5.isShowable(awaySplit?.games)
        let homeOk = MLBF5.isShowable(homeSplit?.games)
        let awayDefense = F5Helpers.defenseFor(awaySplit, ownHand: game.awaySpHand)
        let homeDefense = F5Helpers.defenseFor(homeSplit, ownHand: game.homeSpHand)
        let recordColors = F5Helpers.betterHigher(awaySplit?.f5WinPct, homeSplit?.f5WinPct)
        let overColors = F5Helpers.betterHigher(awaySplit?.f5OverPct, homeSplit?.f5OverPct)
        let runsColors = F5Helpers.betterHigher(awaySplit?.avgF5Rs, homeSplit?.avgF5Rs)
        let seasonRunsColors = F5Helpers.betterHigher(awaySplit?.seasonAvgF5Rs, homeSplit?.seasonAvgF5Rs)
        let defenseColors = F5Helpers.betterLower(awayDefense?.avgRa, homeDefense?.avgRa)
        let seasonDefenseColors = F5Helpers.betterLower(awaySplit?.seasonAvgF5Ra, homeSplit?.seasonAvgF5Ra)
        let awayQualifier = "\(game.awayAbbr) away vs \(MLBF5.pitchHandLabel(game.homeSpHand))"
        let homeQualifier = "\(game.homeAbbr) home vs \(MLBF5.pitchHandLabel(game.awaySpHand))"

        VStack(alignment: .leading, spacing: 0) {
            header
            if game.venueName != nil || game.totalLine != nil {
                Text(venueLine)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 2)
                    .padding(.bottom, 10)
            }

            teamsRow

            if game.homeSpHand == .left || game.awaySpHand == .left {
                Text("* LHP split samples can be thin early in the season. Small samples show real data with caution.")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appAccentAmber)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 6)
            }

            // Pitching matchup
            sectionTitle("⚾ Tonight's pitching matchup")
            compareRow(
                label: "⚾ Starting pitcher", helpKey: "starting_pitcher",
                away: .text(pitcherText(game.awaySpName, game.awaySpHand), nil),
                home: .text(pitcherText(game.homeSpName, game.homeSpHand), nil)
            )
            compareRow(
                label: "🎯 Opposing starter", helpKey: "opposing_starter",
                away: .text(pitcherText(game.homeSpName, game.homeSpHand), nil),
                home: .text(pitcherText(game.awaySpName, game.awaySpHand), nil)
            )
            compareRow(label: "📍 Location", helpKey: "location",
                       away: .text("On the Road", nil), home: .text("At Home", nil))

            // First-five offense
            sectionTitle("🔥 First-five offensive performance", subtitle: "\(awayQualifier) · \(homeQualifier)")
            compareRow(
                label: "📊 Split W-L", helpKey: "split_record",
                away: .text(awayOk ? MLBF5.recordWithPct(awaySplit) : "Not enough", recordColors.0),
                home: .text(homeOk ? MLBF5.recordWithPct(homeSplit) : "Not enough", recordColors.1),
                awaySub: awayOk ? F5Helpers.sampleText(awaySplit) : nil,
                homeSub: homeOk ? F5Helpers.sampleText(homeSplit) : nil
            )
            compareRow(
                label: "📈 O/U record", helpKey: "ou_record",
                away: .text(awayOk ? (awaySplit?.f5OuRecord ?? "-") : "-", overColors.0),
                home: .text(homeOk ? (homeSplit?.f5OuRecord ?? "-") : "-", overColors.1),
                awaySub: awayOk ? "\(MLBF5.formatPct(awaySplit?.f5OverPct)) over" : nil,
                homeSub: homeOk ? "\(MLBF5.formatPct(homeSplit?.f5OverPct)) over" : nil
            )
            compareRow(
                label: "⚡ Split runs scored", helpKey: "split_runs_scored",
                away: .text(awayOk ? MLBF5.formatNumber(awaySplit?.avgF5Rs) : "-", runsColors.0),
                home: .text(homeOk ? MLBF5.formatNumber(homeSplit?.avgF5Rs) : "-", runsColors.1),
                awaySub: awayOk ? F5Helpers.sampleText(awaySplit) : nil,
                homeSub: homeOk ? F5Helpers.sampleText(homeSplit) : nil
            )
            compareRow(
                label: "📅 Season runs scored", helpKey: "season_runs_scored",
                away: .text(awayOk ? MLBF5.formatNumber(awaySplit?.seasonAvgF5Rs) : "-", seasonRunsColors.0),
                home: .text(homeOk ? MLBF5.formatNumber(homeSplit?.seasonAvgF5Rs) : "-", seasonRunsColors.1),
                awaySub: "all games", homeSub: "all games"
            )
            compareRow(
                label: "↔️ Scoring delta", helpKey: "scoring_delta",
                away: awaySplit != nil ? .diff(awaySplit?.rsDiffVsSeason, false) : .text("-", nil),
                home: homeSplit != nil ? .diff(homeSplit?.rsDiffVsSeason, false) : .text("-", nil),
                awaySub: "split vs season", homeSub: "split vs season"
            )

            // First-five defense
            sectionTitle("🛡️ First-five defensive performance", subtitle: "Own starter hand · green = fewer runs allowed")
            compareRow(
                label: "🛡️ Avg F5 runs allowed", helpKey: "runs_allowed",
                away: .text(awayDefense.map { "\(MLBF5.formatNumber($0.avgRa)) (\(MLBF5.formatDiff($0.diff)))" } ?? "-", defenseColors.0),
                home: .text(homeDefense.map { "\(MLBF5.formatNumber($0.avgRa)) (\(MLBF5.formatDiff($0.diff)))" } ?? "-", defenseColors.1),
                awaySub: F5Helpers.defenseSubtext(awaySplit, ownHand: game.awaySpHand),
                homeSub: F5Helpers.defenseSubtext(homeSplit, ownHand: game.homeSpHand)
            )
            compareRow(
                label: "📅 Season runs allowed", helpKey: "season_runs_allowed",
                away: .text(awayOk ? MLBF5.formatNumber(awaySplit?.seasonAvgF5Ra) : "-", seasonDefenseColors.0),
                home: .text(homeOk ? MLBF5.formatNumber(homeSplit?.seasonAvgF5Ra) : "-", seasonDefenseColors.1),
                awaySub: "all games", homeSub: "all games"
            )
            compareRow(
                label: "↔️ Allowed delta", helpKey: "allowed_delta",
                away: awayDefense != nil ? .diff(awayDefense?.diff, true) : .text("-", nil),
                home: homeDefense != nil ? .diff(homeDefense?.diff, true) : .text("-", nil),
                awaySub: "split vs season", homeSub: "split vs season"
            )
        }
        .padding(14)
        .background(cardSurface)
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
        .alert(item: $helpItem) { item in
            Alert(title: Text(item.title), message: Text(item.body), dismissButton: .default(Text("Got it")))
        }
    }

    // MARK: - Subviews

    private var cardSurface: some View {
        RoundedRectangle(cornerRadius: 26, style: .continuous)
            .fill(.ultraThinMaterial)
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text("\(MLBFormatting.dateLabel(game.officialDate)) · \(MLBFormatting.gameTime(game.gameTimeEt))".uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
                Text("\(game.awayAbbr) @ \(game.homeAbbr)")
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            Text("F5 O/U \(game.f5TotalLine.map { MLBF5.formatNumber($0, digits: 1) } ?? "-")")
                .font(.system(size: 11, weight: .heavy))
                .foregroundStyle(Color.appTextSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color.appSurfaceMuted.opacity(0.7), in: Capsule())
        }
        .padding(.bottom, 12)
    }

    private var venueLine: String {
        var parts: [String] = [game.venueName ?? "Venue TBD"]
        if let total = game.totalLine { parts.append("Game total \(MLBF5.formatNumber(total, digits: 1))") }
        return parts.joined(separator: " · ")
    }

    private var teamsRow: some View {
        HStack(alignment: .center, spacing: 10) {
            teamBlock(name: game.awayTeamName, abbr: game.awayAbbr, sp: game.awaySpName, hand: game.awaySpHand, ml: game.f5AwayMl, alignment: .leading)
            Image(systemName: "at")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            teamBlock(name: game.homeTeamName, abbr: game.homeAbbr, sp: game.homeSpName, hand: game.homeSpHand, ml: game.f5HomeMl, alignment: .trailing)
        }
        .padding(.bottom, 8)
    }

    private func teamBlock(name: String, abbr: String, sp: String?, hand: MLBF5PitchHand?, ml: Double?, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 3) {
            MLBTeamLogo(logoUrl: MLBTeams.info(for: name)?.logoUrl, abbrev: abbr, name: name, size: 46)
            Text("\(sp ?? "Starter TBD")\(hand != nil ? " (\(MLBF5.pitchHandLabel(hand)))" : "")")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .lineLimit(1)
            Text("F5 ML \(MLBF5.formatMoneyline(ml))")
                .font(.system(size: 11, weight: .heavy))
                .foregroundStyle(Color.appAccentBlue)
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }

    private func sectionTitle(_ title: String, subtitle: String? = nil) -> some View {
        VStack(spacing: 3) {
            Text(title)
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
                .multilineTextAlignment(.center)
            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 12)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.appBorder.opacity(0.6)).frame(height: 0.5)
        }
        .padding(.bottom, 2)
    }

    private func compareRow(label: String, helpKey: String?, away: F5Cell, home: F5Cell, awaySub: String? = nil, homeSub: String? = nil) -> some View {
        HStack(alignment: .center, spacing: 8) {
            cellView(away, sub: awaySub)
                .frame(maxWidth: .infinity)
            Button {
                if let helpKey, let help = F5MetricHelp.all[helpKey] { helpItem = help }
            } label: {
                VStack(spacing: 2) {
                    Text(label)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                    if helpKey != nil {
                        Image(systemName: "info.circle")
                            .font(.system(size: 9))
                            .foregroundStyle(Color.appTextMuted)
                    }
                }
                .frame(width: 116)
            }
            .buttonStyle(.plain)
            .disabled(helpKey == nil)
            cellView(home, sub: homeSub)
                .frame(maxWidth: .infinity)
        }
        .padding(.top, 9)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.appBorder.opacity(0.45)).frame(height: 0.5)
        }
        .padding(.top, 0)
    }

    @ViewBuilder
    private func cellView(_ cell: F5Cell, sub: String?) -> some View {
        VStack(spacing: 2) {
            switch cell {
            case .text(let value, let color):
                Text(value)
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(color ?? Color.appTextPrimary)
                    .multilineTextAlignment(.center)
            case .diff(let value, let goodWhenNegative):
                F5DiffText(value: value, goodWhenNegative: goodWhenNegative)
            }
            if let sub {
                Text(sub)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.appTextMuted)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private func pitcherText(_ name: String?, _ hand: MLBF5PitchHand?) -> String {
        "\(name ?? "TBD")\(hand != nil ? " (\(MLBF5.pitchHandLabel(hand)))" : "")"
    }
}

// MARK: - Cell + diff rendering

enum F5Cell {
    case text(String, Color?)
    case diff(Double?, Bool)   // value, goodWhenNegative
}

private struct F5DiffText: View {
    let value: Double?
    let goodWhenNegative: Bool

    var body: some View {
        if let n = value, n.isFinite {
            let isGood = goodWhenNegative ? n < 0 : n > 0
            let isBad = goodWhenNegative ? n > 0 : n < 0
            let color: Color = isGood ? .appWin : (isBad ? .appLoss : .appTextSecondary)
            let icon = n > 0 ? "arrow.up" : (n < 0 ? "arrow.down" : "minus")
            HStack(spacing: 2) {
                Image(systemName: icon).font(.system(size: 11, weight: .bold))
                Text(MLBF5.formatDiff(n)).font(.system(size: 12, weight: .heavy))
            }
            .foregroundStyle(color)
        } else {
            Text("-").font(.system(size: 12, weight: .heavy)).foregroundStyle(Color.appTextPrimary)
        }
    }
}

// MARK: - Card-local helpers

enum F5Helpers {
    static func betterHigher(_ a: Double?, _ b: Double?) -> (Color?, Color?) {
        guard let a, let b, a != b else { return (nil, nil) }
        return a > b ? (.appWin, .appLoss) : (.appLoss, .appWin)
    }
    static func betterLower(_ a: Double?, _ b: Double?) -> (Color?, Color?) {
        guard let a, let b, a != b else { return (nil, nil) }
        return a < b ? (.appWin, .appLoss) : (.appLoss, .appWin)
    }

    struct Defense { let games: Int; let avgRa: Double; let diff: Double }

    static func defenseFor(_ split: MLBF5SplitRow?, ownHand: MLBF5PitchHand?) -> Defense? {
        guard let split, let ownHand else { return nil }
        let games = ownHand == .right ? split.gamesWithOwnRhp : split.gamesWithOwnLhp
        let avgRa = ownHand == .right ? split.avgF5RaWhenOwnRhp : split.avgF5RaWhenOwnLhp
        let diff = ownHand == .right ? split.raDiffVsSeasonWhenOwnRhp : split.raDiffVsSeasonWhenOwnLhp
        guard MLBF5.isShowable(games), let avgRa, let diff else { return nil }
        return Defense(games: games, avgRa: avgRa, diff: diff)
    }

    static func defenseSubtext(_ row: MLBF5SplitRow?, ownHand: MLBF5PitchHand?) -> String? {
        guard let row, let ownHand else { return nil }
        let games = ownHand == .right ? row.gamesWithOwnRhp : row.gamesWithOwnLhp
        guard MLBF5.isShowable(games) else { return nil }
        return "\(games)g with \(ownHand == .right ? "right" : "left")-handed starter"
    }

    static func sampleText(_ row: MLBF5SplitRow?) -> String? {
        guard let row else { return nil }
        return row.games < MLBF5.Sample.small ? "\(row.games) games · small sample" : "\(row.games) games"
    }
}

struct F5MetricHelp: Identifiable {
    let id: String
    let title: String
    let body: String

    static let all: [String: F5MetricHelp] = {
        let entries: [(String, String, String)] = [
            ("starting_pitcher", "Starting pitcher", "The pitcher starting for each team tonight. Their throwing hand helps determine which team split is used."),
            ("opposing_starter", "Opposing starter", "The pitcher each offense is facing tonight. Away teams are evaluated by away games vs this pitcher hand; home teams by home games vs this pitcher hand."),
            ("location", "Location", "Shows whether each team is playing on the road or at home. F5 split records are separated by home/away context."),
            ("split_record", "Split W-L", "First-five inning win-loss-tie record in the matching split: team location plus opposing starter hand."),
            ("ou_record", "O/U record", "How often that team split went over or under the first-five total. The percent below shows over rate."),
            ("split_runs_scored", "Split runs scored", "Average runs scored in the first five innings for this exact split: home/away plus opposing starter hand."),
            ("season_runs_scored", "Season runs scored", "Team season average first-five runs scored across all games. Use it as the baseline for the split."),
            ("scoring_delta", "Scoring delta", "Difference between split first-five runs scored and season average. Positive means this split scores more than usual."),
            ("runs_allowed", "Avg F5 runs allowed", "Average first-five runs allowed when this team starts a pitcher with tonight's starter hand. Lower is better."),
            ("season_runs_allowed", "Season runs allowed", "Team season average first-five runs allowed across all games. Use it as the baseline for the starter-hand split."),
            ("allowed_delta", "Allowed delta", "Difference between starter-hand split runs allowed and season average. Negative means this team allows fewer first-five runs in this setup."),
        ]
        return Dictionary(uniqueKeysWithValues: entries.map { ($0.0, F5MetricHelp(id: $0.0, title: $0.1, body: $0.2)) })
    }()
}
