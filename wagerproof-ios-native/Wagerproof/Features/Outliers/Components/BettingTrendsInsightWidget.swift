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
            expandLabel: "See all \(summary.totalSituations) situations",
            onExpand: onExpand
        ) {
            VStack(alignment: .leading, spacing: 14) {
                InsightVerdictLine(verdicts: summary.verdicts, accent: accent)

                if summary.signals.isEmpty {
                    // Present-but-quiet: zero qualifying signals is information
                    // too; the expand footer keeps the full matrix reachable.
                    Text("No situational edge in today's data")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 6)
                } else {
                    ForEach(Array(summary.signals.prefix(3))) { signal in
                        TrendSignalRow(signal: signal)
                    }
                }
            }
        }
    }
}
