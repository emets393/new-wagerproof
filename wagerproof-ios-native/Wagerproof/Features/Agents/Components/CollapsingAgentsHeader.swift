import SwiftUI
import WagerproofDesign
import WagerproofModels

// The Agents hub's pixel office ("Agent HQ") used to be a scroll-driven floating
// widget that collapsed into a draggable corner minimap. That was replaced with
// a plain scrolling hero row (see `AgentsView.officeRow`) so it scrolls away
// naturally with the rest of the list. The only surviving piece is the agency
// stats pill below, which now rides in the office hero's top-trailing corner.

/// Compact agency stats rendered as a liquid-glass pill that floats over the
/// office hero. Mirrors `CompanyDashboardBanner`'s computations.
struct AgencyStatsPill: View {
    let agents: [AgentWithPerformance]

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
    private var unitsLabel: String {
        let sign = totalNetUnits >= 0 ? "+" : ""
        return String(format: "%@%.2fu", sign, totalNetUnits)
    }

    var body: some View {
        HStack(spacing: 5) {
            Text(unitsLabel)
                .foregroundStyle(totalNetUnits >= 0 ? Color(hex: 0x4ADE80) : Color(hex: 0xF87171))
            Text("·").foregroundStyle(.white.opacity(0.5))
            Text(String(format: "%.0f%%", winRateAverage * 100))
                .foregroundStyle(.white)
            Text("·").foregroundStyle(.white.opacity(0.5))
            Text("\(activeCount)/\(agents.count)")
                .foregroundStyle(.white)
        }
        .font(.system(size: 11, weight: .heavy, design: .rounded))
        .lineLimit(1)
        .fixedSize()
        .padding(.horizontal, 11)
        .padding(.vertical, 6)
        // Dark backing + white text — the pill sits over the colorful office.
        .background(Color.black.opacity(0.45), in: Capsule())
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.18), lineWidth: 0.5))
    }
}
