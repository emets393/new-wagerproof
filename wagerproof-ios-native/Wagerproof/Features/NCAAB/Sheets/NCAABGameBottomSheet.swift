import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Full NCAAB game detail sheet. Mirrors RN
/// `components/NCAABGameBottomSheet.tsx`, rendered with the shared iOS-Weather
/// choreography (`CollapsingWidgetScroll`): a collapsing team-aura matchup hero
/// on top of Liquid Glass widget cards that pin → collapse under their header →
/// fade out → hand off to the next.
///
///   1. Matchup hero (team avatars + spread/ML/O-U → compact "AWAY @ HOME" bar,
///      with AP-ranking badges + Conf/Neutral context chips)
///   2. Polymarket market odds
///   3. Spread Prediction (Vegas vs Model fair spread, edge, tap-to-expand;
///      optional FadeAlertTooltip when `isFadeAlert == true`)
///   4. Over/Under Prediction (Vegas O/U vs Model total, edge, tap-to-expand;
///      optional FadeAlertTooltip when `isFadeAlert == true`)
///   5. Betting Trends Widget (situational ATS + O/U tables; data sourced
///      from `NCAABBettingTrendsStore.trends(for:)`)
///   6. Model Accuracy Widget (per-game accuracy lookup keyed off
///      `NCAABModelAccuracyStore.accuracy(forGameId:)`)
///   7. Team Stats (Adj Off/Def/Pace)
///   8. Match Simulator (model-predicted scores) — or Model Projections
///      summary when scores aren't predicted
///   9. Agent pick rationale (only when the audit store has a matching pick)
struct NCAABGameBottomSheet: View {
    @Environment(AchievementsStore.self) private var achievements
    let game: NCAABGame
    var onClose: () -> Void = {}
    /// When false (carousel mode), the page paints a transparent base instead of
    /// its own team aura — the carousel owns a single shared glow that doesn't
    /// swipe. The hero keeps an opaque masking background regardless.
    var showAura: Bool = true
    /// Carousel-only safe-area insets (see `MLBGameBottomSheet`).
    var heroTopInset: CGFloat = 0
    var contentBottomInset: CGFloat = 0

    // RN reads from a module-level cache populated by `useNCAABBettingTrends`
    // / `useNCAABModelAccuracy`. Swift has no such hook so we own the stores
    // locally — the alternative (app-level injection) would force every
    // mount of NCAAB to pay the fetch cost; mirroring NBA's pattern keeps
    // the cost paid per-sheet-open, on demand.
    @State private var trendsStore = NCAABBettingTrendsStore()
    @State private var accuracyStore = NCAABModelAccuracyStore()
    @State private var detailStore = NCAABGameDetailStore()
    /// Expanded trends surface (full 5-section matrix sheet).
    @State private var trendsDetail: NCAABGameTrendsData?

    @Environment(\.colorScheme) private var colorScheme

    @State private var spreadExpanded: Bool = false
    @State private var ouExpanded: Bool = false
    @State private var selectedSignal: NCAABSignalLine?
    @State private var trendLog: NCAABTrendOpen?

    private var awayColors: TeamColorPair { NCAABTeamColors.colorPair(for: game.awayTeam) }
    private var homeColors: TeamColorPair { NCAABTeamColors.colorPair(for: game.homeTeam) }

    var body: some View {
        CollapsingWidgetScroll(
            heroMaxHeight: 196,
            heroMinHeight: 80,
            transparentPage: !showAura,
            heroTopInset: heroTopInset,
            contentBottomInset: contentBottomInset,
            usesLiquidGlass: false
        ) { progress in
            // Standalone pages paint this aura themselves. In carousel mode the
            // shared fixed aura is the only rendered copy; the collapsing shell
            // masks scrolling content without adding a page-colored hero band.
            TeamAuraBackground(
                awayColor: awayColors.primary,
                homeColor: homeColors.primary,
                progress: progress
            )
        } hero: { progress in
            heroView(progress: progress)
        } content: {
            // Consensus, then the projected final, then odds and one market
            // card at a time. Team trends sit inside each market card.
            AgentConsensusSection(sport: .ncaab, gameId: GameConsensusKey.ncaab(game), gameDate: game.gameDate)
            marketOddsSection
            projectedScoreSection
            spreadAnalysis
            moneylineAnalysis
            ouAnalysis
            firstHalfSection
            teamTotalSection
            bettingTrendsSection
            modelAccuracySection
            teamStatsSection
            thrillSection
            modelProjectionsSection
            // Agent rationale scrolls away at the very bottom (no pin). The
            // widget gates itself on the audit store; when no pick is selected
            // (or its game_id doesn't match) it collapses to an empty view, so
            // unconditional placement is safe.
            AgentPickRationaleWidget(
                gameKeys: [
                    String(game.gameId),
                    game.trainingKey,
                    game.uniqueId
                ]
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
        }
        .background(showAura ? Color.appSurface : Color.clear)
        .toolbarBackground(.hidden, for: .navigationBar)
        .presentationDetents([.fraction(0.85), .large])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.disabled)
        .task { await achievements.record(.gameAnalysis) }
        .task(id: game.id) {
            // Reset transient sheet state when a new game opens.
            spreadExpanded = false
            ouExpanded = false
            selectedSignal = nil
            // Hydrate trends + accuracy for this sheet. Refresh is idempotent
            // and cheap when the cache is warm; running it on every open
            // mirrors RN's hook re-mount on game change.
            await trendsStore.refreshIfNeeded()
            await accuracyStore.refresh()
            await detailStore.load(
                gameId: game.gameId,
                gameDate: game.gameDate,
                home: game.homeTeam,
                away: game.awayTeam
            )
        }
        .sheet(item: $trendsDetail) { trends in
            BettingTrendsDetailSheet(
                awayName: trends.awayTeam.teamName,
                homeName: trends.homeTeam.teamName,
                timeDisplay: NCAABTrendsMatrixAdapter.timeDisplay(for: trends),
                stripeColors: NCAABTrendsMatrixAdapter.stripeColors(for: trends),
                accent: NCAABTrendsMatrixAdapter.accent,
                sections: NCAABTrendsMatrixAdapter.sections(for: trends),
                guide: .basketball,
                avatar: NCAABTrendsMatrixAdapter.avatarProvider(for: trends),
                onViewMatchup: nil   // already on the matchup page
            )
        }
        .sheet(item: $selectedSignal) { signal in
            signalDetail(signal)
        }
        .sheet(item: $trendLog) { selection in
            trendLogSheet(selection)
        }
    }

    private func signalDetail(_ signal: NCAABSignalLine) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text(signal.name).font(.system(size: 20, weight: .bold))
                    if !signal.side.isEmpty {
                        Text(signal.side).font(.system(size: 14, weight: .semibold))
                    }
                    if !signal.trigger.isEmpty {
                        Text(signal.trigger).font(.system(size: 14)).foregroundStyle(Color.appTextSecondary)
                    }
                    if !signal.play {
                        Text("Tracking read. Not a play.")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    recordBlock("Back-test", signal.record)
                    recordBlock("This season", signal.seasonRecord)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .navigationTitle("Signal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { selectedSignal = nil }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func recordBlock(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title.uppercased()).font(.system(size: 10, weight: .bold)).foregroundStyle(Color.appTextSecondary)
            Text(text.isEmpty ? "—" : text).font(.system(size: 13))
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    // MARK: - Collapsing hero

    /// Matchup hero rendered as ONE layout that continuously shrinks with scroll
    /// `progress` (0 = expanded, 1 = collapsed): avatars scale down, spacing
    /// tightens, team names + the centered spread/total fade, and each team's
    /// moneyline cross-fades in under its avatar — so the compact state is a
    /// smaller mirror of the large one. Mirrors `NFLGameBottomSheet.heroView`.
    @ViewBuilder
    private func heroView(progress p: CGFloat) -> some View {
        let logoSize = heroLerp(56, 30, p)
        let detail = Double(max(0, 1 - p * 1.9))
        let mlReveal = Double(min(1, max(0, (p - 0.35) / 0.4)))

        VStack(spacing: heroLerp(12, 0, p)) {
            topRow
                .opacity(detail)
                .frame(height: heroLerp(28, 0, min(1, p * 1.6)))
                .clipped()
            HStack(alignment: .center, spacing: heroLerp(14, 10, p)) {
                heroTeamColumn(team: game.awayTeam, abbr: game.awayTeamAbbrev, ranking: game.awayRanking,
                               colors: awayColors, size: logoSize, logoURL: game.awayTeamLogo,
                               nameOpacity: detail, ml: game.awayMl, mlReveal: mlReveal)
                heroLinesColumn(detail: detail, p: p)
                heroTeamColumn(team: game.homeTeam, abbr: game.homeTeamAbbrev, ranking: game.homeRanking,
                               colors: homeColors, size: logoSize, logoURL: game.homeTeamLogo,
                               nameOpacity: detail, ml: game.homeMl, mlReveal: mlReveal)
            }
        }
        .padding(.horizontal, heroLerp(16, 8, p))
        .padding(.top, heroLerp(8, 0, p))
        .frame(maxWidth: .infinity, alignment: .top)
    }

    private func heroLerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat {
        a + (b - a) * min(1, max(0, t))
    }

    @ViewBuilder
    private func heroTeamColumn(team: String, abbr: String?, ranking: Int?, colors: TeamColorPair, size: CGFloat, logoURL: String?, nameOpacity: Double, ml: Int?, mlReveal: Double) -> some View {
        let label = abbr?.trimmingCharacters(in: .whitespaces).nonEmpty ?? TeamInitials.from(team)
        let parts = TeamInitials.parts(of: team)
        VStack(spacing: 4) {
            ZStack(alignment: .topTrailing) {
                GameCardTeamAvatar(teamName: team, sport: "ncaab", size: size, colors: colors, logoURL: logoURL)
                // AP ranking badge — RN renders only when rank ≤ 25.
                if let ranking, ranking <= 25 {
                    Text("#\(ranking)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.appPrimary, in: RoundedRectangle(cornerRadius: 7))
                        .offset(x: 4, y: -4)
                }
            }
            Text(label)
                .font(.system(size: 16, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
            // Cross-fade the team name (large) → the team's moneyline (collapsed).
            ZStack {
                Text(parts.name.isEmpty ? parts.city : parts.name)
                    .font(.system(size: 10))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                    .opacity(nameOpacity)
                Text(GameCardFormatting.formatMoneyline(ml))
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.appTextPrimary)
                    .opacity(mlReveal)
            }
            .frame(height: 15)
        }
        .frame(width: 96)
    }

    /// Center lines column. ML lives here large and fades on collapse (it moves
    /// to each team); the Spread + O/U stay centered.
    @ViewBuilder
    private func heroLinesColumn(detail: Double, p: CGFloat) -> some View {
        VStack(spacing: heroLerp(6, 2, p)) {
            if detail > 0.04 {
                heroLineRow(label: "ML", value: "\(GameCardFormatting.formatMoneyline(game.awayMl)) / \(GameCardFormatting.formatMoneyline(game.homeMl))")
                    .opacity(detail)
            }
            heroLineRow(label: "Spread", value: "\(GameCardFormatting.formatSpread(game.awaySpread)) / \(GameCardFormatting.formatSpread(game.homeSpread))")
            if game.overLine != nil {
                heroLineRow(label: "O/U", value: GameCardFormatting.roundToNearestHalf(game.overLine))
            }
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var topRow: some View {
        HStack(spacing: 8) {
            Text(GameCardFormatting.formatCompactDate(game.gameDate))
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text(GameCardFormatting.convertTimeToEST(game.gameTime))
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .liquidGlassBackground(in: Capsule())
            if game.conferenceGame == true {
                contextChip(label: "Conf")
            }
            if game.neutralSite == true {
                contextChip(label: "Neutral")
            }
            if let tournament = detailStore.tournament {
                contextChip(label: tournament)
            }
            if let tv = detailStore.tv {
                contextChip(label: tv)
            }
            Spacer()
        }
    }

    @ViewBuilder
    private func heroLineRow(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
        }
    }

    @ViewBuilder
    private func contextChip(label: String) -> some View {
        Text(label)
            .font(.system(size: 9, weight: .semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.appPrimary.opacity(0.15), in: Capsule())
            .overlay(Capsule().stroke(Color.appPrimary.opacity(0.3), lineWidth: 1))
            .foregroundStyle(Color.appPrimary)
    }

    // MARK: - Spread / O-U sections

    /// Computed spread prediction. Mirrors RN's `spreadPrediction` useMemo:
    /// prefers `model_fair_home_spread` for edge math, falls back to
    /// `pred_home_margin`, then to the cover probability.
    private var spreadPrediction: SpreadPrediction? {
        if let line = detailStore.board?.fullGame.first(where: { $0.id == "spread" }),
           let margin = line.modelMargin,
           let hs = line.marketSpread ?? game.homeSpread {
            let fairHome = -margin
            let gap = line.disagreementPts ?? (margin + hs)
            let isHome = gap > 0
            return SpreadPrediction(
                edge: abs(fairHome - hs),
                predictedTeam: isHome ? game.homeTeam : game.awayTeam,
                predictedSpread: isHome ? fairHome : -fairHome,
                isHome: isHome,
                vegasSpread: isHome ? hs : (game.awaySpread ?? -hs),
                probability: nil,
                isFadeAlert: false
            )
        }
        if let mf = game.modelFairHomeSpread, let hs = game.homeSpread {
            let edge = abs(mf - hs)
            let isHomeEdge = mf < hs
            return SpreadPrediction(
                edge: edge,
                predictedTeam: isHomeEdge ? game.homeTeam : game.awayTeam,
                predictedSpread: isHomeEdge ? mf : -mf,
                isHome: isHomeEdge,
                vegasSpread: isHomeEdge ? game.homeSpread : game.awaySpread,
                probability: nil,
                isFadeAlert: false
            )
        }
        if let margin = game.predHomeMargin, let hs = game.homeSpread {
            // pred_home_margin → model_spread = -margin (positive margin = home wins)
            let modelSpread = -margin
            let edge = abs(modelSpread - hs)
            let isHomeEdge = modelSpread < hs
            return SpreadPrediction(
                edge: edge,
                predictedTeam: isHomeEdge ? game.homeTeam : game.awayTeam,
                predictedSpread: isHomeEdge ? modelSpread : -modelSpread,
                isHome: isHomeEdge,
                vegasSpread: isHomeEdge ? game.homeSpread : game.awaySpread,
                probability: nil,
                isFadeAlert: false
            )
        }
        if let prob = game.homeAwaySpreadCoverProb {
            let p = prob >= 0.5 ? prob : 1 - prob
            let isHome = prob >= 0.5
            return SpreadPrediction(
                edge: (p - 0.5) * 20,
                predictedTeam: isHome ? game.homeTeam : game.awayTeam,
                predictedSpread: isHome ? game.homeSpread : game.awaySpread,
                isHome: isHome,
                vegasSpread: isHome ? game.homeSpread : game.awaySpread,
                probability: p,
                isFadeAlert: false
            )
        }
        return nil
    }

    private var ouPrediction: OUPrediction? {
        if let line = detailStore.board?.fullGame.first(where: { $0.id == "total" }),
           let pred = line.modelTotal,
           let ol = game.overLine ?? line.marketTotal {
            // The posted total on the list can move after the model run.
            // Judge the lean against that live number, not the snapshot the
            // model stored, or the list and this card disagree.
            return OUPrediction(
                edge: abs(pred - ol),
                isOver: pred > ol,
                modelTotal: pred,
                line: ol,
                isFadeAlert: false
            )
        }
        if let pred = game.predTotalPoints, let ol = game.overLine {
            return OUPrediction(
                edge: abs(pred - ol),
                isOver: pred > ol,
                modelTotal: pred,
                line: ol,
                isFadeAlert: false
            )
        }
        if let prob = game.ouResultProb {
            let p = prob >= 0.5 ? prob : 1 - prob
            return OUPrediction(
                edge: (p - 0.5) * 20,
                isOver: prob >= 0.5,
                modelTotal: nil,
                line: game.overLine,
                isFadeAlert: false
            )
        }
        return nil
    }

    @ViewBuilder
    private var marketOddsSection: some View {
        WidgetCollapsingSection(title: "Public Betting", systemImage: "chart.bar.fill", iconTint: Color.appPrimary, headline: "Tickets and money") {
            GamePublicBettingCard(
                sport: "ncaab",
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                gameDate: game.gameDate,
                awayColor: awayColors.primary,
                homeColor: homeColors.primary
            )
        }
    }

    private var homeLabel: String { game.homeTeamAbbrev?.nonEmpty ?? game.homeTeam }
    private var awayLabel: String { game.awayTeamAbbrev?.nonEmpty ?? game.awayTeam }

    /// The cover bar and its headline, or nil when the model publishes neither a
    /// fair spread nor a predicted margin. The cover-probability fallback in
    /// `spreadPrediction` reuses the VEGAS number as `predictedSpread`, which
    /// would draw a bar with a dead-zero cushion — that branch keeps the boxes.
    private var spreadCover: SpreadCoverOutcome? {
        guard let prediction = spreadPrediction,
              prediction.probability == nil,
              let line = prediction.vegasSpread,
              let modelSpread = prediction.predictedSpread,
              line.isFinite, modelSpread.isFinite else { return nil }
        // `predictedSpread` is the pick team's fair SPREAD; the bar works in
        // margin, so it is negated exactly once, here.
        return SpreadCoverOutcome(line: line, modelMargin: -modelSpread)
    }

    @ViewBuilder
    private var spreadAnalysis: some View {
        if let prediction = spreadPrediction {
            let cover = spreadCover
            let pickLabel = prediction.isHome ? homeLabel : awayLabel
            WidgetCollapsingSection(
                title: "Spread Prediction",
                systemImage: "target",
                iconTint: Color.appPrimary,
                accessory: .tapHint(expanded: spreadExpanded),
                onHeaderTap: { spreadExpanded.toggle() },
                headline: cover?.headline(team: pickLabel)
                    ?? GameWidgetHeadlines.spread(
                        team: pickLabel,
                        modelSpread: prediction.predictedSpread,
                        marketSpread: prediction.vegasSpread,
                        edge: prediction.edge,
                        probability: prediction.probability
                    )
            ) {
                VStack(alignment: .leading, spacing: 12) {
                    if let cover {
                        SpreadCoverBar(
                            line: cover.line,
                            modelMargin: cover.modelMargin,
                            scale: .ncaab,
                            pickAbbrev: pickLabel,
                            opponentAbbrev: prediction.isHome ? awayLabel : homeLabel
                        )
                    } else {
                        HStack {
                            comparisonBox(
                                label: "Vegas",
                                value: GameCardFormatting.formatSpread(game.homeSpread),
                                color: Color.appTextPrimary
                            )
                            Image(systemName: "arrow.right")
                                .foregroundStyle(Color.appTextMuted)
                            comparisonBox(
                                label: "Our Model",
                                value: GameCardFormatting.formatSpread(prediction.predictedSpread),
                                color: Color.appPrimary,
                                isHighlight: true
                            )
                        }
                    }
                    HStack(spacing: 12) {
                        GameCardTeamAvatar(teamName: prediction.predictedTeam, sport: "ncaab", size: 40,
                                           colors: prediction.isHome ? homeColors : awayColors,
                                           logoURL: prediction.isHome ? game.homeTeamLogo : game.awayTeamLogo)
                        VStack(alignment: .leading, spacing: 4) {
                            let label = (prediction.isHome ? game.homeTeamAbbrev : game.awayTeamAbbrev)?
                                .trimmingCharacters(in: .whitespaces)
                                .nonEmpty ?? prediction.predictedTeam
                            Text("Edge to \(label)")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                            Text("\(String(format: "%.1f", prediction.edge)) pts delta")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(Color.appPrimary)
                        }
                    }
                    // Fade-alert UI mirrors RN exactly. RN currently hardcodes
                    // `isFadeAlert = false` so both blocks compile to nothing;
                    // keeping them wired keeps the surface ready when the
                    // backend exposes a fade threshold.
                    if prediction.isFadeAlert {
                        fadeAlertPill
                        FadeAlertTooltip(
                            betType: .spread,
                            suggestedBet: fadeSuggestionSpread(prediction)
                        )
                    }
                    if spreadExpanded {
                        explanation(text: spreadExplanation(prediction))
                    }
                    marketSignals(market: "spread", modelLikesHome: prediction.isHome)
                    teamTrendsFooter(marketId: "spread")
                }
            }
        }
    }

    @ViewBuilder
    private var ouAnalysis: some View {
        if let prediction = ouPrediction {
            let color: Color = prediction.isOver ? Color.appPrimary : Color.appAccentRed
            WidgetCollapsingSection(
                title: "Over/Under Prediction",
                systemImage: prediction.isOver ? "arrow.up.circle.fill" : "arrow.down.circle.fill",
                iconTint: color,
                accessory: .tapHint(expanded: ouExpanded),
                onHeaderTap: { ouExpanded.toggle() },
                headline: GameWidgetHeadlines.total(
                    direction: prediction.isOver ? "Over" : "Under",
                    modelTotal: prediction.modelTotal,
                    marketTotal: prediction.line
                )
            ) {
                VStack(alignment: .leading, spacing: 12) {
                    if let market = prediction.line, let model = prediction.modelTotal,
                       market.isFinite, model.isFinite {
                        ModelEdgeRail(market: market, model: model, scale: .ncaab)
                    } else {
                        HStack {
                            comparisonBox(
                                label: "Vegas O/U",
                                value: GameCardFormatting.roundToNearestHalf(prediction.line),
                                color: Color.appTextPrimary
                            )
                            Image(systemName: "arrow.right")
                                .foregroundStyle(Color.appTextMuted)
                            comparisonBox(
                                label: "Our Model",
                                value: GameCardFormatting.roundToNearestHalf(prediction.modelTotal),
                                color: color,
                                isHighlight: true
                            )
                        }
                    }
                    HStack(spacing: 12) {
                        Image(systemName: prediction.isOver ? "chevron.up" : "chevron.down")
                            .font(.system(size: 32, weight: .bold))
                            .foregroundStyle(color)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Edge to \(prediction.isOver ? "Over" : "Under")")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                            Text("\(String(format: "%.1f", prediction.edge)) pts delta")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(color)
                        }
                    }
                    if prediction.isFadeAlert {
                        fadeAlertPill
                        FadeAlertTooltip(
                            betType: .total,
                            suggestedBet: fadeSuggestionOU(prediction)
                        )
                    }
                    if ouExpanded {
                        explanation(text: ouExplanation(prediction))
                    }
                    marketSignals(market: "total", modelLikesOver: prediction.isOver)
                    teamTrendsFooter(marketId: "total")
                }
            }
        }
    }

    // MARK: - Moneyline

    /// Price-vs-model-probability for the side the model favors. `home_win_prob`
    /// is stored home-side, so the away read is its complement.
    private var moneylineOutcome: (outcome: MoneylineOutcome, abbrev: String, team: String)? {
        guard let homeProb = game.homeAwayMlProb, homeProb.isFinite, homeProb > 0, homeProb < 1 else { return nil }
        let isHome = homeProb >= 0.5
        let probability = isHome ? homeProb : 1 - homeProb
        guard let price = isHome ? game.homeMl : game.awayMl, abs(price) >= 100 else { return nil }
        return (
            MoneylineOutcome(price: price, modelProbability: probability, scale: .ncaab),
            isHome ? homeLabel : awayLabel,
            isHome ? game.homeTeam : game.awayTeam
        )
    }

    @ViewBuilder
    private var moneylineAnalysis: some View {
        if let resolved = moneylineOutcome {
            WidgetCollapsingSection(
                title: "Moneyline Prediction",
                systemImage: "dollarsign.circle.fill",
                iconTint: Color.appPrimary,
                headline: resolved.outcome.headline(team: resolved.team)
            ) {
                VStack(alignment: .leading, spacing: 12) {
                    // `ncaab_predictions.vegas_*_moneyline` are perfectly
                    // symmetric pairs (200/200 sampled rows had |home| == |away|),
                    // i.e. de-vigged fair prices you cannot actually bet. Calling
                    // that a break-even bar would state something false, so the
                    // chart reframes as model-vs-market disagreement.
                    MoneylineEdgeBar(
                        price: resolved.outcome.price,
                        modelProbability: resolved.outcome.modelProbability,
                        scale: .ncaab,
                        teamAbbrev: resolved.abbrev,
                        priceKind: .fairNoVig
                    )
                    HStack(spacing: 12) {
                        GameCardTeamAvatar(
                            teamName: resolved.team,
                            sport: "ncaab",
                            size: 40,
                            colors: resolved.team == game.homeTeam ? homeColors : awayColors,
                            logoURL: resolved.team == game.homeTeam ? game.homeTeamLogo : game.awayTeamLogo
                        )
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Edge to \(resolved.abbrev)")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                            Text("\(String(format: "%+.1f", resolved.outcome.edge)) pts of win rate")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(resolved.outcome.isPositiveValue ? Color.appPrimary : Color.appAccentRed)
                        }
                    }
                    marketSignals(market: "moneyline", modelLikesHome: resolved.team == game.homeTeam)
                    teamTrendsFooter(marketId: "moneyline")
                }
            }
        }
    }

    // MARK: - First half, team total, signals

    /// One "First half" card, matching the NBA sheet: spread on the cover bar,
    /// total on the rail. The total is never a bet.
    @ViewBuilder
    private var firstHalfSection: some View {
        let lines = detailStore.board?.firstHalf ?? []
        let spread = lines.first { $0.id == "h1_spread" }
        let total = lines.first { $0.id == "h1_total" }
        let hasSpread = spread?.modelMargin != nil && (spread?.marketSpread != nil)
        let hasTotal = total?.modelTotal != nil && (total?.marketTotal != nil)
        if hasSpread || hasTotal {
            WidgetCollapsingSection(title: "First half", systemImage: "timer", iconTint: Color.appPrimary) {
                VStack(alignment: .leading, spacing: 12) {
                    if let spread, let margin = spread.modelMargin, let hs = spread.marketSpread {
                        let gap = spread.disagreementPts ?? (margin + hs)
                        let isHome = gap > 0
                        let fairHome = -margin
                        let line = isHome ? hs : -hs
                        let modelSpread = isHome ? fairHome : -fairHome
                        Text("1H Spread")
                            .font(.system(size: 13, weight: .bold))
                        SpreadCoverBar(
                            line: line,
                            modelMargin: -modelSpread,
                            scale: .ncaab,
                            pickAbbrev: isHome ? homeLabel : awayLabel,
                            opponentAbbrev: isHome ? awayLabel : homeLabel
                        )
                        marketSignals(market: "h1_spread", modelLikesHome: isHome)
                        teamTrendsFooter(marketId: "h1_spread")
                    }
                    if let total, let model = total.modelTotal, let market = total.marketTotal {
                        Text("1H Total")
                            .font(.system(size: 13, weight: .bold))
                        ModelEdgeRail(market: market, model: model, scale: .ncaab)
                        Text("Tracking only. The first-half total is never a bet.")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.appTextSecondary)
                        marketSignals(market: "h1_total", modelLikesOver: model > market)
                        teamTrendsFooter(marketId: "h1_total")
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var teamTotalSection: some View {
        if detailStore.board?.markets.contains(where: { $0.id == "team_total" }) == true {
            WidgetCollapsingSection(title: "Team Total", systemImage: "trophy.fill", iconTint: Color.appPrimary) {
                marketSignals(market: "team_total")
                teamTrendsFooter(marketId: "team_total")
            }
        }
    }

    @ViewBuilder
    private func marketSignals(market: String, modelLikesHome: Bool? = nil, modelLikesOver: Bool? = nil) -> some View {
        let rows = (detailStore.board?.signals ?? []).filter {
            BasketballSignalMarket.canonical($0.market) == market
        }
        let ordered = BasketballSignalMarket.supportingFirst(rows) { signal in
            BasketballSignalMarket.contradicts(
                side: signal.side,
                market: market,
                modelLikesHome: modelLikesHome,
                modelLikesOver: modelLikesOver,
                homeName: game.homeTeam,
                awayName: game.awayTeam,
                homeAbbr: homeLabel,
                awayAbbr: awayLabel
            )
        }
        if !ordered.isEmpty {
            PickSignalsSection(
                signals: ordered.map { signal in
                    PickSignalPillModel(
                        id: signal.id,
                        title: signal.name,
                        contradicts: BasketballSignalMarket.contradicts(
                            side: signal.side,
                            market: market,
                            modelLikesHome: modelLikesHome,
                            modelLikesOver: modelLikesOver,
                            homeName: game.homeTeam,
                            awayName: game.awayTeam,
                            homeAbbr: homeLabel,
                            awayAbbr: awayLabel
                        ),
                        tint: Color.appPrimary
                    )
                },
                onSelect: { pill in
                    selectedSignal = ordered.first { $0.id == pill.id }
                }
            )
        }
    }

    @ViewBuilder
    private func teamTrendsFooter(marketId: String) -> some View {
        if let market = detailStore.board?.markets.first(where: { $0.id == marketId }) {
            VStack(alignment: .leading, spacing: 8) {
                Text("TEAM TRENDS")
                    .font(.system(size: 10, weight: .black))
                    .tracking(0.6)
                    .foregroundStyle(Color.appTextSecondary)
                HStack(alignment: .top, spacing: 8) {
                    trendCard(
                        team: game.awayTeam,
                        abbr: awayLabel,
                        logoURL: game.awayTeamLogo,
                        colors: awayColors,
                        record: market.awayRecord,
                        chips: market.awayChips,
                        games: detailStore.board?.awayTrend?.gameLog ?? [],
                        market: market
                    )
                    trendCard(
                        team: game.homeTeam,
                        abbr: homeLabel,
                        logoURL: game.homeTeamLogo,
                        colors: homeColors,
                        record: market.homeRecord,
                        chips: market.homeChips,
                        games: detailStore.board?.homeTrend?.gameLog ?? [],
                        market: market
                    )
                }
                Text(market.series)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
    }

    private func trendCard(
        team: String,
        abbr: String,
        logoURL: String?,
        colors: TeamColorPair,
        record: String,
        chips: [String],
        games: [NCAABGameLog],
        market: NCAABMarketLine
    ) -> some View {
        Button {
            trendLog = NCAABTrendOpen(
                team: team,
                abbr: abbr,
                logoURL: logoURL,
                colors: colors,
                marketId: market.id,
                label: market.label,
                games: games
            )
        } label: {
            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 6) {
                    GameCardTeamAvatar(teamName: team, sport: "ncaab", size: 20, colors: colors, logoURL: logoURL)
                    Text(abbr)
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                }
                Text(record)
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                HStack(spacing: 4) {
                    if chips.isEmpty {
                        Text("No L5")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(Color.appTextMuted)
                    } else {
                        Text("L\(min(chips.count, 5))")
                            .font(.system(size: 8, weight: .black))
                            .foregroundStyle(Color.appTextMuted)
                        ForEach(Array(chips.prefix(5).enumerated()), id: \.offset) { _, letter in
                            Text(letter.uppercased())
                                .font(.system(size: 8, weight: .black))
                                .foregroundStyle(Color.appSurface)
                                .frame(width: 17, height: 17)
                                .background(trendChipFill(letter), in: Circle())
                        }
                    }
                }
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.appSurface.opacity(0.42), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.appBorder.opacity(0.45), lineWidth: 0.7))
        }
        .buttonStyle(.plain)
    }

    private func trendChipFill(_ letter: String) -> Color {
        switch letter.uppercased() {
        case "W", "O": return Color(red: 0.13, green: 0.77, blue: 0.37)
        case "L", "U": return Color(red: 0.94, green: 0.27, blue: 0.27)
        default: return Color.appTextMuted
        }
    }

    private func trendLogSheet(_ selection: NCAABTrendOpen) -> some View {
        let rows = selection.games.filter { ($0.result(for: selection.marketId) ?? "").isEmpty == false }
        return NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 10) {
                        GameCardTeamAvatar(teamName: selection.team, sport: "ncaab", size: 34, colors: selection.colors, logoURL: selection.logoURL)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(selection.abbr) \(selection.label)")
                                .font(.system(size: 18, weight: .black))
                                .foregroundStyle(Color.appTextPrimary)
                            Text("Season game log, newest first")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Color.appTextMuted)
                        }
                    }
                    if rows.isEmpty {
                        Text("No games have been played this season yet.")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Color.appTextMuted)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 24)
                    } else {
                        VStack(spacing: 0) {
                            HStack {
                                Text("DATE").frame(width: 72, alignment: .leading)
                                Text("OPP").frame(maxWidth: .infinity, alignment: .leading)
                                Text("SCORE").frame(width: 64, alignment: .trailing)
                                Text("RESULT").frame(width: 52, alignment: .trailing)
                            }
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Color.appTextMuted)
                            .padding(.bottom, 6)
                            ForEach(Array(rows.enumerated()), id: \.offset) { _, gameLog in
                                HStack(alignment: .center) {
                                    Text(trendDate(gameLog.date))
                                        .frame(width: 72, alignment: .leading)
                                    Text(trendOpponent(gameLog))
                                        .lineLimit(1)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    Text(gameLog.scoreText)
                                        .frame(width: 64, alignment: .trailing)
                                    Text((gameLog.result(for: selection.marketId) ?? "—").uppercased())
                                        .foregroundStyle(trendChipFill(gameLog.result(for: selection.marketId) ?? ""))
                                        .frame(width: 52, alignment: .trailing)
                                }
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                                .padding(.vertical, 8)
                            }
                        }
                        .padding(10)
                        .background(Color.appSurfaceElevated.opacity(0.56), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                }
                .padding(16)
            }
            .background(Color.appSurface.ignoresSafeArea())
            .navigationTitle("Team Trend Detail")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func trendDate(_ raw: String?) -> String {
        guard let raw, raw.count >= 10 else { return raw ?? "—" }
        let parts = raw.prefix(10).split(separator: "-")
        guard parts.count == 3 else { return String(raw.prefix(10)) }
        return "\(parts[1])/\(parts[2])"
    }

    private func trendOpponent(_ gameLog: NCAABGameLog) -> String {
        let name = gameLog.opp?.isEmpty == false ? gameLog.opp! : "—"
        return gameLog.isHome == false ? "@ \(name)" : name
    }

    // MARK: - Betting trends + model accuracy

    /// Situational trends insight digest — reads the per-game payload from
    /// `NCAABBettingTrendsStore.trends(for:)`. Hidden when the gameId isn't in
    /// today's slate; first-hydrate skeleton only. Expanding presents the full
    /// matrix sheet.
    @ViewBuilder
    private var bettingTrendsSection: some View {
        if let trends = trendsStore.trends(for: game.gameId) {
            BettingTrendsInsightWidget(
                summary: NCAABTrendsInsight.summary(for: trends),
                awayAbbr: game.awayTeamAbbrev?.trimmingCharacters(in: .whitespaces).nonEmpty
                    ?? TeamInitials.from(game.awayTeam),
                homeAbbr: game.homeTeamAbbrev?.trimmingCharacters(in: .whitespaces).nonEmpty
                    ?? TeamInitials.from(game.homeTeam),
                accent: NCAABTrendsMatrixAdapter.accent,
                onExpand: { trendsDetail = trends }
            )
        } else if trendsStore.loadState == .loading, trendsStore.lastFetched == nil {
            WidgetCollapsingSection(title: "Betting Trends", systemImage: "chart.line.uptrend.xyaxis", iconTint: Color(hex: 0x8B5CF6)) {
                InsightWidgetSkeleton()
            }
        }
    }

    /// Model accuracy widget — reads from
    /// `NCAABModelAccuracyStore.accuracy(forGameId:)`. RN only renders the
    /// widget when the lookup finds a row, so we mirror that.
    @ViewBuilder
    private var modelAccuracySection: some View {
        if let accuracy = accuracyStore.accuracy(forGameId: game.gameId) {
            WidgetCollapsingSection(title: "Model Accuracy", systemImage: "scope", iconTint: Color(hex: 0x14B8A6), headline: GameWidgetHeadlines.modelAccuracy()) {
                ModelAccuracyWidget(
                    awayAbbr: game.awayTeamAbbrev?.trimmingCharacters(in: .whitespaces).nonEmpty
                        ?? TeamInitials.from(game.awayTeam),
                    homeAbbr: game.homeTeamAbbrev?.trimmingCharacters(in: .whitespaces).nonEmpty
                        ?? TeamInitials.from(game.homeTeam),
                    ncaab: accuracy
                )
            }
        }
    }

    // MARK: - Team stats

    @ViewBuilder
    private var teamStatsSection: some View {
        let ratings = detailStore.board?.ratings ?? []
        if !ratings.isEmpty || game.homeAdjOffense != nil || game.awayAdjOffense != nil {
            WidgetCollapsingSection(
                title: "Team Stats",
                systemImage: "chart.bar",
                iconTint: Color.appAccentBlue,
                headline: GameWidgetHeadlines.teamStats(
                    awayAbbr: game.awayTeamAbbrev?.nonEmpty ?? TeamInitials.from(game.awayTeam),
                    homeAbbr: game.homeTeamAbbrev?.nonEmpty ?? TeamInitials.from(game.homeTeam),
                    awayOffense: game.awayAdjOffense,
                    homeOffense: game.homeAdjOffense
                )
            ) {
                VStack(spacing: 8) {
                    statsHeader
                    if ratings.isEmpty {
                        statsRow(
                            label: "Adj. Offense",
                            away: game.awayAdjOffense.map { String(format: "%.1f", $0) } ?? "-",
                            home: game.homeAdjOffense.map { String(format: "%.1f", $0) } ?? "-",
                            better: nil
                        )
                        statsRow(
                            label: "Adj. Defense",
                            away: game.awayAdjDefense.map { String(format: "%.1f", $0) } ?? "-",
                            home: game.homeAdjDefense.map { String(format: "%.1f", $0) } ?? "-",
                            better: nil
                        )
                        statsRow(
                            label: "Adj. Pace",
                            away: game.awayAdjPace.map { String(format: "%.1f", $0) } ?? "-",
                            home: game.homeAdjPace.map { String(format: "%.1f", $0) } ?? "-",
                            better: nil
                        )
                    } else {
                        ForEach(Array(ratings.enumerated()), id: \.offset) { _, row in
                            statsRow(label: row.label, away: row.away, home: row.home, better: row.better)
                        }
                    }
                    if detailStore.board?.earlySeason == true {
                        Text("Season records start after opening night. Last five and head-to-head still use prior seasons. In-season rating fields stay blank until games are played.")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(12)
                .background(Color.appTextMuted.opacity(0.05), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    @ViewBuilder
    private var thrillSection: some View {
        if let board = detailStore.board {
            WidgetCollapsingSection(title: "Thrill score", systemImage: "sparkles", iconTint: Color.appAccentAmber) {
                if let score = board.thrillScore, !score.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(score)
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                        if !board.thrillDetail.isEmpty {
                            Text(board.thrillDetail)
                                .font(.system(size: 13))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                    }
                } else {
                    Text(board.thrillDetail.isEmpty ? "The watchability score posts the morning of the game." : board.thrillDetail)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
        }
    }

    @ViewBuilder
    private var statsHeader: some View {
        HStack {
            Color.clear.frame(width: 0).frame(maxWidth: .infinity, alignment: .leading)
            Text(game.awayTeamAbbrev?.trimmingCharacters(in: .whitespaces).nonEmpty ?? TeamInitials.from(game.awayTeam))
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .center)
            Text(game.homeTeamAbbrev?.trimmingCharacters(in: .whitespaces).nonEmpty ?? TeamInitials.from(game.homeTeam))
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .center)
        }
        .padding(.bottom, 4)
        .overlay(Rectangle().frame(height: 1).foregroundStyle(Color.appBorder), alignment: .bottom)
    }

    @ViewBuilder
    private func statsRow(label: String, away: String, home: String, better: String?) -> some View {
        let betterColor = Color(red: 0.02, green: 0.59, blue: 0.41)
        HStack {
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(away)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(better == "away" ? betterColor : Color.appTextPrimary)
                .frame(maxWidth: .infinity, alignment: .center)
            Text(home)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(better == "home" ? betterColor : Color.appTextPrimary)
                .frame(maxWidth: .infinity, alignment: .center)
        }
    }

    /// Open projected final, same widget the football sheets use. No tap to reveal.
    @ViewBuilder
    private var projectedScoreSection: some View {
        if let homeScore = game.homeScorePred, let awayScore = game.awayScorePred {
            WidgetCollapsingSection(
                title: "Score Prediction",
                systemImage: "sportscourt",
                iconTint: Color.appPrimary
            ) {
                ProjectedScoreRow(
                    away: ProjectedScoreRow.Side(
                        logoURL: game.awayTeamLogo,
                        abbr: game.awayTeamAbbrev?.nonEmpty ?? TeamInitials.from(game.awayTeam),
                        primary: awayColors.primary,
                        secondary: awayColors.secondary,
                        score: awayScore
                    ),
                    home: ProjectedScoreRow.Side(
                        logoURL: game.homeTeamLogo,
                        abbr: game.homeTeamAbbrev?.nonEmpty ?? TeamInitials.from(game.homeTeam),
                        primary: homeColors.primary,
                        secondary: homeColors.secondary,
                        score: homeScore
                    )
                )
            }
        }
    }

    /// RN renders a fallback "Model Projections" summary when there are no
    /// per-team predicted scores but the model still has margin + total.
    @ViewBuilder
    private var modelProjectionsSection: some View {
        if game.homeScorePred == nil, let margin = game.predHomeMargin, let total = game.predTotalPoints {
            WidgetCollapsingSection(
                title: "Model Projections",
                systemImage: "rectangle.grid.2x2.fill",
                iconTint: Color.appAccentPurple,
                headline: "Model projects \(margin > 0 ? game.homeTeam : game.awayTeam) by \(GameWidgetHeadlines.one(abs(margin))) with \(GameWidgetHeadlines.one(total)) total points."
            ) {
                VStack(spacing: 8) {
                    HStack {
                        Text("Predicted Margin")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text("\(margin > 0 ? game.homeTeam : game.awayTeam) by \(String(format: "%.1f", Swift.abs(margin)))")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.appAccentPurple)
                    }
                    HStack {
                        Text("Predicted Total")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text("\(String(format: "%.1f", total)) points")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.appAccentPurple)
                    }
                }
                .padding(12)
                .background(Color.appTextMuted.opacity(0.05), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    // MARK: - Wrappers / helpers

    @ViewBuilder
    private func comparisonBox(
        label: String,
        value: String,
        color: Color,
        isHighlight: Bool = false
    ) -> some View {
        VStack(spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(color.opacity(isHighlight ? 1 : 0.7))
            Text(value)
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .padding(.horizontal, 8)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(isHighlight ? color.opacity(0.1) : Color.appSurfaceMuted.opacity(0.5))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isHighlight ? color.opacity(0.25) : .clear, lineWidth: 1)
        )
    }

    /// Amber FADE ALERT pill — visually identical to the NBA sheet's pill so
    /// the cross-sport language stays consistent. Only rendered when a
    /// prediction's `isFadeAlert` is true (RN currently never trips this for
    /// NCAAB but the path is wired).
    @ViewBuilder
    private var fadeAlertPill: some View {
        HStack(spacing: 4) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 11))
            Text("FADE ALERT")
                .font(.system(size: 10, weight: .bold))
                .tracking(1)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.appAccentAmber.opacity(0.2), in: Capsule())
        .overlay(Capsule().stroke(Color.appAccentAmber.opacity(0.4), lineWidth: 1))
        .foregroundStyle(Color.appAccentAmber)
    }

    /// "Fade the spread" suggestion copy. Mirrors RN's
    /// `${oppositeTeam} ${oppositeSpread}` — fade the opposite team at the
    /// opposite spread.
    private func fadeSuggestionSpread(_ prediction: SpreadPrediction) -> String {
        let oppositeTeam = prediction.isHome ? game.awayTeam : game.homeTeam
        let oppositeSpread = prediction.isHome ? game.awaySpread : game.homeSpread
        return "\(oppositeTeam) \(GameCardFormatting.formatSpread(oppositeSpread))"
    }

    /// "Fade the total" suggestion copy. RN flips the direction (Over → Under
    /// and vice-versa) and pairs it with the rounded Vegas line.
    private func fadeSuggestionOU(_ prediction: OUPrediction) -> String {
        let oppositeDirection = prediction.isOver ? "Under" : "Over"
        let line = GameCardFormatting.roundToNearestHalf(prediction.line)
        return "\(oppositeDirection) \(line)"
    }

    @ViewBuilder
    private func explanation(text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "info.circle")
                Text("What This Means")
                    .font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(Color.appPrimary)
            Text(text)
                .font(.system(size: 13))
                .lineSpacing(4)
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(12)
        .background(Color.appPrimary.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.appPrimary.opacity(0.25), lineWidth: 1)
        )
    }

    private struct SpreadPrediction {
        let edge: Double
        let predictedTeam: String
        let predictedSpread: Double?
        let isHome: Bool
        let vegasSpread: Double?
        let probability: Double?
        /// RN hardcodes this to `false` today — the field is present so the
        /// fade-alert UI is wired and ready to flip on once the NCAAB
        /// backend exposes a fade threshold (mirrors RN parity exactly).
        let isFadeAlert: Bool
    }

    private struct OUPrediction {
        let edge: Double
        let isOver: Bool
        let modelTotal: Double?
        let line: Double?
        /// Same fade-alert plumbing as `SpreadPrediction` above.
        let isFadeAlert: Bool
    }

    /// Three-tier copy mirrors RN's `getSpreadExplanation`: low / mid / high edge.
    private func spreadExplanation(_ prediction: SpreadPrediction) -> String {
        let edge = String(format: "%.1f", prediction.edge)
        let team = prediction.predictedTeam
        let spread = GameCardFormatting.formatSpread(prediction.predictedSpread)
        if prediction.edge < 2 {
            return "Our model differs from Vegas by \(edge) points on \(team). This small edge indicates our projection is fairly close to the market's assessment. While the value is limited, our model still sees \(team) as slightly better positioned than the Vegas spread suggests."
        }
        if prediction.edge < 4 {
            return "Our model projects \(team) to cover \(spread) with a \(edge)-point edge over Vegas. This moderate discrepancy shows our analytics identify a meaningful difference in how we evaluate this matchup compared to the current market line."
        }
        return "Our model sees a significant \(edge)-point edge favoring \(team) to cover \(spread). This large discrepancy indicates our projections differ substantially from the Vegas line, suggesting strong value on this side of the spread."
    }

    private func ouExplanation(_ prediction: OUPrediction) -> String {
        let edge = String(format: "%.1f", prediction.edge)
        let direction = prediction.isOver ? "OVER" : "UNDER"
        let line = GameCardFormatting.roundToNearestHalf(prediction.line)
        let modelTotal = GameCardFormatting.roundToNearestHalf(prediction.modelTotal)
        if prediction.edge < 2 {
            return "Our model projects a total that's \(edge) points different from Vegas, favoring the \(direction.lowercased()). This small edge indicates our scoring projection is fairly aligned with the market, though we still see slight value on the \(direction.lowercased()) side."
        }
        if prediction.edge < 4 {
            return "Our model projects a \(modelTotal) total with a \(edge)-point edge favoring the \(direction.lowercased()). This moderate discrepancy shows our scoring projection doesn't align with the market, suggesting meaningful value on the \(direction.lowercased())."
        }
        return "Our model sees a significant \(edge)-point edge favoring the \(direction.lowercased()). This large difference between our \(modelTotal) projection and the Vegas \(line) line indicates the actual total is more likely to land on the \(direction.lowercased()) side than what the current market implies."
    }
}

struct NCAABTrendOpen: Identifiable {
    let team: String
    let abbr: String
    let logoURL: String?
    let colors: TeamColorPair
    let marketId: String
    let label: String
    let games: [NCAABGameLog]
    var id: String { "\(team)-\(marketId)" }
}

// Local helper — same shape as the one in NCAABGameCard.swift.
private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
