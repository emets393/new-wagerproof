import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Slim tappable banner on each sport's Trends screen.
struct SystemsLeaderboardBanner: View {
    var onPress: () -> Void

    var body: some View {
        Button(action: {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            onPress()
        }) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 44, height: 44)
                    Text("🏆")
                        .font(.system(size: 22))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Systems Leaderboard")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text("The most profitable systems users have shared")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 0)

                Image(systemName: "chevron.right")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                LinearGradient(
                    colors: [
                        Color(hex: 0xFDF6E3).opacity(0.95),
                        Color(hex: 0xFAEDC8).opacity(0.95),
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: RoundedRectangle(cornerRadius: 20, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(Color(hex: 0xD97706).opacity(0.2), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Sort mode (client-side reorder of RPC payload)

/// Single-select sort over the already-fetched leaderboard.
/// RPC ranks by all-time ROI; other modes re-sort locally from grader fields.
private enum SystemsLeaderboardSort: String, CaseIterable, Identifiable {
    case bestROI
    case bestRecord
    case mostUnits
    case hottestStreak

    var id: String { rawValue }

    var title: String {
        switch self {
        case .bestROI: return "Best ROI"
        case .bestRecord: return "Best record"
        case .mostUnits: return "Most units"
        case .hottestStreak: return "Hottest streak"
        }
    }

    var icon: String {
        switch self {
        case .bestROI: return "chart.line.uptrend.xyaxis"
        case .bestRecord: return "percent"
        case .mostUnits: return "bolt.fill"
        case .hottestStreak: return "flame.fill"
        }
    }
}

/// Sport-scoped Systems Leaderboard list.
struct SystemsLeaderboardSheet: View {
    @Bindable var store: HistoricalAnalysisStore
    var onApply: (AnalysisSystemsLeaderboardRow) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    @State private var sort: SystemsLeaderboardSort = .bestROI

    private var title: String { "\(store.sport.shortTitle) Systems Leaderboard" }

    private var sportAccent: Color {
        switch store.sport {
        case .mlb: return Color(hex: 0x002D72)
        case .nfl: return Color(hex: 0x013369)
        case .cfb: return Color(hex: 0xC8102E)
        }
    }

    private var sortedRows: [AnalysisSystemsLeaderboardRow] {
        let rows = store.leaderboard
        switch sort {
        case .bestROI:
            // RPC default order is all-time ROI — keep as delivered.
            return rows
        case .bestRecord:
            return rows.sorted {
                ($0.allTime?.hitPct ?? -1) > ($1.allTime?.hitPct ?? -1)
            }
        case .mostUnits:
            return rows.sorted {
                ($0.allTime?.units ?? -.infinity) > ($1.allTime?.units ?? -.infinity)
            }
        case .hottestStreak:
            // Win streaks only; longer wins rank higher. Cold streaks sort last.
            return rows.sorted {
                streakHeat($0) > streakHeat($1)
            }
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if store.isLoadingLeaderboard && store.leaderboard.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if store.leaderboard.isEmpty {
                    ContentUnavailableView(
                        "No shared systems yet",
                        systemImage: "trophy",
                        description: Text(
                            "Only shared \(store.sport.shortTitle) systems with 10+ games of history appear here. Save a system, turn Share on, and check back once it has enough matching games."
                        )
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12, pinnedViews: []) {
                            sortChipRow
                                .padding(.bottom, 4)

                            ForEach(Array(sortedRows.enumerated()), id: \.element.id) { index, row in
                                SystemsLeaderboardCard(
                                    rank: index + 1,
                                    row: row,
                                    sport: store.sport,
                                    sportAccent: sportAccent,
                                    colorScheme: colorScheme
                                ) {
                                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                    onApply(row)
                                    dismiss()
                                }
                            }
                        }
                        .padding(16)
                        .padding(.bottom, 24)
                    }
                }
            }
            .background(Color.appSurface)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                await store.loadLeaderboard()
            }
        }
    }

    private var sortChipRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Sort by")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Color.appTextSecondary)
                .textCase(.uppercase)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(SystemsLeaderboardSort.allCases) { mode in
                        let selected = sort == mode
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            withAnimation(.easeInOut(duration: 0.18)) { sort = mode }
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: mode.icon)
                                    .font(.system(size: 11, weight: .bold))
                                Text(mode.title)
                                    .font(.system(size: 12, weight: .semibold))
                            }
                            .foregroundStyle(selected ? Color.white : Color.appTextPrimary)
                            .padding(.horizontal, 12)
                            .frame(height: 32)
                            .background(
                                Capsule()
                                    .fill(
                                        selected
                                            ? AnyShapeStyle(
                                                LinearGradient(
                                                    colors: [sportAccent, sportAccent.opacity(0.75)],
                                                    startPoint: .topLeading,
                                                    endPoint: .bottomTrailing
                                                )
                                            )
                                            : AnyShapeStyle(Color.appSurfaceMuted.opacity(0.9))
                                    )
                            )
                            .overlay(
                                Capsule()
                                    .strokeBorder(
                                        selected ? Color.clear : Color.appBorder.opacity(0.4),
                                        lineWidth: 1
                                    )
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    /// Hot = win streak length; cold / missing = 0 so they sink when sorting Hottest.
    private func streakHeat(_ row: AnalysisSystemsLeaderboardRow) -> Int {
        guard let streak = row.streak, streak.kind == "win" else { return 0 }
        return streak.len
    }
}

// MARK: - Card

private struct SystemsLeaderboardCard: View {
    let rank: Int
    let row: AnalysisSystemsLeaderboardRow
    let sport: HistoricalAnalysisSport
    let sportAccent: Color
    let colorScheme: ColorScheme
    var onTap: () -> Void

    private var at: AnalysisSystemRecord? { row.allTime }
    private var roi: Double? { at?.roi }
    private var units: Double? { at?.units }
    private var temperature: SystemTemperature {
        AnalysisSystemCopy.temperature(streak: row.streak, last10: row.last10)
    }
    private var accentBar: Color {
        switch temperature {
        case .fire: return Color.appWin
        case .ice: return Color(hex: 0x38BDF8)
        case .neutral:
            if let roi, roi >= 0 { return Color.appWin.opacity(0.85) }
            if let roi, roi < 0 { return Color.appLoss.opacity(0.85) }
            return sportAccent
        }
    }
    private var filterLabels: [String] {
        guard let filters = row.filters else { return [] }
        return HistoricalAnalysisCopy.filterChipLabels(sport: sport, snapshot: filters)
    }
    private var marketLabel: String {
        HistoricalAnalysisBetType.from(row.betType).label
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 0) {
                // Thin accent rail — fire/ice/ROI tint for instant temperature read.
                UnevenRoundedRectangle(
                    topLeadingRadius: 18,
                    bottomLeadingRadius: 18,
                    bottomTrailingRadius: 0,
                    topTrailingRadius: 0,
                    style: .continuous
                )
                .fill(
                    LinearGradient(
                        colors: [accentBar, accentBar.opacity(0.55)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 4)

                VStack(alignment: .leading, spacing: 10) {
                    headerRow
                    betLine
                    timeframeBlock
                    seasonRow
                    formRow
                    if !filterLabels.isEmpty {
                        filterChips
                    }
                }
                .padding(.leading, 12)
                .padding(.trailing, 14)
                .padding(.vertical, 14)
            }
            .background { cardBackground }
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(borderColor, lineWidth: 1)
            )
            .shadow(color: shadowColor, radius: 8, x: 0, y: 3)
        }
        .buttonStyle(.plain)
    }

    // MARK: Sections

    private var headerRow: some View {
        HStack(alignment: .center, spacing: 10) {
            rankBadge
            VStack(alignment: .leading, spacing: 2) {
                Text(row.name)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                Text("by \(row.username)")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            if let badge = AnalysisSystemCopy.sampleBadge(n: at?.n) {
                Text(badge)
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(0.3)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .foregroundStyle(Color.appTextPrimary)
                    .background(Color.appSurfaceMuted.opacity(0.95), in: Capsule())
            }
            if temperature == .fire {
                Text("🔥")
                    .font(.system(size: 18))
            } else if temperature == .ice {
                Text("❄️")
                    .font(.system(size: 18))
            }
        }
    }

    private var betLine: some View {
        Text("\(AnalysisSystemCopy.verdictLabel(row.verdict)) · \(marketLabel)")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Color.appTextSecondary)
    }

    private var timeframeBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("In filter's timeframe")
                .font(.system(size: 10, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
                .textCase(.uppercase)

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(AnalysisSystemCopy.recordText(at))
                    .font(.system(size: 20, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Color.appTextPrimary)

                if let roi {
                    Text("\(roi >= 0 ? "+" : "")\(formatNum(roi))% ROI")
                        .font(.system(size: 15, weight: .heavy))
                        .monospacedDigit()
                        .foregroundStyle(roi >= 0 ? Color.appWin : Color.appLoss)
                } else {
                    Text("— ROI")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                }

                if let units {
                    Text("\(units >= 0 ? "+" : "")\(formatNum(units))u")
                        .font(.system(size: 14, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(units >= 0 ? Color.appWin : Color.appLoss)
                }

                Spacer(minLength: 0)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.appSurface.opacity(colorScheme == .dark ? 0.35 : 0.55))
        )
    }

    private var seasonRow: some View {
        Text(
            "This season\(row.seasonLabel.map { " (\($0))" } ?? ""): \(AnalysisSystemCopy.recordText(row.currentSeason))"
        )
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(Color.appTextSecondary)
    }

    @ViewBuilder
    private var formRow: some View {
        let last10 = row.last10
        let streak = row.streak
        let showStreak = (streak?.len ?? 0) >= 3
        let hotL10 = AnalysisSystemCopy.isHotLast10(last10)
        let coldL10 = AnalysisSystemCopy.isColdLast10(last10)
        let hotStreak = AnalysisSystemCopy.isHotStreak(streak)
        let coldStreak = AnalysisSystemCopy.isColdStreak(streak)

        if (last10?.n ?? 0) > 0 || showStreak {
            HStack(spacing: 8) {
                if let last10, last10.n > 0 {
                    HStack(spacing: 6) {
                        if hotL10 {
                            Text("🔥")
                                .font(.system(size: 12))
                        } else if coldL10 {
                            Text("❄️")
                                .font(.system(size: 12))
                        }
                        HStack(spacing: 3) {
                            ForEach(Array(last10.results.prefix(10).enumerated()), id: \.offset) { _, r in
                                Capsule()
                                    .fill(r != 0 ? Color.appWin : Color.appLoss)
                                    .frame(width: 6, height: 10)
                            }
                        }
                        Text("\(last10.wins)/\(last10.n)")
                            .font(.system(size: 11, weight: .bold))
                            .monospacedDigit()
                            .foregroundStyle(
                                hotL10 ? Color.appWin : (coldL10 ? Color(hex: 0x38BDF8) : Color.appTextSecondary)
                            )
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(
                        (hotL10 ? Color.appWin : (coldL10 ? Color(hex: 0x38BDF8) : Color.appSurfaceMuted))
                            .opacity(hotL10 || coldL10 ? 0.16 : 0.9),
                        in: Capsule()
                    )
                }

                if showStreak, let streak {
                    let win = streak.kind == "win"
                    HStack(spacing: 4) {
                        Text(win ? "🔥" : "❄️")
                            .font(.system(size: 12))
                        Text(win ? "\(streak.len) straight" : "\(streak.len) straight misses")
                            .font(.system(size: 11, weight: .heavy))
                    }
                    .foregroundStyle(win ? Color.appWin : Color(hex: 0x38BDF8))
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(
                        (win ? Color.appWin : Color(hex: 0x38BDF8)).opacity(0.16),
                        in: Capsule()
                    )
                    .opacity(hotStreak || coldStreak ? 1 : 0.85)
                }

                Spacer(minLength: 0)
            }
        }
    }

    private var filterChips: some View {
        VStack(alignment: .leading, spacing: 6) {
            Divider().opacity(0.5)
            RegressionFlowLayout(spacing: 6) {
                ForEach(Array(filterLabels.enumerated()), id: \.offset) { _, label in
                    Text(label)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(sportAccent.opacity(colorScheme == .dark ? 0.28 : 0.12))
                        )
                        .overlay(
                            Capsule()
                                .strokeBorder(sportAccent.opacity(0.25), lineWidth: 0.5)
                        )
                }
            }
        }
    }

    // MARK: Rank / chrome

    @ViewBuilder
    private var rankBadge: some View {
        let (fill, icon): ([Color], String?) = {
            switch rank {
            case 1: return ([Color(hex: 0xFBBF24), Color(hex: 0xD97706)], "trophy.fill")
            case 2: return ([Color(hex: 0xE5E7EB), Color(hex: 0x9CA3AF)], "medal.fill")
            case 3: return ([Color(hex: 0xF59E0B), Color(hex: 0xB45309)], "medal.fill")
            default: return ([sportAccent.opacity(0.9), sportAccent.opacity(0.55)], nil)
            }
        }()

        ZStack {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(
                    LinearGradient(colors: fill, startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .frame(width: 36, height: 36)
                .shadow(color: fill[0].opacity(rank <= 3 ? 0.45 : 0.2), radius: rank <= 3 ? 6 : 2, y: 1)

            if let icon, rank <= 3 {
                VStack(spacing: 0) {
                    Image(systemName: icon)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white.opacity(0.95))
                    Text("#\(rank)")
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(.white)
                }
            } else {
                Text("#\(rank)")
                    .font(.system(size: 13, weight: .black))
                    .foregroundStyle(.white)
            }
        }
    }

    private var cardBackground: some View {
        let shape = RoundedRectangle(cornerRadius: 18, style: .continuous)
        return ZStack {
            shape.fill(.ultraThinMaterial)
                .opacity(colorScheme == .dark ? 0.55 : 1)
            shape.fill(
                LinearGradient(
                    colors: [
                        accentBar.opacity(colorScheme == .dark ? 0.14 : 0.08),
                        Color.clear,
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
        }
    }

    private var borderColor: Color {
        switch temperature {
        case .fire: return Color.appWin.opacity(0.35)
        case .ice: return Color(hex: 0x38BDF8).opacity(0.4)
        case .neutral: return Color.appBorder.opacity(0.4)
        }
    }

    private var shadowColor: Color {
        switch temperature {
        case .fire: return Color.appWin.opacity(0.18)
        case .ice: return Color(hex: 0x38BDF8).opacity(0.16)
        case .neutral: return Color.black.opacity(0.06)
        }
    }

    private func formatNum(_ v: Double) -> String {
        if v.rounded() == v { return "\(Int(v))" }
        return String(format: "%.1f", v)
    }
}
