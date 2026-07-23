import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

// MARK: - Shared systems language

enum SystemsHubTab: String, CaseIterable, Identifiable {
    case mySystems
    case leaderboard

    var id: String { rawValue }
    var title: String {
        switch self {
        case .mySystems: return "My Systems"
        case .leaderboard: return "Leaderboard"
        }
    }
}

/// A system uses the same rounded-square identity footprint as an agent, but a
/// neutral rules icon keeps the two objects distinct.
struct SystemGlyph: View {
    let sport: HistoricalAnalysisSport
    let betType: String
    var size: CGFloat = 46

    @Environment(\.colorScheme) private var colorScheme

    private var marketIcon: String {
        if AnalysisSystemCopy.isTotalMarket(betType, sport: sport) {
            return "arrow.up.arrow.down"
        }
        if betType.contains("spread") || betType == "rl" || betType == "f5_rl" {
            return "point.3.connected.trianglepath.dotted"
        }
        return "slider.horizontal.3"
    }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: size * 0.27, style: .continuous)
        ZStack {
            shape.fill(.ultraThinMaterial)
                .opacity(colorScheme == .dark ? 0.75 : 1)
            shape.fill(Color.appSurfaceMuted.opacity(0.34))
            Image(systemName: marketIcon)
                .font(.system(size: size * 0.34, weight: .bold))
                .foregroundStyle(Color.appPrimary)
            shape.strokeBorder(Color.appBorder.opacity(0.6), lineWidth: 0.5)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

private struct SystemCardSurface: ViewModifier {
    let cornerRadius: CGFloat
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        content
            .background {
                ZStack {
                    shape.fill(.ultraThinMaterial)
                        .opacity(colorScheme == .dark ? 0.55 : 1)
                    shape.strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 0.5)
                }
            }
            .clipShape(shape)
            .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }
}

extension View {
    func systemCardSurface(cornerRadius: CGFloat = 26) -> some View {
        modifier(SystemCardSurface(cornerRadius: cornerRadius))
    }

    func systemSheetPanel(cornerRadius: CGFloat = 16) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        return background(Color.white.opacity(0.04), in: shape)
            .overlay(shape.strokeBorder(Color.white.opacity(0.08), lineWidth: 1))
    }
}

struct SystemFilterSummary: View {
    let labels: [String]
    var limit = 2

    var body: some View {
        if labels.isEmpty {
            Text("No extra filters")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        } else {
            HStack(spacing: 5) {
                ForEach(Array(labels.prefix(limit).enumerated()), id: \.offset) { _, label in
                    Text(label)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(1)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(Color.appSurfaceMuted.opacity(0.55), in: Capsule())
                }
                if labels.count > limit {
                    Text("+\(labels.count - limit)")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(Color.appTextSecondary)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(Color.appSurfaceMuted.opacity(0.55), in: Capsule())
                }
            }
        }
    }
}

private func formatSystemNumber(_ value: Double?) -> String {
    guard let value else { return "—" }
    let magnitude = abs(value)
    let body = magnitude.rounded() == magnitude
        ? String(format: "%.0f", magnitude)
        : String(format: "%.1f", magnitude)
    return "\(value >= 0 ? "+" : "−")\(body)"
}

// MARK: - Leaderboard content

private enum SystemsLeaderboardSort: String, CaseIterable, Identifiable {
    case bestROI
    case bestRecord
    case mostUnits
    case hottestStreak

    var id: String { rawValue }
    var title: String {
        switch self {
        case .bestROI: return "Best ROI"
        case .bestRecord: return "Best Record"
        case .mostUnits: return "Most Units"
        case .hottestStreak: return "Hottest Streak"
        }
    }
    var icon: String {
        switch self {
        case .bestROI: return "chart.line.uptrend.xyaxis"
        case .bestRecord: return "percent"
        case .mostUnits: return "plusminus"
        case .hottestStreak: return "flame.fill"
        }
    }
}

struct SystemsLeaderboardContent: View {
    @Bindable var store: HistoricalAnalysisStore
    var onSelect: (AnalysisSystemsLeaderboardRow) -> Void

    @State private var sort: SystemsLeaderboardSort = .bestROI

    private var sortedRows: [AnalysisSystemsLeaderboardRow] {
        switch sort {
        case .bestROI:
            return store.leaderboard
        case .bestRecord:
            return store.leaderboard.sorted {
                ($0.allTime?.hitPct ?? -1) > ($1.allTime?.hitPct ?? -1)
            }
        case .mostUnits:
            return store.leaderboard.sorted {
                ($0.allTime?.units ?? -.infinity) > ($1.allTime?.units ?? -.infinity)
            }
        case .hottestStreak:
            return store.leaderboard.sorted {
                streakHeat($0) > streakHeat($1)
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            leaderboardControls

            Group {
                if store.isLoadingLeaderboard && store.leaderboard.isEmpty {
                    loadingState
                } else if let error = store.leaderboardError, store.leaderboard.isEmpty {
                    errorState(error)
                } else if store.leaderboard.isEmpty {
                    emptyState
                } else {
                    leaderboardList
                }
            }
        }
        .background(Color.appSurface)
        .task {
            if store.leaderboard.isEmpty {
                await store.loadLeaderboard()
            }
        }
    }

    private var leaderboardControls: some View {
        HStack(spacing: 8) {
            Image(systemName: "trophy.fill")
                .font(.system(size: 11, weight: .bold))
            Text("SYSTEMS")
                .font(.footnote.weight(.semibold))
            Text("10+ GAMES")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
            Spacer(minLength: 0)

            Menu {
                Picker("Rank systems by", selection: $sort) {
                    ForEach(SystemsLeaderboardSort.allCases) { mode in
                        Label(mode.title, systemImage: mode.icon).tag(mode)
                    }
                }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: sort.icon)
                    Text(sort.title)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 8, weight: .bold))
                }
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
            }
            .buttonStyle(.plain)
        }
        .foregroundStyle(Color.appTextSecondary)
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 6)
    }

    private var leaderboardList: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                ForEach(Array(sortedRows.enumerated()), id: \.element.id) { index, row in
                    SystemsLeaderboardCard(
                        rank: index + 1,
                        row: row,
                        sport: store.sport
                    ) {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        onSelect(row)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .refreshable { await store.loadLeaderboard() }
    }

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Ranking shared systems…")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorState(_ message: String) -> some View {
        ContentUnavailableView {
            Label("Couldn't load leaderboard", systemImage: "exclamationmark.triangle")
        } description: {
            Text(message)
        } actions: {
            Button("Retry") {
                Task { await store.loadLeaderboard() }
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.appPrimary)
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No shared systems yet", systemImage: "trophy")
        } description: {
            Text("Shared \(store.sport.shortTitle) systems appear after 10 matching games have been graded.")
        }
    }

    private func streakHeat(_ row: AnalysisSystemsLeaderboardRow) -> Int {
        guard let streak = row.streak, streak.kind == "win" else { return 0 }
        return streak.len
    }
}

/// Read-only fallback for signed-out sessions. Authenticated users get the
/// unified Systems Hub, while the public leaderboard remains discoverable.
struct GuestSystemsLeaderboardSheet: View {
    @Bindable var store: HistoricalAnalysisStore
    var onApply: (AnalysisSystemsLeaderboardRow) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedID: String?

    var body: some View {
        NavigationStack {
            SystemsLeaderboardContent(store: store) { selectedID = $0.id }
                .navigationTitle("Systems Leaderboard")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                }
                .navigationDestination(item: $selectedID) { id in
                    if let row = store.leaderboard.first(where: { $0.id == id }) {
                        LeaderboardSystemDetailView(
                            row: row,
                            sport: store.sport,
                            onUse: {
                                onApply(row)
                                dismiss()
                            },
                            onSaveCopy: nil
                        )
                    }
                }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

private struct SystemsLeaderboardCard: View {
    let rank: Int
    let row: AnalysisSystemsLeaderboardRow
    let sport: HistoricalAnalysisSport
    var onTap: () -> Void

    private var record: AnalysisSystemRecord? { row.allTime }
    private var marketLabel: String {
        HistoricalAnalysisBetType(rawValue: row.betType)?.label ?? row.betType.uppercased()
    }
    private var filterLabels: [String] {
        guard let filters = row.filters else { return [] }
        return HistoricalAnalysisCopy.filterChipLabels(sport: sport, snapshot: filters)
    }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 12) {
                    SystemGlyph(sport: sport, betType: row.betType, size: 44)
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            rankLabel
                            Text(row.name)
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(Color.appTextPrimary)
                                .lineLimit(1)
                        }
                        Text("by \(row.username) · \(marketLabel)")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    temperatureBadge
                    primaryStat
                }

                Divider().background(Color.appBorder.opacity(0.5))
                HStack(spacing: 8) {
                    SystemFilterSummary(labels: filterLabels)
                    Spacer(minLength: 0)
                    Text(AnalysisSystemCopy.recordText(record))
                    Text("·")
                    Text(record?.units.map { "\(formatSystemNumber($0))u" } ?? "—")
                }
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(Color.appTextSecondary)
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)
            .padding(.bottom, 9)
            .systemCardSurface()
        }
        .buttonStyle(.plain)
    }

    private var primaryStat: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text("ROI")
                .font(.system(size: 8, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextMuted)
            Text(record?.roi.map { "\(formatSystemNumber($0))%" } ?? "—")
                .font(.system(size: 15, weight: .bold, design: .monospaced))
                .foregroundStyle(metricTint(record?.roi))
        }
    }

    private var rankLabel: some View {
        Group {
            if rank == 1 {
                Image(systemName: "trophy.fill")
            } else {
                Text("#\(rank)")
            }
        }
        .font(.system(size: 10, weight: .bold))
        .foregroundStyle(rankColor)
    }

    private var rankColor: Color {
        switch rank {
        case 1: return Color(hex: 0xF59E0B)
        case 2: return Color(hex: 0x94A3B8)
        case 3: return Color(hex: 0xB45309)
        default: return Color.appTextSecondary
        }
    }

    @ViewBuilder
    private var temperatureBadge: some View {
        switch AnalysisSystemCopy.temperature(streak: row.streak, last10: row.last10) {
        case .fire:
            Text("🔥").font(.system(size: 15))
        case .ice:
            Text("❄️").font(.system(size: 15))
        case .neutral:
            EmptyView()
        }
    }

    private func metricTint(_ value: Double?) -> Color {
        guard let value else { return Color.appTextSecondary }
        return value >= 0 ? Color.appWin : Color.appLoss
    }
}

// MARK: - Leaderboard detail

struct LeaderboardSystemDetailView: View {
    let row: AnalysisSystemsLeaderboardRow
    let sport: HistoricalAnalysisSport
    var onUse: () -> Void
    var onSaveCopy: (() -> Void)?

    private var marketLabel: String {
        HistoricalAnalysisBetType(rawValue: row.betType)?.label ?? row.betType.uppercased()
    }
    private var filterLabels: [String] {
        guard let filters = row.filters else { return [] }
        return HistoricalAnalysisCopy.filterChipLabels(sport: sport, snapshot: filters)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 13) {
                    SystemGlyph(sport: sport, betType: row.betType, size: 48)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(row.name)
                            .font(.system(size: 19, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                        Text("by \(row.username)")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }

                detailsCard
            }
            .padding(20)
            .padding(.bottom, 104)
        }
        .background(Color.appSurface)
        .navigationTitle("System Details")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let onSaveCopy {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save Copy", action: onSaveCopy)
                        .fontWeight(.semibold)
                        .accessibilityLabel("Save a copy")
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Button("Use This System", action: onUse)
                .font(.system(size: 14, weight: .bold))
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(
                    Color.appPrimary,
                    in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                )
                .foregroundStyle(.white)
                .disabled(row.filters == nil)
            .buttonStyle(.plain)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial)
        }
    }

    private var detailsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            detailRow(label: "Rule") {
                Text("\(AnalysisSystemCopy.verdictLabel(row.verdict)) · \(marketLabel)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            Divider().background(Color.appBorder.opacity(0.5))
            detailRow(label: "Filters") {
                ScrollView(.horizontal, showsIndicators: false) {
                    SystemFilterSummary(labels: filterLabels, limit: filterLabels.count)
                }
            }
            Divider().background(Color.appBorder.opacity(0.5))
            HStack(spacing: 18) {
                detailMetric("RECORD", AnalysisSystemCopy.recordText(row.allTime))
                detailMetric("ROI", row.allTime?.roi.map { "\(formatSystemNumber($0))%" } ?? "—")
                detailMetric("UNITS", row.allTime?.units.map { "\(formatSystemNumber($0))u" } ?? "—")
                Spacer(minLength: 0)
            }
            if let last10 = row.last10, last10.n > 0 {
                Divider().background(Color.appBorder.opacity(0.5))
                HStack(spacing: 5) {
                    Text("LAST 10")
                        .font(.system(size: 8, weight: .bold))
                        .tracking(0.5)
                        .foregroundStyle(Color.appTextMuted)
                        .fixedSize()
                    Spacer(minLength: 4)
                    ForEach(Array(last10.results.prefix(10).enumerated()), id: \.offset) { _, result in
                        Capsule()
                            .fill(result != 0 ? Color.appWin : Color.appLoss)
                            .frame(maxWidth: .infinity)
                            .frame(height: 7)
                    }
                    Text("\(last10.wins)/\(last10.n)")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color.appTextPrimary)
                        .padding(.leading, 3)
                        .fixedSize()
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .padding(.bottom, 10)
        .systemCardSurface()
    }

    private func detailMetric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(.system(size: 8, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .monospacedDigit()
                .foregroundStyle(Color.appTextPrimary)
                .minimumScaleFactor(0.7)
        }
    }

    private func detailRow<Content: View>(
        label: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
                .frame(width: 48, alignment: .leading)
            content()
            Spacer(minLength: 0)
        }
    }
}

struct FlexibleSystemChips: View {
    let labels: [String]

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 6) {
                chipViews
            }
            VStack(alignment: .leading, spacing: 6) {
                chipViews
            }
        }
    }

    @ViewBuilder
    private var chipViews: some View {
        ForEach(Array(labels.enumerated()), id: \.offset) { _, label in
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color.appTextSecondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(Color.appSurfaceMuted.opacity(0.8), in: Capsule())
        }
    }
}
