import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// College board for the game sheet, in the same order as the website:
/// full game, first half, signals, head-to-head, last 5, Ratings, thrill,
/// agent consensus, then the early-season note.
struct NCAABWiredSections: View {
    let game: NCAABGame
    let store: NCAABGameDetailStore

    private var awayAbbr: String {
        let trimmed = game.awayTeamAbbrev?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? TeamInitials.from(game.awayTeam) : trimmed
    }
    private var homeAbbr: String {
        let trimmed = game.homeTeamAbbrev?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? TeamInitials.from(game.homeTeam) : trimmed
    }

    var body: some View {
        VStack(spacing: 0) {
            if store.failed {
                noteCard("College board", systemImage: "sportscourt", text: "Couldn’t load this game’s college board.")
            } else if let board = store.board {
                modelCard("Full game", lines: board.fullGame)
                modelCard("First half", lines: board.firstHalf)
                signalsCard(board)
                marketsCard("Head to head", systemImage: "arrow.left.arrow.right", caption: "Season records. Series records are from the home side when that meeting is on file.", board: board, chips: false)
                marketsCard("Last 5", systemImage: "clock.arrow.circlepath", caption: "Newest first. Opening week still shows last season.", board: board, chips: true)
                ratingsCard(board)
                thrillCard(board)
            } else {
                noteCard("College board", systemImage: "sportscourt", text: "Loading the board…")
            }
            AgentConsensusSection(sport: .ncaab, gameId: GameConsensusKey.ncaab(game), gameDate: game.gameDate)
            if store.board?.earlySeason == true {
                noteCard("Early season", systemImage: "info.circle", text: NCAABCopy.earlyNote)
            }
        }
    }

    private func modelCard(_ title: String, lines: [NCAABModelLine]) -> some View {
        WidgetCollapsingSection(title: title, systemImage: "sportscourt") {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(lines) { line in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(line.label.uppercased())
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Color.appTextSecondary)
                            Spacer()
                            if line.play { playBadge }
                        }
                        HStack {
                            labeled("Model", line.model)
                            labeled("Line", line.posted)
                        }
                        if !line.disagreement.isEmpty {
                            Text(line.disagreement)
                                .font(.system(size: 12))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                        if let side = line.betSide {
                            Text(side)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                        }
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.appTextPrimary.opacity(0.04), in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }

    private func signalsCard(_ board: NCAABDetailBoard) -> some View {
        WidgetCollapsingSection(title: "Signals", systemImage: "flag.fill") {
            if board.signals.isEmpty {
                Text("No signals on this game.")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(board.signals) { signal in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(signal.name)
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundStyle(Color.appTextPrimary)
                                    if !signal.side.isEmpty {
                                        Text(signal.side)
                                            .font(.system(size: 14, weight: .medium))
                                            .foregroundStyle(Color.appTextPrimary)
                                    }
                                }
                                Spacer(minLength: 8)
                                if signal.play { playBadge }
                            }
                            if !signal.trigger.isEmpty {
                                Text(signal.trigger)
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.appTextSecondary)
                            }
                            if !signal.record.isEmpty {
                                Text(signal.record)
                                    .font(.system(size: 11))
                                    .foregroundStyle(Color.appTextMuted)
                            }
                            if !signal.seasonRecord.isEmpty {
                                Text(signal.seasonRecord)
                                    .font(.system(size: 11))
                                    .foregroundStyle(Color.appTextMuted)
                            }
                        }
                    }
                }
            }
        }
    }

    private func marketsCard(_ title: String, systemImage: String, caption: String, board: NCAABDetailBoard, chips: Bool) -> some View {
        WidgetCollapsingSection(title: title, systemImage: systemImage) {
            VStack(alignment: .leading, spacing: 12) {
                Text(caption)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
                ForEach(board.markets) { market in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(market.label.uppercased())
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Color.appTextMuted)
                        HStack(alignment: .top, spacing: 8) {
                            teamTrend(abbr: awayAbbr, record: market.awayRecord, chips: market.awayChips, showRecord: !chips, showChips: chips)
                            teamTrend(abbr: homeAbbr, record: market.homeRecord, chips: market.homeChips, showRecord: !chips, showChips: chips)
                        }
                        if !chips {
                            Text(market.series)
                                .font(.system(size: 11))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                    }
                }
            }
        }
    }

    private func teamTrend(abbr: String, record: String, chips: [String], showRecord: Bool, showChips: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(abbr)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                if showRecord {
                    Text(record)
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color.appTextPrimary)
                }
            }
            if showChips {
                HStack(spacing: 4) {
                    if chips.isEmpty {
                        Text("No L5")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Color.appTextMuted)
                    } else {
                        Text("L\(min(chips.count, 5))")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Color.appTextMuted)
                        ForEach(Array(chips.prefix(5).enumerated()), id: \.offset) { _, chip in
                            Text(String(chip.prefix(1)).uppercased())
                                .font(.system(size: 8, weight: .black))
                                .foregroundStyle(Color.white)
                                .frame(width: 17, height: 17)
                                .background(chipColor(chip), in: Circle())
                        }
                    }
                }
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appTextPrimary.opacity(0.04), in: RoundedRectangle(cornerRadius: 12))
    }

    private func ratingsCard(_ board: NCAABDetailBoard) -> some View {
        WidgetCollapsingSection(title: "Ratings", systemImage: "chart.bar.fill") {
            VStack(spacing: 8) {
                HStack {
                    Text(awayAbbr).font(.system(size: 13, weight: .bold))
                    Spacer()
                    Text("at").font(.system(size: 10, weight: .semibold)).foregroundStyle(Color.appTextMuted)
                    Spacer()
                    Text(homeAbbr).font(.system(size: 13, weight: .bold))
                }
                .foregroundStyle(Color.appTextPrimary)
                if board.awayRecord != nil || board.homeRecord != nil {
                    ratingRow(label: "Record", away: board.awayRecord ?? "—", home: board.homeRecord ?? "—", better: nil)
                }
                ForEach(board.ratings) { row in
                    ratingRow(label: row.label, away: row.away, home: row.home, better: row.better)
                }
            }
        }
    }

    private func ratingRow(label: String, away: String, home: String, better: String?) -> some View {
        HStack {
            Text(away)
                .frame(width: 72, alignment: .leading)
                .foregroundStyle(better == "away" ? betterColor : (better == "home" ? Color.appTextMuted : Color.appTextPrimary))
            Spacer()
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
                .lineLimit(1)
            Spacer()
            Text(home)
                .frame(width: 72, alignment: .trailing)
                .foregroundStyle(better == "home" ? betterColor : (better == "away" ? Color.appTextMuted : Color.appTextPrimary))
        }
        .font(.system(size: 13, weight: .bold, design: .monospaced))
    }

    private func thrillCard(_ board: NCAABDetailBoard) -> some View {
        WidgetCollapsingSection(title: "Thrill score", systemImage: "sparkles") {
            if let score = board.thrillScore {
                VStack(alignment: .leading, spacing: 6) {
                    Text(score)
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.appTextPrimary)
                    if !board.thrillDetail.isEmpty {
                        Text(board.thrillDetail)
                            .font(.system(size: 14))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                Text(NCAABCopy.thrillEmpty)
                    .font(.system(size: 14))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func noteCard(_ title: String, systemImage: String, text: String) -> some View {
        WidgetCollapsingSection(title: title, systemImage: systemImage) {
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func labeled(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var playBadge: some View {
        Text("PLAY")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(Color.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(betterColor, in: Capsule())
    }

    private var betterColor: Color { Color(red: 0.02, green: 0.59, blue: 0.41) }

    private func chipColor(_ raw: String) -> Color {
        switch raw.uppercased().first {
        case "W", "O", "C": return betterColor
        case "L", "U": return Color(red: 0.86, green: 0.15, blue: 0.15)
        default: return Color.appTextMuted
        }
    }
}

struct NCAABSignalsIndex: View {
    let rows: [NCAABCatalogLine]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 12) {
                    Text("Every college basketball read, with its back-test and this season.")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.appTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if rows.isEmpty {
                        Text("No signals are on file yet.")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.appTextSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    ForEach(rows) { row in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(alignment: .top) {
                                Text(row.name)
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(Color.appTextPrimary)
                                Spacer(minLength: 8)
                                Text(row.active ? "ACTIVE" : "TRACKING")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(row.active ? Color.white : Color.appTextSecondary)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(row.active ? Color(red: 0.02, green: 0.59, blue: 0.41) : Color.appTextPrimary.opacity(0.08), in: Capsule())
                            }
                            if !row.market.isEmpty {
                                Text(row.market.uppercased())
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(Color.appTextMuted)
                            }
                            if !row.oneLiner.isEmpty {
                                Text(row.oneLiner)
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color.appTextPrimary)
                            }
                            if !row.record.isEmpty {
                                Text(row.record).font(.system(size: 12)).foregroundStyle(Color.appTextSecondary)
                            }
                            if !row.seasonRecord.isEmpty {
                                Text(row.seasonRecord).font(.system(size: 12)).foregroundStyle(Color.appTextSecondary)
                            }
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.appSurface, in: RoundedRectangle(cornerRadius: 16))
                    }
                }
                .padding(16)
            }
            .background(Color.appSurface)
            .navigationTitle("College signals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
