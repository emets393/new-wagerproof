import SwiftUI
import Charts
import WagerproofModels
import WagerproofDesign

/// Recent-form bar chart for a player prop. Ports
/// `wagerproof-mobile/components/mlb/player-props/RecentPropBarChart.tsx`
/// from react-native-svg to Apple's `Charts` framework.
///
/// The behaviour the user asked for lives here: as the selected line changes
/// (via the slider/chips upstream), the dashed threshold line slides and the
/// bars recolor green/red in real time. We drive that by recomputing
/// `bars` + `line` upstream and animating the value change so SwiftUI
/// crossfades the colours and tweens the rule position.
///
/// Scaling mirrors RN exactly: `maxVal = max(line*1.5, maxBarValue, line+1, 1)`
/// keeps the threshold at a stable visual height as the line moves.
struct RecentPropBarChart: View {
    let bars: [MLBPropChartBar]
    let line: Double

    private var maxVal: Double {
        let vals = bars.map(\.value)
        return max(line * 1.5, (vals.max() ?? 0), line + 1, 1)
    }

    var body: some View {
        if bars.isEmpty {
            Text("No recent games")
                .font(.system(size: 13))
                .italic()
                .foregroundStyle(Color.appTextMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            chart
                .frame(height: 168)
        }
    }

    private var chart: some View {
        Chart {
            ForEach(bars) { bar in
                BarMark(
                    x: .value("Game", String(bar.id)),
                    y: .value("Value", bar.value),
                    width: .ratio(0.62)
                )
                .cornerRadius(2)
                .foregroundStyle(bar.cleared ? Color.appPrimary : Color.appLoss.opacity(0.7))
                .annotation(position: .top, spacing: 2) {
                    Text(MLBPlayerProps.formatBarValue(bar.value))
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(bar.cleared ? Color.appPrimary : Color.appLoss)
                }
            }

            // Dashed threshold for the currently-selected line.
            RuleMark(y: .value("Line", line))
                .lineStyle(StrokeStyle(lineWidth: 1.2, dash: [4, 3]))
                .foregroundStyle(Color.appPrimary.opacity(0.85))
                .annotation(position: .top, alignment: .trailing, spacing: 1) {
                    Text("Line \(MLBPlayerProps.formatBarValue(line))")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Color.appPrimary)
                }
        }
        // Fixed domain (oldest→newest) so bars never reorder as the line moves.
        .chartXScale(domain: bars.map { String($0.id) })
        .chartYScale(domain: 0...maxVal)
        .chartYAxis(.hidden)
        .chartLegend(.hidden)
        .chartXAxis(.hidden)
        // Animate threshold slide + bar recolor when the line changes.
        .animation(.easeInOut(duration: 0.25), value: line)
    }
}
