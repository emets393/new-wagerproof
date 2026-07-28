import SwiftUI
import Charts
import WagerproofDesign
import WagerproofModels
import WagerproofServices

/// Polymarket odds widget rendered inside game bottom sheets. Mirrors RN
/// `components/PolymarketWidget.tsx`'s market-toggle chart, ported to native
/// `Charts`. A native segmented picker switches which market's `priceHistory`
/// feeds a chart-first dual-line layout — Moneyline/Spread
/// show team-colored away/home lines, Total shows win/loss-colored Over/Under
/// lines. Current percentages live on the line endpoints so the chart remains
/// the primary visual rather than being preceded by redundant stat cards.
///
/// Cache-first via `PolymarketService.markets(...)`, which fetches all three
/// markets in one call — the toggle only changes which cached series is drawn.
struct PolymarketWidget: View {
    @Environment(\.widgetUsesLiquidGlass) private var usesLiquidGlass
    let league: String
    let awayTeam: String
    let homeTeam: String
    var awayLabel: String? = nil
    var homeLabel: String? = nil
    let awayColor: Color
    let homeColor: Color
    var onHeadlineChange: ((String?) -> Void)? = nil

    @State private var data: PolymarketGameMarkets?
    @State private var isLoading: Bool = true
    @State private var selectedMarket: PolymarketMarketType = .moneyline

    private struct ChartPoint: Identifiable {
        let index: Int
        let awayPct: Double
        let homePct: Double
        var id: Int { index }
    }

    private struct EndpointAnnotation {
        let label: String
        let percentage: Double
        let tint: Color
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if isLoading {
                loadingState
            } else if data != nil, !availableMarkets.isEmpty {
                marketToggle
                marketSourceNote
                chartCard
            } else {
                emptyState
            }
        }
        .task(id: "\(league)-\(awayTeam)-\(homeTeam)") {
            // A paging TabView can make a retained page disappear and reappear
            // as its neighbour becomes current. Keep its completed chart rather
            // than flashing back to the loading skeleton on that lifecycle.
            guard data == nil else { return }
            await loadMarkets()
        }
        .onChange(of: marketHeadline, initial: true) { _, headline in
            onHeadlineChange?(headline)
        }
    }

    // MARK: - Market selection

    private var availableMarkets: [PolymarketMarketType] {
        guard let data else { return [] }
        return PolymarketMarketType.allCases.filter { data.markets[$0] != nil }
    }

    private var selectedData: PolymarketMarket? {
        data?.markets[selectedMarket]
    }

    /// Matches the web card's deterministic public-market verdict, using the
    /// exact labels already attached to the plotted series so the prose names
    /// the displayed team or Over/Under side for every market.
    private var marketHeadline: String? {
        guard let first = chartPoints.first,
              let last = chartPoints.last else { return nil }

        let awayLeads = last.awayPct >= last.homePct
        let leader = awayLeads ? last.awayPct : last.homePct
        let trailer = awayLeads ? last.homePct : last.awayPct
        let leaderStart = awayLeads ? first.awayPct : first.homePct
        let leaderLabel = awayLeads ? awayLegendLabel : homeLegendLabel
        let trailerLabel = awayLeads ? homeLegendLabel : awayLegendLabel
        let leaderRounded = Int(leader.rounded())
        let trailerRounded = Int(trailer.rounded())
        let read: String
        let nearlyEven = abs(leader - trailer) < 4
        switch selectedMarket {
        case .moneyline:
            read = nearlyEven
                ? "Public markets see the outright winner as nearly even: \(leaderLabel) \(leaderRounded)% and \(trailerLabel) \(trailerRounded)%."
                : "Public markets give \(leaderLabel) a \(leaderRounded)% chance to win outright, compared with \(trailerLabel) at \(trailerRounded)%."
        case .spread:
            let marketName = league == "mlb" ? "run line" : "spread"
            read = nearlyEven
                ? "Public markets see the selected \(marketName) as nearly even: \(leaderLabel) \(leaderRounded)% and \(trailerLabel) \(trailerRounded)% to cover."
                : "Public markets give \(leaderLabel) a \(leaderRounded)% chance to cover the selected \(marketName), compared with \(trailerLabel) at \(trailerRounded)%."
        case .total:
            read = nearlyEven
                ? "Public markets see the selected game total as nearly even: \(leaderLabel) \(leaderRounded)% and \(trailerLabel) \(trailerRounded)%."
                : "Public markets price \(leaderLabel) at \(leaderRounded)% and \(trailerLabel) at \(trailerRounded)% for the selected game total."
        }

        let delta = Int((leader - leaderStart).rounded())
        let movement: String
        if delta >= 2 {
            movement = " \(leaderLabel) is up \(delta) percentage points from the first tracked price."
        } else if delta <= -2 {
            movement = " \(leaderLabel) is down \(abs(delta)) percentage points from the first tracked price."
        } else {
            movement = " \(leaderLabel) has held broadly steady across the tracked history."
        }
        return "\(read)\(movement)"
    }

    private func label(for market: PolymarketMarketType) -> String {
        switch market {
        case .moneyline: return "Moneyline"
        case .spread: return league == "mlb" ? "Run Line" : "Spread"
        case .total: return "Total"
        }
    }

    @ViewBuilder
    private var marketToggle: some View {
        if availableMarkets.count > 1 {
            Picker("Market", selection: $selectedMarket) {
                ForEach(availableMarkets, id: \.self) { market in
                    Text(label(for: market))
                        .tag(market)
                }
            }
            .pickerStyle(.segmented)
            .tint(Color.appPrimary)
            .accessibilityLabel("Market type")
        } else if let market = availableMarkets.first {
            Text(label(for: market))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var marketSourceNote: some View {
        Label {
            Text("Live trader-implied probability from public markets, not a sportsbook line.")
        } icon: {
            Image(systemName: "info.circle")
        }
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(Color.appTextMuted)
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Series presentation

    /// Total's "away" token represents Over and "home" represents Under — same
    /// convention the web uses — so the label/tint swap away from team identity
    /// only for that market.
    private var awayLegendLabel: String {
        selectedMarket == .total ? "Over" : resolvedLabel(awayLabel, fallback: awayTeam)
    }
    private var homeLegendLabel: String {
        selectedMarket == .total ? "Under" : resolvedLabel(homeLabel, fallback: homeTeam)
    }
    private var awayLineColor: Color { selectedMarket == .total ? Color.appWin : awayColor }
    private var homeLineColor: Color { selectedMarket == .total ? Color.appLoss : homeColor }

    private func compactLabel(_ team: String) -> String {
        let trimmed = team.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Away" }
        let pieces = trimmed.split(separator: " ")
        if pieces.count > 1 {
            return pieces.map { String($0.prefix(1)) }.joined().uppercased()
        }
        return String(trimmed.prefix(4)).uppercased()
    }

    private func resolvedLabel(_ label: String?, fallback team: String) -> String {
        guard let label else { return compactLabel(team) }
        let trimmed = label.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? compactLabel(team) : trimmed
    }

    private func annotationLabel(_ label: String, percentage: Double, tint: Color) -> some View {
        HStack(spacing: 8) {
            Circle()
                .fill(tint)
                .frame(width: 10, height: 10)
            Text(label)
                .font(.system(size: 15, weight: .bold))
                .tracking(0.75)
                .foregroundStyle(Color.appTextSecondary)
            Text("\(Int(percentage.rounded()))%")
                .font(.system(size: 21, weight: .heavy, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Color.appTextPrimary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(
            Color.appSurfaceElevated.opacity(0.94),
            in: Capsule()
        )
        .overlay(
            Capsule()
                .strokeBorder(tint.opacity(0.42), lineWidth: 1.25)
        )
        .shadow(color: Color.black.opacity(0.18), radius: 8, y: 3)
    }

    private func endpointAnnotations(
        for point: ChartPoint
    ) -> (top: EndpointAnnotation, bottom: EndpointAnnotation) {
        let away = EndpointAnnotation(
            label: awayLegendLabel,
            percentage: point.awayPct,
            tint: awayLineColor
        )
        let home = EndpointAnnotation(
            label: homeLegendLabel,
            percentage: point.homePct,
            tint: homeLineColor
        )

        // The upper-right pill always identifies the series above the 50% rule;
        // the lower-right pill identifies the series below it. At an exact tie,
        // preserve away/Over above home/Under for a stable, non-overlapping UI.
        if point.homePct > 50 {
            return (home, away)
        }
        return (away, home)
    }

    @ChartContentBuilder
    private func seriesMarks(_ points: [ChartPoint]) -> some ChartContent {
        ForEach(points) { point in
            AreaMark(
                x: .value("Index", point.index),
                yStart: .value("Baseline", chartYDomain.lowerBound),
                yEnd: .value("Away probability", point.awayPct)
            )
            .foregroundStyle(
                LinearGradient(
                    colors: [awayLineColor.opacity(0.18), awayLineColor.opacity(0.01)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .interpolationMethod(.monotone)

            LineMark(
                x: .value("Index", point.index),
                y: .value("Probability", point.awayPct),
                series: .value("Side", awayLegendLabel)
            )
            .foregroundStyle(awayLineColor)
            .interpolationMethod(.monotone)
            .lineStyle(StrokeStyle(lineWidth: 2.25, lineCap: .round, lineJoin: .round))

            LineMark(
                x: .value("Index", point.index),
                y: .value("Probability", point.homePct),
                series: .value("Side", homeLegendLabel)
            )
            .foregroundStyle(homeLineColor)
            .interpolationMethod(.monotone)
            .lineStyle(StrokeStyle(lineWidth: 2.25, lineCap: .round, lineJoin: .round))
        }

        if let last = points.last {
            PointMark(
                x: .value("Index", last.index),
                y: .value("Away probability", last.awayPct)
            )
            .foregroundStyle(awayLineColor)
            .symbolSize(34)

            PointMark(
                x: .value("Index", last.index),
                y: .value("Home probability", last.homePct)
            )
            .foregroundStyle(homeLineColor)
            .symbolSize(34)
        }
    }

    // MARK: - Chart

    private var chartPoints: [ChartPoint] {
        guard let history = selectedData?.priceHistory, history.count >= 2 else { return [] }
        let series = Array(history.suffix(60))
        return series.enumerated().map { idx, point in
            ChartPoint(index: idx, awayPct: point.p * 100, homePct: (1 - point.p) * 100)
        }
    }

    /// Prediction-market win probabilities often hover in a narrow band (e.g.
    /// 55-70%), so a fixed 0...100 axis leaves most of the chart blank. Zoom
    /// to the actual data range (with a little breathing room) instead.
    private var chartYDomain: ClosedRange<Double> {
        let values = chartPoints.flatMap { [$0.awayPct, $0.homePct] }
        guard let minV = values.min(), let maxV = values.max() else { return 0...100 }
        let padding = max(4, (maxV - minV) * 0.15)
        return max(0, minV - padding)...min(100, maxV + padding)
    }

    @ViewBuilder
    private var chartCard: some View {
        let points = chartPoints
        Group {
            if points.isEmpty {
                chartEmptyPlaceholder
            } else {
                Chart {
                    seriesMarks(points)
                    RuleMark(y: .value("Even", 50))
                        .foregroundStyle(Color.appTextMuted.opacity(0.28))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 4]))
                }
                .chartLegend(.hidden)
                .chartXAxis {
                    AxisMarks(values: [points.first?.index ?? 0, points.last?.index ?? 0]) { value in
                        AxisValueLabel {
                            if let n = value.as(Int.self) {
                                Text(n == points.first?.index ? "Start" : "Now")
                                    .font(.system(size: 10))
                                    .foregroundStyle(Color.appTextMuted)
                            }
                        }
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { value in
                        AxisGridLine().foregroundStyle(Color.appBorder.opacity(0.16))
                        AxisValueLabel {
                            if let v = value.as(Double.self) {
                                Text("\(Int(v))%")
                                    .font(.system(size: 10))
                                    .foregroundStyle(Color.appTextMuted)
                            }
                        }
                    }
                }
                .chartYScale(domain: chartYDomain)
                .chartXScale(range: .plotDimension(startPadding: 4, endPadding: 8))
                .chartOverlay { proxy in
                    GeometryReader { geometry in
                        if let plotFrame = proxy.plotFrame, let last = points.last {
                            let frame = geometry[plotFrame]
                            let annotations = endpointAnnotations(for: last)
                            VStack(alignment: .trailing, spacing: 8) {
                                annotationLabel(
                                    annotations.top.label,
                                    percentage: annotations.top.percentage,
                                    tint: annotations.top.tint
                                )
                                Spacer(minLength: 12)
                                annotationLabel(
                                    annotations.bottom.label,
                                    percentage: annotations.bottom.percentage,
                                    tint: annotations.bottom.tint
                                )
                            }
                            .frame(
                                width: max(0, frame.width - 16),
                                height: max(0, frame.height - 16),
                                alignment: .trailing
                            )
                            .position(x: frame.midX, y: frame.midY)
                        }
                    }
                    .allowsHitTesting(false)
                }
                .frame(height: 252)
                // A paging TabView settles its selection inside an animated
                // transaction. Swift Charts otherwise inherits that transaction
                // and briefly re-animates its marks, which reads as a flash.
                .transaction { transaction in
                    transaction.animation = nil
                }
                .accessibilityLabel("\(label(for: selectedMarket)) prediction market")
                .accessibilityValue(
                    "\(awayLegendLabel) \(Int((points.last?.awayPct ?? 0).rounded())) percent, \(homeLegendLabel) \(Int((points.last?.homePct ?? 0).rounded())) percent"
                )
            }
        }
        .padding(.horizontal, 10)
        .padding(.top, 16)
        .padding(.bottom, 10)
        .background(chartCardBackground)
    }

    @ViewBuilder
    private var chartEmptyPlaceholder: some View {
        VStack(spacing: 6) {
            Image(systemName: "chart.line.flattrend.xyaxis")
                .font(.system(size: 22))
            Text("Not enough price history yet")
                .font(.system(size: 12, weight: .medium))
        }
        .foregroundStyle(Color.appTextMuted)
        .frame(maxWidth: .infinity, minHeight: 252)
    }

    /// Translucent glass chrome shared with `AgentPerformanceCharts` so every
    /// "real" Swift Charts tile in the app reads the same way.
    private var chartCardBackground: some View {
        ZStack {
            // A live material inside a card that already has its own backdrop
            // blur is blur-over-blur. The 0.5-opacity fill layered on top hides
            // most of the refraction anyway, so when widget glass is off this
            // becomes a static fill of roughly the same value.
            if usesLiquidGlass {
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.ultraThinMaterial)
            } else {
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.appSurfaceElevated)
            }
            RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(hex: 0x0F131C).opacity(0.5))
        }
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    // MARK: - Loading / empty states

    @ViewBuilder
    private var loadingState: some View {
        VStack(alignment: .leading, spacing: 10) {
            SkeletonBlock(height: 32, cornerRadius: 8)
            SkeletonBlock(height: 278, cornerRadius: 16)
        }
        .shimmering()
    }

    @ViewBuilder
    private var emptyState: some View {
        HStack {
            Image(systemName: "chart.line.uptrend.xyaxis.circle")
                .foregroundStyle(Color.appTextMuted)
            Text("No market odds yet")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 8)
    }

    // MARK: - Data

    private func loadMarkets() async {
        guard data == nil else { return }
        isLoading = true
        let result = await PolymarketService.shared.markets(
            league: league,
            awayTeam: awayTeam,
            homeTeam: homeTeam
        )
        await MainActor.run {
            self.data = result
            let markets = PolymarketMarketType.allCases.filter { result?.markets[$0] != nil }
            if let first = markets.first, !markets.contains(selectedMarket) {
                selectedMarket = first
            }
            self.isLoading = false
        }
    }
}

#Preview {
    PolymarketWidget(
        league: "nfl",
        awayTeam: "Dallas",
        homeTeam: "Philadelphia",
        awayColor: .blue,
        homeColor: .green
    )
    .padding()
    .background(Color.appSurface)
}
