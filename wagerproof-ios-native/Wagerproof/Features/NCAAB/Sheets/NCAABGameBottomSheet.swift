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
    /// Expanded trends surface (full 5-section matrix sheet).
    @State private var trendsDetail: NCAABGameTrendsData?

    @Environment(\.colorScheme) private var colorScheme

    @State private var spreadExpanded: Bool = false
    @State private var ouExpanded: Bool = false
    @State private var simulating: Bool = false
    @State private var simulationRevealed: Bool = false

    // No authoritative NCAAB brand-color table exists for the hundreds of D1
    // teams, so derive a stable, pleasant glow color from the team name.
    private var awayColors: TeamColorPair { FallbackTeamColor.colorPair(for: game.awayTeam) }
    private var homeColors: TeamColorPair { FallbackTeamColor.colorPair(for: game.homeTeam) }

    var body: some View {
        CollapsingWidgetScroll(
            heroMaxHeight: 196,
            heroMinHeight: 124,
            transparentPage: !showAura,
            heroTopInset: heroTopInset,
            contentBottomInset: contentBottomInset
        ) { progress in
            if showAura {
                TeamAuraBackground(
                    awayColor: awayColors.primary,
                    homeColor: homeColors.primary,
                    progress: progress
                )
            } else {
                Color.appSurface
            }
        } hero: { progress in
            heroView(progress: progress)
        } content: {
            marketOddsSection
            spreadAnalysis
            ouAnalysis
            bettingTrendsSection
            modelAccuracySection
            teamStatsSection
            matchSimulatorSection
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
        .task(id: game.id) {
            // Reset transient sheet state when a new game opens.
            spreadExpanded = false
            ouExpanded = false
            simulating = false
            simulationRevealed = false
            // Hydrate trends + accuracy for this sheet. Refresh is idempotent
            // and cheap when the cache is warm; running it on every open
            // mirrors RN's hook re-mount on game change.
            await trendsStore.refreshIfNeeded()
            await accuracyStore.refresh()
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

        VStack(spacing: heroLerp(12, 6, p)) {
            topRow
            HStack(alignment: .center, spacing: heroLerp(14, 10, p)) {
                heroTeamColumn(team: game.awayTeam, abbr: game.awayTeamAbbrev, ranking: game.awayRanking,
                               colors: awayColors, size: logoSize,
                               nameOpacity: detail, ml: game.awayMl, mlReveal: mlReveal)
                heroLinesColumn(detail: detail, p: p)
                heroTeamColumn(team: game.homeTeam, abbr: game.homeTeamAbbrev, ranking: game.homeRanking,
                               colors: homeColors, size: logoSize,
                               nameOpacity: detail, ml: game.homeMl, mlReveal: mlReveal)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .frame(maxWidth: .infinity, alignment: .top)
    }

    private func heroLerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat {
        a + (b - a) * min(1, max(0, t))
    }

    @ViewBuilder
    private func heroTeamColumn(team: String, abbr: String?, ranking: Int?, colors: TeamColorPair, size: CGFloat, nameOpacity: Double, ml: Int?, mlReveal: Double) -> some View {
        let label = abbr?.trimmingCharacters(in: .whitespaces).nonEmpty ?? TeamInitials.from(team)
        let parts = TeamInitials.parts(of: team)
        VStack(spacing: 4) {
            ZStack(alignment: .topTrailing) {
                GameCardTeamAvatar(teamName: team, sport: "ncaab", size: size, colors: colors)
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
        WidgetCollapsingSection(title: "Market Odds", systemImage: "chart.bar.fill", iconTint: Color.appPrimary) {
            PolymarketWidget(league: "ncaab", awayTeam: game.awayTeam, homeTeam: game.homeTeam, awayColor: awayColors.primary, homeColor: homeColors.primary)
        }
    }

    @ViewBuilder
    private var spreadAnalysis: some View {
        if let prediction = spreadPrediction {
            WidgetCollapsingSection(
                title: "Spread Prediction",
                systemImage: "target",
                iconTint: Color.appPrimary,
                accessory: .tapHint(expanded: spreadExpanded),
                onHeaderTap: { spreadExpanded.toggle() }
            ) {
                VStack(alignment: .leading, spacing: 12) {
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
                    HStack(spacing: 12) {
                        GameCardTeamAvatar(teamName: prediction.predictedTeam, sport: "ncaab", size: 40,
                                           colors: prediction.isHome ? homeColors : awayColors)
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
                onHeaderTap: { ouExpanded.toggle() }
            ) {
                VStack(alignment: .leading, spacing: 12) {
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
                }
            }
        }
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
            WidgetCollapsingSection(title: "Model Accuracy", systemImage: "scope", iconTint: Color(hex: 0x14B8A6)) {
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
        if game.homeAdjOffense != nil || game.awayAdjOffense != nil {
            WidgetCollapsingSection(title: "Team Stats", systemImage: "chart.bar", iconTint: Color.appAccentBlue) {
                VStack(spacing: 8) {
                    statsHeader
                    statsRow(
                        label: "Adj. Offense",
                        away: game.awayAdjOffense.map { String(format: "%.1f", $0) } ?? "-",
                        home: game.homeAdjOffense.map { String(format: "%.1f", $0) } ?? "-"
                    )
                    statsRow(
                        label: "Adj. Defense",
                        away: game.awayAdjDefense.map { String(format: "%.1f", $0) } ?? "-",
                        home: game.homeAdjDefense.map { String(format: "%.1f", $0) } ?? "-"
                    )
                    statsRow(
                        label: "Adj. Pace",
                        away: game.awayAdjPace.map { String(format: "%.1f", $0) } ?? "-",
                        home: game.homeAdjPace.map { String(format: "%.1f", $0) } ?? "-"
                    )
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

    // MARK: - Match simulator

    @ViewBuilder
    private var matchSimulatorSection: some View {
        if let homeScore = game.homeScorePred, let awayScore = game.awayScorePred {
            WidgetCollapsingSection(title: "Match Simulator", systemImage: "sparkles", iconTint: Color.appAccentAmber) {
                VStack(alignment: .leading, spacing: 12) {
                if !simulationRevealed {
                    Button {
                        simulating = true
                        Task {
                            // RN renders the 2.5s reveal delay so the
                            // "Simulating..." spinner feels meaningful.
                            try? await Task.sleep(nanoseconds: 2_500_000_000)
                            simulating = false
                            simulationRevealed = true
                        }
                    } label: {
                        HStack(spacing: 8) {
                            if simulating {
                                ProgressView()
                                Text("Simulating...")
                                    .font(.system(size: 18, weight: .bold))
                            } else {
                                Text("Simulate Match")
                                    .font(.system(size: 18, weight: .bold))
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .padding(.horizontal, 32)
                        .background(
                            simulating ? Color.appSurfaceMuted : Color.appPrimary,
                            in: RoundedRectangle(cornerRadius: 12)
                        )
                        .foregroundStyle(simulating ? Color.appTextPrimary : Color.white)
                    }
                    .buttonStyle(.plain)
                    .disabled(simulating)
                    .sensoryFeedback(.impact(weight: .medium), trigger: simulating)
                } else {
                    HStack {
                        VStack(spacing: 12) {
                            GameCardTeamAvatar(teamName: game.awayTeam, sport: "ncaab", size: 64, colors: awayColors)
                            Text("\(Int(awayScore.rounded()))")
                                .font(.system(size: 32, weight: .bold))
                                .foregroundStyle(Color.appTextPrimary)
                        }
                        .frame(maxWidth: .infinity)
                        Text("VS")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Color.appTextSecondary)
                        VStack(spacing: 12) {
                            GameCardTeamAvatar(teamName: game.homeTeam, sport: "ncaab", size: 64, colors: homeColors)
                            Text("\(Int(homeScore.rounded()))")
                                .font(.system(size: 32, weight: .bold))
                                .foregroundStyle(Color.appTextPrimary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .padding(16)
                    .background(Color.appAccentAmber.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.appAccentAmber.opacity(0.3), lineWidth: 1)
                    )
                }
                }
            }
        }
    }

    /// RN renders a fallback "Model Projections" summary when there are no
    /// per-team predicted scores but the model still has margin + total.
    @ViewBuilder
    private var modelProjectionsSection: some View {
        if game.homeScorePred == nil, let margin = game.predHomeMargin, let total = game.predTotalPoints {
            WidgetCollapsingSection(title: "Model Projections", systemImage: "rectangle.grid.2x2.fill", iconTint: Color.appAccentPurple) {
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

// Local helper — same shape as the one in NCAABGameCard.swift.
private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
