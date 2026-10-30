import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices

struct FootballRegressionReportView: View {
    let sport: String
    @State private var payload: FootballRegressionPayload?
    @State private var loading = true
    @State private var teamQuery = ""
    @State private var selectedSignal: FootballSignalRow?
    @State private var edgeMarket = "fg_spread"
    @State private var teamMarket = "fg_spread"
    @State private var showAllTeams = false

    private var league: String { sport == "nfl" ? "NFL" : "College Football" }

    var body: some View {
        ScrollView(.vertical) {
            if loading && payload == nil {
                ProgressView("Loading the \(league) report")
                    .frame(maxWidth: .infinity)
                    .padding(.top, 48)
            } else if let report = payload?.report {
                VStack(alignment: .leading, spacing: 18) {
                    header(report)
                    signalTable
                    modelRecord(report)
                    splits
                    if !report.comingSoon.isEmpty { comingSoon(report) }
                    if !report.digest.isEmpty { digest(report) }
                    if let narrative = report.narrative, !narrative.isEmpty {
                        section("The AI read") {
                            WagerBotMarkdownText(narrative)
                        }
                    }
                    storylines
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 120)
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                Text("🏈 The \(league) regression report opens with the first slate of the week.")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
                    .padding(24)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle("\(league) regression")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $selectedSignal) { signal in
            signalSheet(signal)
        }
        .task { await load() }
    }

    private func load() async {
        loading = true
        payload = await FootballRegressionService.shared.load(sport: sport)
        loading = false
    }

    private func header(_ report: FootballRegressionReport) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(league) · Week \(report.week) · \(report.season)")
                .font(.system(size: 22, weight: .black))
            Text("\(report.games) games · \(activeStorylines.count) live storylines")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(topFamilies(report), id: \.self) { family in
                        let meta = FootballRegressionCopy.familyMeta(family)
                        Text("\(meta.emoji) \(meta.label)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Color(hex: meta.hex))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color(hex: meta.hex).opacity(0.15), in: Capsule())
                    }
                }
            }
            Text("Nothing here is a pick.")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
        }
    }

    private var signalTable: some View {
        section("Signal record") {
            let rows = (payload?.signals ?? []).sorted { ($0.roi ?? -.infinity) > ($1.roi ?? -.infinity) }
            if rows.isEmpty {
                Text("No graded signals yet.").foregroundStyle(Color.appTextMuted)
            } else {
                Text("Graded picks this season. Tap a signal for what it means.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
                ForEach(rows) { row in
                    signalCard(row)
                }
            }
        }
    }

    private func signalCard(_ row: FootballSignalRow) -> some View {
        let name = payload?.defs[row.key]?.name ?? row.key
        return Button {
            selectedSignal = row
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(name)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                }
                SignalMeter(wins: row.wins, losses: row.losses, pushes: row.pushes, hitRate: nil, showsCaption: false)
                HStack(spacing: 6) {
                    metricPill("Record", recordText(wins: row.wins, losses: row.losses, pushes: row.pushes), tint: recordTint(wins: row.wins, losses: row.losses))
                    if let rate = row.hitRate {
                        metricPill("Hit", String(format: "%.1f%%", rate * (rate <= 1 ? 100 : 1)), tint: NflCardInk.line)
                    }
                    if let roi = row.roi {
                        let pct = roi * 100
                        metricPill("ROI", String(format: "%+.1f%%", pct), tint: pct >= 0 ? NflCardInk.green : NflCardInk.red)
                    }
                    metricPill("N", "\(row.n)", tint: Color.appTextMuted)
                }
            }
            .padding(12)
            .reportCard()
        }
        .buttonStyle(.plain)
    }

    private func modelRecord(_ report: FootballRegressionReport) -> some View {
        section("Model record") {
            if report.modelRecord.isEmpty {
                Text("The model record lands with the first graded week.")
                    .foregroundStyle(Color.appTextMuted)
            } else {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(report.modelRecord) { row in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(row.label).font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.appTextMuted)
                            Text("\(row.wins)-\(row.losses)-\(row.pushes)")
                                .font(.system(size: 18, weight: .bold, design: .rounded))
                            if let roi = row.roiUnits, row.graded > 0 {
                                Text(String(format: "%+.1f u", roi))
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(roi >= 0 ? NflCardInk.green : NflCardInk.red)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
            }
        }
    }

    private var splits: some View {
        let rows = payload?.splits ?? []
        return VStack(alignment: .leading, spacing: 18) {
            if rows.isEmpty {
                section("Model splits") {
                    Text("Sign in to load the edge buckets and team splits.")
                        .foregroundStyle(Color.appTextMuted)
                }
            } else {
                edgeBuckets(rows.filter { $0.scope == "edge" })
                teamSplits(rows.filter { $0.scope == "team" })
            }
        }
    }

    private func edgeBuckets(_ rows: [FootballRecordSplit]) -> some View {
        let market = resolvedMarket(edgeMarket, in: rows)
        let meta = edgeMeta(market)
        let byKey = Dictionary(rows.filter { $0.market == market }.map { ($0.scopeKey, $0) }, uniquingKeysWith: { _, latest in latest })
        return section("By model edge") {
            Text("How the model does when it disagrees with the close.")
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextMuted)
                .fixedSize(horizontal: false, vertical: true)
            marketPills(rows.map(\.market), selection: market) { edgeMarket = $0 }
            Text(meta.note)
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextMuted)
                .fixedSize(horizontal: false, vertical: true)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(meta.buckets, id: \.self) { bucket in
                    edgeCard(bucket: bucket, unit: meta.unit, row: byKey[bucket])
                }
            }
        }
    }

    private func edgeCard(bucket: String, unit: String, row: FootballRecordSplit?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(bucket) \(unit)")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            if let row {
                Text(recordText(wins: row.wins, losses: row.losses, pushes: row.pushes))
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundStyle(recordTint(wins: row.wins, losses: row.losses))
                if let pct = roiPercent(row) {
                    metricPill("ROI", String(format: "%+.1f%%", pct), tint: pct >= 0 ? NflCardInk.green : NflCardInk.red)
                }
            } else {
                Text("Not graded")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func teamSplits(_ rows: [FootballRecordSplit]) -> some View {
        let market = resolvedMarket(teamMarket, in: rows)
        let needle = teamQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let matched = rows
            .filter { $0.market == market }
            .filter { needle.isEmpty || $0.scopeKey.lowercased().contains(needle) }
            .sorted { ($0.roiUnits ?? -.infinity) > ($1.roiUnits ?? -.infinity) }
        let shown = needle.isEmpty && !showAllTeams ? Array(matched.prefix(12)) : matched
        return section("By team") {
            Text("Model record in that team's games. Team totals are that team's total only.")
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextMuted)
                .fixedSize(horizontal: false, vertical: true)
            marketPills(rows.map(\.market), selection: market) { picked in
                teamMarket = picked
                showAllTeams = false
            }
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
                TextField("Search teams", text: $teamQuery)
                    .font(.system(size: 14, weight: .medium))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            .padding(.horizontal, 14)
            .frame(height: 36)
            .liquidGlassBackground(in: Capsule(), interactive: true)
            .overlay(Capsule().stroke(Color.appBorder.opacity(0.35), lineWidth: 1))
            if shown.isEmpty {
                Text(needle.isEmpty ? "No graded team splits yet." : "No teams match that search.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextMuted)
            } else {
                ForEach(shown) { row in
                    teamSplitCard(row)
                }
            }
            if needle.isEmpty && matched.count > shown.count {
                Button {
                    showAllTeams = true
                } label: {
                    Text("Show all \(matched.count) teams")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Color.appPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                        .liquidGlassBackground(in: Capsule(), interactive: true)
                        .overlay(Capsule().stroke(Color.appBorder.opacity(0.35), lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func teamSplitCard(_ row: FootballRecordSplit) -> some View {
        HStack(spacing: 10) {
            teamMark(row.scopeKey)
            Text(row.scopeKey)
                .font(.system(size: 14, weight: .bold))
                .lineLimit(1)
            Spacer(minLength: 8)
            Text(recordText(wins: row.wins, losses: row.losses, pushes: row.pushes))
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(recordTint(wins: row.wins, losses: row.losses))
                .padding(.horizontal, 8)
                .frame(height: 26)
                .background(recordTint(wins: row.wins, losses: row.losses).opacity(0.12), in: Capsule())
            if let pct = roiPercent(row) {
                Text(String(format: "%+.1f%%", pct))
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(pct >= 0 ? NflCardInk.green : NflCardInk.red)
                    .padding(.horizontal, 8)
                    .frame(height: 26)
                    .background((pct >= 0 ? NflCardInk.green : NflCardInk.red).opacity(0.12), in: Capsule())
            }
        }
        .padding(10)
        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func marketPills(_ markets: [String], selection: String, pick: @escaping (String) -> Void) -> some View {
        let present = Set(markets)
        let ordered = FootballRegressionCopy.marketOrder.filter { present.contains($0) }
        let extra = present.subtracting(ordered).sorted()
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(ordered + extra, id: \.self) { market in
                    let on = market == selection
                    Button {
                        pick(market)
                    } label: {
                        Text(marketShort(market))
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(on ? Color.appPrimary : Color.appTextPrimary)
                            .padding(.horizontal, 14)
                            .frame(height: 36)
                            .liquidGlassBackground(in: Capsule(), interactive: true)
                            .overlay(Capsule().stroke(on ? Color.appPrimary : Color.appBorder.opacity(0.35), lineWidth: on ? 1.5 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func resolvedMarket(_ selected: String, in rows: [FootballRecordSplit]) -> String {
        let present = Set(rows.map(\.market))
        if present.contains(selected) { return selected }
        return FootballRegressionCopy.marketOrder.first { present.contains($0) } ?? present.sorted().first ?? selected
    }

    private func edgeMeta(_ market: String) -> (buckets: [String], unit: String, note: String) {
        if market == "fg_ml" {
            return (["0-5", "5-10", "10-20", "20+"], "pp", "How far the model's win probability sat from a coin flip, in percentage points.")
        }
        if market == "h1_ml" {
            return (["0-3", "3-6", "6-10", "10+"], "pts", "How big the model's predicted first-half margin was.")
        }
        let note = market.contains("total") || market == "tt"
            ? "How many points the model's projected total was off the closing number."
            : "How many points the model's own line was off the closing spread."
        return (["0-3", "3-6", "6-10", "10+"], "pts", note)
    }

    private func marketShort(_ key: String) -> String {
        switch key {
        case "fg_spread": return "Spread"
        case "fg_total": return "Total"
        case "fg_ml": return "ML"
        case "tt": return "Team total"
        case "h1_spread": return "1H spread"
        case "h1_total": return "1H total"
        case "h1_ml": return "1H ML"
        default: return FootballRegressionCopy.marketLabel(key)
        }
    }

    private func recordText(wins: Int, losses: Int, pushes: Int) -> String {
        pushes > 0 ? "\(wins)-\(losses)-\(pushes)" : "\(wins)-\(losses)"
    }

    private func recordTint(wins: Int, losses: Int) -> Color {
        if wins > losses { return NflCardInk.green }
        if wins < losses { return NflCardInk.red }
        return Color.appTextMuted
    }

    private func roiPercent(_ row: FootballRecordSplit) -> Double? {
        guard let units = row.roiUnits, row.roiN > 0 else { return nil }
        return units / Double(row.roiN) * 100
    }

    private func metricPill(_ title: String, _ value: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(tint)
                .lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func comingSoon(_ report: FootballRegressionReport) -> some View {
        section("Still coming") {
            ForEach(report.comingSoon) { item in
                Text("\(item.emoji) \(item.label) — \(item.note)")
                    .font(.system(size: 13))
            }
        }
    }

    private func digest(_ report: FootballRegressionReport) -> some View {
        section("Today's update\(report.digestDate.map { " · \($0)" } ?? "")") {
            ForEach(report.digest) { entry in
                Text("\(entry.type == "new" ? "New" : "Updated") · \(entry.title)")
                    .font(.system(size: 13, weight: .medium))
            }
        }
    }

    private var storylines: some View {
        let groups = grouped
        return VStack(alignment: .leading, spacing: 12) {
            if let featured = groups.first(where: { $0.family == "matchups" }) {
                Text("Featured matchups").font(.system(size: 18, weight: .bold))
                ForEach(featured.rows) { row in
                    storyCard(row)
                }
            }
            ForEach(groups.filter { $0.family != "matchups" }, id: \.family) { group in
                let meta = FootballRegressionCopy.familyMeta(group.family)
                Text("\(meta.emoji) \(meta.label)").font(.system(size: 18, weight: .bold))
                ForEach(group.rows) { row in
                    storyCard(row)
                }
            }
        }
    }

    private func storyCard(_ row: FootballStoryline) -> some View {
        let meta = FootballRegressionCopy.familyMeta(row.family)
        return VStack(alignment: .leading, spacing: 8) {
            if let matchup = row.matchup, !matchup.isEmpty {
                matchupStrip(matchup)
            }
            Text("\(meta.emoji) \(meta.label)")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color(hex: meta.hex))
            Text(row.title)
                .font(.system(size: 16, weight: .bold))
                .fixedSize(horizontal: false, vertical: true)
            Text(row.body)
                .font(.system(size: 14))
                .foregroundStyle(Color.appTextPrimary)
                .fixedSize(horizontal: false, vertical: true)
            if let full = row.full, !full.isEmpty {
                DisclosureGroup("Full rundown") {
                    WagerBotMarkdownText(full)
                }
                .font(.system(size: 13, weight: .bold))
            }
            if let source = row.source, !source.isEmpty {
                Text(source).font(.system(size: 11)).foregroundStyle(Color.appTextMuted)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(light: 0xFFFFFF, dark: 0x202024), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(alignment: .leading) {
            UnevenRoundedRectangle(topLeadingRadius: 16, bottomLeadingRadius: 16, bottomTrailingRadius: 0, topTrailingRadius: 0)
                .fill(Color(hex: meta.hex))
                .frame(width: 4)
        }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func signalSheet(_ signal: FootballSignalRow) -> some View {
        let def = payload?.defs[signal.key]
        let live = payload?.upcoming[signal.key] ?? []
        return NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text(def?.name ?? signal.key).font(.system(size: 20, weight: .bold))
                    if let line = def?.oneLiner { Text(line) }
                    if let definition = def?.definition { Text(definition).foregroundStyle(Color.appTextMuted) }
                    SignalMeter(wins: signal.wins, losses: signal.losses, pushes: signal.pushes, hitRate: signal.hitRate)
                    if !live.isEmpty {
                        Text("On the board now").font(.system(size: 15, weight: .bold))
                        ForEach(live) { flag in
                            HStack {
                                Text(flag.pick).font(.system(size: 13, weight: .semibold))
                                Spacer()
                                Text(flag.started ? "Under way" : (NflPropBoardCopy.kickoffLabel(flag.kickoff) ?? ""))
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.appTextMuted)
                            }
                        }
                    }
                }
                .padding(16)
            }
            .navigationTitle("Signal")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
    }

    private var activeStorylines: [FootballStoryline] {
        (payload?.storylines ?? []).filter { $0.status != "resolved" }
    }

    private var grouped: [(family: String, rows: [FootballStoryline])] {
        let active = activeStorylines
        var order = FootballRegressionCopy.familyOrder
        for family in active.map(\.family) where !order.contains(family) { order.append(family) }
        return order.compactMap { family in
            let rows = active.filter { $0.family == family }
            return rows.isEmpty ? nil : (family, rows)
        }
    }

    private func topFamilies(_ report: FootballRegressionReport) -> [String] {
        report.families.sorted { $0.value > $1.value }.prefix(6).map(\.key)
    }

    private func teamMark(_ name: String) -> some View {
        GameCardTeamAvatar(teamName: name, sport: sport, size: 22)
    }

    private func matchupStrip(_ matchup: String) -> some View {
        let parts = matchup.components(separatedBy: " @ ")
        return HStack(spacing: 6) {
            if parts.count == 2 {
                GameCardTeamAvatar(teamName: parts[0], sport: sport, size: 22)
                Text(parts[0]).font(.system(size: 12, weight: .bold))
                Text("@").foregroundStyle(Color.appTextMuted)
                GameCardTeamAvatar(teamName: parts[1], sport: sport, size: 22)
                Text(parts[1]).font(.system(size: 12, weight: .bold))
            } else {
                Text(matchup).font(.system(size: 12, weight: .semibold))
            }
        }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
            }
            .padding(.horizontal, 12)
            .frame(height: 40)
            .liquidGlassBackground(in: Capsule())
            .overlay(Capsule().stroke(Color.appBorder.opacity(0.35), lineWidth: 1))
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private extension View {
    func reportCard() -> some View {
        self
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(light: 0xFFFFFF, dark: 0x202024), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.appBorder.opacity(0.55), lineWidth: 1))
    }
}

private struct SignalMeter: View {
    let wins: Int
    let losses: Int
    let pushes: Int
    let hitRate: Double?
    var showsCaption = true

    var body: some View {
        let total = max(wins + losses + pushes, 1)
        VStack(alignment: .leading, spacing: 6) {
            if let hitRate {
                Text(String(format: "Hit rate %.0f%%", hitRate * (hitRate <= 1 ? 100 : 1)))
                    .font(.system(size: 13, weight: .bold))
            }
            GeometryReader { geo in
                HStack(spacing: 2) {
                    Rectangle().fill(NflCardInk.green).frame(width: geo.size.width * CGFloat(wins) / CGFloat(total))
                    Rectangle().fill(Color.appTextMuted.opacity(0.45)).frame(width: geo.size.width * CGFloat(pushes) / CGFloat(total))
                    Rectangle().fill(NflCardInk.red).frame(width: geo.size.width * CGFloat(losses) / CGFloat(total))
                }
            }
            .frame(height: 10)
            .clipShape(Capsule())
            if showsCaption {
                Text("\(wins) W · \(pushes) P · \(losses) L")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
            }
        }
    }
}
