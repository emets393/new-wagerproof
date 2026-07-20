import WidgetKit
import SwiftUI
import WagerproofModels

struct AgentMonitorWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: AgentMonitorEntry

    var body: some View {
        if entry.agents.isEmpty {
            EmptyAgentsView(
                compact: family == .systemSmall,
                hasSynced: entry.lastUpdated != nil
            )
        } else {
            switch family {
            case .systemSmall:
                SmallAgentView(agent: entry.agents[0])
            case .systemLarge:
                AgentListView(agents: Array(entry.agents.prefix(3)), showPicks: true)
            default:
                AgentListView(agents: Array(entry.agents.prefix(2)), showPicks: false)
            }
        }
    }
}

private struct EmptyAgentsView: View {
    let compact: Bool
    let hasSynced: Bool

    var body: some View {
        VStack(spacing: Spacing.xs) {
            Image(systemName: "brain.head.profile")
                .font(.system(size: compact ? 20 : 24))
                .foregroundStyle(WidgetPalette.accent)
            Text(emptyMessage)
                .font(WidgetTypography.caption)
                .foregroundStyle(WidgetPalette.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyMessage: String {
        if compact { return hasSynced ? "No agents" : "Agents" }
        return hasSynced
            ? "No active agents yet"
            : "Open WagerProof to load your agents"
    }
}

private struct SmallAgentView: View {
    let agent: TopAgentWidgetData

    private var color: Color { Color(widgetHexString: agent.agentColor) ?? WidgetPalette.accent }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [color.opacity(0.22), WidgetPalette.background.opacity(0.96)],
                startPoint: .topTrailing,
                endPoint: .bottomLeading
            )
            AgentFormGraph(values: agent.form, color: color)

            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: 4) {
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(agent.currentStreak >= 0 ? WidgetPalette.win : WidgetPalette.loss)
                                .frame(width: 5, height: 5)
                            Text("AGENT FORM")
                                .font(.system(size: 8, weight: .heavy))
                                .tracking(0.8)
                                .foregroundStyle(WidgetPalette.textMuted)
                        }
                        Text(agent.agentName)
                            .font(.system(size: 14, weight: .heavy))
                            .foregroundStyle(WidgetPalette.textPrimary)
                            .lineLimit(2)
                            .frame(maxWidth: 78, alignment: .leading)
                    }

                    Spacer(minLength: 0)

                    ZStack(alignment: .bottom) {
                        Ellipse()
                            .fill(color.opacity(0.24))
                            .frame(width: 58, height: 18)
                            .blur(radius: 5)
                        WidgetPixelAvatar(spriteIndex: agent.spriteIndex)
                            .frame(width: 52, height: 69)
                    }
                    .frame(width: 58, height: 70)
                }

                Spacer(minLength: 4)

                HStack(alignment: .bottom, spacing: 6) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(netUnitsDisplay)
                            .font(.system(size: 21, weight: .black, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(agent.netUnits >= 0 ? WidgetPalette.win : WidgetPalette.loss)
                        Text("NET UNITS")
                            .font(.system(size: 7, weight: .heavy))
                            .tracking(0.7)
                            .foregroundStyle(WidgetPalette.textMuted)
                    }

                    Spacer(minLength: 0)

                    VStack(alignment: .trailing, spacing: 2) {
                        Text(agent.record)
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(WidgetPalette.textPrimary)
                        HStack(spacing: 4) {
                            if agent.currentStreak != 0 {
                                Text(streakDisplay)
                                    .foregroundStyle(agent.currentStreak > 0 ? WidgetPalette.win : WidgetPalette.loss)
                            }
                            if agent.bestStreak > 0 {
                                Text("BEST \(agent.bestStreak)")
                                    .foregroundStyle(WidgetPalette.textMuted)
                            }
                        }
                        .font(.system(size: 8, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                    }
                }
            }
            .padding(Spacing.md)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var netUnitsDisplay: String {
        let sign = agent.netUnits >= 0 ? "+" : ""
        return "\(sign)\(String(format: "%.1f", agent.netUnits))u"
    }

    private var streakDisplay: String {
        agent.currentStreak > 0 ? "W\(agent.currentStreak)" : "L\(abs(agent.currentStreak))"
    }
}

/// Real recent W/L form drawn as an unobtrusive terminal-style sparkline.
/// Empty/legacy payloads render a flat baseline instead of invented movement.
private struct AgentFormGraph: View {
    let values: [Double]
    let color: Color

    private var points: [Double] { values.count >= 2 ? values : [0, 0] }

    var body: some View {
        GeometryReader { proxy in
            let chartPoints = coordinates(in: proxy.size)
            ZStack {
                Path { path in
                    for fraction in [0.34, 0.67] {
                        let y = proxy.size.height * fraction
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: proxy.size.width, y: y))
                    }
                }
                .stroke(WidgetPalette.textMuted.opacity(0.08), style: StrokeStyle(lineWidth: 0.5, dash: [2, 4]))

                if let first = chartPoints.first, let last = chartPoints.last {
                    Path { path in
                        path.move(to: CGPoint(x: first.x, y: proxy.size.height))
                        for point in chartPoints.dropFirst() { path.addLine(to: point) }
                        path.addLine(to: CGPoint(x: last.x, y: proxy.size.height))
                        path.closeSubpath()
                    }
                    .fill(
                        LinearGradient(
                            colors: [color.opacity(0.18), color.opacity(0)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )

                    Path { path in
                        path.move(to: first)
                        for point in chartPoints.dropFirst() { path.addLine(to: point) }
                    }
                    .stroke(color.opacity(0.72), style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))

                    Circle()
                        .fill(color)
                        .frame(width: 5, height: 5)
                        .position(last)
                }
            }
        }
        .padding(.top, 42)
        .opacity(0.9)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func coordinates(in size: CGSize) -> [CGPoint] {
        let minimum = points.min() ?? 0
        let maximum = points.max() ?? 0
        let span = max(1, maximum - minimum)
        let topInset: CGFloat = 8
        let bottomInset: CGFloat = 12
        let availableHeight = max(1, size.height - topInset - bottomInset)

        return points.enumerated().map { index, value in
            let x = points.count == 1
                ? size.width / 2
                : size.width * CGFloat(index) / CGFloat(points.count - 1)
            let normalized = CGFloat((value - minimum) / span)
            let y = size.height - bottomInset - normalized * availableHeight
            return CGPoint(x: x, y: y)
        }
    }
}

private struct AgentListView: View {
    let agents: [TopAgentWidgetData]
    let showPicks: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack {
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 12))
                    .foregroundStyle(WidgetPalette.accent)
                Text("Agent Monitor")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(WidgetPalette.textPrimary)
                Spacer()
                Text("WagerProof")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(WidgetPalette.textMuted)
            }
            ForEach(agents) { agent in
                AgentRow(agent: agent, showPicks: showPicks)
            }
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(WidgetPalette.background)
    }
}

private struct AgentRow: View {
    let agent: TopAgentWidgetData
    let showPicks: Bool

    private var color: Color { Color(widgetHexString: agent.agentColor) ?? WidgetPalette.accent }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: Spacing.sm) {
                ZStack {
                    Circle().fill(color.opacity(0.25)).frame(width: 22, height: 22)
                    WidgetPixelAvatar(spriteIndex: agent.spriteIndex)
                        .frame(width: 18, height: 24)
                }
                Text(agent.agentName)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(WidgetPalette.textPrimary)
                    .lineLimit(1)
                Spacer()
                Text(agent.record)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(WidgetPalette.textSecondary)
                Text(netUnitsDisplay)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(agent.netUnits >= 0 ? WidgetPalette.win : WidgetPalette.loss)
            }
            if showPicks, let pick = agent.picks.first {
                Text("\(pick.matchup) — \(pick.pickSelection)")
                    .font(.system(size: 10))
                    .foregroundStyle(WidgetPalette.textMuted)
                    .lineLimit(1)
                    .padding(.leading, 30)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(WidgetPalette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var netUnitsDisplay: String {
        let sign = agent.netUnits >= 0 ? "+" : ""
        return "\(sign)\(String(format: "%.1f", agent.netUnits))u"
    }
}

#Preview("Small", as: .systemSmall) {
    AgentMonitorWidget()
} timeline: {
    AgentMonitorEntry(date: .now, agents: WidgetSampleData.topAgents, lastUpdated: .now)
}

#Preview("Medium", as: .systemMedium) {
    AgentMonitorWidget()
} timeline: {
    AgentMonitorEntry(date: .now, agents: WidgetSampleData.topAgents, lastUpdated: .now)
}

#Preview("Large", as: .systemLarge) {
    AgentMonitorWidget()
} timeline: {
    AgentMonitorEntry(date: .now, agents: WidgetSampleData.topAgents, lastUpdated: .now)
}
