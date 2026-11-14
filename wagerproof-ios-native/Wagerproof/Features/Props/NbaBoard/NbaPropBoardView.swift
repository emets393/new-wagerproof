import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices

struct NbaPropFeedFilters: Equatable {
    var gameKey: String?
    var market: String?
    var signalsOnly = false

    var isActive: Bool { gameKey != nil || market != nil || signalsOnly }
}

@Observable
@MainActor
final class NbaPropBoardStore {
    private(set) var rows: [NbaSlateProp] = []
    private(set) var defs: [String: NbaPropDef] = [:]
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    func refresh() async {
        isLoading = true
        errorMessage = nil
        do {
            let payload = try await NBAPropsService.shared.loadBoard()
            rows = payload.rows
            defs = payload.defs
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

struct NbaPropBoardView: View {
    @Bindable var store: NbaPropBoardStore
    var filters: NbaPropFeedFilters
    var query: String
    @State private var selected: NbaSlateProp?

    private var names: [String: String] { NbaPropCopy.athleteNames(store.rows) }
    private var visible: [NbaPropListCard] {
        NbaPropCopy.filter(store.rows, game: filters.gameKey, market: filters.market, signalsOnly: filters.signalsOnly, query: query)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let errorMessage = store.errorMessage, store.rows.isEmpty {
                Text(errorMessage)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(.horizontal, 16)
            } else if store.isLoading && store.rows.isEmpty {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 28)
            } else if visible.isEmpty {
                empty
            } else {
                ForEach(visible) { card in
                    Button { selected = card.featured } label: {
                        NbaPropCard(
                            chart: card.chart,
                            featured: card.featured,
                            highlighted: card.highlighted,
                            defs: store.defs,
                            signalCount: NbaPropCopy.playerSignalCount(store.rows, for: card.featured),
                            reasons: signalReasons(card)
                        )
                    }
                    .buttonStyle(.plain)
                    .opacity(card.chart.isOut ? 0.5 : 1)
                    .padding(.horizontal, 12)
                }
            }
        }
        .navigationDestination(item: $selected) { row in
            NbaPropDetailView(row: row, rows: store.rows, defs: store.defs) { selected = $0 }
        }
    }

    private var empty: some View {
        let searching = !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return VStack(spacing: 6) {
            Image(systemName: "chart.bar")
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
            Text(searching ? "No players match that search" : "No NBA props on the board")
                .font(.system(size: 15, weight: .semibold))
            Text(searching ? "Try a different name or team." : filters.isActive ? "Nothing in this game, market, or signal filter." : "Today and tomorrow are empty.")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 28)
        .padding(.vertical, 36)
    }

    private func signalReasons(_ card: NbaPropListCard) -> [String] {
        let source = filters.market == nil ? NbaPropCopy.siblings(store.rows, of: card.featured) : [card.featured]
        var seen = Set<String>()
        return source.flatMap { NbaPropCopy.signalLines($0, defs: store.defs, names: names) }.filter { seen.insert($0).inserted }
    }
}

private struct NbaPropCard: View {
    let chart: NbaSlateProp
    let featured: NbaSlateProp
    let highlighted: Bool
    let defs: [String: NbaPropDef]
    let signalCount: Int
    let reasons: [String]

    private var row: NbaSlateProp { chart }
    private var form: NbaRecentForm { NbaPropCopy.recentForm(chart) }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 10) {
                NbaHeadshot(url: row.headshotURL, fallback: row.position ?? "NBA", size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.playerName ?? "Player")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                    Text(meta)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                Text(NbaPropCopy.pickLabel(featured, defs: defs))
                    .font(.system(size: 12, weight: .bold))
                    .monospacedDigit()
                    .lineLimit(1)
                    .foregroundStyle(highlighted ? Color(hex: 0xB45309) : Color.appTextPrimary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(highlighted ? Color(hex: 0xF59E0B).opacity(0.18) : Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(highlighted ? Color(hex: 0xF59E0B).opacity(0.45) : Color.clear, lineWidth: 1))
            }
            HStack(spacing: 8) {
                NbaFormStrip(bars: form.bars)
                Text(form.games > 0 ? "\(form.hits)/\(form.games)" : "—")
                    .font(.system(size: 12, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Color.appPrimary)
                if signalCount > 0 {
                    NbaSignalCount(count: signalCount)
                }
                if row.isOut {
                    Text("OUT")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                }
                Spacer(minLength: 0)
            }
            ForEach(reasons, id: \.self) { reason in
                Text(reason)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.appTextPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.primary.opacity(0.06), lineWidth: 1))
    }

    private var meta: String {
        let matchup = (row.team?.isEmpty == false && row.opponent?.isEmpty == false)
            ? "\(row.team!) vs \(row.opponent!)"
            : (row.game ?? "")
        return [row.position, matchup].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

private struct NbaPropDetailView: View {
    let row: NbaSlateProp
    let rows: [NbaSlateProp]
    let defs: [String: NbaPropDef]
    var onMarket: (NbaSlateProp) -> Void
    @State private var books: [NbaBookQuote] = []
    @State private var history: [NbaBookQuote] = []
    @State private var booksLoading = true

    private var names: [String: String] { NbaPropCopy.athleteNames(rows) }
    private var siblings: [NbaSlateProp] { NbaPropCopy.siblings(rows, of: row) }
    private var form: NbaRecentForm { NbaPropCopy.recentForm(row) }
    private var last5: NbaRecentForm { NbaPropCopy.recentForm(row, limit: 5) }
    private var side: NbaPickSide? { NbaPropCopy.pickSide(row, defs: defs) }
    private var lineText: String { NbaPropCopy.formatNumber(row.line) }
    private var market: String { row.marketLabel ?? row.market ?? "Prop" }

    var body: some View {
        let bestOver = NbaPropCopy.bestQuote(books, side: .over)
        let bestUnder = NbaPropCopy.bestQuote(books, side: .under)
        let hero = side == .under ? bestUnder : side == .over ? bestOver : nil
        let heroPrice = hero?.price ?? (side == .under ? row.underPrice : side == .over ? row.overPrice : nil)
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if siblings.count > 1 { marketChips }
                pickBlock(hero: hero, heroPrice: heroPrice, bestOver: bestOver, bestUnder: bestUnder)
                hitRate
                formChart
                VStack(alignment: .leading, spacing: 10) {
                    shop(bestOver: bestOver, bestUnder: bestUnder)
                    movement
                }
                HStack(alignment: .top, spacing: 8) {
                    formStat("Last 5 games", avg: row.l5Avg, hits: last5.games > 0 ? last5.hits : nil, games: last5.games > 0 ? last5.games : nil)
                    formStat("Last 10 games", avg: row.l10Avg, hits: form.games > 0 ? form.hits : nil, games: form.games > 0 ? form.games : nil)
                    formStat("This season", avg: row.sznAvg, hits: NbaPropCopy.clearedCount(rate: row.overRateSzn, games: row.gpPrior), games: row.gpPrior.map { Int($0) })
                }
            }
            .padding(16)
            .opacity(row.isOut ? 0.6 : 1)
        }
        .background(Color.appSurface)
        .navigationTitle(row.playerName ?? "Prop")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: row.id) {
            booksLoading = true
            let result = await NBAPropsService.shared.books(for: row)
            books = result.current
            history = result.history
            booksLoading = false
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            NbaHeadshot(url: row.headshotURL, fallback: row.position ?? "NBA", size: 56)
            VStack(alignment: .leading, spacing: 3) {
                Text(row.playerName ?? "Player")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Text(headerMeta)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                if row.isOut {
                    Text("Out")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                }
            }
        }
    }

    private var headerMeta: String {
        let matchup = (row.team?.isEmpty == false && row.opponent?.isEmpty == false)
            ? "\(row.team!) vs \(row.opponent!)"
            : (row.game ?? "")
        return [row.position, matchup, tipLabel(row.commenceTime)].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }

    private var marketChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(siblings) { sibling in
                    let active = sibling.id == row.id
                    Button { onMarket(sibling) } label: {
                        Text("\(sibling.marketLabel ?? sibling.market ?? "Prop") \(NbaPropCopy.formatNumber(sibling.line))")
                            .font(.system(size: 12, weight: .bold))
                            .monospacedDigit()
                            .foregroundStyle(active ? Color.white : Color.appTextPrimary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(active ? Color.appPrimary : Color.appSurfaceElevated, in: Capsule())
                            .overlay(Capsule().strokeBorder(active ? Color.clear : Color.primary.opacity(0.08), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func pickBlock(hero: NbaBookPrice?, heroPrice: Double?, bestOver: NbaBookPrice?, bestUnder: NbaBookPrice?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(market.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Color.appTextMuted)
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(side == nil ? lineText : "\(side == .over ? "Over" : "Under") \(lineText)")
                    .font(.system(size: 32, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Color.appPrimary)
                if side != nil {
                    HStack(spacing: 5) {
                        NbaBookMark(book: hero?.book)
                        Text(NbaPropCopy.formatAmerican(heroPrice))
                            .font(.system(size: 15, weight: .bold))
                            .monospacedDigit()
                    }
                }
            }
            HStack(spacing: 8) {
                pricePill("Over", price: bestOver?.price ?? row.overPrice, book: bestOver?.book, emphasis: side != .under)
                pricePill("Under", price: bestUnder?.price ?? row.underPrice, book: bestUnder?.book, emphasis: side == .under)
            }
            ForEach(row.flags, id: \.self) { key in
                signalCard(key)
            }
        }
    }

    private func pricePill(_ label: String, price: Double?, book: String?, emphasis: Bool) -> some View {
        HStack(spacing: 5) {
            NbaBookMark(book: book)
            Text("\(label) \(lineText)")
                .lineLimit(1)
            Text(NbaPropCopy.formatAmerican(price))
                .fontWeight(.bold)
                .foregroundStyle(emphasis ? Color.appPrimary : Color.appTextPrimary)
        }
        .font(.system(size: 12, weight: .semibold))
        .monospacedDigit()
        .foregroundStyle(emphasis ? Color.appTextPrimary : Color.appTextSecondary)
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(emphasis ? Color.appPrimary.opacity(0.12) : Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(emphasis ? Color.appPrimary.opacity(0.35) : Color.clear, lineWidth: 1))
    }

    private func signalCard(_ key: String) -> some View {
        let def = defs[key]
        let specific = NbaPropCopy.signalSentence(key: key, detail: row.flagDetail) { names[$0] }
        let oneLiner = def?.oneLiner?.trimmingCharacters(in: .whitespacesAndNewlines)
        let definition = def?.definition?.trimmingCharacters(in: .whitespacesAndNewlines)
        let why = def?.whyItWorks?.trimmingCharacters(in: .whitespacesAndNewlines)
        return VStack(alignment: .leading, spacing: 4) {
            Text(def?.displayName ?? key).font(.system(size: 15, weight: .bold))
            if let oneLiner, !oneLiner.isEmpty { Text(oneLiner).font(.system(size: 13)) }
            if let specific, specific != oneLiner { Text(specific).font(.system(size: 13)) }
            if let definition, !definition.isEmpty, definition != oneLiner {
                Text(definition).font(.system(size: 12)).foregroundStyle(Color.appTextSecondary)
            }
            if let why, !why.isEmpty, why != definition, why != oneLiner {
                Text(why).font(.system(size: 12)).foregroundStyle(Color.appTextSecondary)
            }
            if def?.recordText != nil || def?.seasonRecordText != nil {
                Text([def?.seasonRecordText, def?.recordText].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appPrimary.opacity(0.08), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.appPrimary.opacity(0.28), lineWidth: 1))
    }

    private var hitRate: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(form.pct.map { "\(Int($0.rounded()))%" } ?? "—")
                .font(.system(size: 32, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Color.appPrimary)
            Text(form.games > 0 ? "Cleared the line · \(form.hits)/\(form.games) last \(form.games)" : "Cleared the line")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        }
    }

    private var formChart: some View {
        Group {
            if row.line == nil {
                Text("No line posted")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            } else if form.bars.isEmpty {
                Text("No recent games logged.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextMuted)
            } else {
                NbaRecentChart(bars: form.bars, line: row.line ?? 0, market: market)
            }
        }
    }

    private func shop(bestOver: NbaBookPrice?, bestUnder: NbaBookPrice?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("SHOP THE LINE")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(Color.appTextMuted)
            if booksLoading {
                Text("Loading posted prices…").font(.system(size: 12)).foregroundStyle(Color.appTextSecondary)
            } else if books.isEmpty {
                Text("No posted prices yet.").font(.system(size: 12)).foregroundStyle(Color.appTextSecondary)
            } else {
                ForEach(books.sorted { ($0.bookmaker ?? "") < ($1.bookmaker ?? "") }, id: \.self) { quote in
                    bookRow(quote, bestOver: bestOver, bestUnder: bestUnder)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func bookRow(_ quote: NbaBookQuote, bestOver: NbaBookPrice?, bestUnder: NbaBookPrice?) -> some View {
        let book = quote.bookmaker ?? ""
        let overBest = bestOver?.book == book && bestOver?.price == quote.overOdds
        let underBest = bestUnder?.book == book && bestUnder?.price == quote.underOdds
        return HStack(alignment: .top, spacing: 8) {
            NbaBookMark(book: book, style: .regular)
            VStack(alignment: .leading, spacing: 2) {
                Text(SportsbookCatalog.name(for: SportsbookCatalog.key(forDisplayName: book) ?? book))
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(1)
                HStack(spacing: 8) {
                    Text(NbaPropCopy.formatNumber(quote.line))
                        .foregroundStyle(Color(hex: 0x0EA5E9))
                    Text("O \(NbaPropCopy.formatAmerican(quote.overOdds))\(overBest ? " Best" : "")")
                        .foregroundStyle(overBest ? Color.appPrimary : Color.appTextSecondary)
                        .fontWeight(overBest ? .bold : .semibold)
                    Text("U \(NbaPropCopy.formatAmerican(quote.underOdds))\(underBest ? " Best" : "")")
                        .foregroundStyle(underBest ? Color.appPrimary : Color.appTextSecondary)
                        .fontWeight(underBest ? .bold : .semibold)
                }
                .font(.system(size: 11, weight: .semibold))
                .monospacedDigit()
            }
        }
    }

    private var movement: some View {
        let summary = NbaPropCopy.lineMovement(history)
        return VStack(alignment: .leading, spacing: 8) {
            Text("LINE MOVEMENT")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(Color.appTextMuted)
            if booksLoading {
                Text("Loading the line history…").font(.system(size: 12)).foregroundStyle(Color.appTextSecondary)
            } else {
                NbaMovementChart(summary: summary, openLine: row.openLine, currentLine: row.line)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func formStat(_ window: String, avg: Double?, hits: Int?, games: Int?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(window.uppercased())
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
                .lineLimit(2)
            Text(avg.map { String(format: "%.1f", $0) } ?? "—")
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .monospacedDigit()
            Text("\(market) per game")
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextSecondary)
                .lineLimit(2)
            if let hits, let games, games > 0, row.line != nil {
                Text("Over \(lineText) in \(hits) of \(games)")
                    .font(.system(size: 11, weight: .semibold))
                    .fixedSize(horizontal: false, vertical: true)
            } else if let games, games > 0 {
                Text("\(games) games")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func tipLabel(_ iso: String?) -> String? {
        guard let iso else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        guard let date = fractional.date(from: iso) ?? plain.date(from: iso) else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.timeZone = TimeZone(identifier: "America/New_York")
        formatter.setLocalizedDateFormatFromTemplate("EEE MMM d jmm")
        return "\(formatter.string(from: date)) ET"
    }
}

struct NbaPropMatchupPickerSheet: View {
    let options: [NbaPropGameOption]
    @Binding var selection: String?
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private var filtered: [NbaPropGameOption] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needle.isEmpty else { return options }
        return options.filter {
            [$0.label, $0.away ?? "", $0.home ?? ""].contains { $0.localizedCaseInsensitiveContains(needle) }
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button { selection = nil; dismiss() } label: {
                        HStack {
                            Image(systemName: "square.grid.2x2.fill").foregroundStyle(Color.appPrimary)
                            Text("All games").foregroundStyle(Color.appTextPrimary)
                            Spacer()
                            if selection == nil { Image(systemName: "checkmark").foregroundStyle(Color.appPrimary) }
                        }
                    }
                }
                Section("Games") {
                    ForEach(filtered) { option in
                        Button { selection = option.key; dismiss() } label: {
                            HStack(spacing: 10) {
                                if let away = option.away {
                                    GameCardTeamAvatar(teamName: away, sport: "nba", size: 28, colors: NBATeams.colorPair(for: away))
                                }
                                if let home = option.home {
                                    GameCardTeamAvatar(teamName: home, sport: "nba", size: 28, colors: NBATeams.colorPair(for: home))
                                }
                                Text(option.label)
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(Color.appTextPrimary)
                                Spacer()
                                if selection == option.key { Image(systemName: "checkmark").foregroundStyle(Color.appPrimary) }
                            }
                        }
                    }
                }
            }
            .searchable(text: $query, prompt: "Search teams")
            .navigationTitle("Select matchup")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }
    }
}

struct NbaPropMarketFilterSheet: View {
    let markets: [NbaPropMarketOption]
    @Binding var selection: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Button { selection = nil; dismiss() } label: { row("All markets", key: nil, emoji: "🎯") }
                ForEach(markets) { market in
                    Button { selection = market.key; dismiss() } label: { row(market.label, key: market.key, emoji: NbaMarketEmoji.glyph(market.key)) }
                }
            }
            .navigationTitle("Prop Market")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() }.tint(Color.appPrimary) } }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func row(_ label: String, key: String?, emoji: String) -> some View {
        HStack {
            Text(emoji)
            Text(label).foregroundStyle(Color.appTextPrimary)
            Spacer()
            if selection == key { Image(systemName: "checkmark").foregroundStyle(Color.appPrimary) }
        }
    }
}

struct NbaPropSignalFilterSheet: View {
    let playerCount: Int
    @Binding var signalsOnly: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Button { signalsOnly = false; dismiss() } label: {
                    HStack {
                        Text("👥")
                        Text("All players").foregroundStyle(Color.appTextPrimary)
                        Spacer()
                        if !signalsOnly { Image(systemName: "checkmark").foregroundStyle(Color.appPrimary) }
                    }
                }
                Button { signalsOnly = true; dismiss() } label: {
                    HStack {
                        Image(systemName: "bolt.fill").foregroundStyle(Color(hex: 0xF97316))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Has a signal").foregroundStyle(Color.appTextPrimary)
                            Text("\(playerCount) player\(playerCount == 1 ? "" : "s")")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                        Spacer()
                        if signalsOnly { Image(systemName: "checkmark").foregroundStyle(Color.appPrimary) }
                    }
                }
            }
            .navigationTitle("Signals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() }.tint(Color.appPrimary) } }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}

private enum NbaMarketEmoji {
    static func glyph(_ key: String) -> String {
        switch key {
        case "player_points": return "🏀"
        case "player_rebounds": return "💪"
        case "player_assists": return "🎯"
        case "player_threes": return "🔥"
        case "player_blocks": return "🛑"
        case "player_steals": return "🧤"
        case "player_points_rebounds_assists": return "📊"
        case "player_points_rebounds": return "📈"
        case "player_points_assists": return "🤝"
        case "player_rebounds_assists": return "🧩"
        default: return "🎯"
        }
    }
}

private struct NbaHeadshot: View {
    let url: String?
    let fallback: String
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle().fill(Color.appSurfaceMuted)
            if let url, let imageURL = URL(string: url) {
                CachedAsyncImage(url: imageURL) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        fallbackText
                    }
                }
            } else {
                fallbackText
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(Color.primary.opacity(0.12), lineWidth: 1))
    }

    private var fallbackText: some View {
        Text(fallback)
            .font(.system(size: max(9, size * 0.28), weight: .bold))
            .foregroundStyle(Color.appTextMuted)
    }
}

private struct NbaBookMark: View {
    let book: String?
    var style: SportsbookLogoView.Style = .compact

    var body: some View {
        SportsbookLogoView(
            logoURL: nil,
            bookKey: SportsbookCatalog.key(forDisplayName: book),
            bookName: book,
            style: style
        )
    }
}

private struct NbaSignalCount: View {
    let count: Int

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 11, weight: .bold))
            Text("\(count) Signal\(count == 1 ? "" : "s")")
                .font(.system(size: 11, weight: .heavy))
        }
        .foregroundStyle(Color(hex: 0xB45309))
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(Color(hex: 0xF59E0B).opacity(0.18), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).strokeBorder(Color(hex: 0xF59E0B).opacity(0.4), lineWidth: 1))
    }
}

private struct NbaFormStrip: View {
    let bars: [NbaRecentBar]

    var body: some View {
        HStack(spacing: 2) {
            if bars.isEmpty {
                RoundedRectangle(cornerRadius: 1).fill(Color.appSurfaceMuted).frame(width: 36, height: 10)
            } else {
                ForEach(Array(bars.enumerated()), id: \.offset) { _, bar in
                    RoundedRectangle(cornerRadius: 1)
                        .fill(bar.cleared ? Color.appPrimary : Color.appTextMuted.opacity(0.45))
                        .frame(width: 4, height: 10)
                }
            }
        }
    }
}

private struct NbaRecentChart: View {
    let bars: [NbaRecentBar]
    let line: Double
    let market: String

    var body: some View {
        let peak = max(bars.map(\.value).max() ?? line, line)
        VStack(alignment: .leading, spacing: 6) {
            Text(market)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(bars.enumerated()), id: \.offset) { _, bar in
                    VStack(spacing: 4) {
                        Text(NbaPropCopy.formatNumber(bar.value))
                            .font(.system(size: 9, weight: .bold))
                            .monospacedDigit()
                            .foregroundStyle(bar.cleared ? Color.appPrimary : Color.appTextMuted)
                        RoundedRectangle(cornerRadius: 3, style: .continuous)
                            .fill(bar.cleared ? Color.appPrimary : Color.appTextMuted.opacity(0.35))
                            .frame(height: max(8, CGFloat(bar.value / max(peak, 1)) * 88))
                        GameCardTeamAvatar(teamName: bar.opponent ?? "", sport: "nba", size: 16, colors: NBATeams.colorPair(for: bar.opponent ?? ""))
                        Text(shortDate(bar.date))
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(Color.appTextMuted)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 140, alignment: .bottom)
        }
    }

    private func shortDate(_ iso: String?) -> String {
        guard let iso, iso.count >= 10 else { return "" }
        let month = iso.dropFirst(5).prefix(2)
        let day = iso.dropFirst(8).prefix(2)
        return "\(Int(month) ?? 0)/\(Int(day) ?? 0)"
    }
}

private struct NbaMovementChart: View {
    let summary: NbaLineMovement
    let openLine: Double?
    let currentLine: Double?

    var body: some View {
        let openValue = summary.open?.line ?? openLine
        let currentValue = summary.current?.line ?? currentLine
        if openValue == nil && currentValue == nil {
            Text("Not charted.").font(.system(size: 12)).foregroundStyle(Color.appTextSecondary)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    stamp("Opening", openValue)
                    Spacer()
                    if let mid = summary.mid { stamp("Middle", mid.line) }
                    Spacer()
                    stamp("Current", currentValue)
                }
                chart(open: openValue, current: currentValue)
            }
        }
    }

    private func stamp(_ title: String, _ value: Double?) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title.uppercased())
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
            Text(NbaPropCopy.formatNumber(value))
                .font(.system(size: 14, weight: .bold))
                .monospacedDigit()
        }
    }

    private func chart(open: Double?, current: Double?) -> some View {
        let points = summary.moves.map(\.line)
        let series = points.isEmpty ? [open, current].compactMap { $0 } : points
        return GeometryReader { geo in
            let minLine = series.min() ?? 0
            let maxLine = series.max() ?? 0
            let span = max(maxLine - minLine, 0.5)
            Path { path in
                for (index, line) in series.enumerated() {
                    let x = series.count == 1 ? geo.size.width / 2 : geo.size.width * CGFloat(index) / CGFloat(series.count - 1)
                    let y = geo.size.height - (CGFloat((line - minLine) / span) * (geo.size.height - 8)) - 4
                    if index == 0 { path.move(to: CGPoint(x: x, y: y)) } else { path.addLine(to: CGPoint(x: x, y: y)) }
                }
            }
            .stroke(Color.appPrimary, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
        }
        .frame(height: 72)
    }
}
