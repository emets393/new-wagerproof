import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Filterable matchup-specific trends hub — NFL first; other sports show empty state.
struct OutliersTrendsView: View {
    @Bindable var store: OutliersTrendsStore

    @State private var showCFBMatchupPicker = false

    private let logoSize: CGFloat = 34
    private let tileShape = RoundedRectangle(cornerRadius: 14, style: .continuous)
    private let marketTileHeight: CGFloat = 56

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            filterBar
            content
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.vertical, Spacing.md)
        .onChange(of: store.sport) { _, _ in
            store.onSportChanged()
            Task { await store.refresh() }
        }
        .onChange(of: store.matchupFilter) { _, _ in store.onMatchupChanged() }
        .onChange(of: store.subject) { _, _ in store.onSubjectChanged() }
        .onChange(of: store.gameMarket) { _, _ in store.onFiltersChanged() }
        .onChange(of: store.propMarket) { _, _ in store.onFiltersChanged() }
    }

    // MARK: - Filters

    private var filterBar: some View {
        VStack(alignment: .leading, spacing: 12) {
            filterRow(title: "Sport") {
                Picker("Sport", selection: $store.sport) {
                    ForEach(OutliersTrendsSport.allCases) { sport in
                        Text(sport.label).tag(sport)
                    }
                }
                .pickerStyle(.segmented)
            }

            if store.sport.hasTrendsData {
                if store.sport.allowedSubjects.count > 1 {
                    filterRow(title: "Subject") {
                        Picker("Subject", selection: $store.subject) {
                            ForEach(store.sport.allowedSubjects) { subject in
                                Text(subject.label).tag(subject)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                }

                filterRow(title: "Matchup") {
                    if store.sport == .ncaaf {
                        cfbMatchupPickerButton
                    } else {
                        matchupScroller
                    }
                }

                filterRow(title: "Market") {
                    marketScroller
                }
            }
        }
        .sheet(isPresented: $showCFBMatchupPicker) {
            CFBMatchupPickerSheet(games: store.games, selection: $store.matchupFilter)
        }
    }

    private var cfbMatchupPickerButton: some View {
        Button {
            showCFBMatchupPicker = true
        } label: {
            HStack(spacing: 10) {
                if case .game(let id) = store.matchupFilter,
                   let game = store.games.first(where: { $0.id == id }) {
                    GameCardTeamAvatar(
                        teamName: game.awayTeam,
                        sport: "cfb",
                        size: 28,
                        colors: CFBTeamColors.colorPair(for: game.awayTeam)
                    )
                    Text(CFBTeamAssets.displayName(for: game.awayTeam))
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1)
                    Text("@")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                    GameCardTeamAvatar(
                        teamName: game.homeTeam,
                        sport: "cfb",
                        size: 28,
                        colors: CFBTeamColors.colorPair(for: game.homeTeam)
                    )
                    Text(CFBTeamAssets.displayName(for: game.homeTeam))
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1)
                } else {
                    Image(systemName: "sportscourt.fill")
                        .font(.system(size: 18, weight: .semibold))
                    Text("All games (top 50)")
                        .font(.system(size: 14, weight: .semibold))
                }
                Spacer()
                Image(systemName: "chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
            }
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .foregroundStyle(Color.appTextPrimary)
            .background(
                tileShape.fill(Color.appSurfaceMuted.opacity(0.55))
            )
            .overlay(
                tileShape.stroke(Color.appBorder.opacity(0.45), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var matchupScroller: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(gameFilterOptions) { option in
                    matchupTile(option)
                }
            }
            .padding(.horizontal, 2)
            .padding(.vertical, 2)
        }
    }

    private var marketScroller: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                if store.subject == .players {
                    ForEach(OutliersTrendsPropMarket.allCases) { market in
                        marketTile(
                            icon: propMarketIcon(market),
                            label: propMarketShortLabel(market),
                            isActive: store.propMarket == market
                        ) {
                            store.propMarket = market
                        }
                        .accessibilityLabel(market.label)
                    }
                } else {
                    ForEach(activeGameMarkets) { market in
                        marketTile(
                            icon: gameMarketIcon(market),
                            label: gameMarketShortLabel(market),
                            isActive: store.effectiveGameMarket == market
                        ) {
                            store.gameMarket = market
                        }
                        .accessibilityLabel(market.label)
                    }
                }
            }
            .padding(.horizontal, 2)
            .padding(.vertical, 2)
        }
    }

    private func matchupTile(_ option: OutliersTrendsGameFilterOption) -> some View {
        let isActive = isMatchupActive(option)
        return Button {
            store.matchupFilter = option.matchupFilter
        } label: {
            Group {
                if option.isAllGames {
                    VStack(spacing: 4) {
                        Image(systemName: store.sport == .mlb ? "figure.baseball" : "football.fill")
                            .font(.system(size: 20, weight: .semibold))
                        Text("All")
                            .font(.system(size: 11, weight: .bold))
                    }
                    .frame(width: 72, height: 56)
                } else {
                    HStack(spacing: 6) {
                        GameCardTeamAvatar(
                            teamName: option.awayAb,
                            sport: avatarSportCode,
                            size: logoSize,
                            colors: teamColorPair(for: option.awayAb)
                        )
                        Text("@")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.appTextMuted)
                        GameCardTeamAvatar(
                            teamName: option.homeAb,
                            sport: avatarSportCode,
                            size: logoSize,
                            colors: teamColorPair(for: option.homeAb)
                        )
                    }
                    .padding(.horizontal, 12)
                    .frame(height: 56)
                }
            }
            .foregroundStyle(isActive ? Color(hex: 0x00E676) : Color.appTextSecondary)
            .background(
                tileShape.fill(
                    isActive
                        ? Color(hex: 0x00E676).opacity(0.12)
                        : Color.appSurfaceMuted.opacity(0.55)
                )
            )
            .overlay(
                tileShape.stroke(
                    isActive
                        ? Color(hex: 0x00E676).opacity(0.5)
                        : Color.appBorder.opacity(0.45),
                    lineWidth: isActive ? 1.5 : 1
                )
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(option.accessibilityLabel)
    }

    private func marketTile(
        icon: String,
        label: String,
        isActive: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                Text(label)
                    .font(.system(size: 11, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .frame(minWidth: 72)
            .frame(height: marketTileHeight)
            .padding(.horizontal, 10)
            .foregroundStyle(isActive ? Color(hex: 0x00E676) : Color.appTextSecondary)
            .background(
                tileShape.fill(
                    isActive
                        ? Color(hex: 0x00E676).opacity(0.12)
                        : Color.appSurfaceMuted.opacity(0.55)
                )
            )
            .overlay(
                tileShape.stroke(
                    isActive
                        ? Color(hex: 0x00E676).opacity(0.5)
                        : Color.appBorder.opacity(0.45),
                    lineWidth: isActive ? 1.5 : 1
                )
            )
        }
        .buttonStyle(.plain)
    }

    private func gameMarketShortLabel(_ market: OutliersTrendsGameMarket) -> String {
        switch market {
        case .all: return "All"
        case .spread: return "Spread"
        case .moneyline: return "ML"
        case .total: return "Total"
        case .teamTotal: return "Team Tot"
        case .h1Spread: return "1H Spr"
        case .h1Total: return "1H Tot"
        case .ml: return "ML"
        case .rl: return "RL"
        case .ou: return "Total"
        case .f5Ml: return "F5 ML"
        case .f5Rl: return "F5 RL"
        case .f5Ou: return "F5 Tot"
        }
    }

    private func gameMarketIcon(_ market: OutliersTrendsGameMarket) -> String {
        switch market {
        case .all: return "square.grid.2x2.fill"
        case .spread, .rl, .f5Rl: return "arrow.left.and.right"
        case .moneyline, .ml, .f5Ml: return "dollarsign.circle.fill"
        case .total, .ou, .f5Ou: return "sum"
        case .teamTotal: return "person.2.fill"
        case .h1Spread: return "clock.arrow.left.and.right"
        case .h1Total: return "clock.badge.checkmark"
        }
    }

    private func propMarketShortLabel(_ market: OutliersTrendsPropMarket) -> String {
        switch market {
        case .all: return "All"
        case .anytimeTD: return "ATD"
        case .rushYards: return "Rush Yds"
        case .recYards: return "Rec Yds"
        case .receptions: return "Rec"
        case .passYards: return "Pass Yds"
        case .passTDs: return "Pass TDs"
        }
    }

    private func propMarketIcon(_ market: OutliersTrendsPropMarket) -> String {
        switch market {
        case .all: return "square.grid.2x2.fill"
        case .anytimeTD: return "figure.run.circle.fill"
        case .rushYards: return "figure.run"
        case .recYards: return "arrow.down.right.circle.fill"
        case .receptions: return "hand.raised.fill"
        case .passYards: return "paperplane.fill"
        case .passTDs: return "trophy.fill"
        }
    }

    private var avatarSportCode: String {
        switch store.sport {
        case .ncaaf: return "cfb"
        case .mlb: return "mlb"
        default: return "nfl"
        }
    }

    private func teamColorPair(for abbr: String) -> TeamColorPair {
        switch store.sport {
        case .ncaaf: return CFBTeamColors.colorPair(for: abbr)
        case .mlb: return MLBTeamColors.colorPair(for: abbr)
        default: return NFLTeamColors.colorPair(for: abbr)
        }
    }

    private var gameFilterOptions: [OutliersTrendsGameFilterOption] {
        var options: [OutliersTrendsGameFilterOption] = [
            OutliersTrendsGameFilterOption(gameId: nil, awayAb: "", homeAb: "")
        ]
        for game in store.games {
            let awayLabel = store.sport == .ncaaf
                ? CFBTeamAssets.abbr(for: game.awayTeam)
                : game.awayAb
            let homeLabel = store.sport == .ncaaf
                ? CFBTeamAssets.abbr(for: game.homeTeam)
                : game.homeAb
            options.append(OutliersTrendsGameFilterOption(
                gameId: game.id,
                awayAb: awayLabel,
                homeAb: homeLabel
            ))
        }
        return options
    }

    private var activeGameMarkets: [OutliersTrendsGameMarket] {
        OutliersTrendsGameMarket.markets(for: store.sport, subject: store.subject)
    }

    private var teamGameMarkets: [OutliersTrendsGameMarket] {
        OutliersTrendsGameMarket.markets(for: store.sport, subject: .teams)
    }

    private var refGameMarkets: [OutliersTrendsGameMarket] {
        OutliersTrendsGameMarket.markets(for: store.sport, subject: .refs)
    }

    private func isMatchupActive(_ option: OutliersTrendsGameFilterOption) -> Bool {
        switch (store.matchupFilter, option.gameId) {
        case (.allGames, nil): return true
        case (.game(let id), let optionId): return id == optionId
        default: return false
        }
    }

    private func filterRow<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
            content()
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if !store.sport.hasTrendsData {
            comingSoonState
        } else if case .failed(let message) = store.loadState, store.slateGames.isEmpty {
            errorState(message)
        } else {
            if store.isLoadingTrends && store.cards.isEmpty {
                loadingState
            } else if let message = store.lastError, store.cards.isEmpty {
                errorState(message)
            } else if store.cards.isEmpty && !store.isLoadingTrends {
                emptyState
            } else {
                cardList
            }
            if store.isLoadingTrends && !store.cards.isEmpty {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("Updating trends…")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
        }
    }

    private var gamesById: [String: OutliersTrendsGame] {
        Dictionary(uniqueKeysWithValues: store.games.map { ($0.id, $0) })
    }

    private var cardList: some View {
        VStack(spacing: 10) {
            ForEach(store.cards) { card in
                OutliersTrendCard(card: card, sport: store.sport, game: gamesById[card.gameId]) {
                    store.expandPlayers(for: card.gameId)
                }
            }
            if store.canShowMore {
                Button("Show more") { store.showMore() }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
        }
    }

    private var comingSoonState: some View {
        VStack(spacing: 10) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Color.appTextMuted)
            Text("Trends coming soon")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text("\(store.sport.label) situational betting trends aren't live yet — NFL, NCAAF, and MLB are available now.")
                .font(.system(size: 13))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }

    private var loadingState: some View {
        VStack(spacing: 10) {
            ProgressView()
            Text("Loading trends…")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }

    private func errorState(_ message: String) -> some View {
        ContentUnavailableView {
            Label("Couldn't load trends", systemImage: "exclamationmark.triangle")
        } description: {
            Text(message)
        } actions: {
            Button("Retry") { Task { await store.refresh() } }
                .buttonStyle(.borderedProminent)
                .tint(Color.appPrimary)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "line.3.horizontal.decrease.circle")
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Color.appTextMuted)
            Text("No trends match")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text("Try a different matchup, subject, or bet type — or check back when the slate fills in.")
                .font(.system(size: 13))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }
}

// MARK: - CFB matchup picker

private struct CFBMatchupPickerSheet: View {
    let games: [OutliersTrendsGame]
    @Binding var selection: OutliersTrendsMatchupFilter
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""

    private var filteredGames: [OutliersTrendsGame] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return games }
        let lower = trimmed.lowercased()
        return games.filter { game in
            game.awayTeam.localizedCaseInsensitiveContains(lower)
                || game.homeTeam.localizedCaseInsensitiveContains(lower)
                || CFBTeamAssets.abbr(for: game.awayTeam).localizedCaseInsensitiveContains(lower)
                || CFBTeamAssets.abbr(for: game.homeTeam).localizedCaseInsensitiveContains(lower)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        selection = .allGames
                        dismiss()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "square.grid.2x2.fill")
                                .foregroundStyle(Color.appPrimary)
                            Text("All games (top 50 trends)")
                                .foregroundStyle(Color.appTextPrimary)
                            Spacer()
                            if case .allGames = selection {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Color.appPrimary)
                            }
                        }
                    }
                }

                Section("This week") {
                    ForEach(filteredGames) { game in
                        Button {
                            selection = .game(id: game.id)
                            dismiss()
                        } label: {
                            HStack(spacing: 10) {
                                GameCardTeamAvatar(
                                    teamName: game.awayTeam,
                                    sport: "cfb",
                                    size: 28,
                                    colors: CFBTeamColors.colorPair(for: game.awayTeam)
                                )
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(CFBTeamAssets.displayName(for: game.awayTeam))
                                        .font(.system(size: 13, weight: .semibold))
                                        .lineLimit(1)
                                }
                                Text("@")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(Color.appTextMuted)
                                GameCardTeamAvatar(
                                    teamName: game.homeTeam,
                                    sport: "cfb",
                                    size: 28,
                                    colors: CFBTeamColors.colorPair(for: game.homeTeam)
                                )
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(CFBTeamAssets.displayName(for: game.homeTeam))
                                        .font(.system(size: 13, weight: .semibold))
                                        .lineLimit(1)
                                }
                                Spacer()
                                if case .game(let id) = selection, id == game.id {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(Color.appPrimary)
                                }
                            }
                            .foregroundStyle(Color.appTextPrimary)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .searchable(text: $query, prompt: "Search teams")
            .navigationTitle("Select matchup")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Game filter options

private struct OutliersTrendsGameFilterOption: Identifiable, Hashable {
    let gameId: String?
    let awayAb: String
    let homeAb: String

    var id: String { gameId ?? "all" }
    var isAllGames: Bool { gameId == nil }

    var accessibilityLabel: String {
        guard let _ = gameId else { return "All games" }
        return "\(awayAb) at \(homeAb)"
    }

    var matchupFilter: OutliersTrendsMatchupFilter {
        if let gameId { return .game(id: gameId) }
        return .allGames
    }
}

#if DEBUG
#Preview {
    ScrollView {
        OutliersTrendsView(store: OutliersTrendsStore())
    }
    .background(Color.appSurface)
}
#endif
