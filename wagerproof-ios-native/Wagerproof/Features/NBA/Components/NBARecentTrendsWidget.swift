import SwiftUI
import WagerproofDesign
import WagerproofModels

/// NBA recent-trends widget for the game bottom sheet. Mirrors RN
/// `components/nba/RecentTrendsWidget.tsx`. Collapsible card that lays out
/// 10 head-to-head metrics with directional color coding (green if a team's
/// number is better than the opponent's; lowerIsBetter inverts for the
/// defensive-rating row).
struct NBARecentTrendsWidget: View {
    let awayTeam: String
    let homeTeam: String
    let trends: NBAGameTrends?
    let isLoading: Bool

    /// Expansion is driven by the hosting `WidgetSection` header (title +
    /// chevron + card chrome live there), shared with the other pinned widgets.
    @Binding var expanded: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if isLoading {
                ProgressView()
                    .padding(20)
                    .frame(maxWidth: .infinity)
            } else if expanded {
                content
            } else {
                Text("Tap to view recent head-to-head trends")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let trends {
            VStack(spacing: 8) {
                tableHeader
                ForEach(Array(metrics(trends).enumerated()), id: \.offset) { idx, metric in
                    metricRow(metric, index: idx)
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 12)
        } else {
            VStack(spacing: 12) {
                Image(systemName: "info.circle")
                    .font(.system(size: 32))
                    .foregroundStyle(Color.appTextSecondary)
                Text("No trend data available for this matchup")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(24)
            .padding(.bottom, 12)
        }
    }

    @ViewBuilder
    private var tableHeader: some View {
        HStack {
            GameCardTeamAvatar(teamName: awayTeam, sport: "nba", size: 32)
                .frame(width: 70)
            Text("METRIC")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity)
            GameCardTeamAvatar(teamName: homeTeam, sport: "nba", size: 32)
                .frame(width: 70)
        }
        .padding(.bottom, 8)
        .overlay(Rectangle().frame(height: 1).foregroundStyle(Color.appBorder), alignment: .bottom)
    }

    private struct Metric {
        let name: String
        let awayValue: Double?
        let homeValue: Double?
        let format: (Double?) -> String
        let lowerIsBetter: Bool
        let noColor: Bool
    }

    private func metrics(_ t: NBAGameTrends) -> [Metric] {
        [
            Metric(name: "Overall Rating", awayValue: t.awayOvrRtg, homeValue: t.homeOvrRtg, format: Self.formatDecimal2, lowerIsBetter: false, noColor: false),
            Metric(name: "Consistency Rating", awayValue: t.awayConsistency, homeValue: t.homeConsistency, format: Self.formatDecimal2, lowerIsBetter: false, noColor: false),
            Metric(name: "Win Streak", awayValue: t.awayWinStreak, homeValue: t.homeWinStreak, format: Self.formatInt, lowerIsBetter: false, noColor: false),
            Metric(name: "ATS %", awayValue: t.awayAtsPct, homeValue: t.homeAtsPct, format: Self.formatPercent, lowerIsBetter: false, noColor: false),
            Metric(name: "ATS Streak", awayValue: t.awayAtsStreak, homeValue: t.homeAtsStreak, format: Self.formatInt, lowerIsBetter: false, noColor: false),
            Metric(name: "Last Game Score Margin", awayValue: t.awayLastMargin, homeValue: t.homeLastMargin, format: Self.formatDecimal1, lowerIsBetter: false, noColor: false),
            Metric(name: "Over/Under %", awayValue: t.awayOverPct, homeValue: t.homeOverPct, format: Self.formatPercent, lowerIsBetter: false, noColor: true),
            Metric(name: "Pace Trend (Last 3)", awayValue: t.awayAdjPacePregameL3Trend, homeValue: t.homeAdjPacePregameL3Trend, format: Self.formatDecimal2, lowerIsBetter: false, noColor: false),
            Metric(name: "Off. Rating Trend (L3)", awayValue: t.awayAdjOffRtgPregameL3Trend, homeValue: t.homeAdjOffRtgPregameL3Trend, format: Self.formatDecimal2, lowerIsBetter: false, noColor: false),
            Metric(name: "Def. Rating Trend (L3)", awayValue: t.awayAdjDefRtgPregameL3Trend, homeValue: t.homeAdjDefRtgPregameL3Trend, format: Self.formatDecimal2, lowerIsBetter: true, noColor: false)
        ]
    }

    @ViewBuilder
    private func metricRow(_ m: Metric, index: Int) -> some View {
        let awayColor = trendColor(my: m.awayValue, other: m.homeValue, lowerIsBetter: m.lowerIsBetter, noColor: m.noColor)
        let homeColor = trendColor(my: m.homeValue, other: m.awayValue, lowerIsBetter: m.lowerIsBetter, noColor: m.noColor)
        HStack {
            Text(m.format(m.awayValue))
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(awayColor)
                .frame(width: 70, alignment: .center)
            Text(m.name)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
            Text(m.format(m.homeValue))
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(homeColor)
                .frame(width: 70, alignment: .center)
        }
        .padding(.vertical, 8)
        .background(index.isMultiple(of: 2) ? Color.appTextMuted.opacity(0.04) : .clear)
    }

    private func trendColor(my: Double?, other: Double?, lowerIsBetter: Bool, noColor: Bool) -> Color {
        if noColor { return Color.appTextPrimary }
        guard let my, let other else { return Color.appTextPrimary }
        if lowerIsBetter {
            if my < other { return Color.appPrimary }
            if my > other { return Color.appAccentRed }
        } else {
            if my > other { return Color.appPrimary }
            if my < other { return Color.appAccentRed }
        }
        return Color.appTextPrimary
    }

    // MARK: - Format helpers

    private static func formatDecimal2(_ v: Double?) -> String {
        guard let v else { return "-" }
        return String(format: "%.2f", v)
    }

    private static func formatDecimal1(_ v: Double?) -> String {
        guard let v else { return "-" }
        return String(format: "%.1f", v)
    }

    private static func formatPercent(_ v: Double?) -> String {
        guard let v else { return "-" }
        return String(format: "%.1f%%", v * 100)
    }

    private static func formatInt(_ v: Double?) -> String {
        guard let v else { return "-" }
        return String(Int(v.rounded()))
    }
}
