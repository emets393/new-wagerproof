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

// MARK: - Share bottom sheet

/// Bottom sheet that composes a shareable infographic for the current
/// Historical Trends search and exports it via the system share sheet.
struct HistoricalTrendsShareView: View {
    let sport: HistoricalAnalysisSport
    let snapshot: HistoricalAnalysisUISnapshot
    let analysis: HistoricalAnalysisResponse?

    @Environment(\.dismiss) private var dismiss
    @State private var shareItem: ShareableInfographicImage?
    @State private var focus: InfographicFocus = .overall

    private let infographicWidth: CGFloat = 340

    var body: some View {
        NavigationStack {
            Group {
                if let analysis, analysis.overall.n > 0 {
                    ScrollView {
                        VStack(spacing: 16) {
                            focusPicker(analysis)
                            infographic(analysis)
                                .frame(width: infographicWidth)
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
        .sheet(item: $shareItem) { item in
            ActivityShareSheet(items: [item.image])
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

    /// Force dark so the exported card looks the same from either app theme.
    private func infographic(_ data: HistoricalAnalysisResponse) -> some View {
        HistoricalTrendsInfographic(sport: sport, snapshot: snapshot, analysis: data, focus: focus)
            .environment(\.colorScheme, .dark)
    }

    private var shareButton: some View {
        Button {
            share()
        } label: {
            Label("Share Infographic", systemImage: "square.and.arrow.up")
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

    /// Render JUST the infographic — transparent everywhere outside its card —
    /// so it shares as a standalone branded component (same trick as the
    /// agent pick tickets in AgentPickFocusView).
    @MainActor private func share() {
        guard let analysis, analysis.overall.n > 0 else { return }
        let card = infographic(analysis)
            .frame(width: infographicWidth)
        let renderer = ImageRenderer(content: card)
        renderer.scale = 3
        renderer.isOpaque = false
        if let image = renderer.uiImage {
            shareItem = ShareableInfographicImage(image: image)
        }
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

    // MARK: Focused metric slice

    private var focusedMetrics: (n: Int, wins: Int, hitPct: Double, roi: Double?) {
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

    private var focusSubjectVerb: (subject: String, verb: String) {
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
    private var clauses: [String] {
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
