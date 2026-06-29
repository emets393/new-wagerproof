import SwiftUI
import WagerproofDesign
import WagerproofModels

struct OutliersTrendCard: View {
    let card: OutliersTrendsCard
    var sport: OutliersTrendsSport = .nfl
    var game: OutliersTrendsGame?
    var onExpandPlayers: (() -> Void)?

    private var avatarSport: String {
        switch sport {
        case .ncaaf: return "cfb"
        case .mlb: return "mlb"
        default: return "nfl"
        }
    }

    var body: some View {
        if card.isPlayerOverflow {
            Button(action: { onExpandPlayers?() }) {
                overflowContent
            }
            .buttonStyle(.plain)
        } else {
            cardContent
        }
    }

    private var cardContent: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            if !card.bettingLines.isEmpty {
                bettingLinesBlock
            } else if let line = card.lineContext {
                Text(line)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
            }
            VStack(alignment: .leading, spacing: 6) {
                ForEach(card.rows) { row in
                    HStack(alignment: .top, spacing: 6) {
                        Circle()
                            .fill(trendColor(row.dominantPct))
                            .frame(width: 6, height: 6)
                            .padding(.top, 5)
                        Text(rowDisplayText(row))
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 4)
                        Text("\(Int((row.dominantPct * 100).rounded()))%")
                            .font(.system(size: 12, weight: .heavy, design: .rounded))
                            .foregroundStyle(trendColor(row.dominantPct))
                            .monospacedDigit()
                    }
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.appBorder.opacity(0.35), lineWidth: 0.5)
        )
    }

    private var overflowContent: some View {
        HStack(spacing: 10) {
            Image(systemName: "person.3.fill")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Color.appPrimary)
            VStack(alignment: .leading, spacing: 2) {
                Text(card.subjectName)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                if let detail = card.subjectDetail {
                    Text(detail)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appPrimary.opacity(0.08), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.appPrimary.opacity(0.25), lineWidth: 1)
        )
    }

    private var bettingLinesBlock: some View {
        let showBookName = card.bettingLines.count < 2
        return Group {
            if card.bettingLines.count >= 2 {
                HStack(alignment: .top, spacing: 6) {
                    ForEach(card.bettingLines) { line in
                        bettingLineChip(line, showBookName: false)
                            .frame(maxWidth: .infinity)
                    }
                }
            } else {
                ForEach(card.bettingLines) { line in
                    bettingLineChip(line, showBookName: showBookName)
                }
            }
        }
    }

    private func bettingLineChip(_ line: OutliersTrendsBettingLine, showBookName: Bool) -> some View {
        let isOverUnderPair = card.bettingLines.count >= 2
        return HStack(alignment: .center, spacing: 8) {
            if isOverUnderPair {
                sportsbookTrailingBlock(line: line, showBookName: false)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(overUnderChipLabel(for: line))
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Color.appTextMuted)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    if let teamPrefix = teamPrefix(for: line) {
                        Text(teamPrefix)
                            .font(.system(size: 12, weight: .heavy))
                            .foregroundStyle(Color.appTextPrimary)
                    }
                    Text(displayLineText(for: line))
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                    if let odds = line.oddsText {
                        Text(odds)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.appPrimary)
                    }
                }
            }

            Spacer(minLength: 0)

            if !isOverUnderPair {
                sportsbookTrailingBlock(line: line, showBookName: showBookName)
            }
        }
        .padding(8)
        .background(Color.appSurfaceMuted.opacity(0.35), in: RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private func sportsbookTrailingBlock(line: OutliersTrendsBettingLine, showBookName: Bool) -> some View {
        if line.bookName == nil && line.bookLogoUrl == nil {
            EmptyView()
        } else {
            HStack(spacing: 4) {
                if showBookName {
                    Text("@")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.appTextMuted)
                }
                SportsbookLogoView(
                    logoURL: line.bookLogoUrl,
                    bookKey: nil,
                    bookName: line.bookName,
                    style: .compact
                )
                if showBookName, let book = line.bookName {
                    Text(book)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
            }
            .fixedSize(horizontal: true, vertical: false)
        }
    }

    private func rowDisplayText(_ row: OutliersTrendsCardRow) -> String {
        if let range = row.text.range(of: #" \(\d{1,3}%\)$"#, options: .regularExpression) {
            return String(row.text[..<range.lowerBound])
        }
        return row.text
    }

    private var isOverUnderMarket: Bool {
        switch card.marketKey {
        case "total", "h1_total", "team_total", "ou", "f5_ou": return true
        default: return false
        }
    }

    private func overUnderChipLabel(for line: OutliersTrendsBettingLine) -> String {
        guard isOverUnderMarket else { return line.label.uppercased() }
        let lower = line.label.lowercased()
        if lower.contains("over") { return "OVER" }
        if lower.contains("under") { return "UNDER" }
        return line.label.uppercased()
    }

    private func displayLineText(for line: OutliersTrendsBettingLine) -> String {
        var text = line.lineText.trimmingCharacters(in: .whitespaces)
        guard isOverUnderMarket else { return text }
        if let range = text.range(
            of: #"^[A-Za-z]{2,4}\s+(?=Over|Under)"#,
            options: [.regularExpression, .caseInsensitive]
        ) {
            text.removeSubrange(range)
        }
        return text
    }

    /// Coach and referee spread/ML lines need a team tag so the side is obvious.
    private func teamPrefix(for line: OutliersTrendsBettingLine) -> String? {
        guard !isOverUnderMarket else { return nil }
        guard card.subjectKind == .coach || card.subjectKind == .referee else { return nil }
        guard let abbr = line.teamAbbr ?? card.teamAbbr else { return nil }
        let upper = abbr.uppercased()
        let lineUpper = line.lineText.uppercased()
        if lineUpper.hasPrefix(upper) || lineUpper.contains(" \(upper) ") || lineUpper.contains("\(upper) ML") {
            return nil
        }
        return upper
    }

    private var displaySubjectDetail: String? {
        guard let detail = card.subjectDetail else { return nil }
        if detail.localizedCaseInsensitiveContains("career games") { return nil }
        if card.subjectKind == .team { return nil }
        if card.subjectKind == .coach,
           let abbr = card.teamAbbr?.uppercased(),
           detail.uppercased() == abbr || detail.uppercased().hasPrefix("\(abbr) ·") {
            return nil
        }
        return detail
    }

    private var displayMatchupLabel: String {
        if let game {
            if sport == .ncaaf {
                let away = CFBTeamAssets.displayName(for: game.awayTeam)
                let home = CFBTeamAssets.displayName(for: game.homeTeam)
                return "\(away) @ \(home)"
            }
            if sport == .mlb {
                return "\(game.awayAb) @ \(game.homeAb)"
            }
            let away = NFLTeamAssets.nickname(for: game.awayTeam)
            let home = NFLTeamAssets.nickname(for: game.homeTeam)
            return "\(away) @ \(home)"
        }
        let parts = card.matchupLabel.split(separator: "@", maxSplits: 1).map {
            String($0).trimmingCharacters(in: .whitespaces)
        }
        guard parts.count == 2 else { return card.matchupLabel }
        let away = NFLTeamAssets.nickname(for: parts[0])
        let home = NFLTeamAssets.nickname(for: parts[1])
        return "\(away) @ \(home)"
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 10) {
            avatar
            VStack(alignment: .leading, spacing: 3) {
                Text("\(card.subjectName) — \(card.betTypeLabel)")
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                if let detail = displaySubjectDetail {
                    Text(detail)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                }
                Text(displayMatchupLabel)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private var avatar: some View {
        switch card.subjectKind {
        case .team:
            if let team = card.teamAbbr {
                GameCardTeamAvatar(
                    teamName: team,
                    sport: avatarSport,
                    size: 36,
                    colors: sport == .ncaaf
                        ? CFBTeamColors.colorPair(for: team)
                        : sport == .mlb
                            ? MLBTeamColors.colorPair(for: team)
                            : NFLTeamColors.colorPair(for: team)
                )
            } else {
                subjectIcon("sportscourt.fill")
            }
        case .coach:
            if let team = card.teamAbbr {
                GameCardTeamAvatar(
                    teamName: team,
                    sport: avatarSport,
                    size: 36,
                    colors: sport == .ncaaf
                        ? CFBTeamColors.colorPair(for: team)
                        : sport == .mlb
                            ? MLBTeamColors.colorPair(for: team)
                            : NFLTeamColors.colorPair(for: team)
                )
            } else {
                subjectIcon("person.fill")
            }
        case .referee:
            nflShieldAvatar
        case .player:
            if let url = card.headshotUrl, let imageURL = URL(string: url) {
                AsyncImage(url: imageURL) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        playerFallbackAvatar
                    }
                }
                .frame(width: 40, height: 40)
                .clipShape(Circle())
            } else if let id = card.playerId {
                NFLPlayerHeadshot(playerName: card.subjectName, playerId: id, headshotUrl: nil, size: 36)
            } else {
                playerFallbackAvatar
            }
        }
    }

    private var nflShieldAvatar: some View {
        AsyncImage(url: URL(string: "https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png")) { phase in
            if case .success(let image) = phase {
                image.resizable().scaledToFit()
            } else {
                Image(systemName: "shield.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
            }
        }
        .frame(width: 40, height: 40)
        .padding(6)
        .background(Color.appPrimary.opacity(0.12), in: Circle())
    }

    private var playerFallbackAvatar: some View {
        NFLPlayerHeadshot(
            playerName: card.subjectName,
            playerId: card.playerId,
            headshotUrl: nil,
            size: 36
        )
    }

    private func subjectIcon(_ name: String) -> some View {
        Image(systemName: name)
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(Color.appPrimary)
            .frame(width: 40, height: 40)
            .background(Color.appPrimary.opacity(0.12), in: Circle())
    }

    private func trendColor(_ pct: Double) -> Color {
        if pct > 0.75 { return Color.appWin }
        if pct >= 0.60 { return Color.appAccentAmber }
        return Color.appTextSecondary
    }
}