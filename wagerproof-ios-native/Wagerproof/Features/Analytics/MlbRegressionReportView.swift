import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// MLB Daily Regression Report — RN-parity feed of extracted primitives
/// (see Components/). Mirrors `wagerproof-mobile/app/(drawer)/(tabs)/
/// mlb-regression-report.tsx` section-for-section:
///   1. AI Analysis Summary (block-level markdown via WagerBotMarkdownText)
///   2. Model Accuracy (2x2 grid + segmented bucket drill-down)
///   3. Day-of-Week & Team Breakdown (mlb_model_breakdown_accuracy)
///   4. Yesterday's Results (hero tiles; ALL-TIME = Perfect Storm tiers)
///   5. Regression Report Suggested Picks (tier record grid + tier-badged
///      pick cards with per-pick model-alignment context)
///   6-8. Pitcher / Batting / Bullpen regression cards
///   9. L/R Pitcher Splits
///   10. Series-Position Signals (mlb_game_signals, category == "series")
///   11. Weather & Park Impact
///
/// Resolves FIDELITY-WAIVER #110 — markdown narrative, pinned section
/// headers, breakdown tables, tier records, alignment context, and series
/// signals all ship here. RN's `perfect_storm_matchups` block is NOT
/// rendered on mobile (dead styles only) so it is intentionally absent.
struct MlbRegressionReportView: View {
    @State private var reportStore = MLBRegressionReportStore()
    @State private var bucketStore = MLBBucketAccuracyStore()
    @State private var breakdownStore = MLBModelBreakdownStore()
    @State private var psRecordsStore = MLBPerfectStormRecordsStore()
    @State private var seriesStore = MLBSeriesSignalsStore()

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16, pinnedViews: [.sectionHeaders]) {
                if let report = reportStore.report {
                    reportFeed(report)
                } else if reportStore.loading || reportStore.lastFetchedKey == nil {
                    // Never-fetched counts as loading — `.task` hasn't flipped
                    // `loading` yet on the first frame, and falling through
                    // would flash the "no report" box before the skeleton.
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
                    Task { await refreshAll() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .tint(Color.appPrimary)
                .accessibilityLabel("Refresh")
            }
        }
        .refreshable { await refreshAll() }
        .task {
            // All five stores are independent — hydrate in parallel so
            // cold-start stays one network round trip.
            async let r: () = reportStore.refreshIfStale()
            async let b: () = bucketStore.refreshIfStale()
            async let m: () = breakdownStore.refreshIfStale()
            async let p: () = psRecordsStore.refreshIfStale()
            async let s: () = seriesStore.refreshIfStale()
            _ = await (r, b, m, p, s)
        }
    }

    private func refreshAll() async {
        async let r: () = reportStore.refresh()
        async let b: () = bucketStore.refresh()
        async let m: () = breakdownStore.refresh()
        async let p: () = psRecordsStore.refresh()
        async let s: () = seriesStore.refresh()
        _ = await (r, b, m, p, s)
    }

    // MARK: - Feed

    @ViewBuilder
    private func reportFeed(_ report: MLBRegressionReport) -> some View {
        dateRow(report)

        // 1. AI Analysis Summary
        if let narrative = report.narrativeText, !narrative.isEmpty {
            Section {
                RegressionNarrativeCard(text: narrative)
                    .padding(.horizontal, Spacing.lg)
                    .staggeredAppear(index: 0)
            } header: {
                sectionHeader("AI Analysis Summary", icon: "bolt.fill", color: Regression.accentPurple)
            }
        }

        // 2. Model Accuracy
        Section {
            RegressionAccuracySection(accuracy: bucketStore.data, loading: bucketStore.loading)
                .padding(.horizontal, Spacing.lg)
                .staggeredAppear(index: 1)
        } header: {
            sectionHeader("Model Accuracy", icon: "chart.bar.fill", color: Regression.accentBlue)
        }

        // 3. Day-of-Week & Team Breakdown — skipped entirely when the table
        // is empty and settled (RN renders an empty body in that case).
        if !breakdownStore.rows.isEmpty || breakdownStore.loading {
            Section {
                RegressionModelBreakdownSection(store: breakdownStore)
                    .padding(.horizontal, Spacing.lg)
                    .staggeredAppear(index: 2)
            } header: {
                sectionHeader("Day-of-Week & Team Breakdown", icon: "chart.bar.doc.horizontal.fill", color: Regression.accentPurple)
            }
        }

        // 4. Yesterday's Results — directly above the picks so the user sees
        // yesterday's record right before today's suggestions.
        if let recap = report.yesterdayRecap {
            Section {
                RegressionRecapSection(recap: recap, psRecords: psRecordsStore.records)
                    .padding(.horizontal, Spacing.lg)
                    .staggeredAppear(index: 3)
            } header: {
                sectionHeader("Yesterday's Results", icon: "trophy.fill", color: Regression.accentYellow)
            }
        }

        // 5. Suggested Picks (tier records grid always shown)
        let picks = report.suggestedPicks ?? []
        Section {
            picksBody(picks: picks, reportDate: report.reportDate)
                .padding(.horizontal, Spacing.lg)
                .staggeredAppear(index: 4)
        } header: {
            sectionHeader(
                "Regression Report Suggested Picks",
                icon: "bolt.fill",
                color: Regression.hammerPurple,
                countBadge: picks.isEmpty ? nil : picks.count
            )
        }

        // 6. Starting Pitcher Regression
        let negative = report.pitcherNegativeRegression ?? []
        let positive = report.pitcherPositiveRegression ?? []
        if !negative.isEmpty || !positive.isEmpty {
            Section {
                pitcherBody(negative: negative, positive: positive)
                    .padding(.horizontal, Spacing.lg)
                    .staggeredAppear(index: 5)
            } header: {
                sectionHeader("Starting Pitcher Regression", icon: "flame.fill", color: Regression.accentOrange)
            }
        }

        // 7. Team Batting Regression
        let heatUp = report.battingHeatUp ?? []
        let coolDown = report.battingCoolDown ?? []
        if !heatUp.isEmpty || !coolDown.isEmpty {
            Section {
                battingBody(heatUp: heatUp, coolDown: coolDown)
                    .padding(.horizontal, Spacing.lg)
                    .staggeredAppear(index: 6)
            } header: {
                sectionHeader("Team Batting Regression", icon: "chart.line.uptrend.xyaxis", color: Regression.accentBlue)
            }
        }

        // 8. Bullpen Fatigue & Trends
        if let bullpens = report.bullpenFatigue, !bullpens.isEmpty {
            Section {
                VStack(spacing: 8) {
                    ForEach(Array(bullpens.enumerated()), id: \.offset) { _, b in
                        BullpenFatigueCard(bullpen: b)
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .staggeredAppear(index: 7)
            } header: {
                sectionHeader("Bullpen Fatigue & Trends", icon: "shield.lefthalf.filled", color: Regression.accentPurple)
            }
        }

        // 9. L/R Pitcher Splits
        if let splits = report.lrSplitsToday, !splits.isEmpty {
            Section {
                LRSplitsSection(splits: splits)
                    .padding(.horizontal, Spacing.lg)
                    .staggeredAppear(index: 8)
            } header: {
                sectionHeader("L/R Pitcher Splits", icon: "scope", color: Regression.accentIndigo)
            }
        }

        // 10. Series-Position Signals — independent live view, not part of
        // the report ETL; positives (BACK) listed before negatives (FADE).
        if !seriesStore.signals.isEmpty {
            let ordered = seriesStore.signals.filter(\.isPositive) + seriesStore.signals.filter { !$0.isPositive }
            Section {
                VStack(spacing: 10) {
                    ForEach(ordered) { signal in
                        SeriesSignalCard(signal: signal)
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .staggeredAppear(index: 9)
            } header: {
                sectionHeader("Series-Position Signals", icon: "target", color: Regression.accentPurple)
            }
        }

        // 11. Weather & Park Impact
        if let weather = report.weatherParkFlags, !weather.isEmpty {
            Section {
                VStack(spacing: 8) {
                    ForEach(Array(weather.enumerated()), id: \.offset) { _, f in
                        WeatherParkFlagCard(flag: f)
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .staggeredAppear(index: 10)
            } header: {
                sectionHeader("Weather & Park Impact", icon: "wind", color: Regression.accentCyan)
            }
        }
    }

    @ViewBuilder
    private func dateRow(_ report: MLBRegressionReport) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            if let date = formattedReportDate(report.reportDate) {
                Text(date.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .tracking(1.2)
                    .foregroundStyle(Color.appTextSecondary)
            }
            if let ago = Regression.timeAgo(fromISO: report.generatedAt) {
                Text("Updated \(ago)")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.top, Spacing.md)
    }

    // MARK: - Composite section bodies

    @ViewBuilder
    private func picksBody(picks: [MLBSuggestedPick], reportDate: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if let records = psRecordsStore.records {
                PerfectStormTierRecordsGrid(records: records)
            } else if psRecordsStore.loading {
                tierRecordsSkeleton
            }

            if picks.isEmpty {
                Text("No Perfect Storm picks today — the model didn't find any games meeting the criteria.")
                    .font(.system(size: 12)).italic()
                    .foregroundStyle(Color.appTextSecondary)
            } else {
                VStack(spacing: 10) {
                    ForEach(picks) { pick in
                        PerfectStormPickCard(
                            pick: pick,
                            reportDate: reportDate,
                            breakdownRows: breakdownStore.rows
                        )
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func pitcherBody(negative: [MLBPitcherRegression], positive: [MLBPitcherRegression]) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            if !negative.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    RegressionGroupLabel(
                        label: "DUE FOR NEGATIVE REGRESSION",
                        count: negative.count,
                        color: Regression.lossRed,
                        note: "ERA too low vs xFIP — been lucky"
                    )
                    ForEach(Array(negative.enumerated()), id: \.offset) { _, p in
                        PitcherRegressionCard(pitcher: p)
                    }
                }
            }
            if !positive.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    RegressionGroupLabel(
                        label: "DUE FOR POSITIVE REGRESSION",
                        count: positive.count,
                        color: Regression.winGreen,
                        note: "ERA too high vs xFIP — been unlucky"
                    )
                    ForEach(Array(positive.enumerated()), id: \.offset) { _, p in
                        PitcherRegressionCard(pitcher: p)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func battingBody(heatUp: [MLBBattingRegression], coolDown: [MLBBattingRegression]) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            if !heatUp.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    RegressionGroupLabel(
                        label: "DUE TO HEAT UP",
                        count: heatUp.count,
                        color: Regression.winGreen,
                        note: "Low BABIP + strong contact quality"
                    )
                    ForEach(Array(heatUp.enumerated()), id: \.offset) { _, t in
                        BattingRegressionCard(team: t)
                    }
                }
            }
            if !coolDown.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    RegressionGroupLabel(
                        label: "DUE TO COOL DOWN",
                        count: coolDown.count,
                        color: Regression.lossRed,
                        note: "High BABIP + weak contact quality"
                    )
                    ForEach(Array(coolDown.enumerated()), id: \.offset) { _, t in
                        BattingRegressionCard(team: t)
                    }
                }
            }
        }
    }

    // MARK: - Section header (pinned)

    /// Pinned section header — `sectionHeaders` on the parent LazyVStack
    /// pins this flush to the safe-area edge as the user scrolls past.
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

    // MARK: - Loading / error / empty

    /// Skeleton mirroring the loaded feed's dominant shapes: date line, a
    /// hero-tile recap block, then a tier grid + accent-stripe stat rows.
    private var loadingState: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                SkeletonBlock(width: 200, height: 11)
                SkeletonBlock(width: 110, height: 10)
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.md)
            .shimmering()

            sectionHeaderPlaceholder
            VStack(spacing: 12) {
                HStack(spacing: 10) {
                    heroTilePlaceholder
                    heroTilePlaceholder
                }
                ForEach(0..<2, id: \.self) { _ in accentRowPlaceholder(lines: 2) }
            }
            .padding(.horizontal, Spacing.lg)

            sectionHeaderPlaceholder
            VStack(spacing: 8) {
                tierRecordsSkeleton
                ForEach(0..<2, id: \.self) { _ in accentRowPlaceholder(lines: 3) }
            }
            .padding(.horizontal, Spacing.lg)
        }
        .transition(.opacity)
    }

    private var tierRecordsSkeleton: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            ForEach(0..<4, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 4) {
                    SkeletonBlock(width: 90, height: 9)
                    SkeletonBlock(width: 70, height: 14)
                    SkeletonBlock(width: 60, height: 10)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 6)
                .padding(.horizontal, 10)
                .shimmering()
                .background(Color.appSurfaceMuted.opacity(0.4), in: RoundedRectangle(cornerRadius: 8))
            }
        }
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

    /// Mirrors `RegressionAccentRow`: 3pt stripe + stacked stat rows.
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
                .foregroundStyle(Regression.lossRed)
            Text(reportStore.errorMessage ?? "Failed to load regression report.")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextPrimary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Regression.lossRed.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Regression.lossRed.opacity(0.2), lineWidth: 1))
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

    // MARK: - Formatting

    private func formattedReportDate(_ reportDate: String) -> String? {
        // `report_date` is `yyyy-MM-dd` — format in ET so the label never
        // flips a day across the UTC boundary.
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.dateFormat = "yyyy-MM-dd"
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        guard let d = fmt.date(from: reportDate) else { return nil }
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_US")
        out.timeZone = TimeZone(identifier: "America/New_York")
        out.dateFormat = "EEEE, MMMM d, yyyy"
        return out.string(from: d)
    }
}
