import WidgetKit
import SwiftUI
import WagerproofDesign
import WagerproofModels

struct AgentMonitorWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: AgentMonitorEntry

    var body: some View {
        if entry.agents.isEmpty {
            EmptyAgentsView(compact: family == .systemSmall)
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

    var body: some View {
        VStack(spacing: Spacing.xs) {
            Image(systemName: "brain.head.profile")
                .font(.system(size: compact ? 20 : 24))
                .foregroundStyle(WidgetPalette.accent)
            Text(compact ? "Agents" : "Open WagerProof to load your agents")
                .font(AppFont.caption)
                .foregroundStyle(WidgetPalette.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct SmallAgentView: View {
    let agent: TopAgentWidgetData

    private var color: Color { Color(widgetHexString: agent.agentColor) ?? WidgetPalette.accent }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack(spacing: Spacing.xs) {
                Text(agent.agentEmoji)
                    .font(.system(size: 16))
                Text(agent.agentName)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(WidgetPalette.textPrimary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            Text(agent.record)
                .font(.system(size: 20, weight: .heavy))
                .foregroundStyle(WidgetPalette.textPrimary)
            HStack(spacing: 6) {
                Text(netUnitsDisplay)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(agent.netUnits >= 0 ? Color.appWin : Color.appLoss)
                if agent.currentStreak != 0 {
                    Text(streakDisplay)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(WidgetPalette.textMuted)
                }
            }
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [color.opacity(0.22), WidgetPalette.background], startPoint: .top, endPoint: .bottom)
        )
    }

    private var netUnitsDisplay: String {
        let sign = agent.netUnits >= 0 ? "+" : ""
        return "\(sign)\(String(format: "%.1f", agent.netUnits))u"
    }

    private var streakDisplay: String {
        agent.currentStreak > 0 ? "W\(agent.currentStreak)" : "L\(abs(agent.currentStreak))"
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
                    Text(agent.agentEmoji).font(.system(size: 12))
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
                    .foregroundStyle(agent.netUnits >= 0 ? Color.appWin : Color.appLoss)
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
