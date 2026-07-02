import SwiftUI
import Charts
import WagerproofDesign
import WagerproofModels

/// Multi-sport comparison: the fitted normal (bell) curves for each sport drawn
/// on one axis so their centers + spreads line up for direct comparison. Curves
/// are peak-normalized (height 1 at the mean) so cohort size doesn't distort the
/// shape read — the point is where each sport centers and how tight it is.
///
/// The NFL series is the estimated placeholder (dashed) — see AgentStatsView.
struct FittedCurveOverlayChart: View {
    struct Series: Identifiable {
        let name: String
        let color: Color
        let isEstimated: Bool
        let points: [CurvePoint]
        var id: String { name }
    }

    let series: [Series]
    let domain: ClosedRange<Double>
    var height: CGFloat = 220

    var body: some View {
        Chart {
            ForEach(series) { s in
                ForEach(s.points) { point in
                    LineMark(
                        x: .value("Win %", point.x),
                        y: .value("Density", point.y),
                        series: .value("Sport", s.name)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(by: .value("Sport", s.name))
                    .lineStyle(StrokeStyle(lineWidth: 2.5, dash: s.isEstimated ? [5, 3] : []))
                }
            }

            RuleMark(x: .value("Break-even", 0.5238))
                .lineStyle(StrokeStyle(lineWidth: 1))
                .foregroundStyle(Color.appLoss.opacity(0.5))
        }
        .chartForegroundStyleScale(domain: series.map(\.name), range: series.map(\.color))
        .chartXScale(domain: domain.lowerBound...domain.upperBound)
        .chartXAxis {
            AxisMarks { value in
                AxisGridLine().foregroundStyle(Color.appBorder.opacity(0.22))
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text("\(Int((v * 100).rounded()))%").font(.system(size: 10))
                    }
                }
            }
        }
        .chartYAxis(.hidden)
        .chartLegend(position: .bottom, spacing: 10)
        .frame(height: height)
    }
}
