import SwiftUI
import Charts
import WagerproofDesign
import WagerproofModels

/// Native port of `components/agents/AgentPerformanceCharts.tsx`. Renders
/// cumulative-units line chart(s) for an agent — one overall + one per sport.
///
/// RN uses victory-native / skia for charts; we use Apple's `Charts` framework
/// which runs on UI thread Metal natively. Cumulative units is computed
/// client-side from the pick result + units/odds — same Formula B used by the
/// agent-performance recalc RPC.
struct AgentPerformanceCharts: View {
    let allPicks: [AgentPick]
    let preferredSports: [AgentSport]
    let agentColor: Color

    private struct ChartPoint: Identifiable {
        let id = UUID()
        let index: Int
        let cumulative: Double
    }

    private struct SportStats {
        let sport: AgentSport?
        let label: String
        let wins: Int
        let losses: Int
        let pushes: Int
        let netUnits: Double
        let points: [ChartPoint]
    }

    private var settledPicks: [AgentPick] {
        allPicks.filter { $0.result == .won || $0.result == .lost || $0.result == .push }
            .sorted { $0.createdAt < $1.createdAt }
    }

    private var overallStats: SportStats {
        compute(label: "Overall", picks: settledPicks, sport: nil)
    }

    private var sportStats: [SportStats] {
        preferredSports.compactMap { sport in
            let scoped = settledPicks.filter { $0.sport == sport }
            guard scoped.count >= 2 else { return nil }
            return compute(label: sport.label, picks: scoped, sport: sport)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if overallStats.points.count < 3 {
                emptyState
            } else {
                Text("Performance")
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                overallCard
                if sportStats.count > 1 {
                    Text("By Sport")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .padding(.top, 4)
                    ForEach(Array(sportStats.enumerated()), id: \.offset) { _, stats in
                        sportCard(stats: stats)
                    }
                }
            }
        }
    }

    // MARK: - Subviews

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Color.appTextSecondary)
            Text("Performance charts will appear after picks are graded")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(28)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.appSurfaceElevated)
        )
    }

    private var overallCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Cumulative Units")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                Text(unitsLabel(overallStats.netUnits))
                    .font(.system(size: 14, weight: .heavy, design: .monospaced))
                    .foregroundStyle(overallStats.netUnits >= 0 ? Color.appWin : Color.appLoss)
            }

            Chart(overallStats.points) { point in
                LineMark(
                    x: .value("Index", point.index),
                    y: .value("Units", point.cumulative)
                )
                .interpolationMethod(.monotone)
                .foregroundStyle(overallStats.netUnits >= 0 ? Color.appWin : Color.appLoss)
                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))

                AreaMark(
                    x: .value("Index", point.index),
                    y: .value("Units", point.cumulative)
                )
                .interpolationMethod(.monotone)
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            (overallStats.netUnits >= 0 ? Color.appWin : Color.appLoss).opacity(0.2),
                            .clear
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }
            .chartXAxis {
                AxisMarks(position: .bottom) { value in
                    AxisGridLine().foregroundStyle(Color.appBorder.opacity(0.3))
                    AxisValueLabel {
                        if let n = value.as(Int.self) {
                            Text(n == 0 ? "Start" : (n == overallStats.points.count - 1 ? "Now" : ""))
                                .font(.system(size: 10))
                        }
                    }
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisGridLine().foregroundStyle(Color.appBorder.opacity(0.3))
                    AxisValueLabel {
                        if let v = value.as(Double.self) {
                            Text(String(format: "%+.1f", v)).font(.system(size: 10))
                        }
                    }
                }
            }
            .frame(height: 180)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.appSurfaceElevated)
        )
    }

    private func sportCard(stats: SportStats) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(stats.label)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                Text("\(stats.wins)-\(stats.losses)\(stats.pushes > 0 ? "-\(stats.pushes)" : "")")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                Text(unitsLabel(stats.netUnits))
                    .font(.system(size: 13, weight: .heavy, design: .monospaced))
                    .foregroundStyle(stats.netUnits >= 0 ? Color.appWin : Color.appLoss)
            }

            if stats.points.count > 1 {
                Chart(stats.points) { point in
                    LineMark(
                        x: .value("Index", point.index),
                        y: .value("Units", point.cumulative)
                    )
                    .interpolationMethod(.monotone)
                    .foregroundStyle(stats.netUnits >= 0 ? Color.appWin : Color.appLoss)
                    .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
                }
                .chartXAxis(.hidden)
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisGridLine().foregroundStyle(Color.appBorder.opacity(0.25))
                        AxisValueLabel {
                            if let v = value.as(Double.self) {
                                Text(String(format: "%+.0f", v)).font(.system(size: 9))
                            }
                        }
                    }
                }
                .frame(height: 110)
            } else {
                Text("No graded picks yet")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity, minHeight: 60)
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.appSurfaceElevated)
        )
    }

    // MARK: - Stats compute

    /// Cumulative-units series via Formula B (matches `recalculate_avatar_performance`).
    private func compute(label: String, picks: [AgentPick], sport: AgentSport?) -> SportStats {
        var cumulative: Double = 0
        var points: [ChartPoint] = []
        var wins = 0, losses = 0, pushes = 0

        // Seed at 0
        points.append(ChartPoint(index: 0, cumulative: 0))

        for (idx, pick) in picks.enumerated() {
            switch pick.result {
            case .won:
                wins += 1
                cumulative += unitDelta(units: pick.units, odds: pick.odds, won: true)
            case .lost:
                losses += 1
                cumulative += unitDelta(units: pick.units, odds: pick.odds, won: false)
            case .push:
                pushes += 1
            case .pending:
                continue
            }
            points.append(ChartPoint(index: idx + 1, cumulative: cumulative))
        }

        return SportStats(
            sport: sport,
            label: label,
            wins: wins,
            losses: losses,
            pushes: pushes,
            netUnits: cumulative,
            points: points
        )
    }

    private func unitDelta(units: Double, odds: String?, won: Bool) -> Double {
        guard won else { return -units }
        guard let oddsStr = odds,
              let oddsInt = Int(oddsStr.replacingOccurrences(of: "+", with: ""))
        else {
            // Default to -110 payout on missing odds
            return units * (100.0 / 110.0)
        }
        if oddsInt > 0 {
            return units * (Double(oddsInt) / 100.0)
        }
        return units * (100.0 / Double(abs(oddsInt)))
    }

    private func unitsLabel(_ n: Double) -> String {
        let sign = n >= 0 ? "+" : ""
        return String(format: "%@%.2fu", sign, n)
    }
}
