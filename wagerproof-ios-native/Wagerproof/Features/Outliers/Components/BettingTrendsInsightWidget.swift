import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Collapsed "Betting Trends" digest for the game detail sheets (MLB, NBA,
/// NCAAB). Verdict line + the top 3 ranked situational signals as tug bars;
/// expanding (footer or header tap) presents the full 7/5-section matrix via
/// `BettingTrendsDetailSheet` — the host sheet owns that presentation through
/// `onExpand`. Summary math lives in Kit (`MLBTrendsInsight` and siblings) so
/// SearchStore teasers and this widget share one source of truth.
struct BettingTrendsInsightWidget: View {
    let summary: TrendsInsightSummary
    let awayAbbr: String
    let homeAbbr: String
    let accent: Color
    let onExpand: () -> Void

    var body: some View {
        InsightWidgetSection(
            title: "Betting Trends",
            systemImage: "chart.line.uptrend.xyaxis",
            iconTint: Color(hex: 0x8B5CF6),
            badge: summary.badge,
            headline: summary.headline,
            expandLabel: "View all \(summary.totalSituations) situations",
            onExpand: onExpand
        ) {
            VStack(alignment: .leading, spacing: 14) {
                InsightVerdictLine(verdicts: summary.verdicts, accent: accent)

                if summary.signals.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("No single comparison clears the strong-edge threshold. Closest comparisons:")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)

                        if summary.closestComparisons.isEmpty {
                            Text("Open the full matrix to compare every available historical rate.")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.appTextMuted)
                        } else {
                            ForEach(Array(summary.closestComparisons.prefix(3))) { comparison in
                                TrendSignalRow(signal: comparison)
                            }
                        }
                    }
                } else {
                    ForEach(Array(summary.signals.prefix(3))) { signal in
                        TrendSignalRow(signal: signal)
                    }
                }
            }
        }
    }
}
