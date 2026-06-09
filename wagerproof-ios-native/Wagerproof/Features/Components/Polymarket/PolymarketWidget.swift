import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices

/// Compact Polymarket odds widget rendered inside game bottom sheets.
/// Mirrors RN `components/PolymarketWidget.tsx`. Renders cached prediction-
/// market odds (moneyline + spread + total) with a small sparkline of the
/// last price-history points.
///
/// Cache-first via `PolymarketService.markets(...)`. Empty + error states
/// match RN: "No market odds yet" placeholder.
struct PolymarketWidget: View {
    let league: String
    let awayTeam: String
    let homeTeam: String

    @State private var data: PolymarketGameMarkets?
    @State private var isLoading: Bool = true
    @State private var errorMessage: String?

    var body: some View {
        // Title ("Market Odds") now lives in the hosting `WidgetSection`; keep
        // just the source attribution so the data provenance stays visible.
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Spacer()
                Text("via Polymarket")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color.appTextMuted)
            }

            if isLoading {
                loadingState
            } else if let data {
                marketRows(data)
            } else {
                emptyState
            }
        }
        .task(id: "\(league)-\(awayTeam)-\(homeTeam)") {
            await loadMarkets()
        }
    }

    @ViewBuilder
    private var loadingState: some View {
        VStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.appSurfaceMuted)
                .frame(height: 28)
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.appSurfaceMuted)
                .frame(height: 28)
        }
        .redacted(reason: .placeholder)
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

    @ViewBuilder
    private func marketRows(_ data: PolymarketGameMarkets) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let ml = data.moneyline {
                marketRow(label: "Moneyline", away: ml.currentAwayOdds, home: ml.currentHomeOdds, history: ml.priceHistory)
            }
            if let spread = data.spread {
                marketRow(label: "Spread", away: spread.currentAwayOdds, home: spread.currentHomeOdds, history: spread.priceHistory)
            }
            if let total = data.total {
                marketRow(label: "Total", away: total.currentAwayOdds, home: total.currentHomeOdds, history: total.priceHistory)
            }
        }
    }

    @ViewBuilder
    private func marketRow(label: String, away: Double?, home: Double?, history: [PolymarketPricePoint]) -> some View {
        HStack(spacing: 12) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .frame(width: 70, alignment: .leading)
            Text(awayTeam.prefix(3).uppercased() + " \(formatOdds(away))")
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(Color.appAccentBlue)
            sparkline(history)
                .frame(height: 18)
                .frame(maxWidth: .infinity)
            Text(homeTeam.prefix(3).uppercased() + " \(formatOdds(home))")
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(Color.appPrimary)
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 8)
        .background(Color.appSurfaceMuted.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
    }

    @ViewBuilder
    private func sparkline(_ history: [PolymarketPricePoint]) -> some View {
        // Minimal inline sparkline using a Canvas — keeps zero deps.
        // Prices are 0...1, we map to a normalized stroke path.
        let points = history.suffix(40).map { $0.p }
        if points.count >= 2 {
            Canvas { ctx, size in
                let minVal = points.min() ?? 0
                let maxVal = points.max() ?? 1
                let range = max(0.001, maxVal - minVal)
                var path = Path()
                for (idx, val) in points.enumerated() {
                    let x = CGFloat(idx) / CGFloat(points.count - 1) * size.width
                    let normalized = (val - minVal) / range
                    let y = size.height - CGFloat(normalized) * size.height
                    if idx == 0 {
                        path.move(to: CGPoint(x: x, y: y))
                    } else {
                        path.addLine(to: CGPoint(x: x, y: y))
                    }
                }
                ctx.stroke(path, with: .color(Color.appAccentPurple), lineWidth: 1.5)
            }
        } else {
            Rectangle().fill(.clear)
        }
    }

    private func formatOdds(_ pct: Double?) -> String {
        guard let pct = pct else { return "—" }
        // pct is 0...100 from RN cache; we render as `%`.
        return "\(Int(pct.rounded()))%"
    }

    private func loadMarkets() async {
        isLoading = true
        let result = await PolymarketService.shared.markets(
            league: league,
            awayTeam: awayTeam,
            homeTeam: homeTeam
        )
        await MainActor.run {
            self.data = result
            self.isLoading = false
        }
    }
}

#Preview {
    PolymarketWidget(league: "nfl", awayTeam: "Dallas", homeTeam: "Philadelphia")
        .padding()
        .background(Color.appSurface)
}
