import SwiftUI
import UIKit
import WagerproofDesign
import WagerproofModels

// MARK: - Focus

/// What the infographic's headline metric describes — the blended overall
/// number, one side of a split (home/away, fav/dog, over/under), or a single
/// team pulled from the by-team breakdown.
enum InfographicFocus: Hashable {
    case overall
    case side(String)
    case team(String)
}

// MARK: - Card styles

/// Swipeable share-card designs. Same data + focus, five very different looks.
enum TrendsShareStyle: String, CaseIterable, Identifiable {
    /// The full narrative infographic (splits + top-5 lists).
    case report
    /// Big-number social poster — one stat, loud.
    case poster
    /// Ring gauge — hit rate as a donut arc with a baseline tick.
    case gauge
    /// Bar-graph card — situation splits + top teams as chunky bars.
    case chart
    /// Betting-slip receipt — filters printed like line items.
    case receipt

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .report: return "Full Report"
        case .poster: return "Poster"
        case .gauge: return "Gauge"
        case .chart: return "Chart"
        case .receipt: return "Receipt"
        }
    }
}

/// Resolved team identity art for team-specific searches — big corner logo
/// (or initials fallback) + brand colors. Pre-fetched as a UIImage so
/// ImageRenderer exports render it synchronously (AsyncImage would export blank).
struct TrendsTeamArt: Equatable {
    let team: String
    let colors: TeamColorPair
    let logo: UIImage?
    let initials: String

    static func == (lhs: TrendsTeamArt, rhs: TrendsTeamArt) -> Bool {
        lhs.team == rhs.team && (lhs.logo == nil) == (rhs.logo == nil)
    }
}

// MARK: - Share bottom sheet

/// Bottom sheet that composes a shareable infographic for the current
/// Historical Trends search and exports it via the system share sheet.
/// Users swipe between card styles; export renders the visible one.
struct HistoricalTrendsShareView: View {
    let sport: HistoricalAnalysisSport
    let snapshot: HistoricalAnalysisUISnapshot
    let analysis: HistoricalAnalysisResponse?
    /// CFB logo URLs by school (fetched by the store) — CFB has no static table.
    var cfbLogos: [String: String] = [:]

    @Environment(\.dismiss) private var dismiss
    @State private var shareItem: ShareableInfographicImage?
    @State private var focus: InfographicFocus = .overall
    @State private var style: TrendsShareStyle = .report
    @State private var cardHeights: [TrendsShareStyle: CGFloat] = [:]
    @State private var teamArt: TrendsTeamArt?

    private let infographicWidth: CGFloat = 340

    // MARK: Team art

    /// The search is "team specific" when the share focus is a team OR the
    /// filter itself is narrowed to exactly one team.
    private var focusTeamName: String? {
        if case .team(let team) = focus { return team }
        if snapshot.teams.count == 1 { return snapshot.teams[0] }
        return nil
    }

    private func resolveTeamArt() async {
        guard let team = focusTeamName else {
            teamArt = nil
            return
        }
        let colors: TeamColorPair
        let logoUrl: String?
        switch sport {
        case .nfl:
            colors = NFLTeamColors.colorPair(for: team)
            logoUrl = NFLTeamAssets.logo(for: team)
        case .mlb:
            colors = MLBTeamColors.colorPair(for: team)
            logoUrl = MLBTeams.logoUrl(for: team)
        case .cfb:
            colors = CFBTeamColors.colorPair(for: team)
            logoUrl = cfbLogos[team]
        }
        let initials = team.split(separator: " ").compactMap(\.first).prefix(2).map(String.init).joined()
        var logo: UIImage?
        if let logoUrl, let url = URL(string: logoUrl),
           let (data, _) = try? await URLSession.shared.data(from: url) {
            logo = UIImage(data: data)
        }
        teamArt = TrendsTeamArt(
            team: team,
            colors: colors,
            logo: logo,
            initials: initials.isEmpty ? String(team.prefix(2)).uppercased() : initials
        )
    }

    var body: some View {
        NavigationStack {
            Group {
                if let analysis, analysis.overall.n > 0 {
                    ScrollView {
                        VStack(spacing: 12) {
                            focusPicker(analysis)
                            stylePager(analysis)
                            styleDots
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                    }
                    .safeAreaInset(edge: .bottom) { shareButton }
                } else {
                    ContentUnavailableView(
                        "Nothing to share yet",
                        systemImage: "chart.bar",
                        description: Text("No games match this search — widen the filters first.")
                    )
                }
            }
            .background(Color.appSurface)
            .navigationTitle("Share Search")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .task(id: focusTeamName) { await resolveTeamArt() }
        .sheet(item: $shareItem) { item in
            ActivityShareSheet(items: [item.image])
        }
    }

    // MARK: Style pager

    /// Horizontal pager over the card styles. TabView needs an explicit height,
    /// so each page reports its natural size and the pager tracks the visible one.
    private func stylePager(_ analysis: HistoricalAnalysisResponse) -> some View {
        TabView(selection: $style) {
            ForEach(TrendsShareStyle.allCases) { s in
                card(style: s, analysis: analysis)
                    .frame(width: infographicWidth)
                    .background(
                        GeometryReader { geo in
                            Color.clear.preference(key: TrendsCardHeightKey.self, value: [s: geo.size.height])
                        }
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .tag(s)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .onPreferenceChange(TrendsCardHeightKey.self) { heights in
            cardHeights.merge(heights) { _, new in new }
        }
        .frame(height: (cardHeights[style] ?? 620) + 8)
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: style)
    }

    private var styleDots: some View {
        VStack(spacing: 6) {
            HStack(spacing: 7) {
                ForEach(TrendsShareStyle.allCases) { s in
                    Capsule()
                        .fill(s == style ? Color.appPrimary : Color.appTextMuted.opacity(0.45))
                        .frame(width: s == style ? 18 : 6, height: 6)
                        .onTapGesture {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) { style = s }
                        }
                }
            }
            Text(style.displayName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .contentTransition(.numericText())
        }
        .animation(.spring(response: 0.32, dampingFraction: 0.86), value: style)
    }

    /// One card, by style — used by both the pager and the export renderer.
    @ViewBuilder
    private func card(style: TrendsShareStyle, analysis: HistoricalAnalysisResponse) -> some View {
        switch style {
        case .report:
            HistoricalTrendsInfographic(sport: sport, snapshot: snapshot, analysis: analysis, focus: focus)
                .environment(\.colorScheme, .dark)
        case .poster:
            TrendsSharePosterCard(sport: sport, snapshot: snapshot, analysis: analysis, focus: focus)
                .environment(\.colorScheme, .dark)
        case .gauge:
            TrendsShareGaugeCard(sport: sport, snapshot: snapshot, analysis: analysis, focus: focus, teamArt: teamArt)
                .environment(\.colorScheme, .dark)
        case .chart:
            TrendsShareChartCard(sport: sport, snapshot: snapshot, analysis: analysis, focus: focus, teamArt: teamArt)
                .environment(\.colorScheme, .dark)
        case .receipt:
            TrendsShareReceiptCard(sport: sport, snapshot: snapshot, analysis: analysis, focus: focus)
                .environment(\.colorScheme, .dark)
        }
    }

    // MARK: Focus picker

    private func focusPicker(_ analysis: HistoricalAnalysisResponse) -> some View {
        Menu {
            Picker("Focus", selection: $focus) {
                Label("Overall", systemImage: "scope").tag(InfographicFocus.overall)
                ForEach(sideChoices(analysis), id: \.self) { side in
                    Label(focusSideLabel(side), systemImage: focusSideIcon(side)).tag(InfographicFocus.side(side))
                }
            }
            let teams = teamChoices(analysis)
            if !teams.isEmpty {
                Menu {
                    Picker("Team", selection: $focus) {
                        ForEach(teams, id: \.self) { team in
                            Label(team, systemImage: "sportscourt").tag(InfographicFocus.team(team))
                        }
                    }
                } label: {
                    Label("Focus on a team", systemImage: "person.crop.circle")
                }
            }
        } label: {
            HStack(spacing: 6) {
                Text("Showing: \(focusLabel)")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
    }

    private var focusLabel: String {
        switch focus {
        case .overall: return "Overall"
        case .side(let side): return focusSideLabel(side)
        case .team(let team): return team
        }
    }

    private func focusSideLabel(_ side: String) -> String {
        switch side {
        case "home": return "Home teams"
        case "away": return "Away teams"
        case "favorite": return "Favorites"
        case "underdog": return "Underdogs"
        case "over": return "The over"
        case "under": return "The under"
        default: return side
        }
    }

    private func focusSideIcon(_ side: String) -> String {
        switch side {
        case "home": return "house.fill"
        case "away": return "airplane"
        case "favorite": return "star.fill"
        case "underdog": return "shield"
        case "over": return "arrow.up"
        case "under": return "arrow.down"
        default: return "chart.bar"
        }
    }

    /// Sides available in the (non-degenerate) splits for this search.
    private func sideChoices(_ analysis: HistoricalAnalysisResponse) -> [String] {
        let bars = HistoricalAnalysisFilterBuilder.shownBars(analysis.bars, snapshot: snapshot)
        var seen = Set<String>()
        return bars.flatMap(\.options).map(\.side).filter { seen.insert($0).inserted }
    }

    private func teamChoices(_ analysis: HistoricalAnalysisResponse) -> [String] {
        analysis.byTeam
            .filter { $0.n >= 3 }
            .sorted { $0.n > $1.n }
            .compactMap(\.team)
    }

    // MARK: Render + export

    private var shareButton: some View {
        Button {
            share()
        } label: {
            Label("Share \(style.displayName)", systemImage: "square.and.arrow.up")
                .font(.system(size: 16, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
        .buttonStyle(.borderedProminent)
        .tint(Color.appPrimary)
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    /// Render JUST the visible card — transparent everywhere outside it —
    /// so it shares as a standalone branded component (same trick as the
    /// agent pick tickets in AgentPickFocusView).
    @MainActor private func share() {
        guard let analysis, analysis.overall.n > 0 else { return }
        let exportCard = card(style: style, analysis: analysis)
            .frame(width: infographicWidth)
        let renderer = ImageRenderer(content: exportCard)
        renderer.scale = 3
        renderer.isOpaque = false
        if let image = renderer.uiImage {
            shareItem = ShareableInfographicImage(image: image)
        }
    }
}

/// Reports each pager page's natural height so the TabView can size to the
/// visible card (pages render lazily; missing entries fall back to a default).
private struct TrendsCardHeightKey: PreferenceKey {
    static let defaultValue: [TrendsShareStyle: CGFloat] = [:]
    static func reduce(value: inout [TrendsShareStyle: CGFloat], nextValue: () -> [TrendsShareStyle: CGFloat]) {
        value.merge(nextValue()) { _, new in new }
    }
}

// MARK: - Infographic component

/// Self-contained dark card summarizing a Historical Trends search as a
/// narrative — "When {filters}, {subject} covered X% of the time" — plus
/// situation split bars and top-5 lists, branded with WagerProof at the
/// bottom. Exported with a transparent surround.
struct HistoricalTrendsInfographic: View {
    let sport: HistoricalAnalysisSport
    let snapshot: HistoricalAnalysisUISnapshot
    let analysis: HistoricalAnalysisResponse
    var focus: InfographicFocus = .overall

    // Fixed inks — the cardstock is always dark, and ImageRenderer can resolve
    // UIColor-backed adaptive tokens against the wrong trait collection.
    private let ink = Color(hex: 0xF8FAFC)
    private let inkSecondary = Color(hex: 0x9AA3B2)

    var body: some View {
        let metrics = focusedMetrics
        let sig = HistoricalAnalysisCopy.significance(n: metrics.n, hit: metrics.hitPct)
        let delta = metrics.hitPct - analysis.baselinePct

        VStack(alignment: .leading, spacing: 16) {
            header
            narrative(metrics)
            heroStats(metrics)

            Text("\(delta >= 0 ? "+" : "")\(HistoricalAnalysisCopy.trimmed(delta)) pts vs \(HistoricalAnalysisCopy.trimmed(analysis.baselinePct))% league baseline · \(sig.label)")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(inkSecondary)

            situationGraphs
            topFives

            Divider().overlay(Color.white.opacity(0.08))
            footer
        }
        .padding(22)
        .background(cardstock)
    }

    // MARK: Focused metric slice (shared with the other card styles)

    private var ctx: TrendsShareContext {
        TrendsShareContext(sport: sport, snapshot: snapshot, analysis: analysis, focus: focus)
    }

    private var focusedMetrics: (n: Int, wins: Int, hitPct: Double, roi: Double?) { ctx.metrics }

    private var focusSubjectVerb: (subject: String, verb: String) { ctx.subjectVerb }

    private var clauses: [String] { ctx.clauses }

    // MARK: Sections

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("\(sport.shortTitle) HISTORICAL TRENDS")
                .font(.system(size: 11, weight: .heavy))
                .tracking(1.2)
                .foregroundStyle(Color.appPrimary)
            Spacer()
            Text(verbatim: "\(HistoricalAnalysisBetType.from(snapshot.betType).label) · \(HistoricalAnalysisCopy.yearRange(analysis.coverage.seasonMin, analysis.coverage.seasonMax))")
                .font(.system(size: 11, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(inkSecondary)
        }
    }

    private func narrative(_ metrics: (n: Int, wins: Int, hitPct: Double, roi: Double?)) -> some View {
        let (subject, verb) = focusSubjectVerb
        let pct = HistoricalAnalysisCopy.trimmed(metrics.hitPct) + "%"
        let prefix: String
        if clauses.isEmpty {
            prefix = "Across every game since \(HistoricalAnalysisCopy.year(analysis.coverage.seasonMin)), \(subject) \(verb) "
        } else {
            prefix = "When \(HistoricalAnalysisCopy.joinedClauses(clauses)), \(subject) \(verb) "
        }
        return (
            Text(prefix).foregroundStyle(ink)
            + Text(pct).foregroundStyle(HistoricalAnalysisCopy.hitPctColor(metrics.hitPct)).fontWeight(.heavy)
            + Text(" of the time.").foregroundStyle(ink)
        )
        .font(.system(size: 19, weight: .semibold))
        .fixedSize(horizontal: false, vertical: true)
    }

    private func heroStats(_ metrics: (n: Int, wins: Int, hitPct: Double, roi: Double?)) -> some View {
        HStack(alignment: .center, spacing: 16) {
            Text("\(HistoricalAnalysisCopy.trimmed(metrics.hitPct))%")
                .font(.system(size: 40, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(HistoricalAnalysisCopy.hitPctColor(metrics.hitPct))

            VStack(alignment: .leading, spacing: 4) {
                statLine(
                    value: "\(metrics.wins) of \(metrics.n)",
                    label: HistoricalAnalysisCopy.noun(for: snapshot.betType, snapshot: snapshot)
                )
                if let roi = metrics.roi {
                    statLine(
                        value: HistoricalAnalysisCopy.signedPct(roi),
                        label: "ROI",
                        valueColor: roi >= 0 ? .green : .red
                    )
                }
                if focus == .overall {
                    statLine(value: "\(analysis.coverage.nGames)", label: "games")
                }
            }
            Spacer(minLength: 0)
        }
    }

    private func statLine(value: String, label: String, valueColor: Color? = nil) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 5) {
            Text(value)
                .font(.system(size: 14, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(valueColor ?? ink)
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(inkSecondary)
        }
    }

    // MARK: Graphs

    @ViewBuilder
    private var situationGraphs: some View {
        let bars = HistoricalAnalysisFilterBuilder.shownBars(analysis.bars, snapshot: snapshot)
        if !bars.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                sectionTitle("BY SITUATION")
                ForEach(bars) { bar in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(HistoricalAnalysisCopy.dimLabels[bar.dimension] ?? bar.dimension)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(inkSecondary)
                        ForEach(bar.options) { opt in
                            optionBar(opt)
                        }
                    }
                }
            }
        }
    }

    private func optionBar(_ opt: HistoricalAnalysisBarOption) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(HistoricalAnalysisCopy.sideLabel(betType: snapshot.betType, side: opt.side))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(ink)
                Spacer()
                Text("\(HistoricalAnalysisCopy.trimmed(opt.hitPct))% (\(opt.wins) of \(opt.n))")
                    .font(.system(size: 12, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(HistoricalAnalysisCopy.hitPctColor(opt.hitPct))
            }
            InfographicBar(pct: opt.hitPct, baseline: analysis.baselinePct)
                .frame(height: 7)
        }
    }

    // MARK: Top 5s

    @ViewBuilder
    private var topFives: some View {
        let teams = topRows(analysis.byTeam)
        if teams.count >= 3 {
            topList(title: "TOP TEAMS IN THIS SPOT", rows: teams, allRows: analysis.byTeam)
        }
        switch sport {
        case .nfl:
            let coaches = topRows(analysis.byCoach ?? [])
            if coaches.count >= 3 {
                topList(title: "TOP COACHES", rows: coaches, allRows: analysis.byCoach ?? [])
            }
        case .cfb:
            let conferences = topRows(analysis.byConference ?? [])
            if conferences.count >= 3 {
                topList(title: "TOP CONFERENCES", rows: conferences, allRows: analysis.byConference ?? [])
            }
        case .mlb:
            let venues = topRows(analysis.byVenue ?? [])
            if venues.count >= 3 {
                topList(title: "TOP VENUES", rows: venues, allRows: analysis.byVenue ?? [])
            }
        }
    }

    /// Best hit rates with a minimum sample so a 1-game 100% never headlines.
    private func topRows(_ rows: [HistoricalAnalysisBreakdownRow]) -> [HistoricalAnalysisBreakdownRow] {
        Array(qualifyingSorted(rows).prefix(5))
    }

    private func qualifyingSorted(_ rows: [HistoricalAnalysisBreakdownRow]) -> [HistoricalAnalysisBreakdownRow] {
        rows.filter { $0.n >= 5 && $0.label != "—" }
            .sorted { $0.hitPct != $1.hitPct ? $0.hitPct > $1.hitPct : $0.n > $1.n }
    }

    private func topList(
        title: String,
        rows: [HistoricalAnalysisBreakdownRow],
        allRows: [HistoricalAnalysisBreakdownRow]
    ) -> some View {
        // When a team is focused but outside the top 5, append it with its true rank.
        var extra: (rank: Int, row: HistoricalAnalysisBreakdownRow)?
        if case .team(let team) = focus, title == "TOP TEAMS IN THIS SPOT",
           !rows.contains(where: { $0.team == team }) {
            let sorted = qualifyingSorted(allRows)
            if let idx = sorted.firstIndex(where: { $0.team == team }) {
                extra = (idx + 1, sorted[idx])
            }
        }

        return VStack(alignment: .leading, spacing: 8) {
            sectionTitle(title)
            ForEach(Array(rows.enumerated()), id: \.element.id) { idx, row in
                topRow(rank: idx + 1, row: row)
            }
            if let extra {
                Text("···")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(inkSecondary)
                    .padding(.leading, 2)
                topRow(rank: extra.rank, row: extra.row)
            }
        }
    }

    private func topRow(rank: Int, row: HistoricalAnalysisBreakdownRow) -> some View {
        let isFocused: Bool = {
            if case .team(let team) = focus { return row.team == team }
            return false
        }()
        return HStack(spacing: 8) {
            Text("\(rank)")
                .font(.system(size: 11, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(inkSecondary)
                .frame(width: 16, alignment: .leading)
            Text(row.label)
                .font(.system(size: 13, weight: isFocused ? .bold : .medium))
                .foregroundStyle(isFocused ? Color.appPrimary : ink)
                .lineLimit(1)
            Spacer(minLength: 8)
            InfographicBar(pct: row.hitPct, baseline: analysis.baselinePct)
                .frame(width: 64, height: 6)
            Text("\(HistoricalAnalysisCopy.trimmed(row.hitPct))%")
                .font(.system(size: 13, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(HistoricalAnalysisCopy.hitPctColor(row.hitPct))
                .frame(width: 46, alignment: .trailing)
            Text("\(row.n)g")
                .font(.system(size: 11))
                .monospacedDigit()
                .foregroundStyle(inkSecondary)
                .frame(width: 30, alignment: .trailing)
        }
    }

    // MARK: Chrome

    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 9, weight: .bold))
            .tracking(1)
            .foregroundStyle(inkSecondary)
    }

    private var footer: some View {
        HStack {
            WagerproofTicketFooter()
            Spacer()
            Text("wagerproof.bet")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(inkSecondary.opacity(0.8))
        }
    }

    private var cardstock: some View {
        RoundedRectangle(cornerRadius: 24, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [Color(hex: 0x17191E), Color(hex: 0x0C0D10)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.10), lineWidth: 1)
            )
    }
}

// MARK: - Bar mark

/// Fixed-palette hit-rate bar for the dark card (baseline tick included).
private struct InfographicBar: View {
    let pct: Double
    let baseline: Double

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.white.opacity(0.08))
                Capsule()
                    .fill(fillColor)
                    .frame(width: geo.size.width * min(max(pct, 0), 100) / 100)
                Rectangle()
                    .fill(Color.white.opacity(0.5))
                    .frame(width: 1.5)
                    .offset(x: geo.size.width * baseline / 100 - 0.75)
            }
        }
    }

    private var fillColor: Color {
        if pct > 50 { return Color.green.opacity(0.65) }
        if pct < 50 { return Color.red.opacity(0.55) }
        return Color.white.opacity(0.35)
    }
}

// MARK: - Share plumbing

/// Identifiable wrapper so a freshly rendered infographic can drive `.sheet(item:)`.
private struct ShareableInfographicImage: Identifiable {
    let id = UUID()
    let image: UIImage
}

private struct ActivityShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

// MARK: - Shared card context

/// Headline computations shared by every share-card style — focused metric
/// slice, subject/verb phrasing, and narrative filter clauses.
struct TrendsShareContext {
    let sport: HistoricalAnalysisSport
    let snapshot: HistoricalAnalysisUISnapshot
    let analysis: HistoricalAnalysisResponse
    let focus: InfographicFocus

    var metrics: (n: Int, wins: Int, hitPct: Double, roi: Double?) {
        switch focus {
        case .overall:
            return HistoricalAnalysisCopy.headlineMetrics(snapshot: snapshot, data: analysis)
        case .side(let side):
            for bar in analysis.bars {
                if let opt = bar.options.first(where: { $0.side == side }) {
                    return (opt.n, opt.wins, opt.hitPct, opt.roi)
                }
            }
            return HistoricalAnalysisCopy.headlineMetrics(snapshot: snapshot, data: analysis)
        case .team(let team):
            if let row = analysis.byTeam.first(where: { $0.team == team }) {
                // Breakdown rows don't carry wins — derive from the rate.
                let wins = Int((row.hitPct / 100 * Double(row.n)).rounded())
                return (row.n, wins, row.hitPct, row.roi)
            }
            return HistoricalAnalysisCopy.headlineMetrics(snapshot: snapshot, data: analysis)
        }
    }

    var subjectVerb: (subject: String, verb: String) {
        let betType = snapshot.betType
        let verb = HistoricalAnalysisCopy.verb(for: betType)
        switch focus {
        case .overall:
            let subject = HistoricalAnalysisCopy.headlineSubject(sport: sport, snapshot: snapshot)
            return (HistoricalAnalysisCopy.midSentenceSubject(subject), verb)
        case .side(let side):
            switch side {
            case "home": return ("home teams", verb)
            case "away": return ("road teams", verb)
            case "favorite": return ("favorites", verb)
            case "underdog": return ("underdogs", verb)
            case "over", "under":
                let market = betType == "h1_total" ? "1H " : ""
                let suffix = betType == "team_total" ? " on team totals" : ""
                return ("the \(market)\(side)\(suffix)", "hit")
            default: return (side, verb)
            }
        case .team(let team):
            if ["fg_total", "h1_total"].contains(betType) {
                return ("\(team) games", verb)
            }
            return (team, verb)
        }
    }

    /// Filter clauses; when the focus overrides the subject, directional
    /// filters that headlineSubject would have absorbed become clauses.
    var clauses: [String] {
        var clauses = HistoricalAnalysisCopy.narrativeClauses(sport: sport, snapshot: snapshot)
        guard focus != .overall else { return clauses }
        if snapshot.side == "home", focus != .side("home") { clauses.append("playing at home") }
        if snapshot.side == "away", focus != .side("away") { clauses.append("playing on the road") }
        let hasFavDog = HistoricalAnalysisBetType.moneylineMarkets.contains(snapshot.betType)
            || snapshot.betType == "team_total"
        if hasFavDog {
            if snapshot.favDog == "favorite", focus != .side("favorite") { clauses.append("as favorites") }
            if snapshot.favDog == "underdog", focus != .side("underdog") { clauses.append("as underdogs") }
        }
        return clauses
    }

    /// Active-filter labels (the same strings as the on-page chips).
    var filterLabels: [String] {
        HistoricalAnalysisCopy.activeChips(
            sport: sport,
            snapshot: snapshot,
            seasonFloor: HistoricalAnalysisFilterBuilder.seasonFloor(betType: snapshot.betType, sport: sport)
        ) { _ in }.map(\.label)
    }
}

// MARK: - Poster card

/// Big-number social poster: one giant hit rate over a color aura, the
/// situation as an eyebrow, subject line as the payoff. Loud on purpose.
struct TrendsSharePosterCard: View {
    let sport: HistoricalAnalysisSport
    let snapshot: HistoricalAnalysisUISnapshot
    let analysis: HistoricalAnalysisResponse
    var focus: InfographicFocus = .overall

    private let ink = Color(hex: 0xF8FAFC)
    private let inkSecondary = Color(hex: 0x9AA3B2)

    private var ctx: TrendsShareContext {
        TrendsShareContext(sport: sport, snapshot: snapshot, analysis: analysis, focus: focus)
    }

    var body: some View {
        let metrics = ctx.metrics
        let (subject, verb) = ctx.subjectVerb
        let accent = HistoricalAnalysisCopy.hitPctColor(metrics.hitPct)

        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(sport.shortTitle) TRENDS")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(1.6)
                    .foregroundStyle(Color.appPrimary)
                Spacer()
                Text(verbatim: "\(HistoricalAnalysisBetType.from(snapshot.betType).label) · \(HistoricalAnalysisCopy.yearRange(analysis.coverage.seasonMin, analysis.coverage.seasonMax))")
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(inkSecondary)
            }
            .padding(.bottom, 26)

            Text(eyebrow.uppercased())
                .font(.system(size: 12, weight: .bold))
                .tracking(1.1)
                .foregroundStyle(inkSecondary)
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.bottom, 6)

            Text("\(HistoricalAnalysisCopy.trimmed(metrics.hitPct))%")
                .font(.system(size: 82, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(accent)
                .shadow(color: accent.opacity(0.45), radius: 24, x: 0, y: 0)
                .padding(.bottom, 2)

            Text("\(subject) \(verb)")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.bottom, 18)

            // ViewThatFits: big records ("273–197") can overflow one row —
            // fall back to two rows instead of wrapping text inside a chip.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) {
                    posterChips(metrics)
                }
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        posterChip("\(metrics.wins)–\(metrics.n - metrics.wins)", label: "record")
                        if let roi = metrics.roi {
                            posterChip(HistoricalAnalysisCopy.signedPct(roi), label: "ROI", color: roi >= 0 ? .green : .red)
                        }
                    }
                    posterChip("\(metrics.n)", label: HistoricalAnalysisCopy.noun(for: snapshot.betType, snapshot: snapshot))
                }
            }
            .padding(.bottom, 22)

            Divider().overlay(Color.white.opacity(0.08))
                .padding(.bottom, 12)

            HStack {
                WagerproofTicketFooter()
                Spacer()
                Text("wagerproof.bet")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(inkSecondary.opacity(0.8))
            }
        }
        .padding(24)
        .background(posterBackground(accent: accent))
    }

    private var eyebrow: String {
        let clauses = ctx.clauses
        if clauses.isEmpty {
            return "Every game since \(HistoricalAnalysisCopy.year(analysis.coverage.seasonMin))"
        }
        let shown = clauses.prefix(3)
        var text = "When \(HistoricalAnalysisCopy.joinedClauses(Array(shown)))"
        if clauses.count > 3 { text += " (+\(clauses.count - 3) more)" }
        return text
    }

    @ViewBuilder
    private func posterChips(_ metrics: (n: Int, wins: Int, hitPct: Double, roi: Double?)) -> some View {
        posterChip("\(metrics.wins)–\(metrics.n - metrics.wins)", label: "record")
        if let roi = metrics.roi {
            posterChip(HistoricalAnalysisCopy.signedPct(roi), label: "ROI", color: roi >= 0 ? .green : .red)
        }
        posterChip("\(metrics.n)", label: HistoricalAnalysisCopy.noun(for: snapshot.betType, snapshot: snapshot))
    }

    private func posterChip(_ value: String, label: String, color: Color? = nil) -> some View {
        HStack(spacing: 5) {
            Text(value)
                .font(.system(size: 13, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(color ?? ink)
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(inkSecondary)
        }
        .lineLimit(1)
        .fixedSize()
        .padding(.horizontal, 11)
        .padding(.vertical, 7)
        .background(Capsule().fill(Color.white.opacity(0.07)))
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.08), lineWidth: 1))
    }

    private func posterBackground(accent: Color) -> some View {
        RoundedRectangle(cornerRadius: 28, style: .continuous)
            .fill(Color(hex: 0x0B0C10))
            .overlay(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(
                        RadialGradient(
                            colors: [accent.opacity(0.32), .clear],
                            center: .init(x: 0.85, y: 0.28),
                            startRadius: 10,
                            endRadius: 260
                        )
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(
                        RadialGradient(
                            colors: [Color.appPrimary.opacity(0.20), .clear],
                            center: .init(x: 0.05, y: 0.95),
                            startRadius: 10,
                            endRadius: 300
                        )
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.10), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    }
}

// MARK: - Receipt card

/// Betting-slip receipt on cream paper: every active filter printed as a line
/// item, the result as the total, a decorative barcode at the bottom.
struct TrendsShareReceiptCard: View {
    let sport: HistoricalAnalysisSport
    let snapshot: HistoricalAnalysisUISnapshot
    let analysis: HistoricalAnalysisResponse
    var focus: InfographicFocus = .overall

    private let paper = Color(hex: 0xF3EFE4)
    private let inkDark = Color(hex: 0x1B1D22)
    private let inkMuted = Color(hex: 0x77716A)

    private var ctx: TrendsShareContext {
        TrendsShareContext(sport: sport, snapshot: snapshot, analysis: analysis, focus: focus)
    }

    var body: some View {
        let metrics = ctx.metrics
        let (subject, verb) = ctx.subjectVerb

        VStack(spacing: 0) {
            Text("WAGERPROOF")
                .font(.system(size: 20, weight: .black, design: .monospaced))
                .tracking(4)
                .foregroundStyle(inkDark)
                .padding(.top, 22)
            Text("* HISTORICAL TRENDS RECEIPT *")
                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                .foregroundStyle(inkMuted)
                .padding(.top, 3)

            dashedDivider.padding(.vertical, 12)

            receiptRow("SPORT", sport.shortTitle.uppercased())
            receiptRow("MARKET", HistoricalAnalysisBetType.from(snapshot.betType).label.uppercased())
            receiptRow("SEASONS", HistoricalAnalysisCopy.yearRange(analysis.coverage.seasonMin, analysis.coverage.seasonMax))
            receiptRow("SUBJECT", "\(subject)".uppercased())

            dashedDivider.padding(.vertical, 12)

            let filters = ctx.filterLabels
            VStack(spacing: 5) {
                if filters.isEmpty {
                    Text("NO FILTERS — FULL HISTORY")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(inkMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    ForEach(filters, id: \.self) { label in
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text(label.uppercased())
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                .foregroundStyle(inkDark)
                                .lineLimit(2)
                            Spacer(minLength: 4)
                            Text("✓")
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundStyle(inkMuted)
                        }
                    }
                }
            }

            dashedDivider.padding(.vertical, 12)

            receiptRow("GAMES", "\(analysis.coverage.nGames)")
            receiptRow("RECORD", "\(metrics.wins)–\(metrics.n - metrics.wins)")
            if let roi = metrics.roi {
                receiptRow("ROI", HistoricalAnalysisCopy.signedPct(roi))
            }

            HStack(alignment: .firstTextBaseline) {
                Text("\(subject.uppercased()) \(verb.uppercased())")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(inkDark)
                    .lineLimit(2)
                Spacer(minLength: 8)
                Text("\(HistoricalAnalysisCopy.trimmed(metrics.hitPct))%")
                    .font(.system(size: 30, weight: .black, design: .monospaced))
                    .foregroundStyle(stampColor(metrics.hitPct))
            }
            .padding(.top, 8)

            dashedDivider.padding(.vertical, 12)

            barcode
                .frame(height: 30)
                .padding(.horizontal, 26)
            Text("wagerproof.bet")
                .font(.system(size: 9, weight: .semibold, design: .monospaced))
                .foregroundStyle(inkMuted)
                .padding(.top, 6)
                .padding(.bottom, 18)
        }
        .padding(.horizontal, 20)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(paper)
                .shadow(color: .black.opacity(0.35), radius: 14, x: 0, y: 6)
        )
    }

    private func receiptRow(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(label)
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(inkMuted)
            Spacer(minLength: 4)
            Text(value)
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(inkDark)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 1)
    }

    private var dashedDivider: some View {
        Line()
            .stroke(style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
            .foregroundStyle(inkMuted.opacity(0.5))
            .frame(height: 1)
    }

    /// Win rate above the vig → green stamp, below water → red, else neutral.
    private func stampColor(_ pct: Double) -> Color {
        if pct >= 52.4 { return Color(hex: 0x14803C) }
        if pct < 47.6 { return Color(hex: 0xB42318) }
        return inkDark
    }

    /// Decorative barcode — bar widths derived from the search itself so each
    /// receipt's code looks unique but renders identically preview→export.
    private var barcode: some View {
        let seed = "\(sport.rawValue)|\(snapshot.betType)|\(ctx.filterLabels.joined())"
        let widths: [CGFloat] = seed.unicodeScalars.prefix(44).map { CGFloat($0.value % 3) + 1 }
        return HStack(alignment: .center, spacing: 1.5) {
            ForEach(Array(widths.enumerated()), id: \.offset) { _, w in
                Rectangle()
                    .fill(inkDark)
                    .frame(width: w)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

/// Straight horizontal line shape for the dashed receipt dividers.
private struct Line: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 0, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.width, y: rect.midY))
        return p
    }
}

// MARK: - Corner art backdrop

/// Giant faded identity art pinned to a card corner: team logo when the
/// search is team-specific, colored initials when the logo is missing (CFB),
/// otherwise the sport's ball icon. Clip to the card shape at the call site.
private struct TrendsCornerArt: View {
    let teamArt: TrendsTeamArt?
    let sport: HistoricalAnalysisSport

    var body: some View {
        Group {
            if let art = teamArt, let logo = art.logo {
                Image(uiImage: logo)
                    .resizable()
                    .scaledToFit()
                    .opacity(0.16)
            } else if let art = teamArt {
                Text(art.initials)
                    .font(.system(size: 120, weight: .black, design: .rounded))
                    .foregroundStyle(art.colors.primary.opacity(0.30))
            } else {
                Image(systemName: sport == .mlb ? "baseball.fill" : "football.fill")
                    .font(.system(size: 150, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.05))
            }
        }
        .frame(width: 210, height: 210)
        .rotationEffect(.degrees(-12))
        .offset(x: 62, y: -44)
    }
}

/// Shared dark cardstock with a team-tinted aura + the corner art baked in.
private struct TrendsGraphCardstock: View {
    let teamArt: TrendsTeamArt?
    let sport: HistoricalAnalysisSport
    let fallbackTint: Color

    var body: some View {
        let tint = teamArt?.colors.primary ?? fallbackTint
        RoundedRectangle(cornerRadius: 28, style: .continuous)
            .fill(Color(hex: 0x0B0C10))
            .overlay(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(
                        RadialGradient(
                            colors: [tint.opacity(0.30), .clear],
                            center: .init(x: 0.88, y: 0.10),
                            startRadius: 10,
                            endRadius: 300
                        )
                    )
            )
            .overlay(alignment: .topTrailing) {
                TrendsCornerArt(teamArt: teamArt, sport: sport)
            }
            .overlay(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.10), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    }
}

// MARK: - Gauge card

/// Ring-gauge share card: the hit rate as a donut arc against the league
/// baseline tick, with record + ROI below. Team logo/color takes over the
/// backdrop for team-specific searches.
struct TrendsShareGaugeCard: View {
    let sport: HistoricalAnalysisSport
    let snapshot: HistoricalAnalysisUISnapshot
    let analysis: HistoricalAnalysisResponse
    var focus: InfographicFocus = .overall
    var teamArt: TrendsTeamArt?

    private let ink = Color(hex: 0xF8FAFC)
    private let inkSecondary = Color(hex: 0x9AA3B2)

    private var ctx: TrendsShareContext {
        TrendsShareContext(sport: sport, snapshot: snapshot, analysis: analysis, focus: focus)
    }

    var body: some View {
        let metrics = ctx.metrics
        let (subject, verb) = ctx.subjectVerb
        let accent = HistoricalAnalysisCopy.hitPctColor(metrics.hitPct)

        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(sport.shortTitle) TRENDS")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(1.6)
                    .foregroundStyle(Color.appPrimary)
                Spacer()
                Text(verbatim: "\(HistoricalAnalysisBetType.from(snapshot.betType).label) · \(HistoricalAnalysisCopy.yearRange(analysis.coverage.seasonMin, analysis.coverage.seasonMax))")
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(inkSecondary)
            }
            .padding(.bottom, 24)

            HStack {
                Spacer(minLength: 0)
                gaugeRing(metrics: metrics, accent: accent)
                Spacer(minLength: 0)
            }
            .padding(.bottom, 20)

            Text("\(subject) \(verb) — \(situationLine)")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.bottom, 14)

            HStack(spacing: 14) {
                gaugeStat("\(metrics.wins)–\(metrics.n - metrics.wins)", label: "record")
                if let roi = metrics.roi {
                    gaugeStat(HistoricalAnalysisCopy.signedPct(roi), label: "ROI", color: roi >= 0 ? .green : .red)
                }
                gaugeStat("\(analysis.coverage.nGames)", label: "games")
                Spacer(minLength: 0)
            }
            .padding(.bottom, 20)

            Divider().overlay(Color.white.opacity(0.08))
                .padding(.bottom, 12)

            HStack {
                WagerproofTicketFooter()
                Spacer()
                Text("wagerproof.bet")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(inkSecondary.opacity(0.8))
            }
        }
        .padding(24)
        .background(
            TrendsGraphCardstock(teamArt: teamArt, sport: sport, fallbackTint: accent)
        )
    }

    private var situationLine: String {
        let clauses = ctx.clauses
        if clauses.isEmpty {
            return "every game since \(HistoricalAnalysisCopy.year(analysis.coverage.seasonMin))"
        }
        let shown = clauses.prefix(3)
        var text = "when \(HistoricalAnalysisCopy.joinedClauses(Array(shown)))"
        if clauses.count > 3 { text += " (+\(clauses.count - 3) more)" }
        return text
    }

    private func gaugeRing(metrics: (n: Int, wins: Int, hitPct: Double, roi: Double?), accent: Color) -> some View {
        let pct = min(max(metrics.hitPct, 0), 100) / 100
        let baseline = min(max(analysis.baselinePct, 0), 100) / 100
        return ZStack {
            Circle()
                .stroke(Color.white.opacity(0.08), style: StrokeStyle(lineWidth: 17, lineCap: .round))
            Circle()
                .trim(from: 0, to: pct)
                .stroke(
                    AngularGradient(
                        colors: [accent.opacity(0.55), accent],
                        center: .center,
                        startAngle: .degrees(0),
                        endAngle: .degrees(360 * pct)
                    ),
                    style: StrokeStyle(lineWidth: 17, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .shadow(color: accent.opacity(0.5), radius: 12)
            // Baseline tick — where the league sits on the same ring.
            Rectangle()
                .fill(Color.white.opacity(0.85))
                .frame(width: 2.5, height: 23)
                .offset(y: -97)
                .rotationEffect(.degrees(360 * baseline))

            VStack(spacing: 3) {
                Text("\(HistoricalAnalysisCopy.trimmed(metrics.hitPct))%")
                    .font(.system(size: 44, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(accent)
                Text("\(metrics.wins) of \(metrics.n)")
                    .font(.system(size: 13, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(ink)
                Text(HistoricalAnalysisCopy.noun(for: snapshot.betType, snapshot: snapshot))
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(inkSecondary)
            }
        }
        .frame(width: 194, height: 194)
        .padding(10)
    }

    private func gaugeStat(_ value: String, label: String, color: Color? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.system(size: 16, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(color ?? ink)
                .lineLimit(1)
                .fixedSize()
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(inkSecondary)
        }
    }
}

// MARK: - Chart card

/// Bar-graph share card: the situation splits and top performers as chunky
/// horizontal bars with a baseline tick — graph first, words second.
struct TrendsShareChartCard: View {
    let sport: HistoricalAnalysisSport
    let snapshot: HistoricalAnalysisUISnapshot
    let analysis: HistoricalAnalysisResponse
    var focus: InfographicFocus = .overall
    var teamArt: TrendsTeamArt?

    private let ink = Color(hex: 0xF8FAFC)
    private let inkSecondary = Color(hex: 0x9AA3B2)

    private var ctx: TrendsShareContext {
        TrendsShareContext(sport: sport, snapshot: snapshot, analysis: analysis, focus: focus)
    }

    var body: some View {
        let metrics = ctx.metrics
        let (subject, verb) = ctx.subjectVerb
        let accent = HistoricalAnalysisCopy.hitPctColor(metrics.hitPct)

        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(sport.shortTitle) TRENDS")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(1.6)
                    .foregroundStyle(Color.appPrimary)
                Spacer()
                Text(verbatim: "\(HistoricalAnalysisBetType.from(snapshot.betType).label) · \(HistoricalAnalysisCopy.yearRange(analysis.coverage.seasonMin, analysis.coverage.seasonMax))")
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(inkSecondary)
            }
            .padding(.bottom, 18)

            (
                Text("\(subject) \(verb) ").foregroundStyle(ink)
                + Text("\(HistoricalAnalysisCopy.trimmed(metrics.hitPct))%")
                    .foregroundStyle(accent).fontWeight(.black)
                + Text("  ·  \(metrics.wins)–\(metrics.n - metrics.wins)").foregroundStyle(inkSecondary)
            )
            .font(.system(size: 18, weight: .bold))
            .fixedSize(horizontal: false, vertical: true)
            .padding(.bottom, 18)

            situationCharts
            topChart

            Divider().overlay(Color.white.opacity(0.08))
                .padding(.top, 4)
                .padding(.bottom, 12)

            HStack {
                WagerproofTicketFooter()
                Spacer()
                Text("wagerproof.bet")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(inkSecondary.opacity(0.8))
            }
        }
        .padding(24)
        .background(
            TrendsGraphCardstock(teamArt: teamArt, sport: sport, fallbackTint: accent)
        )
    }

    // MARK: Splits as chunky bars

    @ViewBuilder
    private var situationCharts: some View {
        let bars = HistoricalAnalysisFilterBuilder.shownBars(analysis.bars, snapshot: snapshot)
        if !bars.isEmpty {
            VStack(alignment: .leading, spacing: 13) {
                chartSectionTitle("BY SITUATION")
                ForEach(bars) { bar in
                    ForEach(bar.options) { opt in
                        chunkyBar(
                            label: HistoricalAnalysisCopy.sideLabel(betType: snapshot.betType, side: opt.side),
                            pct: opt.hitPct,
                            detail: "\(opt.wins) of \(opt.n)"
                        )
                    }
                }
            }
            .padding(.bottom, 18)
        }
    }

    /// Top performers for the sport — teams when present, else the per-sport
    /// secondary breakdown (venues / coaches / conferences).
    @ViewBuilder
    private var topChart: some View {
        let (title, rows): (String, [HistoricalAnalysisBreakdownRow]) = {
            let teams = qualifying(analysis.byTeam)
            if teams.count >= 3 { return ("TOP TEAMS IN THIS SPOT", Array(teams.prefix(5))) }
            switch sport {
            case .nfl: return ("TOP COACHES", Array(qualifying(analysis.byCoach ?? []).prefix(5)))
            case .cfb: return ("TOP CONFERENCES", Array(qualifying(analysis.byConference ?? []).prefix(5)))
            case .mlb: return ("TOP VENUES", Array(qualifying(analysis.byVenue ?? []).prefix(5)))
            }
        }()
        if rows.count >= 3 {
            VStack(alignment: .leading, spacing: 11) {
                chartSectionTitle(title)
                ForEach(rows) { row in
                    chunkyBar(label: row.label, pct: row.hitPct, detail: "\(row.n)g")
                }
            }
            .padding(.bottom, 18)
        }
    }

    private func qualifying(_ rows: [HistoricalAnalysisBreakdownRow]) -> [HistoricalAnalysisBreakdownRow] {
        rows.filter { $0.n >= 5 && $0.label != "—" }
            .sorted { $0.hitPct != $1.hitPct ? $0.hitPct > $1.hitPct : $0.n > $1.n }
    }

    private func chunkyBar(label: String, pct: Double, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(ink)
                    .lineLimit(1)
                Spacer(minLength: 8)
                Text(detail)
                    .font(.system(size: 10, weight: .medium))
                    .monospacedDigit()
                    .foregroundStyle(inkSecondary)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.07))
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: barColors(pct),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: max(geo.size.width * min(max(pct, 0), 100) / 100, 14))
                    // In-bar % label, kept inside the fill.
                    Text("\(HistoricalAnalysisCopy.trimmed(pct))%")
                        .font(.system(size: 10, weight: .heavy))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .padding(.leading, 6)
                        .offset(x: max(geo.size.width * min(max(pct, 0), 100) / 100 - 40, 2))
                    // League baseline tick.
                    Rectangle()
                        .fill(Color.white.opacity(0.65))
                        .frame(width: 1.5)
                        .offset(x: geo.size.width * min(max(analysis.baselinePct, 0), 100) / 100 - 0.75)
                }
            }
            .frame(height: 16)
        }
    }

    private func barColors(_ pct: Double) -> [Color] {
        if pct >= 52.4 { return [Color.green.opacity(0.55), Color.green] }
        if pct < 47.6 { return [Color.red.opacity(0.5), Color.red.opacity(0.85)] }
        return [Color.white.opacity(0.25), Color.white.opacity(0.4)]
    }

    private func chartSectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 9, weight: .bold))
            .tracking(1)
            .foregroundStyle(inkSecondary)
    }
}
