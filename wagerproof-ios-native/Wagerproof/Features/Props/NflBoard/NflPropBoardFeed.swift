import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

struct NflBoardSelection: Hashable, Identifiable {
    let playerId: String
    let market: String
    var id: String { playerId }
    var transitionID: String { "nfl-board-\(playerId)" }
}

struct NflPropBoardFeed: View {
    let board: NflPropBoardStore
    @Binding var rail: String
    let query: String
    let namespace: Namespace.ID
    let onSelect: (NflBoardSelection) -> Void

    var body: some View {
        let rows = NflPropBoardList.rows(
            pages: board.pages,
            spotlight: board.spotlight,
            books: board.books,
            rail: rail,
            query: query
        )
        if board.isLoading && board.pages.isEmpty {
            ProgressView("Loading the NFL board")
                .frame(maxWidth: .infinity)
                .padding(.top, 48)
        } else if let message = board.errorMessage, board.pages.isEmpty {
            Text(message)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.appTextMuted)
                .padding(24)
        } else if rows.isEmpty {
            Text(emptyCopy)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
                .frame(maxWidth: .infinity)
                .padding(.top, 48)
        } else {
            ForEach(rows) { row in
                NflPropBoardCard(row: row, namespace: namespace) {
                    onSelect(NflBoardSelection(playerId: row.playerId, market: row.marketKey))
                }
                .padding(.horizontal, 12)
            }
        }
    }

    private var emptyCopy: String {
        if rail == "spotlight" { return "No spotlight picks this week" }
        if rail == "leans" { return "No unanimous leans this week" }
        if !query.isEmpty { return "No players match that search" }
        return "🏈 The NFL props board opens with the week's slate."
    }
}

struct NflPropBoardCard: View {
    let row: NflPropListRow
    let namespace: Namespace.ID
    let onSelect: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .center, spacing: 10) {
                    NFLPlayerHeadshot(playerName: row.name, playerId: row.playerId, headshotUrl: row.headshotUrl, size: 46)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(row.name)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                            .lineLimit(1)
                        Text(meta)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.appTextMuted)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    if let badge = row.badge {
                        Text(badge == "Spotlight" ? "🔦 \(badge)" : "📈 \(badge)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(badge == "Spotlight" ? NflCardInk.green : Color(hex: 0x0EA5E9))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background((badge == "Spotlight" ? NflCardInk.green : Color(hex: 0x0EA5E9)).opacity(0.14), in: Capsule())
                    }
                }
                Text(pill)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Color.appSurfaceMuted, in: Capsule())
                HStack(spacing: 8) {
                    if let book = row.bookName, !book.isEmpty {
                        SportsbookLogoView(
                            logoURL: nil,
                            bookKey: SportsbookCatalog.key(forDisplayName: book),
                            bookName: book,
                            style: .compact
                        )
                        .frame(width: 18, height: 18)
                    }
                    if let line = row.bookLine ?? row.line {
                        Text(NflPropBoardCopy.formatLine(line))
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundStyle(NflCardInk.line)
                    }
                    if let price = NflPropRecord.formatAmerican(row.bookPrice) {
                        Text(price)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.appTextPrimary)
                    }
                    Spacer(minLength: 4)
                    if let kick = NflPropBoardCopy.kickoffLabel(row.kickoff) {
                        Text(kick)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color.appTextMuted)
                            .lineLimit(1)
                    }
                }
            }
            .padding(12)
            .background {
                let shape = RoundedRectangle(cornerRadius: 22, style: .continuous)
                let wash = NFLTeamColors.colors(for: row.team ?? "").primary.teamVisible(in: colorScheme)
                ZStack {
                    shape.fill(Color(light: 0xFFFFFF, dark: 0x202024))
                    shape.fill(
                        RadialGradient(colors: [wash.opacity(0.22), .clear], center: .topLeading, startRadius: 0, endRadius: 180)
                    )
                    shape.strokeBorder(Color.appBorder.opacity(0.7), lineWidth: 1)
                }
            }
        }
        .buttonStyle(.plain)
        .matchedTransitionSource(id: "nfl-board-\(row.playerId)", in: namespace)
    }

    private var meta: String {
        let pos = row.position ?? ""
        let team = row.team ?? ""
        let opp = row.opponent ?? ""
        let versus = row.isHome == false ? "@ \(opp)" : "vs \(opp)"
        return [pos, team, versus].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    private var pill: String {
        let side = row.side == "under" ? "Under" : row.side == "over" ? "Over" : ""
        let line = row.line.map { " \(NflPropBoardCopy.formatLine($0))" } ?? ""
        return "\(NflPropBoardCopy.compactMarket(row.marketLabel)) \(side)\(line)".trimmingCharacters(in: .whitespaces)
    }
}

enum NflCardInk {
    static let green = Color(hex: 0x10B981)
    static let red = Color(hex: 0xF43F5E)
    static let line = Color(hex: 0x0EA5E9)
}
