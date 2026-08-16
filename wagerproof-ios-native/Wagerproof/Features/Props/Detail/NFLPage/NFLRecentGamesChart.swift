import SwiftUI
import Charts
import WagerproofModels
import WagerproofDesign

/// Recent Games widget body — the native `Last10Strip`, drawn in the MLB
/// `RecentPropBarChart` style. Bars are the player's actual stat totals from
/// the trends game log, graded against TODAY's line (not the historical
/// closing lines), oldest left → most recent right, opponent abbrevs below.
struct NFLRecentGamesChart: View {
    /// Newest-first, as served.
    let games: [NFLPropTrendGame]
    let marketKey: String
    let line: Double?
    /// Override for the dashed-line badge ("TD" for anytime-TD's 0.5 bar).
    var lineLabel: String? = nil

    private struct Bar: Identifiable {
        let id: Int
        let opp: String
        let value: Double?
        let tone: Tone
        let delta: Double?
        let tooltip: String

        enum Tone { case over, under, muted }
    }

    private var bars: [Bar] {
        let displayed = Array(games.prefix(10).reversed())
        return displayed.enumerated().map { index, game in
            let actual = game.actuals[marketKey]
            let tone: Bar.Tone
            if let actual, let line, actual != line {
                tone = actual > line ? .over : .under
            } else {
                tone = .muted
            }
            let delta: Double? = if let actual, let line { actual - line } else { nil }
            let tip = [
                "\(game.season) wk\(game.week)",
                game.isHome == true ? "Home" : "Away",
                game.isDiv == true ? "Div" : nil,
                game.isPrimetime == true ? "Primetime" : nil,
            ].compactMap { $0 }.joined(separator: " · ")
            return Bar(id: index, opp: game.opp, value: actual, tone: tone, delta: delta, tooltip: tip)
        }
    }

    /// Web ceiling: max(1, line, all actuals) × 1.14.
    private var ceiling: Double {
        let actuals = bars.compactMap(\.value)
        return max(1, line ?? 0, actuals.max() ?? 0) * 1.14
    }

    var body: some View {
        if bars.isEmpty {
            Text("No recent game log yet")
                .font(.system(size: 13))
                .italic()
                .foregroundStyle(Color.appTextMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(spacing: 6) {
                chart
                    .frame(height: 172)
                oppRow
                Text("Oldest left → most recent right")
                    .font(.system(size: 9))
                    .foregroundStyle(Color.appTextMuted)
            }
        }
    }

    private func barColor(_ tone: Bar.Tone) -> Color {
        switch tone {
        case .over: Color.appWin
        case .under: Color.appLoss.opacity(0.75)
        case .muted: Color.appTextMuted.opacity(0.45)
        }
    }

    private var chart: some View {
        Chart {
            ForEach(bars) { bar in
                BarMark(
                    x: .value("Game", String(bar.id)),
                    // Missing actuals still occupy a slot (short muted stub) so
                    // the opponent row below stays aligned — web parity.
                    y: .value("Value", bar.value ?? ceiling * 0.06),
                    width: .ratio(0.62)
                )
                .cornerRadius(2)
                .foregroundStyle(barColor(bar.tone))
                .annotation(position: .top, spacing: 2) {
                    VStack(spacing: 1) {
                        Text(bar.value.map(barLabel) ?? "—")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(bar.tone == .muted ? Color.appTextMuted : barColor(bar.tone))
                        if let delta = bar.delta {
                            Text(deltaLabel(delta))
                                .font(.system(size: 7, weight: .bold))
                                .foregroundStyle(bar.tone == .muted ? Color.appTextMuted : barColor(bar.tone))
                        }
                    }
                }
            }

            if let line {
                RuleMark(y: .value("Line", line))
                    .lineStyle(StrokeStyle(lineWidth: 1.2, dash: [4, 3]))
                    .foregroundStyle(Color.appPrimary.opacity(0.85))
                    .annotation(position: .top, alignment: .leading, spacing: 2) {
                        Text(lineLabel ?? "Line \(NFLPlayerProps.formatLine(line))")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Color.appPrimary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.appSurface.opacity(0.92), in: Capsule())
                            .overlay(Capsule().stroke(Color.appPrimary.opacity(0.35), lineWidth: 0.6))
                    }
            }
        }
        // Fixed domain keeps game-log order (oldest → newest).
        .chartXScale(domain: bars.map { String($0.id) })
        .chartYScale(domain: 0...ceiling)
        .chartPlotStyle { plot in
            plot.padding(.top, 20)
        }
        .chartYAxis(.hidden)
        .chartLegend(.hidden)
        .chartXAxis(.hidden)
    }

    private var oppRow: some View {
        HStack(spacing: 0) {
            ForEach(bars) { bar in
                Text(bar.opp)
                    .font(.system(size: 8, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.appTextMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 2)
    }

    private func barLabel(_ v: Double) -> String {
        v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v)
    }

    private func deltaLabel(_ d: Double) -> String {
        let magnitude = d == d.rounded() ? String(Int(abs(d))) : String(format: "%.1f", abs(d))
        if d == 0 { return "0" }
        return "\(d > 0 ? "+" : "-")\(magnitude)"
    }
}
