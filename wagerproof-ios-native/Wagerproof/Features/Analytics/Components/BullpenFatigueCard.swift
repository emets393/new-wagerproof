import SwiftUI
import WagerproofDesign
import WagerproofModels

/// One bullpen in the fatigue/trend list. OVERWORKED (red) vs DECLINING
/// (amber) follows the row's `flag`. IP thresholds (13 over 3 days, 22 over
/// 5 days) match the RN highlight rules.
struct BullpenFatigueCard: View {
    let bullpen: MLBBullpenFatigue

    var body: some View {
        let overworked = bullpen.flag == "overworked"
        let color = overworked ? Regression.lossRed : Regression.warnAmber
        RegressionAccentRow(color: color) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(bullpen.teamName)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    Spacer()
                    RegressionPill(text: overworked ? "OVERWORKED" : "DECLINING", color: color)
                }
                HStack(spacing: 10) {
                    RegressionStat(
                        label: "IP L3d",
                        value: String(format: "%.1f", bullpen.bpIpLast3d),
                        color: bullpen.bpIpLast3d >= 13 ? Regression.lossRed : nil
                    )
                    RegressionStat(
                        label: "IP L5d",
                        value: String(format: "%.1f", bullpen.bpIpLast5d),
                        color: bullpen.bpIpLast5d >= 22 ? Regression.lossRed : nil
                    )
                    RegressionStat(
                        label: "SEASON xFIP",
                        value: bullpen.seasonBpXfip.map { String(format: "%.2f", $0) } ?? "-"
                    )
                    RegressionStat(
                        label: "TREND xFIP",
                        value: bullpen.trendBpXfip.map { Regression.signed($0, decimals: 2) } ?? "-",
                        color: bullpen.trendBpXfip.map { $0 > 0 ? Regression.lossRed : Regression.winGreen }
                    )
                }
            }
        }
    }
}
