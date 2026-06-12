import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Model Accuracy: 2x2 overall-tally grid per bet type, then a segmented
/// bet-type selector driving the bucket drill-down table (>= 3 graded games,
/// ranked by win%). Mirrors RN `AccuracyBody`.
struct RegressionAccuracySection: View {
    let accuracy: MLBBucketAccuracy?
    let loading: Bool
    @State private var tab: String = "full_ml"

    var body: some View {
        if loading && accuracy == nil {
            skeleton
                .transition(.opacity)
        } else if let acc = accuracy {
            VStack(spacing: 14) {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(Regression.betTypes, id: \.key) { betType in
                        tile(label: betType.label, tally: acc.betType(betType.key).overall)
                    }
                }

                RegressionSegmentedTabs(options: Regression.betTypes, selection: $tab)

                let buckets = acc.betType(tab).byBucket
                    .filter { $0.games >= 3 }
                    .sorted { $0.winPct > $1.winPct }

                if buckets.isEmpty {
                    Text("No buckets with 3+ graded games yet.")
                        .font(.system(size: 12)).italic()
                        .foregroundStyle(Color.appTextSecondary)
                        .padding(.top, 4)
                } else {
                    bucketTable(buckets)
                }
            }
        } else {
            // Accuracy fetch failed/empty — the parent always pins this
            // section's header, so render an explicit empty row instead of
            // leaving the header floating over nothing.
            Text("Model accuracy data unavailable right now. Pull to refresh.")
                .font(.system(size: 12)).italic()
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func tile(label: String, tally: MLBBucketTally) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(1)
                .foregroundStyle(Color.appTextSecondary)
            Text(String(format: "%.1f%%", tally.winPct))
                .font(.system(size: 26, weight: .heavy))
                .tracking(-0.5)
                .foregroundStyle(Regression.winPctColor(tally.winPct))
            Text("\(tally.wins)-\(tally.games - tally.wins)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text(String(format: "%+.1f%% · %+.2fu", tally.roiPct, tally.unitsWon))
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Regression.roiColor(tally.unitsWon))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.appSurfaceMuted.opacity(0.4), in: RoundedRectangle(cornerRadius: 14))
    }

    private func bucketTable(_ buckets: [MLBBucketBucket]) -> some View {
        VStack(spacing: 4) {
            HStack {
                Text("BUCKET").frame(maxWidth: .infinity, alignment: .leading)
                Text("RECORD").frame(width: 62, alignment: .trailing)
                Text("W%").frame(width: 48, alignment: .trailing)
                Text("ROI").frame(width: 56, alignment: .trailing)
            }
            .font(.system(size: 10, weight: .bold))
            .tracking(0.5)
            .foregroundStyle(Color.appTextSecondary)
            .padding(.horizontal, 10)
            .padding(.bottom, 4)

            ForEach(Array(buckets.enumerated()), id: \.offset) { _, b in
                let label = [b.bucket, b.side, b.favDog, b.direction]
                    .compactMap { $0 }
                    .filter { !$0.isEmpty }
                    .joined(separator: " / ")
                HStack {
                    Text(label)
                        .font(.system(size: 12))
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .foregroundStyle(Color.appTextPrimary)
                    Text("\(b.wins)-\(b.games - b.wins)")
                        .font(.system(size: 12))
                        .monospacedDigit()
                        .frame(width: 62, alignment: .trailing)
                        .foregroundStyle(Color.appTextSecondary)
                    // Regression.trimmed keeps 1-dp parity with RN and the
                    // sibling breakdown tables (and the bucket_win_pct quoted
                    // on pick cards).
                    Text(Regression.trimmed(b.winPct) + "%")
                        .font(.system(size: 12, weight: .bold))
                        .monospacedDigit()
                        .frame(width: 48, alignment: .trailing)
                        .foregroundStyle(Regression.winPctColor(b.winPct))
                    Text(String(format: "%+.1f%%", b.roiPct))
                        .font(.system(size: 12, weight: .semibold))
                        .monospacedDigit()
                        .frame(width: 56, alignment: .trailing)
                        .foregroundStyle(Regression.roiColor(b.roiPct))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    /// Mirrors the loaded layout: 2x2 tile grid, segmented bar, table rows.
    private var skeleton: some View {
        VStack(spacing: 14) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(0..<4, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: 4) {
                        SkeletonBlock(width: 60, height: 9)
                        SkeletonBlock(width: 80, height: 24)
                        SkeletonBlock(width: 50, height: 11)
                        SkeletonBlock(width: 100, height: 10)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .shimmering()
                    .background(Color.appSurfaceMuted.opacity(0.4), in: RoundedRectangle(cornerRadius: 14))
                }
            }

            SkeletonBlock(height: 34, cornerRadius: 10)
                .shimmering()

            VStack(spacing: 4) {
                ForEach(0..<4, id: \.self) { _ in
                    HStack {
                        SkeletonBlock(width: 120, height: 12).frame(maxWidth: .infinity, alignment: .leading)
                        SkeletonBlock(width: 44, height: 12).frame(width: 62, alignment: .trailing)
                        SkeletonBlock(width: 34, height: 12).frame(width: 48, alignment: .trailing)
                        SkeletonBlock(width: 40, height: 12).frame(width: 56, alignment: .trailing)
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
