import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Yesterday's Results: hero tiles (yesterday record + Perfect Storm-tier
/// all-time record) over per-pick graded rows. The ALL-TIME hero
/// deliberately uses tier records from `mlb_graded_picks`, NOT
/// `report.cumulative_record` — RN dropped the legacy cumulative payload
/// once only tiered picks shipped.
struct RegressionRecapSection: View {
    let recap: [MLBYesterdayRecap]
    let psRecords: MLBPerfectStormRecords?

    var body: some View {
        VStack(spacing: 12) {
            heroRow
            if recap.isEmpty {
                Text("No picks graded yesterday.")
                    .font(.system(size: 12)).italic()
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 4)
            } else {
                VStack(spacing: 6) {
                    ForEach(Array(recap.enumerated()), id: \.offset) { _, r in
                        recapRow(r)
                    }
                }
            }
        }
    }

    private var heroRow: some View {
        let wins = recap.filter { $0.result == "won" }.count
        let losses = recap.filter { $0.result == "lost" }.count
        let pushes = recap.filter { $0.result == "push" }.count
        let total = wins + losses
        let yPct = total > 0 ? Double(wins) / Double(total) * 100 : 0
        let yRecord = pushes > 0 ? "\(wins)-\(losses)-\(pushes)" : "\(wins)-\(losses)"

        return HStack(spacing: 10) {
            RegressionHeroTile(
                label: "YESTERDAY",
                primary: yRecord,
                secondary: Text(total > 0 ? "\(Int(yPct.rounded()))% win rate" : "No graded picks")
                    .foregroundStyle(total > 0 ? Regression.winPctColor(yPct) : Color.appTextSecondary)
            )

            if let records = psRecords {
                let cum = records.combined
                if cum.wins + cum.losses + cum.pushes > 0 {
                    let record = cum.pushes > 0
                        ? "\(cum.wins)-\(cum.losses)-\(cum.pushes)"
                        : "\(cum.wins)-\(cum.losses)"
                    RegressionHeroTile(
                        label: "ALL-TIME",
                        primary: record,
                        secondary:
                            Text(Regression.signed(cum.units, decimals: 2) + "u")
                                .foregroundStyle(Regression.roiColor(cum.units))
                            + Text("  ·  ").foregroundStyle(Color.appTextSecondary)
                            + Text(Regression.signed(cum.roiPct, decimals: 1) + "%")
                                .foregroundStyle(Regression.roiColor(cum.roiPct))
                    )
                }
            }
        }
    }

    private func recapRow(_ r: MLBYesterdayRecap) -> some View {
        let bar: Color = r.result == "won" ? Regression.winGreen
            : r.result == "lost" ? Regression.lossRed
            : Regression.neutralGray
        return RegressionAccentRow(color: bar) {
            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(r.pick)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                    Text(r.matchup)
                        .font(.system(size: 11))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 2) {
                    Text(r.actualScore)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text(r.result.uppercased())
                        .font(.system(size: 10, weight: .heavy))
                        .tracking(0.5)
                        .foregroundStyle(bar)
                }
            }
        }
    }
}
