import SwiftUI
import Charts
import WagerproofDesign
import WagerproofModels
import WagerproofServices

/// Polymarket odds widget rendered inside game bottom sheets. Mirrors RN
/// `components/PolymarketWidget.tsx`'s market-toggle chart, ported to native
/// `Charts` instead of victory-native. A 3-pill toggle switches which market's
/// `priceHistory` feeds a single full-size dual-line chart — Moneyline/Spread
/// show team-colored away/home lines, Total shows win/loss-colored Over/Under
/// lines (matching RN's green/red convention for O/U).
///
/// Cache-first via `PolymarketService.markets(...)`, which fetches all three
/// markets in one call — the toggle only changes which cached series is drawn.
struct PolymarketWidget: View {
    let league: String
    let awayTeam: String
    let homeTeam: String
    let awayColor: Color
    let homeColor: Color

    @State private var data: PolymarketGameMarkets?
    @State private var isLoading: Bool = true
    @State private var selectedMarket: PolymarketMarketType = .moneyline

    private struct ChartPoint: Identifiable {
        let index: Int
        let awayPct: Double
        let homePct: Double
        var id: Int { index }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if isLoading {
                loadingState
            } else if data != nil, !availableMarkets.isEmpty {
                marketToggle
                oddsRow
                chartCard
            } else {
                emptyState
            }
        }
        .task(id: "\(league)-\(awayTeam)-\(homeTeam)") {
            await loadMarkets()
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

    private func label(for market: PolymarketMarketType) -> String {
        switch market {
        case .moneyline: return "Moneyline"
        case .spread: return league == "mlb" ? "Run Line" : "Spread"
        case .total: return "Total"
        }
    }

    @ViewBuilder
    private var marketToggle: some View {
        HStack(spacing: 8) {
            ForEach(availableMarkets, id: \.self) { market in
                marketPill(market)
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Market type")
    }

    private func marketPill(_ market: PolymarketMarketType) -> some View {
        let isActive = market == selectedMarket
        return Button {
            withAnimation(.appQuick) { selectedMarket = market }
        } label: {
            Text(label(for: market))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(isActive ? Color.appPrimary : Color.white.opacity(0.6))
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(
                    Capsule().fill(isActive ? Color.appPrimary.opacity(0.2) : Color.white.opacity(0.08))
                )
                .overlay(
                    Capsule().stroke(isActive ? Color.appPrimary : Color.white.opacity(0.1), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label(for: market))
        .accessibilityAddTraits(isActive ? .isSelected : [])
    }

    // MARK: - Odds row

    /// Total's "away" token represents Over and "home" represents Under — same
    /// convention RN uses — so the label/tint swap away from team identity only
    /// for that market.
    private var awayLegendLabel: String { selectedMarket == .total ? "Over" : awayTeam }
    private var homeLegendLabel: String { selectedMarket == .total ? "Under" : homeTeam }
    private var awayLineColor: Color { selectedMarket == .total ? Color.appWin : awayColor }
    private var homeLineColor: Color { selectedMarket == .total ? Color.appLoss : homeColor }

    private var awayDelta: Double? {
        guard let first = chartPoints.first, let last = chartPoints.last else { return nil }
        return last.awayPct - first.awayPct
    }
    private var homeDelta: Double? {
        guard let first = chartPoints.first, let last = chartPoints.last else { return nil }
        return last.homePct - first.homePct
    }

    @ViewBuilder
    private var oddsRow: some View {
        HStack(spacing: 10) {
            oddsCard(
                label: awayLegendLabel,
                pct: selectedData?.currentAwayOdds ?? chartPoints.last?.awayPct,
                delta: awayDelta,
                tint: awayLineColor
            )
            oddsCard(
                label: homeLegendLabel,
                pct: selectedData?.currentHomeOdds ?? chartPoints.last?.homePct,
                delta: homeDelta,
                tint: homeLineColor
            )
        }
    }

    private func oddsCard(label: String, pct: Double?, delta: Double?, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Circle().fill(tint).frame(width: 6, height: 6)
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
            }
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(pct.map { "\(Int($0.rounded()))%" } ?? "—")
                    .font(.system(size: 22, weight: .heavy, design: .monospaced))
                    .foregroundStyle(Color.appTextPrimary)
                if let delta, abs(delta) >= 1 {
                    HStack(spacing: 2) {
                        Image(systemName: delta > 0 ? "arrow.up.right" : "arrow.down.right")
                            .font(.system(size: 10, weight: .bold))
                        Text("\(delta > 0 ? "+" : "")\(Int(delta.rounded()))%")
                    }
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(delta > 0 ? Color.appWin : Color.appLoss)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(tint.opacity(0.35), lineWidth: 1)
        )
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
                Chart(points) { point in
                    LineMark(x: .value("Index", point.index), y: .value("Pct", point.awayPct))
                        .foregroundStyle(by: .value("Side", awayLegendLabel))
                        .interpolationMethod(.monotone)
                        .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                    LineMark(x: .value("Index", point.index), y: .value("Pct", point.homePct))
                        .foregroundStyle(by: .value("Side", homeLegendLabel))
                        .interpolationMethod(.monotone)
                        .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                }
                .chartForegroundStyleScale([
                    awayLegendLabel: awayLineColor,
                    homeLegendLabel: homeLineColor
                ])
                .chartLegend(position: .top, alignment: .trailing, spacing: 6)
                .chartXAxis {
                    AxisMarks(values: [points.first?.index ?? 0, points.last?.index ?? 0]) { value in
                        AxisGridLine().foregroundStyle(Color.appBorder.opacity(0.25))
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
                    AxisMarks(position: .leading) { value in
                        AxisGridLine().foregroundStyle(Color.appBorder.opacity(0.2))
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
                .frame(height: 170)
                .animation(.appQuick, value: selectedMarket)
            }
        }
        .padding(14)
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
        .frame(maxWidth: .infinity, minHeight: 170)
    }

    /// Translucent glass chrome shared with `AgentPerformanceCharts` so every
    /// "real" Swift Charts tile in the app reads the same way.
    private var chartCardBackground: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.ultraThinMaterial)
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
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                SkeletonCapsule(width: 90, height: 30)
                SkeletonCapsule(width: 70, height: 30)
                SkeletonCapsule(width: 60, height: 30)
            }
            .frame(maxWidth: .infinity, alignment: .center)
            HStack(spacing: 10) {
                SkeletonBlock(height: 64, cornerRadius: 12)
                SkeletonBlock(height: 64, cornerRadius: 12)
            }
            SkeletonBlock(height: 170, cornerRadius: 16)
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
