import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Matchup-specific trends hub. Filters live in a horizontal pill row (sport / subject / matchup);
/// each bet type renders as a section header over a horizontally-scrolling card carousel.
struct OutliersTrendsView: View {
    @Bindable var store: OutliersTrendsStore

    @State private var showMatchupPicker = false
    /// Tapped trend card → presented full in a bottom sheet (no longer grows the
    /// card vertically in the rail).
    @State private var selectedTrend: OutliersTrendSelection?

    private let cardWidth: CGFloat = 300

    var body: some View {
        // Pinned section header keeps the filter row stuck below the nav bar while the
        // trend sections scroll under it — so a user can drill down by re-filtering
        // mid-scroll without jumping back to the top.
        LazyVStack(alignment: .leading, spacing: 0, pinnedViews: [.sectionHeaders]) {
            Section {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, 4)
                    .padding(.bottom, Spacing.md)
            } header: {
                filterPills
            }
        }
        .onChange(of: store.sport) { _, _ in
            store.onSportChanged()
            Task { await store.refresh() }
        }
        .sheet(isPresented: $showMatchupPicker) {
            OutliersMatchupPickerSheet(
                sport: store.sport,
                games: store.games,
                selection: $store.matchupFilter
            )
        }
        .sheet(item: $selectedTrend) { selection in
            OutliersTrendDetailSheet(
                card: selection.card,
                sport: store.sport,
                game: selection.game
            )
        }
    }

    // MARK: - Filter pills

    /// Sticky filter row, pinned below the nav bar. Pills are floating Liquid
    /// Glass capsules (no opaque bar) so scrolling cards refract through them as
    /// they pass underneath — the iOS 26 floating-controls look.
    private var filterPills: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                sportPill
                if store.sport.hasTrendsData {
                    if store.sport.allowedSubjects.count > 1 {
                        subjectPill
                    }
                    matchupPill
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, 2)
        }
        .padding(.top, Spacing.md)
        .padding(.bottom, 10)
    }

    private var sportPill: some View {
        Menu {
            Picker("Sport", selection: $store.sport) {
                ForEach(OutliersTrendsSport.allCases) { sport in
                    Label(sport.label, systemImage: sportIcon(sport)).tag(sport)
                }
            }
        } label: {
            pillLabel(icon: sportIcon(store.sport), text: store.sport.label)
        }
    }

    private var subjectPill: some View {
        Menu {
            Picker("Subject", selection: $store.subject) {
                ForEach(store.sport.allowedSubjects) { subject in
                    Label(subject.label, systemImage: subjectIcon(subject)).tag(subject)
                }
            }
        } label: {
            pillLabel(icon: subjectIcon(store.subject), text: store.subject.label)
        }
    }

    /// Always opens the searchable picker sheet (every sport) — the sheet rows
    /// render the diagonal Liquid Glass team logos used across the app, which a
    /// native menu can't show. The pill itself mirrors that: the selected game's
    /// diagonal logo pair, or a grid glyph for "All games".
    private var matchupPill: some View {
        Button { showMatchupPicker = true } label: {
            matchupPillLabel
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var matchupPillLabel: some View {
        if case .game(let id) = store.matchupFilter,
           let game = store.games.first(where: { $0.id == id }) {
            pillContainer {
                OutliersDiagonalMatchupLogos(
                    sport: store.sport,
                    awayTeam: matchupLogoIdentifier(game, away: true),
                    homeTeam: matchupLogoIdentifier(game, away: false),
                    size: 21
                )
                Text(matchupPillText)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                pillChevron
            }
        } else {
            pillLabel(icon: "square.grid.2x2.fill", text: "All games")
        }
    }

    /// CFB logos resolve off the full team name; NFL/MLB off the abbreviation —
    /// matching how `OutliersTrendCard` and the Games row cards resolve them.
    private func matchupLogoIdentifier(_ game: OutliersTrendsGame, away: Bool) -> String {
        switch store.sport {
        case .ncaaf: return away ? game.awayTeam : game.homeTeam
        default: return away ? game.awayAb : game.homeAb
        }
    }

    private func pillLabel(icon: String, text: String) -> some View {
        pillContainer {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
            Text(text)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
            pillChevron
        }
    }

    /// Shared Liquid Glass capsule chrome for every filter pill (iOS 26 glass,
    /// `.ultraThinMaterial` fallback pre-26 via `liquidGlassBackground`).
    private func pillContainer<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        HStack(spacing: 6) { content() }
            .padding(.horizontal, 14)
            .frame(height: 36)
            .liquidGlassBackground(in: Capsule(), interactive: true)
            .overlay(Capsule().stroke(Color.appBorder.opacity(0.35), lineWidth: 1))
    }

    private var pillChevron: some View {
        Image(systemName: "chevron.down")
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(Color.appTextMuted)
    }

    private func sportIcon(_ sport: OutliersTrendsSport) -> String {
        switch sport {
        case .nfl, .ncaaf: return "football.fill"
        case .mlb: return "figure.baseball"
        case .nba, .ncaab: return "basketball.fill"
        }
    }

    private func subjectIcon(_ subject: OutliersTrendsSubject) -> String {
        switch subject {
        case .all: return "square.grid.2x2.fill"
        case .teams: return "shield.lefthalf.filled"
        case .coaches: return "person.fill"
        case .refs: return "flag.fill"
        case .players: return "figure.run"
        }
    }

    /// Abbreviated "AWAY @ HOME" shown beside the diagonal logos on the matchup pill.
    private var matchupPillText: String {
        switch store.matchupFilter {
        case .allGames:
            return "All games"
        case .game(let id):
            guard let game = store.games.first(where: { $0.id == id }) else { return "All games" }
            let away = store.sport == .ncaaf ? CFBTeamAssets.abbr(for: game.awayTeam) : game.awayAb
            let home = store.sport == .ncaaf ? CFBTeamAssets.abbr(for: game.homeTeam) : game.homeAb
            return "\(away) @ \(home)"
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
            loadedContent(store.marketSections)
        }
    }

    @ViewBuilder
    private func loadedContent(_ sections: [OutliersTrendsMarketSection]) -> some View {
        if store.isLoadingTrends && sections.isEmpty {
            loadingState
        } else if let message = store.lastError, sections.isEmpty {
            errorState(message)
        } else if sections.isEmpty {
            emptyState
        } else {
            VStack(alignment: .leading, spacing: 16) {
                sectionsList(sections)
                if store.isLoadingTrends {
                    updatingIndicator
                }
            }
        }
    }

    private var gamesById: [String: OutliersTrendsGame] {
        Dictionary(uniqueKeysWithValues: store.games.map { ($0.id, $0) })
    }

    private func sectionsList(_ sections: [OutliersTrendsMarketSection]) -> some View {
        LazyVStack(alignment: .leading, spacing: 22) {
            ForEach(sections) { section in
                VStack(alignment: .leading, spacing: 10) {
                    sectionHeader(section)
                    carousel(section)
                }
            }
        }
    }

    private func sectionHeader(_ section: OutliersTrendsMarketSection) -> some View {
        HStack(spacing: 8) {
            Image(systemName: marketIcon(section.marketKey))
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.appPrimary)
                .frame(width: 22)
            Text(section.title)
                .font(.system(size: 17, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
            Spacer(minLength: 0)
        }
    }

    /// SF Symbol per bet-type, shared across the game/run-line/total + player-prop markets.
    private func marketIcon(_ marketKey: String) -> String {
        switch marketKey {
        case "spread", "rl", "f5_rl": return "arrow.left.and.right"
        case "moneyline", "ml", "f5_ml": return "dollarsign.circle.fill"
        case "total", "ou", "f5_ou": return "sum"
        case "team_total": return "person.2.fill"
        case "h1_spread": return "clock.arrow.trianglehead.counterclockwise.rotate.90"
        case "h1_total": return "clock.badge.checkmark"
        case "player_anytime_td": return "figure.run.circle.fill"
        case "player_rush_yds": return "figure.run"
        case "player_reception_yds": return "arrow.down.right.circle.fill"
        case "player_receptions": return "hand.raised.fill"
        case "player_pass_yds": return "paperplane.fill"
        case "player_pass_tds": return "trophy.fill"
        default: return "chart.line.uptrend.xyaxis"
        }
    }

    /// Bleeds past the page padding so cards scroll edge-to-edge while headers stay inset.
    private func carousel(_ section: OutliersTrendsMarketSection) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(alignment: .top, spacing: 12) {
                ForEach(section.cards) { card in
                    Button {
                        selectedTrend = OutliersTrendSelection(card: card, game: gamesById[card.gameId])
                    } label: {
                        OutliersTrendCard(card: card, sport: store.sport, game: gamesById[card.gameId])
                            .frame(width: cardWidth)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, 2)
        }
        .padding(.horizontal, -Spacing.lg)
    }

    private var updatingIndicator: some View {
        HStack(spacing: 8) {
            ProgressView().controlSize(.small)
            Text("Updating trends…")
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
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
            Text("Try a different matchup or subject — or check back when the slate fills in.")
                .font(.system(size: 13))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }
}

// MARK: - Trend detail selection

/// Identifies the trend card a user tapped so it can be presented in the detail
/// bottom sheet. Keyed off the card id (stable within a slate refresh).
struct OutliersTrendSelection: Identifiable {
    let card: OutliersTrendsCard
    let game: OutliersTrendsGame?

    var id: String { card.id }
}

// MARK: - Matchup picker

/// Searchable matchup picker used by EVERY sport's matchup filter pill. Rows
/// render the diagonal Liquid Glass team logos used across the app — which a
/// native `Menu`/`Picker` can't show — so all sports route through this sheet,
/// not just NCAAF.
private struct OutliersMatchupPickerSheet: View {
    let sport: OutliersTrendsSport
    let games: [OutliersTrendsGame]
    @Binding var selection: OutliersTrendsMatchupFilter
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""

    private var filteredGames: [OutliersTrendsGame] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return games }
        return games.filter { game in
            [game.awayTeam, game.homeTeam, game.awayAb, game.homeAb]
                .contains { $0.localizedCaseInsensitiveContains(trimmed) }
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
                            Text("All games")
                                .foregroundStyle(Color.appTextPrimary)
                            Spacer()
                            if case .allGames = selection {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Color.appPrimary)
                            }
                        }
                    }
                }

                // MLB is capped to today's slate; the others list the week.
                Section(sport == .mlb ? "Today" : "This week") {
                    ForEach(filteredGames) { game in
                        Button {
                            selection = .game(id: game.id)
                            dismiss()
                        } label: {
                            HStack(spacing: 10) {
                                OutliersMatchupPickerRow(sport: sport, game: game)
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

// MARK: - Matchup picker row

private struct OutliersMatchupPickerRow: View {
    let sport: OutliersTrendsSport
    let game: OutliersTrendsGame

    var body: some View {
        HStack(spacing: 12) {
            OutliersDiagonalMatchupLogos(
                sport: sport,
                awayTeam: logoIdentifier(away: true),
                homeTeam: logoIdentifier(away: false),
                size: 30
            )
            VStack(alignment: .leading, spacing: 1) {
                Text(teamName(away: true))
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                Text("@ \(teamName(away: false))")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            Spacer(minLength: 0)
        }
    }

    private func logoIdentifier(away: Bool) -> String {
        switch sport {
        case .ncaaf: return away ? game.awayTeam : game.homeTeam
        default: return away ? game.awayAb : game.homeAb
        }
    }

    private func teamName(away: Bool) -> String {
        let full = away ? game.awayTeam : game.homeTeam
        switch sport {
        case .ncaaf: return CFBTeamAssets.displayName(for: full)
        case .mlb: return MLBTeams.nickname(for: full)
        default: return NFLTeamAssets.nickname(for: full)
        }
    }
}

// MARK: - Diagonal Liquid Glass matchup logos

/// Two team logos on a diagonal (away upper-left, home lower-right) that
/// liquid-merge into one glass blob on iOS 26 — the matchup motif from the
/// Games row cards (`GameRowCard.diagonalLogos`), reused for the Outliers
/// matchup filter pill and picker rows.
private struct OutliersDiagonalMatchupLogos: View {
    let sport: OutliersTrendsSport
    let awayTeam: String
    let homeTeam: String
    var size: CGFloat = 24

    var body: some View {
        let off = size * 0.48
        LiquidGlassMergeContainer(spacing: 14) {
            ZStack {
                OutliersGlassTeamAvatar(sport: sport, team: awayTeam, size: size)
                    .offset(x: -off / 2, y: -off / 2)
                    .zIndex(0)
                OutliersGlassTeamAvatar(sport: sport, team: homeTeam, size: size)
                    .offset(x: off / 2, y: off / 2)
                    .zIndex(1)
            }
        }
        .frame(width: size + off, height: size + off)
    }
}

/// A single Liquid Glass team disc (logo, initials fallback) tinted with the
/// team color via the shared `teamGlassDisc` treatment — the same one the
/// Games row-card avatars use. Resolves logo + colors per sport the way
/// `OutliersTrendCard` does (CFB off full name, NFL/MLB off abbreviation).
private struct OutliersGlassTeamAvatar: View {
    let sport: OutliersTrendsSport
    let team: String
    var size: CGFloat = 28

    var body: some View {
        let pair = colors
        ZStack {
            if let logo = logoURL, let url = URL(string: logo) {
                AsyncImage(url: url) { phase in
                    if case .success(let img) = phase {
                        img.resizable().scaledToFit().padding(size * 0.16)
                    } else {
                        initials
                    }
                }
            } else {
                initials
            }
        }
        .frame(width: size, height: size)
        .teamGlassDisc(primary: pair.primary, secondary: pair.secondary, tint: 0.5)
        .shadow(color: pair.primary.opacity(0.22), radius: 4, x: 0, y: 1)
    }

    private var initials: some View {
        Text(TeamInitials.from(team))
            .font(.system(size: size * 0.34, weight: .bold))
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.25), radius: 1, x: 0, y: 1)
    }

    private var colors: TeamColorPair {
        switch sport {
        case .ncaaf: return CFBTeamColors.colorPair(for: team)
        case .mlb: return MLBTeamColors.colorPair(for: team)
        default: return NFLTeamColors.colorPair(for: team)
        }
    }

    private var logoURL: String? {
        switch sport {
        case .ncaaf: return CFBTeamAssets.logo(for: team)
        case .mlb: return MLBTeams.logoUrl(for: team)
        default: return NFLTeamAssets.logo(for: team)
        }
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
