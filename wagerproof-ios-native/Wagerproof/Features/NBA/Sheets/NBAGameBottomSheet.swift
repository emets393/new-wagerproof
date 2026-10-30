import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Full NBA game detail sheet. Mirrors RN
/// `components/NBAGameBottomSheet.tsx`. Vertical scroll of stacked sections:
///
///   1. AgentPickRationaleWidget (renders only when audit store has a matching pick)
///   2. WagerBot insight pill
///   3. Header card (gradient stripe + date/time + matchup + line pills)
///   4. Polymarket market odds
///   5. Spread Analysis (Vegas vs Model fair spread, edge)
///   6. Over/Under Analysis (Vegas vs Model fair total, edge)
///   7. Injury Report (pro feature)
///   8. Recent Trends (pro feature)
///   9. Betting Trends (situational ATS + O/U tables, gated on per-game store lookup)
///  10. Model Accuracy (spread/ML/OU pick vs historical accuracy bucket)
///  11. Team Stats (Adj Off/Def/Pace, ATS%, Over%)
///  12. Match Simulator (model-predicted scores)
struct NBAGameBottomSheet: View {
    @Environment(AchievementsStore.self) private var achievements
    @Environment(GamesStore.self) private var gamesStore
    let game: NBAGame
    var onClose: () -> Void = {}
    /// When false (carousel mode), the page paints a transparent base instead of
    /// its own team aura — the carousel owns a single shared glow that doesn't
    /// swipe. The hero keeps an opaque masking background regardless.
    var showAura: Bool = true
    /// Carousel-only safe-area insets (see `MLBGameBottomSheet`).
    var heroTopInset: CGFloat = 0
    var contentBottomInset: CGFloat = 0

    @Environment(\.colorScheme) private var colorScheme

    @State private var matchupStore = NBAMatchupOverviewStore()
    // Per-game store lookups: RN's `useNBABettingTrendsForGame` and
    // `useNBAModelAccuracyForGame` resolve through module-level promise caches.
    // Mirror that by instantiating one store per sheet and reusing its
    // `trends(for:)` / `accuracy(for:)` lookup after `refresh()`.
    @State private var trendsStore = NBABettingTrendsStore()
    /// Expanded trends surface (full 5-section matrix sheet).
    @State private var trendsDetail: NBAGameTrendsData?
    @State private var spreadExpanded: Bool = false
    @State private var ouExpanded: Bool = false
    @State private var injuryExpanded: Bool = false
    @State private var trendsExpanded: Bool = false

    private var awayColors: TeamColorPair { NBATeams.colorPair(for: game.awayTeam) }
    private var homeColors: TeamColorPair { NBATeams.colorPair(for: game.homeTeam) }

    var body: some View {
        // Weather-style: collapsing matchup hero on top, widget cards that pin →
        // collapse under their header → fade out → hand off to the next.
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
            // FIRST, above every per-sport section — the crowd's read on the
            // game frames everything below it, and the widget is sport-agnostic
            // (same placement as web's detail grid).
            AgentConsensusSection(sport: .nba, gameId: GameConsensusKey.nba(game), gameDate: game.gameDate)
            marketOddsSection
            scorePredictionSection
            spreadAnalysis
            moneylineAnalysis
            ouAnalysis
            NbaFirstHalfSection(
                markets: gamesStore.nbaFirstHalf(gameId: game.gameId, date: game.gameDate, home: game.homeAbbr, away: game.awayAbbr),
                signals: slateSignals,
                homeName: game.homeTeam,
                awayName: game.awayTeam
            )
            injurySection
            recentTrendsSection
            bettingTrendsSection
            teamStatsSection
            // Agent pick rationale renders ONLY when the audit store has a
            // pick whose gameId matches one of these keys. RN passes the
            // same three identifiers — game_id (int → string), training_key,
            // unique_id — so a pick generated against any of those keys
            // resolves to this sheet. Scrolls away at the very bottom (no pin).
            AgentPickRationaleWidget(
                gameKeys: [String(game.gameId), game.trainingKey, game.uniqueId]
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
        }
        .background(showAura ? Color.appSurface : Color.clear)
        // Transparent nav bar so the team aura glows continuously behind the
        // back button; the opaque collapsing hero masks content scrolling under it.
        .toolbarBackground(.hidden, for: .navigationBar)
        .presentationDetents([.fraction(0.85), .large])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.disabled)
        .task { await achievements.record(.gameAnalysis) }
        .task(id: game.id) {
            // Reset transient sheet state when a new game opens.
            spreadExpanded = false
            ouExpanded = false
            injuryExpanded = false
            trendsExpanded = false
            matchupStore.reset()
            // Three independent fetches in parallel — matches RN's hook-level
            // module caches that each fire-and-forget once per app session.
            // `refresh()` is idempotent (the stores no-op when already loaded).
            async let matchup: Void = matchupStore.load(
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                gameDate: game.gameDate
            )
            async let trends: Void = trendsStore.refreshIfNeeded()
            _ = await (matchup, trends)
        }
        .sheet(item: $trendsDetail) { trends in
            BettingTrendsDetailSheet(
                awayName: trends.awayTeam.teamName,
                homeName: trends.homeTeam.teamName,
                timeDisplay: NBATrendsMatrixAdapter.timeDisplay(for: trends),
                stripeColors: NBATrendsMatrixAdapter.stripeColors(for: trends),
                accent: NBATrendsMatrixAdapter.accent,
                sections: NBATrendsMatrixAdapter.sections(for: trends),
                guide: .basketball,
                avatar: NBATrendsMatrixAdapter.avatarProvider(for: trends),
                onViewMatchup: nil   // already on the matchup page
            )
        }
    }

    // MARK: - Collapsing widget sections

    @ViewBuilder
    private var marketOddsSection: some View {
        WidgetCollapsingSection(title: "Public Betting", systemImage: "chart.bar.fill", iconTint: Color.appPrimary, headline: "Tickets and money") {
            GamePublicBettingCard(
                sport: "nba",
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                gameDate: game.gameDate,
                awayColor: awayColors.primary,
                homeColor: homeColors.primary
            )
        }
    }

    @ViewBuilder
    private var scorePredictionSection: some View {
        if let homeScore = game.homeScorePred, let awayScore = game.awayScorePred {
            WidgetCollapsingSection(title: "Score Prediction", systemImage: "sportscourt", iconTint: Color.appPrimary) {
                ProjectedScoreRow(
                    away: ProjectedScoreRow.Side(
                        logoURL: NBATeams.logoURL(for: game.awayTeam),
                        abbr: NBATeams.abbreviation(for: game.awayTeam),
                        primary: awayColors.primary,
                        secondary: awayColors.secondary,
                        score: awayScore
                    ),
                    home: ProjectedScoreRow.Side(
                        logoURL: NBATeams.logoURL(for: game.homeTeam),
                        abbr: NBATeams.abbreviation(for: game.homeTeam),
                        primary: homeColors.primary,
                        secondary: homeColors.secondary,
                        score: homeScore
                    )
                )
            }
        }
    }

    /// Injury report — Pro-gated. Collapse toggle lives in the pinned header.
    @ViewBuilder
    private var injurySection: some View {
        WidgetCollapsingSection(
            title: "Injury Report",
            systemImage: "bandage",
            iconTint: Color.appAccentRed,
            accessory: .chevron(expanded: injuryExpanded),
            onHeaderTap: { injuryExpanded.toggle() },
            headline: GameWidgetHeadlines.injuries(
                awayAbbr: game.awayAbbr,
                homeAbbr: game.homeAbbr,
                awayImpact: matchupStore.awayInjuryImpact,
                homeImpact: matchupStore.homeInjuryImpact,
                count: matchupStore.awayInjuries.count + matchupStore.homeInjuries.count
            )
        ) {
            ProContentSection(title: "Injury Report", minHeight: 60) {
                NBAInjuryReportWidget(
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    awayInjuries: matchupStore.awayInjuries,
                    homeInjuries: matchupStore.homeInjuries,
                    awayInjuryImpact: matchupStore.awayInjuryImpact,
                    homeInjuryImpact: matchupStore.homeInjuryImpact,
                    isLoading: matchupStore.injuriesState == .loading,
                    errorMessage: {
                        if case .failed(let msg) = matchupStore.injuriesState { return msg }
                        return nil
                    }(),
                    expanded: $injuryExpanded
                )
            }
        }
    }

    /// Recent trends — Pro-gated. Collapse toggle lives in the pinned header.
    @ViewBuilder
    private var recentTrendsSection: some View {
        WidgetCollapsingSection(
            title: "Recent Trends",
            systemImage: "chart.line.uptrend.xyaxis",
            iconTint: Color.appAccentBlue,
            accessory: .chevron(expanded: trendsExpanded),
            onHeaderTap: { trendsExpanded.toggle() },
            headline: GameWidgetHeadlines.recentTrends(
                awayAbbr: game.awayAbbr,
                homeAbbr: game.homeAbbr,
                trends: matchupStore.trends
            )
        ) {
            ProContentSection(title: "Recent Trends", minHeight: 60) {
                NBARecentTrendsWidget(
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    trends: matchupStore.trends,
                    isLoading: matchupStore.trendsState == .loading,
                    expanded: $trendsExpanded
                )
            }
        }
    }

    /// Situational trends insight digest (verdict + top 3 ranked ATS / O-U
    /// signals). Hidden when the gameId isn't in today's trends slate;
    /// first-hydrate skeleton only. Expanding presents the full matrix sheet.
    @ViewBuilder
    private var bettingTrendsSection: some View {
        if let trends = trendsStore.trends(for: game.gameId) {
            BettingTrendsInsightWidget(
                summary: NBATrendsInsight.summary(for: trends),
                awayAbbr: game.awayAbbr,
                homeAbbr: game.homeAbbr,
                accent: NBATrendsMatrixAdapter.accent,
                onExpand: { trendsDetail = trends }
            )
        } else if trendsStore.loadState == .loading, trendsStore.lastFetched == nil {
            WidgetCollapsingSection(title: "Betting Trends", systemImage: "chart.line.uptrend.xyaxis", iconTint: Color(hex: 0x8B5CF6)) {
                InsightWidgetSkeleton()
            }
        }
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
                heroTeamColumn(team: game.awayTeam, colors: awayColors, size: logoSize,
                               nameOpacity: detail, ml: game.awayMl, mlReveal: mlReveal)
                heroLinesColumn(detail: detail, p: p)
                heroTeamColumn(team: game.homeTeam, colors: homeColors, size: logoSize,
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
    private func heroTeamColumn(team: String, colors: TeamColorPair, size: CGFloat, nameOpacity: Double, ml: Int?, mlReveal: Double) -> some View {
        let abbr = NBATeams.abbreviation(for: team)
        let parts = TeamInitials.parts(of: team)
        VStack(spacing: 4) {
            GameCardTeamAvatar(teamName: team, sport: "nba", size: size, colors: colors)
            Text(abbr)
                .font(.system(size: 16, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
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
            heroLineRow(label: "O/U", value: GameCardFormatting.roundToNearestHalf(game.overLine))
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

    // MARK: - Spread / O-U sections

    /// Computed spread prediction. Mirrors RN's `spreadPrediction` useMemo:
    /// prefers `model_fair_home_spread` for edge math, falls back to the
    /// derived probability when fair spread is missing.
    private var spreadPrediction: SpreadPrediction? {
        if let mf = game.modelFairHomeSpread, let hs = game.homeSpread {
            let edge = abs(mf - hs)
            let isHomeEdge = mf < hs
            let predictedTeam = isHomeEdge ? game.homeTeam : game.awayTeam
            let predictedSpread = isHomeEdge ? mf : -mf
            let vegasSpread = isHomeEdge ? game.homeSpread : game.awaySpread
            return SpreadPrediction(
                edge: edge,
                predictedTeam: predictedTeam,
                predictedSpread: predictedSpread,
                isHome: isHomeEdge,
                vegasSpread: vegasSpread,
                probability: nil
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
                probability: p
            )
        }
        return nil
    }

    private var ouPrediction: OUPrediction? {
        if let mf = game.modelFairTotal, let ol = game.overLine {
            return OUPrediction(
                edge: abs(mf - ol),
                isOver: mf > ol,
                modelTotal: mf,
                line: ol
            )
        }
        if let prob = game.ouResultProb {
            let p = prob >= 0.5 ? prob : 1 - prob
            return OUPrediction(
                edge: (p - 0.5) * 20,
                isOver: prob >= 0.5,
                modelTotal: nil,
                line: game.overLine
            )
        }
        return nil
    }

    /// The cover bar and its headline, or nil when the model has no fair spread
    /// for this game. The probability-only fallback in `spreadPrediction`
    /// reuses the VEGAS number as `predictedSpread`, which would draw a bar with
    /// a dead-zero cushion — so that branch deliberately keeps the metric boxes.
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
            WidgetCollapsingSection(
                title: "Spread Prediction",
                systemImage: "target",
                iconTint: Color.appPrimary,
                accessory: .tapHint(expanded: spreadExpanded),
                onHeaderTap: { spreadExpanded.toggle() },
                headline: cover?.headline(team: prediction.isHome ? game.homeAbbr : game.awayAbbr)
                    ?? GameWidgetHeadlines.spread(
                        team: prediction.isHome ? game.homeAbbr : game.awayAbbr,
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
                            scale: .nba,
                            pickAbbrev: prediction.isHome ? game.homeAbbr : game.awayAbbr,
                            opponentAbbrev: prediction.isHome ? game.awayAbbr : game.homeAbbr
                        )
                    } else {
                        HStack {
                            comparisonBox(label: "Vegas", value: GameCardFormatting.formatSpread(game.homeSpread), color: Color.appTextPrimary)
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
                        GameCardTeamAvatar(teamName: prediction.predictedTeam, sport: "nba", size: 40)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Edge to \(prediction.predictedTeam)")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                            Text("\(String(format: "%.1f", prediction.edge)) pts delta")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(Color.appPrimary)
                        }
                    }
                    if spreadExpanded {
                        explanation(text: spreadExplanation(prediction))
                    }
                    attachedSignals(market: "spread", modelLikesHome: prediction.isHome)
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
                        ModelEdgeRail(market: market, model: model, scale: .nba)
                    } else {
                        HStack {
                            comparisonBox(label: "Vegas O/U", value: GameCardFormatting.roundToNearestHalf(prediction.line), color: Color.appTextPrimary)
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
                    if game.totalTier == "warmup" {
                        Text("Tracking only while the total model warms up. This number is not a bet.")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    if ouExpanded {
                        explanation(text: ouExplanation(prediction))
                    }
                    attachedSignals(market: "total", modelLikesOver: prediction.isOver)
                }
            }
        }
    }

    // MARK: - Moneyline

    /// Price-vs-model-probability for the side the model favors. `home_win_prob`
    /// is stored home-side, so the away read is its complement and the away
    /// price comes from the same row (derived from the home price when the book
    /// only posts one — see `GamesStore.calculateAwayML`).
    private var moneylineOutcome: (outcome: MoneylineOutcome, abbrev: String, team: String)? {
        guard let homeProb = game.homeAwayMlProb, homeProb.isFinite, homeProb > 0, homeProb < 1 else { return nil }
        let isHome = homeProb >= 0.5
        let probability = isHome ? homeProb : 1 - homeProb
        guard let price = isHome ? game.homeMl : game.awayMl, abs(price) >= 100 else { return nil }
        return (
            MoneylineOutcome(price: price, modelProbability: probability, scale: .nba),
            isHome ? game.homeAbbr : game.awayAbbr,
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
                    MoneylineEdgeBar(
                        price: resolved.outcome.price,
                        modelProbability: resolved.outcome.modelProbability,
                        scale: .nba,
                        teamAbbrev: resolved.abbrev
                    )
                    HStack(spacing: 12) {
                        GameCardTeamAvatar(teamName: resolved.team, sport: "nba", size: 40)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Edge to \(resolved.abbrev)")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                            Text("\(String(format: "%+.1f", resolved.outcome.edge)) pts of win rate")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(resolved.outcome.isPositiveValue ? Color.appPrimary : Color.appAccentRed)
                        }
                    }
                    attachedSignals(
                        market: "moneyline",
                        modelLikesHome: resolved.team == game.homeTeam
                    )
                }
            }
        }
    }

    private var slateSignals: [NBASlateSignal] {
        gamesStore.nbaSignals(gameId: game.gameId, date: game.gameDate, home: game.homeAbbr, away: game.awayAbbr)
    }

    @ViewBuilder
    private func attachedSignals(market: String, modelLikesHome: Bool? = nil, modelLikesOver: Bool? = nil) -> some View {
        NbaAttachedSignals(
            signals: slateSignals.filter { $0.market == market },
            market: market,
            modelLikesHome: modelLikesHome,
            modelLikesOver: modelLikesOver,
            homeName: game.homeTeam,
            awayName: game.awayTeam,
            homeAbbr: game.homeAbbr,
            awayAbbr: game.awayAbbr
        )
    }

    // MARK: - Team stats

    @ViewBuilder
    private var teamStatsSection: some View {
        if game.homeAdjOffense != nil || game.awayAdjOffense != nil {
            WidgetCollapsingSection(
                title: "Team Stats",
                systemImage: "chart.bar",
                iconTint: Color.appAccentBlue,
                headline: GameWidgetHeadlines.teamStats(
                    awayAbbr: game.awayAbbr,
                    homeAbbr: game.homeAbbr,
                    awayOffense: game.awayAdjOffense,
                    homeOffense: game.homeAdjOffense
                )
            ) {
                VStack(spacing: 8) {
                    statsHeader
                    statsRow(label: "Adj. Offense",
                             away: game.awayAdjOffense.map { String(format: "%.1f", $0) } ?? "-",
                             home: game.homeAdjOffense.map { String(format: "%.1f", $0) } ?? "-")
                    statsRow(label: "Adj. Defense",
                             away: game.awayAdjDefense.map { String(format: "%.1f", $0) } ?? "-",
                             home: game.homeAdjDefense.map { String(format: "%.1f", $0) } ?? "-")
                    statsRow(label: "Adj. Pace",
                             away: game.awayAdjPace.map { String(format: "%.1f", $0) } ?? "-",
                             home: game.homeAdjPace.map { String(format: "%.1f", $0) } ?? "-")
                    if game.homeAtsPct != nil || game.awayAtsPct != nil {
                        statsRow(label: "ATS %",
                                 away: game.awayAtsPct.map { "\(Int(($0 * 100).rounded()))%" } ?? "-",
                                 home: game.homeAtsPct.map { "\(Int(($0 * 100).rounded()))%" } ?? "-")
                    }
                    if game.homeOverPct != nil || game.awayOverPct != nil {
                        statsRow(label: "Over %",
                                 away: game.awayOverPct.map { "\(Int(($0 * 100).rounded()))%" } ?? "-",
                                 home: game.homeOverPct.map { "\(Int(($0 * 100).rounded()))%" } ?? "-")
                    }
                }
                .padding(12)
                .background(Color.appTextMuted.opacity(0.05), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    @ViewBuilder
    private var statsHeader: some View {
        HStack {
            Color.clear.frame(width: 0).frame(maxWidth: .infinity, alignment: .leading)
            Text(game.awayAbbr)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .center)
            Text(game.homeAbbr)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .center)
        }
        .padding(.bottom, 4)
        .overlay(Rectangle().frame(height: 1).foregroundStyle(Color.appBorder), alignment: .bottom)
    }

    @ViewBuilder
    private func statsRow(label: String, away: String, home: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(away)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .frame(maxWidth: .infinity, alignment: .center)
            Text(home)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .frame(maxWidth: .infinity, alignment: .center)
        }
    }

    // MARK: - Wrappers / helpers

    @ViewBuilder
    private func comparisonBox(label: String, value: String, color: Color, isHighlight: Bool = false) -> some View {
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
    }

    private struct OUPrediction {
        let edge: Double
        let isOver: Bool
        let modelTotal: Double?
        let line: Double?
    }

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
