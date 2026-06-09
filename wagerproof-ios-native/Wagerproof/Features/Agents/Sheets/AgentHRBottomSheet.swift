import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Native port of `components/agents/AgentHRBottomSheet.tsx`.
///
/// "HR DEPARTMENT" comparison sheet: ranks every agent that has settled picks
/// by net units, grades them, and surfaces a recommendation. Includes a
/// "fire to save $$$" panel for losers. Pure visualization — no mutations.
///
/// Presented from `CompanyDashboardBanner` (or wherever the host wants to
/// drop the HR CTA). Uses SwiftUI's `.sheet` with `.medium` / `.large`
/// detents — native idiomatic replacement for Gorhom bottom-sheet.
struct AgentHRBottomSheet: View {
    let agents: [AgentWithPerformance]
    var onDismiss: () -> Void = {}

    private static let unitSize: Double = 100

    enum Grade: String {
        case s = "S", a = "A", b = "B", c = "C", d = "D", f = "F"

        var color: Color {
            switch self {
            case .s: return Color(hex: 0xFFD700)
            case .a: return Color(hex: 0x00E676)
            case .b: return Color(hex: 0x69F0AE)
            case .c: return Color(hex: 0xFFC107)
            case .d: return Color(hex: 0xFF9800)
            case .f: return Color(hex: 0xFF5252)
            }
        }
    }

    private struct ReportCard: Identifiable {
        let agent: AgentWithPerformance
        let grade: Grade
        let netUnits: Double
        let dollarImpact: Double
        let winRate: Double?
        let record: String
        let companyWithout: Double
        let recommendation: String
        let isCostingMoney: Bool

        var id: String { agent.id }
    }

    private var cards: [ReportCard] {
        let totalNetUnits = agents.reduce(0) { $0 + ($1.performance?.netUnits ?? 0) }
        let totalBankroll = 1000 + totalNetUnits * Self.unitSize

        return agents
            .filter { ($0.performance?.totalPicks ?? 0) > 0 }
            .map { agent in
                let perf = agent.performance!
                let settled = perf.wins + perf.losses
                let winRate = settled > 0 ? Double(perf.wins) / Double(settled) * 100 : nil
                let grade = Self.grade(forNetUnits: perf.netUnits)
                let companyWithout = totalBankroll - perf.netUnits * Self.unitSize
                var card = ReportCard(
                    agent: agent,
                    grade: grade,
                    netUnits: perf.netUnits,
                    dollarImpact: perf.netUnits * Self.unitSize,
                    winRate: winRate,
                    record: perf.recordLabel,
                    companyWithout: companyWithout,
                    recommendation: "",
                    isCostingMoney: perf.netUnits < 0
                )
                card = ReportCard(
                    agent: agent,
                    grade: grade,
                    netUnits: perf.netUnits,
                    dollarImpact: perf.netUnits * Self.unitSize,
                    winRate: winRate,
                    record: perf.recordLabel,
                    companyWithout: companyWithout,
                    recommendation: Self.recommendation(
                        grade: grade,
                        name: agent.agent.name,
                        netUnits: perf.netUnits,
                        winRate: winRate
                    ),
                    isCostingMoney: perf.netUnits < 0
                )
                return card
            }
            .sorted { $0.netUnits < $1.netUnits }
    }

    private var winners: [ReportCard] { cards.filter { !$0.isCostingMoney }.sorted { $0.netUnits > $1.netUnits } }
    private var losers: [ReportCard] { cards.filter { $0.isCostingMoney } }
    private var winnersTotal: Double { winners.reduce(0) { $0 + $1.dollarImpact } }
    private var losersTotal: Double { losers.reduce(0) { $0 + $1.dollarImpact } }
    private var totalBankroll: Double {
        let totalNetUnits = agents.reduce(0) { $0 + ($1.performance?.netUnits ?? 0) }
        return 1000 + totalNetUnits * Self.unitSize
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    headerBlock

                    if winners.isEmpty && losers.isEmpty {
                        emptyState
                    }

                    if !winners.isEmpty {
                        summaryCard(
                            title: "WINNERS",
                            tint: Color(hex: 0x00E676),
                            total: winnersTotal,
                            body: "\(winners.count) agent\(winners.count == 1 ? "" : "s") earning money for the company."
                        )
                        ForEach(winners) { card in
                            reportRow(card)
                        }
                    }

                    if !losers.isEmpty {
                        summaryCard(
                            title: "LOSERS",
                            tint: Color(hex: 0xFF5252),
                            total: losersTotal,
                            body: losersSummary
                        )
                        ForEach(losers) { card in
                            reportRow(card)
                        }
                    }
                }
                .padding(16)
            }
            .background(Color.appSurface)
            .navigationTitle("HR Department")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { onDismiss() }
                }
            }
        }
    }

    private var headerBlock: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(">_")
                    .font(.system(size: 16, weight: .heavy, design: .monospaced))
                    .foregroundStyle(Color(hex: 0x00E676))
                Text("HR DEPARTMENT")
                    .font(.system(size: 18, weight: .black, design: .monospaced))
                    .tracking(2)
                    .foregroundStyle(Color.appTextPrimary)
            }
            Text("AGENT PERFORMANCE REVIEW")
                .font(.system(size: 10, weight: .heavy, design: .monospaced))
                .tracking(1.5)
                .foregroundStyle(Color.appTextSecondary)
                .padding(.leading, 22)
        }
    }

    private var losersSummary: String {
        let saved = Int(abs(losersTotal).rounded())
        let after = Int((totalBankroll - losersTotal).rounded())
        return "\(losers.count) agent\(losers.count == 1 ? " is" : "s are") costing money. Firing \(losers.count == 1 ? "them" : "all") saves $\(saved) and brings bankroll to $\(after)."
    }

    private var emptyState: some View {
        Text("No agents with settled picks yet. Check back after picks are graded.")
            .font(.system(size: 13, design: .monospaced))
            .foregroundStyle(Color.appTextSecondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 32)
    }

    private func summaryCard(title: String, tint: Color, total: Double, body: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.system(size: 10, weight: .heavy, design: .monospaced))
                    .tracking(1.5)
                    .foregroundStyle(tint)
                Spacer()
                Text(Self.formatDollars(total))
                    .font(.system(size: 16, weight: .black, design: .monospaced))
                    .foregroundStyle(tint)
            }
            Text(body)
                .font(.system(size: 13, design: .monospaced))
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(tint.opacity(0.07))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(tint.opacity(0.18), lineWidth: 1)
        )
    }

    private func reportRow(_ card: ReportCard) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(card.grade.color.opacity(0.18))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .strokeBorder(card.grade.color.opacity(0.4), lineWidth: 1)
                        )
                    Text(card.grade.rawValue)
                        .font(.system(size: 16, weight: .black, design: .monospaced))
                        .foregroundStyle(card.grade.color)
                }
                .frame(width: 32, height: 32)

                Text(card.agent.agent.avatarEmoji).font(.system(size: 20))

                VStack(alignment: .leading, spacing: 1) {
                    Text(card.agent.agent.name)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                    Text("\(card.record) | \(card.winRate.map { String(format: "%.1f%%", $0) } ?? "--")")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color.appTextSecondary)
                }

                Spacer(minLength: 4)

                VStack(alignment: .trailing, spacing: 1) {
                    Text(Self.formatDollars(card.dollarImpact))
                        .font(.system(size: 14, weight: .black, design: .monospaced))
                        .foregroundStyle(card.netUnits >= 0 ? Color(hex: 0x00E676) : Color(hex: 0xFF5252))
                    Text("IMPACT")
                        .font(.system(size: 7, weight: .heavy, design: .monospaced))
                        .tracking(1)
                        .foregroundStyle(Color.appTextSecondary)
                }
            }

            Text(card.recommendation)
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(Color.appTextSecondary)

            if card.isCostingMoney {
                let companyWithoutFmt = Int(card.companyWithout.rounded())
                let savingsFmt = Int(abs(card.dollarImpact).rounded())
                HStack(alignment: .top, spacing: 6) {
                    Text(">_")
                        .font(.system(size: 10, weight: .heavy, design: .monospaced))
                        .foregroundStyle(Color(hex: 0xFF5252))
                    Text("Without \(card.agent.agent.name), bankroll would be ")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Color(hex: 0xFF5252))
                    + Text("$\(companyWithoutFmt)")
                        .font(.system(size: 11, weight: .black, design: .monospaced))
                        .foregroundStyle(Color(hex: 0x00E676))
                    + Text(" (+$\(savingsFmt) saved)")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Color(hex: 0xFF5252))
                }
                .padding(10)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color(hex: 0xFF5252).opacity(0.08))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(Color(hex: 0xFF5252).opacity(0.15), lineWidth: 1)
                )
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.appSurfaceElevated)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 1)
        )
    }

    // MARK: - Helpers

    private static func grade(forNetUnits n: Double) -> Grade {
        if n >= 10 { return .s }
        if n >= 5 { return .a }
        if n >= 1 { return .b }
        if n >= 0 { return .c }
        if n >= -3 { return .d }
        return .f
    }

    private static func recommendation(grade: Grade, name: String, netUnits: Double, winRate: Double?) -> String {
        switch grade {
        case .s: return "\(name) is your MVP. Protect at all costs."
        case .a: return "\(name) is a top performer. Keep them running."
        case .b: return "\(name) is solid. Pulling their weight."
        case .c:
            if let wr = winRate, wr >= 50 {
                return "\(name) is break-even. Could tweak personality params."
            }
            return "\(name) is on thin ice. Review their strategy."
        case .d: return "\(name) is underperforming. Consider adjusting or replacing."
        case .f:
            let dollars = Int(abs(netUnits * unitSize).rounded())
            return "\(name) is costing you money. Fire to save $\(dollars)."
        }
    }

    private static func formatDollars(_ amount: Double) -> String {
        let abs = Swift.abs(amount)
        let sign = amount >= 0 ? "+" : "-"
        if abs >= 1000 {
            let k = abs / 1000.0
            return k.truncatingRemainder(dividingBy: 1) == 0
                ? "\(sign)$\(Int(k))k"
                : String(format: "%@$%.1fk", sign, k)
        }
        return String(format: "%@$%.0f", sign, abs)
    }
}
