import SwiftUI
import WagerproofDesign
import WagerproofModels

struct OutliersTrendCard: View {
    /// Carousel cards are a fixed-size compact preview; the detail sheet renders
    /// the same card `.expanded` (all rows, no height cap, no footer).
    enum DisplayMode { case compact, expanded }

    let card: OutliersTrendsCard
    var sport: OutliersTrendsSport = .nfl
    var game: OutliersTrendsGame?
    var displayMode: DisplayMode = .compact
    var onExpandPlayers: (() -> Void)?

    /// Compact carousel cards show at most this many trend rows; the rest are
    /// summarized by the "+N more" footer and revealed in the detail sheet.
    private let compactRowCap = 3
    /// Every compact card locks to one height so a carousel reads as a tidy,
    /// uniform row instead of a ragged staircase. Tall enough for the worst case:
    /// header (title + optional detail + matchup) + a betting-line chip row +
    /// `compactRowCap` single-line trend rows + the % preview footer.
    private let compactCardHeight: CGFloat = 240

    private var avatarSport: String {
        switch sport {
        case .ncaaf: return "cfb"
        case .mlb: return "mlb"
        default: return "nfl"
        }
    }

    private var isCompact: Bool { displayMode == .compact }

    private var visibleRows: [OutliersTrendsCardRow] {
        isCompact ? Array(card.rows.prefix(compactRowCap)) : card.rows
    }

    /// Trend rows not shown in the compact body — previewed as % chips in the footer.
    private var hiddenRows: [OutliersTrendsCardRow] {
        isCompact ? Array(card.rows.dropFirst(compactRowCap)) : []
    }

    /// Footer shows at most this many hidden-row % chips; the rest roll into "+N".
    private let footerPreviewCap = 3

    private var footerPreviewRows: [OutliersTrendsCardRow] {
        Array(hiddenRows.prefix(footerPreviewCap))
    }

    private var footerOverflowCount: Int {
        max(0, hiddenRows.count - footerPreviewCap)
    }

    private func pctText(_ row: OutliersTrendsCardRow) -> String {
        "\(Int((row.dominantPct * 100).rounded()))%"
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
        VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .top, spacing: 8) {
                header
                Spacer(minLength: 4)
                gameScheduleLabel
            }
            if !card.bettingLines.isEmpty {
                bettingLinesBlock
            } else if let line = card.lineContext {
                Text(line)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
            }
            VStack(alignment: .leading, spacing: 6) {
                ForEach(visibleRows) { row in
                    trendRow(row)
                }
            }
            // Pin the footer to the bottom of the fixed-height compact card so
            // sparse cards still read as deliberate (header top, footer bottom).
            if isCompact {
                Spacer(minLength: 0)
                compactFooter
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: isCompact ? compactCardHeight : nil, alignment: .top)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.appBorder.opacity(0.35), lineWidth: 0.5)
        )
        // Make the whole fixed-height frame (incl. the footer gap) the tap target.
        .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func trendRow(_ row: OutliersTrendsCardRow) -> some View {
        HStack(alignment: .top, spacing: 7) {
            // Icon keyed to the bullet's trend dimension (road games, underdog,
            // non-division, vs OPP, …) so each split reads at a glance. Tinted
            // by trend strength like the old dot.
            Image(systemName: Self.rowIcon(for: row.text))
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(trendColor(row.dominantPct))
                .frame(width: 14, alignment: .center)
                .padding(.top, isCompact ? 0 : 1)
            // Compact rows stay single-line so the card height is predictable;
            // the full text wraps in the expanded detail sheet.
            Text(rowDisplayText(row))
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .lineLimit(isCompact ? 1 : nil)
                .fixedSize(horizontal: false, vertical: !isCompact)
            Spacer(minLength: 4)
            Text("\(Int((row.dominantPct * 100).rounded()))%")
                .font(.system(size: 12, weight: .heavy, design: .rounded))
                .foregroundStyle(trendColor(row.dominantPct))
                .monospacedDigit()
        }
    }

    /// Bottom strip of the compact card. When rows are hidden it previews their
    /// strengths as colored % chips (informative at a glance) next to a "More"
    /// CTA; with nothing hidden it's just a "View breakdown" CTA. Both signal
    /// that a tap opens the full card in the detail sheet.
    private var compactFooter: some View {
        VStack(spacing: 6) {
            // Hairline divider sets the preview strip apart from the trend rows.
            Rectangle()
                .fill(Color.appBorder.opacity(0.25))
                .frame(height: 0.5)
            HStack(spacing: 5) {
                if !footerPreviewRows.isEmpty {
                    // Leading "+" signals these chips are additional stats beyond
                    // the rows shown above.
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.appPrimary)
                    ForEach(footerPreviewRows) { row in
                        pctPreviewChip(row)
                    }
                    if footerOverflowCount > 0 {
                        Text("+\(footerOverflowCount)")
                            .font(.system(size: 10, weight: .heavy))
                            .foregroundStyle(Color.appTextMuted)
                    }
                    Spacer(minLength: 4)
                    footerCTA("More")
                } else {
                    Spacer(minLength: 0)
                    footerCTA("View breakdown")
                }
            }
        }
    }

    /// A hidden trend as a tinted strength chip: its dimension icon (matching the
    /// row icons) + dominant percentage, so the preview reads at a glance.
    private func pctPreviewChip(_ row: OutliersTrendsCardRow) -> some View {
        HStack(spacing: 3) {
            Image(systemName: Self.rowIcon(for: row.text))
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(trendColor(row.dominantPct))
            Text(pctText(row))
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .foregroundStyle(trendColor(row.dominantPct))
                .monospacedDigit()
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(trendColor(row.dominantPct).opacity(0.14), in: Capsule())
    }

    private func footerCTA(_ label: String) -> some View {
        HStack(spacing: 3) {
            Text(label)
                .font(.system(size: 11, weight: .bold))
            Image(systemName: "chevron.right")
                .font(.system(size: 9, weight: .bold))
        }
        .foregroundStyle(Color.appPrimary)
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
                    // Compact = one predictable line (the section header already names
                    // the market; the full title wraps in the detail sheet).
                    .lineLimit(isCompact ? 1 : nil)
                    .fixedSize(horizontal: false, vertical: !isCompact)
                if let detail = displaySubjectDetail {
                    Text(detail)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                }
                Text(displayMatchupLabel)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
    }

    @ViewBuilder
    private var gameScheduleLabel: some View {
        if let kickoff = game?.kickoff, !kickoff.isEmpty {
            VStack(alignment: .trailing, spacing: 1) {
                Text(GameCardFormatting.formatCompactDate(kickoff))
                Text(GameCardFormatting.convertTimeToEST(kickoff))
            }
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(Color.appTextMuted)
            .multilineTextAlignment(.trailing)
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

    /// Maps a trend row to an SF Symbol keyed on its *dimension* — the trailing
    /// context phrase (road games, as an underdog, non-division, vs OPP, …). Every
    /// row is phrased "<verb> <count> of last <n> <dimension>" by the NFL/MLB
    /// engines and the precomputed server cards, so we isolate the part after
    /// "of last <n>" and match on that. Matching the trailing phrase (not the
    /// whole string) is required: referee verbs like "Home won"/"Away covered"
    /// contain "home"/"away" and would otherwise collide with the home/road icons.
    static func rowIcon(for text: String) -> String {
        let dimension = trendDimension(from: text)
        guard !dimension.isEmpty else { return "circle.fill" }

        // Order matters: "non-" negations before their base, and home/road/etc.
        // before the generic "games" fallback.
        if dimension.hasPrefix("non-division") { return "globe.americas.fill" }
        if dimension.hasPrefix("non-primetime") { return "sun.max.fill" }
        if dimension.contains("road") || dimension == "away" || dimension.hasPrefix("away ") {
            return "airplane"
        }
        if dimension.contains("home") { return "house.fill" }
        if dimension.contains("underdog") { return "pawprint.fill" }
        if dimension.contains("favorite") || dimension.contains("favourite") { return "star.fill" }
        if dimension.contains("division") { return "person.2.fill" }
        if dimension.contains("primetime") || dimension.contains("night") { return "moon.stars.fill" }
        if dimension.contains("day game") { return "sun.max.fill" }
        if dimension.hasPrefix("vs") { return "person.line.dotted.person.fill" }
        if dimension.contains("series g1") { return "1.circle.fill" }
        if dimension.contains("series g2") { return "2.circle.fill" }
        if dimension.contains("series g3") { return "3.circle.fill" }
        if dimension.contains("series g4") { return "4.circle.fill" }
        if dimension.hasSuffix("games") || dimension == "games" { return "sportscourt.fill" }
        return "circle.fill"
    }

    /// Pulls the lowercased dimension phrase out of a row's text, e.g.
    /// "Lost 10 of last 10 road games (100%)" -> "road games". Returns "" when
    /// the expected "of last <n>" structure isn't present.
    private static func trendDimension(from text: String) -> String {
        let lower = text.lowercased()
        guard let range = lower.range(of: " of last ") else { return "" }
        var context = String(lower[range.upperBound...]).trimmingCharacters(in: .whitespaces)
        // Drop the trailing "(NN%)" the engines append.
        if let paren = context.lastIndex(of: "(") {
            context = String(context[..<paren]).trimmingCharacters(in: .whitespaces)
        }
        // Drop the leading sample-count token ("10 road games" -> "road games").
        let parts = context.split(separator: " ", maxSplits: 1)
        if let first = parts.first, first.allSatisfy(\.isNumber) {
            context = parts.count > 1 ? String(parts[1]) : ""
        }
        return context.trimmingCharacters(in: .whitespaces)
    }
}
