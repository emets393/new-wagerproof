import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

// MARK: - Filter bar (compact dropdown pills)

/// Horizontal pill row — each filter opens a menu or sheet instead of
/// consuming the whole page with inline controls.
struct HistoricalAnalysisFilterBar: View {
    @Bindable var store: HistoricalAnalysisStore
    var onChange: () -> Void

    @State private var activeSheet: FilterSheet?

    private enum FilterSheet: Identifiable {
        /// NFL uses matchup + weather (spec). CFB/MLB still use the older Conditions sheet.
        case seasons, lines, spread, line, moneyline, situation, conditions, matchup, weather, context, lastGame
        /// Team as-of form + opponent (H2H / opp record / opp last game).
        /// Kept separate from `.matchup` (game-setup: primetime / division / rest).
        case teamForm, opponent
        var id: String {
            switch self {
            case .seasons: return "seasons"
            case .lines: return "lines"
            case .spread: return "spread"
            case .line: return "line"
            case .moneyline: return "moneyline"
            case .situation: return "situation"
            case .conditions: return "conditions"
            case .matchup: return "matchup"
            case .weather: return "weather"
            case .context: return "context"
            case .lastGame: return "lastGame"
            case .teamForm: return "teamForm"
            case .opponent: return "opponent"
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    betTypePill
                    pillButton(icon: "calendar", title: seasonsLabel) { activeSheet = .seasons }
                    // Side is per-team, so hide it on game totals (it returns 0 / does nothing there).
                    if hasSideFilter {
                        pillMenu(icon: "house.fill", title: sideLabel, options: [
                            ("any", "Either", nil),
                            ("home", "Home", "house.fill"),
                            ("away", "Away", "airplane"),
                        ], selection: binding(\.side))
                    }
                    if store.sport == .nfl || store.sport == .cfb {
                        pillButton(icon: "slider.horizontal.3", title: "Lines") { activeSheet = .lines }
                    } else {
                        if hasSpreadFilter {
                            pillButton(icon: "arrow.left.and.right", title: spreadLabel) { activeSheet = .spread }
                        }
                        if hasLineFilter {
                            pillButton(icon: "number", title: lineLabel) { activeSheet = .line }
                        }
                        if hasMoneylineFilter {
                            pillButton(icon: "dollarsign", title: mlLabel) { activeSheet = .moneyline }
                        }
                    }
                    pillButton(icon: "slider.horizontal.3", title: situationPillTitle) { activeSheet = .situation }
                    // NFL as-of: team form + opponent context (not game-setup — that stays "Setup").
                    if store.sport == .nfl || store.sport == .cfb {
                        pillButton(icon: "chart.line.uptrend.xyaxis", title: "Team form") { activeSheet = .teamForm }
                        pillButton(icon: "person.2.wave.2", title: "Opponent") { activeSheet = .opponent }
                    }

                    // NFL: Setup (primetime/division/rest) + Weather.
                    // CFB/MLB keep Conditions while CFB grouping is updated separately.
                    if store.sport == .nfl {
                        pillButton(icon: "sportscourt.fill", title: "Setup") { activeSheet = .matchup }
                        pillButton(icon: "cloud.sun.fill", title: "Weather") { activeSheet = .weather }
                    } else {
                        pillButton(icon: "cloud.sun.fill", title: "Conditions") { activeSheet = .conditions }
                    }
                    if hasLastGameFilter {
                        pillButton(icon: "clock.arrow.circlepath", title: "Last game") { activeSheet = .lastGame }
                    }
                    pillButton(icon: "person.2.fill", title: contextLabel) { activeSheet = .context }
                }
                .padding(.horizontal, 16)
                // Breathing room so the glass highlight isn't shaved at the
                // scroll bounds even before clipping is disabled.
                .padding(.vertical, 4)
            }
            .scrollClipDisabled()

            activeChipsRow
        }
        .sheet(item: $activeSheet, onDismiss: { onChange() }) { sheet in
            NavigationStack {
                sheetBody(sheet)
                    .navigationTitle(sheetTitle(sheet))
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { activeSheet = nil }
                        }
                    }
            }
            .presentationDetents([.medium, .large])
        }
    }

    // MARK: - Bet type pill

    private var betTypePill: some View {
        let cases = HistoricalAnalysisBetType.cases(for: store.sport)
        let secondaryGroup = store.sport == .mlb ? "First Five" : "First Half"
        return Menu {
            Picker("Market", selection: Binding(
                get: { store.betType },
                set: { store.betType = $0 }
            )) {
                Section("Full Game") {
                    ForEach(cases.filter { $0.group == "Full Game" }) { bt in
                        Label(bt.label, systemImage: marketIcon(for: bt)).tag(bt.rawValue)
                    }
                }
                Section(secondaryGroup) {
                    ForEach(cases.filter { $0.group == secondaryGroup }) { bt in
                        Label(bt.label, systemImage: marketIcon(for: bt)).tag(bt.rawValue)
                    }
                }
            }
        } label: {
            pillChrome(icon: "chart.bar.fill", title: currentBetTypeLabel)
        }
    }

    private var currentBetTypeLabel: String {
        HistoricalAnalysisBetType.from(store.betType).label
    }

    private func marketIcon(for betType: HistoricalAnalysisBetType) -> String {
        switch betType {
        case .fgSpread, .h1Spread, .rl, .f5RL: return "arrow.left.and.right"
        case .fgML, .h1ML, .ml, .f5ML: return "dollarsign"
        case .fgTotal, .h1Total, .total, .f5Total: return "sum"
        case .teamTotal: return "person.crop.circle"
        }
    }

    // MARK: - Pill labels

    private var seasonsLabel: String {
        HistoricalAnalysisCopy.yearRange(store.snapshot.seasonMin, store.snapshot.seasonMax)
    }

    private var sideLabel: String {
        switch store.snapshot.side {
        case "home": return "Home"
        case "away": return "Away"
        default: return "Side"
        }
    }

    private var spreadLabel: String {
        if store.snapshot.spreadSide != "any" {
            return "\(store.snapshot.spreadSide == "favorite" ? "Fav" : "Dog") \(HistoricalAnalysisCopy.trimmed(store.snapshot.spreadMin))–\(HistoricalAnalysisCopy.trimmed(store.snapshot.spreadMax))"
        }
        if store.snapshot.spreadMin > 0.001 || store.snapshot.spreadMax < defaultSpreadMax - 0.001 {
            return "Spread \(HistoricalAnalysisCopy.trimmed(store.snapshot.spreadMin))–\(HistoricalAnalysisCopy.trimmed(store.snapshot.spreadMax))"
        }
        return "Spread"
    }

    private var lineLabel: String {
        let t = store.snapshot.lineMin
        let u = store.snapshot.lineMax
        let lo = Double(defaultLineMin)
        let hi = Double(defaultLineMax)
        if t > lo + 0.001 || u < hi - 0.001 {
            return "Line \(HistoricalAnalysisCopy.trimmed(t))–\(HistoricalAnalysisCopy.trimmed(u))"
        }
        return "Line"
    }

    private var mlLabel: String {
        if !store.snapshot.mlMin.isEmpty || !store.snapshot.mlMax.isEmpty { return "ML odds" }
        return "ML"
    }

    private var contextLabel: String {
        switch store.sport {
        case .nfl:
            if store.snapshot.coach != "any" { return store.snapshot.coach }
            if store.snapshot.referee != "any" { return "Ref: \(store.snapshot.referee)" }
            return "Coach/Ref"
        case .cfb:
            return HistoricalAnalysisCopy.conferencePillLabel(
                HistoricalAnalysisCopy.activeConferences(store.snapshot)
            )
        case .mlb:
            let pitcherCount = store.snapshot.sp.count + store.snapshot.oppSp.count
            let n = store.snapshot.teams.count + store.snapshot.opponents.count
            if pitcherCount > 0 {
                if pitcherCount == 1 {
                    let p = store.snapshot.sp.first ?? store.snapshot.oppSp.first
                    return p?.name ?? "Pitcher"
                }
                return "\(pitcherCount) pitchers"
            }
            if n > 0 { return "\(n) team\(n == 1 ? "" : "s")" }
            if store.snapshot.spHand != "any" || store.snapshot.oppSpHand != "any" {
                return "Pitching"
            }
            return "Teams/SP"
        }
    }

    private var situationPillTitle: String {
        let n = store.snapshot.teams.count + store.snapshot.opponents.count
        if store.sport != .mlb, n > 0 {
            return "\(n) team\(n == 1 ? "" : "s")"
        }
        return "Situation"
    }

    private var hasSpreadFilter: Bool {
        // FG spread filter is available on every football result market.
        store.sport != .mlb
    }

    // Side is per-team; a game total is game-level, so Side is hidden there (football).
    private var hasSideFilter: Bool {
        switch store.sport {
        case .mlb: return true
        case .nfl, .cfb: return !["fg_total", "h1_total"].contains(store.betType)
        }
    }

    // FG moneyline odds — available on every result market (and always on MLB).
    private var hasMoneylineFilter: Bool {
        true
    }

    // Football "Last game" group (previous-game filters). MLB keeps its own last-* controls in Situation.
    private var hasLastGameFilter: Bool {
        store.sport == .nfl || store.sport == .cfb
    }

    private var hasLineFilter: Bool {
        // Game total (and subject-market totals) — always available.
        true
    }

    private var defaultSpreadMax: Double {
        // Always use FG spread max (cross-market); web has separate H1 controls.
        store.sport == .cfb ? 50 : 20
    }

    private var defaultLineMin: Int {
        Int(HistoricalAnalysisFilterBuilder.totalConfig(sport: store.sport, betType: store.betType)?.min ?? 30)
    }

    private var defaultLineMax: Int {
        Int(HistoricalAnalysisFilterBuilder.totalConfig(sport: store.sport, betType: store.betType)?.max ?? 60)
    }

    // MARK: - Active chips

    @ViewBuilder
    private var activeChipsRow: some View {
        let chips = HistoricalAnalysisCopy.activeChips(
            sport: store.sport,
            snapshot: store.snapshot,
            seasonFloor: store.seasonFloor
        ) { updated in
            store.snapshot = updated
            onChange()
        }
        if !chips.isEmpty {
            // Plain text chips — no capsule chrome, matching the pill row.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 14) {
                    ForEach(chips) { chip in
                        HStack(spacing: 3) {
                            Text(chip.label)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Color.appTextSecondary)
                            Button(action: chip.clear) {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.appTextMuted)
                            }
                        }
                    }
                    Button {
                        store.resetAllFilters()
                    } label: {
                        Text("Reset all")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.appPrimary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
            }
        }
    }

    // MARK: - Pill chrome

    private func pillButton(icon: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            pillChrome(icon: icon, title: title)
        }
        .buttonStyle(.plain)
    }

    private func pillMenu(icon: String, title: String, options: [(String, String, String?)], selection: Binding<String>) -> some View {
        Menu {
            Picker(title, selection: selection) {
                ForEach(options, id: \.0) { value, label, optionIcon in
                    if let optionIcon {
                        Label(label, systemImage: optionIcon).tag(value)
                    } else {
                        Text(label).tag(value)
                    }
                }
            }
        } label: {
            pillChrome(icon: icon, title: title)
        }
    }

    // System Liquid Glass capsules only — no custom strokes, fills, or tint.
    // The pills ScrollView disables clipping so the glass never gets shaved.
    private func pillChrome(icon: String, title: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextSecondary)
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
                .monospacedDigit()
            Image(systemName: "chevron.down")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
        }
        .padding(.horizontal, 12)
        .frame(height: 36)
        .liquidGlassBackground(in: Capsule(), interactive: true)
    }

    // MARK: - Sheets

    private func sheetTitle(_ sheet: FilterSheet) -> String {
        switch sheet {
        case .seasons: return "Seasons"
        case .lines: return "Lines & odds"
        case .spread: return "Spread"
        case .line: return "Line"
        case .moneyline: return "Moneyline odds"
        case .situation: return "Situation"
        case .conditions: return "Conditions"
        case .matchup: return "Setup"
        case .weather: return "Weather"
        case .context:
            switch store.sport {
            case .nfl: return "Coach & referee"
            case .cfb: return "Conference"
            case .mlb: return "Teams & pitching"
            }
        case .lastGame: return "Last game"
        case .teamForm: return "Team form"
        case .opponent: return "Opponent"
        }
    }

    @ViewBuilder
    private func sheetBody(_ sheet: FilterSheet) -> some View {
        Form {
            switch sheet {
            case .seasons: seasonsSheet
            case .lines: linesSheet
            case .spread: spreadSheet
            case .line: lineSheet
            case .moneyline: moneylineSheet
            case .situation: situationSheet
            case .conditions: conditionsSheet
            case .matchup: nflMatchupSheet
            case .weather: nflWeatherSheet
            case .context: contextSheet
            case .lastGame: lastGameSheet
            case .teamForm: teamFormSheet
            case .opponent: opponentSheet
            }
        }
    }

    private var seasonsSheet: some View {
        Group {
            Picker("From", selection: intBinding(\.seasonMin)) {
                ForEach(store.seasonFloor...store.snapshot.seasonMax, id: \.self) { y in
                    Text(verbatim: String(y)).tag(y)
                }
            }
            Picker("To", selection: intBinding(\.seasonMax)) {
                ForEach(store.snapshot.seasonMin...store.sport.seasonMax, id: \.self) { y in
                    Text(verbatim: String(y)).tag(y)
                }
            }
        }
    }

    @ViewBuilder
    private var linesSheet: some View {
        let isCFB = store.sport == .cfb
        spreadLineSection(
            title: "Full-game spread",
            side: \.spreadSide,
            min: \.spreadMin,
            max: \.spreadMax,
            maxValue: isCFB ? 50 : 20
        )
        moneylineSection(title: "Full-game ML", min: \.mlMin, max: \.mlMax)
        lineRangeSection(title: "Game total", min: \.lineMin, max: \.lineMax, range: 30...(isCFB ? 80 : 60))
        spreadLineSection(
            title: "1H spread",
            side: \.h1SpreadSide,
            min: \.h1SpreadMin,
            max: \.h1SpreadMax,
            maxValue: isCFB ? 28 : 14
        )
        moneylineSection(title: "1H ML", min: \.h1MlMin, max: \.h1MlMax)
        lineRangeSection(title: "1H total", min: \.h1TotalMin, max: \.h1TotalMax, range: 15...(isCFB ? 45 : 35))
        lineRangeSection(title: "Team total line", min: \.ttLineMin, max: \.ttLineMax, range: 10...(isCFB ? 55 : 40))
        spreadLineSection(
            title: "Opponent spread",
            side: \.oppSpreadSide,
            min: \.oppSpreadMin,
            max: \.oppSpreadMax,
            maxValue: isCFB ? 50 : 20
        )
        moneylineSection(title: "Opponent ML", min: \.oppMlMin, max: \.oppMlMax)
        lineRangeSection(title: "Opponent team total line", min: \.oppTtLineMin, max: \.oppTtLineMax, range: 10...(isCFB ? 55 : 40))
    }

    private func spreadLineSection(
        title: String,
        side: WritableKeyPath<HistoricalAnalysisUISnapshot, String>,
        min: WritableKeyPath<HistoricalAnalysisUISnapshot, Double>,
        max: WritableKeyPath<HistoricalAnalysisUISnapshot, Double>,
        maxValue: Double
    ) -> some View {
        Section(title) {
            Picker("Side", selection: binding(side)) {
                Text("Either side").tag("any")
                Text("Favored by").tag("favorite")
                Text("Getting").tag("underdog")
            }
            HistoricalAnalysisRangeSlider(
                lower: doubleBinding(min),
                upper: doubleBinding(max),
                range: 0...maxValue,
                step: 0.5
            )
            .padding(.vertical, 4)
        }
    }

    private func moneylineSection(
        title: String,
        min: WritableKeyPath<HistoricalAnalysisUISnapshot, String>,
        max: WritableKeyPath<HistoricalAnalysisUISnapshot, String>
    ) -> some View {
        Section(title) {
            TextField("Min American odds", text: stringBinding(min))
                .keyboardType(.numbersAndPunctuation)
            TextField("Max American odds", text: stringBinding(max))
                .keyboardType(.numbersAndPunctuation)
        }
    }

    private func lineRangeSection(
        title: String,
        min: WritableKeyPath<HistoricalAnalysisUISnapshot, Double>,
        max: WritableKeyPath<HistoricalAnalysisUISnapshot, Double>,
        range: ClosedRange<Double>
    ) -> some View {
        Section(title) {
            HistoricalAnalysisRangeSlider(lower: doubleBinding(min), upper: doubleBinding(max), range: range, step: 0.5)
                .padding(.vertical, 4)
        }
    }

    @ViewBuilder
    private var spreadSheet: some View {
        let maxSpread = defaultSpreadMax
        Picker("Spread side", selection: binding(\.spreadSide)) {
            Text("Either side").tag("any")
            Text("Favored by").tag("favorite")
            Text("Getting").tag("underdog")
        }
        Section {
            let sideLabel = store.snapshot.spreadSide == "favorite"
                ? "Favored by"
                : store.snapshot.spreadSide == "underdog" ? "Getting" : "Spread"
            VStack(alignment: .leading, spacing: 12) {
                Text("\(sideLabel): \(HistoricalAnalysisCopy.trimmed(store.snapshot.spreadMin))–\(HistoricalAnalysisCopy.trimmed(store.snapshot.spreadMax)) pts")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: doubleBinding(\.spreadMin),
                    upper: doubleBinding(\.spreadMax),
                    range: 0...maxSpread,
                    step: 0.5
                )
            }
            .padding(.vertical, 4)
        }
    }

    @ViewBuilder
    private var lineSheet: some View {
        let lo = Double(defaultLineMin)
        let hi = Double(defaultLineMax)
        Section {
            VStack(alignment: .leading, spacing: 12) {
                Text("Line: \(HistoricalAnalysisCopy.trimmed(store.snapshot.lineMin))–\(HistoricalAnalysisCopy.trimmed(store.snapshot.lineMax))")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: doubleBinding(\.lineMin),
                    upper: doubleBinding(\.lineMax),
                    range: lo...hi,
                    step: 0.5
                )
            }
            .padding(.vertical, 4)
        }
    }

    private var moneylineSheet: some View {
        Group {
            TextField("Min American odds (e.g. -200)", text: stringBinding(\.mlMin))
                .keyboardType(.numbersAndPunctuation)
            TextField("Max American odds (e.g. -120)", text: stringBinding(\.mlMax))
                .keyboardType(.numbersAndPunctuation)
        }
    }

    @ViewBuilder
    private var situationSheet: some View {
        switch store.sport {
        case .nfl:
            Section("Teams") {
                teamMultiSelect(title: "Selected teams", keyPath: \.teams)
            }
            Section("Opponents") {
                teamMultiSelect(title: "Selected opponents", keyPath: \.opponents)
            }
            Picker("Season type", selection: binding(\.seasonType)) {
                Text("Regular + Playoffs").tag("any")
                Text("Regular season").tag("regular")
                Text("Playoffs only").tag("postseason")
            }
            if store.snapshot.seasonType == "regular" {
                weekPickers(max: 18)
            }
            if store.snapshot.seasonType == "postseason" {
                Picker("Playoff round", selection: binding(\.playoffRound)) {
                    Text("All rounds").tag("any")
                    Text("Wild Card").tag("Wild Card")
                    Text("Divisional").tag("Divisional")
                    Text("Conference").tag("Conference")
                    Text("Super Bowl").tag("Super Bowl")
                }
            }
            // B1: Days of week multi-select for NFL
            Section("Days of week") {
                daysOfWeekMultiSelect
            }
        case .cfb:
            Section("Teams") {
                teamMultiSelect(title: "Selected teams", keyPath: \.teams)
            }
            Section("Opponents") {
                teamMultiSelect(title: "Selected opponents", keyPath: \.opponents)
            }
            Picker("Game type", selection: binding(\.gameType)) {
                Text("All games").tag("any")
                Text("Regular season").tag("regular")
                Text("Bowl games").tag("bowl")
                Text("Playoff").tag("playoff")
                Text("All postseason").tag("postseason")
            }
            if store.snapshot.gameType == "regular" {
                weekPickers(max: 16)
            }
            Picker("Ranked matchup", selection: binding(\.rankedMatchup)) {
                Text("Any").tag("any")
                Text("Both ranked").tag("both")
                Text("Neither ranked").tag("neither")
                Text("Home ranked / away not").tag("home_ranked")
                Text("Away ranked / home not").tag("away_ranked")
                Text("Either ranked").tag("either")
            }
            optionalBoolPicker("Primetime", value: boolBinding(\.primetime))
            optionalBoolPicker("Conference game", value: boolBinding(\.conferenceGame))
            optionalBoolPicker("Neutral site", value: boolBinding(\.neutralSite))
        case .mlb:
            mlbSituationSheet
        }
        if showsFavDogFilter {
            Picker("Favorite / underdog", selection: binding(\.favDog)) {
                Text("Either").tag("any")
                Text("Favorites").tag("favorite")
                Text("Underdogs").tag("underdog")
            }
        }
    }

    private var showsFavDogFilter: Bool {
        switch store.sport {
        case .mlb:
            return ["ml", "rl", "f5_ml", "f5_rl"].contains(store.betType)
        case .nfl, .cfb:
            return HistoricalAnalysisBetType.moneylineMarkets.contains(store.betType) || store.betType == "team_total"
        }
    }

    @ViewBuilder
    private var mlbSituationSheet: some View {
        Section("Months") {
            Picker("From", selection: intBinding(\.monthMin)) {
                ForEach(3...store.snapshot.monthMax, id: \.self) { m in
                    Text(monthName(m)).tag(m)
                }
            }
            Picker("To", selection: intBinding(\.monthMax)) {
                ForEach(store.snapshot.monthMin...11, id: \.self) { m in
                    Text(monthName(m)).tag(m)
                }
            }
        }
        Picker("Day of week", selection: binding(\.dayOfWeek)) {
            Text("Any").tag("any")
            Text("Mon").tag("Mon")
            Text("Tue").tag("Tue")
            Text("Wed").tag("Wed")
            Text("Thu").tag("Thu")
            Text("Fri").tag("Fri")
            Text("Sat").tag("Sat")
            Text("Sun").tag("Sun")
        }
        Section("Series game") {
            optionalIntField("Min (1–4+)", keyPath: \.seriesGameMin)
            optionalIntField("Max", keyPath: \.seriesGameMax)
        }
        Section("Trip series index") {
            optionalIntField("Min", keyPath: \.tripMin)
            optionalIntField("Max", keyPath: \.tripMax)
        }
        optionalBoolPicker("Switch game", value: boolBinding(\.switchGame))
        Section("Days rest") {
            optionalIntField("Min", keyPath: \.restMin)
            optionalIntField("Max", keyPath: \.restMax)
        }
        Picker("Last result", selection: binding(\.lastResult)) {
            Text("Any").tag("any")
            Text("Won").tag("won")
            Text("Lost").tag("lost")
        }
        Section("Last margin (runs)") {
            TextField("Min (e.g. -3)", text: stringBinding(\.lastMarginMin))
                .keyboardType(.numbersAndPunctuation)
            TextField("Max (e.g. 5)", text: stringBinding(\.lastMarginMax))
                .keyboardType(.numbersAndPunctuation)
        }
        optionalBoolPicker("Division", value: boolBinding(\.division))
        optionalBoolPicker("Interleague", value: boolBinding(\.interleague))
        optionalBoolPicker("Doubleheader", value: boolBinding(\.doubleheader))
    }

    private func monthName(_ m: Int) -> String {
        let names = ["", "", "", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]
        return (m >= 3 && m <= 11) ? names[m] : "\(m)"
    }

    private func optionalIntField(_ title: String, keyPath: WritableKeyPath<HistoricalAnalysisUISnapshot, Int?>) -> some View {
        TextField(title, text: Binding(
            get: {
                store.snapshot[keyPath: keyPath].map(String.init) ?? ""
            },
            set: { raw in
                let trimmed = raw.trimmingCharacters(in: .whitespaces)
                store.updateSnapshot {
                    $0[keyPath: keyPath] = trimmed.isEmpty ? nil : Int(trimmed)
                }
                onChange()
            }
        ))
        .keyboardType(.numberPad)
    }

    private func weekPickers(max: Int) -> some View {
        Group {
            Picker("Week from", selection: intBinding(\.weekMin)) {
                ForEach(1...store.snapshot.weekMax, id: \.self) { w in
                    Text(verbatim: String(w)).tag(w)
                }
            }
            Picker("Week to", selection: intBinding(\.weekMax)) {
                ForEach(store.snapshot.weekMin...max, id: \.self) { w in
                    Text(verbatim: String(w)).tag(w)
                }
            }
        }
    }

    /// CFB/MLB only — NFL uses `nflMatchupSheet` + `nflWeatherSheet`.
    @ViewBuilder
    private var conditionsSheet: some View {
        switch store.sport {
        case .nfl:
            EmptyView()
        case .cfb:
            Picker("Weather", selection: binding(\.weather)) {
                Text("Any").tag("any")
                Text("Clear").tag("clear")
                Text("Cloudy").tag("cloudy")
                Text("Rain").tag("rain")
                Text("Snow").tag("snow")
            }
            Picker("Venue", selection: binding(\.dome)) {
                Text("Any").tag("any")
                Text("Dome / indoors").tag("dome")
                Text("Outdoors").tag("outdoor")
            }
            footballWeatherSliders(tempMax: 110)
            Text("Weather conditions are complete for 2022+, partial for 2018–2021, and sparse in 2016–2017.")
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextMuted)
        case .mlb:
            mlbConditionsSheet
        }
    }

    /// NFL Matchup = game setup, not weather (primetime / divisional / rest).
    @ViewBuilder
    private var nflMatchupSheet: some View {
        optionalBoolPicker("Primetime", value: boolBinding(\.primetime))
        optionalBoolPicker("Divisional", value: boolBinding(\.division))
        Picker("Rest / bye", selection: binding(\.restBye)) {
            Text("Any").tag("any")
            Text("Off a bye").tag("off_bye")
            Text("Week before bye").tag("pre_bye")
            Text("Short rest (Thu)").tag("short")
        }
        // B1: Team divisions multi-select for NFL
        Section("Team divisions") {
            teamDivisionsMultiSelect
        }
    }

    /// NFL Weather = venue / precip / temp / wind only.
    @ViewBuilder
    private var nflWeatherSheet: some View {
        Picker("Venue", selection: binding(\.dome)) {
            Text("Any").tag("any")
            Text("Dome").tag("dome")
            Text("Outdoor").tag("outdoor")
        }
        Picker("Precipitation", selection: binding(\.precip)) {
            Text("Any").tag("any")
            Text("None").tag("none")
            Text("Rain").tag("rain")
            Text("Snow").tag("snow")
        }
        footballWeatherSliders(tempMax: 100)
    }

    // MARK: - Last game (football) — describes the team's PREVIOUS game
    @ViewBuilder
    private var lastGameSheet: some View {
        Picker("Result", selection: binding(\.lastResult)) {
            Text("Any").tag("any")
            Text("Won").tag("won")
            Text("Lost").tag("lost")
        }
        Picker("ATS", selection: binding(\.lastAts)) {
            Text("Any").tag("any")
            Text("Covered").tag("covered")
            Text("Didn't cover").tag("not")
        }
        Picker("Total", selection: binding(\.lastTotal)) {
            Text("Any").tag("any")
            Text("Over").tag("over")
            Text("Under").tag("under")
        }
        Picker("Was", selection: binding(\.lastRole)) {
            Text("Any").tag("any")
            Text("Favorite").tag("favorite")
            Text("Underdog").tag("underdog")
        }
        // B1: NFL uses signed margin slider instead of blowout
        if store.sport == .nfl {
            VStack(alignment: .leading, spacing: 12) {
                Text("Last game margin: \(store.snapshot.lastMargin[0])–\(store.snapshot.lastMargin[1]) pts")
                    .font(.subheadline)
                Text("+ = won by, − = lost by")
                    .font(.caption)
                    .foregroundStyle(Color.appTextSecondary)
                HistoricalAnalysisRangeSlider(
                    lower: intAsDoubleBinding(\.lastMargin, 0),
                    upper: intAsDoubleBinding(\.lastMargin, 1),
                    range: -60...60,
                    step: 1
                )
            }
        } else {
            // CFB still uses blowout
            Picker("Blowout (±21)", selection: binding(\.lastBlowout)) {
                Text("Any").tag("any")
                Text("Won by 21+").tag("win")
                Text("Lost by 21+").tag("loss")
            }
        }
        optionalBoolPicker("Went to overtime", value: boolBinding(\.lastOt))
    }

    @ViewBuilder
    private func footballWeatherSliders(tempMax: Int) -> some View {
        VStack(alignment: .leading) {
            Text("Temp \(store.snapshot.tempMin)–\(store.snapshot.tempMax)°F")
            Slider(value: Binding(
                get: { Double(store.snapshot.tempMin) },
                set: { value in
                    store.updateSnapshot { $0.tempMin = Int(value) }
                    onChange()
                }
            ), in: -10...Double(store.snapshot.tempMax), step: 1)
            Slider(value: Binding(
                get: { Double(store.snapshot.tempMax) },
                set: { value in
                    store.updateSnapshot { $0.tempMax = Int(value) }
                    onChange()
                }
            ), in: Double(store.snapshot.tempMin)...Double(tempMax), step: 1)
        }
        VStack(alignment: .leading) {
            Text("Wind \(store.snapshot.windMin ?? 0)–\(store.snapshot.windMax) mph")
            Slider(value: Binding(
                get: { Double(store.snapshot.windMin ?? 0) },
                set: { value in
                    let v = Int(value)
                    store.updateSnapshot {
                        $0.windMin = v > 0 ? v : nil
                        if $0.windMax < v { $0.windMax = v }
                    }
                    onChange()
                }
            ), in: 0...Double(store.snapshot.windMax), step: 1)
            Slider(value: Binding(
                get: { Double(store.snapshot.windMax) },
                set: { value in
                    let v = Int(value)
                    store.updateSnapshot {
                        $0.windMax = v
                        if let min = $0.windMin, min > v { $0.windMin = v > 0 ? v : nil }
                    }
                    onChange()
                }
            ), in: Double(store.snapshot.windMin ?? 0)...60, step: 1)
        }
    }

    @ViewBuilder
    private var mlbConditionsSheet: some View {
        VStack(alignment: .leading) {
            Text("Temp \(store.snapshot.tempMin)–\(store.snapshot.tempMax)°F")
            Slider(value: Binding(
                get: { Double(store.snapshot.tempMin) },
                set: { value in
                    store.updateSnapshot { $0.tempMin = Int(value) }
                    onChange()
                }
            ), in: -10...Double(store.snapshot.tempMax), step: 1)
            Slider(value: Binding(
                get: { Double(store.snapshot.tempMax) },
                set: { value in
                    store.updateSnapshot { $0.tempMax = Int(value) }
                    onChange()
                }
            ), in: Double(store.snapshot.tempMin)...110, step: 1)
        }
        Section("Wind") {
            TextField("Min mph", text: Binding(
                get: { store.snapshot.windMin.map(String.init) ?? "" },
                set: { raw in
                    let t = raw.trimmingCharacters(in: .whitespaces)
                    store.updateSnapshot { $0.windMin = t.isEmpty ? nil : Int(t) }
                    onChange()
                }
            ))
            .keyboardType(.numberPad)
            VStack(alignment: .leading) {
                Text("Max wind \(store.snapshot.windMax) mph")
                Slider(value: Binding(
                    get: { Double(store.snapshot.windMax) },
                    set: { value in
                        store.updateSnapshot { $0.windMax = Int(value) }
                        onChange()
                    }
                ), in: 0...60, step: 1)
            }
            Picker("Wind direction", selection: binding(\.windDir)) {
                Text("Any").tag("any")
                Text("Out").tag("out")
                Text("In").tag("in")
                Text("Cross").tag("cross")
                Text("None / calm").tag("none")
            }
        }
        Picker("Dome", selection: binding(\.dome)) {
            Text("Any").tag("any")
            Text("Dome").tag("dome")
            Text("Outdoor").tag("outdoor")
        }
        Section("Park factor (runs)") {
            TextField("Min", text: Binding(
                get: { store.snapshot.pfRunsMin.map { HistoricalAnalysisCopy.trimmed($0) } ?? "" },
                set: { raw in
                    let t = raw.trimmingCharacters(in: .whitespaces)
                    store.updateSnapshot { $0.pfRunsMin = t.isEmpty ? nil : Double(t) }
                    onChange()
                }
            ))
            .keyboardType(.decimalPad)
            TextField("Max", text: Binding(
                get: { store.snapshot.pfRunsMax.map { HistoricalAnalysisCopy.trimmed($0) } ?? "" },
                set: { raw in
                    let t = raw.trimmingCharacters(in: .whitespaces)
                    store.updateSnapshot { $0.pfRunsMax = t.isEmpty ? nil : Double(t) }
                    onChange()
                }
            ))
            .keyboardType(.decimalPad)
        }
    }

    @ViewBuilder
    private var contextSheet: some View {
        switch store.sport {
        case .nfl:
            Picker("Coach", selection: binding(\.coach)) {
                Text("Any coach").tag("any")
                ForEach(store.coaches, id: \.self) { c in Text(c).tag(c) }
            }
            Picker("Referee", selection: binding(\.referee)) {
                Text("Any referee").tag("any")
                ForEach(store.referees, id: \.self) { r in Text(r).tag(r) }
            }
        case .cfb:
            conferenceMultiSelect
        case .mlb:
            mlbContextSheet
        }
    }

    @ViewBuilder
    private var mlbContextSheet: some View {
        Section("Teams") {
            teamMultiSelect(title: "Selected teams", keyPath: \.teams)
        }
        Section("Opponents") {
            teamMultiSelect(title: "Selected opponents", keyPath: \.opponents)
        }

        MlbPitcherTypeahead(
            label: "Team starter (SP)",
            selected: Binding(
                get: { store.snapshot.sp },
                set: { next in
                    store.updateSnapshot { $0.sp = next }
                }
            ),
            onChange: onChange
        )
        MlbPitcherTypeahead(
            label: "Opposing starter",
            selected: Binding(
                get: { store.snapshot.oppSp },
                set: { next in
                    store.updateSnapshot { $0.oppSp = next }
                }
            ),
            onChange: onChange
        )

        Section("Handedness") {
            Picker("SP hand", selection: binding(\.spHand)) {
                Text("Any").tag("any")
                Text("Left").tag("L")
                Text("Right").tag("R")
            }
            Picker("Opp SP hand", selection: binding(\.oppSpHand)) {
                Text("Any").tag("any")
                Text("Left").tag("L")
                Text("Right").tag("R")
            }
        }
    }

    private func teamMultiSelect(title: String, keyPath: WritableKeyPath<HistoricalAnalysisUISnapshot, [String]>) -> some View {
        Group {
            let selected = store.snapshot[keyPath: keyPath]
            if selected.isEmpty {
                Text("All \(title.lowercased())")
                    .foregroundStyle(Color.appTextSecondary)
            } else {
                Text("\(selected.count) selected")
                    .foregroundStyle(Color.appTextSecondary)
            }
            ForEach(store.teamOptions, id: \.id) { team in
                Button {
                    store.updateSnapshot { snap in
                        var list = snap[keyPath: keyPath]
                        if list.contains(team.id) {
                            list.removeAll { $0 == team.id }
                        } else {
                            list.append(team.id)
                            list.sort()
                        }
                        snap[keyPath: keyPath] = list
                    }
                    onChange()
                } label: {
                    HStack {
                        Text(team.id == team.name ? team.name : "\(team.id) · \(team.name)")
                            .foregroundStyle(Color.appTextPrimary)
                            .lineLimit(1)
                        Spacer()
                        if store.snapshot[keyPath: keyPath].contains(team.id) {
                            Image(systemName: "checkmark")
                                .foregroundStyle(Color.appPrimary)
                                .font(.system(size: 14, weight: .bold))
                        }
                    }
                }
            }
            if !selected.isEmpty {
                Button("Clear", role: .destructive) {
                    store.updateSnapshot { $0[keyPath: keyPath] = [] }
                    onChange()
                }
            }
        }
    }

    private var conferenceMultiSelect: some View {
        List {
            Section {
                if store.snapshot.selectedConferences.isEmpty {
                    Text("All conferences")
                        .foregroundStyle(Color.appTextSecondary)
                } else {
                    Text("\(store.snapshot.selectedConferences.count) selected")
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
            Section {
                ForEach(store.conferences, id: \.self) { name in
                    Button {
                        toggleConference(name)
                    } label: {
                        HStack {
                            Text(name)
                                .foregroundStyle(Color.appTextPrimary)
                            Spacer()
                            if store.snapshot.selectedConferences.contains(name) {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Color.appPrimary)
                                    .font(.system(size: 14, weight: .bold))
                            }
                        }
                    }
                }
            }
            if !store.snapshot.selectedConferences.isEmpty {
                Section {
                    Button("Clear all conferences", role: .destructive) {
                        store.updateSnapshot {
                            $0.selectedConferences = []
                            $0.conference = "any"
                        }
                        onChange()
                    }
                }
            }
        }
    }

    private func toggleConference(_ name: String) {
        store.updateSnapshot { snap in
            if snap.selectedConferences.contains(name) {
                snap.selectedConferences.removeAll { $0 == name }
            } else {
                snap.selectedConferences.append(name)
                snap.selectedConferences.sort()
            }
            snap.conference = "any"
        }
        onChange()
    }

    private func optionalBoolPicker(_ title: String, value: Binding<Bool?>) -> some View {
        Picker(title, selection: value) {
            Text("Any").tag(Bool?.none)
            Text("Yes").tag(Bool?.some(true))
            Text("No").tag(Bool?.some(false))
        }
    }

    // MARK: - Bindings

    private func binding(_ keyPath: WritableKeyPath<HistoricalAnalysisUISnapshot, String>) -> Binding<String> {
        Binding(
            get: { store.snapshot[keyPath: keyPath] },
            set: { newValue in
                store.updateSnapshot { $0[keyPath: keyPath] = newValue }
                onChange()
            }
        )
    }

    private func stringBinding(_ keyPath: WritableKeyPath<HistoricalAnalysisUISnapshot, String>) -> Binding<String> {
        binding(keyPath)
    }

    private func intBinding(_ keyPath: WritableKeyPath<HistoricalAnalysisUISnapshot, Int>) -> Binding<Int> {
        Binding(
            get: { store.snapshot[keyPath: keyPath] },
            set: { newValue in
                store.updateSnapshot { $0[keyPath: keyPath] = newValue }
                onChange()
            }
        )
    }

    private func doubleBinding(_ keyPath: WritableKeyPath<HistoricalAnalysisUISnapshot, Double>) -> Binding<Double> {
        Binding(
            get: { store.snapshot[keyPath: keyPath] },
            set: { newValue in
                store.updateSnapshot { $0[keyPath: keyPath] = newValue }
                onChange()
            }
        )
    }

    private func boolBinding(_ keyPath: WritableKeyPath<HistoricalAnalysisUISnapshot, Bool?>) -> Binding<Bool?> {
        Binding(
            get: { store.snapshot[keyPath: keyPath] },
            set: { newValue in
                store.updateSnapshot { $0[keyPath: keyPath] = newValue }
                onChange()
            }
        )
    }

    // MARK: - B1: New NFL filter sheets
    
    @ViewBuilder
    private var teamFormSheet: some View {
        Section("Season Record") {
            VStack(alignment: .leading, spacing: 12) {
                Text("Win %: \(Int(store.snapshot.winPct[0]))–\(Int(store.snapshot.winPct[1]))%")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: doubleBinding(\.winPct, 0),
                    upper: doubleBinding(\.winPct, 1),
                    range: 0...100,
                    step: 1
                )
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Win streak: \(store.snapshot.winStreak[0])–\(store.snapshot.winStreak[1]) games")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: intAsDoubleBinding(\.winStreak, 0),
                    upper: intAsDoubleBinding(\.winStreak, 1),
                    range: 0...16,
                    step: 1
                )
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Loss streak: \(store.snapshot.lossStreak[0])–\(store.snapshot.lossStreak[1]) games")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: intAsDoubleBinding(\.lossStreak, 0),
                    upper: intAsDoubleBinding(\.lossStreak, 1),
                    range: 0...16,
                    step: 1
                )
            }
            
            Picker("Winning record (>.500)", selection: boolBinding(\.above500)) {
                Text("Any").tag(nil as Bool?)
                Text("Above .500").tag(true as Bool?)
                Text("Below .500").tag(false as Bool?)
            }
            
            Picker("Better record than opponent", selection: boolBinding(\.winPctGtOpp)) {
                Text("Any").tag(nil as Bool?)
                Text("Better record").tag(true as Bool?)
                Text("Worse record").tag(false as Bool?)
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("PPG: \(HistoricalAnalysisCopy.trimmed(store.snapshot.ppg[0]))–\(HistoricalAnalysisCopy.trimmed(store.snapshot.ppg[1]))")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: doubleBinding(\.ppg, 0),
                    upper: doubleBinding(\.ppg, 1),
                    range: 0...40,
                    step: 0.5
                )
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("PA/G: \(HistoricalAnalysisCopy.trimmed(store.snapshot.paPg[0]))–\(HistoricalAnalysisCopy.trimmed(store.snapshot.paPg[1]))")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: doubleBinding(\.paPg, 0),
                    upper: doubleBinding(\.paPg, 1),
                    range: 0...40,
                    step: 0.5
                )
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Point diff/game: \(HistoricalAnalysisCopy.trimmed(store.snapshot.pointDiffPg[0]))–\(HistoricalAnalysisCopy.trimmed(store.snapshot.pointDiffPg[1]))")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: doubleBinding(\.pointDiffPg, 0),
                    upper: doubleBinding(\.pointDiffPg, 1),
                    range: -20...20,
                    step: 0.5
                )
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Min games this season: \(store.snapshot.minGames)")
                    .font(.subheadline)
                Slider(
                    value: Binding(
                        get: { Double(store.snapshot.minGames) },
                        set: { value in
                            store.updateSnapshot { $0.minGames = Int(value.rounded()) }
                            onChange()
                        }
                    ),
                    in: 0...10,
                    step: 1
                )
            }
        }
        
        Section("Cover Profile") {
            VStack(alignment: .leading, spacing: 12) {
                Text("ATS Win %: \(Int(store.snapshot.atsWinPct[0]))–\(Int(store.snapshot.atsWinPct[1]))%")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: doubleBinding(\.atsWinPct, 0),
                    upper: doubleBinding(\.atsWinPct, 1),
                    range: 0...100,
                    step: 1
                )
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("ATS Win streak: \(store.snapshot.atsWinStreak[0])–\(store.snapshot.atsWinStreak[1]) games")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: intAsDoubleBinding(\.atsWinStreak, 0),
                    upper: intAsDoubleBinding(\.atsWinStreak, 1),
                    range: 0...16,
                    step: 1
                )
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Avg cover margin: \(HistoricalAnalysisCopy.trimmed(store.snapshot.avgCoverMargin[0]))–\(HistoricalAnalysisCopy.trimmed(store.snapshot.avgCoverMargin[1]))")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: doubleBinding(\.avgCoverMargin, 0),
                    upper: doubleBinding(\.avgCoverMargin, 1),
                    range: -15...15,
                    step: 0.5
                )
            }
        }
        
        Section("Total Profile") {
            VStack(alignment: .leading, spacing: 12) {
                Text("Over %: \(Int(store.snapshot.overPct[0]))–\(Int(store.snapshot.overPct[1]))%")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: doubleBinding(\.overPct, 0),
                    upper: doubleBinding(\.overPct, 1),
                    range: 0...100,
                    step: 1
                )
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Over streak: \(store.snapshot.overStreak[0])–\(store.snapshot.overStreak[1]) games")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: intAsDoubleBinding(\.overStreak, 0),
                    upper: intAsDoubleBinding(\.overStreak, 1),
                    range: 0...16,
                    step: 1
                )
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Under streak: \(store.snapshot.underStreak[0])–\(store.snapshot.underStreak[1]) games")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: intAsDoubleBinding(\.underStreak, 0),
                    upper: intAsDoubleBinding(\.underStreak, 1),
                    range: 0...16,
                    step: 1
                )
            }
        }
        
        Section("Prior Year") {
            VStack(alignment: .leading, spacing: 12) {
                Text("Last season wins: \(store.snapshot.prevWins[0])–\(store.snapshot.prevWins[1])")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: intAsDoubleBinding(\.prevWins, 0),
                    upper: intAsDoubleBinding(\.prevWins, 1),
                    range: 0...16,
                    step: 1
                )
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Last season win %: \(Int(store.snapshot.prevWinPct[0]))–\(Int(store.snapshot.prevWinPct[1]))%")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: doubleBinding(\.prevWinPct, 0),
                    upper: doubleBinding(\.prevWinPct, 1),
                    range: 0...100,
                    step: 1
                )
            }
            
            Picker("Made playoffs last year", selection: boolBinding(\.madePlayoffsPrev)) {
                Text("Any").tag(nil as Bool?)
                Text("Made playoffs").tag(true as Bool?)
                Text("Missed playoffs").tag(false as Bool?)
            }
            
            Picker("More wins than opponent last year", selection: boolBinding(\.moreWinsThanOppPrev)) {
                Text("Any").tag(nil as Bool?)
                Text("More wins").tag(true as Bool?)
                Text("Fewer wins").tag(false as Bool?)
            }
        }
    }
    
    @ViewBuilder
    private var opponentSheet: some View {
        Section("Head-to-Head") {
            Picker("Won last meeting", selection: binding(\.h2hLastWin)) {
                Text("Any").tag("any")
                Text("Won").tag("yes")
                Text("Lost").tag("no")
            }
            
            Picker("Covered last meeting", selection: binding(\.h2hLastAts)) {
                Text("Any").tag("any")
                Text("Covered").tag("yes")
                Text("Didn't cover").tag("no")
            }
            
            Picker("Last meeting total", selection: binding(\.h2hLastOver)) {
                Text("Any").tag("any")
                Text("Over").tag("yes")
                Text("Under").tag("no")
            }
            
            Picker("Was home last meeting", selection: boolBinding(\.h2hLastHome)) {
                Text("Any").tag(nil as Bool?)
                Text("Home").tag(true as Bool?)
                Text("Away").tag(false as Bool?)
            }
            
            Picker("Was favorite last meeting", selection: boolBinding(\.h2hLastFav)) {
                Text("Any").tag(nil as Bool?)
                Text("Favorite").tag(true as Bool?)
                Text("Underdog").tag(false as Bool?)
            }
            
            Picker("Same season as last meeting", selection: boolBinding(\.h2hSameSeason)) {
                Text("Any").tag(nil as Bool?)
                Text("Same season").tag(true as Bool?)
                Text("Different season").tag(false as Bool?)
            }
            
            Picker("Spread vs last meeting", selection: binding(\.h2hSpreadCmp)) {
                Text("Any").tag("any")
                Text("Lower (more favored)").tag("lower")
                Text("Higher (less favored)").tag("higher")
            }
        }
        
        Section("Opponent Record") {
            VStack(alignment: .leading, spacing: 12) {
                Text("Opponent Win %: \(Int(store.snapshot.oppWinPct[0]))–\(Int(store.snapshot.oppWinPct[1]))%")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: doubleBinding(\.oppWinPct, 0),
                    upper: doubleBinding(\.oppWinPct, 1),
                    range: 0...100,
                    step: 1
                )
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Opponent Over %: \(Int(store.snapshot.oppOverPct[0]))–\(Int(store.snapshot.oppOverPct[1]))%")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: doubleBinding(\.oppOverPct, 0),
                    upper: doubleBinding(\.oppOverPct, 1),
                    range: 0...100,
                    step: 1
                )
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Opponent Win streak: \(store.snapshot.oppWinStreak[0])–\(store.snapshot.oppWinStreak[1]) games")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: intAsDoubleBinding(\.oppWinStreak, 0),
                    upper: intAsDoubleBinding(\.oppWinStreak, 1),
                    range: 0...16,
                    step: 1
                )
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Opponent last season win %: \(Int(store.snapshot.oppPrevWinPct[0]))–\(Int(store.snapshot.oppPrevWinPct[1]))%")
                    .font(.subheadline)
                HistoricalAnalysisRangeSlider(
                    lower: doubleBinding(\.oppPrevWinPct, 0),
                    upper: doubleBinding(\.oppPrevWinPct, 1),
                    range: 0...100,
                    step: 1
                )
            }
        }
        
        Section("Opponent last game") {
            Picker("Opponent last game result", selection: binding(\.oppLastResult)) {
                Text("Any").tag("any")
                Text("Won").tag("won")
                Text("Lost").tag("lost")
            }
            
            Picker("Opponent last game ATS", selection: binding(\.oppLastAts)) {
                Text("Any").tag("any")
                Text("Covered").tag("covered")
                Text("Didn't cover").tag("not")
            }
            
            Picker("Opponent last game total", selection: binding(\.oppLastTotal)) {
                Text("Any").tag("any")
                Text("Over").tag("over")
                Text("Under").tag("under")
            }
            
            Picker("Opponent last game role", selection: binding(\.oppLastRole)) {
                Text("Any").tag("any")
                Text("Favorite").tag("favorite")
                Text("Underdog").tag("underdog")
            }
            
            Picker("Opponent last game overtime", selection: boolBinding(\.oppLastOt)) {
                Text("Any").tag(nil as Bool?)
                Text("Overtime").tag(true as Bool?)
                Text("Regulation").tag(false as Bool?)
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Opponent last game margin: \(store.snapshot.oppLastMargin[0])–\(store.snapshot.oppLastMargin[1]) pts")
                    .font(.subheadline)
                Text("+ = opponent won by, − = opponent lost by")
                    .font(.caption)
                    .foregroundStyle(Color.appTextSecondary)
                HistoricalAnalysisRangeSlider(
                    lower: intAsDoubleBinding(\.oppLastMargin, 0),
                    upper: intAsDoubleBinding(\.oppLastMargin, 1),
                    range: -60...60,
                    step: 1
                )
            }
        }
    }

    @ViewBuilder
    private var daysOfWeekMultiSelect: some View {
        let selected = store.snapshot.daysOfWeek
        let allDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        
        if selected.isEmpty {
            Text("All days")
                .foregroundStyle(Color.appTextSecondary)
        } else {
            Text("\(selected.count) day\(selected.count == 1 ? "" : "s") selected")
                .foregroundStyle(Color.appTextSecondary)
        }
        
        ForEach(allDays, id: \.self) { day in
            Button {
                store.updateSnapshot { snap in
                    if snap.daysOfWeek.contains(day) {
                        snap.daysOfWeek.removeAll { $0 == day }
                    } else {
                        snap.daysOfWeek.append(day)
                    }
                }
                onChange()
            } label: {
                HStack {
                    Text(dayLabel(day))
                    Spacer()
                    if selected.contains(day) {
                        Image(systemName: "checkmark")
                            .foregroundStyle(Color.appPrimary)
                            .font(.system(size: 13, weight: .bold))
                    }
                }
            }
            .foregroundStyle(Color.appTextPrimary)
        }
    }
    
    @ViewBuilder
    private var teamDivisionsMultiSelect: some View {
        let selected = store.snapshot.teamDivisions
        let allDivisions = ["AFC East", "AFC North", "AFC South", "AFC West", "NFC East", "NFC North", "NFC South", "NFC West"]
        
        if selected.isEmpty {
            Text("All divisions")
                .foregroundStyle(Color.appTextSecondary)
        } else {
            Text("\(selected.count) division\(selected.count == 1 ? "" : "s") selected")
                .foregroundStyle(Color.appTextSecondary)
        }
        
        ForEach(allDivisions, id: \.self) { division in
            Button {
                store.updateSnapshot { snap in
                    if snap.teamDivisions.contains(division) {
                        snap.teamDivisions.removeAll { $0 == division }
                    } else {
                        snap.teamDivisions.append(division)
                    }
                }
                onChange()
            } label: {
                HStack {
                    Text(division)
                    Spacer()
                    if selected.contains(division) {
                        Image(systemName: "checkmark")
                            .foregroundStyle(Color.appPrimary)
                            .font(.system(size: 13, weight: .bold))
                    }
                }
            }
            .foregroundStyle(Color.appTextPrimary)
        }
    }

    // Helper bindings for arrays — always read-modify-write so mutations stick.
    private func doubleBinding(_ keyPath: WritableKeyPath<HistoricalAnalysisUISnapshot, [Double]>, _ index: Int) -> Binding<Double> {
        Binding(
            get: { store.snapshot[keyPath: keyPath][index] },
            set: { newValue in
                store.updateSnapshot { snap in
                    var arr = snap[keyPath: keyPath]
                    guard arr.indices.contains(index) else { return }
                    arr[index] = newValue
                    snap[keyPath: keyPath] = arr
                }
                onChange()
            }
        )
    }

    private func intAsDoubleBinding(_ keyPath: WritableKeyPath<HistoricalAnalysisUISnapshot, [Int]>, _ index: Int) -> Binding<Double> {
        Binding(
            get: { Double(store.snapshot[keyPath: keyPath][index]) },
            set: { newValue in
                store.updateSnapshot { snap in
                    var arr = snap[keyPath: keyPath]
                    guard arr.indices.contains(index) else { return }
                    arr[index] = Int(newValue.rounded())
                    snap[keyPath: keyPath] = arr
                }
                onChange()
            }
        )
    }

    private func dayLabel(_ day: String) -> String {
        switch day {
        case "Sun": return "Sunday"
        case "Mon": return "Monday"
        case "Tue": return "Tuesday"
        case "Wed": return "Wednesday"
        case "Thu": return "Thursday"
        case "Fri": return "Friday"
        case "Sat": return "Saturday"
        default: return day
        }
    }
}

// MARK: - Dual-thumb range slider (mirrors web RangeRow)

private struct HistoricalAnalysisRangeSlider: View {
    @Binding var lower: Double
    @Binding var upper: Double
    let range: ClosedRange<Double>
    let step: Double

    private let thumbSize: CGFloat = 28

    var body: some View {
        GeometryReader { geo in
            let width = max(geo.size.width, 1)
            let lowerX = xPosition(for: lower, width: width)
            let upperX = xPosition(for: upper, width: width)

            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.appSurfaceMuted)
                    .frame(height: 5)

                Capsule()
                    .fill(Color.appPrimary)
                    .frame(width: max(0, upperX - lowerX), height: 5)
                    .offset(x: lowerX)

                thumb
                    .position(x: lowerX, y: (thumbSize + 8) / 2)

                thumb
                    .position(x: upperX, y: (thumbSize + 8) / 2)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            // Drag is on the track (full width), not the thumbs — thumb-local
            // DragGesture only moved within ~28pt and made ranges feel dead.
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { gesture in
                        let value = snap(rawValue(atX: gesture.location.x, width: width))
                        // Whichever endpoint is closer follows the finger; ties go to lower.
                        if abs(value - lower) <= abs(value - upper) {
                            lower = min(value, upper)
                        } else {
                            upper = max(value, lower)
                        }
                    }
            )
        }
        .frame(height: thumbSize + 8)
    }

    private var thumb: some View {
        Circle()
            .fill(Color.white)
            .shadow(color: .black.opacity(0.18), radius: 2, y: 1)
            .frame(width: thumbSize, height: thumbSize)
            .allowsHitTesting(false)
    }

    private func xPosition(for value: Double, width: CGFloat) -> CGFloat {
        let span = range.upperBound - range.lowerBound
        guard span > 0 else { return 0 }
        return CGFloat((value - range.lowerBound) / span) * width
    }

    private func rawValue(atX x: CGFloat, width: CGFloat) -> Double {
        let span = range.upperBound - range.lowerBound
        let ratio = max(0, min(1, Double(x / max(width, 1))))
        return snap(range.lowerBound + ratio * span)
    }

    private func snap(_ raw: Double) -> Double {
        let steps = ((raw - range.lowerBound) / step).rounded()
        let snapped = range.lowerBound + steps * step
        return min(range.upperBound, max(range.lowerBound, snapped))
    }
}

// MARK: - MLB pitcher typeahead

/// Debounced pitcher search — loads catalog once, filters locally (accent-insensitive).
private struct MlbPitcherTypeahead: View {
    let label: String
    @Binding var selected: [MlbPitcherOption]
    var onChange: () -> Void = {}

    @State private var query = ""
    @State private var catalog: [MlbPitcherOption] = []
    @State private var results: [MlbPitcherOption] = []
    @State private var isLoadingCatalog = false
    @State private var loadFailed = false
    @State private var filterTask: Task<Void, Never>?

    var body: some View {
        Section(label) {
            if !selected.isEmpty {
                ForEach(selected) { pitcher in
                    HStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(pitcher.name)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                            Text(subtitle(for: pitcher))
                                .font(.system(size: 12))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                        Spacer()
                        Button {
                            selected.removeAll { $0.id == pitcher.id }
                            onChange()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(Color.appTextMuted)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(Color.appTextMuted)
                    .font(.system(size: 14, weight: .semibold))
                TextField("Search pitchers… (accents optional)", text: $query)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .onChange(of: query) { _, newValue in
                        scheduleFilter(newValue)
                    }
                if isLoadingCatalog {
                    ProgressView()
                        .controlSize(.small)
                } else if !query.isEmpty {
                    Button {
                        query = ""
                        applyFilter("")
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Color.appTextMuted)
                    }
                    .buttonStyle(.plain)
                }
            }

            if loadFailed && catalog.isEmpty {
                Text("Couldn’t load pitchers — try again")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextMuted)
            } else if !results.isEmpty {
                ForEach(results.prefix(40)) { pitcher in
                    Button {
                        add(pitcher)
                    } label: {
                        HStack {
                            Text(pitcher.name)
                                .foregroundStyle(Color.appTextPrimary)
                                .font(.system(size: 15, weight: .medium))
                            Spacer()
                            Text(subtitle(for: pitcher))
                                .font(.system(size: 12))
                                .foregroundStyle(Color.appTextSecondary)
                            if selected.contains(where: { $0.id == pitcher.id }) {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Color.appPrimary)
                                    .font(.system(size: 13, weight: .bold))
                            }
                        }
                    }
                    .disabled(selected.contains(where: { $0.id == pitcher.id }))
                }
            } else if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !isLoadingCatalog, !catalog.isEmpty {
                Text("No pitchers match")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextMuted)
            }
        }
        .task {
            await ensureCatalog()
            applyFilter(query)
        }
    }

    private func subtitle(for pitcher: MlbPitcherOption) -> String {
        [pitcher.team, pitcher.hand.map { "\($0)HP" }]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    private func add(_ pitcher: MlbPitcherOption) {
        guard !selected.contains(where: { $0.id == pitcher.id }) else { return }
        selected.append(pitcher)
        query = ""
        applyFilter("")
        onChange()
    }

    private func scheduleFilter(_ q: String) {
        filterTask?.cancel()
        filterTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 80_000_000)
            guard !Task.isCancelled else { return }
            applyFilter(q)
        }
    }

    @MainActor
    private func applyFilter(_ q: String) {
        results = Self.filterPitchers(catalog, query: q, limit: 40)
    }

    @MainActor
    private func ensureCatalog() async {
        guard catalog.isEmpty else { return }
        isLoadingCatalog = true
        defer { isLoadingCatalog = false }
        do {
            catalog = try await HistoricalAnalysisService.shared.fetchPitcherOptions(q: "")
            loadFailed = false
        } catch {
            loadFailed = true
            catalog = []
        }
    }

    /// Fold accents so "Jose" matches "José".
    private static func fold(_ s: String) -> String {
        s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US_POSIX"))
    }

    private static func filterPitchers(_ pitchers: [MlbPitcherOption], query: String, limit: Int) -> [MlbPitcherOption] {
        let q = fold(query.trimmingCharacters(in: .whitespacesAndNewlines))
        if q.isEmpty { return Array(pitchers.prefix(limit)) }

        struct Scored { let p: MlbPitcherOption; let score: Int }
        var scored: [Scored] = []
        for p in pitchers {
            let name = fold(p.name)
            let team = p.team.map(fold) ?? ""
            guard name.contains(q) || team.contains(q) else { continue }
            let tokens = name.split { !$0.isLetter && !$0.isNumber }.map(String.init)
            var score = 2
            if name.hasPrefix(q) || tokens.contains(where: { $0.hasPrefix(q) }) { score = 0 }
            else if tokens.contains(where: { $0.contains(q) }) { score = 1 }
            scored.append(Scored(p: p, score: score))
        }
        scored.sort {
            if $0.score != $1.score { return $0.score < $1.score }
            return $0.p.name.localizedCaseInsensitiveCompare($1.p.name) == .orderedAscending
        }
        return scored.prefix(limit).map(\.p)
    }
}
