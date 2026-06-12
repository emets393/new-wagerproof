import SwiftUI
import WagerproofDesign
import WagerproofModels

/// One starting pitcher regression candidate. Same card for both groups —
/// the negative/positive split lives in the section's group labels; the
/// accent + pill color is driven by per-row severity.
struct PitcherRegressionCard: View {
    let pitcher: MLBPitcherRegression

    var body: some View {
        let sev = Regression.severityColor(pitcher.severity)
        RegressionAccentRow(color: sev) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        (Text(pitcher.pitcherName)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                         + Text("  \(pitcher.teamName)")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.appTextSecondary))
                            .lineLimit(1)
                        if let opponent = pitcher.opponent {
                            Text("vs \(opponent)")
                                .font(.system(size: 11))
                                .foregroundStyle(Color.appTextSecondary)
                                .lineLimit(1)
                        }
                    }
                    Spacer()
                    RegressionPill(text: pitcher.severity.uppercased(), color: sev)
                }

                HStack(spacing: 10) {
                    RegressionStat(label: "ERA", value: String(format: "%.2f", pitcher.era))
                    RegressionStat(label: "xFIP", value: String(format: "%.2f", pitcher.xfip))
                    RegressionStat(
                        label: "GAP",
                        value: Regression.signed(pitcher.eraMinusXfip, decimals: 2),
                        color: gapColor(pitcher.eraMinusXfip)
                    )
                    RegressionStat(label: "xwOBA", value: pitcher.xwoba.map { String(format: "%.3f", $0) } ?? "-")
                }
                HStack(spacing: 10) {
                    RegressionStat(label: "WHIP", value: pitcher.whip.map { String(format: "%.2f", $0) } ?? "-")
                    RegressionStat(label: "K%", value: pitcher.kPct.map { String(format: "%.1f%%", $0) } ?? "-")
                    RegressionStat(label: "BB%", value: pitcher.bbPct.map { String(format: "%.1f%%", $0) } ?? "-")
                    RegressionStat(
                        label: "xFIP L3",
                        value: pitcher.trendXfip.map { Regression.signed($0, decimals: 2) } ?? "-",
                        color: pitcher.trendXfip.flatMap(trendColor)
                    )
                }
            }
        }
    }

    private func gapColor(_ gap: Double) -> Color? {
        if gap > 0.5 { return Regression.lossRed }
        if gap < -0.5 { return Regression.winGreen }
        return nil
    }

    // Rising xFIP trend = degrading pitcher → red.
    private func trendColor(_ value: Double) -> Color? {
        if value > 0.3 { return Regression.lossRed }
        if value < -0.3 { return Regression.winGreen }
        return nil
    }
}
