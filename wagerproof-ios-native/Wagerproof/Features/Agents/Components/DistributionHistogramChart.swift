import SwiftUI
import Charts
import WagerproofDesign
import WagerproofModels

/// The hero + per-sport chart on the Agents "Platform Statistics" screen: a
/// win-rate (or net-units) histogram with a fitted normal (bell) curve laid over
/// it, plus mean and break-even reference lines.
///
/// Deliberately axis-as-SHARE (% of agents), never raw counts — the screen never
/// exposes population sizes. Tapping a bar calls `onSelectBin` (drill-down).
/// A fit flagged `isEstimated` (the NFL placeholder) draws its curve dashed/grey
/// so it never reads as observed data.
struct DistributionHistogramChart: View {
    let buckets: [DistributionBucket]
    let curve: [CurvePoint]
    let fit: NormalFit?
    let domain: ClosedRange<Double>
    let metric: StatMetric
    var accent: Color = .appAccentBlue
    var height: CGFloat = 220
    var showReferenceLines: Bool = true
    var onSelectBin: ((DistributionBucket) -> Void)? = nil

    /// Break-even win rate at standard -110 juice (52.38%). The line that
    /// separates "wins more than half" from "actually beats the vig".
    private let breakEven = 0.5238

    private var curveColor: Color { fit?.isEstimated == true ? Color.appTextSecondary : accent }

    var body: some View {
        Chart {
            ForEach(buckets) { bucket in
                BarMark(
                    x: .value("Value", bucket.mid),
                    y: .value("Share", bucket.share),
                    width: .ratio(0.9)
                )
                .foregroundStyle(accent.opacity(0.32))
                .cornerRadius(3)
            }

            ForEach(curve) { point in
                LineMark(
                    x: .value("Value", point.x),
                    y: .value("Fit", point.y)
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(curveColor)
                .lineStyle(StrokeStyle(
                    lineWidth: 2.5,
                    dash: fit?.isEstimated == true ? [5, 3] : []
                ))
            }

            if showReferenceLines, let fit {
                RuleMark(x: .value("Mean", fit.mean))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    .foregroundStyle(Color.appTextMuted)
                    .annotation(position: .top, alignment: .center, spacing: 2) {
                        Text(valueLabel(fit.mean))
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Color.appTextSecondary)
                    }
            }

            if showReferenceLines {
                RuleMark(x: .value("Reference", metric == .winRate ? breakEven : 0))
                    .lineStyle(StrokeStyle(lineWidth: 1))
                    .foregroundStyle((metric == .winRate ? Color.appLoss : Color.appTextMuted).opacity(0.55))
            }
        }
        .chartXScale(domain: domain.lowerBound...domain.upperBound)
        .chartXAxis {
            AxisMarks { value in
                AxisGridLine().foregroundStyle(Color.appBorder.opacity(0.22))
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text(axisLabel(v)).font(.system(size: 10))
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) { value in
                AxisGridLine().foregroundStyle(Color.appBorder.opacity(0.18))
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text("\(Int((v * 100).rounded()))%").font(.system(size: 9))
                    }
                }
            }
        }
        .chartOverlay { proxy in
            GeometryReader { geo in
                if let onSelectBin {
                    Rectangle()
                        .fill(Color.clear)
                        .contentShape(Rectangle())
                        .onTapGesture(coordinateSpace: .local) { location in
                            guard let plotFrame = proxy.plotFrame else { return }
                            let xInPlot = location.x - geo[plotFrame].origin.x
                            guard let value: Double = proxy.value(atX: xInPlot) else { return }
                            if let hit = buckets.first(where: { value >= $0.lower && value < $0.upper }) {
                                onSelectBin(hit)
                            } else if let last = buckets.last, value >= last.lower {
                                onSelectBin(last)
                            }
                        }
                }
            }
        }
        .frame(height: height)
    }

    private func valueLabel(_ v: Double) -> String {
        metric == .winRate ? "\(Int((v * 100).rounded()))%" : String(format: "%+.1fu", v)
    }

    private func axisLabel(_ v: Double) -> String {
        metric == .winRate ? "\(Int((v * 100).rounded()))%" : String(format: "%.0f", v)
    }
}
