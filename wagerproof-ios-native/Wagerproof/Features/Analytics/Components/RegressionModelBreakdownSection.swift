import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Day-of-Week & Team Breakdown: segmented bet-type tabs over two ranked
/// tables — by day (Mon..Sun) and by team (sorted by ROI, with logos).
/// Mirrors RN `ModelBreakdownBody` reading `mlb_model_breakdown_accuracy`.
struct RegressionModelBreakdownSection: View {
    let store: MLBModelBreakdownStore
    @State private var tab: String = "full_ml"

    var body: some View {
        if store.loading && store.rows.isEmpty {
            skeleton.transition(.opacity)
        } else if !store.rows.isEmpty {
            let dowRows = store.dowRows(betType: tab)
            let teamRows = store.teamRows(betType: tab)

            VStack(alignment: .leading, spacing: 0) {
                RegressionSegmentedTabs(options: Regression.betTypes, selection: $tab)

                if !dowRows.isEmpty {
                    table(title: "BY DAY OF WEEK", valueLabel: "DAY", rows: dowRows, showLogo: false)
                }
                if !teamRows.isEmpty {
                    table(title: "BY TEAM (SORTED BY ROI)", valueLabel: "TEAM", rows: teamRows, showLogo: true)
                }
                if dowRows.isEmpty && teamRows.isEmpty {
                    Text("No graded picks yet for this bet type.")
                        .font(.system(size: 12)).italic()
                        .foregroundStyle(Color.appTextSecondary)
                        .padding(.top, 12)
                }
            }
        }
        // RN returns nothing when the table has no rows at all.
    }

    private func table(title: String, valueLabel: String, rows: [MLBModelBreakdownRow], showLogo: Bool) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
                .padding(.bottom, 2)

            HStack {
                Text(valueLabel).frame(maxWidth: .infinity, alignment: .leading)
                Text("RECORD").frame(width: 66, alignment: .trailing)
                Text("W%").frame(width: 58, alignment: .trailing)
                Text("ROI").frame(width: 68, alignment: .trailing)
            }
            .font(.system(size: 10, weight: .bold))
            .tracking(0.5)
            .foregroundStyle(Color.appTextSecondary)
            .padding(.horizontal, 10)

            ForEach(Array(rows.enumerated()), id: \.offset) { _, r in
                row(r, showLogo: showLogo)
            }
        }
        .padding(.top, 14)
    }

    private func row(_ r: MLBModelBreakdownRow, showLogo: Bool) -> some View {
        HStack {
            HStack(spacing: 6) {
                if showLogo, let urlString = MLBAbbrLogo.url(forAbbr: r.breakdownValue), let url = URL(string: urlString) {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFit()
                    } placeholder: {
                        Color.clear
                    }
                    .frame(width: 18, height: 18)
                }
                Text(r.breakdownValue)
                    .font(.system(size: 12, weight: .semibold))
                    .lineLimit(1)
                    .foregroundStyle(Color.appTextPrimary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Text("\(r.wins)-\(r.losses)" + (r.pushes > 0 ? "-\(r.pushes)" : ""))
                .font(.system(size: 12))
                .monospacedDigit()
                .frame(width: 66, alignment: .trailing)
                .foregroundStyle(Color.appTextSecondary)
            Text(Regression.trimmed(r.winPct) + "%")
                .font(.system(size: 12, weight: .bold))
                .monospacedDigit()
                .frame(width: 58, alignment: .trailing)
                .foregroundStyle(Regression.winPctColor(r.winPct))
            Text(Regression.signedTrimmedPct(r.roiPct))
                .font(.system(size: 12, weight: .semibold))
                .monospacedDigit()
                .frame(width: 68, alignment: .trailing)
                .foregroundStyle(Regression.roiColor(r.roiPct))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 8))
    }

    private var skeleton: some View {
        VStack(spacing: 10) {
            SkeletonBlock(height: 34, cornerRadius: 10)
                .shimmering()
            VStack(spacing: 4) {
                ForEach(0..<5, id: \.self) { _ in
                    HStack {
                        SkeletonBlock(width: 90, height: 12).frame(maxWidth: .infinity, alignment: .leading)
                        SkeletonBlock(width: 44, height: 12).frame(width: 66, alignment: .trailing)
                        SkeletonBlock(width: 34, height: 12).frame(width: 58, alignment: .trailing)
                        SkeletonBlock(width: 40, height: 12).frame(width: 68, alignment: .trailing)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .shimmering()
                    .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 8))
                }
            }
        }
    }
}
