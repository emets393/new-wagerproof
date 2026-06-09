import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Native port of `components/agents/AgentIdCard.tsx`. The 2-up grid card on
/// the My Agents inner tab. Visually:
///   - Top gradient border (`GlowAccentBar`).
///   - Soft background-gradient wash from the agent's primary → secondary.
///   - Identity row: emoji circle + name + sport-symbol badges.
///   - Performance panel: PERFORMANCE label + net-units chip + sparkline +
///     record + streak chip.
///   - Bottom row: autopilot status pill + next-run pill.
///
/// Tap → onTap; long-press → onLongPress (used by the hub action sheet).
struct AgentIdCard: View {
    let agent: AgentWithPerformance
    var onTap: () -> Void
    var onLongPress: () -> Void = {}

    var body: some View {
        let primary = AgentColorPalette.primary(for: agent.agent.avatarColor)
        let secondary = AgentColorPalette.secondary(for: agent.agent.avatarColor)
        let perf = agent.performance
        let netUnitsLabel = perf?.netUnitsLabel ?? "+0.00u"
        let isPositive = (perf?.netUnits ?? 0) >= 0

        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 0) {
                // Top gradient border (2pt strip).
                LinearGradient(colors: [primary, secondary], startPoint: .leading, endPoint: .trailing)
                    .frame(height: 3)

                ZStack(alignment: .top) {
                    // Background wash.
                    LinearGradient(
                        colors: [primary.opacity(0.08), secondary.opacity(0.05), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )

                    VStack(alignment: .leading, spacing: 4) {
                        identityRow(primary: primary)
                        performancePanel(primary: primary, isPositive: isPositive, netUnitsLabel: netUnitsLabel)
                        Spacer(minLength: 0)
                        bottomRow
                    }
                    .padding(10)
                }
            }
            .frame(height: 195)
            .background(Color.appSurfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5)
            )
            .shadow(color: .black.opacity(0.12), radius: 8, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .onLongPressGesture(minimumDuration: 0.4, perform: onLongPress)
    }

    // MARK: - Identity

    @ViewBuilder
    private func identityRow(primary: Color) -> some View {
        HStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(LinearGradient(
                        colors: AgentColorPalette.avatarGradient(for: agent.agent.avatarColor),
                        startPoint: .topLeading, endPoint: .bottomTrailing))
                PixelSpriteAvatar(spriteIndex: agent.agent.spriteIndex)
                    .padding(2)
            }
            .frame(width: 40, height: 40)

            VStack(alignment: .leading, spacing: 4) {
                Text(agent.agent.name)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)

                HStack(spacing: 3) {
                    ForEach(Array(agent.agent.preferredSports.prefix(4)), id: \.self) { sport in
                        ZStack {
                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                .fill(Color.appBorder.opacity(0.5))
                            Image(systemName: sport.sfSymbol)
                                .font(.system(size: 8, weight: .semibold))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                        .frame(width: 18, height: 18)
                    }
                }
            }
        }
    }

    // MARK: - Performance panel

    @ViewBuilder
    private func performancePanel(primary: Color, isPositive: Bool, netUnitsLabel: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                Text("PERFORMANCE")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Color.appTextSecondary)
                Spacer(minLength: 0)
                Text(netUnitsLabel)
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(isPositive ? Color.appWin : Color.appLoss)
            }

            AgentSparkline(performance: agent.performance)
                .frame(height: 32)

            HStack {
                Text(agent.performance?.recordLabel ?? "0-0")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                Spacer()
                streakChip
            }
            .padding(.top, 2)
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 8)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.appBorder.opacity(0.25))
        )
    }

    private var streakChip: some View {
        let cs = agent.performance?.currentStreak ?? 0
        let color: Color = cs > 0 ? .appWin : (cs < 0 ? .appLoss : .appTextSecondary)
        let icon: String = cs > 0 ? "flame.fill" : (cs < 0 ? "snowflake" : "minus")
        return HStack(spacing: 2) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .semibold))
            Text(agent.performance?.currentStreakLabel ?? "-")
                .font(.system(size: 9, weight: .bold))
        }
        .foregroundStyle(color)
        .padding(.horizontal, 5)
        .padding(.vertical, 2)
        .background(
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(color.opacity(0.12))
        )
    }

    // MARK: - Autopilot row

    @ViewBuilder
    private var bottomRow: some View {
        if agent.agent.isActive {
            HStack(spacing: 6) {
                HStack(spacing: 5) {
                    Circle()
                        .fill(Color(hex: 0x10B981))
                        .frame(width: 6, height: 6)
                    Text("AUTOPILOT ON")
                        .font(.system(size: 8, weight: .bold))
                        .tracking(0.3)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(Color(hex: 0x10B981).opacity(0.10))
                )
                .foregroundStyle(Color(hex: 0x10B981))

                if !agent.agent.autoGenerateTime.isEmpty {
                    Text(formatNextRun(time: agent.agent.autoGenerateTime, tz: agent.agent.autoGenerateTimezone))
                        .font(.system(size: 8, weight: .bold))
                        .tracking(0.3)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(Color(hex: 0x10B981).opacity(0.10))
                        )
                        .foregroundStyle(Color(hex: 0x10B981))
                }
            }
        } else {
            HStack(spacing: 4) {
                Image(systemName: "pause.circle")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appLoss)
                Text("AUTOPILOT OFF")
                    .font(.system(size: 8, weight: .bold))
                    .tracking(0.3)
                    .foregroundStyle(Color.appLoss)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(Color.appLoss.opacity(0.10))
            )
        }
    }

    // MARK: - Helpers

    /// Mirrors RN `formatNextRun`. "9:00am ET" style.
    private func formatNextRun(time: String, tz: String) -> String {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        let hour = parts.first ?? 9
        let minute = parts.count >= 2 ? parts[1] : 0
        let hr12 = hour % 12 == 0 ? 12 : hour % 12
        let ampm = hour < 12 ? "a" : "p"
        let tzAbbr: String
        if tz.contains("New_York") { tzAbbr = "ET" }
        else if tz.contains("Chicago") { tzAbbr = "CT" }
        else if tz.contains("Denver") { tzAbbr = "MT" }
        else if tz.contains("Los_Angeles") { tzAbbr = "PT" }
        else { tzAbbr = tz.split(separator: "/").last.map { String($0).replacingOccurrences(of: "_", with: " ") } ?? "" }
        return String(format: "%d:%02d%@ %@", hr12, minute, ampm, tzAbbr)
    }
}

// MARK: - Sparkline

/// Tiny static line chart for the PERFORMANCE panel. Generates 5-12 synthetic
/// equity-curve points scaled so the last point lands at `net_units`. Mirrors
/// RN `generateSparkPoints` + the static `<View>` segment renderer.
private struct AgentSparkline: View {
    let performance: AgentPerformance?

    var body: some View {
        GeometryReader { geo in
            if hasData {
                let pts = generatePoints()
                if pts.count >= 2 {
                    Path { p in
                        let padding: CGFloat = 2
                        let minY = pts.min() ?? 0
                        let maxY = pts.max() ?? 0
                        let range = max(maxY - minY, 0.0001)
                        let w = geo.size.width - padding * 2
                        let h = geo.size.height - padding * 2
                        for (i, v) in pts.enumerated() {
                            let x = padding + (CGFloat(i) / CGFloat(pts.count - 1)) * w
                            let y = padding + CGFloat((maxY - v) / range) * h
                            if i == 0 { p.move(to: CGPoint(x: x, y: y)) }
                            else { p.addLine(to: CGPoint(x: x, y: y)) }
                        }
                    }
                    .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                }
            } else {
                // No graded picks yet (e.g. a freshly created agent's card): a
                // dotted baseline stands in for the equity curve that doesn't
                // exist yet, rather than a flat solid line that reads as real data.
                Path { p in
                    let y = geo.size.height / 2
                    p.move(to: CGPoint(x: 2, y: y))
                    p.addLine(to: CGPoint(x: geo.size.width - 2, y: y))
                }
                .stroke(
                    Color.appTextMuted.opacity(0.6),
                    style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [0.5, 5])
                )
            }
        }
    }

    /// True once the agent has a settled record to chart — otherwise the view
    /// shows the dotted placeholder baseline.
    private var hasData: Bool { (performance?.totalPicks ?? 0) > 0 }

    private var color: Color {
        (performance?.netUnits ?? 0) >= 0 ? Color(hex: 0x22C55E) : Color(hex: 0xEF4444)
    }

    /// Loose port of RN `generateSparkPoints` — produces 6-13 synthetic points
    /// that end at `net_units`. Returns `[0,0,0,0,0]` for empty performance.
    private func generatePoints() -> [Double] {
        guard let perf = performance, perf.totalPicks > 0 else { return [0, 0, 0, 0, 0] }
        let total = perf.wins + perf.losses + perf.pushes
        if total == 0 { return [0, 0, 0, 0, 0] }
        var points: [Double] = [0]
        var cumulative: Double = 0
        let steps = min(max(total, 5), 12)
        let avgPerStep = perf.netUnits / Double(steps)
        for i in 0..<steps {
            let swing: Double
            if i < max(perf.bestStreak, 1) {
                swing = abs(avgPerStep) + 0.3
            } else if i > steps - max(abs(perf.worstStreak), 1) {
                swing = -abs(avgPerStep) - 0.2
            } else {
                swing = avgPerStep + sin(Double(i) * 2.1) * 0.5
            }
            cumulative += swing
            points.append(cumulative)
        }
        // Rescale so the final point lands at net_units.
        if let last = points.last, last != 0 {
            let scale = perf.netUnits / last
            for i in 1..<points.count {
                points[i] *= scale
            }
        }
        return points
    }
}
