import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices

struct OutliersTrendCard: View {
    /// Carousel cards are a fixed-size compact preview; the detail sheet renders
    /// the same card `.expanded` (all rows, no height cap, no footer).
    enum DisplayMode { case compact, expanded }

    let card: OutliersTrendsCard
    var sport: OutliersTrendsSport = .nfl
    var game: OutliersTrendsGame?
    var displayMode: DisplayMode = .compact
    /// Paywall previews can use concrete hit records (for example 12/12),
    /// while live Outliers cards retain their percentage presentation.
    var showsRecordStrength = false
    /// The paywall marquee uses the real card at a denser, fixed-height size.
    /// Live compact cards and expanded detail cards keep their existing layout.
    var marqueeStyle = false
    var onExpandPlayers: (() -> Void)?
    /// NFL / CFB Outliers cards carry per-book lines from the same odds capture
    /// as game detail. MLB's feed has one canonical line, so it deliberately
    /// ignores this preference.
    @AppStorage(SportsbookPreference.defaultsKey) private var preferredBookKeysRaw: String = ""
    @State private var liveOdds: SportsbookGameOdds?

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
    private var usesSingleLineLayout: Bool { isCompact || marqueeStyle }
    private var selectedBookKeys: Set<String> {
        SportsbookPreference.decode(preferredBookKeysRaw)
    }
    private var displayedBettingLines: [OutliersTrendsBettingLine] {
        guard sport == .nfl || sport == .ncaaf else { return card.bettingLines }
        let source = card.bettingLines.isEmpty ? synthesizedBettingLines : card.bettingLines
        let remapped = source.map(preferredBettingLine)
        guard !selectedBookKeys.isEmpty else { return remapped }
        let matches = remapped.filter { line in
            guard let key = SportsbookCatalog.key(forDisplayName: line.bookName) else { return false }
            return selectedBookKeys.contains(key)
        }
        // Do not blank a trend just because the stored snapshot is missing the
        // user's book. This matches game detail's safe fallback to best overall.
        return matches.isEmpty ? remapped : matches
    }

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

    private func strengthText(_ row: OutliersTrendsCardRow) -> String {
        if showsRecordStrength {
            let hits = min(row.sampleN, max(0, Int((row.dominantPct * Double(row.sampleN)).rounded())))
            return "\(hits)/\(row.sampleN)"
        }
        return "\(Int((row.dominantPct * 100).rounded()))%"
    }

    var body: some View {
        Group {
            if card.isPlayerOverflow {
                Button(action: { onExpandPlayers?() }) {
                    overflowContent
                }
                .buttonStyle(.plain)
            } else {
                cardContent
            }
        }
        .task(id: "\(sport.rawValue)-\(card.gameId)") {
            await loadPreferredOdds()
        }
    }

    private var cardContent: some View {
        VStack(alignment: .leading, spacing: marqueeStyle ? 6 : 9) {
            HStack(alignment: .top, spacing: marqueeStyle ? 6 : 8) {
                header
                Spacer(minLength: 4)
                gameScheduleLabel
            }
            if !displayedBettingLines.isEmpty {
                bettingLinesBlock
            } else if let line = card.lineContext {
                Text(line)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
            }
            VStack(alignment: .leading, spacing: marqueeStyle ? 4 : 6) {
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
        .padding(marqueeStyle ? 10 : 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: marqueeStyle ? 126 : (isCompact ? compactCardHeight : nil), alignment: .top)
        // Marquee (paywall) cards sit on the near-black paywall backdrop, so
        // they use a darker fill than the standard elevated surface.
        .background(
            marqueeStyle ? Color(hex: 0x0B0F0D) : Color.appSurfaceElevated,
            in: RoundedRectangle(cornerRadius: 16, style: .continuous)
        )
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
                .font(.system(size: marqueeStyle ? 11 : 12, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .lineLimit(usesSingleLineLayout ? 1 : nil)
                .minimumScaleFactor(marqueeStyle ? 0.82 : 1)
                .fixedSize(horizontal: false, vertical: !usesSingleLineLayout)
            Spacer(minLength: 4)
            Text(strengthText(row))
                .font(.system(size: marqueeStyle ? 11 : 12, weight: .heavy, design: .rounded))
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
            Text(strengthText(row))
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
        let showBookName = displayedBettingLines.count < 2
        return Group {
            if displayedBettingLines.count >= 2 {
                HStack(alignment: .top, spacing: 6) {
                    ForEach(displayedBettingLines) { line in
                        bettingLineChip(line, showBookName: false)
                            .frame(maxWidth: .infinity)
                    }
                }
            } else {
                ForEach(displayedBettingLines) { line in
                    bettingLineChip(line, showBookName: showBookName)
                }
            }
        }
    }

    private func bettingLineChip(_ line: OutliersTrendsBettingLine, showBookName: Bool) -> some View {
        let isOverUnderPair = displayedBettingLines.count >= 2
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
                    bookKey: SportsbookCatalog.key(forDisplayName: line.bookName),
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

    /// Overlay the live preferred-book quote onto a stored Outliers chip.
    /// Player props and MLB stay on the precomputed line.
    private func preferredBettingLine(_ line: OutliersTrendsBettingLine) -> OutliersTrendsBettingLine {
        guard let liveOdds, let market = sportsbookMarket(for: line) else { return line }
        guard let quote = liveOdds.quotes(for: market).preferred(selectedBookKeys) else { return line }
        return OutliersTrendsBettingLine(
            id: "\(line.id)-\(quote.bookKey)",
            label: line.label,
            lineText: preferredLineText(for: line, quote: quote),
            oddsText: quote.price.map { GameCardFormatting.formatMoneyline($0) } ?? line.oddsText,
            bookName: quote.bookName,
            bookLogoUrl: SportsbookCatalog.logoURL(for: quote.bookKey),
            teamAbbr: line.teamAbbr
        )
    }

    private func preferredLineText(for line: OutliersTrendsBettingLine, quote: SportsbookQuote) -> String {
        if card.marketKey == "moneyline" || card.marketKey == "h1_ml" {
            // Keep the team label ("CLE ML"); the price lives in `oddsText`.
            return line.lineText
        }
        guard let number = quote.line else { return line.lineText }
        if isOverUnderMarket {
            let dir = overUnderChipLabel(for: line).capitalized
            return "\(dir) \(GameCardFormatting.roundToNearestHalf(number))"
        }
        return GameCardFormatting.formatSpread(number)
    }

    /// Snapshot cards for moneyline (and some 1H markets) often ship with an
    /// empty `betting_lines` array even though the game row and the live board
    /// both have a number. Fill those chips here rather than leaving the card
    /// blank. Team totals and player props have no live board in this service.
    private var synthesizedBettingLines: [OutliersTrendsBettingLine] {
        guard card.subjectKind != .player else { return [] }
        switch card.marketKey {
        case "spread", "h1_spread", "moneyline", "h1_ml":
            if let line = synthesizedSideLine() { return [line] }
        case "total", "h1_total":
            return ["OVER", "UNDER"].compactMap { synthesizedTotalLine(side: $0) }
        default:
            return []
        }
        return []
    }

    private func synthesizedSideLine() -> OutliersTrendsBettingLine? {
        let market = sportsbookMarket(for: nil)
        if let liveOdds, let market,
           let quote = liveOdds.quotes(for: market).preferred(selectedBookKeys) {
            return chip(from: quote, label: card.betTypeLabel, sideLabel: nil)
        }
        return closeLineFallback()
    }

    private func synthesizedTotalLine(side: String) -> OutliersTrendsBettingLine? {
        let isOver = side == "OVER"
        let market: SportsbookMarket? = {
            switch card.marketKey {
            case "total": return .total(isOver: isOver)
            case "h1_total": return sport == .nfl ? .firstHalfTotal(isOver: isOver) : .total(isOver: isOver)
            default: return nil
            }
        }()
        if let liveOdds, let market,
           let quote = liveOdds.quotes(for: market).preferred(selectedBookKeys) {
            return chip(from: quote, label: side.capitalized, sideLabel: side.capitalized)
        }
        return closeTotalFallback(side: side)
    }

    private func chip(
        from quote: SportsbookQuote,
        label: String,
        sideLabel: String?
    ) -> OutliersTrendsBettingLine {
        let lineText: String
        if card.marketKey == "moneyline" || card.marketKey == "h1_ml" {
            lineText = moneylineLineText
        } else if let sideLabel, let number = quote.line {
            lineText = "\(sideLabel) \(GameCardFormatting.roundToNearestHalf(number))"
        } else {
            lineText = GameCardFormatting.formatSpread(quote.line)
        }
        return OutliersTrendsBettingLine(
            id: "\(card.id)-live-\(label.lowercased())",
            label: label,
            lineText: lineText,
            oddsText: quote.price.map { GameCardFormatting.formatMoneyline($0) },
            bookName: quote.bookName,
            bookLogoUrl: SportsbookCatalog.logoURL(for: quote.bookKey),
            teamAbbr: card.teamAbbr
        )
    }

    private var moneylineLineText: String {
        if let abbr = card.teamAbbr, !abbr.isEmpty { return "\(abbr) ML" }
        return "ML"
    }

    /// Last resort when the live board hasn't loaded: the close already sitting
    /// on the game row. No book attribution — this is not a shopped number.
    private func closeLineFallback() -> OutliersTrendsBettingLine? {
        guard let game else { return nil }
        let isHome = isHomeSide(nil)
        switch card.marketKey {
        case "spread":
            guard let close = game.fgSpreadClose else { return nil }
            let number = isHome ? close : -close
            return untitledChip(
                label: card.betTypeLabel,
                lineText: GameCardFormatting.formatSpread(number),
                oddsText: "-110"
            )
        case "moneyline":
            let price = isHome ? game.nflContext?.homeMl : game.nflContext?.awayMl
            guard let price else { return nil }
            return untitledChip(
                label: card.betTypeLabel,
                lineText: moneylineLineText,
                oddsText: GameCardFormatting.formatMoneyline(Int(price.rounded()))
            )
        case "h1_spread":
            guard let close = game.nflContext?.h1SpreadClose else { return nil }
            let number = isHome ? close : -close
            let price = isHome ? game.nflContext?.h1SpreadHomePrice : game.nflContext?.h1SpreadAwayPrice
            return untitledChip(
                label: card.betTypeLabel,
                lineText: GameCardFormatting.formatSpread(number),
                oddsText: GameCardFormatting.formatMoneyline(price.map { Int($0.rounded()) })
            )
        default:
            return nil
        }
    }

    private func closeTotalFallback(side: String) -> OutliersTrendsBettingLine? {
        guard let game else { return nil }
        let isOver = side == "OVER"
        let number: Double?
        let price: Double?
        switch card.marketKey {
        case "total":
            number = game.fgTotalClose
            price = nil
        case "h1_total":
            number = game.nflContext?.h1TotalClose
            price = isOver ? game.nflContext?.h1TotalOverPrice : game.nflContext?.h1TotalUnderPrice
        default:
            return nil
        }
        guard let number else { return nil }
        return untitledChip(
            label: side.capitalized,
            lineText: "\(side.capitalized) \(GameCardFormatting.roundToNearestHalf(number))",
            oddsText: price.map { GameCardFormatting.formatMoneyline(Int($0.rounded())) } ?? "-110"
        )
    }

    private func untitledChip(label: String, lineText: String, oddsText: String?) -> OutliersTrendsBettingLine {
        OutliersTrendsBettingLine(
            id: "\(card.id)-close-\(label.lowercased())",
            label: label,
            lineText: lineText,
            oddsText: oddsText,
            bookName: nil,
            bookLogoUrl: nil,
            teamAbbr: card.teamAbbr
        )
    }

    private func sportsbookMarket(for line: OutliersTrendsBettingLine?) -> SportsbookMarket? {
        let isHome = isHomeSide(line)
        let isOver = line.map { overUnderChipLabel(for: $0) == "OVER" } ?? false
        switch card.marketKey {
        case "spread": return .spread(isHome: isHome)
        case "h1_spread": return sport == .nfl ? .firstHalfSpread(isHome: isHome) : .spread(isHome: isHome)
        case "total": return .total(isOver: isOver)
        case "h1_total": return sport == .nfl ? .firstHalfTotal(isOver: isOver) : .total(isOver: isOver)
        case "moneyline", "h1_ml": return .moneyline(isHome: isHome)
        default: return nil
        }
    }

    private func isHomeSide(_ line: OutliersTrendsBettingLine?) -> Bool {
        guard let game else { return false }
        let key = (line?.teamAbbr ?? card.teamAbbr ?? "").uppercased()
        return key == game.homeAb.uppercased() || key == game.homeTeam.uppercased()
    }

    private func loadPreferredOdds() async {
        guard !marqueeStyle, (sport == .nfl || sport == .ncaaf), let game else { return }
        let kickoff = parseKickoff(game.kickoff)
        let odds: SportsbookGameOdds?
        if sport == .ncaaf {
            odds = await SportsbookOddsService.shared.cfbOdds(
                gameId: game.id,
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                kickoff: kickoff
            )
        } else {
            odds = await SportsbookOddsService.shared.odds(
                gameId: game.id,
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                kickoff: kickoff
            )
        }
        liveOdds = odds
    }

    private func parseKickoff(_ raw: String?) -> Date? {
        guard let raw else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return fractional.date(from: raw) ?? plain.date(from: raw)
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
        // MLB abbreviations overlap heavily with NFL aliases (SF, ATL, PHI,
        // BAL). Without a game model the old generic fallback expanded those
        // into 49ers/Falcons/Eagles/Ravens. The card already receives its sport,
        // so preserve the MLB matchup label exactly as supplied.
        if sport == .mlb {
            return card.matchupLabel
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
                    .font(.system(size: marqueeStyle ? 13 : 14, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                    // Compact = one predictable line (the section header already names
                    // the market; the full title wraps in the detail sheet).
                    .lineLimit(usesSingleLineLayout ? 1 : nil)
                    .minimumScaleFactor(marqueeStyle ? 0.9 : 1)
                    .fixedSize(horizontal: false, vertical: !usesSingleLineLayout)
                if let detail = displaySubjectDetail {
                    Text(detail)
                        .font(.system(size: marqueeStyle ? 10 : 11, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(usesSingleLineLayout ? 1 : nil)
                }
                Text(displayMatchupLabel)
                    .font(.system(size: marqueeStyle ? 11 : 12, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(usesSingleLineLayout ? 1 : nil)
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
        if dimension.contains("starter") { return "baseball.fill" }
        if dimension.contains("series opener") { return "flag.checkered" }
        if dimension.contains("after a loss") { return "arrow.counterclockwise.circle.fill" }
        if dimension.contains("-1.5") || dimension.contains("2+ run") { return "chart.line.uptrend.xyaxis" }
        if dimension.hasPrefix("vs") { return "person.line.dotted.person.fill" }
        if dimension.contains("series g1") { return "1.circle.fill" }
        if dimension.contains("series g2") { return "2.circle.fill" }
        if dimension.contains("series g3") { return "3.circle.fill" }
        if dimension.contains("series g4") { return "4.circle.fill" }
        if dimension.hasSuffix("games") || dimension == "games" { return "sportscourt.fill" }
        return "circle.fill"
    }

    /// Pulls the lowercased dimension phrase out of a row's text, e.g.
    /// "Lost 10 of last 10 road games (100%)" -> "road games". Paywall cards
    /// already use concise dimension-only labels, so those pass through intact.
    private static func trendDimension(from text: String) -> String {
        let lower = text.lowercased()
        guard let range = lower.range(of: " of last ") else {
            return lower.trimmingCharacters(in: .whitespacesAndNewlines)
        }
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
