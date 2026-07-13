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
        case seasons, spread, line, moneyline, situation, conditions, context
        var id: String {
            switch self {
            case .seasons: return "seasons"
            case .spread: return "spread"
            case .line: return "line"
            case .moneyline: return "moneyline"
            case .situation: return "situation"
            case .conditions: return "conditions"
            case .context: return "context"
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    betTypePill
                    pillButton(icon: "calendar", title: seasonsLabel) { activeSheet = .seasons }
                    pillMenu(icon: "house.fill", title: sideLabel, options: [
                        ("any", "Either", nil),
                        ("home", "Home", "house.fill"),
                        ("away", "Away", "airplane"),
                    ], selection: binding(\.side))
                    if hasSpreadFilter {
                        pillButton(icon: "arrow.left.and.right", title: spreadLabel) { activeSheet = .spread }
                    }
                    if hasLineFilter {
                        pillButton(icon: "number", title: lineLabel) { activeSheet = .line }
                    }
                    pillButton(icon: "dollarsign", title: mlLabel) { activeSheet = .moneyline }
                    pillButton(icon: "slider.horizontal.3", title: "Situation") { activeSheet = .situation }
                    pillButton(icon: "cloud.sun.fill", title: "Conditions") { activeSheet = .conditions }
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

    private var hasSpreadFilter: Bool {
        store.sport != .mlb && ["fg_spread", "h1_spread"].contains(store.betType)
    }

    private var hasLineFilter: Bool {
        switch store.sport {
        case .mlb: return ["total", "f5_total"].contains(store.betType)
        case .nfl, .cfb: return ["fg_total", "h1_total", "team_total"].contains(store.betType)
        }
    }

    private var defaultSpreadMax: Double {
        HistoricalAnalysisFilterBuilder.spreadConfig(sport: store.sport, betType: store.betType)?.max ?? 20
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
        case .spread: return "Spread"
        case .line: return "Line"
        case .moneyline: return "Moneyline odds"
        case .situation: return "Situation"
        case .conditions: return "Conditions"
        case .context:
            switch store.sport {
            case .nfl: return "Coach & referee"
            case .cfb: return "Conference"
            case .mlb: return "Teams & pitching"
            }
        }
    }

    @ViewBuilder
    private func sheetBody(_ sheet: FilterSheet) -> some View {
        Form {
            switch sheet {
            case .seasons: seasonsSheet
            case .spread: spreadSheet
            case .line: lineSheet
            case .moneyline: moneylineSheet
            case .situation: situationSheet
            case .conditions: conditionsSheet
            case .context: contextSheet
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
        case .cfb:
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

    @ViewBuilder
    private var conditionsSheet: some View {
        switch store.sport {
        case .nfl:
            optionalBoolPicker("Primetime", value: boolBinding(\.primetime))
            optionalBoolPicker("Divisional", value: boolBinding(\.division))
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
            Picker("Rest / bye", selection: binding(\.restBye)) {
                Text("Any").tag("any")
                Text("Off a bye").tag("off_bye")
                Text("Week before bye").tag("pre_bye")
                Text("Short rest").tag("short")
            }
            footballWeatherSliders(tempMax: 100)
        case .cfb:
            optionalBoolPicker("Primetime", value: boolBinding(\.primetime))
            optionalBoolPicker("Conference game", value: boolBinding(\.conferenceGame))
            optionalBoolPicker("Neutral site", value: boolBinding(\.neutralSite))
            footballWeatherSliders(tempMax: 110)
        case .mlb:
            mlbConditionsSheet
        }
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
            Text("Max wind \(store.snapshot.windMax) mph")
            Slider(value: Binding(
                get: { Double(store.snapshot.windMax) },
                set: { value in
                    store.updateSnapshot { $0.windMax = Int(value) }
                    onChange()
                }
            ), in: 0...60, step: 1)
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
            mlbTeamMultiSelect(title: "Selected teams", keyPath: \.teams)
        }
        Section("Opponents") {
            mlbTeamMultiSelect(title: "Selected opponents", keyPath: \.opponents)
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

    private func mlbTeamMultiSelect(title: String, keyPath: WritableKeyPath<HistoricalAnalysisUISnapshot, [String]>) -> some View {
        Group {
            let selected = store.snapshot[keyPath: keyPath]
            if selected.isEmpty {
                Text("All \(title.lowercased())")
                    .foregroundStyle(Color.appTextSecondary)
            } else {
                Text("\(selected.count) selected")
                    .foregroundStyle(Color.appTextSecondary)
            }
            ForEach(store.mlbTeams, id: \.abbr) { team in
                Button {
                    store.updateSnapshot { snap in
                        var list = snap[keyPath: keyPath]
                        if list.contains(team.abbr) {
                            list.removeAll { $0 == team.abbr }
                        } else {
                            list.append(team.abbr)
                            list.sort()
                        }
                        snap[keyPath: keyPath] = list
                    }
                    onChange()
                } label: {
                    HStack {
                        Text("\(team.abbr) · \(team.name)")
                            .foregroundStyle(Color.appTextPrimary)
                        Spacer()
                        if store.snapshot[keyPath: keyPath].contains(team.abbr) {
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
            let width = geo.size.width
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
                    .offset(x: lowerX - thumbSize / 2)
                    .gesture(dragGesture(width: width, isLower: true))

                thumb
                    .offset(x: upperX - thumbSize / 2)
                    .gesture(dragGesture(width: width, isLower: false))
            }
        }
        .frame(height: thumbSize + 8)
    }

    private var thumb: some View {
        Circle()
            .fill(Color.white)
            .shadow(color: .black.opacity(0.18), radius: 2, y: 1)
            .frame(width: thumbSize, height: thumbSize)
    }

    private func dragGesture(width: CGFloat, isLower: Bool) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { gesture in
                let snapped = snap(rawValue(atX: gesture.location.x, width: width))
                if isLower {
                    lower = min(snapped, upper - step)
                } else {
                    upper = max(snapped, lower + step)
                }
            }
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

/// Debounced pitcher search — mirrors web `PitcherTypeahead` / `mlb_pitcher_options`.
private struct MlbPitcherTypeahead: View {
    let label: String
    @Binding var selected: [MlbPitcherOption]
    var onChange: () -> Void = {}

    @State private var query = ""
    @State private var results: [MlbPitcherOption] = []
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?

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
                TextField("Search pitchers…", text: $query)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .onChange(of: query) { _, newValue in
                        scheduleSearch(newValue)
                    }
                if isSearching {
                    ProgressView()
                        .controlSize(.small)
                } else if !query.isEmpty {
                    Button {
                        query = ""
                        results = []
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Color.appTextMuted)
                    }
                    .buttonStyle(.plain)
                }
            }

            if !results.isEmpty {
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
            } else if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !isSearching {
                Text("No pitchers found")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextMuted)
            }
        }
        .task {
            if results.isEmpty, query.isEmpty {
                await runSearch("")
            }
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
        results = []
        onChange()
        Task { await runSearch("") }
    }

    private func scheduleSearch(_ q: String) {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            await runSearch(q)
        }
    }

    @MainActor
    private func runSearch(_ q: String) async {
        isSearching = true
        defer { isSearching = false }
        do {
            let opts = try await HistoricalAnalysisService.shared.fetchPitcherOptions(q: q)
            guard !Task.isCancelled else { return }
            results = opts
        } catch {
            guard !Task.isCancelled else { return }
            results = []
        }
    }
}
