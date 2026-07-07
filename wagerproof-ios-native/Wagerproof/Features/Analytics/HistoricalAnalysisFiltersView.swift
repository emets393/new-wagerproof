import SwiftUI
import WagerproofDesign
import WagerproofModels
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
                        ("any", "Either"), ("home", "Home"), ("away", "Away"),
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
            }

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
        Menu {
            ForEach(HistoricalAnalysisBetType.allCases) { bt in
                Button {
                    store.betType = bt.rawValue
                } label: {
                    if store.betType == bt.rawValue {
                        Label(bt.label, systemImage: "checkmark")
                    } else {
                        Text(bt.label)
                    }
                }
            }
        } label: {
            pillChrome(icon: "chart.bar.fill", title: currentBetTypeLabel, emphasized: true)
        }
    }

    private var currentBetTypeLabel: String {
        HistoricalAnalysisBetType.from(store.betType).label
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
        }
    }

    private var hasSpreadFilter: Bool {
        ["fg_spread", "h1_spread"].contains(store.betType)
    }

    private var hasLineFilter: Bool {
        ["fg_total", "h1_total", "team_total"].contains(store.betType)
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
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Active filters")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.appTextSecondary)
                    Spacer()
                    Button("Reset all") { store.resetAllFilters() }
                        .font(.system(size: 12, weight: .semibold))
                }
                .padding(.horizontal, 16)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(chips) { chip in
                            HStack(spacing: 4) {
                                Text(chip.label)
                                    .font(.system(size: 12))
                                Button(action: chip.clear) {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.system(size: 13))
                                        .foregroundStyle(Color.appTextSecondary)
                                }
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Color.appSurfaceMuted, in: Capsule())
                        }
                    }
                    .padding(.horizontal, 16)
                }
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

    private func pillMenu(icon: String, title: String, options: [(String, String)], selection: Binding<String>) -> some View {
        Menu {
            Picker(title, selection: selection) {
                ForEach(options, id: \.0) { value, label in
                    Text(label).tag(value)
                }
            }
        } label: {
            pillChrome(icon: icon, title: title)
        }
    }

    private func pillChrome(icon: String, title: String, emphasized: Bool = false) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(emphasized ? Color.appPrimary : Color.appTextSecondary)
            Text(title)
                .font(.system(size: 13, weight: emphasized ? .bold : .semibold))
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
        .overlay(Capsule().stroke(emphasized ? Color.appPrimary.opacity(0.35) : Color.appBorder.opacity(0.35), lineWidth: 1))
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
        case .context: return store.sport == .nfl ? "Coach & referee" : "Conference"
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
                ForEach(store.snapshot.seasonMin...HistoricalAnalysisSport.seasonMax, id: \.self) { y in
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
        }
        if HistoricalAnalysisBetType.moneylineMarkets.contains(store.betType) || store.betType == "team_total" {
            Picker("Favorite / underdog", selection: binding(\.favDog)) {
                Text("Either").tag("any")
                Text("Favorites").tag("favorite")
                Text("Underdogs").tag("underdog")
            }
        }
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
        optionalBoolPicker("Primetime", value: boolBinding(\.primetime))
        switch store.sport {
        case .nfl:
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
        case .cfb:
            optionalBoolPicker("Conference game", value: boolBinding(\.conferenceGame))
            optionalBoolPicker("Neutral site", value: boolBinding(\.neutralSite))
        }
        let tempMax = store.sport == .nfl ? 100 : 110
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
