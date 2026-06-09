import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// MLB Regression Report screen, pushed from the Outliers hub. Ports
/// `wagerproof-mobile/app/(drawer)/(tabs)/mlb-regression-report.tsx` —
/// the largest of the deferred Outliers screens (~1900 LoC in RN). Sections
/// are conditional: each only renders when the report has the corresponding
/// payload. Order mirrors RN exactly:
///   1. AI Analysis Summary (narrative_text)
///   2. Yesterday's Results (yesterday_recap)
///   3. Model Accuracy (bucket accuracy store)
///   4. Today's Suggested Picks
///   5. Starting Pitcher Regression (negative + positive)
///   6. Team Batting Regression (heat up + cool down)
///   7. Bullpen Fatigue & Trends
///   8. L/R Pitcher Splits
///   9. Perfect Storm Matchups
///   10. Weather & Park Impact
///
/// Both the report itself and the bucket accuracy table need to hydrate
/// before the screen is fully populated — they run in parallel via
/// `.task` so cold-start is one network round trip.
struct MLBRegressionReportView: View {
    @State private var reportStore = MLBRegressionReportStore()
    @State private var bucketStore = MLBBucketAccuracyStore()
    @State private var accuracyTab: String = "full_ml"

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16, pinnedViews: [.sectionHeaders]) {
                if let report = reportStore.report {
                    if let date = formattedReportDate(report.reportDate) {
                        Text(date.uppercased())
                            .font(.system(size: 11, weight: .bold))
                            .tracking(1.2)
                            .foregroundStyle(Color.appTextSecondary)
                            .padding(.horizontal, Spacing.lg)
                            .padding(.top, Spacing.md)
                    }

                    if let narrative = report.narrativeText, !narrative.isEmpty {
                        Section {
                            narrativeBody(narrative).padding(.horizontal, Spacing.lg)
                        } header: {
                            sectionHeader("AI Analysis Summary", icon: "bolt.fill", color: Color(hex: 0xA855F7))
                        }
                    }

                    if let recap = report.yesterdayRecap, !recap.isEmpty || report.cumulativeRecord != nil {
                        Section {
                            recapBody(recap: recap, cumulative: report.cumulativeRecord).padding(.horizontal, Spacing.lg)
                        } header: {
                            sectionHeader("Yesterday's Results", icon: "trophy.fill", color: Color(hex: 0xEAB308))
                        }
                    }

                    Section {
                        accuracyBody.padding(.horizontal, Spacing.lg)
                    } header: {
                        sectionHeader("Model Accuracy", icon: "chart.bar.fill", color: Color(hex: 0x3B82F6))
                    }

                    let picks = report.suggestedPicks ?? []
                    Section {
                        picksBody(picks: picks).padding(.horizontal, Spacing.lg)
                    } header: {
                        sectionHeader(
                            "Today's Suggested Picks",
                            icon: "target",
                            color: Color(hex: 0x22C55E),
                            countBadge: picks.isEmpty ? nil : picks.count
                        )
                    }

                    let negativePitchers = report.pitcherNegativeRegression ?? []
                    let positivePitchers = report.pitcherPositiveRegression ?? []
                    if !negativePitchers.isEmpty || !positivePitchers.isEmpty {
                        Section {
                            pitcherRegressionBody(negative: negativePitchers, positive: positivePitchers).padding(.horizontal, Spacing.lg)
                        } header: {
                            sectionHeader("Starting Pitcher Regression", icon: "flame.fill", color: Color(hex: 0xF97316))
                        }
                    }

                    let heatUp = report.battingHeatUp ?? []
                    let coolDown = report.battingCoolDown ?? []
                    if !heatUp.isEmpty || !coolDown.isEmpty {
                        Section {
                            battingRegressionBody(heatUp: heatUp, coolDown: coolDown).padding(.horizontal, Spacing.lg)
                        } header: {
                            sectionHeader("Team Batting Regression", icon: "chart.line.uptrend.xyaxis", color: Color(hex: 0x3B82F6))
                        }
                    }

                    if let bullpens = report.bullpenFatigue, !bullpens.isEmpty {
                        Section {
                            bullpenBody(bullpens).padding(.horizontal, Spacing.lg)
                        } header: {
                            sectionHeader("Bullpen Fatigue & Trends", icon: "shield.lefthalf.filled", color: Color(hex: 0xA855F7))
                        }
                    }

                    if let splits = report.lrSplitsToday, !splits.isEmpty {
                        Section {
                            lrSplitsBody(splits).padding(.horizontal, Spacing.lg)
                        } header: {
                            sectionHeader("L/R Pitcher Splits", icon: "scope", color: Color(hex: 0x6366F1))
                        }
                    }

                    if let storms = report.perfectStormMatchups, !storms.isEmpty {
                        Section {
                            perfectStormBody(storms).padding(.horizontal, Spacing.lg)
                        } header: {
                            sectionHeader("Perfect Storm Matchups", icon: "cloud.bolt.fill", color: Color(hex: 0xEAB308))
                        }
                    }

                    if let weather = report.weatherParkFlags, !weather.isEmpty {
                        Section {
                            weatherBody(weather).padding(.horizontal, Spacing.lg)
                        } header: {
                            sectionHeader("Weather & Park Impact", icon: "wind", color: Color(hex: 0x06B6D4))
                        }
                    }
                } else if reportStore.loading {
                    loadingState
                } else if reportStore.errorMessage != nil {
                    errorState
                } else {
                    noReportState
                }
            }
            .padding(.bottom, Spacing.xxl)
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle("MLB Regression Report")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task {
                        await reportStore.refresh()
                        await bucketStore.refresh()
                    }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .tint(Color.appPrimary)
                .accessibilityLabel("Refresh")
            }
        }
        .refreshable {
            await reportStore.refresh()
            await bucketStore.refresh()
        }
        .task {
            // Hydrate both stores in parallel — they don't depend on each
            // other and the screen needs both to render the accuracy section.
            async let r: () = reportStore.refreshIfStale()
            async let b: () = bucketStore.refreshIfStale()
            _ = await (r, b)
        }
    }

    // MARK: - Section scaffolding

    /// Pinned section header — same pattern as the rest of the app's
    /// large-title scrolling lists. `sectionHeaders` is set on the parent
    /// LazyVStack so the title pins to the safe-area edge as the user
    /// scrolls past it.
    private func sectionHeader(_ title: String, icon: String, color: Color, countBadge: Int? = nil) -> some View {
        HStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 7).fill(color.opacity(0.15))
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 24, height: 24)

            Text(title)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)

            Spacer()

            if let count = countBadge {
                Text("\(count)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.vertical, 10)
        .background(Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.appBorder.opacity(0.5))
                .frame(height: 0.5)
        }
    }

    // MARK: - Narrative

    private func narrativeBody(_ text: String) -> some View {
        // We render plain-formatted markdown text — SwiftUI's `Text` supports
        // basic AttributedString markdown via `try? AttributedString(markdown:)`.
        let attributed = (try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
            ?? AttributedString(text)
        return Text(attributed)
            .font(.system(size: 14))
            .lineSpacing(5)
            .foregroundStyle(Color.appTextPrimary)
            .padding(.vertical, 12)
    }

    // MARK: - Recap

    @ViewBuilder
    private func recapBody(recap: [MLBYesterdayRecap], cumulative: MLBCumulativeRecord?) -> some View {
        let wins = recap.filter { $0.result == "won" }.count
        let losses = recap.filter { $0.result == "lost" }.count
        let pushes = recap.filter { $0.result == "push" }.count
        let total = wins + losses
        let yPct = total > 0 ? Double(wins) / Double(total) * 100 : 0
        let yRecord = pushes > 0 ? "\(wins)-\(losses)-\(pushes)" : "\(wins)-\(losses)"

        VStack(spacing: 12) {
            HStack(spacing: 10) {
                heroTile(
                    label: "YESTERDAY",
                    primary: yRecord,
                    secondary: total > 0 ? "\(Int(yPct))% win rate" : "No graded picks",
                    secondaryColor: total > 0 ? winPctColor(yPct) : Color.appTextSecondary
                )
                if let cum = cumulative?.total {
                    let cumRecord = cum.pushes > 0 ? "\(cum.wins)-\(cum.losses)-\(cum.pushes)" : "\(cum.wins)-\(cum.losses)"
                    let unitsLabel = (cum.unitsWon >= 0 ? "+" : "") + String(format: "%.2fu", cum.unitsWon)
                    let roiLabel = (cum.roiPct >= 0 ? "+" : "") + String(format: "%.1f%%", cum.roiPct)
                    heroTile(
                        label: "ALL-TIME",
                        primary: cumRecord,
                        secondary: "\(unitsLabel) · \(roiLabel)",
                        secondaryColor: cum.unitsWon >= 0 ? Color(hex: 0x22C55E) : Color(hex: 0xEF4444)
                    )
                }
            }

            if recap.isEmpty {
                Text("No picks graded yesterday.")
                    .font(.system(size: 12)).italic()
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(.top, 8)
            } else {
                VStack(spacing: 6) {
                    ForEach(Array(recap.enumerated()), id: \.offset) { _, r in
                        let bar = r.result == "won" ? Color(hex: 0x22C55E)
                                : r.result == "lost" ? Color(hex: 0xEF4444)
                                : Color(hex: 0x6B7280)
                        accentRow(color: bar) {
                            HStack(alignment: .center, spacing: 10) {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(r.pick)
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundStyle(Color.appTextPrimary)
                                        .lineLimit(1)
                                    Text(r.matchup)
                                        .font(.system(size: 11))
                                        .foregroundStyle(Color.appTextSecondary)
                                        .lineLimit(1)
                                }
                                Spacer(minLength: 0)
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text(r.actualScore)
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundStyle(Color.appTextPrimary)
                                    Text(r.result.uppercased())
                                        .font(.system(size: 10, weight: .heavy))
                                        .tracking(0.5)
                                        .foregroundStyle(bar)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Accuracy

    @ViewBuilder
    private var accuracyBody: some View {
        if bucketStore.loading && bucketStore.data == nil {
            accuracySkeleton
                .padding(.vertical, 12)
                .transition(.opacity)
        } else if let acc = bucketStore.data {
            let betTypes: [(String, String)] = [
                ("full_ml", "Full ML"), ("full_ou", "Full O/U"),
                ("f5_ml", "F5 ML"), ("f5_ou", "F5 O/U")
            ]

            VStack(spacing: 14) {
                // 2x2 tile grid summarizing overall accuracy per bet type.
                let columns = [GridItem(.flexible()), GridItem(.flexible())]
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(betTypes, id: \.0) { (key, label) in
                        let bt = acc.betType(key)
                        accuracyTile(label: label, tally: bt.overall)
                    }
                }

                // Segmented selector + bucket table for the active bet type.
                segmented(
                    options: betTypes.map { ($0.0, $0.1) },
                    selection: $accuracyTab
                )

                let buckets = acc.betType(accuracyTab).byBucket
                    .filter { $0.games >= 3 }
                    .sorted { $0.winPct > $1.winPct }

                if buckets.isEmpty {
                    Text("No buckets with 3+ graded games yet.")
                        .font(.system(size: 12)).italic()
                        .foregroundStyle(Color.appTextSecondary)
                        .padding(.top, 4)
                } else {
                    bucketTable(buckets: buckets)
                }
            }
            .padding(.vertical, 12)
        }
    }

    /// Skeleton for `accuracyBody` while the bucket store hydrates: 2x2 tile
    /// grid + segmented bar + a few bucket-table rows. Inner placeholders
    /// shimmer; tile/row chrome stays solid.
    private var accuracySkeleton: some View {
        VStack(spacing: 14) {
            let columns = [GridItem(.flexible()), GridItem(.flexible())]
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(0..<4, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: 4) {
                        SkeletonBlock(width: 60, height: 9)
                        SkeletonBlock(width: 80, height: 24)
                        SkeletonBlock(width: 50, height: 11)
                        SkeletonBlock(width: 100, height: 10)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .shimmering()
                    .background(Color.appSurfaceMuted.opacity(0.4), in: RoundedRectangle(cornerRadius: 14))
                }
            }

            SkeletonBlock(height: 34, cornerRadius: 10)
                .shimmering()

            VStack(spacing: 4) {
                ForEach(0..<4, id: \.self) { _ in
                    HStack {
                        SkeletonBlock(width: 120, height: 12).frame(maxWidth: .infinity, alignment: .leading)
                        SkeletonBlock(width: 44, height: 12).frame(width: 62, alignment: .trailing)
                        SkeletonBlock(width: 34, height: 12).frame(width: 48, alignment: .trailing)
                        SkeletonBlock(width: 40, height: 12).frame(width: 56, alignment: .trailing)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .shimmering()
                    .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 8))
                }
            }
        }
    }

    // MARK: - Picks

    @ViewBuilder
    private func picksBody(picks: [MLBSuggestedPick]) -> some View {
        if picks.isEmpty {
            Text("No picks meet the confidence threshold for today's slate.")
                .font(.system(size: 12)).italic()
                .foregroundStyle(Color.appTextSecondary)
                .padding(.vertical, 12)
        } else {
            VStack(spacing: 10) {
                ForEach(picks) { pick in
                    let conf: Color = pick.confidenceAtSuggestion == "high" ? Color(hex: 0x22C55E) : Color(hex: 0xF59E0B)
                    accentRow(color: conf, dim: pick.locked ?? false) {
                        pickRow(pick: pick, conf: conf)
                    }
                }
            }
            .padding(.vertical, 12)
        }
    }

    @ViewBuilder
    private func pickRow(pick: MLBSuggestedPick, conf: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 8) {
                Text(pick.pick)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(2)
                Spacer()
                if let timeLabel = formatGameTimeShort(pick.gameTimeEt) {
                    HStack(spacing: 3) {
                        Image(systemName: "clock")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                        Text(timeLabel)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }
            }
            Text("\(pick.awayTeam) @ \(pick.homeTeam)")
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
                .lineLimit(1)

            HStack(spacing: 8) {
                statCell(label: "EDGE", value: edgeText(pick))
                statCell(label: "BUCKET", value: isPerfectStorm(pick) ? "Perfect Storm" : pick.edgeBucket)
                statCell(
                    label: "BUCKET W%",
                    value: bucketPctText(pick),
                    color: bucketPctColor(pick)
                )
            }

            if let reasoning = pick.reasoning, !reasoning.isEmpty {
                Text(reasoning)
                    .font(.system(size: 12))
                    .italic()
                    .lineSpacing(3)
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.appSurfaceMuted.opacity(0.5))
                    .overlay(
                        Rectangle()
                            .fill(conf)
                            .frame(width: 2)
                            .frame(maxHeight: .infinity, alignment: .leading)
                        , alignment: .leading
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            HStack(spacing: 6) {
                pill(text: betTypeLabel(pick.betType), color: conf)
                pill(text: "\(pick.confidenceAtSuggestion.uppercased()) CONF", color: conf)
                if pick.locked == true {
                    HStack(spacing: 3) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 9))
                        Text("LOCKED")
                            .font(.system(size: 9, weight: .bold))
                            .tracking(0.5)
                    }
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                }
            }
        }
    }

    // MARK: - Pitcher / Batting / Bullpen / Splits / Storms / Weather bodies

    @ViewBuilder
    private func pitcherRegressionBody(negative: [MLBPitcherRegression], positive: [MLBPitcherRegression]) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            if !negative.isEmpty {
                groupLabel("DUE FOR NEGATIVE REGRESSION", count: negative.count, color: Color(hex: 0xEF4444), note: "ERA too low vs xFIP — been lucky")
                ForEach(Array(negative.enumerated()), id: \.offset) { _, p in
                    pitcherRow(p)
                }
            }
            if !positive.isEmpty {
                groupLabel("DUE FOR POSITIVE REGRESSION", count: positive.count, color: Color(hex: 0x22C55E), note: "ERA too high vs xFIP — been unlucky")
                ForEach(Array(positive.enumerated()), id: \.offset) { _, p in
                    pitcherRow(p)
                }
            }
        }
        .padding(.vertical, 12)
    }

    @ViewBuilder
    private func pitcherRow(_ p: MLBPitcherRegression) -> some View {
        let sev = severityColor(p.severity)
        accentRow(color: sev) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(p.pitcherName)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                        if let opponent = p.opponent {
                            Text("vs \(opponent) · \(p.teamName)")
                                .font(.system(size: 11))
                                .foregroundStyle(Color.appTextSecondary)
                        } else {
                            Text(p.teamName)
                                .font(.system(size: 11))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                    }
                    Spacer()
                    pill(text: p.severity.uppercased(), color: sev)
                }
                HStack(spacing: 10) {
                    stat(label: "ERA", value: String(format: "%.2f", p.era))
                    stat(label: "xFIP", value: String(format: "%.2f", p.xfip))
                    stat(label: "GAP", value: signed(p.eraMinusXfip, decimals: 2), color: gapColor(p.eraMinusXfip))
                    stat(label: "xwOBA", value: p.xwoba.map { String(format: "%.3f", $0) } ?? "—")
                }
                HStack(spacing: 10) {
                    stat(label: "WHIP", value: p.whip.map { String(format: "%.2f", $0) } ?? "—")
                    stat(label: "K%", value: p.kPct.map { String(format: "%.1f%%", $0) } ?? "—")
                    stat(label: "BB%", value: p.bbPct.map { String(format: "%.1f%%", $0) } ?? "—")
                    stat(label: "xFIP L3", value: p.trendXfip.map { signed($0, decimals: 2) } ?? "—",
                         color: p.trendXfip.flatMap { trendColor($0, posIsBad: true) })
                }
            }
        }
    }

    @ViewBuilder
    private func battingRegressionBody(heatUp: [MLBBattingRegression], coolDown: [MLBBattingRegression]) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            if !heatUp.isEmpty {
                groupLabel("DUE TO HEAT UP", count: heatUp.count, color: Color(hex: 0x22C55E), note: "Low BABIP + strong contact quality")
                ForEach(Array(heatUp.enumerated()), id: \.offset) { _, t in
                    battingRow(t)
                }
            }
            if !coolDown.isEmpty {
                groupLabel("DUE TO COOL DOWN", count: coolDown.count, color: Color(hex: 0xEF4444), note: "High BABIP + weak contact quality")
                ForEach(Array(coolDown.enumerated()), id: \.offset) { _, t in
                    battingRow(t)
                }
            }
        }
        .padding(.vertical, 12)
    }

    @ViewBuilder
    private func battingRow(_ t: MLBBattingRegression) -> some View {
        let sev = severityColor(t.severity)
        accentRow(color: sev) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(t.teamName)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                        Text("\(t.games)G sample")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    Spacer()
                    if let severity = t.severity {
                        pill(text: severity.uppercased(), color: sev)
                    }
                }
                HStack(spacing: 10) {
                    stat(label: "wOBA", value: t.woba.map { String(format: "%.3f", $0) } ?? "—")
                    stat(label: "BABIP", value: String(format: "%.3f", t.babip))
                    stat(label: "xwOBACon", value: t.xwobacon.map { String(format: "%.3f", $0) } ?? "—")
                    stat(label: "GAP", value: t.wobaGap.map { signed($0, decimals: 3) } ?? "—",
                         color: t.wobaGap.flatMap { bg in
                             if bg > 0.03 { return Color(hex: 0xEF4444) }
                             if bg < -0.03 { return Color(hex: 0x22C55E) }
                             return nil
                         })
                }
                HStack(spacing: 10) {
                    stat(label: "HH%", value: t.hardHitPct.map { String(format: "%.1f%%", $0 * 100) } ?? "—")
                    stat(label: "BARREL%", value: t.barrelPct.map { String(format: "%.1f%%", $0 * 100) } ?? "—")
                    stat(label: "EV", value: t.avgEv.map { String(format: "%.1f", $0) } ?? "—")
                    stat(label: "xwC L5", value: t.trendXwobacon.map { signed($0, decimals: 3) } ?? "—",
                         color: t.trendXwobacon.flatMap { trendColor($0, posIsBad: false) })
                }
            }
        }
    }

    @ViewBuilder
    private func bullpenBody(_ bullpens: [MLBBullpenFatigue]) -> some View {
        VStack(spacing: 8) {
            ForEach(Array(bullpens.enumerated()), id: \.offset) { _, b in
                let color = b.flag == "overworked" ? Color(hex: 0xEF4444) : Color(hex: 0xF59E0B)
                accentRow(color: color) {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text(b.teamName)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(Color.appTextPrimary)
                            Spacer()
                            pill(text: b.flag == "overworked" ? "OVERWORKED" : "DECLINING", color: color)
                        }
                        HStack(spacing: 10) {
                            stat(label: "IP L3d", value: String(format: "%.1f", b.bpIpLast3d), color: b.bpIpLast3d >= 13 ? Color(hex: 0xEF4444) : nil)
                            stat(label: "IP L5d", value: String(format: "%.1f", b.bpIpLast5d), color: b.bpIpLast5d >= 22 ? Color(hex: 0xEF4444) : nil)
                            stat(label: "SEASON xFIP", value: b.seasonBpXfip.map { String(format: "%.2f", $0) } ?? "—")
                            stat(label: "TREND xFIP", value: b.trendBpXfip.map { signed($0, decimals: 2) } ?? "—",
                                 color: b.trendBpXfip.flatMap { trendColor($0, posIsBad: true) })
                        }
                    }
                }
            }
        }
        .padding(.vertical, 12)
    }

    @ViewBuilder
    private func lrSplitsBody(_ splits: [MLBLRSplitEntry]) -> some View {
        let notable = splits.filter { $0.isNotable }
        let rest = splits.filter { !$0.isNotable }

        VStack(alignment: .leading, spacing: 16) {
            if !notable.isEmpty {
                groupLabel("NOTABLE MATCHUPS", count: notable.count, color: Color(hex: 0x6366F1), note: "Favorable or difficult splits worth flagging")
                VStack(spacing: 8) {
                    ForEach(Array(notable.enumerated()), id: \.offset) { _, s in
                        splitRow(s, notable: true)
                    }
                }
            }
            if !rest.isEmpty {
                groupLabel("ALL OTHER SPLITS", count: rest.count, color: nil, note: nil)
                VStack(spacing: 6) {
                    ForEach(Array(rest.enumerated()), id: \.offset) { _, s in
                        splitRow(s, notable: false)
                    }
                }
            }
        }
        .padding(.vertical, 12)
    }

    @ViewBuilder
    private func splitRow(_ s: MLBLRSplitEntry, notable: Bool) -> some View {
        let record = s.f5Ties > 0 ? "F5 \(s.f5Wins)-\(s.f5Losses)-\(s.f5Ties)" : "F5 \(s.f5Wins)-\(s.f5Losses)"
        let winColor: Color = {
            guard let pct = s.f5WinPct else { return Color.appTextPrimary }
            if pct >= 60 { return Color(hex: 0x22C55E) }
            if pct <= 40 { return Color(hex: 0xEF4444) }
            return Color.appTextPrimary
        }()
        accentRow(color: notable ? Color(hex: 0x6366F1) : .clear) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 4) {
                        Text(s.teamName)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                        Text(s.facing)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    Text("vs \(s.opponentSp ?? s.opponent) (\(s.opponentSpHand)HP)")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(String(format: "%.1f R/G", s.avgF5Runs))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text(record + (s.f5WinPct != nil ? "  \(Int(s.f5WinPct!))%" : ""))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(winColor)
                }
            }
        }
    }

    @ViewBuilder
    private func perfectStormBody(_ storms: [MLBPerfectStorm]) -> some View {
        VStack(spacing: 10) {
            ForEach(Array(storms.enumerated()), id: \.offset) { _, s in
                let direction = s.direction.uppercased().contains("RUNS") ? Color(hex: 0xEF4444) : Color(hex: 0x3B82F6)
                accentRow(color: Color(hex: 0xEAB308)) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .top, spacing: 8) {
                            Text(s.matchup)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(Color.appTextPrimary)
                                .lineLimit(2)
                            Spacer()
                            pill(text: s.direction, color: direction)
                        }
                        HStack(spacing: 5) {
                            Image(systemName: "bolt.fill")
                                .font(.system(size: 12))
                                .foregroundStyle(Color(hex: 0xEAB308))
                            Text("\(Int(s.stormScore.rounded()))")
                                .font(.system(size: 18, weight: .heavy))
                                .foregroundStyle(Color.appTextPrimary)
                            Text("/10")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Color.appTextSecondary)
                            Text("storm score")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Color.appTextSecondary)
                                .padding(.leading, 4)
                        }
                        Text(s.narrative)
                            .font(.system(size: 12))
                            .lineSpacing(3)
                            .foregroundStyle(Color.appTextPrimary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(hex: 0xEAB308).opacity(0.1))
                            .overlay(
                                Rectangle()
                                    .fill(Color(hex: 0xEAB308))
                                    .frame(width: 2)
                                    .frame(maxHeight: .infinity, alignment: .leading)
                                , alignment: .leading
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                }
            }
        }
        .padding(.vertical, 12)
    }

    @ViewBuilder
    private func weatherBody(_ flags: [MLBWeatherParkFlag]) -> some View {
        VStack(spacing: 8) {
            ForEach(Array(flags.enumerated()), id: \.offset) { _, f in
                HStack(alignment: .top, spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10).fill(Color(hex: 0x06B6D4).opacity(0.15))
                        Image(systemName: weatherIcon(for: f.flags))
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Color(hex: 0x06B6D4))
                    }
                    .frame(width: 40, height: 40)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(f.matchup)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                        Text(f.venue)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.appTextSecondary)
                        FlowLayout(spacing: 4) {
                            ForEach(Array(f.flags.enumerated()), id: \.offset) { _, flag in
                                Text(flag)
                                    .font(.system(size: 10, weight: .semibold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Color.appSurfaceMuted)
                                    .foregroundStyle(Color.appTextPrimary)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.appBorder, lineWidth: 1))
            }
        }
        .padding(.vertical, 12)
    }

    // MARK: - Primitives

    @ViewBuilder
    private func accentRow<Content: View>(color: Color, dim: Bool = false, @ViewBuilder content: () -> Content) -> some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(color)
                .frame(width: 3)
            content()
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.appSurfaceMuted.opacity(0.4))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .opacity(dim ? 0.6 : 1)
    }

    private func heroTile(label: String, primary: String, secondary: String, secondaryColor: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .tracking(1)
                .foregroundStyle(Color.appTextSecondary)
            Text(primary)
                .font(.system(size: 24, weight: .heavy))
                .tracking(-0.5)
                .foregroundStyle(Color.appTextPrimary)
            Text(secondary)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(secondaryColor)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.appSurfaceMuted.opacity(0.4), in: RoundedRectangle(cornerRadius: 14))
    }

    private func accuracyTile(label: String, tally: MLBBucketTally) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(1)
                .foregroundStyle(Color.appTextSecondary)
            Text(String(format: "%.1f%%", tally.winPct))
                .font(.system(size: 26, weight: .heavy))
                .tracking(-0.5)
                .foregroundStyle(winPctColor(tally.winPct))
            Text("\(tally.wins)-\(tally.games - tally.wins)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text(String(format: "%+.1f%% · %+.2fu", tally.roiPct, tally.unitsWon))
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(tally.unitsWon >= 0 ? Color(hex: 0x22C55E) : Color(hex: 0xEF4444))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.appSurfaceMuted.opacity(0.4), in: RoundedRectangle(cornerRadius: 14))
    }

    private func bucketTable(buckets: [MLBBucketBucket]) -> some View {
        VStack(spacing: 4) {
            HStack {
                Text("BUCKET")
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("RECORD")
                    .frame(width: 62, alignment: .trailing)
                Text("W%")
                    .frame(width: 48, alignment: .trailing)
                Text("ROI")
                    .frame(width: 56, alignment: .trailing)
            }
            .font(.system(size: 10, weight: .bold))
            .tracking(0.5)
            .foregroundStyle(Color.appTextSecondary)
            .padding(.horizontal, 10)
            .padding(.bottom, 4)

            ForEach(Array(buckets.enumerated()), id: \.offset) { _, b in
                let label = [b.bucket, b.side, b.favDog, b.direction].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " / ")
                HStack {
                    Text(label)
                        .font(.system(size: 12))
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .foregroundStyle(Color.appTextPrimary)
                    Text("\(b.wins)-\(b.games - b.wins)")
                        .font(.system(size: 12))
                        .frame(width: 62, alignment: .trailing)
                        .foregroundStyle(Color.appTextSecondary)
                    Text(String(format: "%.0f%%", b.winPct))
                        .font(.system(size: 12, weight: .bold))
                        .frame(width: 48, alignment: .trailing)
                        .foregroundStyle(winPctColor(b.winPct))
                    Text(String(format: "%+.1f%%", b.roiPct))
                        .font(.system(size: 12, weight: .semibold))
                        .frame(width: 56, alignment: .trailing)
                        .foregroundStyle(b.roiPct >= 0 ? Color(hex: 0x22C55E) : Color(hex: 0xEF4444))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    private func segmented(options: [(String, String)], selection: Binding<String>) -> some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.0) { (key, label) in
                let active = selection.wrappedValue == key
                Button {
                    selection.wrappedValue = key
                } label: {
                    Text(label)
                        .font(.system(size: 12, weight: active ? .bold : .medium))
                        .padding(.vertical, 7)
                        .frame(maxWidth: .infinity)
                        .background(active ? Color.appSurface : .clear, in: RoundedRectangle(cornerRadius: 8))
                        .foregroundStyle(active ? Color.appTextPrimary : Color.appTextSecondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 10))
    }

    private func statCell(label: String, value: String, color: Color = Color.appTextPrimary) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(color)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    private func stat(label: String, value: String, color: Color? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(color ?? Color.appTextPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func pill(text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .bold))
            .tracking(0.4)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .overlay(Capsule().stroke(color.opacity(0.55), lineWidth: 1))
            .clipShape(Capsule())
    }

    @ViewBuilder
    private func groupLabel(_ label: String, count: Int, color: Color?, note: String?) -> some View {
        HStack(spacing: 6) {
            if let color {
                Circle().fill(color).frame(width: 6, height: 6)
            }
            Text(label)
                .font(.system(size: 11, weight: .heavy))
                .tracking(0.8)
                .foregroundStyle(color ?? Color.appTextSecondary)
            Spacer()
            Text("\(count)")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextSecondary)
        }
        if let note {
            Text(note)
                .font(.system(size: 11)).italic()
                .foregroundStyle(Color.appTextSecondary)
                .padding(.top, -8)
        }
    }

    // MARK: - Loading / error / empty

    /// Skeleton mirroring the report's real chrome: a date label, then a couple
    /// of section blocks (pinned header + hero tiles / accent-stripe rows) which
    /// are the dominant repeating shapes across every section body. Inner
    /// placeholders shimmer; section-header + accentRow chrome stays solid.
    private var loadingState: some View {
        VStack(alignment: .leading, spacing: 16) {
            SkeletonBlock(width: 200, height: 11)
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .shimmering()

            // Recap-style section: header + two hero tiles + accent rows.
            sectionHeaderPlaceholder
            VStack(spacing: 12) {
                HStack(spacing: 10) {
                    heroTilePlaceholder
                    heroTilePlaceholder
                }
                ForEach(0..<3, id: \.self) { _ in accentRowPlaceholder(lines: 2) }
            }
            .padding(.horizontal, Spacing.lg)

            // Pitcher/batting-style section: header + stat-grid accent rows.
            sectionHeaderPlaceholder
            VStack(spacing: 8) {
                ForEach(0..<3, id: \.self) { _ in accentRowPlaceholder(lines: 3) }
            }
            .padding(.horizontal, Spacing.lg)
        }
        .transition(.opacity)
    }

    private var sectionHeaderPlaceholder: some View {
        HStack(spacing: 8) {
            SkeletonBlock(width: 24, height: 24, cornerRadius: 7)
            SkeletonBlock(width: 150, height: 14)
            Spacer()
        }
        .shimmering()
        .padding(.horizontal, Spacing.lg)
        .padding(.vertical, 10)
        .background(Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.appBorder.opacity(0.5)).frame(height: 0.5)
        }
    }

    private var heroTilePlaceholder: some View {
        VStack(alignment: .leading, spacing: 6) {
            SkeletonBlock(width: 70, height: 9)
            SkeletonBlock(width: 90, height: 22)
            SkeletonBlock(width: 80, height: 11)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .shimmering()
        .background(Color.appSurfaceMuted.opacity(0.4), in: RoundedRectangle(cornerRadius: 14))
    }

    /// Mirrors `accentRow`: a 3pt accent stripe + a stacked content body inside
    /// a 12pt muted surface. `lines` controls how many stat rows render.
    private func accentRowPlaceholder(lines: Int) -> some View {
        HStack(spacing: 0) {
            Rectangle().fill(Color.appSkeleton).frame(width: 3)
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        SkeletonBlock(width: 120, height: 13)
                        SkeletonBlock(width: 80, height: 10)
                    }
                    Spacer()
                    SkeletonCapsule(width: 56, height: 16)
                }
                ForEach(0..<max(0, lines - 1), id: \.self) { _ in
                    HStack(spacing: 10) {
                        ForEach(0..<4, id: \.self) { _ in
                            VStack(alignment: .leading, spacing: 3) {
                                SkeletonBlock(width: 34, height: 9)
                                SkeletonBlock(width: 44, height: 13)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .shimmering()
        }
        .background(Color.appSurfaceMuted.opacity(0.4))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var errorState: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color(hex: 0xEF4444))
            Text(reportStore.errorMessage ?? "Failed to load regression report.")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextPrimary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: 0xEF4444).opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: 0xEF4444).opacity(0.2), lineWidth: 1))
        .padding(.horizontal, Spacing.lg)
        .padding(.top, 40)
    }

    private var noReportState: some View {
        HStack(spacing: 10) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(Color.appTextSecondary)
            Text("No regression report available yet. Reports generate at 9 AM, 11 AM, and 4 PM ET.")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextPrimary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.appBorder, lineWidth: 1))
        .padding(.horizontal, Spacing.lg)
        .padding(.top, 40)
    }

    // MARK: - Formatting + colors

    private func formattedReportDate(_ reportDate: String) -> String? {
        // `report_date` is `yyyy-MM-dd`. Treat noon ET to avoid TZ-flip
        // rendering wrong day on the boundary (matches RN's `+T12:00:00` hack).
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        guard let d = fmt.date(from: reportDate) else { return nil }
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_US")
        out.timeZone = TimeZone(identifier: "America/New_York")
        out.dateFormat = "EEEE, MMMM d, yyyy"
        return out.string(from: d)
    }

    private func formatGameTimeShort(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        let result = GameCardFormatting.convertTimeToEST(raw)
        return result == raw ? nil : result
    }

    private func winPctColor(_ pct: Double) -> Color {
        if pct >= 65 { return Color(hex: 0x22C55E) }
        if pct >= 55 { return Color(hex: 0xEAB308) }
        if pct >= 50 { return Color(hex: 0xF97316) }
        return Color(hex: 0xEF4444)
    }

    private func severityColor(_ severity: String?) -> Color {
        switch severity {
        case "severe": return Color(hex: 0xEF4444)
        case "moderate": return Color(hex: 0xF59E0B)
        default: return Color(hex: 0x22C55E)
        }
    }

    private func gapColor(_ gap: Double) -> Color? {
        if gap > 0.5 { return Color(hex: 0xEF4444) }
        if gap < -0.5 { return Color(hex: 0x22C55E) }
        return nil
    }

    private func trendColor(_ value: Double, posIsBad: Bool) -> Color? {
        if posIsBad {
            // For pitcher xFIP: positive trend means rising xFIP → bad.
            if value > 0.3 { return Color(hex: 0xEF4444) }
            if value < -0.3 { return Color(hex: 0x22C55E) }
        } else {
            // For batting xwOBACon: positive trend means rising contact → good.
            if value > 0.015 { return Color(hex: 0x22C55E) }
            if value < -0.015 { return Color(hex: 0xEF4444) }
        }
        return nil
    }

    private func signed(_ value: Double, decimals: Int) -> String {
        let sign = value > 0 ? "+" : ""
        return sign + String(format: "%.\(decimals)f", value)
    }

    private func edgeText(_ pick: MLBSuggestedPick) -> String {
        let sign = pick.edgeAtSuggestion > 0 ? "+" : ""
        let suffix = pick.betType.hasSuffix("ml") ? "%" : ""
        // Edge values can be fractional or integral — preserve a single
        // decimal place when present to match RN's `toFixed(1)` for spreads.
        if pick.edgeAtSuggestion == pick.edgeAtSuggestion.rounded() {
            return "\(sign)\(Int(pick.edgeAtSuggestion))\(suffix)"
        }
        return "\(sign)\(String(format: "%.1f", pick.edgeAtSuggestion))\(suffix)"
    }

    private func isPerfectStorm(_ pick: MLBSuggestedPick) -> Bool {
        pick.edgeBucket.lowercased() == "perfect_storm"
    }

    private func bucketPctText(_ pick: MLBSuggestedPick) -> String {
        if isPerfectStorm(pick) {
            if let ps = bucketStore.data?.perfectStorm.overall, ps.games > 0 {
                return String(format: "%.0f%%", ps.winPct)
            }
            return "N/A"
        }
        return String(format: "%.0f%%", pick.bucketWinPct)
    }

    private func bucketPctColor(_ pick: MLBSuggestedPick) -> Color {
        if isPerfectStorm(pick) {
            if let ps = bucketStore.data?.perfectStorm.overall, ps.games > 0 {
                return winPctColor(ps.winPct)
            }
            return Color.appTextSecondary
        }
        return winPctColor(pick.bucketWinPct)
    }

    private func betTypeLabel(_ bt: String) -> String {
        switch bt {
        case "full_ml": return "Full ML"
        case "full_ou": return "Full O/U"
        case "f5_ml":   return "F5 ML"
        case "f5_ou":   return "F5 O/U"
        default:        return bt.uppercased()
        }
    }

    /// Pick a weather SF Symbol based on the flag strings — same heuristic
    /// as RN's `weatherIconForFlags`.
    private func weatherIcon(for flags: [String]) -> String {
        let joined = flags.joined(separator: " ").lowercased()
        if joined.contains("rain") { return "cloud.heavyrain.fill" }
        if joined.contains("wind") && joined.contains("out") { return "wind" }
        if joined.contains("wind") { return "wind" }
        if joined.contains("cold") || joined.contains("snow") { return "snowflake" }
        if joined.contains("hot") || joined.contains("heat") { return "sun.max.fill" }
        if joined.contains("dome") || joined.contains("roof") { return "house.fill" }
        if joined.contains("humid") { return "humidity.fill" }
        return "cloud.sun.fill"
    }
}

// MARK: - Helpers needed by the view

/// FlowLayout — wraps children onto multiple lines. SwiftUI's HStack
/// truncates instead of wrapping; we need wrapping for the weather flag
/// pills. Minimal implementation tuned for the regression report's use.
private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rows: [[CGSize]] = [[]]
        var currentRowWidth: CGFloat = 0
        var totalHeight: CGFloat = 0
        var rowHeight: CGFloat = 0

        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if currentRowWidth + size.width + spacing > maxWidth && !rows[rows.count - 1].isEmpty {
                rows.append([])
                totalHeight += rowHeight + spacing
                rowHeight = 0
                currentRowWidth = 0
            }
            rows[rows.count - 1].append(size)
            currentRowWidth += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        totalHeight += rowHeight
        return CGSize(width: maxWidth.isFinite ? maxWidth : currentRowWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var rowHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX && x > bounds.minX {
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
