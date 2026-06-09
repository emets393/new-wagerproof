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
///   5. Spread Analysis (Vegas vs Model fair spread, edge, fade alert + tooltip)
///   6. Over/Under Analysis (Vegas vs Model fair total, edge)
///   7. Injury Report (pro feature)
///   8. Recent Trends (pro feature)
///   9. Betting Trends (situational ATS + O/U tables, gated on per-game store lookup)
///  10. Model Accuracy (spread/ML/OU pick vs historical accuracy bucket)
///  11. Team Stats (Adj Off/Def/Pace, ATS%, Over%)
///  12. Match Simulator (model-predicted scores)
struct NBAGameBottomSheet: View {
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
    @State private var accuracyStore = NBAModelAccuracyStore()
    @State private var spreadExpanded: Bool = false
    @State private var ouExpanded: Bool = false
    @State private var injuryExpanded: Bool = false
    @State private var trendsExpanded: Bool = false
    @State private var simulating: Bool = false
    @State private var simulationRevealed: Bool = false

    private var awayColors: TeamColorPair { NBATeams.colorPair(for: game.awayTeam) }
    private var homeColors: TeamColorPair { NBATeams.colorPair(for: game.homeTeam) }

    var body: some View {
        // Weather-style: collapsing matchup hero on top, widget cards that pin →
        // collapse under their header → fade out → hand off to the next.
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
            injurySection
            recentTrendsSection
            bettingTrendsSection
            modelAccuracySection
            teamStatsSection
            matchSimulatorSection
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
        .task(id: game.id) {
            // Reset transient sheet state when a new game opens.
            spreadExpanded = false
            ouExpanded = false
            injuryExpanded = false
            trendsExpanded = false
            simulating = false
            simulationRevealed = false
            matchupStore.reset()
            // Three independent fetches in parallel — matches RN's hook-level
            // module caches that each fire-and-forget once per app session.
            // `refresh()` is idempotent (the stores no-op when already loaded).
            async let matchup: Void = matchupStore.load(
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                gameDate: game.gameDate
            )
            async let trends: Void = trendsStore.refresh()
            async let accuracy: Void = accuracyStore.refresh()
            _ = await (matchup, trends, accuracy)
        }
    }

    // MARK: - Collapsing widget sections

    @ViewBuilder
    private var marketOddsSection: some View {
        WidgetCollapsingSection(title: "Market Odds", systemImage: "chart.bar.fill", iconTint: Color.appPrimary) {
            PolymarketWidget(league: "nba", awayTeam: game.awayTeam, homeTeam: game.homeTeam)
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
            onHeaderTap: { injuryExpanded.toggle() }
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
            onHeaderTap: { trendsExpanded.toggle() }
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

    /// Renders BettingTrendsWidget when the per-game lookup succeeds. RN's
    /// `useNBABettingTrendsForGame` returns `null` when the gameId isn't in
    /// the cached map — mirror that with a guard.
    @ViewBuilder
    private var bettingTrendsSection: some View {
        if let game = trendsStore.trends(for: game.gameId) {
            WidgetCollapsingSection(title: "Betting Trends", systemImage: "chart.line.uptrend.xyaxis", iconTint: Color(hex: 0x8B5CF6)) {
                BettingTrendsWidget(
                    awayAbbr: self.game.awayAbbr,
                    homeAbbr: self.game.homeAbbr,
                    away: game.awayTeam,
                    home: game.homeTeam
                )
            }
        }
    }

    /// Renders ModelAccuracyWidget when the per-game lookup succeeds.
    @ViewBuilder
    private var modelAccuracySection: some View {
        if let accuracy = accuracyStore.accuracy(for: game.gameId) {
            WidgetCollapsingSection(title: "Model Accuracy", systemImage: "scope", iconTint: Color(hex: 0x14B8A6)) {
                ModelAccuracyWidget(
                    awayAbbr: game.awayAbbr,
                    homeAbbr: game.homeAbbr,
                    nba: accuracy
                )
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

        VStack(spacing: heroLerp(12, 6, p)) {
            topRow
            HStack(alignment: .center, spacing: heroLerp(14, 10, p)) {
                heroTeamColumn(team: game.awayTeam, colors: awayColors, size: logoSize,
                               nameOpacity: detail, ml: game.awayMl, mlReveal: mlReveal)
                heroLinesColumn(detail: detail, p: p)
                heroTeamColumn(team: game.homeTeam, colors: homeColors, size: logoSize,
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
    private func heroTeamColumn(team: String, colors: TeamColorPair, size: CGFloat, nameOpacity: Double, ml: Int?, mlReveal: Double) -> some View {
        let abbr = TeamInitials.from(team)
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
                probability: nil,
                isFadeAlert: edge >= 9.5
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
                isFadeAlert: p >= 0.8 || (p - 0.5) * 20 >= 9.5
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
                    if prediction.isFadeAlert {
                        fadeAlertPill
                        // RN renders FadeAlertTooltip immediately below the pill.
                        // The suggested-bet copy mirrors the RN string:
                        // fade direction is the opposite of the model's side.
                        FadeAlertTooltip(
                            betType: .spread,
                            suggestedBet: fadeSuggestion(for: prediction)
                        )
                    }
                    if spreadExpanded {
                        explanation(text: spreadExplanation(prediction))
                    }
                }
            }
        }
    }

    /// RN's fade copy: `${prediction.isHome ? game.away_team : game.home_team} ${formatSpread(...)}`.
    /// The "fade" team is the OPPOSITE of the side the model picks.
    private func fadeSuggestion(for prediction: SpreadPrediction) -> String {
        let fadeTeam = prediction.isHome ? game.awayTeam : game.homeTeam
        let fadeSpread = prediction.isHome ? game.awaySpread : game.homeSpread
        return "\(fadeTeam) \(GameCardFormatting.formatSpread(fadeSpread))"
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
                    if ouExpanded {
                        explanation(text: ouExplanation(prediction))
                    }
                }
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
                            // Mirror RN's 2.5s reveal delay.
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
                        .background(simulating ? Color.appSurfaceMuted : Color.appPrimary,
                                    in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(simulating ? Color.appTextPrimary : Color.white)
                    }
                    .buttonStyle(.plain)
                    .disabled(simulating)
                    .sensoryFeedback(.impact(weight: .medium), trigger: simulating)
                } else {
                    HStack {
                        VStack(spacing: 12) {
                            GameCardTeamAvatar(teamName: game.awayTeam, sport: "nba", size: 64)
                            Text("\(Int(awayScore.rounded()))")
                                .font(.system(size: 32, weight: .bold))
                                .foregroundStyle(Color.appTextPrimary)
                        }
                        .frame(maxWidth: .infinity)
                        Text("VS")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Color.appTextSecondary)
                        VStack(spacing: 12) {
                            GameCardTeamAvatar(teamName: game.homeTeam, sport: "nba", size: 64)
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
        let isFadeAlert: Bool
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
