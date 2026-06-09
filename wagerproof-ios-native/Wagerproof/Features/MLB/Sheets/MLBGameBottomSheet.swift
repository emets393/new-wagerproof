import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Full MLB game detail sheet. Mirrors RN
/// `components/MLBGameBottomSheet.tsx`. PROTOTYPE of the iOS Weather choreography
/// (`CollapsingWidgetScroll`): a matchup hero that shrinks into a compact bar as
/// you scroll, over widget cards that pin → collapse under their header → fade
/// out → hand off to the next. Other sports still use `PinnedWidgetScroll` until
/// this prototype is signed off.
///
///   1. Matchup hero (logos + lines + starters + final/preliminary pill →
///      compact "AWAY @ HOME" bar)
///   2. Market Odds (Polymarket)
///   3. Projected score with Full Game / 1st 5 toggle
///   4. Moneyline projection (Vegas vs Model) — collapsible, embeds
///      `FadeAlertTooltip` when the model's edge clears the 9.5% extreme
///      threshold (mirrors NBA/NCAAB fade detection — see ticket #034)
///   5. O/U projection (Vegas vs Model) — collapsible, embeds
///      `FadeAlertTooltip` on extreme totals edges
///   6. Regression report picks for this game (filtered) — Pro-gated via
///      `ProContentSection`
///   7. Game signals — Pro-gated via `ProContentSection`
///   8. Weather (with wind arrow + venue roof type) — Pro-gated via
///      `ProContentSection`
///   9. Agent pick rationale widget — only renders when the audit store has
///      a selected pick for this game (matches RN's `gameKeySet.has(...)`)
///
/// Postponed games short-circuit to a simple banner.
struct MLBGameBottomSheet: View {
    let game: MLBGame
    var onClose: () -> Void = {}
    /// When false (carousel mode), the page paints an opaque base instead of its
    /// own team aura — the carousel owns a single shared glow that doesn't swipe.
    var showAura: Bool = true
    /// Carousel-only safe-area insets. The carousel bleeds the page under the
    /// nav bar / home indicator, so it passes the real insets here to keep the
    /// hero content below the back button and the last widget above the strip.
    var heroTopInset: CGFloat = 0
    var contentBottomInset: CGFloat = 0
    /// Player-props widget plumbing — the carousel owns the zoom namespace + the
    /// selected-prop navigation, so tapping a player here pushes its prop page.
    var propNamespace: Namespace.ID? = nil
    var onSelectProp: (PlayerPropSelection) -> Void = { _ in }

    /// Toggle between full-game and first-five (F5) projections.
    enum ProjectionView { case full, f5 }
    @State private var projView: ProjectionView = .full
    @State private var mlExpanded: Bool = false
    @State private var ouExpanded: Bool = false
    /// Fallback zoom namespace for standalone use (no carousel parent).
    @Namespace private var fallbackPropNS

    @Environment(\.colorScheme) private var colorScheme

    // Optional store inputs — passed by the parent at present time. Kept
    // optional so previews + parity screenshots can render without DB wiring.
    var accuracyStore: MLBBucketAccuracyStore? = nil
    var regressionStore: MLBRegressionReportStore? = nil

    /// Game keys used by `AgentPickRationaleWidget` to decide whether to
    /// render. Mirrors RN: `[game.game_pk, "{away}_{home}"]`. The audit
    /// store compares against the selected pick's `gameId`.
    private var agentGameKeys: [String?] {
        [
            String(game.gamePk),
            "\(game.awayAbbr)_\(game.homeAbbr)",
            game.awayTeamName.flatMap { aw in game.homeTeamName.map { "\(aw)_\($0)" } }
        ]
    }

    var body: some View {
        Group {
            if game.isPostponed == true {
                // Postponed short-circuits to a banner — no hero/collapse needed.
                ScrollView {
                    postponedBanner
                        .padding(16)
                }
            } else {
                // Weather-style: collapsing matchup hero on top, widget cards
                // that pin → collapse under their header → fade out → hand off.
                CollapsingWidgetScroll(heroMaxHeight: 236, heroMinHeight: 122, transparentPage: !showAura, heroTopInset: heroTopInset, contentBottomInset: contentBottomInset) { progress in
                    // showAura (standalone): the page paints its own team aura.
                    // Carousel mode: the page base is transparent (see
                    // `transparentPage`) so the carousel's single shared glow
                    // shows through; the hero still composites this opaque
                    // `appSurface` so it masks content scrolling under it.
                    if showAura {
                        TeamAuraBackground(
                            awayColor: Color(hex: Int(MLBTeams.colors(for: game.awayTeamName ?? game.awayAbbr).primary)),
                            homeColor: Color(hex: Int(MLBTeams.colors(for: game.homeTeamName ?? game.homeAbbr).primary)),
                            progress: progress
                        )
                    } else {
                        Color.appSurface
                    }
                } hero: { progress in
                    heroView(progress: progress)
                } content: {
                    marketOddsSection
                    projectedScoreCard
                    playerPropsSection
                    moneylineCard
                    overUnderCard
                    regressionPicksCard
                    signalsCard
                    weatherCard
                    // Agent rationale scrolls away at the very bottom (no pin).
                    agentRationaleCard
                        .padding(.horizontal, 16)
                        .padding(.bottom, 12)
                }
            }
        }
        // Standalone: opaque page surface. Carousel: transparent so the
        // carousel's full-bleed base + shared glow show through the safe-area
        // bands (a per-page opaque surface gets inset by the paging TabView and
        // leaves visible edges at the top/bottom).
        .background(showAura ? Color.appSurface : Color.clear)
        // Transparent nav bar so the team aura glows continuously to the top of
        // the screen behind the back button. Safe here because the collapsing
        // hero is opaque and masks the content scrolling under it (no bleed).
        .toolbarBackground(.hidden, for: .navigationBar)
        .presentationDetents([.fraction(0.85), .large])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.disabled)
        .onChange(of: game.gamePk) {
            projView = .full
            mlExpanded = false
            ouExpanded = false
        }
    }

    // MARK: - Collapsing hero

    /// Matchup hero rendered as ONE layout that continuously shrinks with scroll
    /// `progress` (0 = expanded, 1 = collapsed): the logos scale down, spacing
    /// tightens, and the team names + starting pitchers + secondary lines
    /// fade/collapse away — so the compact state is a smaller mirror of the large
    /// one (not a separate bar). Date sits on top; no team-color line.
    @ViewBuilder
    private func heroView(progress p: CGFloat) -> some View {
        // Starting-pitchers row fades out over the first ~half of the collapse,
        // then is removed so its height collapses too. (The disc/line morph is
        // owned by `MatchupGlassHero`, driven by the same `progress`.)
        let detail = Double(max(0, 1 - p * 1.9))

        VStack(spacing: heroLerp(12, 6, p)) {
            topRow
            MatchupGlassHero(
                away: heroSide(name: game.awayTeamName ?? game.awayTeam ?? "Away",
                               abbr: game.awayAbbr, logoUrl: game.awayLogoUrl, ml: game.awayMl),
                home: heroSide(name: game.homeTeamName ?? game.homeTeam ?? "Home",
                               abbr: game.homeAbbr, logoUrl: game.homeLogoUrl, ml: game.homeMl),
                // Expanded (below the fused discs): full ML / Run Line / O/U.
                expandedStats: [
                    .init(label: "ML", value: "\(MLBFormatting.moneyline(game.awayMl)) / \(MLBFormatting.moneyline(game.homeMl))"),
                    .init(label: "Run Line", value: "\(MLBFormatting.spread(game.awaySpread)) / \(MLBFormatting.spread(game.homeSpread))"),
                    .init(label: "O/U", value: MLBFormatting.line(game.totalLine))
                ],
                // Collapsed (between the split discs): ML moves under each team,
                // so only Run Line + O/U stay centered.
                collapsedStats: [
                    .init(label: "Run Line", value: "\(MLBFormatting.spread(game.awaySpread)) / \(MLBFormatting.spread(game.homeSpread))"),
                    .init(label: "O/U", value: MLBFormatting.line(game.totalLine))
                ],
                progress: p
            )
            if (game.awaySpName != nil || game.homeSpName != nil), detail > 0.04 {
                startingPitchersRow
                    .opacity(detail)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .frame(maxWidth: .infinity, alignment: .top)
    }

    /// Build a `MatchupGlassHero.Side` from MLB team fields, resolving the
    /// team's colors from the shared `MLBTeams` table.
    private func heroSide(name: String, abbr: String, logoUrl: String?, ml: Int?) -> MatchupGlassHero.Side {
        let pair = MLBTeams.colors(for: name.isEmpty ? abbr : name)
        return MatchupGlassHero.Side(
            logoURL: logoUrl,
            abbr: abbr,
            primary: Color(hex: Int(pair.primary)),
            secondary: Color(hex: Int(pair.secondary)),
            ml: ml
        )
    }

    /// Linear interpolation between expanded (`a`) and collapsed (`b`) values.
    private func heroLerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat {
        a + (b - a) * min(1, max(0, t))
    }

    @ViewBuilder
    private func heroTeamColumn(name: String, abbr: String, logoUrl: String?, size: CGFloat, nameOpacity: Double, ml: Int?, mlReveal: Double) -> some View {
        VStack(spacing: 4) {
            MLBTeamLogo(logoUrl: logoUrl, abbrev: abbr, name: name, size: size)
            Text(abbr)
                .font(.system(size: 16, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
            // One slot that cross-fades the full team name (large) → the team's
            // moneyline (collapsed). Fixed height so the column doesn't jump.
            ZStack {
                Text(name)
                    .font(.system(size: 10))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                    .opacity(nameOpacity)
                Text(MLBFormatting.moneyline(ml))
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.appTextPrimary)
                    .opacity(mlReveal)
            }
            .frame(height: 15)
        }
        .frame(width: 90)
    }

    /// Center lines column. The ML lives here in the large state and fades away
    /// on collapse (it moves to each team); the Run Line + O/U stay centered.
    @ViewBuilder
    private func heroLinesColumn(detail: Double, p: CGFloat) -> some View {
        VStack(spacing: heroLerp(6, 2, p)) {
            if detail > 0.04 {
                linesColumn(label: "ML", value: "\(MLBFormatting.moneyline(game.awayMl)) / \(MLBFormatting.moneyline(game.homeMl))")
                    .opacity(detail)
            }
            linesColumn(label: "Run Line", value: "\(MLBFormatting.spread(game.awaySpread)) / \(MLBFormatting.spread(game.homeSpread))")
            linesColumn(label: "O/U", value: MLBFormatting.line(game.totalLine))
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var topRow: some View {
        HStack(spacing: 8) {
            Text(MLBFormatting.dateLabel(game.officialDate))
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text(MLBFormatting.gameTime(game.gameTimeEt))
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .liquidGlassBackground(in: Capsule())
            Spacer()
            if let final = game.isFinalPrediction {
                let tint = final ? Color.appPrimary : Color(hex: 0xF59E0B)
                HStack(spacing: 4) {
                    if final { Image(systemName: "lock.fill").font(.system(size: 10)) }
                    Text(final ? "Final" : "Preliminary")
                        .font(.system(size: 10, weight: .bold))
                }
                .foregroundStyle(tint)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                // Subtle tint so the glass stays translucent (shows the aura)
                // and the colored label stays readable — not a solid fill.
                .liquidGlassBackground(in: Capsule(), tint: tint.opacity(0.28))
            }
        }
    }

    @ViewBuilder
    private func linesColumn(label: String, value: String) -> some View {
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
    private var startingPitchersRow: some View {
        HStack(spacing: 12) {
            startingPitcherCell(name: game.awaySpName, confirmed: game.awaySpConfirmed)
            startingPitcherCell(name: game.homeSpName, confirmed: game.homeSpConfirmed)
        }
        .padding(.top, 4)
        .overlay(
            Rectangle()
                .fill(Color.appBorder.opacity(0.4))
                .frame(height: 1),
            alignment: .top
        )
    }

    @ViewBuilder
    private func startingPitcherCell(name: String?, confirmed: Bool?) -> some View {
        HStack(spacing: 4) {
            Text("SP")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color.appTextSecondary)
            Text(name ?? "TBD")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
            Text(confirmed == true ? "✓" : "TBD")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(confirmed == true ? Color.appPrimary : Color(hex: 0xF59E0B))
        }
        // Center each pitcher within its half so it sits under its team.
        .frame(maxWidth: .infinity, alignment: .center)
    }

    // MARK: - Player props

    /// Players in this matchup that have prop pages — pulled from the shared
    /// PropsStore by `gamePk`, tappable through to their `PlayerPropDetailView`.
    @ViewBuilder
    private var playerPropsSection: some View {
        MLBMatchupPropsWidget(
            game: game,
            namespace: propNamespace ?? fallbackPropNS,
            onSelect: onSelectProp
        )
    }

    // MARK: - Polymarket

    @ViewBuilder
    private var marketOddsSection: some View {
        let awayName = game.awayTeamName ?? game.awayTeam ?? ""
        let homeName = game.homeTeamName ?? game.homeTeam ?? ""
        WidgetCollapsingSection(title: "Market Odds", systemImage: "chart.bar.fill", iconTint: Color.appPrimary) {
            PolymarketWidget(league: "mlb", awayTeam: awayName, homeTeam: homeName)
        }
    }

    // MARK: - Projected score

    @ViewBuilder
    private var projectedScoreCard: some View {
        let fullRuns = game.fullGameRuns
        let f5Runs = game.f5Runs
        if fullRuns != nil || f5Runs != nil {
            WidgetCollapsingSection(title: "Projected Score", systemImage: "sportscourt", iconTint: Color.appPrimary) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Spacer()
                        projToggle
                    }
                    let active: (home: Double, away: Double)? = {
                        switch projView {
                        case .full:
                            return fullRuns.map { ($0.home, $0.away) }
                        case .f5:
                            return f5Runs
                        }
                    }()
                    if let active {
                        HStack(spacing: 16) {
                            HStack(spacing: 10) {
                                MLBTeamLogo(logoUrl: game.awayLogoUrl, abbrev: game.awayAbbr, name: game.awayTeamName ?? "", size: 36)
                                Text(String(format: "%.1f", active.away))
                                    .font(.system(size: 28, weight: .heavy))
                                    .foregroundStyle(Color.appTextPrimary)
                            }
                            Text("-")
                                .font(.system(size: 24, weight: .light))
                                .foregroundStyle(Color.appTextSecondary)
                            HStack(spacing: 10) {
                                Text(String(format: "%.1f", active.home))
                                    .font(.system(size: 28, weight: .heavy))
                                    .foregroundStyle(Color.appTextPrimary)
                                MLBTeamLogo(logoUrl: game.homeLogoUrl, abbrev: game.homeAbbr, name: game.homeTeamName ?? "", size: 36)
                            }
                        }
                        .frame(maxWidth: .infinity)
                    } else {
                        Text("Projection unavailable for \(projView == .full ? "full game" : "1st 5")")
                            .font(.system(size: 13))
                            .italic()
                            .foregroundStyle(Color.appTextSecondary)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var projToggle: some View {
        HStack(spacing: 2) {
            projToggleButton(label: "Full Game", isActive: projView == .full) { projView = .full }
            projToggleButton(label: "1st 5", isActive: projView == .f5) { projView = .f5 }
        }
        .padding(3)
        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private func projToggleButton(label: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: {
            withAnimation(.appQuick) { action() }
        }) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(isActive ? .white : Color.appTextSecondary)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(isActive ? Color.appPrimary : Color.clear, in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.impact(weight: .light), trigger: isActive)
    }

    // MARK: - Moneyline projection

    /// Pick side picks the higher edge if present, else the higher win prob.
    /// Same precedence as RN.
    private var mlPickSide: String? {
        let he = projView == .full ? game.homeMlEdgePct : game.f5HomeMlEdgePct
        let ae = projView == .full ? game.awayMlEdgePct : game.f5AwayMlEdgePct
        let hp = projView == .full ? game.mlHomeWinProb : game.f5HomeWinProb
        let ap = projView == .full ? game.mlAwayWinProb : game.f5AwayWinProb
        if let he, let ae { return he >= ae ? "home" : "away" }
        if let hp, let ap { return hp >= ap ? "home" : "away" }
        return nil
    }

    @ViewBuilder
    private var moneylineCard: some View {
        let pickSide = mlPickSide
        let hp = projView == .full ? game.mlHomeWinProb : game.f5HomeWinProb
        let ap = projView == .full ? game.mlAwayWinProb : game.f5AwayWinProb
        let he = projView == .full ? game.homeMlEdgePct : game.f5HomeMlEdgePct
        let ae = projView == .full ? game.awayMlEdgePct : game.f5AwayMlEdgePct
        let pickProb = (pickSide == "home") ? hp : ap
        let pickEdge = (pickSide == "home") ? he : ae

        // implied prob: prefer DB column for full; derive via identity for F5.
        let pickImplied: Double? = {
            if pickSide == "home" {
                if projView == .full, let p = game.homeImpliedProb { return p }
                if let p = hp, let e = he { return p - e / 100 }
            } else if pickSide == "away" {
                if projView == .full, let p = game.awayImpliedProb { return p }
                if let p = ap, let e = ae { return p - e / 100 }
            }
            return nil
        }()
        let strong: Bool = {
            switch (pickSide, projView) {
            case ("home", .full): return game.homeMlStrongSignal == true
            case ("away", .full): return game.awayMlStrongSignal == true
            case ("home", .f5): return game.f5HomeMlStrongSignal == true
            case ("away", .f5): return game.f5AwayMlStrongSignal == true
            default: return false
            }
        }()
        let pickAbbr = pickSide == "home" ? game.homeAbbr : game.awayAbbr

        if let pickSide, let pickProb {
            WidgetCollapsingSection(
                title: projView == .full ? "Moneyline Projection" : "1st 5 Moneyline",
                systemImage: "baseball",
                iconTint: Color.appPrimary,
                accessory: .chevron(expanded: mlExpanded),
                onHeaderTap: { mlExpanded.toggle() }
            ) {
                    VStack(alignment: .leading, spacing: 12) {
                        comparisonRow(
                            leftLabel: "Vegas",
                            leftValue: pickImplied.map { String(format: "%.1f%%", $0 * 100) } ?? "-",
                            leftColor: Color.appTextPrimary,
                            rightLabel: "Our Model",
                            rightValue: String(format: "%.1f%%", pickProb * 100),
                            rightColor: strong ? Color.appPrimary : Color(hex: 0xEAB308),
                            rightHighlight: true
                        )
                        HStack(spacing: 12) {
                            MLBTeamLogo(
                                logoUrl: pickSide == "home" ? game.homeLogoUrl : game.awayLogoUrl,
                                abbrev: pickAbbr,
                                name: pickSide == "home" ? (game.homeTeamName ?? "") : (game.awayTeamName ?? ""),
                                size: 36
                            )
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Edge to \(pickAbbr)")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Color.appTextPrimary)
                                if let pickEdge {
                                    Text("\(pickEdge >= 0 ? "+" : "")\(String(format: "%.1f", pickEdge))% delta")
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundStyle(pickEdge >= 0 ? (strong ? Color.appPrimary : Color(hex: 0xEAB308)) : Color.appAccentRed)
                                }
                            }
                            Spacer()
                            accuracyBadge(for: pickEdge, betType: projView == .full ? "full_ml" : "f5_ml", side: pickSide)
                        }
                        if mlExpanded {
                            Text(mlExplanation(pickSide: pickSide, pickProb: pickProb, implied: pickImplied, edge: pickEdge, abbr: pickAbbr))
                                .font(.system(size: 13))
                                .lineSpacing(4)
                                .foregroundStyle(Color.appTextSecondary)
                        }
                        // Fade alert — extreme edges (≥9.5%) historically
                        // fade more profitably than they follow. Mirrors the
                        // NBA/NCAAB criterion (see ticket #034). MLB RN
                        // currently omits this; the cross-sport pattern is
                        // applied here per FIDELITY-WAIVER #100.
                        if let pickEdge, abs(pickEdge) >= 9.5 {
                            FadeAlertTooltip(
                                betType: .spread,
                                suggestedBet: "\(pickSide == "home" ? game.awayAbbr : game.homeAbbr) Moneyline"
                            )
                        }
                    }
            }
        }
    }

    private func mlExplanation(pickSide: String, pickProb: Double, implied: Double?, edge: Double?, abbr: String) -> String {
        var body = "The model gives \(abbr) a \(String(format: "%.1f", pickProb * 100))% chance to win"
        if projView == .f5 { body += " through 5 innings" }
        if let implied { body += " vs Vegas implied \(String(format: "%.1f", implied * 100))%" }
        if let edge {
            body += ", a \(edge >= 0 ? "+" : "")\(String(format: "%.1f", edge))% edge."
        } else {
            body += "."
        }
        return body
    }

    // MARK: - O/U projection

    @ViewBuilder
    private var overUnderCard: some View {
        let fairTotal = projView == .full ? game.ouFairTotal : game.f5FairTotal
        let line = projView == .full ? game.totalLine : game.f5TotalLine
        let edgeRaw = projView == .full ? game.ouEdge : game.f5OuEdge
        let direction: String? = projView == .full
            ? game.ouDirection
            : edgeRaw.map { $0 >= 0 ? "OVER" : "UNDER" }

        if let direction {
            let isOver = direction == "OVER"
            let delta: String? = (fairTotal != nil && line != nil)
                ? String(format: "%.1f", abs(fairTotal! - line!))
                : nil

            WidgetCollapsingSection(
                title: projView == .full ? "Total Projection" : "1st 5 Total",
                systemImage: isOver ? "arrow.up" : "arrow.down",
                iconTint: isOver ? Color.appPrimary : Color.appAccentRed,
                accessory: .chevron(expanded: ouExpanded),
                onHeaderTap: { ouExpanded.toggle() }
            ) {
                    VStack(alignment: .leading, spacing: 12) {
                        comparisonRow(
                            leftLabel: "Vegas O/U",
                            leftValue: MLBFormatting.line(line),
                            leftColor: Color.appTextPrimary,
                            rightLabel: "Our Model",
                            rightValue: fairTotal.map { String(format: "%.1f", $0) } ?? "-",
                            rightColor: isOver ? Color.appPrimary : Color.appAccentRed,
                            rightHighlight: true
                        )
                        HStack(spacing: 12) {
                            Image(systemName: isOver ? "chevron.up" : "chevron.down")
                                .font(.system(size: 32, weight: .bold))
                                .foregroundStyle(isOver ? Color.appPrimary : Color.appAccentRed)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Edge to \(isOver ? "Over" : "Under")")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Color.appTextPrimary)
                                if let delta {
                                    Text("\(delta) pts delta")
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundStyle(isOver ? Color.appPrimary : Color.appAccentRed)
                                }
                            }
                            Spacer()
                            accuracyBadge(for: edgeRaw, betType: projView == .full ? "full_ou" : "f5_ou", direction: direction)
                        }
                        if ouExpanded {
                            Text("The model projects a fair\(projView == .f5 ? " F5" : "") total of \(fairTotal.map { String(format: "%.1f", $0) } ?? "N/A") vs the market line of \(MLBFormatting.line(line)), suggesting the \(isOver ? "Over" : "Under").")
                                .font(.system(size: 13))
                                .lineSpacing(4)
                                .foregroundStyle(Color.appTextSecondary)
                        }
                        // Same 9.5%-equivalent threshold for totals — fair
                        // total ≥ ~1.0 run from the market line earns the
                        // tooltip. RN MLB omits this; FIDELITY-WAIVER #100
                        // standardizes with the rest of the sport sheets.
                        if let edgeRaw, abs(edgeRaw) >= 9.5,
                           let line, fairTotal != nil {
                            // `fairTotal` is required as a precondition (we
                            // don't show a fade tooltip on rows missing the
                            // model's fair total), but the suggestion copy
                            // reads only from the market line. The
                            // `fairTotal != nil` guard keeps the gate without
                            // forcing an unused-binding warning inside a
                            // ViewBuilder (where the warning-suppressing
                            // `_ = fairTotal` is an expression, not a View).
                            let suggestion = isOver
                                ? "Under \(String(format: "%.1f", line))"
                                : "Over \(String(format: "%.1f", line))"
                            FadeAlertTooltip(betType: .total, suggestedBet: suggestion)
                        }
                    }
            }
        }
    }

    // MARK: - Regression report picks

    /// Pro-gated regression suggestion list. RN MLB does not wrap the
    /// section in `ProContentSection`; FIDELITY-WAIVER #100 standardizes
    /// the entitlement boundary with NFL/CFB/NBA/NCAAB sibling sheets so
    /// regression picks consistently sit behind Pro across the catalog.
    @ViewBuilder
    private var regressionPicksCard: some View {
        if let store = regressionStore {
            let picks = store.suggestedPicks(for: game.gamePk)
            if !picks.isEmpty {
                WidgetCollapsingSection(title: picks.count > 1 ? "Regression Report Picks" : "Regression Report Pick", systemImage: "chart.bar.xaxis", iconTint: Color(hex: 0xA855F7)) {
                    ProContentSection(title: "Regression Picks", minHeight: 120) {
                        MLBRegressionPicksSection(picks: picks)
                    }
                }
            }
        }
    }

    // MARK: - Signals

    /// Pro-gated signals block. Cross-sport convention: situational +
    /// trend insight lives behind the Pro entitlement. RN MLB shows the
    /// raw block — FIDELITY-WAIVER #100 brings it in line with the
    /// sibling sheets.
    @ViewBuilder
    private var signalsCard: some View {
        WidgetCollapsingSection(title: "Game Signals", systemImage: "antenna.radiowaves.left.and.right", iconTint: Color.appPrimary) {
            ProContentSection(title: "Game Signals", minHeight: 120) {
                VStack(alignment: .leading, spacing: 12) {
                    if game.signals.isEmpty {
                        Text("No supplemental betting signals for this matchup right now. Your projections and edges above are the same full model outputs — this block only adds extra situational or trend context when our system surfaces it.")
                            .font(.system(size: 12))
                            .italic()
                            .foregroundStyle(Color.appTextSecondary)
                    } else {
                        VStack(spacing: 8) {
                            ForEach(Array(game.signals.enumerated()), id: \.offset) { _, sig in
                                signalPill(signal: sig)
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func signalPill(signal: MLBSignalItem) -> some View {
        let (bg, border, text) = MLBSignalColors.colorsFor(severity: signal.severity)
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: MLBSignalColors.iconFor(category: signal.category))
                .font(.system(size: 14))
                .foregroundStyle(text)
            Text(signal.message)
                .font(.system(size: 13))
                .lineSpacing(2)
                .foregroundStyle(Color.appTextPrimary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(bg, in: RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(border, lineWidth: 1)
        )
    }

    // MARK: - Weather

    /// Pro-gated weather card. Cross-sport convention puts weather behind
    /// Pro — NFL/CFB Swift sheets and the RN equivalents already do so.
    /// RN MLB renders the card unconditionally; FIDELITY-WAIVER #100
    /// brings the entitlement gate over.
    @ViewBuilder
    private var weatherCard: some View {
        WidgetCollapsingSection(title: "Weather", systemImage: "cloud.sun", iconTint: Color.appPrimary) {
            ProContentSection(title: "Weather", minHeight: 110) {
                if game.temperatureF != nil {
                    MLBWeatherSection(game: game)
                } else {
                    Text("Weather data updates ~4 hours before game time")
                        .font(.system(size: 13))
                        .italic()
                        .foregroundStyle(Color.appTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    // MARK: - Agent rationale

    /// Renders only when the audit store has a `selectedPick` matching this
    /// game. The widget self-gates internally — we just pass the keys.
    @ViewBuilder
    private var agentRationaleCard: some View {
        AgentPickRationaleWidget(gameKeys: agentGameKeys)
    }

    // MARK: - Postponed banner

    @ViewBuilder
    private var postponedBanner: some View {
        sectionCard {
            VStack(spacing: 12) {
                Text("\(game.awayAbbr) @ \(game.homeAbbr)")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                HStack(spacing: 8) {
                    Image(systemName: "calendar.badge.exclamationmark")
                        .foregroundStyle(Color.appAccentRed)
                    Text("Postponed")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.appAccentRed)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color.appAccentRed.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    // MARK: - Shared chrome helpers

    @ViewBuilder
    private func sectionCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) { content() }
            .padding(16)
            .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.appBorder, lineWidth: 1))
    }

    /// Two-box Vegas-vs-Model comparison row. Mirrors RN
    /// `<View style={styles.comparisonRow}>...</View>`.
    @ViewBuilder
    private func comparisonRow(
        leftLabel: String, leftValue: String, leftColor: Color,
        rightLabel: String, rightValue: String, rightColor: Color, rightHighlight: Bool
    ) -> some View {
        HStack(spacing: 8) {
            comparisonBox(label: leftLabel, value: leftValue, color: leftColor, highlight: false)
            Image(systemName: "arrow.right")
                .foregroundStyle(Color.appTextSecondary)
            comparisonBox(label: rightLabel, value: rightValue, color: rightColor, highlight: rightHighlight)
        }
    }

    @ViewBuilder
    private func comparisonBox(label: String, value: String, color: Color, highlight: Bool) -> some View {
        VStack(spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(highlight ? color : color.opacity(0.7))
            Text(value)
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .padding(.horizontal, 8)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(highlight ? color.opacity(0.1) : Color.appSurfaceMuted.opacity(0.5))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(highlight ? color.opacity(0.25) : .clear, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func accuracyBadge(for edge: Double?, betType: String, side: String? = nil, direction: String? = nil) -> some View {
        if let edge, let store = accuracyStore, let data = store.data {
            let lookup = MLBBucketHelper.lookup(
                accuracy: data,
                betType: betType,
                edge: edge,
                side: side,
                direction: direction
            )
            if let lookup {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(String(format: "%.0f%%", lookup.winPct))
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.appPrimary)
                    Text(lookup.record)
                        .font(.system(size: 10))
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
        }
    }
}

// MARK: - Weather sub-section

/// Weather section with field visual, wind arrow, temp, sky, and roof
/// indicator. Mirrors RN `MLBWeatherSection`. Animation is built in via
/// `Animation.appQuick` — no raw `.spring(...)` per house rules.
struct MLBWeatherSection: View {
    let game: MLBGame
    @State private var windDegrees: Double = 0

    var body: some View {
        // Title + card chrome now live in the hosting `WidgetSection`
        // ("Weather"); keep just the venue subline + the weather cells.
        VStack(alignment: .leading, spacing: 12) {
            if let venue = game.venueName {
                Text(venue)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
            }
            HStack(spacing: 8) {
                if let temp = game.temperatureF {
                    weatherCard(
                        icon: "thermometer",
                        iconColor: Color(hex: 0xEF4444),
                        value: "\(Int(temp.rounded()))°F",
                        label: "Temp",
                        bg: Color(hex: 0xFEF2F2).opacity(0.4)
                    )
                }
                if let sky = game.sky {
                    weatherCard(
                        icon: skyIcon(sky),
                        iconColor: Color.appPrimary,
                        value: sky,
                        label: "Sky",
                        bg: Color(hex: 0xF0FDF4).opacity(0.4)
                    )
                }
                if let wind = game.windSpeedMph {
                    weatherCard(
                        icon: "arrow.up",
                        iconColor: Color.appAccentBlue,
                        value: "\(Int(wind.rounded())) mph",
                        label: game.windDirection ?? "Wind",
                        bg: Color(hex: 0xEFF6FF).opacity(0.4),
                        rotation: windDegrees
                    )
                }
                weatherCard(
                    icon: roofType(game.venueName) != nil ? "house.fill" : "diamond",
                    iconColor: Color(hex: 0x7C3AED),
                    value: roofLabel(game.venueName),
                    label: "Field",
                    bg: Color(hex: 0xF5F3FF).opacity(0.4)
                )
            }
            if game.weatherImputed == true && game.weatherConfirmed != true {
                Text("Weather is estimated — awaiting confirmed inputs")
                    .font(.system(size: 11))
                    .italic()
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity)
            }
        }
        .task {
            if let degrees = windDirectionDegrees(game.windDirection) {
                withAnimation(.easeOut(duration: 0.8)) { windDegrees = degrees }
            }
        }
    }

    @ViewBuilder
    private func weatherCard(icon: String, iconColor: Color, value: String, label: String, bg: Color, rotation: Double = 0) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 22))
                .foregroundStyle(iconColor)
                .rotationEffect(.degrees(rotation))
                .frame(height: 28)
            Text(value)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(1)
            Text(label.uppercased())
                .font(.system(size: 10, weight: .medium))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .padding(.horizontal, 4)
        .background(bg, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.appBorder.opacity(0.3), lineWidth: 1))
    }

    /// Mirrors RN `getSkyIcon` — maps a sky-condition string to a SF
    /// Symbols name closest to the MaterialCommunityIcons RN equivalent.
    private func skyIcon(_ sky: String) -> String {
        let s = sky.lowercased()
        if s.contains("rain") || s.contains("shower") { return "cloud.rain" }
        if s.contains("storm") || s.contains("thunder") { return "cloud.bolt.rain" }
        if s.contains("snow") || s.contains("flurr") { return "snowflake" }
        if s.contains("overcast") { return "cloud" }
        if s.contains("cloud") || s.contains("partly") { return "cloud.sun" }
        if s.contains("fog") || s.contains("haz") { return "cloud.fog" }
        if s.contains("clear") || s.contains("sunny") { return "sun.max" }
        return "cloud.sun"
    }

    /// Mirrors RN `getVenueRoofType` — returns "dome", "retractable", or nil.
    private func roofType(_ venue: String?) -> String? {
        guard let v = venue?.lowercased() else { return nil }
        let domes = ["tropicana field": "dome",
                     "minute maid park": "retractable",
                     "daikin park": "retractable",
                     "chase field": "retractable",
                     "globe life field": "retractable",
                     "rogers centre": "retractable",
                     "loandepot park": "retractable",
                     "t-mobile park": "retractable",
                     "american family field": "retractable",
                     "marlins park": "retractable",
                     "safeco field": "retractable",
                     "miller park": "retractable"]
        for (key, type) in domes where v.contains(key) { return type }
        return nil
    }

    private func roofLabel(_ venue: String?) -> String {
        switch roofType(venue) {
        case "dome": return "Dome"
        case "retractable": return "Dome/Roof"
        default: return "Open Air"
        }
    }

    /// Mirrors RN `windDirectionToDegrees`.
    private func windDirectionDegrees(_ dir: String?) -> Double? {
        guard let dir = dir?.uppercased().trimmingCharacters(in: .whitespaces) else { return nil }
        let map: [String: Double] = [
            "N": 0, "NNE": 22.5, "NE": 45, "ENE": 67.5,
            "E": 90, "ESE": 112.5, "SE": 135, "SSE": 157.5,
            "S": 180, "SSW": 202.5, "SW": 225, "WSW": 247.5,
            "W": 270, "WNW": 292.5, "NW": 315, "NNW": 337.5
        ]
        return map[dir]
    }
}

// MARK: - Signal colors

/// Mirrors RN `getSignalSeverityColor` + `getSignalCategoryIcon`.
enum MLBSignalColors {
    static func colorsFor(severity: String) -> (bg: Color, border: Color, text: Color) {
        switch severity {
        case "negative":
            return (Color(hex: 0xF97316).opacity(0.15), Color(hex: 0xF97316).opacity(0.35), Color(hex: 0xFB923C))
        case "positive":
            return (Color(hex: 0x22C55E).opacity(0.12), Color(hex: 0x22C55E).opacity(0.3), Color(hex: 0x4ADE80))
        case "over":
            return (Color(hex: 0xF59E0B).opacity(0.15), Color(hex: 0xF59E0B).opacity(0.35), Color(hex: 0xFBBF24))
        case "under":
            return (Color(hex: 0x3B82F6).opacity(0.15), Color(hex: 0x3B82F6).opacity(0.35), Color(hex: 0x60A5FA))
        default:
            return (Color(hex: 0x94A3B8).opacity(0.1), Color(hex: 0x94A3B8).opacity(0.25), Color(hex: 0x94A3B8))
        }
    }

    static func iconFor(category: String) -> String {
        switch category.lowercased() {
        case "pitcher": return "person.fill"
        case "bullpen": return "flame.fill"
        case "batting": return "chart.line.uptrend.xyaxis"
        case "schedule": return "calendar"
        case "weather": return "cloud.sun"
        case "park": return "mappin"
        default: return "target"
        }
    }
}

