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
                        signalRow(for: signal)
                    }
                }
            }
        }
    }

    // MARK: - Rows

    private func signalRow(for signal: TrendsSignal) -> some View {
        let badge = badgeContent(for: signal)
        return InsightSignalRow(
            title: "\(signal.situationTitle) · \(signal.metricLabel)",
            badgeText: badge.text,
            badgeTint: badge.tint,
            bar: SignalSplitBar(
                awayValue: signal.awayPct,
                homeValue: signal.homePct,
                awayNumeral: numeral(pct: signal.awayPct, record: signal.awayDetail),
                homeNumeral: numeral(pct: signal.homePct, record: signal.homeDetail),
                awayTint: trendsPctColor(signal.awayPct),
                homeTint: trendsPctColor(signal.homePct)
            )
        )
    }

    private func badgeContent(for signal: TrendsSignal) -> (text: String, tint: Color) {
        switch signal.kind {
        case .side(let leader, let abbr, let gap):
            // Leader badge tints by the leader's own pct color (green at the
            // 55 floor by construction).
            let leaderPct = leader == .away ? signal.awayPct : signal.homePct
            return ("\(abbr) +\(Int(gap.rounded()))", trendsPctColor(leaderPct))
        case .over:
            return ("OVER", Color(hex: 0x22C55E))
        case .under:
            // Legacy adapter convention — under leans read blue, not red.
            return ("UNDER", Color(hex: 0x3B82F6))
        }
    }

    /// MLB numerals are percent-only ("71%"); NBA/NCAAB pair the record with
    /// the pct ("12-5 (71%)", trailing "-0" push trimmed).
    private func numeral(pct: Double?, record: String?) -> String {
        guard let pct else { return "—" }
        let pctLabel = "\(Int(pct.rounded()))%"
        guard let record, !record.isEmpty, record != "-" else { return pctLabel }
        let trimmed = record.hasSuffix("-0") ? String(record.dropLast(2)) : record
        return "\(trimmed) (\(pctLabel))"
    }
}
