import SwiftUI
import WagerproofDesign
import WagerproofModels

/// One team batting regression candidate (heat-up or cool-down — the split
/// lives in the section group labels; severity colors the accent/pill).
struct BattingRegressionCard: View {
    let team: MLBBattingRegression

    var body: some View {
        let sev = Regression.severityColor(team.severity)
        RegressionAccentRow(color: sev) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(team.teamName)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                        Text("\(team.games)G sample")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    Spacer()
                    if let severity = team.severity {
                        RegressionPill(text: severity.uppercased(), color: sev)
                    }
                }

                HStack(spacing: 10) {
                    RegressionStat(label: "wOBA", value: team.woba.map { String(format: "%.3f", $0) } ?? "-")
                    RegressionStat(label: "BABIP", value: String(format: "%.3f", team.babip))
                    RegressionStat(label: "xwOBACon", value: team.xwobacon.map { String(format: "%.3f", $0) } ?? "-")
                    RegressionStat(
                        label: "GAP",
                        value: team.wobaGap.map { Regression.signed($0, decimals: 3) } ?? "-",
                        color: team.wobaGap.flatMap(gapColor)
                    )
                }
                HStack(spacing: 10) {
                    RegressionStat(label: "HH%", value: team.hardHitPct.map { String(format: "%.1f%%", $0 * 100) } ?? "-")
                    RegressionStat(label: "BARREL%", value: team.barrelPct.map { String(format: "%.1f%%", $0 * 100) } ?? "-")
                    RegressionStat(label: "EV", value: team.avgEv.map { String(format: "%.1f", $0) } ?? "-")
                    RegressionStat(
                        label: "xwC L5",
                        value: team.trendXwobacon.map { Regression.signed($0, decimals: 3) } ?? "-",
                        color: team.trendXwobacon.flatMap(trendColor)
                    )
                }
            }
        }
    }

    private func gapColor(_ gap: Double) -> Color? {
        if gap > 0.03 { return Regression.lossRed }
        if gap < -0.03 { return Regression.winGreen }
        return nil
    }

    // Inverted vs pitchers: rising contact quality is GOOD for hitters.
    private func trendColor(_ value: Double) -> Color? {
        if value > 0.015 { return Regression.winGreen }
        if value < -0.015 { return Regression.lossRed }
        return nil
    }
}
