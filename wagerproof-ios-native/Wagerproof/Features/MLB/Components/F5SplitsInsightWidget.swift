import SwiftUI
import WagerproofDesign
import WagerproofModels

/// "First-5 Innings" insight widget for the MLB game-detail sheet. Renders the
/// `MLBF5Insight` digest — verdict line + qualifier + the three §1c compare
/// rows (F5 win %, runs scored, runs allowed in the own-starter-hand split) —
/// over `SignalSplitBar` tug bars. Expanding presents `F5SplitsDetailSheet`
/// with the full 11-row `F5GameCardView` depth.
struct F5SplitsInsightWidget: View {
    let summary: F5InsightSummary
    let onExpand: () -> Void

    private static let accent = Color(hex: 0x0EA5E9)

    var body: some View {
        InsightWidgetSection(
            title: "First-5 Innings",
            systemImage: "baseball.diamond.bases",
            iconTint: Self.accent,
            badge: summary.badge,
            expandLabel: "Full F5 breakdown",
            onExpand: onExpand
        ) {
            VStack(alignment: .leading, spacing: 12) {
                InsightVerdictLine(verdicts: summary.verdicts, accent: Self.accent)
                Text(summary.qualifier)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                ForEach(summary.rows) { row in
                    F5CompareRowView(row: row)
                }
                if let warning = summary.sampleWarning {
                    Text(warning)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Color.appAccentAmber)
                }
            }
        }
    }
}

/// One F5 compare row: metric title → split bar with side numerals → optional
/// per-side season-delta arrows (↑/↓ tinted by `goodWhenNegative`, matching
/// `F5GameCardView`'s existing flip).
private struct F5CompareRowView: View {
    let row: F5CompareRow

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(row.title)
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.4)
                .foregroundStyle(Color.appTextSecondary)
            SignalSplitBar(
                awayValue: row.awayValue,
                homeValue: row.homeValue,
                awayNumeral: row.awayNumeral,
                homeNumeral: row.homeNumeral,
                awayTint: tint(for: .away),
                homeTint: tint(for: .home)
            )
            if row.awayDelta != nil || row.homeDelta != nil {
                HStack {
                    deltaLabel(row.awayDelta)
                    Spacer()
                    deltaLabel(row.homeDelta)
                }
            }
        }
    }

    private func tint(for side: MatchupSide) -> Color {
        let value = side == .away ? row.awayValue : row.homeValue
        guard value != nil else { return Color.appBorder }
        switch row.metric {
        case .winPct:
            // Each half carries its own pct color (the values ARE percentages).
            return trendsPctColor(value)
        case .runsScored, .runsAllowed:
            return row.advantage == side ? Color.appWin : Color.appBorder
        }
    }

    @ViewBuilder
    private func deltaLabel(_ delta: Double?) -> some View {
        if let delta, delta.isFinite {
            let isGood = row.goodWhenNegative ? delta < 0 : delta > 0
            let isBad = row.goodWhenNegative ? delta > 0 : delta < 0
            let color: Color = isGood ? .appWin : (isBad ? .appLoss : .appTextSecondary)
            HStack(spacing: 2) {
                Image(systemName: delta > 0 ? "arrow.up" : (delta < 0 ? "arrow.down" : "minus"))
                    .font(.system(size: 8, weight: .bold))
                Text("\(MLBF5.formatDiff(delta, digits: 1)) vs season")
                    .font(.system(size: 9, weight: .semibold))
            }
            .foregroundStyle(color)
        } else {
            // Keep the HStack balanced when only one side has a delta.
            Color.clear.frame(width: 1, height: 1)
        }
    }
}
