import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// Historical Trends — native large title, sticky search bar + floating filter
/// pills, container-free content. See .claude/docs/15_mobile_historical_analysis.md.
struct HistoricalAnalysisView: View {
    let sport: HistoricalAnalysisSport

    @Environment(AuthStore.self) private var authStore
    @State private var store: HistoricalAnalysisStore
    @State private var breakdownTab = "team"
    @State private var breakdownSort = "n"
    @State private var searchText = ""
    @State private var showAllRows = false
    @State private var showSaveSheet = false
    @State private var showShareSheet = false
    @State private var saveName = ""

    /// Breakdown rows shown before the "Show all" expander — keeps the CFB
    /// 130+ team list from burying the upcoming-games section.
    private let rowCap = 15

    init(sport: HistoricalAnalysisSport) {
        self.sport = sport
        _store = State(initialValue: HistoricalAnalysisStore(sport: sport))
    }

    private var userId: UUID? {
        if case .authenticated(let id) = authStore.phase { return id }
        return nil
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                Section {
                    scrollableContent
                        .padding(.horizontal, 16)
                        .padding(.top, 16)
                        .padding(.bottom, 24)
                        .opacity(store.isRefetching ? 0.55 : 1)
                        .animation(.easeInOut(duration: 0.2), value: store.isRefetching)
                } header: {
                    // Deliberately no slab behind the pills — the liquid-glass
                    // capsules float and content scrolls underneath them.
                    HistoricalAnalysisFilterBar(store: store, onChange: { store.scheduleFetch() })
                        .padding(.top, 6)
                        .padding(.bottom, 10)
                }
            }
        }
        .background(Color.appSurface)
        .navigationTitle(sport.shortTitle + " Trends")
        .navigationBarTitleDisplayMode(.large)
        .searchable(
            text: $searchText,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: searchPrompt
        )
        .toolbar { savedSearchesMenu }
        .overlay(alignment: .top) {
            if store.isRefetching {
                ProgressView()
                    .padding(.top, 6)
            }
        }
        .task {
            await store.onAppear()
            if let userId { await store.refreshSaved(userId: userId) }
        }
        .sheet(isPresented: $showSaveSheet) {
            saveSearchSheet
        }
        .sheet(isPresented: $showShareSheet) {
            HistoricalTrendsShareView(
                sport: sport,
                snapshot: store.snapshot,
                analysis: store.analysis
            )
        }
        .onChange(of: store.snapshot.selectedConferences) { _, conferences in
            if !conferences.isEmpty, breakdownTab == "conf" {
                breakdownTab = "team"
            }
        }
        .onChange(of: breakdownTab) { _, _ in
            showAllRows = false
        }
    }

    private var searchPrompt: Text {
        switch breakdownTab {
        case "coach": return Text("Search coaches")
        case "ref": return Text("Search referees")
        case "conf": return Text("Search conferences")
        default: return Text("Search teams")
        }
    }

    // MARK: - Scrollable content

    @ViewBuilder
    private var scrollableContent: some View {
        VStack(alignment: .leading, spacing: 28) {
            summarySection
            if let data = store.analysis, store.hasLoadedOnce {
                breakdownBars(data)
                breakdownLists(data)
            }
            upcomingSection
        }
    }

    private func sectionHeader(_ title: String, subtitle: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.system(size: 11, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Color.appTextSecondary)
            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
    }

    // MARK: - Summary (plain text, no card)

    @ViewBuilder
    private var summarySection: some View {
        switch store.loadState {
        case .loading where !store.hasLoadedOnce:
            ProgressView("Loading analysis…")
                .frame(maxWidth: .infinity, minHeight: 120)
        case .failed(let message):
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
        default:
            if let data = store.analysis {
                if data.overall.n > 0 {
                    summaryText(data)
                } else {
                    Text("No games match these filters — try widening them.")
                        .font(.system(size: 15))
                        .foregroundStyle(Color.appTextSecondary)
                        .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
                }
            }
        }
    }

    private func summaryText(_ data: HistoricalAnalysisResponse) -> some View {
        let subject = HistoricalAnalysisCopy.headlineSubject(sport: sport, snapshot: store.snapshot)
        let metrics = HistoricalAnalysisCopy.headlineMetrics(snapshot: store.snapshot, data: data)
        let sig = HistoricalAnalysisCopy.significance(n: metrics.n, hit: metrics.hitPct)
        let delta = metrics.hitPct - data.baselinePct

        return VStack(alignment: .leading, spacing: 8) {
            headlineText(subject: subject, metrics: metrics, data: data)
                .font(.system(size: 22, weight: .semibold))
                .fixedSize(horizontal: false, vertical: true)

            Text("\(delta >= 0 ? "+" : "")\(HistoricalAnalysisCopy.trimmed(delta)) pts vs \(HistoricalAnalysisCopy.trimmed(data.baselinePct))% baseline · \(sig.label)")
                .font(.system(size: 14))
                .foregroundStyle(Color.appTextSecondary)

            Text(HistoricalAnalysisCopy.scopeNote(sport: sport, snapshot: store.snapshot))
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 8) {
                Label("\(data.coverage.nGames) games", systemImage: "sportscourt")
                Text("·")
                Text(verbatim: HistoricalAnalysisCopy.yearRange(data.coverage.seasonMin, data.coverage.seasonMax))
                if store.isLimitedHistory {
                    Text("·")
                    Text("Limited history")
                        .foregroundStyle(Color.orange)
                }
            }
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func headlineText(
        subject: String,
        metrics: (n: Int, wins: Int, hitPct: Double, roi: Double?),
        data: HistoricalAnalysisResponse
    ) -> Text {
        let pctStr = HistoricalAnalysisCopy.trimmed(metrics.hitPct) + "%"
        let pctColor = HistoricalAnalysisCopy.hitPctColor(metrics.hitPct)
        var suffix = " (\(metrics.wins) of \(metrics.n) \(HistoricalAnalysisCopy.noun(for: store.betType, snapshot: store.snapshot)))"
        if let roi = metrics.roi {
            suffix += " · \(HistoricalAnalysisCopy.signedPct(roi)) ROI"
        }
        return Text("\(subject) \(HistoricalAnalysisCopy.verb(for: store.betType)) ")
            .foregroundStyle(Color.appTextPrimary)
        + Text(pctStr)
            .foregroundStyle(pctColor)
        + Text(suffix)
            .foregroundStyle(Color.appTextPrimary)
    }

    // MARK: - Breakdown bars (plain sections, no containers)

    private func breakdownBars(_ data: HistoricalAnalysisResponse) -> some View {
        let bars = HistoricalAnalysisFilterBuilder.shownBars(data.bars, snapshot: store.snapshot)
        return Group {
            if !bars.isEmpty {
                VStack(alignment: .leading, spacing: 18) {
                    sectionHeader("BREAKDOWN", subtitle: "The same \(data.coverage.nGames) games, split by situation.")

                    ForEach(bars) { bar in
                        barSection(bar, baseline: data.baselinePct)
                        if bar.id != bars.last?.id {
                            Divider()
                        }
                    }
                }
                .layoutPriority(1)
            }
        }
    }

    private func barSection(_ bar: HistoricalAnalysisBar, baseline: Double) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(HistoricalAnalysisCopy.dimLabels[bar.dimension] ?? bar.dimension)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)

            ForEach(bar.options) { opt in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(HistoricalAnalysisCopy.sideLabel(betType: store.betType, side: opt.side))
                            .font(.system(size: 15, weight: .medium))
                        Spacer()
                        Text("\(HistoricalAnalysisCopy.trimmed(opt.hitPct))% (\(opt.wins) of \(opt.n))")
                            .font(.system(size: 14, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(opt.hitPct >= 52.4 ? Color.green : Color.appTextPrimary)
                    }

                    HitRateBar(hitPct: opt.hitPct, baseline: baseline)

                    HStack {
                        Text("vs \(HistoricalAnalysisCopy.trimmed(baseline))% baseline")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.appTextSecondary)
                        Spacer()
                        if let roi = opt.roi {
                            Text(HistoricalAnalysisCopy.signedPct(roi) + " ROI")
                                .font(.system(size: 11))
                                .foregroundStyle(roi >= 0 ? Color.green : Color.red)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Breakdown lists (plain rows + Show all expander)

    private func breakdownLists(_ data: HistoricalAnalysisResponse) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            RegressionSegmentedTabs(
                options: breakdownTabOptions,
                selection: $breakdownTab
            )
            breakdownSortMenu
            breakdownTable(for: data)
        }
        .layoutPriority(1)
    }

    private var breakdownTabOptions: [(key: String, label: String)] {
        switch sport {
        case .nfl:
            return [("team", "By Team"), ("coach", "By Coach"), ("ref", "By Referee")]
        case .cfb:
            if HistoricalAnalysisCopy.activeConferences(store.snapshot).isEmpty {
                return [("team", "By Team"), ("conf", "By Conference")]
            }
            return [("team", "By Team")]
        }
    }

    private var isMoneylineBetType: Bool {
        HistoricalAnalysisBetType.moneylineMarkets.contains(store.betType)
    }

    /// ROI isn't computed for moneyline markets — fall back to game count.
    private var effectiveSort: String {
        isMoneylineBetType && breakdownSort == "roi" ? "n" : breakdownSort
    }

    private var breakdownSortMenu: some View {
        let outcome = HistoricalAnalysisCopy.outcomeLabel(for: store.betType)
        let labels: [String: String] = ["n": "Most games", "hit": "\(outcome) %", "roi": "ROI"]
        return Menu {
            Picker("Sort by", selection: $breakdownSort) {
                Label("Most games", systemImage: "number").tag("n")
                Label("\(outcome) %", systemImage: "percent").tag("hit")
                if !isMoneylineBetType {
                    Label("ROI", systemImage: "chart.line.uptrend.xyaxis").tag("roi")
                }
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "arrow.up.arrow.down")
                    .font(.system(size: 11, weight: .bold))
                Text("Sort: \(labels[effectiveSort] ?? "Most games")")
                    .font(.system(size: 13, weight: .semibold))
            }
            .foregroundStyle(Color.appTextSecondary)
        }
    }

    @ViewBuilder
    private func breakdownTable(for data: HistoricalAnalysisResponse) -> some View {
        let rows: [HistoricalAnalysisBreakdownRow] = {
            switch breakdownTab {
            case "coach": return data.byCoach ?? []
            case "ref": return data.byReferee ?? []
            case "conf": return data.byConference ?? []
            default: return data.byTeam
            }
        }()
        let sorted = sortedRows(rows)
        let query = searchText.trimmingCharacters(in: .whitespaces)
        let filtered = query.isEmpty
            ? sorted
            : sorted.filter { $0.label.localizedCaseInsensitiveContains(query) }
        // Searching shows every match; browsing caps the list behind "Show all".
        let visible = (showAllRows || !query.isEmpty) ? filtered : Array(filtered.prefix(rowCap))

        if filtered.isEmpty {
            Text(rows.isEmpty ? "No results with enough games (min 3)." : "Nothing matches \"\(query)\".")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
        } else {
            VStack(spacing: 0) {
                ForEach(visible) { row in
                    breakdownRow(row)
                    if row.id != visible.last?.id {
                        Divider()
                    }
                }
            }

            if query.isEmpty, filtered.count > rowCap {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        showAllRows.toggle()
                    }
                } label: {
                    Text(showAllRows ? "Show fewer" : "Show all \(filtered.count)")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.appPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func breakdownRow(_ row: HistoricalAnalysisBreakdownRow) -> some View {
        HStack(spacing: 10) {
            if breakdownTab == "team" {
                teamAvatar(row.label)
            }
            Text(row.label)
                .font(.system(size: 15, weight: .medium))
                .lineLimit(1)
            Spacer()
            Text("\(row.n)g")
                .font(.system(size: 11, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Color.appTextSecondary)
            Text("\(HistoricalAnalysisCopy.trimmed(row.hitPct))%")
                .font(.system(size: 15, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(HistoricalAnalysisCopy.hitPctColor(row.hitPct))
                .frame(width: 52, alignment: .trailing)
            if !isMoneylineBetType {
                Text(row.roi.map { HistoricalAnalysisCopy.signedPct($0) } ?? "—")
                    .font(.system(size: 12))
                    .monospacedDigit()
                    .foregroundStyle((row.roi ?? 0) >= 0 ? Color.green : Color.red)
                    .frame(width: 56, alignment: .trailing)
            }
        }
        .padding(.vertical, 10)
    }

    @ViewBuilder
    private func teamAvatar(_ team: String) -> some View {
        switch sport {
        case .nfl:
            if let urlStr = NFLTeamAssets.logo(for: team), let url = URL(string: urlStr) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFit()
                    } else {
                        Color.clear
                    }
                }
                .frame(width: 24, height: 24)
            }
        case .cfb:
            if let urlStr = store.cfbLogos[team], let url = URL(string: urlStr) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFit()
                    } else {
                        cfbInitialsAvatar(team)
                    }
                }
                .frame(width: 24, height: 24)
            } else {
                cfbInitialsAvatar(team)
            }
        }
    }

    private func cfbInitialsAvatar(_ team: String) -> some View {
        let colors = CFBTeamColors.colorPair(for: team)
        let initials = team.split(separator: " ").compactMap { $0.first }.prefix(2).map(String.init).joined()
        return Text(initials)
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 24, height: 24)
            .background(colors.primary, in: Circle())
    }

    private func sortedRows(_ rows: [HistoricalAnalysisBreakdownRow]) -> [HistoricalAnalysisBreakdownRow] {
        switch effectiveSort {
        case "hit": return rows.sorted { $0.hitPct > $1.hitPct }
        case "roi": return rows.sorted { ($0.roi ?? -999) > ($1.roi ?? -999) }
        default: return rows.sorted { $0.n > $1.n }
        }
    }

    // MARK: - Upcoming (plain rows)

    @ViewBuilder
    private var upcomingSection: some View {
        if !store.upcoming.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                sectionHeader(
                    "THIS WEEK",
                    subtitle: "\(store.upcoming.count) upcoming \(store.upcoming.count == 1 ? "game matches" : "games match") this search."
                )
                VStack(spacing: 0) {
                    ForEach(store.upcoming) { game in
                        HStack(spacing: 10) {
                            teamAvatar(game.team)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(game.matchup)
                                    .font(.system(size: 15, weight: .medium))
                                Text(HistoricalAnalysisCopy.lineForBet(betType: store.betType, game: game))
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.appTextSecondary)
                                Text(HistoricalAnalysisCopy.fmtKickoff(game.kickoff))
                                    .font(.system(size: 11))
                                    .foregroundStyle(Color.appTextSecondary)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 10)
                        if game.id != store.upcoming.last?.id {
                            Divider()
                        }
                    }
                }
            }
        }
    }

    // MARK: - Saved searches (toolbar context menu)

    @ToolbarContentBuilder
    private var savedSearchesMenu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                if !store.savedFilters.isEmpty {
                    Section("Saved Searches") {
                        ForEach(store.savedFilters) { filter in
                            Button {
                                store.restoreSaved(filter)
                            } label: {
                                Label(filter.name, systemImage: "bookmark.fill")
                            }
                        }
                    }
                }
                if userId != nil {
                    Button {
                        saveName = ""
                        showSaveSheet = true
                    } label: {
                        Label("Save Current Search…", systemImage: "plus")
                    }
                    .disabled(store.savedFilters.count >= HistoricalAnalysisSavedFiltersService.maxPerUser)
                }
                Button {
                    showShareSheet = true
                } label: {
                    Label("Share Current Search", systemImage: "square.and.arrow.up")
                }
                .disabled(store.analysis == nil)
            } label: {
                Image(systemName: "bookmark")
            }
        }
    }

    private var saveSearchSheet: some View {
        NavigationStack {
            Form {
                TextField("Name this search", text: $saveName)
            }
            .navigationTitle("Save Search")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showSaveSheet = false; saveName = "" }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let userId else { return }
                        Task {
                            try? await store.saveCurrentFilter(name: saveName, userId: userId)
                            showSaveSheet = false
                            saveName = ""
                        }
                    }
                    .disabled(saveName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - Hit rate bar (avoids GeometryReader layout collapse)

private struct HitRateBar: View {
    let hitPct: Double
    let baseline: Double

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.appSurfaceMuted)
                Capsule()
                    .fill(Color.green.opacity(0.5))
                    .frame(width: geo.size.width * min(hitPct, 100) / 100)
                Rectangle()
                    .fill(Color.appTextPrimary.opacity(0.45))
                    .frame(width: 1.5)
                    .offset(x: geo.size.width * baseline / 100 - 0.75)
            }
        }
        .frame(height: 8)
    }
}
