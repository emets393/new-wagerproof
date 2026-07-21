import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// Historical Trends — native large title + floating filter pills, container-free
/// content. See .claude/docs/15_mobile_historical_analysis.md.
struct HistoricalAnalysisView: View {
    let sport: HistoricalAnalysisSport

    @Environment(AuthStore.self) private var authStore
    @Environment(\.colorScheme) private var colorScheme
    @State private var store: HistoricalAnalysisStore
    @State private var breakdownTab = "team"
    @State private var breakdownSort = "n"
    @State private var showAllRows = false
    @State private var showSaveSheet = false
    @State private var showShareSheet = false
    @State private var saveName = ""
    @FocusState private var chatFocused: Bool
    @State private var toast: TrendsChatToast?

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
        // Chat dock replaces the tab bar on this screen — same pattern as
        // WagerBotChatView / detail pages.
        .toolbar(.hidden, for: .tabBar)
        .toolbar { savedSearchesMenu }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            chatDock
        }
        .overlay(alignment: .top) {
            if store.isRefetching {
                ProgressView()
                    .padding(.top, 6)
            }
        }
        .overlay(alignment: .top) {
            if let toast {
                toastBanner(toast)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(1)
            }
        }
        // Toast fires when a chat round-trip finishes — system-banner style,
        // auto-dismissing, instead of a persistent status line in the dock.
        .onChange(of: store.nlChatState.isProcessing) { was, isNow in
            guard was, !isNow, let response = store.nlChatState.lastResponse else { return }
            presentToast(for: response)
        }
        .task {
            store.loadRecentQueries()
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
                analysis: store.analysis,
                cfbLogos: store.cfbLogos
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

    // MARK: - Scrollable content

    @ViewBuilder
    private var scrollableContent: some View {
        VStack(alignment: .leading, spacing: 28) {
            if let error = store.fetchErrorMessage {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.orange)
            }
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
                    if store.shouldShowSymmetricSplit {
                        symmetricSplitHero(data)
                    } else {
                        summaryText(data)
                    }
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
        if let roi = metrics.roi, HistoricalAnalysisBetType.showsROI(betType: store.betType, sport: sport) {
            suffix += " · \(HistoricalAnalysisCopy.signedPct(roi)) ROI"
        }
        return Text("\(subject) \(HistoricalAnalysisCopy.verb(for: store.betType)) ")
            .foregroundStyle(Color.appTextPrimary)
        + Text(pctStr)
            .foregroundStyle(pctColor)
        + Text(suffix)
            .foregroundStyle(Color.appTextPrimary)
    }
    
    // MARK: - Symmetric Split Hero (B2)
    
    private func symmetricSplitHero(_ data: HistoricalAnalysisResponse) -> some View {
        guard let splitData = store.getSymmetricSplitData() else {
            return AnyView(summaryText(data))
        }
        
        let extreme = splitData.extremeSide
        let roi = extreme.roi ?? 0.0
        
        return AnyView(
            VStack(alignment: .leading, spacing: 16) {
                // Big hero metrics from extreme side
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 12) {
                        Text("\(HistoricalAnalysisCopy.trimmed(extreme.hitPct))%")
                            .font(.system(size: 36, weight: .bold))
                            .foregroundStyle(HistoricalAnalysisCopy.hitPctColor(extreme.hitPct))
                        
                        if showsROI {
                            Text(HistoricalAnalysisCopy.signedPct(roi))
                                .font(.system(size: 24, weight: .semibold))
                                .foregroundStyle(roi >= 0 ? Color.green : Color.red)
                        }
                    }
                    
                    Text("Best split: \(HistoricalAnalysisCopy.sideLabel(betType: store.betType, side: extreme.side))")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                }
                
                // Versus rows for home_away and fav_dog
                VStack(spacing: 8) {
                    if !splitData.homeAway.isEmpty {
                        versusRow(title: "Home vs Away", options: splitData.homeAway, dimension: "home_away")
                    }
                    if !splitData.favDog.isEmpty {
                        versusRow(title: "Favorite vs Dog", options: splitData.favDog, dimension: "fav_dog")
                    }
                }
                
                // Explanation subline
                Text("Every game here has one side that covers and one that doesn't, so 'all teams' is always ~50% on this market — these are the real splits.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
                
                // Coverage info
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
        )
    }
    
    private func versusRow(title: String, options: [HistoricalAnalysisBarOption], dimension: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
            
            HStack(spacing: 0) {
                ForEach(options) { option in
                    Button {
                        // Tap sets snapshot filter and fetches
                        if dimension == "home_away" {
                            store.updateSnapshot { snapshot in
                                snapshot.side = option.side
                            }
                        } else if dimension == "fav_dog" {
                            store.updateSnapshot { snapshot in
                                snapshot.spreadSide = option.side
                            }
                        }
                        store.scheduleFetch()
                    } label: {
                        VStack(spacing: 2) {
                            Text(HistoricalAnalysisCopy.sideLabel(betType: store.betType, side: option.side))
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Color.appTextPrimary)
                            
                            Text("\(HistoricalAnalysisCopy.trimmed(option.hitPct))%")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(option.hitPct >= 52.4 ? Color.green : Color.appTextPrimary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(option.hitPct > 50 ? Color.green.opacity(0.1) : Color.clear)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            
            // 50% midline visual
            Rectangle()
                .fill(Color.appTextSecondary.opacity(0.3))
                .frame(height: 1)
                .overlay(
                    Text("50%")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                        .padding(.horizontal, 4)
                        .background(Color.appSurface),
                    alignment: .center
                )
        }
    }
    
    // MARK: - Bottom chat dock (AI filter input)

    /// Floating liquid-glass chat dock pinned above the home indicator —
    /// replaces the old inline "DESCRIBE A FILTER" section. Suggestion chips
    /// ride on top of the input; they flip to the user's recent queries while
    /// a query runs (and whenever they have history).
    @ViewBuilder
    private var chatDock: some View {
        VStack(spacing: 8) {
            chatSuggestionsRow

            chatInputBar
        }
        .padding(.top, 8)
        .padding(.bottom, 6)
        .background(alignment: .bottom) {
            // Scrim so the glass dock separates from whatever scrolls beneath it.
            // Extends through the home-indicator inset — otherwise content peeks
            // out below the fade and the dock loses its edge.
            LinearGradient(
                colors: [
                    Color.black.opacity(0),
                    Color.black.opacity(chatScrimOpacity * 0.65),
                    Color.black.opacity(chatScrimOpacity)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(maxHeight: .infinity)
            .ignoresSafeArea(edges: .bottom)
            .allowsHitTesting(false)
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: store.nlChatState.isProcessing)
    }

    /// Light mode can't take a full black wash — it reads as a broken band over
    /// the white surface, so the ramp tops out much lower there.
    private var chatScrimOpacity: Double {
        colorScheme == .dark ? 0.92 : 0.26
    }

    // MARK: - Chat result toast (system-banner style)

    /// Map a chat exchange result to toast content + the matching haptic.
    private func presentToast(for response: HistoricalAnalysisStore.NLFilterResponse) {
        let next: TrendsChatToast = {
            if let error = response.error {
                return .init(icon: "exclamationmark.triangle.fill", text: error, color: .orange, haptic: .error)
            }
            if response.noChange {
                return .init(icon: "checkmark.circle.fill", text: "Filters already match that", color: .green, haptic: .success)
            }
            if !response.applied.isEmpty {
                var text = "Updated \(response.applied.count) filter\(response.applied.count == 1 ? "" : "s")"
                let missed = response.couldntMap.count + response.ambiguous.count + response.rejected.count
                if missed > 0 { text += " · \(missed) skipped" }
                return .init(icon: "checkmark.circle.fill", text: text, color: .green, haptic: .success)
            }
            if !response.couldntMap.isEmpty || !response.ambiguous.isEmpty || !response.rejected.isEmpty {
                return .init(icon: "questionmark.circle.fill", text: "Couldn't map that — try rephrasing", color: .orange, haptic: .warning)
            }
            return .init(icon: "questionmark.circle.fill", text: "I didn't catch a filter in that", color: Color.appTextSecondary, haptic: .warning)
        }()

        UINotificationFeedbackGenerator().notificationOccurred(next.haptic)
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            toast = next
        }
        // Auto-dismiss like a system banner; a newer toast cancels this one
        // implicitly via the id check.
        Task {
            try? await Task.sleep(nanoseconds: 2_400_000_000)
            if toast?.id == next.id {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                    toast = nil
                }
            }
        }
    }

    /// System-notification-style capsule: glass pill under the nav bar,
    /// tap or swipe up to dismiss early.
    private func toastBanner(_ toast: TrendsChatToast) -> some View {
        HStack(spacing: 8) {
            Image(systemName: toast.icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(toast.color)
            Text(toast.text)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(2)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 11)
        .liquidGlassBackground(in: Capsule(), interactive: true)
        .shadow(color: .black.opacity(0.18), radius: 14, x: 0, y: 6)
        .padding(.horizontal, 24)
        .padding(.top, 4)
        .onTapGesture {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { self.toast = nil }
        }
        .gesture(
            DragGesture(minimumDistance: 10).onEnded { value in
                if value.translation.height < 0 {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { self.toast = nil }
                }
            }
        )
    }

    /// Horizontal chips above the input: recents while querying / once history
    /// exists, canned examples for first-time users.
    @ViewBuilder
    private var chatSuggestionsRow: some View {
        let showRecents = (store.nlChatState.isProcessing || chatFocused) && !store.recentQueries.isEmpty
        let items = showRecents ? store.recentQueries : nlExampleQueries
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if showRecents {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.appTextMuted)
                }
                ForEach(items, id: \.self) { suggestion in
                    Button {
                        guard !store.nlChatState.isProcessing else { return }
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        store.nlChatState.inputText = suggestion
                        sendChatQuery()
                    } label: {
                        Text(suggestion)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.appTextPrimary)
                            .lineLimit(1)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .liquidGlassBackground(in: Capsule(), tint: dockTint, interactive: true)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 2)
        }
        .scrollClipDisabled()
    }

    /// Thin liquid-glass input bar. Hint copy per spec: "Type what filters you want".
    private var chatInputBar: some View {
        HStack(spacing: 10) {
            TextField("", text: $store.nlChatState.inputText)
                .textFieldStyle(.plain)
                .font(.system(size: 15))
                .foregroundStyle(Color.appTextPrimary)
                .focused($chatFocused)
                .submitLabel(.send)
                .onSubmit { sendChatQuery() }
                .disabled(store.nlChatState.isProcessing || userId == nil)
                .background(alignment: .leading) {
                    if store.nlChatState.inputText.isEmpty {
                        Text(userId == nil ? "Sign in to use filter chat" : "Type what filters you want…")
                            .font(.system(size: 15))
                            .foregroundStyle(Color.appTextSecondary)
                            .allowsHitTesting(false)
                    }
                }

            if store.nlChatState.isProcessing {
                // Same 3×3 glyph the agent generation card runs, shrunk to fit the
                // send-button slot — keeps one "working" language across the app.
                GlyphMatrix3x3(accent: Color.appPrimary, cycleSeconds: 1.0, dot: 3, gap: 3)
                    .frame(width: 30, height: 30)
            } else {
                Button {
                    sendChatQuery()
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(canSendChat ? Color.white : Color.appTextMuted)
                        .frame(width: 30, height: 30)
                        .background(canSendChat ? Color.appPrimary : Color.appSurfaceMuted)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(!canSendChat)
                .accessibilityLabel("Send filter request")
            }
        }
        .padding(.leading, 16)
        .padding(.trailing, 7)
        .frame(height: 46)
        .liquidGlassBackground(in: Capsule(), tint: dockTint, interactive: true)
        .padding(.horizontal, 12)
    }

    /// Lifts the dock glass off the black scrim it sits on. Dark mode only — over
    /// the light surface the glass already reads.
    private var dockTint: Color {
        Color.white.opacity(colorScheme == .dark ? 0.16 : 0)
    }

    private var canSendChat: Bool {
        userId != nil
            && !store.nlChatState.isProcessing
            && !store.nlChatState.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func sendChatQuery() {
        let text = store.nlChatState.inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, userId != nil, !store.nlChatState.isProcessing else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        Task {
            await store.submitNLFilterQuery(text, isAuthenticated: userId != nil)
        }
    }

    private var nlExampleQueries: [String] {
        switch sport {
        case .mlb:
            return [
                "Home favorites on Fridays",
                "Division games under 8.5",
                "Teams off a loss vs lefties",
                "Day games in summer",
                "2024 season only"
            ]
        case .nfl, .cfb:
            return [
                "Teams on 3+ game win streak",
                "Home underdogs in primetime",
                "Road favorites off a loss",
                "Divisional games in December",
                "Teams with winning record"
            ]
        }
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
                        if let roi = opt.roi, showsROI {
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
        case .mlb:
            return [("team", "By Team"), ("venue", "By Venue")]
        }
    }

    private var showsROI: Bool {
        HistoricalAnalysisBetType.showsROI(betType: store.betType, sport: sport)
    }

    /// ROI isn't computed for moneyline / F5 ML markets — fall back to game count.
    private var effectiveSort: String {
        !showsROI && breakdownSort == "roi" ? "n" : breakdownSort
    }

    private var breakdownSortMenu: some View {
        let outcome = HistoricalAnalysisCopy.outcomeLabel(for: store.betType)
        let labels: [String: String] = ["n": "Most games", "hit": "\(outcome) %", "roi": "ROI"]
        return Menu {
            Picker("Sort by", selection: $breakdownSort) {
                Label("Most games", systemImage: "number").tag("n")
                Label("\(outcome) %", systemImage: "percent").tag("hit")
                if showsROI {
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
            case "venue": return data.byVenue ?? []
            default: return data.byTeam
            }
        }()
        let sorted = sortedRows(rows)
        let visible = showAllRows ? sorted : Array(sorted.prefix(rowCap))

        if sorted.isEmpty {
            Text("No results with enough games (min 3).")
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

            if sorted.count > rowCap {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        showAllRows.toggle()
                    }
                } label: {
                    Text(showAllRows ? "Show fewer" : "Show all \(sorted.count)")
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
            if showsROI {
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
        case .mlb:
            MLBTeamLogo(
                logoUrl: MLBTeams.logoUrl(for: team),
                abbrev: team,
                name: team,
                size: 24
            )
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
                                Text(upcomingTimeLabel(game))
                                    .font(.system(size: 11))
                                    .foregroundStyle(Color.appTextSecondary)
                                if sport == .mlb {
                                    let chips = HistoricalAnalysisCopy.mlbUpcomingChips(game)
                                    if !chips.isEmpty {
                                        Text(chips.joined(separator: " · "))
                                            .font(.system(size: 11))
                                            .foregroundStyle(Color.appTextSecondary.opacity(0.9))
                                            .lineLimit(2)
                                    }
                                }
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

    private func upcomingTimeLabel(_ game: HistoricalAnalysisUpcomingGame) -> String {
        if let kickoff = game.kickoff, !kickoff.isEmpty {
            return HistoricalAnalysisCopy.fmtKickoff(kickoff)
        }
        var parts: [String] = []
        if let date = game.gameDate, !date.isEmpty { parts.append(date) }
        if let time = game.timeEt, !time.isEmpty { parts.append("\(time) ET") }
        return parts.joined(separator: " · ")
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

// MARK: - Chat toast model

/// One transient chat-result banner. `id` lets the auto-dismiss task verify
/// it isn't tearing down a NEWER toast that replaced this one.
private struct TrendsChatToast: Equatable {
    let id = UUID()
    let icon: String
    let text: String
    let color: Color
    let haptic: UINotificationFeedbackGenerator.FeedbackType
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
