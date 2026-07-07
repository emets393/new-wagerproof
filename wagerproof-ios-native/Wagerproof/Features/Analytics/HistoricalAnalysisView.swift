import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// Historical Analysis — faithful port of web NFLAnalytics / CFBAnalytics.
struct HistoricalAnalysisView: View {
    let sport: HistoricalAnalysisSport

    @Environment(AuthStore.self) private var authStore
    @State private var store: HistoricalAnalysisStore
    @State private var breakdownTab = "team"
    @State private var breakdownSort = "n"
    @State private var teamSearch = ""
    @State private var showSaveSheet = false
    @State private var saveName = ""

    private let breakdownTableHeight: CGFloat = 360

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
                        .padding(.top, 12)
                        .padding(.bottom, 24)
                        .opacity(store.isRefetching ? 0.55 : 1)
                        .animation(.easeInOut(duration: 0.2), value: store.isRefetching)
                } header: {
                    pinnedHeader
                }
            }
        }
        .background(Color.appSurface)
        .navigationTitle(sport.shortTitle + " Trends")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { savedFiltersMenu }
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
            saveFilterSheet
        }
        .onChange(of: store.snapshot.selectedConferences) { _, conferences in
            if !conferences.isEmpty, breakdownTab == "conf" {
                breakdownTab = "team"
            }
        }
    }

    // MARK: - Pinned header (hero + filter pills)

    private var pinnedHeader: some View {
        VStack(alignment: .leading, spacing: 0) {
            heroSection
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 10)

            HistoricalAnalysisFilterBar(store: store, onChange: { store.scheduleFetch() })

            Divider()
                .padding(.top, 8)
        }
        .background(Color.appSurface)
    }

    @ViewBuilder
    private var heroSection: some View {
        switch store.loadState {
        case .loading where !store.hasLoadedOnce:
            ProgressView("Loading analysis…")
                .frame(maxWidth: .infinity, minHeight: 100)
        case .failed(let message):
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity, minHeight: 72)
                .padding(14)
                .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14))
        default:
            if let data = store.analysis {
                heroCard(data)
            }
        }
    }

    private func heroCard(_ data: HistoricalAnalysisResponse) -> some View {
        Group {
            if data.overall.n > 0 {
                let subject = HistoricalAnalysisCopy.headlineSubject(sport: sport, snapshot: store.snapshot)
                let metrics = HistoricalAnalysisCopy.headlineMetrics(snapshot: store.snapshot, data: data)
                let sig = HistoricalAnalysisCopy.significance(n: metrics.n, hit: metrics.hitPct)
                let delta = metrics.hitPct - data.baselinePct
                let hitPct = metrics.hitPct

                VStack(alignment: .leading, spacing: 10) {
                    headlineText(subject: subject, metrics: metrics, data: data)
                        .font(.system(size: 18, weight: .semibold))
                        .fixedSize(horizontal: false, vertical: true)

                    Text("\(delta >= 0 ? "+" : "")\(HistoricalAnalysisCopy.trimmed(delta)) pts vs \(HistoricalAnalysisCopy.trimmed(data.baselinePct))% baseline · \(sig.label)")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.appTextSecondary)

                    Text(HistoricalAnalysisCopy.scopeNote(sport: sport, snapshot: store.snapshot))
                        .font(.system(size: 11))
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
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16))
                .overlay(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.appPrimary)
                        .frame(width: 4)
                        .padding(.vertical, 12)
                }
            } else {
                Text("No games match these filters — try widening them.")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16))
            }
        }
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

    // MARK: - Scrollable content

    @ViewBuilder
    private var scrollableContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            breakdownSection
            upcomingSection
        }
    }

    @ViewBuilder
    private var breakdownSection: some View {
        if let data = store.analysis, store.hasLoadedOnce {
            breakdownBars(data)
            breakdownLists(data)
        }
    }

    private func breakdownBars(_ data: HistoricalAnalysisResponse) -> some View {
        let bars = HistoricalAnalysisFilterBuilder.shownBars(data.bars, snapshot: store.snapshot)
        return Group {
            if !bars.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("BREAKDOWN")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(0.8)
                            .foregroundStyle(Color.appTextSecondary)
                        Text("The same \(data.coverage.nGames) games, split by situation.")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.appTextSecondary)
                    }

                    ForEach(bars) { bar in
                        barSection(bar, baseline: data.baselinePct)
                            .padding(12)
                            .background(Color.appSurfaceMuted.opacity(0.45), in: RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(14)
                .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14))
                .layoutPriority(1)
            }
        }
    }

    private func barSection(_ bar: HistoricalAnalysisBar, baseline: Double) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(HistoricalAnalysisCopy.dimLabels[bar.dimension] ?? bar.dimension)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)

            ForEach(bar.options) { opt in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(HistoricalAnalysisCopy.sideLabel(betType: store.betType, side: opt.side))
                            .font(.system(size: 14, weight: .medium))
                        Spacer()
                        Text("\(HistoricalAnalysisCopy.trimmed(opt.hitPct))% (\(opt.wins) of \(opt.n))")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(opt.hitPct >= 52.4 ? Color.green : Color.appTextPrimary)
                    }

                    HitRateBar(hitPct: opt.hitPct, baseline: baseline)

                    HStack {
                        Text("vs \(HistoricalAnalysisCopy.trimmed(baseline))% baseline")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.appTextSecondary)
                        Spacer()
                        if let roi = opt.roi {
                            Text(HistoricalAnalysisCopy.signedPct(roi) + " ROI")
                                .font(.system(size: 10))
                                .foregroundStyle(roi >= 0 ? Color.green : Color.red)
                        }
                    }
                }
            }
        }
    }

    private func breakdownLists(_ data: HistoricalAnalysisResponse) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            RegressionSegmentedTabs(
                options: breakdownTabOptions,
                selection: $breakdownTab
            )
            breakdownSortPicker
            breakdownTable(for: data)
        }
        .padding(14)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14))
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

    private var breakdownSortPicker: some View {
        let isML = HistoricalAnalysisBetType.moneylineMarkets.contains(store.betType)
        let outcome = HistoricalAnalysisCopy.outcomeLabel(for: store.betType)
        return HStack {
            ForEach(["n", "hit", "roi"].filter { $0 != "roi" || !isML }, id: \.self) { key in
                let active = breakdownSort == key
                Button {
                    breakdownSort = key
                } label: {
                    Text(key == "n" ? "Games" : key == "hit" ? "\(outcome) %" : "ROI")
                        .font(.system(size: 11, weight: active ? .bold : .medium))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(active ? Color.appSurface : .clear, in: RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(3)
        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 10))
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
        let showSearch = breakdownTab == "team" && rows.count > 12
        let filtered = showSearch && !teamSearch.isEmpty
            ? sorted.filter { $0.label.localizedCaseInsensitiveContains(teamSearch) }
            : sorted

        if showSearch {
            TextField("Search teams…", text: $teamSearch)
                .textFieldStyle(.roundedBorder)
        }

        if filtered.isEmpty {
            Text(rows.isEmpty ? "No results with enough games (min 3)." : "No teams match \"\(teamSearch)\".")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
        } else {
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(filtered) { row in
                        breakdownRow(row)
                        if row.id != filtered.last?.id {
                            Divider()
                        }
                    }
                }
            }
            .frame(height: breakdownTableHeight)
            .background(Color.appSurfaceMuted.opacity(0.35), in: RoundedRectangle(cornerRadius: 10))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    private func breakdownRow(_ row: HistoricalAnalysisBreakdownRow) -> some View {
        HStack(spacing: 10) {
            if breakdownTab == "team" {
                teamAvatar(row.label)
            }
            Text(row.label)
                .font(.system(size: 14, weight: .medium))
                .lineLimit(1)
            Spacer()
            Text("\(row.n)g")
                .font(.system(size: 10, weight: .bold))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.appSurfaceMuted, in: Capsule())
            Text("\(HistoricalAnalysisCopy.trimmed(row.hitPct))%")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(HistoricalAnalysisCopy.hitPctColor(row.hitPct))
                .frame(width: 48, alignment: .trailing)
            if !HistoricalAnalysisBetType.moneylineMarkets.contains(store.betType) {
                Text(row.roi.map { HistoricalAnalysisCopy.signedPct($0) } ?? "—")
                    .font(.system(size: 12))
                    .foregroundStyle((row.roi ?? 0) >= 0 ? Color.green : Color.red)
                    .frame(width: 56, alignment: .trailing)
            }
        }
        .padding(.horizontal, 10)
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
        switch breakdownSort {
        case "hit": return rows.sorted { $0.hitPct > $1.hitPct }
        case "roi": return rows.sorted { ($0.roi ?? -999) > ($1.roi ?? -999) }
        default: return rows.sorted { $0.n > $1.n }
        }
    }

    @ViewBuilder
    private var upcomingSection: some View {
        if !store.upcoming.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Label("This week's games that match (\(store.upcoming.count))", systemImage: "calendar")
                    .font(.system(size: 14, weight: .semibold))
                ForEach(store.upcoming) { game in
                    HStack(spacing: 10) {
                        teamAvatar(game.team)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(game.matchup)
                                .font(.system(size: 14, weight: .medium))
                            Text(HistoricalAnalysisCopy.lineForBet(betType: store.betType, game: game))
                                .font(.system(size: 12))
                                .foregroundStyle(Color.appTextSecondary)
                            Text(HistoricalAnalysisCopy.fmtKickoff(game.kickoff))
                                .font(.system(size: 11))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                        Spacer()
                    }
                    .padding(10)
                    .background(Color.appSurfaceMuted.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
                }
            }
            .padding(14)
            .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.appPrimary.opacity(0.25)))
        }
    }

    // MARK: - Saved filters

    @ToolbarContentBuilder
    private var savedFiltersMenu: some ToolbarContent {
        if userId != nil {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ForEach(store.savedFilters) { filter in
                        Button(filter.name) { store.restoreSaved(filter) }
                    }
                    Divider()
                    Button("Save current…") { showSaveSheet = true }
                        .disabled(store.savedFilters.count >= HistoricalAnalysisSavedFiltersService.maxPerUser)
                } label: {
                    Image(systemName: "bookmark")
                }
            }
        }
    }

    private var saveFilterSheet: some View {
        NavigationStack {
            Form {
                TextField("Name this filter", text: $saveName)
            }
            .navigationTitle("Save filter")
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
