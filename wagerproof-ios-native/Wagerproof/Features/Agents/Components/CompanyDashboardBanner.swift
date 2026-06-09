import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Native port of `components/agents/CompanyDashboardBanner.tsx`. A roll-up
/// stats card that summarizes the user's entire "agency" — total agents,
/// total picks today, aggregate net units, and a CTA to open the HR sheet.
struct CompanyDashboardBanner: View {
    let agents: [AgentWithPerformance]
    var onOpenHR: () -> Void = {}

    private var totalNetUnits: Double {
        agents.reduce(0) { $0 + ($1.performance?.netUnits ?? 0) }
    }

    private var winRateAverage: Double {
        let withPerf = agents.compactMap { $0.performance }.filter { $0.totalPicks > 0 }
        guard !withPerf.isEmpty else { return 0 }
        let total = withPerf.reduce(0.0) { acc, perf in
            let settled = perf.wins + perf.losses
            guard settled > 0 else { return acc }
            return acc + Double(perf.wins) / Double(settled)
        }
        return total / Double(withPerf.count)
    }

    private var activeCount: Int { agents.filter { $0.agent.isActive }.count }
    private var totalPicksToday: Int { 0 } // Per-day count is in detail snapshot

    private var unitsColor: Color {
        totalNetUnits >= 0 ? .appWin : .appLoss
    }

    private var unitsLabel: String {
        let sign = totalNetUnits >= 0 ? "+" : ""
        return String(format: "%@%.2fu", sign, totalNetUnits)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("YOUR AGENCY")
                        .font(.system(size: 10, weight: .heavy, design: .monospaced))
                        .tracking(1.5)
                        .foregroundStyle(Color.appTextSecondary)
                    Text("\(agents.count) agents · \(activeCount) active")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                }
                Spacer()
                Button(action: onOpenHR) {
                    HStack(spacing: 4) {
                        Image(systemName: "person.2.badge.gearshape.fill")
                            .font(.system(size: 11, weight: .semibold))
                        Text("HR")
                            .font(.system(size: 11, weight: .heavy))
                            .tracking(0.5)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        Capsule().fill(Color(hex: 0x00E676).opacity(0.16))
                    )
                    .foregroundStyle(Color(hex: 0x00E676))
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 0) {
                statCell(label: "Net Units", value: unitsLabel, tint: unitsColor)
                Divider().frame(height: 32)
                statCell(label: "Avg Win Rate", value: String(format: "%.1f%%", winRateAverage * 100))
                Divider().frame(height: 32)
                statCell(label: "Agents", value: "\(agents.count)")
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.appSurfaceElevated)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 1)
        )
    }

    private func statCell(label: String, value: String, tint: Color = Color.appTextPrimary) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.system(size: 9, weight: .heavy, design: .monospaced))
                .tracking(0.8)
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 14, weight: .heavy, design: .monospaced))
                .foregroundStyle(tint)
        }
        .frame(maxWidth: .infinity)
    }
}
