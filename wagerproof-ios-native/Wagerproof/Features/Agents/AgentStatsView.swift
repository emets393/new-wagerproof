import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Agents "Platform Statistics" — an interactive, whole-population view of how
/// every AI agent performs. Hero: a win-rate (or net-units) histogram with a
/// fitted bell curve; below it, per-sport small multiples and a multi-sport
/// overlay. Tapping a bar drills into the top public agents in that bin + their
/// open picks. Lives behind Secret Settings (see SecretSettingsView).
///
/// Deliberate product constraints:
///  - Never displays total-N / population size (only shares + a min-picks
///    threshold, which is a filter parameter, not the population).
///  - NFL has almost no graded picks, so its per-sport curve is an ESTIMATE
///    (highest real sport band + 5 points), badged "Est." — a placeholder until
///    NFL grading lands. Net units only exists overall, so the per-sport section
///    and the net-units metric never mix.
struct AgentStatsView: View {
    let store: PlatformStatsStore

    @State private var metric: StatMetric = .winRate
    @State private var sport: SportOption = .all
    @State private var minDecided: Double = 20
    @State private var granularity: BinGranularity = .medium
    @State private var drill: DrillContext?

    // MARK: - Domain types

    enum SportOption: String, CaseIterable, Identifiable {
        case all, mlb, nba, ncaab, nfl
        var id: String { rawValue }
        var label: String {
            switch self {
            case .all: return "All"
            case .mlb: return "MLB"
            case .nba: return "NBA"
            case .ncaab: return "NCAAB"
            case .nfl: return "NFL"
            }
        }
        /// stats_by_sport key (nil = overall).
        var key: String? { self == .all ? nil : rawValue }
        var agentSport: AgentSport? {
            switch self {
            case .all: return nil
            case .mlb: return .mlb
            case .nba: return .nba
            case .ncaab: return .ncaab
            case .nfl: return .nfl
            }
        }
    }

    enum BinGranularity: String, CaseIterable, Identifiable {
        case fine, medium, coarse
        var id: String { rawValue }
        var label: String {
            switch self {
            case .fine: return "Fine"
            case .medium: return "Medium"
            case .coarse: return "Coarse"
            }
        }
        func width(for metric: StatMetric) -> Double {
            switch (metric, self) {
            case (.winRate, .fine): return 0.02
            case (.winRate, .medium): return 0.05
            case (.winRate, .coarse): return 0.10
            case (.netUnits, .fine): return 1
            case (.netUnits, .medium): return 2
            case (.netUnits, .coarse): return 5
            }
        }
    }

    struct DrillContext: Identifiable {
        let id = UUID()
        let title: String
        let metric: StatMetric
        let sport: AgentSport?
        let lower: Double
        let upper: Double
    }

    private struct SportSpec { let key: String; let label: String; let color: Color }
    private let realSports: [SportSpec] = [
        SportSpec(key: "mlb", label: "MLB", color: .appAccentBlue),
        SportSpec(key: "nba", label: "NBA", color: .appWin),
        SportSpec(key: "ncaab", label: "NCAAB", color: Color(hex: 0xF97316)),
    ]
    /// Below this many agents a per-sport cohort is too thin for a curve.
    private let sportFloor = 15
    /// Domain for the per-sport + overlay win-rate charts (tighter than the
    /// hero's full 0…1 so the curves read).
    private let sportDomain: ClosedRange<Double> = 0.2...0.85
    private let sportBinWidth = 0.05
    private let breakEven = 0.5238

    // MARK: - Body

    var body: some View {
        Group {
            switch store.loadState {
            case .idle, .loading:
                AgentStatsSkeleton()
            case .failed(let message):
                errorView(message)
            case .loaded:
                loadedBody
            }
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle("Agent Stats")
        .navigationBarTitleDisplayMode(.inline)
        .task { if store.data.isEmpty { await store.refresh() } }
        .sheet(item: $drill) { ctx in
            BinAgentsSheet(
                title: ctx.title, metric: ctx.metric, sport: ctx.sport,
                lower: ctx.lower, upper: ctx.upper, minDecided: Int(minDecided)
            )
        }
    }

    private func errorView(_ message: String) -> some View {
        ContentUnavailableView {
            Label("Couldn't load stats", systemImage: "chart.bar.xaxis")
        } description: {
            Text(message)
        } actions: {
            Button("Retry") { Task { await store.refresh() } }
                .buttonStyle(.borderedProminent)
                .tint(Color.appPrimary)
        }
    }

    private var loadedBody: some View {
        let values = heroValues()
        let domain = heroDomain(values)
        let binWidth = granularity.width(for: metric)
        let buckets = DistributionStatistics.histogram(values, domain: domain, binWidth: binWidth)
        let fit = DistributionStatistics.fit(values)
        let curve = fit.map { DistributionStatistics.curvePoints(fit: $0, domain: domain, binWidth: binWidth) } ?? []

        return ScrollView {
            VStack(spacing: 16) {
                intro
                summaryCards(values: values, fit: fit)
                controlBar
                thresholdSlider
                heroCard(values: values, domain: domain, buckets: buckets, curve: curve, fit: fit)
                perSportSection
                overlaySection
                freshnessFooter
            }
            .padding(16)
        }
        .refreshable { await store.refresh() }
    }

    // MARK: - Intro

    private var intro: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label {
                Text("Platform Statistics").font(.system(size: 16, weight: .heavy)).foregroundStyle(Color.appTextPrimary)
            } icon: {
                Image(systemName: "chart.bar.xaxis").foregroundStyle(Color.appPrimary)
            }
            Text("Win-rate distribution across every agent on the platform. Drag the threshold to filter out tiny-sample agents, or tap a bar to see who's in it.")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Summary cards

    private func summaryCards(values: [Double], fit: NormalFit?) -> some View {
        let cards = summaryMetrics(values: values, fit: fit)
        return VStack(spacing: 12) {
            HStack(spacing: 12) {
                statCard(cards[0]); statCard(cards[1])
            }
            HStack(spacing: 12) {
                statCard(cards[2]); statCard(cards[3])
            }
        }
    }

    private struct StatCardData { let label: String; let value: String; let color: Color }

    private func summaryMetrics(values: [Double], fit: NormalFit?) -> [StatCardData] {
        guard let fit, !values.isEmpty else {
            return Array(repeating: StatCardData(label: "—", value: "—", color: .appTextPrimary), count: 4)
        }
        let median = medianOf(values)
        if metric == .winRate {
            let aboveBE = Double(values.filter { $0 >= breakEven }.count) / Double(values.count)
            return [
                StatCardData(label: "Mean Win %", value: pct(fit.mean), color: .appTextPrimary),
                StatCardData(label: "Std Dev", value: pct(fit.sd), color: .appTextPrimary),
                StatCardData(label: "Above 52.4%", value: pct(aboveBE), color: aboveBE >= 0.5 ? .appWin : .appTextPrimary),
                StatCardData(label: "Median", value: pct(median), color: .appTextPrimary),
            ]
        } else {
            let profitable = Double(values.filter { $0 > 0 }.count) / Double(values.count)
            return [
                StatCardData(label: "Avg Units", value: units(fit.mean), color: fit.mean >= 0 ? .appWin : .appLoss),
                StatCardData(label: "Std Dev", value: String(format: "%.1fu", fit.sd), color: .appTextPrimary),
                StatCardData(label: "Profitable", value: pct(profitable), color: profitable >= 0.5 ? .appWin : .appTextPrimary),
                StatCardData(label: "Median", value: units(median), color: median >= 0 ? .appWin : .appLoss),
            ]
        }
    }

    private func statCard(_ data: StatCardData) -> some View {
        VStack(spacing: 4) {
            Text(data.label.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            Text(data.value)
                .font(.system(size: 24, weight: .heavy))
                .foregroundStyle(data.color)
        }
        .frame(maxWidth: .infinity)
        .padding(16)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Controls

    private var controlBar: some View {
        VStack(spacing: 10) {
            // Metric toggle
            HStack(spacing: 8) {
                ForEach(StatMetric.allCases, id: \.self) { m in
                    pill(m.label, active: metric == m) {
                        withAnimation(.easeInOut(duration: 0.2)) { metric = m }
                    }
                }
                Spacer()
                granularityMenu
            }
            // Sport pills — hidden for net units (per-sport net units unavailable).
            if metric == .winRate {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(SportOption.allCases) { option in
                            pill(option.label, active: sport == option) {
                                withAnimation(.easeInOut(duration: 0.2)) { sport = option }
                            }
                        }
                    }
                }
            }
        }
        .sensoryFeedback(.selection, trigger: metric)
        .sensoryFeedback(.selection, trigger: sport)
    }

    private var granularityMenu: some View {
        Menu {
            ForEach(BinGranularity.allCases) { g in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { granularity = g }
                } label: {
                    if granularity == g { Label(g.label, systemImage: "checkmark") } else { Text(g.label) }
                }
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "slider.horizontal.3").font(.system(size: 12, weight: .semibold))
                Text("Bins: \(granularity.label)").font(.system(size: 12, weight: .semibold))
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .foregroundStyle(Color.appTextSecondary)
            .liquidGlassBackground(in: Capsule())
        }
    }

    private func pill(_ title: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .padding(.horizontal, 14).padding(.vertical, 8)
                .foregroundStyle(active ? Color.appPrimary : Color.appTextSecondary)
                .background {
                    if active {
                        Capsule().fill(Color.appPrimary.opacity(0.18))
                            .overlay(Capsule().stroke(Color.appPrimary, lineWidth: 1))
                    } else {
                        Capsule().stroke(Color.appBorder.opacity(0.5), lineWidth: 1)
                    }
                }
        }
        .buttonStyle(.plain)
    }

    private var thresholdSlider: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Minimum settled picks")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                Text("≥ \(Int(minDecided))")
                    .font(.system(size: 13, weight: .heavy, design: .monospaced))
                    .foregroundStyle(Color.appPrimary)
            }
            Slider(value: $minDecided, in: 0...100, step: 1)
                .tint(Color.appPrimary)
            Text("Raising this filters out tiny-sample agents — the 0% / 100% spikes collapse and the curve tightens toward true skill.")
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(14)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Hero

    private func heroCard(
        values: [Double], domain: ClosedRange<Double>,
        buckets: [DistributionBucket], curve: [CurvePoint], fit: NormalFit?
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(heroTitle)
                    .font(.system(size: 16, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                if let fit {
                    Text(metric == .winRate
                         ? "μ \(pct(fit.mean)) · σ \(pct(fit.sd))"
                         : "μ \(units(fit.mean)) · σ \(String(format: "%.1fu", fit.sd))")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
            if values.count < 2 {
                lowDataPlaceholder(height: 220)
            } else {
                DistributionHistogramChart(
                    buckets: buckets, curve: curve, fit: fit, domain: domain, metric: metric,
                    accent: .appAccentBlue, height: 220
                ) { bucket in
                    drill = DrillContext(
                        title: binTitle(bucket),
                        metric: metric,
                        sport: (metric == .winRate ? sport.agentSport : nil),
                        lower: bucket.lower, upper: bucket.upper
                    )
                }
                Text("Tap a bar to see the top agents in it")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
        .padding(14)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var heroTitle: String {
        if metric == .netUnits { return "Net Units · All Sports" }
        return sport == .all ? "Win Rate · All Sports" : "Win Rate · \(sport.label)"
    }

    // MARK: - Per-sport small multiples

    private var perSportSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("By Sport")
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("Win rate only — net units isn't tracked per sport.")
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            ForEach(realSports, id: \.key) { spec in
                sportCard(spec)
            }
            nflEstimateCard
        }
    }

    private func sportCard(_ spec: SportSpec) -> some View {
        let n = Int(minDecided)
        let values = store.data.compactMap { d -> Double? in
            d.decided(forSport: spec.key) >= n ? d.winRate(forSport: spec.key) : nil
        }
        let fit = DistributionStatistics.fit(values)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(spec.label).font(.system(size: 16, weight: .heavy)).foregroundStyle(Color.appTextPrimary)
                Spacer()
                if let fit, values.count >= sportFloor {
                    Text("μ \(pct(fit.mean)) · σ \(pct(fit.sd))")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
            if let fit, values.count >= sportFloor {
                let buckets = DistributionStatistics.histogram(values, domain: sportDomain, binWidth: sportBinWidth)
                let curve = DistributionStatistics.curvePoints(fit: fit, domain: sportDomain, binWidth: sportBinWidth)
                DistributionHistogramChart(
                    buckets: buckets, curve: curve, fit: fit, domain: sportDomain, metric: .winRate,
                    accent: spec.color, height: 150
                ) { bucket in
                    drill = DrillContext(
                        title: "\(spec.label) · \(binTitle(bucket))",
                        metric: .winRate, sport: AgentSport(rawValue: spec.key),
                        lower: bucket.lower, upper: bucket.upper
                    )
                }
            } else {
                lowDataPlaceholder(height: 100)
            }
        }
        .padding(14)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    /// NFL: a synthetic curve centered +5 points above the strongest real sport.
    /// Placeholder until NFL picks are actually graded (see MEMORY known gap).
    private var nflEstimateCard: some View {
        let fit = estimatedNFLFit
        let curve = DistributionStatistics.curvePoints(fit: fit, domain: sportDomain, binWidth: sportBinWidth)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("NFL").font(.system(size: 16, weight: .heavy)).foregroundStyle(Color.appTextPrimary)
                Text("EST.")
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundStyle(Color(hex: 0x9B59B6))
                    .padding(.horizontal, 7).padding(.vertical, 3)
                    .background(Color(hex: 0x9B59B6).opacity(0.18), in: Capsule())
                Spacer()
                Text("μ \(pct(fit.mean)) · projected")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Color.appTextSecondary)
            }
            DistributionHistogramChart(
                buckets: [], curve: curve, fit: fit, domain: sportDomain, metric: .winRate,
                accent: Color(hex: 0x9B59B6), height: 150, showReferenceLines: true
            )
            Text("NFL picks aren't graded yet — this is a projection (strongest sport + 5 pts), not observed data.")
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(14)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Overlay

    private var overlaySection: some View {
        var series: [FittedCurveOverlayChart.Series] = []
        let n = Int(minDecided)
        for spec in realSports {
            let values = store.data.compactMap { d -> Double? in
                d.decided(forSport: spec.key) >= n ? d.winRate(forSport: spec.key) : nil
            }
            guard let fit = DistributionStatistics.fit(values), values.count >= sportFloor else { continue }
            series.append(.init(
                name: spec.label, color: spec.color, isEstimated: false,
                points: DistributionStatistics.normalizedCurvePoints(fit: fit, domain: sportDomain)
            ))
        }
        let nfl = estimatedNFLFit
        series.append(.init(
            name: "NFL (Est.)", color: Color(hex: 0x9B59B6), isEstimated: true,
            points: DistributionStatistics.normalizedCurvePoints(fit: nfl, domain: sportDomain)
        ))

        return VStack(alignment: .leading, spacing: 8) {
            Text("Sports Compared")
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            if series.count > 1 {
                FittedCurveOverlayChart(series: series, domain: sportDomain, height: 220)
            } else {
                lowDataPlaceholder(height: 120)
            }
        }
        .padding(14)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Footer

    @ViewBuilder
    private var freshnessFooter: some View {
        if let updated = store.lastCalculatedAt {
            Text("Updated \(updated.formatted(.relative(presentation: .named)))")
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextMuted)
                .frame(maxWidth: .infinity)
                .padding(.top, 4)
        }
    }

    // MARK: - Shared bits

    private func lowDataPlaceholder(height: CGFloat) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "chart.bar.xaxis.ascending")
                .font(.system(size: 26, weight: .light))
                .foregroundStyle(Color.appTextSecondary)
            Text("Not enough data at this threshold")
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, minHeight: height)
    }

    /// NFL estimate: strongest real-sport mean + 5 win-rate points, SD ≈ the
    /// mean of the real sports' SDs (0.07 fallback). Recomputed live from the
    /// current threshold so it tracks the real sports it's anchored to.
    private var estimatedNFLFit: NormalFit {
        let n = Int(minDecided)
        var means: [Double] = []
        var sds: [Double] = []
        for spec in realSports {
            let values = store.data.compactMap { d -> Double? in
                d.decided(forSport: spec.key) >= n ? d.winRate(forSport: spec.key) : nil
            }
            if let fit = DistributionStatistics.fit(values), values.count >= sportFloor {
                means.append(fit.mean); sds.append(fit.sd)
            }
        }
        let baseMean = means.max() ?? 0.555
        let sd = sds.isEmpty ? 0.07 : sds.reduce(0, +) / Double(sds.count)
        return NormalFit(mean: min(0.9, baseMean + 0.05), sd: sd, count: 0, isEstimated: true)
    }

    // MARK: - Cohort computation

    private func heroValues() -> [Double] {
        let n = Int(minDecided)
        switch metric {
        case .netUnits:
            return store.data.filter { $0.decided >= n }.map { $0.netUnits }
        case .winRate:
            if let key = sport.key {
                return store.data.compactMap { d in
                    d.decided(forSport: key) >= n ? d.winRate(forSport: key) : nil
                }
            }
            return store.data.filter { $0.decided >= n }.compactMap { $0.winRate }
        }
    }

    private func heroDomain(_ values: [Double]) -> ClosedRange<Double> {
        guard metric == .netUnits else { return 0...1 }
        guard let mn = values.min(), let mx = values.max() else { return -10...10 }
        let lo = max(-25, (mn / 5).rounded(.down) * 5)
        let hi = min(25, (mx / 5).rounded(.up) * 5)
        return lo < hi ? lo...hi : (lo - 5)...(hi + 5)
    }

    // MARK: - Formatting

    private func binTitle(_ bucket: DistributionBucket) -> String {
        if metric == .winRate {
            return "\(Int((bucket.lower * 100).rounded()))–\(Int((bucket.upper * 100).rounded()))% Win Rate"
        }
        return "\(String(format: "%+.0f", bucket.lower)) to \(String(format: "%+.0f", bucket.upper))u"
    }

    private func pct(_ v: Double) -> String { "\(String(format: "%.1f", v * 100))%" }
    private func units(_ v: Double) -> String { "\(v >= 0 ? "+" : "")\(String(format: "%.2fu", v))" }
    private func medianOf(_ values: [Double]) -> Double {
        guard !values.isEmpty else { return 0 }
        let sorted = values.sorted()
        let mid = sorted.count / 2
        return sorted.count.isMultiple(of: 2) ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }
}
