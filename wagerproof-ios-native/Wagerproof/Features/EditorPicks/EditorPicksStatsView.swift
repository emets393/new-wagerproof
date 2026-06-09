import SwiftUI
import Charts
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Editor's Picks transparency dashboard. Ports
/// `wagerproof-mobile/app/(drawer)/editor-picks-stats.tsx`: overall record +
/// net units, a date-range filter, a "best run" (lowest-low → highest-high)
/// highlight, and cumulative-units charts (overall + per sport) drawn with
/// Apple's Charts framework. Reads the already-loaded `EditorPicksStore`.
struct EditorPicksStatsView: View {
    @Environment(EditorPicksStore.self) private var store

    @State private var dateFilter: DateFilter = .bestRun

    // MARK: - Domain

    enum DateFilter: String, CaseIterable, Identifiable {
        case bestRun, sevenDay, thirtyDay, ninetyDay, allTime
        var id: String { rawValue }
        var label: String {
            switch self {
            case .bestRun: return "Best Run"
            case .sevenDay: return "7 Days"
            case .thirtyDay: return "30 Days"
            case .ninetyDay: return "90 Days"
            case .allTime: return "All Time"
            }
        }
        var icon: String {
            switch self {
            case .bestRun: return "chart.line.uptrend.xyaxis"
            case .sevenDay: return "calendar"
            case .thirtyDay: return "calendar"
            case .ninetyDay: return "calendar"
            case .allTime: return "star"
            }
        }
        var days: Int? {
            switch self {
            case .sevenDay: return 7
            case .thirtyDay: return 30
            case .ninetyDay: return 90
            default: return nil
            }
        }
    }

    private struct ChartPoint: Identifiable {
        let index: Int
        let cumulative: Double
        var id: Int { index }
    }

    private struct BestRun {
        let wins: Int
        let losses: Int
        let netUnits: Double
        let picksCount: Int
        let indices: (start: Int, end: Int)
    }

    private struct SportStat: Identifiable {
        let key: String
        let label: String
        let won: Int
        let lost: Int
        let push: Int
        let netUnits: Double
        let winRate: Double
        let points: [ChartPoint]
        let bestRunIndices: (start: Int, end: Int)?
        let bestRun: BestRun?
        var id: String { key }
    }

    private static let sports: [(key: String, label: String, gameType: GameType?)] = [
        ("all", "All Sports", nil),
        ("nba", "NBA", .nba),
        ("ncaab", "NCAAB", .ncaab),
        ("nfl", "NFL", .nfl),
        ("cfb", "CFB", .cfb),
    ]

    var body: some View {
        let filtered = filteredPicks()
        let stats = Self.sports.map { sportStat(key: $0.key, label: $0.label, gameType: $0.gameType, source: filtered) }
        let overall = stats.first ?? Self.emptyStat
        let overallBestRun = calculateBestRun(filtered).run

        ScrollView {
            VStack(spacing: 16) {
                editorCard
                transparencyCard
                overallCards(overall)
                dateFilterPills
                Text("Showing: \(dateFilter.label) (\(filtered.count) picks)")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
                if let run = overallBestRun, run.netUnits > 0 {
                    bestRunCard(run)
                }
                overallChartCard(overall)
                Text("Performance by Sport")
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                ForEach(stats.dropFirst()) { stat in
                    sportChartCard(stat)
                }
            }
            .padding(16)
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle("Editor's Picks Stats")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if store.allPicks.isEmpty { await store.refresh() }
        }
    }

    // MARK: - Cards

    private var editorCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(LinearGradient(colors: [Color.appAccentBlue, Color.appPrimary], startPoint: .topLeading, endPoint: .bottomTrailing))
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 64, height: 64)
            VStack(alignment: .leading, spacing: 4) {
                Text("WagerProof Editor")
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                Text("\(store.allPicks.count) Total Picks")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Spacer()
        }
        .padding(16)
        .background(Color.appAccentBlue.opacity(0.12), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.appAccentBlue.opacity(0.3), lineWidth: 1))
    }

    private var transparencyCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label {
                Text("Full Transparency").font(.system(size: 16, weight: .heavy)).foregroundStyle(Color.appTextPrimary)
            } icon: {
                Image(systemName: "shield.lefthalf.filled").foregroundStyle(Color.appPrimary)
            }
            Text("This page is dedicated to providing complete transparency. Unlike other apps, we want to show users everything that we do — the wins, the losses, and everything in between.")
                .font(.system(size: 14))
                .foregroundStyle(Color.appTextSecondary)
            Text("WagerProof was designed in Columbus, Ohio and Austin, Texas by two childhood friends who share a passion for sports and technology. We built this for bettors like us who value honesty and data-driven insights.")
                .font(.system(size: 14))
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func overallCards(_ overall: SportStat) -> some View {
        HStack(spacing: 12) {
            statCard(label: "Record",
                     value: recordString(overall),
                     subtext: "\(String(format: "%.1f", overall.winRate))% Win Rate",
                     subtextColor: Color.appAccentBlue)
            statCard(label: "Net Units",
                     value: "\(overall.netUnits >= 0 ? "+" : "")\(String(format: "%.2f", overall.netUnits))",
                     valueColor: overall.netUnits >= 0 ? Color.appWin : Color.appLoss,
                     subtext: "Units P/L",
                     subtextColor: Color.appTextSecondary)
        }
    }

    private func statCard(label: String, value: String, valueColor: Color = .appTextPrimary, subtext: String, subtextColor: Color) -> some View {
        VStack(spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 24, weight: .heavy))
                .foregroundStyle(valueColor)
            Text(subtext)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(subtextColor)
        }
        .frame(maxWidth: .infinity)
        .padding(16)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var dateFilterPills: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(DateFilter.allCases) { filter in
                    let active = dateFilter == filter
                    Button {
                        dateFilter = filter
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: filter.icon).font(.system(size: 12, weight: .semibold))
                            Text(filter.label).font(.system(size: 12, weight: .semibold))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(active ? Color.appPrimary.opacity(0.18) : Color.appSurfaceMuted, in: Capsule())
                        .foregroundStyle(active ? Color.appPrimary : Color.appTextSecondary)
                        .overlay(Capsule().stroke(active ? Color.appPrimary : .clear, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .sensoryFeedback(.selection, trigger: dateFilter)
    }

    private func bestRunCard(_ run: BestRun) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label {
                Text("Best Run (Low to High)").font(.system(size: 16, weight: .heavy)).foregroundStyle(Color.appWin)
            } icon: {
                Image(systemName: "chart.line.uptrend.xyaxis").foregroundStyle(Color.appWin)
            }
            Text("From lowest point to peak performance")
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
            HStack {
                bestRunStat("+\(String(format: "%.2f", run.netUnits))", "Units Gained", Color.appWin)
                Spacer()
                bestRunStat("\(run.wins)-\(run.losses)", "Record", Color.appTextPrimary)
                Spacer()
                bestRunStat("\(run.picksCount)", "Picks", Color.appTextPrimary)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appWin.opacity(0.12), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.appWin.opacity(0.3), lineWidth: 1))
    }

    private func bestRunStat(_ value: String, _ label: String, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.system(size: 20, weight: .heavy)).foregroundStyle(color)
            Text(label).font(.system(size: 11, weight: .medium)).foregroundStyle(Color.appTextSecondary)
        }
    }

    private func overallChartCard(_ overall: SportStat) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("All Sports · Cumulative Units")
                    .font(.system(size: 16, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                if overall.bestRunIndices != nil {
                    Label("Best Run", systemImage: "flame.fill")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.appWin)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color.appWin.opacity(0.2), in: Capsule())
                }
            }
            chart(points: overall.points, band: overall.bestRunIndices, positive: overall.netUnits >= 0, showXAxis: true)
                .frame(height: 200)
        }
        .padding(14)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func sportChartCard(_ stat: SportStat) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(stat.label).font(.system(size: 18, weight: .heavy)).foregroundStyle(Color.appTextPrimary)
                Spacer()
                Text(recordString(stat)).font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.appTextSecondary)
                Text("\(stat.netUnits >= 0 ? "+" : "")\(String(format: "%.2f", stat.netUnits))u")
                    .font(.system(size: 16, weight: .heavy))
                    .foregroundStyle(stat.netUnits >= 0 ? Color.appWin : Color.appLoss)
            }
            if let run = stat.bestRun, run.netUnits > 0 {
                Label("Best Run: +\(String(format: "%.2f", run.netUnits))u (\(run.wins)-\(run.losses))", systemImage: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appWin)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Color.appWin.opacity(0.12), in: Capsule())
            }
            if stat.points.count > 1 {
                chart(points: stat.points, band: stat.bestRunIndices, positive: stat.netUnits >= 0, showXAxis: false)
                    .frame(height: 120)
            } else {
                Text("No picks yet")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity, minHeight: 60)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    @ViewBuilder
    private func chart(points: [ChartPoint], band: (start: Int, end: Int)?, positive: Bool, showXAxis: Bool) -> some View {
        let lineColor = positive ? Color.appWin : Color.appLoss
        let yValues = points.map(\.cumulative)
        let yMin = (yValues.min() ?? 0)
        let yMax = (yValues.max() ?? 0)
        Chart {
            if let band, band.end < points.count {
                RectangleMark(
                    xStart: .value("Start", points[band.start].index),
                    xEnd: .value("End", points[band.end].index),
                    yStart: .value("Min", yMin),
                    yEnd: .value("Max", max(yMax, yMin + 0.001))
                )
                .foregroundStyle(Color.appWin.opacity(0.15))
            }
            ForEach(points) { point in
                LineMark(x: .value("Index", point.index), y: .value("Units", point.cumulative))
                    .interpolationMethod(.monotone)
                    .foregroundStyle(lineColor)
                    .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                AreaMark(x: .value("Index", point.index), y: .value("Units", point.cumulative))
                    .interpolationMethod(.monotone)
                    .foregroundStyle(LinearGradient(colors: [lineColor.opacity(0.2), .clear], startPoint: .top, endPoint: .bottom))
            }
        }
        .chartXAxis {
            if showXAxis {
                AxisMarks(position: .bottom) { value in
                    AxisGridLine().foregroundStyle(Color.appBorder.opacity(0.3))
                    AxisValueLabel {
                        if let n = value.as(Int.self) {
                            Text(n == 0 ? "Start" : (n == points.count - 1 ? "Now" : "")).font(.system(size: 10))
                        }
                    }
                }
            } else {
                AxisMarks(values: [Int]())
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) { value in
                AxisGridLine().foregroundStyle(Color.appBorder.opacity(0.25))
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text(String(format: "%+.0f", v)).font(.system(size: 10))
                    }
                }
            }
        }
    }

    // MARK: - Computation (ports RN helpers)

    private func recordString(_ s: SportStat) -> String {
        s.push > 0 ? "\(s.won)-\(s.lost)-\(s.push)" : "\(s.won)-\(s.lost)"
    }

    private func filteredPicks() -> [EditorPick] {
        let all = store.allPicks
        switch dateFilter {
        case .allTime:
            return all
        case .bestRun:
            return calculateBestRun(all).runPicks ?? all
        case .sevenDay, .thirtyDay, .ninetyDay:
            guard let days = dateFilter.days else { return all }
            let cutoff = Date().addingTimeInterval(-Double(days) * 86_400)
            return all.filter { (EditorPicksStore.parseDate($0.createdAt) ?? .distantPast) >= cutoff }
        }
    }

    /// Lowest-low → highest-high maximum-gain window over settled picks.
    private func calculateBestRun(_ picks: [EditorPick]) -> (run: BestRun?, runPicks: [EditorPick]?) {
        let settled = picks
            .filter { $0.result != nil && $0.result != .pending }
            .sorted { (EditorPicksStore.parseDate($0.createdAt) ?? .distantPast) < (EditorPicksStore.parseDate($1.createdAt) ?? .distantPast) }
        guard !settled.isEmpty else { return (nil, nil) }

        var cumulative: [Double] = [0]
        var running = 0.0
        for pick in settled {
            running += UnitsCalculation.calculate(result: pick.result, odds: pick.bestPrice, units: pick.units).netUnits
            cumulative.append(running)
        }

        var bestGain = 0.0, bestStart = 0, bestEnd = 0
        var minValue = cumulative[0], minIdx = 0
        for i in 1..<cumulative.count {
            if cumulative[i] < minValue { minValue = cumulative[i]; minIdx = i }
            let gain = cumulative[i] - minValue
            if gain > bestGain { bestGain = gain; bestStart = minIdx; bestEnd = i }
        }
        guard bestGain > 0 else { return (nil, nil) }

        let runPicks = Array(settled[bestStart..<bestEnd])
        let wins = runPicks.filter { $0.result == .won }.count
        let losses = runPicks.filter { $0.result == .lost }.count
        let run = BestRun(wins: wins, losses: losses, netUnits: bestGain, picksCount: runPicks.count, indices: (bestStart, bestEnd))
        return (run, runPicks)
    }

    private func sportStat(key: String, label: String, gameType: GameType?, source: [EditorPick]) -> SportStat {
        let picks = gameType == nil ? source : source.filter { $0.gameType == gameType }
        let won = picks.filter { $0.result == .won }.count
        let lost = picks.filter { $0.result == .lost }.count
        let push = picks.filter { $0.result == .push }.count
        let total = won + lost + push
        let winRate = total > 0 ? Double(won) / Double(total) * 100 : 0
        let netUnits = picks.reduce(0.0) { $0 + UnitsCalculation.calculate(result: $1.result, odds: $1.bestPrice, units: $1.units).netUnits }

        // Chart over ALL picks (settled advance cumulative; pending hold flat) — RN parity.
        let sorted = picks.sorted { (EditorPicksStore.parseDate($0.createdAt) ?? .distantPast) < (EditorPicksStore.parseDate($1.createdAt) ?? .distantPast) }
        var cumulative = 0.0
        var points: [ChartPoint] = [ChartPoint(index: 0, cumulative: 0)]
        for (i, pick) in sorted.enumerated() {
            if pick.result != nil && pick.result != .pending {
                cumulative += UnitsCalculation.calculate(result: pick.result, odds: pick.bestPrice, units: pick.units).netUnits
            }
            points.append(ChartPoint(index: i + 1, cumulative: cumulative))
        }

        let br = calculateBestRun(picks).run
        return SportStat(
            key: key, label: label, won: won, lost: lost, push: push,
            netUnits: netUnits, winRate: winRate, points: points,
            bestRunIndices: br?.indices, bestRun: br
        )
    }

    private static let emptyStat = SportStat(key: "all", label: "All Sports", won: 0, lost: 0, push: 0, netUnits: 0, winRate: 0, points: [], bestRunIndices: nil, bestRun: nil)
}
