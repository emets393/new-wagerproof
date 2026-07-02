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
    /// Picks + parlay tickets — each settled parlay contributes exactly ONE
    /// point on the curve (its ticket-level payout), never per leg.
    let items: [AgentBetItem]
    let preferredSports: [AgentSport]
    let agentColor: Color
    /// When false the internal "Performance" heading is suppressed — used when a
    /// parent already provides a section header (the inline agent-detail layout).
    var showsTitle: Bool = true

    /// Picks-only convenience for callers without parlay data.
    init(
        allPicks: [AgentPick],
        preferredSports: [AgentSport],
        agentColor: Color,
        showsTitle: Bool = true
    ) {
        self.init(items: allPicks.map(AgentBetItem.pick),
                  preferredSports: preferredSports,
                  agentColor: agentColor,
                  showsTitle: showsTitle)
    }

    init(
        items: [AgentBetItem],
        preferredSports: [AgentSport],
        agentColor: Color,
        showsTitle: Bool = true
    ) {
        self.items = items
        self.preferredSports = preferredSports
        self.agentColor = agentColor
        self.showsTitle = showsTitle
    }

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

    private var settledItems: [AgentBetItem] {
        items.filter { $0.result == .won || $0.result == .lost || $0.result == .push }
            .sorted { $0.createdAt < $1.createdAt }
    }

    private var overallStats: SportStats {
        compute(label: "Overall", items: settledItems, sport: nil)
    }

    private var sportStats: [SportStats] {
        // Multi-sport parlays (sportForFilter == nil) count in Overall only —
        // they don't belong to any single sport's curve.
        preferredSports.compactMap { sport in
            let scoped = settledItems.filter { $0.sportForFilter == sport }
            guard scoped.count >= 2 else { return nil }
            return compute(label: sport.label, items: scoped, sport: sport)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if overallStats.points.count < 3 {
                emptyState
            } else {
                if showsTitle {
                    Text("Performance")
                        .font(.system(size: 18, weight: .heavy))
                        .foregroundStyle(Color.appTextPrimary)
                }
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

    /// Translucent glass card chrome for the chart tiles — a blurred material base
    /// under a faint dark tint, so the agent's pixelwave aura shows through
    /// instead of the old flat/opaque `appSurfaceElevated` panel (per design: the
    /// charts read as glass over the page). Shared by every chart tile below.
    private var glassCardBackground: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(.ultraThinMaterial)
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(hex: 0x0F131C).opacity(0.5))
        }
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

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
        .background { glassCardBackground }
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
        .background { glassCardBackground }
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
        .background { glassCardBackground }
    }

    // MARK: - Stats compute

    /// Cumulative-units series via Formula B (matches `recalculate_avatar_performance`).
    /// The per-item payout math lives on `AgentBetItem.netUnitsContribution` so
    /// straight picks (odds) and parlays (settled/combined odds) share one curve.
    private func compute(label: String, items: [AgentBetItem], sport: AgentSport?) -> SportStats {
        var cumulative: Double = 0
        var points: [ChartPoint] = []
        var wins = 0, losses = 0, pushes = 0

        // Seed at 0
        points.append(ChartPoint(index: 0, cumulative: 0))

        for (idx, item) in items.enumerated() {
            switch item.result {
            case .won: wins += 1
            case .lost: losses += 1
            case .push: pushes += 1
            case .pending: continue
            }
            cumulative += item.netUnitsContribution
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

    private func unitsLabel(_ n: Double) -> String {
        let sign = n >= 0 ? "+" : ""
        return String(format: "%@%.2fu", sign, n)
    }
}

/// Loading placeholder for `AgentPerformanceCharts`. Mirrors the overall card's
/// footprint — title row + 180pt chart area inside the same elevated card chrome
/// — so the swap to the real chart never jumps the layout. Detail pages render
/// this while performance picks do their first load, instead of the empty-state
/// card or a bare spinner, so the section doesn't flash empty → spinner → chart.
struct AgentPerformanceChartSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                SkeletonBlock(width: 130, height: 15)
                Spacer()
                SkeletonBlock(width: 64, height: 13)
            }
            SkeletonBlock(height: 180, cornerRadius: 12)
        }
        .padding(14)
        .shimmering()
        // Same translucent glass chrome as the real chart tiles so the skeleton →
        // chart handoff never flips the surface opacity.
        .background {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(.ultraThinMaterial)
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(hex: 0x0F131C).opacity(0.5))
            }
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
            )
        }
    }
}
