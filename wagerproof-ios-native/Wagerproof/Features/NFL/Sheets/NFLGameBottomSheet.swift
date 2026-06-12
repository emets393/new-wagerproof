import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Full NFL game detail sheet. Mirrors RN `components/NFLGameBottomSheet.tsx`,
/// rendered with the shared iOS-Weather choreography (`CollapsingWidgetScroll`):
/// a collapsing team-aura matchup hero on top of Liquid Glass widget cards that
/// pin → collapse under their header → fade out → hand off to the next.
///
///   1. Matchup hero (team avatars + spread/ML/O-U → compact "AWAY @ HOME" bar)
///   2. Weather (Pro-gated, conditional)
///   3. Market Odds (Polymarket, Pro-gated)
///   4. Spread Prediction (Pro-gated, collapsible, inline FadeAlertTooltip)
///   5. Over/Under Prediction (Pro-gated, collapsible, inline FadeAlertTooltip)
///   6. Public Lean splits (NFLPublicBettingBars, Pro-gated)
///   7. Head-to-Head (Pro-gated, modal trigger)
///   8. Line Movement (Pro-gated, modal trigger)
///   9. Agent pick rationale (only when the audit store has a matching pick)
struct NFLGameBottomSheet: View {
    let game: NFLPrediction
    var onClose: () -> Void = {}
    /// When false (carousel mode), the page paints a transparent base instead of
    /// its own team aura — the carousel owns a single shared glow that doesn't
    /// swipe. The hero keeps an opaque masking background regardless.
    var showAura: Bool = true
    /// Carousel-only safe-area insets (see `MLBGameBottomSheet`).
    var heroTopInset: CGFloat = 0
    var contentBottomInset: CGFloat = 0

    // Reading the audit store here so we can `.clear()` it on close — mirrors
    // RN's `clearAgentPickAudit()` call in the sheet's onClose handler.
    @Environment(AgentPickAuditStore.self) private var auditStore
    @Environment(\.colorScheme) private var colorScheme

    @State private var spreadExpanded: Bool = false
    @State private var ouExpanded: Bool = false
    @State private var h2hPresented: Bool = false
    @State private var lineMovementPresented: Bool = false

    private var awayColors: TeamColorPair { NFLTeamColors.colorPair(for: game.awayTeam) }
    private var homeColors: TeamColorPair { NFLTeamColors.colorPair(for: game.homeTeam) }

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
            marketOddsSection
            spreadAnalysis
            ouAnalysis
            publicBettingSection
            headToHeadSection
            lineMovementSection
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
        .sheet(isPresented: $h2hPresented) {
            H2HModal(awayTeam: game.awayTeam, homeTeam: game.homeTeam) {
                h2hPresented = false
            }
        }
        .sheet(isPresented: $lineMovementPresented) {
            LineMovementModal(title: "Line Movement", onClose: { lineMovementPresented = false }) {
                ContentUnavailableView {
                    Label("Line Movement", systemImage: "chart.line.uptrend.xyaxis")
                } description: {
                    Text("Movement chart for \(game.awayTeam) @ \(game.homeTeam) wires up when nfl_line_movement ports.")
                }
            }
        }
    }

    // MARK: - Collapsing hero

    /// Matchup hero rendered as ONE layout that continuously shrinks with scroll
    /// `progress` (0 = expanded, 1 = collapsed): avatars scale down, spacing
    /// tightens, team names + the centered spread/total fade, and each team's
    /// moneyline cross-fades in under its avatar — so the compact state is a
    /// smaller mirror of the large one. Mirrors `MLBGameBottomSheet.heroView`.
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
        // Canonical abbr from the `nfl_teams` reference table ("BUF", not the
        // naive initials of "Buffalo Bills").
        let abbr = NFLTeamAssets.abbr(for: team)
        let parts = TeamInitials.parts(of: team)
        VStack(spacing: 4) {
            GameCardTeamAvatar(teamName: team, sport: "nfl", size: size, colors: colors)
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
    private var marketOddsSection: some View {
        WidgetCollapsingSection(title: "Market Odds", systemImage: "chart.bar.fill", iconTint: Color.appPrimary) {
            ProContentSection(title: "Market Odds", minHeight: 120) {
                PolymarketWidget(league: "nfl", awayTeam: game.awayTeam, homeTeam: game.homeTeam)
            }
        }
    }

    @ViewBuilder
    private var spreadAnalysis: some View {
        if let prob = game.homeAwaySpreadCoverProb {
            let pickHome = prob >= 0.5
            let team = pickHome ? game.homeTeam : game.awayTeam
            let spread = pickHome ? game.homeSpread : game.awaySpread
            let confidence = pickHome ? prob : (1 - prob)
            let percent = Int((confidence * 100).rounded())
            let isFadeAlert = confidence >= 0.8
            let fadeTeam = pickHome ? game.awayTeam : game.homeTeam
            let fadeSpread = pickHome ? game.awaySpread : game.homeSpread

            WidgetCollapsingSection(
                title: "Spread Prediction",
                systemImage: "target",
                iconTint: Color.appPrimary,
                accessory: .tapHint(expanded: spreadExpanded),
                onHeaderTap: { spreadExpanded.toggle() }
            ) {
                ProContentSection(title: "Spread Analysis", minHeight: 150) {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            comparisonBox(label: "Vegas Spread", value: GameCardFormatting.formatSpread(spread), color: Color.appTextPrimary)
                            Image(systemName: "arrow.right")
                                .foregroundStyle(Color.appTextMuted)
                            comparisonBox(label: "Confidence", value: "\(percent)%", color: Color.appPrimary, isHighlight: true)
                        }
                        HStack(spacing: 12) {
                            GameCardTeamAvatar(teamName: team, sport: "nfl", size: 40,
                                               colors: pickHome ? homeColors : awayColors)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(team) covers")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Color.appTextPrimary)
                                Text("\(GameCardFormatting.formatSpread(spread)) at \(String(format: "%.1f", confidence * 100))%")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundStyle(Color.appPrimary)
                            }
                        }
                        if isFadeAlert {
                            fadeAlertPill
                            FadeAlertTooltip(
                                betType: .spread,
                                suggestedBet: "\(fadeTeam) \(GameCardFormatting.formatSpread(fadeSpread))"
                            )
                        }
                        if spreadExpanded {
                            explanation(text: spreadExplanation(confidence: confidence, team: team, spread: spread))
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var ouAnalysis: some View {
        if let prob = game.ouResultProb {
            let isOver = prob > 0.5
            let confidence = isOver ? prob : (1 - prob)
            let percent = Int((confidence * 100).rounded())
            let isFadeAlert = confidence >= 0.8
            let color = isOver ? Color.appPrimary : Color.appAccentRed
            let lineText = GameCardFormatting.roundToNearestHalf(game.overLine)
            let fadeLabel = isOver ? "Under \(lineText)" : "Over \(lineText)"

            WidgetCollapsingSection(
                title: "Over/Under Prediction",
                systemImage: isOver ? "arrow.up.circle.fill" : "arrow.down.circle.fill",
                iconTint: color,
                accessory: .tapHint(expanded: ouExpanded),
                onHeaderTap: { ouExpanded.toggle() }
            ) {
                ProContentSection(title: "Total Analysis", minHeight: 150) {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            comparisonBox(label: "Vegas O/U", value: GameCardFormatting.roundToNearestHalf(game.overLine), color: Color.appTextPrimary)
                            Image(systemName: "arrow.right")
                                .foregroundStyle(Color.appTextMuted)
                            comparisonBox(label: "Confidence", value: "\(percent)%", color: color, isHighlight: true)
                        }
                        HStack(spacing: 12) {
                            Image(systemName: isOver ? "chevron.up" : "chevron.down")
                                .font(.system(size: 32, weight: .bold))
                                .foregroundStyle(color)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(isOver ? "Over" : "Under") \(GameCardFormatting.roundToNearestHalf(game.overLine))")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Color.appTextPrimary)
                                Text("\(String(format: "%.1f", confidence * 100))% confidence")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundStyle(color)
                            }
                        }
                        if isFadeAlert {
                            fadeAlertPill
                            FadeAlertTooltip(betType: .total, suggestedBet: fadeLabel)
                        }
                        if ouExpanded {
                            explanation(text: ouExplanation(confidence: confidence, isOver: isOver, line: game.overLine))
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var publicBettingSection: some View {
        if hasPublicBetting {
            WidgetCollapsingSection(title: "Public Lean", systemImage: "person.3.fill", iconTint: Color(hex: 0x22C55E)) {
                ProContentSection(title: "Public Betting", minHeight: 200) {
                    NFLPublicBettingBars(prediction: game)
                }
            }
        }
    }

    @ViewBuilder
    private var headToHeadSection: some View {
        WidgetCollapsingSection(title: "Head-to-Head", systemImage: "person.2.fill", iconTint: Color.appAccentBlue) {
            ProContentSection(title: "Head-to-Head", minHeight: 44) {
                Button {
                    h2hPresented = true
                } label: {
                    HStack {
                        Text("Tap to view recent matchups")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .sensoryFeedback(.impact(weight: .light), trigger: h2hPresented)
            }
        }
    }

    @ViewBuilder
    private var lineMovementSection: some View {
        WidgetCollapsingSection(title: "Line Movement", systemImage: "chart.line.uptrend.xyaxis", iconTint: Color.appPrimary) {
            ProContentSection(title: "Line Movement", minHeight: 44) {
                Button {
                    lineMovementPresented = true
                } label: {
                    HStack {
                        Text("Tap to view full chart")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .sensoryFeedback(.impact(weight: .light), trigger: lineMovementPresented)
            }
        }
    }

    // MARK: - Helpers

    private var hasPublicBetting: Bool {
        game.homeMlBets != nil || game.awayMlBets != nil ||
            game.homeSpreadBets != nil || game.awaySpreadBets != nil ||
            game.overBets != nil || game.underBets != nil ||
            game.mlSplitsLabel != nil || game.spreadSplitsLabel != nil ||
            game.totalSplitsLabel != nil
    }

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

    private func spreadExplanation(confidence: Double, team: String, spread: Double?) -> String {
        let pct = String(format: "%.1f", confidence * 100)
        let spr = GameCardFormatting.formatSpread(spread)
        if confidence < 0.55 {
            return "Our model shows a \(pct)% confidence that \(team) will cover the \(spr) spread. This is a tight matchup where the model sees only a slight edge, suggesting the betting line is efficient and both sides have near-equal value."
        }
        if confidence < 0.65 {
            return "Our model projects \(team) to cover \(spr) with \(pct)% confidence. This moderate edge suggests our analytics identify a meaningful advantage that differs from the market's assessment of this matchup."
        }
        return "Our model strongly favors \(team) to cover \(spr) with \(pct)% confidence. This significant edge indicates our projections see this team performing notably better relative to the spread than the current betting line suggests."
    }

    private func ouExplanation(confidence: Double, isOver: Bool, line: Double?) -> String {
        let pct = String(format: "%.1f", confidence * 100)
        let dir = isOver ? "OVER" : "UNDER"
        let lineText = GameCardFormatting.roundToNearestHalf(line)
        if confidence < 0.55 {
            return "Our model predicts the \(dir) \(lineText) with \(pct)% confidence. This is a close call where the projected total is near the betting line, indicating the market has priced this game's scoring potential efficiently."
        }
        if confidence < 0.65 {
            return "Our model projects a moderate \(pct)% confidence on the \(dir) \(lineText). This suggests our analytics see a meaningful difference in how this game's scoring will unfold compared to the current total line."
        }
        return "Our model strongly predicts the \(dir) \(lineText) with \(pct)% confidence. This significant edge indicates our projections expect the game's total score to differ substantially from what the betting market anticipates."
    }
}
