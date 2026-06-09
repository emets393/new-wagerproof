import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Full CFB game detail sheet. Mirrors RN `components/CFBGameBottomSheet.tsx`,
/// rendered with the shared iOS-Weather choreography (`CollapsingWidgetScroll`):
/// a collapsing team-aura matchup hero on top of Liquid Glass widget cards that
/// pin → collapse under their header → fade out → hand off to the next.
///
///   1. Matchup hero (team avatars + spread/ML/O-U → compact "AWAY @ HOME" bar)
///   2. Weather (conditional)
///   3. Market Odds (Polymarket)
///   4. Spread Prediction (Vegas vs Model, edge, FadeAlert, collapsible)
///   5. Over/Under Prediction (Vegas vs Model, edge, FadeAlert, collapsible)
///   6. Public Betting Bars (CFBPublicBettingBars)
///   7. Line Movement (open → current + explanation collapsible)
///   8. Match Simulator (2.5s reveal)
///   9. Agent pick rationale (only when the audit store has a matching pick)
///
/// CFB uses edge values (`home_spread_diff`, `over_line_diff`) rather than
/// probabilities, so the Vegas-vs-Model copy reads in points rather than
/// percentages. CFB has no authoritative team-color table, so the aura/hero
/// colors come from `FallbackTeamColor.colorPair(for:)`.
struct CFBGameBottomSheet: View {
    let game: CFBPrediction
    var onClose: () -> Void = {}
    /// When false (carousel mode), the page paints a transparent base instead of
    /// its own team aura — the carousel owns a single shared glow that doesn't
    /// swipe. The hero keeps an opaque masking background regardless.
    var showAura: Bool = true
    /// Carousel-only safe-area insets (see `NFLGameBottomSheet`).
    var heroTopInset: CGFloat = 0
    var contentBottomInset: CGFloat = 0

    // Reading the audit store here so we can `.clear()` it on close — mirrors
    // RN's `clearAgentPickAudit()` call in the sheet's onClose handler.
    @Environment(AgentPickAuditStore.self) private var auditStore
    @Environment(\.colorScheme) private var colorScheme

    @State private var spreadExpanded: Bool = false
    @State private var ouExpanded: Bool = false
    @State private var lineMovementExpanded: Bool = false
    @State private var simulating: Bool = false
    @State private var simulationRevealed: Bool = false

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
            weatherSection
            polymarketSection
            spreadAnalysis
            ouAnalysis
            publicBettingSection
            lineMovementCard
            matchSimulatorSection
            // Agent rationale scrolls away at the very bottom (no pin).
            AgentPickRationaleWidget(
                gameKeys: [game.trainingKey, game.uniqueId, "\(game.awayTeam)_\(game.homeTeam)"]
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
        }
        .background(showAura ? Color.appSurface : Color.clear)
        .toolbarBackground(.hidden, for: .navigationBar)
        .presentationDetents([.fraction(0.85), .large])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.disabled)
        .onDisappear {
            // RN's `handleCloseSheet` calls `clearAgentPickAudit()` — without
            // this, the rationale card would persist when reopening the sheet
            // for a different game while a pick selection lingers.
            auditStore.clear()
        }
        .task(id: game.id) {
            // Reset transient sheet state when a new game opens. Mirrors RN's
            // `useEffect([game?.id])` that clears the simulator state.
            spreadExpanded = false
            ouExpanded = false
            lineMovementExpanded = false
            simulating = false
            simulationRevealed = false
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
            GameCardTeamAvatar(teamName: team, sport: "cfb", size: size, colors: colors)
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
            if let conference = game.conference, !conference.isEmpty {
                conferenceChip(conference)
            }
            Spacer()
        }
    }

    @ViewBuilder
    private func conferenceChip(_ label: String) -> some View {
        Text(label)
            .font(.system(size: 9, weight: .semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.appPrimary.opacity(0.15), in: Capsule())
            .overlay(Capsule().stroke(Color.appPrimary.opacity(0.3), lineWidth: 1))
            .foregroundStyle(Color.appPrimary)
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

    // MARK: - Collapsing widget sections

    @ViewBuilder
    private var weatherSection: some View {
        if game.temperature != nil || game.windSpeed != nil {
            WidgetCollapsingSection(title: "Weather", systemImage: "cloud.sun", iconTint: Color.appAccentBlue) {
                ProContentSection(title: "Weather", minHeight: 60) {
                    WeatherDisplay(
                        temperatureF: game.temperature,
                        windSpeedMph: game.windSpeed,
                        precipitationPct: game.precipitation
                    )
                }
            }
        }
    }

    @ViewBuilder
    private var polymarketSection: some View {
        WidgetCollapsingSection(title: "Market Odds", systemImage: "chart.bar.fill", iconTint: Color.appPrimary) {
            ProContentSection(title: "Market Odds", minHeight: 120) {
                PolymarketWidget(league: "cfb", awayTeam: game.awayTeam, homeTeam: game.homeTeam)
            }
        }
    }

    // MARK: - Spread / O-U sections

    /// CFB-specific spread prediction. RN reads `home_spread_diff` straight
    /// from the predictions row — positive means the home team has the edge,
    /// negative means the away team. `pred_spread` is the model's projected
    /// spread for the home team.
    private var spreadPrediction: SpreadPrediction? {
        guard let diff = game.homeSpreadDiff else { return nil }
        let isHome = diff > 0
        let modelSpread = game.predSpread
            ?? (isHome ? game.homeSpread : game.awaySpread)
        return SpreadPrediction(
            edge: abs(diff),
            predictedTeam: isHome ? game.homeTeam : game.awayTeam,
            predictedSpread: modelSpread,
            isHome: isHome,
            // RN: `Math.abs(home_spread_diff) > 10` triggers fade alert.
            isFadeAlert: abs(diff) > 10
        )
    }

    /// CFB O/U prediction. `over_line_diff > 0` → model favors Over,
    /// `over_line_diff < 0` → model favors Under.
    private var ouPrediction: OUPrediction? {
        guard let diff = game.overLineDiff else { return nil }
        let modelTotal = game.predOverLine ?? game.predTotal ?? game.overLine
        return OUPrediction(
            edge: abs(diff),
            isOver: diff > 0,
            modelTotal: modelTotal,
            line: game.overLine,
            isFadeAlert: abs(diff) > 10
        )
    }

    @ViewBuilder
    private var spreadAnalysis: some View {
        if let prediction = spreadPrediction {
            WidgetCollapsingSection(
                title: "Spread Prediction",
                systemImage: "target",
                iconTint: Color(hex: 0x22C55E),
                accessory: .tapHint(expanded: spreadExpanded),
                onHeaderTap: { spreadExpanded.toggle() }
            ) {
                ProContentSection(title: "Spread Analysis", minHeight: 150) {
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
                                color: Color(hex: 0x22C55E),
                                isHighlight: true
                            )
                        }
                        HStack(spacing: 12) {
                            GameCardTeamAvatar(teamName: prediction.predictedTeam, sport: "cfb", size: 40,
                                               colors: prediction.isHome ? homeColors : awayColors)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Edge to \(TeamInitials.from(prediction.predictedTeam))")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Color.appTextPrimary)
                                Text("\(String(format: "%.1f", prediction.edge)) pts delta")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundStyle(Color(hex: 0x22C55E))
                            }
                        }
                        if prediction.isFadeAlert {
                            fadeAlertPill
                            FadeAlertTooltip(
                                betType: .spread,
                                // RN's suggested-bet copy fades to the OTHER side.
                                suggestedBet: spreadFadeSuggestion(prediction)
                            )
                        }
                        if spreadExpanded {
                            explanation(
                                text: spreadExplanation(prediction),
                                tint: Color(hex: 0x22C55E)
                            )
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var ouAnalysis: some View {
        if let prediction = ouPrediction {
            let color: Color = prediction.isOver
                ? Color(hex: 0x22C55E)
                : Color.appAccentRed
            WidgetCollapsingSection(
                title: "Over/Under Prediction",
                systemImage: prediction.isOver ? "arrow.up.circle.fill" : "arrow.down.circle.fill",
                iconTint: color,
                accessory: .tapHint(expanded: ouExpanded),
                onHeaderTap: { ouExpanded.toggle() }
            ) {
                ProContentSection(title: "Total Analysis", minHeight: 150) {
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
                                suggestedBet: ouFadeSuggestion(prediction)
                            )
                        }
                        if ouExpanded {
                            explanation(text: ouExplanation(prediction), tint: color)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Public betting + line movement

    @ViewBuilder
    private var publicBettingSection: some View {
        if game.mlSplitsLabel != nil || game.spreadSplitsLabel != nil || game.totalSplitsLabel != nil {
            WidgetCollapsingSection(title: "Public Betting", systemImage: "person.3.fill", iconTint: Color.appAccentPurple) {
                ProContentSection(title: "Public Betting", minHeight: 200) {
                    CFBPublicBettingBars(game: game)
                }
            }
        }
    }

    @ViewBuilder
    private var lineMovementCard: some View {
        WidgetCollapsingSection(
            title: "Line Movement",
            systemImage: "chart.line.uptrend.xyaxis",
            iconTint: Color(hex: 0x10B981),
            accessory: .tapHint(expanded: lineMovementExpanded, expandedLabel: "Tap for Explanation"),
            onHeaderTap: { lineMovementExpanded.toggle() }
        ) {
            ProContentSection(title: "Line Movement", minHeight: 120) {
                VStack(alignment: .leading, spacing: 12) {
                    // Open → Current pill row. RN renders just the spread movement
                    // here; the total movement lives inside the explanation copy.
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Spread")
                            .font(.system(size: 12, weight: .heavy))
                            .tracking(0.5)
                            .foregroundStyle(Color.appTextSecondary)
                        HStack(spacing: 12) {
                            movementPill(
                                label: "Open",
                                value: GameCardFormatting.formatSpread(game.openingSpread),
                                color: Color.appAccentBlue
                            )
                            Image(systemName: "arrow.right")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(Color.appTextMuted)
                            movementPill(
                                label: "Current",
                                value: GameCardFormatting.formatSpread(game.homeSpread),
                                color: Color(hex: 0x22C55E)
                            )
                        }
                    }
                    .padding(16)
                    .background(Color(hex: 0x22C55E, opacity: 0.1), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color(hex: 0x22C55E, opacity: 0.3), lineWidth: 1)
                    )

                    if lineMovementExpanded {
                        explanation(
                            text: lineMovementExplanation(),
                            tint: Color(hex: 0x22C55E)
                        )
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func movementPill(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(color.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(color.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Match simulator

    @ViewBuilder
    private var matchSimulatorSection: some View {
        // RN prefers pred_*_points and falls back to pred_*_score. Honour the
        // same precedence so users with only one set still see the simulator.
        let awayScore = game.predAwayPoints ?? game.predAwayScore
        let homeScore = game.predHomePoints ?? game.predHomeScore
        if let awayScore, let homeScore {
            WidgetCollapsingSection(title: "Match Simulator", systemImage: "sparkles", iconTint: Color.appAccentAmber) {
                ProContentSection(title: "Match Simulator", minHeight: 120) {
                    VStack(alignment: .leading, spacing: 12) {
                        if !simulationRevealed {
                            Button {
                                simulating = true
                                Task {
                                    // RN keeps the 2.5s reveal delay so the spinner has
                                    // weight — the deterministic prediction would
                                    // otherwise feel hollow.
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
                                    GameCardTeamAvatar(teamName: game.awayTeam, sport: "cfb", size: 64, colors: awayColors)
                                    Text("\(Int(awayScore.rounded()))")
                                        .font(.system(size: 32, weight: .bold))
                                        .foregroundStyle(Color.appTextPrimary)
                                }
                                .frame(maxWidth: .infinity)
                                Text("VS")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundStyle(Color.appTextSecondary)
                                VStack(spacing: 12) {
                                    GameCardTeamAvatar(teamName: game.homeTeam, sport: "cfb", size: 64, colors: homeColors)
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
    }

    // MARK: - Helpers (chrome)

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
    private func explanation(text: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "info.circle")
                Text("What This Means")
                    .font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(tint)
            Text(text)
                .font(.system(size: 13))
                .lineSpacing(4)
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(12)
        .background(tint.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(tint.opacity(0.25), lineWidth: 1)
        )
    }

    // MARK: - Prediction types + explanation copy

    private struct SpreadPrediction {
        let edge: Double
        let predictedTeam: String
        let predictedSpread: Double?
        let isHome: Bool
        let isFadeAlert: Bool
    }

    private struct OUPrediction {
        let edge: Double
        let isOver: Bool
        let modelTotal: Double?
        let line: Double?
        let isFadeAlert: Bool
    }

    /// Three-tier copy mirrors RN `getSpreadExplanation`. Edge in points; CFB
    /// reads in pts-delta rather than confidence percentage.
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

    /// RN's `getLineMovementExplanation` returns long multi-line strings keyed
    /// off the magnitude of the spread shift. Mirrored verbatim so reviewers
    /// can diff the copy 1:1.
    private func lineMovementExplanation() -> String {
        guard let open = game.openingSpread, let current = game.homeSpread else {
            return "No opening line snapshot available for this matchup yet. Once the book posts the opener and we record a move, this section explains who's getting more (or fewer) points and what the shift typically signals."
        }
        let movement = current - open
        let homeTeam = TeamInitials.from(game.homeTeam)
        let awayTeam = TeamInitials.from(game.awayTeam)
        let homeOpen = GameCardFormatting.formatSpread(open)
        let homeCurrent = GameCardFormatting.formatSpread(current)
        let awayOpen = GameCardFormatting.formatSpread(-open)
        let awayCurrent = GameCardFormatting.formatSpread(-current)

        if movement == 0 {
            return "NO MOVEMENT — Line locked.\n\n\(homeTeam): \(homeCurrent)\n\(awayTeam): \(awayCurrent)\n\nMarket Consensus: Both sharp bettors and the public agree on this number.\nBalanced Action: Equal money on both sides.\nActionable Insight: This is a 'clean' line with no manipulation. If your model disagrees with this number, it could indicate genuine value since the market is confident in this spread."
        }

        let absMove = abs(movement)
        let absMoveText = String(format: "%.1f", absMove)
        let movingTowardTeam = movement > 0 ? homeTeam : awayTeam
        let movingAgainstTeam = movement > 0 ? awayTeam : homeTeam
        let gettingMorePoints = movement > 0 ? homeTeam : awayTeam
        let gettingFewerPoints = movement > 0 ? awayTeam : homeTeam
        let signed = movement > 0
            ? "+\(absMoveText)"
            : "-\(absMoveText)"

        if absMove < 1 {
            return "MINOR MOVE (\(signed) pts)\n\nLine Movement:\n\(homeTeam): \(homeOpen) → \(homeCurrent)\n\(awayTeam): \(awayOpen) → \(awayCurrent)\n\nWhat Happened:\n• \(gettingMorePoints) getting \(absMoveText) MORE points\n• \(gettingFewerPoints) giving up \(absMoveText) FEWER points\n• Light line shopping or micro-adjustments\n\nActionable Insight:\nThis subtle move suggests books are fine-tuning risk but nothing significant has changed.\n• Betting \(movingAgainstTeam)? You're getting a slightly worse number than early bettors.\n• Betting \(movingTowardTeam)? You're getting improved value (\(absMoveText) extra points).\n• Impact is minimal — bet based on your model, not this movement."
        }
        if absMove < 3 {
            return "SIGNIFICANT MOVE (\(signed) pts)\n\nLine Movement:\n\(homeTeam): \(homeOpen) → \(homeCurrent)\n\(awayTeam): \(awayOpen) → \(awayCurrent)\n\nWhat Happened:\n• \(gettingMorePoints) getting \(absMoveText) MORE points\n• \(gettingFewerPoints) giving up \(absMoveText) FEWER points\n• Sharp money OR heavy public action on \(movingAgainstTeam)\n• Possible injury news, weather update, or lineup change\n\nSharp Action Indicator:\nMoves of 1–3 points often signal respected money came in on \(movingAgainstTeam). Books moved the line to make \(movingTowardTeam) more attractive to balance action.\n\nActionable Insights:\n• VALUE PLAY: \(movingTowardTeam) is getting \(absMoveText) extra points.\n• FADE PUBLIC: If public-driven, sharps likely on \(movingTowardTeam).\n• DUE DILIGENCE: Check injury reports and weather — this move has a reason."
        }
        return "MAJOR MOVE (\(signed) pts)\n\nLine Movement:\n\(homeTeam): \(homeOpen) → \(homeCurrent)\n\(awayTeam): \(awayOpen) → \(awayCurrent)\n\nWhat Happened:\n• \(gettingMorePoints) now getting \(absMoveText) MORE points\n• \(gettingFewerPoints) now giving up \(absMoveText) FEWER points\n• This is NOT normal line movement.\n\nLikely Causes:\n• Key Player Out: star QB, top defender, critical starter\n• Sharp Syndicate: professionals hammering \(movingAgainstTeam)\n• Weather Alert: game conditions drastically changed\n• Inside Info: the market knows something you don't\n\nCRITICAL ACTION REQUIRED:\nDo not bet without investigating. Research injury reports, weather, beat-writer Twitter feeds, and sharp betting percentages.\n\nValue Opportunity:\n\(movingTowardTeam) may offer tremendous value (\(absMoveText) extra points) if the move is an overreaction.\n\nRespect the Move:\nIf sharp money caused this, betting \(movingAgainstTeam) means fighting professional action. Proceed with extreme caution.\n\nBest Play:\nIf no significant news surfaces and you trust your model, \(movingTowardTeam) is getting exceptional closing line value with an extra \(absMoveText) points."
    }

    /// RN's FadeAlertTooltip surfaces the suggested fade as the OPPOSITE side.
    /// For a model that loves the home spread, the fade target is the away
    /// spread, etc. Match the RN suggested-bet copy formatting.
    private func spreadFadeSuggestion(_ prediction: SpreadPrediction) -> String {
        let oppositeTeam = prediction.isHome ? game.awayTeam : game.homeTeam
        let oppositeSpread = prediction.isHome ? game.awaySpread : game.homeSpread
        return "\(oppositeTeam) \(GameCardFormatting.formatSpread(oppositeSpread))"
    }

    private func ouFadeSuggestion(_ prediction: OUPrediction) -> String {
        let direction = prediction.isOver ? "Under" : "Over"
        let line = GameCardFormatting.roundToNearestHalf(prediction.line)
        return "\(direction) \(line)"
    }
}
