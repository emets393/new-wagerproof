import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// MLB Daily Regression Report screen. Mirrors RN
/// `app/(drawer)/(tabs)/mlb-regression-report.tsx`. The full RN file is
/// ~1900 lines with ~10 stacked content blocks (narrative, recap, accuracy,
/// suggested picks, pitcher regression both directions, batting heat-up /
/// cool-down, bullpen fatigue, perfect storm, weather, lr splits). This
/// port lands the screen scaffolding + the highest-traffic sections so the
/// MLB analytics tab is usable; deeper bodies port as follow-ups.
///
/// FIDELITY-WAIVER #110: full RN parity (sticky section headers, markdown
/// narrative renderer, segmented tab controls inside each section) ships
/// in a follow-up batch — see `docs/wagerproof-migration/fidelity/b12-mlb.md`.
struct MlbRegressionReportView: View {
    @State private var store = MLBRegressionReportStore()
    @State private var accuracyStore = MLBBucketAccuracyStore()

    var body: some View {
        NavigationStack {
            content
                .background(Color.appSurface.ignoresSafeArea())
                .navigationTitle("Regression Report")
                .navigationBarTitleDisplayMode(.large)
                .task {
                    async let _: () = store.refreshIfStale()
                    async let _: () = accuracyStore.refreshIfStale()
                    _ = await (store.refreshIfStale(), accuracyStore.refreshIfStale())
                }
                .refreshable {
                    await store.refresh()
                    await accuracyStore.refresh()
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        if store.loading && store.report == nil {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .tint(Color.appPrimary)
        } else if let report = store.report {
            ScrollView {
                LazyVStack(spacing: 16) {
                    headerCard(report: report)
                    if let narrative = report.narrativeText, !narrative.isEmpty {
                        narrativeCard(narrative)
                    }
                    if let recap = report.yesterdayRecap, !recap.isEmpty {
                        recapCard(recap)
                    }
                    if let cumulative = report.cumulativeRecord {
                        cumulativeCard(cumulative)
                    }
                    if let picks = report.suggestedPicks, !picks.isEmpty {
                        picksCard(picks)
                    }
                    if let pitchers = report.pitcherNegativeRegression, !pitchers.isEmpty {
                        pitcherRegressionCard(title: "Pitcher Negative Regression", iconColor: Color.appAccentRed, pitchers: pitchers)
                    }
                    if let pitchers = report.pitcherPositiveRegression, !pitchers.isEmpty {
                        pitcherRegressionCard(title: "Pitcher Positive Regression", iconColor: Color.appPrimary, pitchers: pitchers)
                    }
                    if let heat = report.battingHeatUp, !heat.isEmpty {
                        battingCard(title: "Batting Heat-Up", iconColor: Color.appPrimary, teams: heat)
                    }
                    if let cool = report.battingCoolDown, !cool.isEmpty {
                        battingCard(title: "Batting Cool-Down", iconColor: Color(hex: 0x3B82F6), teams: cool)
                    }
                    if let bullpens = report.bullpenFatigue, !bullpens.isEmpty {
                        bullpenCard(bullpens: bullpens)
                    }
                    if let storms = report.perfectStormMatchups, !storms.isEmpty {
                        perfectStormCard(storms)
                    }
                    if let weather = report.weatherParkFlags, !weather.isEmpty {
                        weatherFlagsCard(weather)
                    }
                    if let splits = report.lrSplitsToday, !splits.isEmpty {
                        lrSplitsCard(splits)
                    }
                    Spacer().frame(height: 40)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
        } else if let msg = store.errorMessage {
            ContentUnavailableView {
                Label("Failed to load", systemImage: "exclamationmark.triangle")
            } description: {
                Text(msg)
            } actions: {
                Button("Retry") { Task { await store.refresh() } }
                    .buttonStyle(.borderedProminent)
            }
        } else {
            ContentUnavailableView {
                Label("No report today", systemImage: "doc.text")
            } description: {
                Text("Daily MLB regression report hasn't generated yet — check back after first pitch.")
            }
        }
    }

    // MARK: - Sub-cards

    @ViewBuilder
    private func headerCard(report: MLBRegressionReport) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "chart.bar.xaxis")
                    .foregroundStyle(Color(hex: 0xA855F7))
                Text("MLB Daily Regression")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                if let model = report.narrativeModel {
                    Text(model)
                        .font(.system(size: 10, weight: .medium))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.appPrimary.opacity(0.15), in: RoundedRectangle(cornerRadius: 6))
                        .foregroundStyle(Color.appPrimary)
                }
            }
            Text(report.reportDate)
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
            if let generatedAt = report.generatedAt {
                Text("Updated \(timeAgo(generatedAt))")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.appTextMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.appBorder, lineWidth: 1))
    }

    @ViewBuilder
    private func narrativeCard(_ text: String) -> some View {
        sectionCard(title: "Today's Narrative", icon: "text.alignleft", iconColor: Color.appPrimary) {
            Text(text)
                .font(.system(size: 13))
                .lineSpacing(4)
                .foregroundStyle(Color.appTextPrimary)
        }
    }

    @ViewBuilder
    private func recapCard(_ items: [MLBYesterdayRecap]) -> some View {
        sectionCard(title: "Yesterday's Recap", icon: "clock.arrow.circlepath", iconColor: Color(hex: 0x3B82F6)) {
            VStack(spacing: 8) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.matchup)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                            Text("\(betTypeShort(item.betType)) · \(item.pick)")
                                .font(.system(size: 11))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                        Spacer()
                        Text(item.result.uppercased())
                            .font(.system(size: 10, weight: .bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(resultColor(item.result).opacity(0.18), in: RoundedRectangle(cornerRadius: 6))
                            .foregroundStyle(resultColor(item.result))
                        Text(item.actualScore)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    .padding(10)
                    .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 10))
                }
            }
        }
    }

    @ViewBuilder
    private func cumulativeCard(_ record: MLBCumulativeRecord) -> some View {
        sectionCard(title: "Season Performance", icon: "trophy", iconColor: Color(hex: 0xEAB308)) {
            VStack(spacing: 10) {
                HStack {
                    statCell(label: "Wins", value: "\(record.total.wins)", color: Color.appPrimary)
                    statCell(label: "Losses", value: "\(record.total.losses)", color: Color.appAccentRed)
                    statCell(label: "Pushes", value: "\(record.total.pushes)", color: Color(hex: 0xEAB308))
                }
                HStack {
                    statCell(label: "Win %", value: String(format: "%.1f%%", record.total.winPct), color: winPctColor(record.total.winPct))
                    statCell(label: "Units", value: signed(record.total.unitsWon), color: record.total.unitsWon >= 0 ? Color.appPrimary : Color.appAccentRed)
                    statCell(label: "ROI", value: String(format: "%.1f%%", record.total.roiPct), color: record.total.roiPct >= 0 ? Color.appPrimary : Color.appAccentRed)
                }
            }
        }
    }

    @ViewBuilder
    private func picksCard(_ picks: [MLBSuggestedPick]) -> some View {
        sectionCard(title: "Suggested Picks (\(picks.count))", icon: "checkmark.seal", iconColor: Color.appPrimary) {
            VStack(spacing: 10) {
                ForEach(picks) { pick in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(pick.matchup)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Color.appTextSecondary)
                            Spacer()
                            Text(betTypeShort(pick.betType))
                                .font(.system(size: 10, weight: .bold))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.appPrimary.opacity(0.15), in: RoundedRectangle(cornerRadius: 6))
                                .foregroundStyle(Color.appPrimary)
                        }
                        Text(pick.pick)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                        HStack(spacing: 12) {
                            inlineLabel("Edge", "\(pick.edgeAtSuggestion >= 0 ? "+" : "")\(String(format: "%g", pick.edgeAtSuggestion))")
                            inlineLabel("Bucket", pick.edgeBucket)
                            inlineLabel("Win%", String(format: "%.0f%%", pick.bucketWinPct))
                            Spacer()
                            Text(pick.confidenceAtSuggestion.uppercased())
                                .font(.system(size: 9, weight: .bold))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    (pick.confidenceAtSuggestion == "high" ? Color.appPrimary : Color(hex: 0xF59E0B))
                                        .opacity(0.18),
                                    in: RoundedRectangle(cornerRadius: 5)
                                )
                                .foregroundStyle(pick.confidenceAtSuggestion == "high" ? Color.appPrimary : Color(hex: 0xF59E0B))
                        }
                    }
                    .padding(10)
                    .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 10))
                }
            }
        }
    }

    @ViewBuilder
    private func pitcherRegressionCard(title: String, iconColor: Color, pitchers: [MLBPitcherRegression]) -> some View {
        sectionCard(title: title, icon: "person.fill", iconColor: iconColor) {
            VStack(spacing: 10) {
                ForEach(Array(pitchers.enumerated()), id: \.offset) { _, p in
                    pitcherRow(p)
                }
            }
        }
    }

    @ViewBuilder
    private func pitcherRow(_ p: MLBPitcherRegression) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(p.pitcherName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                Text(p.teamName)
                    .font(.system(size: 10, weight: .medium))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 4))
                    .foregroundStyle(Color.appTextSecondary)
                Text(p.severity.uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(severityColor(p.severity).opacity(0.18), in: RoundedRectangle(cornerRadius: 5))
                    .foregroundStyle(severityColor(p.severity))
            }
            HStack(spacing: 12) {
                inlineLabel("ERA", String(format: "%.2f", p.era))
                inlineLabel("xFIP", String(format: "%.2f", p.xfip))
                inlineLabel("Δ", String(format: "%+.2f", p.eraMinusXfip))
                if let l3 = p.l3Era {
                    inlineLabel("L3 ERA", String(format: "%.2f", l3))
                }
            }
        }
        .padding(10)
        .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private func battingCard(title: String, iconColor: Color, teams: [MLBBattingRegression]) -> some View {
        sectionCard(title: title, icon: "chart.line.uptrend.xyaxis", iconColor: iconColor) {
            VStack(spacing: 10) {
                ForEach(Array(teams.enumerated()), id: \.offset) { _, t in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(t.teamName)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.appTextPrimary)
                        HStack(spacing: 12) {
                            if let woba = t.woba {
                                inlineLabel("wOBA", String(format: "%.3f", woba))
                            }
                            if let xwoba = t.xwobacon {
                                inlineLabel("xwOBACon", String(format: "%.3f", xwoba))
                            }
                            if let hardHit = t.hardHitPct {
                                inlineLabel("HardHit%", String(format: "%.1f%%", hardHit))
                            }
                            if let barrel = t.barrelPct {
                                inlineLabel("Barrel%", String(format: "%.1f%%", barrel))
                            }
                        }
                    }
                    .padding(10)
                    .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 10))
                }
            }
        }
    }

    @ViewBuilder
    private func bullpenCard(bullpens: [MLBBullpenFatigue]) -> some View {
        sectionCard(title: "Bullpen Fatigue", icon: "flame", iconColor: Color(hex: 0xF97316)) {
            VStack(spacing: 10) {
                ForEach(Array(bullpens.enumerated()), id: \.offset) { _, b in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(b.teamName)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                            Spacer()
                            Text(b.flag.uppercased())
                                .font(.system(size: 9, weight: .bold))
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(severityColor(b.flag).opacity(0.18), in: RoundedRectangle(cornerRadius: 5))
                                .foregroundStyle(severityColor(b.flag))
                        }
                        HStack(spacing: 12) {
                            inlineLabel("IP L3D", String(format: "%.1f", b.bpIpLast3d))
                            inlineLabel("IP L5D", String(format: "%.1f", b.bpIpLast5d))
                            inlineLabel("IP L7D", String(format: "%.1f", b.bpIpLast7d))
                        }
                    }
                    .padding(10)
                    .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 10))
                }
            }
        }
    }

    @ViewBuilder
    private func perfectStormCard(_ storms: [MLBPerfectStorm]) -> some View {
        sectionCard(title: "Perfect Storm Matchups", icon: "cloud.bolt", iconColor: Color(hex: 0xA855F7)) {
            VStack(spacing: 10) {
                ForEach(Array(storms.enumerated()), id: \.offset) { _, s in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(s.matchup)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                            Spacer()
                            Text(s.direction.uppercased())
                                .font(.system(size: 9, weight: .bold))
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(directionColor(s.direction).opacity(0.18), in: RoundedRectangle(cornerRadius: 5))
                                .foregroundStyle(directionColor(s.direction))
                            Text(String(format: "%.1f", s.stormScore))
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Color(hex: 0xA855F7))
                        }
                        if !s.narrative.isEmpty {
                            Text(s.narrative)
                                .font(.system(size: 12))
                                .lineSpacing(2)
                                .foregroundStyle(Color.appTextSecondary)
                        }
                    }
                    .padding(10)
                    .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 10))
                }
            }
        }
    }

    @ViewBuilder
    private func weatherFlagsCard(_ flags: [MLBWeatherParkFlag]) -> some View {
        sectionCard(title: "Weather / Park Flags", icon: "cloud.sun", iconColor: Color(hex: 0x06B6D4)) {
            VStack(spacing: 10) {
                ForEach(Array(flags.enumerated()), id: \.offset) { _, f in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(f.matchup)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                            Spacer()
                            Text(f.venue)
                                .font(.system(size: 11))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                        if !f.flags.isEmpty {
                            FlowLayout(spacing: 6) {
                                ForEach(f.flags, id: \.self) { flag in
                                    Text(flag)
                                        .font(.system(size: 10, weight: .medium))
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(Color(hex: 0x06B6D4).opacity(0.15), in: RoundedRectangle(cornerRadius: 6))
                                        .foregroundStyle(Color(hex: 0x06B6D4))
                                }
                            }
                        }
                    }
                    .padding(10)
                    .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 10))
                }
            }
        }
    }

    @ViewBuilder
    private func lrSplitsCard(_ splits: [MLBLRSplitEntry]) -> some View {
        sectionCard(title: "L/R Splits Today", icon: "scale.3d", iconColor: Color(hex: 0x6366F1)) {
            VStack(spacing: 10) {
                ForEach(Array(splits.enumerated()), id: \.offset) { _, s in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(s.teamName)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                            Text("vs \(s.opponent) (\(s.opponentSpHand))")
                                .font(.system(size: 11))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(String(format: "%.1f F5 R", s.avgF5Runs))
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(s.isNotable ? Color.appPrimary : Color.appTextPrimary)
                            Text("\(s.f5Wins)-\(s.f5Losses) (\(s.f5Games)g)")
                                .font(.system(size: 10))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                    }
                    .padding(10)
                    .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 10))
                }
            }
        }
    }

    // MARK: - Shared chrome

    @ViewBuilder
    private func sectionCard<Content: View>(title: String, icon: String, iconColor: Color, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundStyle(iconColor)
                Text(title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            content()
        }
        .padding(16)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.appBorder, lineWidth: 1))
    }

    @ViewBuilder
    private func statCell(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 20, weight: .heavy))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func inlineLabel(_ label: String, _ value: String) -> some View {
        HStack(spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
        }
    }

    // MARK: - Helpers

    private func betTypeShort(_ bt: String) -> String {
        switch bt {
        case "full_ml": return "Full ML"
        case "full_ou": return "Full O/U"
        case "f5_ml": return "F5 ML"
        case "f5_ou": return "F5 O/U"
        default: return bt
        }
    }

    private func resultColor(_ result: String) -> Color {
        switch result.lowercased() {
        case "won": return Color.appPrimary
        case "lost": return Color.appAccentRed
        default: return Color(hex: 0xEAB308)
        }
    }

    /// Mirrors RN `severityColor` — severe red, moderate amber, else green.
    private func severityColor(_ s: String) -> Color {
        switch s.lowercased() {
        case "severe", "heavy", "high": return Color.appAccentRed
        case "moderate", "medium": return Color(hex: 0xF59E0B)
        default: return Color.appPrimary
        }
    }

    private func directionColor(_ s: String) -> Color {
        s.uppercased().contains("OVER") ? Color.appPrimary : Color(hex: 0x3B82F6)
    }

    /// Mirrors RN `winPctColor`: tiered green / amber / orange / red.
    private func winPctColor(_ pct: Double) -> Color {
        if pct >= 65 { return Color.appPrimary }
        if pct >= 55 { return Color(hex: 0xEAB308) }
        if pct >= 50 { return Color(hex: 0xF97316) }
        return Color.appAccentRed
    }

    private func signed(_ value: Double) -> String {
        value >= 0 ? "+\(String(format: "%.2f", value))" : String(format: "%.2f", value)
    }

    /// Mirrors RN `timeAgo`.
    private func timeAgo(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: iso) ?? {
            formatter.formatOptions = [.withInternetDateTime]
            return formatter.date(from: iso)
        }()
        guard let date else { return "" }
        let diff = Date().timeIntervalSince(date)
        let mins = Int(diff / 60)
        if mins < 1 { return "just now" }
        if mins < 60 { return "\(mins)m ago" }
        let hrs = mins / 60
        return "\(hrs)h \(mins % 60)m ago"
    }
}

/// Lightweight flow layout for the weather flags pill row.
/// Mirrors RN's natural-wrap pill cluster.
private struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            totalHeight = y + rowHeight
        }
        return CGSize(width: maxWidth == .infinity ? x : maxWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var rowHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
