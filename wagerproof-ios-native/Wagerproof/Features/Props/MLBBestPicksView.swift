import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// Navigation payload for Best Picks → player prop detail.
private struct MLBBestPickDetailRoute: Identifiable, Hashable {
    let selection: PlayerPropSelection
    let initialLine: Double?
    var id: String { selection.id }
}

/// Best MLB player-props hub — today's AI-ranked picks + graded performance.
/// Ports web `/mlb/picks-report` and `/mlb/picks-performance`.
struct MLBBestPicksView: View {
    @Environment(PropsStore.self) private var propsStore
    @Bindable var store: MLBPlayerPropPicksStore
    @State private var segment: Segment = .performance
    @State private var detailRoute: MLBBestPickDetailRoute?
    @State private var resolvingPickId: String?

    private enum Segment: String, CaseIterable, Identifiable {
        case performance, todaysPicks
        var id: String { rawValue }
        var label: String {
            switch self {
            case .performance: return "Performance"
            case .todaysPicks: return "Today's Picks"
            }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerCard
                segmentPicker
                content
            }
            .padding(16)
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle("Best MLB Props")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await store.refresh(force: true) }
        .task {
            if case .idle = store.loadState {
                await store.refresh()
            }
            await propsStore.refreshMLB()
        }
        .navigationDestination(item: $detailRoute) { route in
            PlayerPropDetailView(selection: route.selection, initialLine: route.initialLine)
        }
    }

    // MARK: - Header

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label {
                Text("Algorithm Best Picks")
                    .font(.system(size: 16, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
            } icon: {
                Image(systemName: "sparkles")
                    .foregroundStyle(Color.appPrimary)
            }
            Text("Ranked props combining L10 hit rate, day/night splits, opposing archetype, and recent form. Stakes: Lean 0.5u · Strong 1.0u · Elite 1.5u.")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var segmentPicker: some View {
        Picker("Section", selection: $segment) {
            ForEach(Segment.allCases) { seg in
                Text(seg.label).tag(seg)
            }
        }
        .pickerStyle(.segmented)
        .sensoryFeedback(.selection, trigger: segment)
    }

    @ViewBuilder
    private var content: some View {
        switch store.loadState {
        case .idle, .loading where store.summary.isEmpty && store.todaysPicks.isEmpty:
            loadingPlaceholder
        case .failed(let message) where store.summary.isEmpty && store.todaysPicks.isEmpty:
            errorState(message)
        default:
            switch segment {
            case .performance:
                performanceContent
            case .todaysPicks:
                todaysPicksContent
            }
        }
    }

    // MARK: - Performance

    @ViewBuilder
    private var performanceContent: some View {
        let overall = store.overall
        if overall.settled == 0 && store.summary.isEmpty {
            emptyCard(
                title: "No graded picks yet",
                subtitle: "Picks lock when games start; results populate after games settle."
            )
        } else {
            kpiGrid(overall)
            ForEach(store.tierGroups) { group in
                tierSection(group)
            }
            if !store.recentHistory.isEmpty {
                historySection
            }
        }
    }

    private func kpiGrid(_ overall: MLBPlayerPropPerformanceTotals) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            kpiTile(title: "Settled", value: "\(overall.settled)", sub: "\(overall.won)-\(overall.lost)-\(overall.push) W-L-P")
            kpiTile(title: "Win Rate", value: MLBPlayerPropPerformanceFormatting.formatPct(overall.winPct), sub: "excludes pushes")
            kpiTile(
                title: "Units Won",
                value: MLBPlayerPropPerformanceFormatting.formatUnits(overall.unitsWon),
                sub: "on \(MLBPlayerPropPerformanceFormatting.formatUnits(overall.unitsStaked, signed: false)) staked",
                valueColor: unitsColor(overall.unitsWon)
            )
            kpiTile(
                title: "ROI",
                value: MLBPlayerPropPerformanceFormatting.formatPct(overall.roiPct),
                sub: "units ÷ stake",
                valueColor: unitsColor(overall.unitsWon)
            )
        }
    }

    private func kpiTile(title: String, value: String, sub: String, valueColor: Color = .appTextPrimary) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(valueColor)
                .monospacedDigit()
            Text(sub)
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextMuted)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func tierSection(_ group: MLBPlayerPropTierSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(group.tier.emoji) \(group.tier.label)")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Spacer(minLength: 8)
                Text(
                    "\(group.totals.settled) settled · \(MLBPlayerPropPerformanceFormatting.formatUnits(group.totals.unitsWon)) · \(MLBPlayerPropPerformanceFormatting.formatPct(group.totals.roiPct)) ROI"
                )
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.trailing)
            }
            VStack(spacing: 0) {
                marketHeaderRow
                ForEach(group.markets) { row in
                    marketRow(row)
                    if row.id != group.markets.last?.id {
                        Divider().background(Color.appBorder.opacity(0.35))
                    }
                }
            }
            .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color.appBorder.opacity(0.35), lineWidth: 0.5)
            )
        }
    }

    private enum MarketTableLayout {
        static let columnSpacing: CGFloat = 10
        static let wlp: CGFloat = 46
        static let units: CGFloat = 54
        static let roi: CGFloat = 62
    }

    private var marketHeaderRow: some View {
        HStack(spacing: MarketTableLayout.columnSpacing) {
            Text("Market")
                .frame(maxWidth: .infinity, alignment: .leading)
                .layoutPriority(0)
            Text("W-L-P")
                .frame(width: MarketTableLayout.wlp, alignment: .trailing)
                .layoutPriority(1)
            Text("Units")
                .frame(width: MarketTableLayout.units, alignment: .trailing)
                .layoutPriority(1)
            Text("ROI")
                .frame(width: MarketTableLayout.roi, alignment: .trailing)
                .layoutPriority(1)
        }
        .font(.system(size: 9, weight: .bold))
        .foregroundStyle(Color.appTextMuted)
        .textCase(.uppercase)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.appSurfaceMuted.opacity(0.35))
    }

    private func marketRow(_ row: MLBPlayerPropGradeSummary) -> some View {
        HStack(spacing: MarketTableLayout.columnSpacing) {
            HStack(spacing: 4) {
                Text(MLBPlayerProps.marketEmoji(row.market))
                    .font(.system(size: 12))
                Text(row.marketLabel)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(0)
            Text("\(row.picksWon)-\(row.picksLost)-\(row.picksPush)")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .monospacedDigit()
                .lineLimit(1)
                .frame(width: MarketTableLayout.wlp, alignment: .trailing)
                .layoutPriority(1)
            Text(MLBPlayerPropPerformanceFormatting.formatUnits(row.unitsWon))
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(unitsColor(row.unitsWon))
                .monospacedDigit()
                .lineLimit(1)
                .frame(width: MarketTableLayout.units, alignment: .trailing)
                .layoutPriority(1)
            Text(MLBPlayerPropPerformanceFormatting.formatPct(row.roiPct))
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(unitsColor(row.unitsWon))
                .monospacedDigit()
                .lineLimit(1)
                .frame(width: MarketTableLayout.roi, alignment: .trailing)
                .layoutPriority(1)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Recent Graded Picks")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            VStack(spacing: 8) {
                ForEach(store.recentHistory) { grade in
                    historyRow(grade)
                }
            }
        }
    }

    private func historyRow(_ grade: MLBPlayerPropGrade) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                historyAvatar(for: grade)
                VStack(alignment: .leading, spacing: 2) {
                    Text(grade.playerName ?? "Player")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                    if let team = grade.teamName, !team.isEmpty {
                        Text(team)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                            .lineLimit(1)
                    }
                    Text(grade.reportDate)
                        .font(.system(size: 11))
                        .foregroundStyle(Color.appTextMuted)
                }
                Spacer(minLength: 4)
                resultBadge(grade.result)
            }
            HStack(spacing: 6) {
                Text(MLBPlayerProps.marketEmoji(grade.market))
                Text(
                    "\(grade.marketLabel ?? MLBPlayerProps.marketLabel(grade.market)) \(grade.side == "under" ? "U" : "O") \(MLBPlayerProps.formatLine(grade.line))"
                )
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                if let tier = grade.tier {
                    Text("\(tier.emoji) \(tier.label)")
                        .font(.system(size: 10, weight: .bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Color.appPrimary.opacity(0.12), in: Capsule())
                        .foregroundStyle(Color.appPrimary)
                }
            }
            HStack {
                if let actual = grade.actualValue {
                    Text("Actual: \(MLBPlayerProps.formatBarValue(actual))")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.appTextMuted)
                }
                Spacer()
                Text(MLBPlayerPropPerformanceFormatting.formatUnits(grade.unitsWon))
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(unitsColor(grade.unitsWon))
                    .monospacedDigit()
            }
        }
        .padding(12)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func historyAvatar(for grade: MLBPlayerPropGrade) -> some View {
        playerAvatar(playerId: grade.playerId, teamName: grade.teamName, headshotSize: 40, badgeSize: 18)
    }

    private func pickAvatar(for pick: MLBPlayerPropBestPick) -> some View {
        playerAvatar(playerId: pick.playerId, teamName: pick.teamName, headshotSize: 52, badgeSize: 22)
    }

    private func playerAvatar(
        playerId: Int,
        teamName: String?,
        headshotSize: CGFloat,
        badgeSize: CGFloat
    ) -> some View {
        let team = teamName ?? ""
        let teamInfo = team.isEmpty ? nil : MLBTeams.info(for: team)
        let headshotFrame = headshotSize + 4
        let containerSize = headshotFrame + 4
        return ZStack(alignment: .bottomTrailing) {
            PlayerHeadshot(playerId: playerId, size: headshotSize)
                .frame(width: headshotFrame, height: headshotFrame)

            MLBTeamLogo(
                logoUrl: teamInfo?.logoUrl,
                abbrev: teamInfo?.team ?? String(team.prefix(3)).uppercased(),
                name: team,
                size: badgeSize
            )
            .overlay(Circle().strokeBorder(Color.appSurfaceElevated, lineWidth: 1.5))
            .offset(x: 4, y: 4)
        }
        .frame(width: containerSize, height: containerSize)
    }

    // MARK: - Today's picks

    @ViewBuilder
    private var todaysPicksContent: some View {
        if store.todaysPicks.isEmpty {
            emptyCard(
                title: "No qualified picks right now",
                subtitle: "The slate may not have enough sample yet — check back closer to first pitch."
            )
        } else {
            if !store.batterPicks.isEmpty {
                picksSection(title: "🥎 Batter Picks", picks: store.batterPicks)
            }
            if !store.pitcherPicks.isEmpty {
                picksSection(title: "⚾ Pitcher Picks", picks: store.pitcherPicks)
            }
        }
    }

    private func picksSection(title: String, picks: [MLBPlayerPropBestPick]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            ForEach(picks) { pick in
                pickCard(pick)
            }
        }
    }

    private func pickCard(_ pick: MLBPlayerPropBestPick) -> some View {
        Button {
            Task { await openPickDetail(pick) }
        } label: {
            pickCardContent(pick)
        }
        .buttonStyle(.plain)
        .disabled(resolvingPickId == pick.id)
    }

    private func pickCardContent(_ pick: MLBPlayerPropBestPick) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                pickAvatar(for: pick)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        tierPill(pick.tier, score: pick.score)
                        if pick.locked {
                            Label("Locked", systemImage: "lock.fill")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(Color.appTextSecondary)
                                .labelStyle(.titleAndIcon)
                        }
                        if resolvingPickId == pick.id {
                            ProgressView()
                                .controlSize(.small)
                        }
                    }
                    Text(pick.playerName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text("\(pick.teamName ?? "") · \(pick.gameLabel) · \(pick.isDay ? "☀️ Day" : "🌙 Night")")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
            }
            HStack(spacing: 8) {
                Text("\(MLBPlayerProps.marketEmoji(pick.market)) \(pick.marketLabel)")
                    .font(.system(size: 12, weight: .semibold))
                Text(
                    "\(pick.side == "over" ? "Over" : "Under") \(MLBPlayerProps.formatLine(pick.line)) \(MLBPlayerProps.formatOdds(pick.side == "over" ? pick.overOdds : pick.underOdds))"
                )
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color.appPrimary)
                Spacer()
                if let pct = pick.l10Pct, let over = pick.l10Over, let games = pick.l10Games {
                    Text("\(pct)% L10 · \(over)/\(games)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.appPrimary)
                }
            }
            if !pick.rationale.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(pick.rationale.prefix(3).enumerated()), id: \.offset) { _, line in
                        Text("• \(line)")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(12)
        .background(tierBackground(pick.tier), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(tierBorder(pick.tier), lineWidth: 1)
        )
    }

    private func openPickDetail(_ pick: MLBPlayerPropBestPick) async {
        guard resolvingPickId == nil else { return }
        resolvingPickId = pick.id
        defer { resolvingPickId = nil }

        if let selection = PlayerPropFeed.selection(for: pick, in: propsStore.matchups) {
            detailRoute = MLBBestPickDetailRoute(selection: selection, initialLine: pick.line)
            return
        }

        await propsStore.refreshMLB(force: true)
        if let selection = PlayerPropFeed.selection(for: pick, in: propsStore.matchups) {
            detailRoute = MLBBestPickDetailRoute(selection: selection, initialLine: pick.line)
            return
        }

        if let rows = try? await MLBPlayerPropsService.shared.fetchProps(gamePk: pick.gamePk),
           let selection = PlayerPropFeed.selection(
               for: pick,
               props: rows,
               officialDate: pick.reportDate,
               gameTimeEt: propsStore.matchups.first(where: { $0.gamePk == pick.gamePk })?.gameTimeEt
           ) {
            detailRoute = MLBBestPickDetailRoute(selection: selection, initialLine: pick.line)
        }
    }

    private func tierPill(_ tier: MLBPlayerPropPickTier, score: Int) -> some View {
        Text("\(tier.emoji) \(tier.label.uppercased()) · \(score)")
            .font(.system(size: 10, weight: .heavy))
            .foregroundStyle(tier == .lean ? Color.appTextPrimary : Color.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(tierPillFill(tier), in: Capsule())
    }

    // MARK: - Shared UI

    private func emptyCard(title: String, subtitle: String) -> some View {
        VStack(spacing: 8) {
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text(subtitle)
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .padding(.horizontal, 16)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var loadingPlaceholder: some View {
        VStack(spacing: 10) {
            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.appSurfaceMuted.opacity(0.5))
                    .frame(height: 72)
            }
        }
        .redacted(reason: .placeholder)
    }

    private func errorState(_ message: String) -> some View {
        ContentUnavailableView {
            Label("Couldn't load", systemImage: "exclamationmark.triangle")
        } description: {
            Text(message)
        } actions: {
            Button("Retry") { Task { await store.refresh(force: true) } }
                .buttonStyle(.borderedProminent)
                .tint(Color.appPrimary)
        }
    }

    private func resultBadge(_ result: MLBPlayerPropPickResult?) -> some View {
        Text((result?.rawValue ?? "—").uppercased())
            .font(.system(size: 10, weight: .heavy))
            .foregroundStyle(resultColor(result))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(resultColor(result).opacity(0.12), in: Capsule())
    }

    private func unitsColor(_ value: Double?) -> Color {
        guard let value, value.isFinite else { return Color.appTextMuted }
        if value > 0 { return Color.appWin }
        if value < 0 { return Color.appLoss }
        return Color.appTextMuted
    }

    private func resultColor(_ result: MLBPlayerPropPickResult?) -> Color {
        switch result {
        case .won: return Color.appWin
        case .lost: return Color.appLoss
        case .push, .pending, .void: return Color.appTextMuted
        case nil: return Color.appTextMuted
        }
    }

    private func tierBackground(_ tier: MLBPlayerPropPickTier) -> Color {
        switch tier {
        case .elite: return Color.appPrimary.opacity(0.1)
        case .strong: return Color.appPrimary.opacity(0.05)
        case .lean: return Color.appSurfaceElevated
        }
    }

    private func tierBorder(_ tier: MLBPlayerPropPickTier) -> Color {
        switch tier {
        case .elite: return Color.appPrimary.opacity(0.55)
        case .strong: return Color.appPrimary.opacity(0.3)
        case .lean: return Color.appBorder.opacity(0.45)
        }
    }

    private func tierPillFill(_ tier: MLBPlayerPropPickTier) -> Color {
        switch tier {
        case .elite: return Color.appPrimary
        case .strong: return Color.appPrimary.opacity(0.85)
        case .lean: return Color.appSurfaceMuted
        }
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        MLBBestPicksView(store: MLBPlayerPropPicksStore())
    }
}
#endif
