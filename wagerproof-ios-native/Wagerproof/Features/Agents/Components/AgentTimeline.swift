import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Native port of `components/agents/AgentTimeline.tsx`. A vertical timeline
/// of recent agent activity — pick generations, performance recalcs, autopilot
/// status changes. RN drives this from a server-generated event log; for B15
/// we synthesize timeline rows from data the snapshot already returns (today's
/// picks + today's run + last-graded info on performance).
struct AgentTimeline: View {
    let agent: Agent
    let performance: AgentPerformance?
    let todaysPicks: [AgentPick]
    let todaysRun: AgentGenerationRunSummary?

    private var events: [TimelineEvent] {
        var out: [TimelineEvent] = []

        if let run = todaysRun {
            let title: String
            let detail: String
            let icon: String
            if run.picksGenerated > 0 {
                title = "Generated \(run.picksGenerated) pick\(run.picksGenerated == 1 ? "" : "s")"
                detail = "Today's run completed successfully."
                icon = "sparkles"
            } else if run.noGames {
                title = "No games available"
                detail = "Agent skipped today — no games on its preferred slate."
                icon = "calendar.badge.exclamationmark"
            } else if run.weakSlate {
                title = "Skipped weak slate"
                detail = "Agent ran but the slate didn't meet its quality threshold."
                icon = "hand.raised"
            } else {
                title = "Analysis complete"
                detail = run.slateNote ?? "Agent finished its run and passed on the slate."
                icon = "checkmark.seal"
            }
            out.append(TimelineEvent(
                id: "run-\(run.id)",
                timestamp: run.completedAt ?? run.createdAt ?? "",
                title: title,
                detail: detail,
                iconName: icon,
                tint: run.picksGenerated > 0 ? Color(hex: 0x00E676) : Color.appTextSecondary
            ))
        }

        if let lastGen = agent.lastGeneratedAt {
            out.append(TimelineEvent(
                id: "last-gen",
                timestamp: lastGen,
                title: "Last generation",
                detail: "Manual or automatic pick generation.",
                iconName: "wand.and.stars",
                tint: Color(hex: 0x3B82F6)
            ))
        }

        if let perf = performance, let lastCalc = perf.lastCalculatedAt {
            out.append(TimelineEvent(
                id: "perf-\(lastCalc)",
                timestamp: lastCalc,
                title: "Performance updated",
                detail: "Record: \(perf.recordLabel) · \(perf.netUnitsLabel)",
                iconName: "chart.line.uptrend.xyaxis",
                tint: perf.netUnits >= 0 ? Color.appWin : Color.appLoss
            ))
        }

        return out
    }

    var body: some View {
        if events.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 0) {
                Text("Recent Activity")
                    .font(.system(size: 14, weight: .heavy))
                    .tracking(0.3)
                    .foregroundStyle(Color.appTextPrimary)
                    .padding(.bottom, 8)

                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(events.enumerated()), id: \.element.id) { idx, event in
                        TimelineRow(
                            event: event,
                            isFirst: idx == 0,
                            isLast: idx == events.count - 1
                        )
                    }
                }
            }
        }
    }

    private struct TimelineEvent: Identifiable {
        let id: String
        let timestamp: String
        let title: String
        let detail: String
        let iconName: String
        let tint: Color
    }

    private struct TimelineRow: View {
        let event: TimelineEvent
        let isFirst: Bool
        let isLast: Bool

        var body: some View {
            HStack(alignment: .top, spacing: 12) {
                // Spine: vertical line + dot
                VStack(spacing: 0) {
                    Rectangle()
                        .fill(isFirst ? Color.clear : Color.appBorder.opacity(0.6))
                        .frame(width: 1, height: 10)
                    ZStack {
                        Circle()
                            .fill(event.tint.opacity(0.18))
                        Image(systemName: event.iconName)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(event.tint)
                    }
                    .frame(width: 24, height: 24)
                    Rectangle()
                        .fill(isLast ? Color.clear : Color.appBorder.opacity(0.6))
                        .frame(width: 1)
                }
                .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(event.title)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                        Spacer()
                        Text(formatTimestamp(event.timestamp))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    Text(event.detail)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.vertical, 4)
                .padding(.bottom, isLast ? 0 : 12)
            }
        }

        private func formatTimestamp(_ raw: String) -> String {
            if raw.isEmpty { return "" }
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let date = iso.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
            guard let d = date else { return "" }
            let interval = Date().timeIntervalSince(d)
            if interval < 60 { return "just now" }
            if interval < 3600 { return "\(Int(interval / 60))m ago" }
            if interval < 86_400 { return "\(Int(interval / 3600))h ago" }
            let df = DateFormatter()
            df.dateFormat = "MMM d"
            return df.string(from: d)
        }
    }
}
