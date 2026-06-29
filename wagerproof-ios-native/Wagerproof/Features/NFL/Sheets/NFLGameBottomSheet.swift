import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

struct NFLGameBottomSheet: View {
    let game: NFLPrediction
    var onClose: () -> Void = {}
    var showAura: Bool = true
    var heroTopInset: CGFloat = 0
    var contentBottomInset: CGFloat = 0

    @Environment(AgentPickAuditStore.self) private var auditStore
    @Environment(\.colorScheme) private var colorScheme

    @State private var picks: [NFLDryrunPickRow] = []
    @State private var signalsByKey: [String: NFLSignalDefinition] = [:]
    @State private var signalPerformanceByKey: [String: SignalPerformance] = [:]
    @State private var teamTrendsByAbbr: [String: NFLTeamTrendRow] = [:]
    @State private var matchupHistory: [NFLMatchupHistoryRow] = []
    @State private var selectedSignal: NFLSignalDefinition?
    @State private var selectedTrendDetail: NFLTrendDetailSelection?

    private var awayColors: TeamColorPair { NFLTeamColors.colorPair(for: game.awayTeam) }
    private var homeColors: TeamColorPair { NFLTeamColors.colorPair(for: game.homeTeam) }
    private var awayAbbr: String { game.awayAb ?? NFLTeamAssets.abbr(for: game.awayTeam) }
    private var homeAbbr: String { game.homeAb ?? NFLTeamAssets.abbr(for: game.homeTeam) }

    var body: some View {
        CollapsingWidgetScroll(
            heroMaxHeight: hasWeather ? 246 : 206,
            heroMinHeight: 122,
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
            predictionSections
            matchupHistorySection
            AgentPickRationaleWidget(gameKeys: [game.trainingKey, game.uniqueId, "\(game.awayTeam)_\(game.homeTeam)"])
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
        }
        .background(showAura ? Color.appSurface : Color.clear)
        .toolbarBackground(.hidden, for: .navigationBar)
        .presentationDetents([.fraction(0.85), .large])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.disabled)
        .task(id: game.gameId) {
            await loadDryrunData()
        }
        .sheet(item: $selectedSignal) { signal in
            signalDefinitionSheet(signal)
        }
        .sheet(item: $selectedTrendDetail) { selection in
            trendDetailSheet(selection)
        }
        .onDisappear {
            auditStore.clear()
        }
    }

    // MARK: - Hero

    /// Matchup hero — same format as `MLBGameBottomSheet.heroView`: date/time
    /// row on top of a `MatchupGlassHero` (fused liquid-glass team discs that
    /// flow apart as the hero collapses). Expanded shows full ML / Spread /
    /// O/U stacked under the discs; collapsed keeps Spread + O/U centered
    /// while each team's ML moves under its disc. The weather row (when the
    /// game has weather data) fades in below the discs while expanded.
    @ViewBuilder
    private func heroView(progress p: CGFloat) -> some View {
        let detail = Double(max(0, 1 - p * 1.9))
        VStack(spacing: heroLerp(12, 6, p)) {
            topRow
            MatchupGlassHero(
                away: heroSide(team: game.awayTeam, ml: game.awayMl),
                home: heroSide(team: game.homeTeam, ml: game.homeMl),
                expandedStats: [
                    .init(label: "ML", value: "\(GameCardFormatting.formatMoneyline(game.awayMl)) / \(GameCardFormatting.formatMoneyline(game.homeMl))"),
                    .init(label: "Spread", value: "\(GameCardFormatting.formatSpread(game.awaySpread)) / \(GameCardFormatting.formatSpread(game.homeSpread))"),
                    .init(label: "O/U", value: GameCardFormatting.roundToNearestHalf(game.overLine))
                ],
                collapsedStats: [
                    .init(label: "Spread", value: "\(GameCardFormatting.formatSpread(game.awaySpread)) / \(GameCardFormatting.formatSpread(game.homeSpread))"),
                    .init(label: "O/U", value: GameCardFormatting.roundToNearestHalf(game.overLine))
                ],
                progress: p
            )
            if detail > 0.08, hasWeather {
                heroWeatherRow
                    .opacity(detail)
                    .padding(.top, 2)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .frame(maxWidth: .infinity, alignment: .top)
    }

    /// Build a `MatchupGlassHero.Side` from an NFL team string — logo + abbr
    /// from the `nfl_teams` reference table, colors from the static map.
    private func heroSide(team: String, ml: Int?) -> MatchupGlassHero.Side {
        let pair = NFLTeamColors.colorPair(for: team)
        return MatchupGlassHero.Side(
            logoURL: NFLTeamAssets.logo(for: team),
            abbr: NFLTeamAssets.abbr(for: team),
            primary: pair.primary,
            secondary: pair.secondary,
            ml: ml
        )
    }

    private func heroLerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat {
        a + (b - a) * min(1, max(0, t))
    }

    @ViewBuilder
    private var topRow: some View {
        HStack(spacing: 8) {
            Spacer(minLength: 0)
            Text(GameCardFormatting.formatCompactDate(game.kickoff ?? game.gameDate))
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text(GameCardFormatting.convertTimeToEST(game.kickoff ?? game.gameTime))
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .liquidGlassBackground(in: Capsule())
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private var heroWeatherRow: some View {
        HStack(spacing: 8) {
            if game.wxIndoors == true {
                weatherChip(systemImage: "building.2.crop.circle", title: "Indoor", value: game.wxSummary ?? "Game in Dome/Indoor", tint: Color.appAccentBlue)
            } else {
                if let condition = weatherConditionDisplay {
                    weatherConditionChip(systemImage: condition.icon, text: condition.title, tint: condition.tint)
                }
                if let temp = game.wxTempF {
                    weatherChip(systemImage: "thermometer.medium", title: "Temp", value: "\(Int(temp.rounded()))°F", tint: temperatureTint(temp))
                }
                if let wind = game.wxWindMph {
                    weatherChip(systemImage: "wind", title: "Wind", value: "\(Int(wind.rounded())) mph", tint: wind >= 15 ? Color.appAccentAmber : Color.appAccentBlue)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private func weatherConditionChip(systemImage: String, text: String, tint: Color) -> some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 17, weight: .bold))
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(tint)
            Text(text)
                .font(.system(size: 13, weight: .black, design: .rounded))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(tint.opacity(0.12), in: Capsule())
        .overlay(Capsule().stroke(tint.opacity(0.22), lineWidth: 1))
    }

    private func weatherChip(systemImage: String, title: String, value: String, tint: Color) -> some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(tint)
            VStack(alignment: .leading, spacing: 1) {
                Text(title.uppercased())
                    .font(.system(size: 8, weight: .heavy))
                    .tracking(0.5)
                    .foregroundStyle(Color.appTextSecondary)
                Text(value)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(tint.opacity(0.12), in: Capsule())
        .overlay(Capsule().stroke(tint.opacity(0.22), lineWidth: 1))
    }

    private var hasWeather: Bool {
        game.wxIndoors == true || game.wxSummary != nil || game.wxTempF != nil || game.wxWindMph != nil
    }

    private var weatherConditionDisplay: (icon: String, title: String, tint: Color)? {
        let icon = (game.wxIcon ?? "").lowercased()
        let summary = game.wxSummary?.lowercased() ?? ""
        let key = icon.isEmpty ? summary : icon
        if key.contains("indoor") || key.contains("dome") { return ("building.2.crop.circle", "Indoor", Color.appAccentBlue) }
        if key.contains("thunder") || key.contains("storm") { return ("cloud.bolt.rain.fill", "Storms", Color.appAccentAmber) }
        if key.contains("rain") || key.contains("shower") { return ("cloud.rain.fill", "Rain", Color.appAccentBlue) }
        if key.contains("snow") || key.contains("sleet") { return ("cloud.snow.fill", "Snow", Color.appAccentBlue) }
        if key.contains("fog") || key.contains("mist") { return ("cloud.fog.fill", "Fog", Color.appTextSecondary) }
        if key.contains("wind") { return ("wind", "Windy", Color.appAccentAmber) }
        if key.contains("cold") { return ("snowflake", "Cold", Color.appAccentBlue) }
        if key.contains("cloud") || key.contains("overcast") { return ("cloud.fill", "Cloudy", Color.appTextSecondary) }
        if key.contains("partly") { return ("cloud.sun.fill", "Partly", Color.appAccentAmber) }
        if key.contains("clear") || key.contains("sun") { return ("sun.max.fill", "Clear", Color.appAccentAmber) }
        return icon.isEmpty && summary.isEmpty ? nil : ("cloud.sun.fill", "Weather", Color.appAccentBlue)
    }

    private func temperatureTint(_ temp: Double) -> Color {
        if temp <= 35 { return Color.appAccentBlue }
        if temp >= 80 { return Color.appAccentRed }
        return Color.appAccentAmber
    }

    // MARK: - Prediction Cards

    @ViewBuilder
    private var predictionSections: some View {
        let groups = groupedPicks
        if groups.isEmpty {
            WidgetCollapsingSection(title: "NFL Predictions", systemImage: "football.fill", iconTint: Color.appPrimary) {
                ProContentSection(title: "NFL Predictions", minHeight: 88) {
                    ContentUnavailableView("No dry-run picks", systemImage: "football", description: Text("Picks load from nfl_dryrun_picks for this game."))
                }
            }
        } else {
            ForEach(groups) { group in
                marketSection(group)
            }
        }
    }

    @ViewBuilder
    private func marketSection(_ group: NFLPickGroup) -> some View {
        WidgetCollapsingSection(
            title: group.title,
            systemImage: group.systemImage,
            iconTint: group.tint,
            showsHeader: false,
            bodyPadding: 14
        ) {
            ProContentSection(title: group.title, minHeight: 154) {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(group.picks) { pick in
                        pickRow(pick, group: group)
                    }
                    if let trendKind = trendKind(for: group.cardGroup) {
                        teamTrendStrip(kind: trendKind, group: group)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func pickRow(_ pick: NFLDryrunPickRow, group: NFLPickGroup) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                sectionHeaderIcon(for: pick, group: group)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(group.title)
                            .font(.system(size: 11, weight: .heavy))
                            .tracking(0.6)
                            .foregroundStyle(Color.appTextSecondary)
                        Spacer(minLength: 8)
                        recommendationBadge(pick)
                    }
                    pickHeaderLabel(pick)
                    if pick.displayOnly == true {
                        displayOnlyBadge
                    }
                }
            }

            if !isMoneylineCard(pick) {
                metricGrid(pick)
            }

            if hasBestBook(pick) {
                bestBookRow(pick)
            }

            signalGroups(keys: pick.signalKeys, pick: pick)
        }
        .padding(12)
        .background(rowBackground(pick), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(rowStroke(pick), lineWidth: pick.hasPlay == true ? 1.2 : 0.8)
        )
    }

    @ViewBuilder
    private func pickHeaderLabel(_ pick: NFLDryrunPickRow) -> some View {
        if shouldShowTeamHeader(for: pick), let team = pick.pickTeam {
            HStack(spacing: 8) {
                GameCardTeamAvatar(teamName: team, sport: "nfl", size: 28, colors: NFLTeamColors.colorPair(for: team))
                Text(teamPickHeaderText(pick, team: team))
                    .font(.system(size: 20, weight: .black, design: .rounded))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.74)
            }
        } else if isTotalHeader(for: pick), let direction = overUnderDirection(for: pick) {
            HStack(spacing: 8) {
                Image(systemName: direction == "UNDER" ? "arrow.down.circle.fill" : "arrow.up.circle.fill")
                    .font(.system(size: 24, weight: .black))
                    .foregroundStyle(direction == "UNDER" ? Color.appAccentRed : Color.appPrimary)
                Text(displayPickLabel(pick))
                    .font(.system(size: 20, weight: .black, design: .rounded))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.74)
            }
        } else {
            Text(displayPickLabel(pick))
                .font(.system(size: 19, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(2)
                .minimumScaleFactor(0.78)
        }
    }

    @ViewBuilder
    private func moneylinePickSummary(_ pick: NFLDryrunPickRow) -> some View {
        HStack(spacing: 10) {
            if let team = pick.pickTeam {
                GameCardTeamAvatar(teamName: team, sport: "nfl", size: 38, colors: NFLTeamColors.colorPair(for: team))
                VStack(alignment: .leading, spacing: 2) {
                    Text(team)
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                    Text(pick.cardGroup == "h1_ml" ? "1H ML" : "ML")
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(Color.appTextSecondary)
                }
                Spacer()
                Text(GameCardFormatting.formatMoneyline(pick.bestOdds.map { Int($0.rounded()) } ?? pick.vegasPrice.map { Int($0.rounded()) }))
                    .font(.system(size: 17, weight: .black, design: .monospaced))
                    .foregroundStyle(Color.appPrimary)
            }
        }
        .padding(10)
        .background(Color.appSurfaceMuted.opacity(0.45), in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func sectionHeaderIcon(for pick: NFLDryrunPickRow, group: NFLPickGroup) -> some View {
        Image(systemName: group.systemImage)
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(group.tint)
            .frame(width: 34, height: 34)
            .background(group.tint.opacity(0.12), in: Circle())
    }

    @ViewBuilder
    private func recommendationBadge(_ pick: NFLDryrunPickRow) -> some View {
        Text(pick.recommendation ?? "No Bet")
            .font(.system(size: 10, weight: .heavy))
            .foregroundStyle(pick.hasPlay == true ? convictionColor(pick.conviction) : Color.appTextSecondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background((pick.hasPlay == true ? convictionColor(pick.conviction) : Color.appTextSecondary).opacity(0.12), in: Capsule())
            .overlay(Capsule().stroke((pick.hasPlay == true ? convictionColor(pick.conviction) : Color.appTextSecondary).opacity(0.22), lineWidth: 1))
    }

    private var displayOnlyBadge: some View {
        Text("Display Only")
            .font(.system(size: 9, weight: .heavy))
            .foregroundStyle(Color.appTextSecondary)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Color.appSurfaceMuted.opacity(0.55), in: Capsule())
    }

    @ViewBuilder
    private func metricGrid(_ pick: NFLDryrunPickRow) -> some View {
        if pick.cardGroup == "moneyline" || pick.cardGroup == "h1_ml" {
            metricBox(label: "Best Odds", value: GameCardFormatting.formatMoneyline(pick.bestOdds.map { Int($0.rounded()) }), tint: Color.appAccentBlue, highlighted: true)
        } else {
            HStack(spacing: 10) {
                metricBox(label: lineLabel(for: pick), value: formatPickLine(pick.bestLine ?? pick.vegasLine, pick: pick), tint: Color.appTextPrimary)
                Image(systemName: "arrow.right")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.appTextMuted)
                metricBox(label: modelLabel(for: pick), value: modelMetricValue(for: pick), tint: Color.appPrimary, highlighted: true)
            }
        }
    }

    private func isMoneylineCard(_ pick: NFLDryrunPickRow) -> Bool {
        pick.cardGroup == "moneyline" || pick.cardGroup == "h1_ml"
    }

    private func metricBox(label: String, value: String, tint: Color, highlighted: Bool = false) -> some View {
        VStack(spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .black))
                .tracking(0.6)
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 20, weight: .black, design: .rounded))
                .foregroundStyle(tint)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 11)
        .background(highlighted ? tint.opacity(0.14) : Color.appSurfaceElevated.opacity(0.65), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke((highlighted ? tint : Color.appBorder).opacity(0.25), lineWidth: 0.8))
    }

    @ViewBuilder
    private func bestBookRow(_ pick: NFLDryrunPickRow) -> some View {
        HStack(spacing: 10) {
            sportsbookLogo(pick)
            VStack(alignment: .leading, spacing: 2) {
                Text("Best Book")
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Color.appTextSecondary)
                Text(pick.bestBookName ?? pick.bestBook ?? "Best Available")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            Spacer()
            Text(bestBookValue(pick))
                .font(.system(size: 15, weight: .heavy, design: .monospaced))
                .foregroundStyle(Color.appPrimary)
        }
        .padding(10)
        .background(Color.appPrimary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.appPrimary.opacity(0.18), lineWidth: 1))
    }

    @ViewBuilder
    private func sportsbookLogo(_ pick: NFLDryrunPickRow) -> some View {
        if let logo = pick.bestBookLogo, let imageURL = URL(string: logo) {
            AsyncImage(url: imageURL) { phase in
                switch phase {
                case .success(let image):
                    bookLogoImage(image)
                case .failure:
                    fallbackSportsbookLogo(pick)
                case .empty:
                    ProgressView()
                        .scaleEffect(0.55)
                        .frame(width: 30, height: 30)
                        .padding(4)
                        .background(Color.white.opacity(colorScheme == .dark ? 0.92 : 1), in: RoundedRectangle(cornerRadius: 8))
                @unknown default:
                    fallbackSportsbookLogo(pick)
                }
            }
        } else {
            fallbackSportsbookLogo(pick)
        }
    }

    @ViewBuilder
    private func fallbackSportsbookLogo(_ pick: NFLDryrunPickRow) -> some View {
        if let fallbackURL = sportsbookFallbackURL(for: pick) {
            AsyncImage(url: fallbackURL) { phase in
                switch phase {
                case .success(let image):
                    bookLogoImage(image)
                default:
                    bookFallbackLogo(pick.bestBookName)
                }
            }
        } else {
            bookFallbackLogo(pick.bestBookName)
        }
    }

    private func bookLogoImage(_ image: Image) -> some View {
        image
            .resizable()
            .scaledToFit()
            .frame(width: 30, height: 30)
            .padding(4)
            .background(Color.white.opacity(colorScheme == .dark ? 0.92 : 1), in: RoundedRectangle(cornerRadius: 8))
    }

    private func bookFallbackLogo(_ name: String?) -> some View {
        Text(String((name ?? "B").prefix(1)).uppercased())
            .font(.system(size: 13, weight: .black))
            .foregroundStyle(Color.appSurface)
            .frame(width: 38, height: 38)
            .background(Color.appTextPrimary, in: RoundedRectangle(cornerRadius: 8))
    }

    @ViewBuilder
    private func signalGroups(keys: [String], pick: NFLDryrunPickRow) -> some View {
        let resolved = signalDisplays(keys: keys, pick: pick)
        if !resolved.isEmpty {
            let supporting = resolved.filter { $0.stance != "counter" }
            let contradicting = resolved.filter { $0.stance == "counter" }
            VStack(alignment: .leading, spacing: 9) {
                if !supporting.isEmpty {
                    signalGroup(title: "Supports this pick", signals: supporting, muted: false)
                }
                if !contradicting.isEmpty {
                    signalGroup(title: "Contradicts this pick", signals: contradicting, muted: true)
                }
            }
        }
    }

    private func signalGroup(title: String, signals: [NFLSignalDisplay], muted: Bool) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(.system(size: 9, weight: .black))
                .foregroundStyle(muted ? Color.appAccentAmber : Color.appTextMuted)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 118), spacing: 7)], alignment: .leading, spacing: 7) {
                ForEach(signals) { signalButton($0, muted: muted) }
            }
        }
    }

    private func signalButton(_ signal: NFLSignalDisplay, muted: Bool) -> some View {
        let color = muted ? Color.appAccentAmber : Color.appAccentBlue
        return Button {
            selectedSignal = signalContextDefinition(signal)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "info.circle.fill")
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(color)
                VStack(alignment: .leading, spacing: 2) {
                    Text(signal.displayName)
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(color)
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                    Text(signal.action ?? signal.team ?? "Tap for details")
                        .font(.system(size: 8, weight: .heavy))
                        .foregroundStyle(color.opacity(0.72))
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.up.forward")
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(Color.appSurface)
                    .frame(width: 18, height: 18)
                    .background(color, in: Circle())
            }
            .padding(.leading, 10)
            .padding(.trailing, 7)
            .padding(.vertical, 8)
            .background(color.opacity(muted ? 0.12 : 0.18), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(color.opacity(muted ? 0.55 : 0.46), lineWidth: 1.1))
            .shadow(color: color.opacity(0.16), radius: 6, x: 0, y: 3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func signalContextDefinition(_ signal: NFLSignalDisplay) -> NFLSignalDefinition {
        let definition = signal.definition
        return NFLSignalDefinition(
                signalKey: signal.key,
                displayName: signal.displayName,
                oneLiner: definition?.oneLiner ?? signal.action ?? signal.team,
                definition: definition?.definition,
                whyItWorks: definition?.whyItWorks,
                betDirection: signal.action ?? signal.label ?? definition?.betDirection,
                typicalHit: definition?.typicalHit ?? signal.tier
        )
    }

    // MARK: - Trends

    @ViewBuilder
    private func teamTrendStrip(kind: NFLTrendKind, group: NFLPickGroup) -> some View {
        let trends = trendRows(for: group)
        if !trends.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Team Trends")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Color.appTextSecondary)
                HStack(alignment: .top, spacing: 8) {
                    ForEach(trends) { trend in
                        trendCard(trend, kind: kind)
                    }
                }
            }
        }
    }

    private func trendRows(for group: NFLPickGroup) -> [NFLTeamTrendRow] {
        if group.cardGroup == "team_total" {
            return group.picks.compactMap { pick in
                guard let abbr = teamAbbr(forTeamName: pick.pickTeam) else { return nil }
                return teamTrendsByAbbr[abbr]
            }
        }
        return [teamTrendsByAbbr[awayAbbr], teamTrendsByAbbr[homeAbbr]].compactMap { $0 }
    }

    @ViewBuilder
    private func trendCard(_ trend: NFLTeamTrendRow, kind: NFLTrendKind) -> some View {
        Button {
            selectedTrendDetail = NFLTrendDetailSelection(team: trend, kind: kind)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    GameCardTeamAvatar(teamName: trend.teamAbbr, sport: "nfl", size: 22, colors: NFLTeamColors.colorPair(for: trend.teamAbbr))
                    Text(trend.teamAbbr)
                        .font(.system(size: 12, weight: .heavy))
                        .foregroundStyle(Color.appTextPrimary)
                    Spacer()
                    Image(systemName: "chevron.up.forward")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(Color.appTextSecondary)
                }
                Text(trendSeasonText(trend, kind: kind))
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                HStack(spacing: 4) {
                    Text("L\(lastChips(trend, kind: kind).count)")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(Color.appTextSecondary)
                    ForEach(Array(lastChips(trend, kind: kind).enumerated()), id: \.offset) { _, chip in
                        trendResultChip(chip)
                    }
                }
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.appSurfaceMuted.opacity(0.45), in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.08), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func trendResultChip(_ raw: String) -> some View {
        let value = raw.uppercased()
        return Text(value)
            .font(.system(size: 9, weight: .heavy))
            .frame(width: 21, height: 21)
            .foregroundStyle(.white)
            .background(trendChipColor(value), in: Circle())
    }

    @ViewBuilder
    private func trendDetailSheet(_ selection: NFLTrendDetailSelection) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .center, spacing: 14) {
                    HStack(spacing: 10) {
                        GameCardTeamAvatar(teamName: selection.team.teamAbbr, sport: "nfl", size: 38, colors: NFLTeamColors.colorPair(for: selection.team.teamAbbr))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(selection.team.teamAbbr) \(selection.kind.title)")
                                .font(.system(size: 18, weight: .heavy))
                                .foregroundStyle(Color.appTextPrimary)
                            Text("Season game log, newest first")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 16)

                    VStack(spacing: 0) {
                        trendDetailHeader(kind: selection.kind)
                        ForEach(detailRows(selection)) { row in
                            trendDetailRow(row, kind: selection.kind)
                        }
                    }
                    .padding(.horizontal, 10)
                }
                .padding(.vertical, 16)
            }
            .background(Color.appSurface.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { selectedTrendDetail = nil }
                }
            }
        }
    }

    @ViewBuilder
    private func trendDetailHeader(kind: NFLTrendKind) -> some View {
        HStack(spacing: 7) {
            tableHeader("Date", width: 42)
            tableHeader("Opp", width: 92, alignment: .leading)
            tableHeader(kind.lineHeader, width: 50)
            tableHeader(kind.resultHeader, width: 42)
            tableHeader(kind.marginHeader, width: 58)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 8)
        .background(Color.appSurfaceMuted.opacity(0.7), in: RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private func trendDetailRow(_ row: NFLTrendGameDetailRow, kind: NFLTrendKind) -> some View {
        HStack(spacing: 7) {
            tableValue(trendDateText(row.date), width: 42)
            HStack(spacing: 4) {
                Text(row.locationMarker)
                    .font(.system(size: row.locationMarker == "(n)" ? 8 : 11, weight: .heavy))
                    .frame(width: 16, alignment: .trailing)
                    .foregroundStyle(Color.appTextSecondary)
                GameCardTeamAvatar(teamName: row.opponent, sport: "nfl", size: 20, colors: NFLTeamColors.colorPair(for: row.opponent))
                Text(row.opponent)
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(width: 92, alignment: .leading)
            tableValue(row.lineText, width: 50)
            trendResultChip(row.result)
                .frame(width: 42)
            tableValue(formatSigned(row.margin), width: 58, color: marginColor(row.margin))
        }
        .padding(.vertical, 9)
        .padding(.horizontal, 8)
        .background(Color.appSurface.opacity(0.55), in: RoundedRectangle(cornerRadius: 10))
    }

    private func tableHeader(_ text: String, width: CGFloat, alignment: Alignment = .center) -> some View {
        Text(text.uppercased())
            .font(.system(size: 9, weight: .heavy))
            .foregroundStyle(Color.appTextSecondary)
            .frame(width: width, alignment: alignment)
    }

    private func tableValue(_ text: String, width: CGFloat, color: Color = Color.appTextPrimary) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(color)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .frame(width: width)
    }

    // MARK: - Matchup History

    @ViewBuilder
    private var matchupHistorySection: some View {
        WidgetCollapsingSection(title: "Matchup History", systemImage: "person.2.fill", iconTint: Color.appAccentBlue, bodyPadding: 14) {
            ProContentSection(title: "Matchup History", minHeight: matchupHistory.isEmpty ? 80 : 220) {
                VStack(alignment: .leading, spacing: 10) {
                    if matchupHistory.isEmpty {
                        Text("No recent head-to-head games found.")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 18)
                    } else {
                        ForEach(matchupHistory) { row in
                            matchupHistoryRow(row)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func matchupHistoryRow(_ row: NFLMatchupHistoryRow) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(matchupHistoryDateLabel(row))
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundStyle(Color.appTextSecondary)
                Spacer()
                if row.neutralSite == true {
                    Text("Neutral")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(Color.appAccentBlue)
                }
            }
            HStack(spacing: 8) {
                matchupTeam(row.awayTeam, score: row.awayScore)
                Text("@")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(Color.appTextSecondary)
                matchupTeam(row.homeTeam, score: row.homeScore)
                Spacer()
                Text("Total \(row.totalPoints ?? ((row.awayScore ?? 0) + (row.homeScore ?? 0)))")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            HStack(spacing: 6) {
                historyPill("Winner", row.winnerTeam ?? "—", color: Color.appPrimary)
                historyPill("Covered", row.coverTeam ?? row.atsResult ?? "Push", color: row.coverTeam == nil ? Color.appTextSecondary : Color(hex: 0x22C55E))
                historyPill("O/U", row.ouResult ?? "—", color: ouColor(row.ouResult))
            }
            HStack(spacing: 8) {
                Text("Spread \(GameCardFormatting.formatSpread(row.closingSpreadHome))")
                Text("Total \(GameCardFormatting.roundToNearestHalf(row.closingTotal))")
                Text("ML \(GameCardFormatting.formatMoneyline(row.closingMlAway)) / \(GameCardFormatting.formatMoneyline(row.closingMlHome))")
            }
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(Color.appTextSecondary)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        }
        .padding(11)
        .background(Color.appSurfaceMuted.opacity(0.4), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.08), lineWidth: 1))
    }

    @ViewBuilder
    private func matchupTeam(_ abbr: String, score: Int?) -> some View {
        HStack(spacing: 6) {
            GameCardTeamAvatar(teamName: abbr, sport: "nfl", size: 24, colors: NFLTeamColors.colorPair(for: abbr))
            Text(abbr)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
            Text(score.map(String.init) ?? "—")
                .font(.system(size: 14, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.appTextPrimary)
        }
    }

    private func historyPill(_ label: String, _ value: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 8, weight: .heavy))
                .foregroundStyle(Color.appTextSecondary)
            Text(value.uppercased())
                .font(.system(size: 10, weight: .heavy))
                .foregroundStyle(color)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 5)
        .background(color.opacity(0.1), in: Capsule())
    }

    // MARK: - Data

    private func loadDryrunData() async {
        guard (game.runId ?? "").localizedCaseInsensitiveContains("dryrun") else { return }
        await NFLTeamsService.shared.ensureLoaded()
        let cfb = await CFBSupabase.shared.client

        async let picksTask: [NFLDryrunPickRow] = ((try? await cfb
            .from("nfl_dryrun_picks")
            .select()
            .eq("game_id", value: game.gameId)
            .order("sort_order", ascending: true)
            .execute()
            .value) ?? [])

        async let signalsTask: [NFLSignalDefinition] = ((try? await cfb
            .from("nfl_signal_defs")
            .select()
            .execute()
            .value) ?? [])

        async let trendsTask: [NFLTeamTrendRow] = ((try? await cfb
            .from("nfl_team_trends")
            .select()
            .in("team_abbr", values: [awayAbbr, homeAbbr])
            .execute()
            .value) ?? [])

        async let historyTask: [NFLMatchupHistoryRow] = ((try? await cfb
            .from("nfl_matchup_history")
            .select()
            .eq("matchup_key", value: [awayAbbr, homeAbbr].sorted().joined(separator: "|"))
            .order("date", ascending: false)
            .limit(5)
            .execute()
            .value) ?? [])

        async let performanceTask = SignalPerformanceService.shared.performances(
            for: .nfl,
            season: game.season ?? 2025
        )

        let loadedPicks = await picksTask
        let loadedSignals = await signalsTask
        let loadedTrends = await trendsTask
        let loadedHistory = await historyTask

        picks = loadedPicks
        signalsByKey = Dictionary(uniqueKeysWithValues: loadedSignals.map { ($0.signalKey, $0) })
        signalPerformanceByKey = await performanceTask
        teamTrendsByAbbr = Dictionary(uniqueKeysWithValues: loadedTrends.map { ($0.teamAbbr, $0) })
        matchupHistory = loadedHistory
    }

    private var groupedPicks: [NFLPickGroup] {
        let order = ["spread", "total", "team_total", "moneyline", "h1_spread", "h1_total", "h1_ml"]
        return order.compactMap { group in
            let rows = picks.filter { $0.cardGroup == group }.sorted { ($0.sortOrder ?? 0) < ($1.sortOrder ?? 0) }
            guard !rows.isEmpty else { return nil }
            return NFLPickGroup(cardGroup: group, picks: rows)
        }
    }

    // MARK: - Signal Definition

    @ViewBuilder
    private func signalDefinitionSheet(_ signal: NFLSignalDefinition) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text(signal.displayName ?? signal.signalKey)
                        .font(.system(size: 22, weight: .heavy))
                        .foregroundStyle(Color.appTextPrimary)
                    if let one = signal.oneLiner {
                        Text(one)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.appPrimary)
                    }
                    signalBlock("Definition", signal.definition)
                    signalBlock("Why It Works", signal.whyItWorks)
                    signalBlock("Bet Direction", signal.betDirection)
                    SignalPerformanceStatsSection(
                        backtestHit: signal.typicalHit,
                        seasonDisplay: SignalSeasonRecordDisplay(
                            performance: signalPerformanceByKey[signal.signalKey]
                        )
                    )
                }
                .padding(18)
            }
            .background(Color.appSurface.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { selectedSignal = nil }
                }
            }
        }
    }

    @ViewBuilder
    private func signalBlock(_ title: String, _ body: String?) -> some View {
        if let body, !body.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text(title.uppercased())
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Color.appTextSecondary)
                Text(body)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineSpacing(3)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.appSurfaceMuted.opacity(0.45), in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // MARK: - Formatting

    private func modelLabel(for pick: NFLDryrunPickRow) -> String {
        switch pick.cardGroup {
        case "spread", "h1_spread": return "Model Line"
        case "moneyline", "h1_ml": return "Win Prob"
        case "team_total": return "Proj Pts"
        default: return "Model"
        }
    }

    private func lineLabel(for pick: NFLDryrunPickRow) -> String {
        pick.bestLine == nil ? "Vegas Line" : "Best Line"
    }

    private func modelMetricValue(for pick: NFLDryrunPickRow) -> String {
        if pick.cardGroup == "spread" || pick.cardGroup == "h1_spread" {
            return formatPickLine(pick.modelLine ?? pick.modelNumber, pick: pick)
        }
        return formatMetric(pick.modelNumber, suffix: modelSuffix(for: pick))
    }

    private func displayPickLabel(_ pick: NFLDryrunPickRow) -> String {
        guard pick.cardGroup == "spread" || pick.cardGroup == "h1_spread" else {
            return pick.pickLabel ?? pick.recommendation ?? "No Bet"
        }
        guard let team = pick.pickTeam else {
            return pick.pickLabel ?? pick.recommendation ?? "No Bet"
        }
        let prefix = pick.cardGroup == "h1_spread" ? "\(team) 1H" : team
        return "\(prefix) \(formatPickLine(pick.bestLine ?? pick.vegasLine, pick: pick))"
    }

    private func shouldShowTeamHeader(for pick: NFLDryrunPickRow) -> Bool {
        switch pick.cardGroup {
        case "spread", "h1_spread", "team_total", "moneyline", "h1_ml":
            return pick.pickTeam != nil
        default:
            return false
        }
    }

    private func isTotalHeader(for pick: NFLDryrunPickRow) -> Bool {
        pick.cardGroup == "total" || pick.cardGroup == "h1_total"
    }

    private func overUnderDirection(for pick: NFLDryrunPickRow) -> String? {
        let side = (pick.pickSide ?? pick.pickLabel ?? "").uppercased()
        if side.contains("UNDER") { return "UNDER" }
        if side.contains("OVER") { return "OVER" }
        return nil
    }

    private func teamPickHeaderText(_ pick: NFLDryrunPickRow, team: String) -> String {
        let name = teamNickname(for: team)
        switch pick.cardGroup {
        case "spread":
            return "\(name) \(formatPickLine(pick.bestLine ?? pick.vegasLine, pick: pick))"
        case "h1_spread":
            return "\(name) 1H \(formatPickLine(pick.bestLine ?? pick.vegasLine, pick: pick))"
        case "team_total":
            if let direction = overUnderDirection(for: pick) {
                return "\(name) \(direction.capitalized) \(formatPickLine(pick.bestLine ?? pick.vegasLine, pick: pick))"
            }
            return displayPickLabel(pick).replacingOccurrences(of: team, with: name)
        case "moneyline":
            return "\(name) ML"
        case "h1_ml":
            return "\(name) 1H ML"
        default:
            return displayPickLabel(pick)
        }
    }

    private func teamNickname(for team: String) -> String {
        let abbr = NFLTeamAssets.abbr(for: team)
        if let nick = NFLTeamAssets.byAbbr[abbr]?.nick, !nick.isEmpty {
            return nick
        }
        return team.split(separator: " ").last.map(String.init) ?? team
    }

    private func modelSuffix(for pick: NFLDryrunPickRow) -> String {
        if pick.cardGroup == "moneyline" || pick.cardGroup == "h1_ml" { return "%" }
        return ""
    }

    private func formatMetric(_ value: Double?, suffix: String = "") -> String {
        guard let value else { return "—" }
        if suffix == "%" {
            return "\(Int((value * 100).rounded()))%"
        }
        return rounded(value)
    }

    private func formatPickLine(_ value: Double?, pick: NFLDryrunPickRow) -> String {
        guard let value else { return "—" }
        if pick.cardGroup == "spread" || pick.cardGroup == "h1_spread" {
            return GameCardFormatting.formatSpread(value)
        }
        return GameCardFormatting.roundToNearestHalf(value)
    }

    private func rounded(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }

    private func formatEdge(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(value >= 0 ? "+" : "")\(String(format: "%.1f", value))"
    }

    private func formatSigned(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(value >= 0 ? "+" : "")\(String(format: "%.1f", value))"
    }

    private func bestBookValue(_ pick: NFLDryrunPickRow) -> String {
        if pick.cardGroup == "moneyline" || pick.cardGroup == "h1_ml" {
            return GameCardFormatting.formatMoneyline(pick.bestOdds.map { Int($0.rounded()) })
        }
        let line = formatPickLine(pick.bestLine, pick: pick)
        let odds = GameCardFormatting.formatMoneyline(pick.bestOdds.map { Int($0.rounded()) })
        return "\(line) \(odds)"
    }

    private func hasBestBook(_ pick: NFLDryrunPickRow) -> Bool {
        pick.bestBook != nil || pick.bestBookName != nil || pick.bestBookLogo != nil || pick.bestLine != nil || pick.bestOdds != nil
    }

    private func sportsbookFallbackURL(for pick: NFLDryrunPickRow) -> URL? {
        guard let domain = sportsbookDomain(for: pick) else { return nil }
        return URL(string: "https://icons.duckduckgo.com/ip3/\(domain).ico")
            ?? URL(string: "https://www.google.com/s2/favicons?domain=\(domain)&sz=64")
    }

    private func sportsbookDomain(for pick: NFLDryrunPickRow) -> String? {
        if let key = pick.bestBook?.lowercased() {
            switch key {
            case "draftkings": return "draftkings.com"
            case "fanduel": return "fanduel.com"
            case "betmgm": return "betmgm.com"
            case "betrivers": return "betrivers.com"
            case "williamhill_us": return "caesars.com"
            case "espnbet": return "espnbet.com"
            case "fanatics": return "fanatics.com"
            case "bet365": return "bet365.com"
            case "bovada": return "bovada.lv"
            case "betonlineag": return "betonline.ag"
            case "mybookieag": return "mybookie.ag"
            case "betus": return "betus.com.pa"
            case "lowvig": return "lowvig.ag"
            default: break
            }
        }
        if let name = pick.bestBookName?.lowercased() {
            if name.contains("draftkings") { return "draftkings.com" }
            if name.contains("fanduel") { return "fanduel.com" }
            if name.contains("betmgm") { return "betmgm.com" }
            if name.contains("betrivers") { return "betrivers.com" }
            if name.contains("caesars") { return "caesars.com" }
            if name.contains("espn") { return "espnbet.com" }
            if name.contains("fanatics") { return "fanatics.com" }
        }
        if let logo = pick.bestBookLogo, let host = URL(string: logo)?.host, !host.isEmpty {
            return host
        }
        return nil
    }

    private func rowBackground(_ pick: NFLDryrunPickRow) -> Color {
        if pick.hasPlay == true, pick.isMammoth == true { return Color(hex: 0xF97316).opacity(0.12) }
        if pick.hasPlay == true { return convictionColor(pick.conviction).opacity(0.1) }
        return Color.appSurfaceMuted.opacity(0.32)
    }

    private func rowStroke(_ pick: NFLDryrunPickRow) -> Color {
        if pick.hasPlay == true, pick.isMammoth == true { return Color(hex: 0xF97316).opacity(0.45) }
        if pick.hasPlay == true { return convictionColor(pick.conviction).opacity(0.3) }
        return Color.white.opacity(0.08)
    }

    private func convictionColor(_ raw: String?) -> Color {
        switch (raw ?? "").lowercased() {
        case "mammoth": return Color(hex: 0xF97316)
        case "high": return Color(hex: 0xF97316)
        case "med", "medium": return Color.appPrimary
        case "low", "lean": return Color.appAccentBlue
        default: return Color.appTextSecondary
        }
    }

    private func signalSupportsPick(_ signal: NFLSignalDefinition, pick: NFLDryrunPickRow) -> Bool {
        let pickSide = (pick.pickSide ?? "").uppercased()
        let pickLabel = (pick.pickLabel ?? "").uppercased()
        let pickTeam = (pick.pickTeam ?? "").uppercased()
        let direction = (signal.betDirection ?? signal.oneLiner ?? signal.definition ?? "").uppercased()

        if direction.contains("FADE HOME") {
            return pickSide == "AWAY" || pickTeam == game.awayTeam.uppercased() || pickLabel.contains(awayAbbr)
        }
        if direction.contains("FADE AWAY") {
            return pickSide == "HOME" || pickTeam == game.homeTeam.uppercased() || pickLabel.contains(homeAbbr)
        }
        if direction.contains("OVER") || direction.contains("UNDER") {
            if pickSide == "OVER" || pickLabel.contains("OVER") { return direction.contains("OVER") }
            if pickSide == "UNDER" || pickLabel.contains("UNDER") { return direction.contains("UNDER") }
        }
        if direction.contains("HOME") || direction.contains("AWAY") {
            if pickSide == "HOME" { return direction.contains("HOME") && !direction.contains("FADE HOME") }
            if pickSide == "AWAY" { return direction.contains("AWAY") && !direction.contains("FADE AWAY") }
        }
        if !pickTeam.isEmpty {
            if direction.contains(game.homeTeam.uppercased()) || direction.contains(homeAbbr) {
                return pickTeam == game.homeTeam.uppercased()
            }
            if direction.contains(game.awayTeam.uppercased()) || direction.contains(awayAbbr) {
                return pickTeam == game.awayTeam.uppercased()
            }
        }

        // `signal_keys` live on the pick row, so unclassified signals are treated
        // as supporting unless their definition clearly points the other way.
        return true
    }

    private func signalDisplays(keys: [String], pick: NFLDryrunPickRow) -> [NFLSignalDisplay] {
        if !pick.signals.isEmpty {
            return pick.signals.map { row in
                let definition = signalsByKey[row.key]
                return NFLSignalDisplay(
                    key: row.key,
                    displayName: definition?.displayName ?? row.label ?? row.key,
                    team: row.team,
                    label: row.label,
                    action: row.action,
                    stance: row.stance?.lowercased() == "counter" ? "counter" : "support",
                    tier: row.tier,
                    definition: definition
                )
            }
        }

        return keys.compactMap { key in
            guard let definition = signalsByKey[key] else { return nil }
            return NFLSignalDisplay(
                key: key,
                displayName: definition.displayName ?? key,
                team: nil,
                label: nil,
                action: nil,
                stance: signalSupportsPick(definition, pick: pick) ? "support" : "counter",
                tier: nil,
                definition: definition
            )
        }
    }

    private func edgeColor(_ value: Double?) -> Color {
        guard let value else { return Color.appTextSecondary }
        if value > 0 { return Color(hex: 0x22C55E) }
        if value < 0 { return Color.appAccentRed }
        return Color.appTextSecondary
    }

    private func marginColor(_ value: Double?) -> Color {
        edgeColor(value)
    }

    private func trendChipColor(_ value: String) -> Color {
        if ["W", "O", "COVER", "OVER"].contains(value) { return Color(hex: 0x22C55E) }
        if ["L", "U", "UNDER"].contains(value) { return Color.appAccentRed }
        return Color.appTextSecondary
    }

    private func ouColor(_ raw: String?) -> Color {
        switch (raw ?? "").uppercased() {
        case "OVER": return Color(hex: 0x22C55E)
        case "UNDER": return Color.appAccentRed
        default: return Color.appTextSecondary
        }
    }

    private func trendKind(for cardGroup: String) -> NFLTrendKind? {
        switch cardGroup {
        case "spread": return .spread
        case "total": return .total
        case "team_total": return .teamTotal
        case "h1_spread": return .h1Spread
        case "h1_total": return .h1Total
        default: return nil
        }
    }

    private func trendSeasonText(_ trend: NFLTeamTrendRow, kind: NFLTrendKind) -> String {
        switch kind {
        case .spread:
            return "Season ATS \(trend.atsW ?? 0)-\(trend.atsL ?? 0)-\(trend.atsP ?? 0) \(percent(trend.atsPct))"
        case .total:
            return "Season O/U \(trend.ouO ?? 0)-\(trend.ouU ?? 0) \(percent(trend.overPct))"
        case .teamTotal:
            return "Season TT Over \(trend.ttO ?? 0)-\(trend.ttU ?? 0) \(percent(trend.ttOverPct))"
        case .moneyline:
            return "Season SU \(trend.suRecord ?? "\(trend.suW ?? 0)-\(trend.suL ?? 0)")"
        case .h1Spread:
            return "Season 1H ATS \(trend.h1AtsW ?? 0)-\(trend.h1AtsL ?? 0)-\(trend.h1AtsP ?? 0) \(percent(trend.h1AtsPct))"
        case .h1Total:
            return "Season 1H O/U \(trend.h1OuO ?? 0)-\(trend.h1OuU ?? 0) \(percent(trend.h1OverPct))"
        }
    }

    private func lastChips(_ trend: NFLTeamTrendRow, kind: NFLTrendKind) -> [String] {
        switch kind {
        case .spread, .h1Spread: return Array((kind == .spread ? trend.last5Ats : trend.gameLog.compactMap(\.h1Ats)).prefix(5))
        case .total, .h1Total: return Array((kind == .total ? trend.last5Ou : trend.gameLog.compactMap(\.h1Ou)).prefix(5))
        case .teamTotal: return Array(trend.gameLog.compactMap(\.tt).prefix(5))
        case .moneyline: return Array(trend.last5Su.prefix(5))
        }
    }

    private func detailRows(_ selection: NFLTrendDetailSelection) -> [NFLTrendGameDetailRow] {
        selection.team.gameLog.compactMap { log in
            let result: String?
            let line: Double?
            let margin: Double?
            switch selection.kind {
            case .spread:
                result = log.ats
                line = log.spread
                margin = log.coverMargin
            case .total:
                result = log.ou
                line = log.total
                margin = log.ouMargin
            case .teamTotal:
                result = log.tt
                line = log.ttLine
                margin = log.ttMargin
            case .moneyline:
                result = log.su
                line = nil
                margin = nil
            case .h1Spread:
                result = log.h1Ats
                line = log.h1Spread
                margin = log.h1CoverMargin
            case .h1Total:
                result = log.h1Ou
                line = log.h1Total
                margin = log.h1OuMargin
            }
            guard let result, !result.isEmpty else { return nil }
            return NFLTrendGameDetailRow(
                date: log.date,
                opponent: log.opp ?? "",
                locationMarker: log.isHome == false ? "@" : "",
                lineText: line.map { GameCardFormatting.roundToNearestHalf($0) } ?? "—",
                result: result,
                margin: margin
            )
        }
    }

    private func teamAbbr(forTeamName team: String?) -> String? {
        guard let team else { return nil }
        if team == game.homeTeam { return homeAbbr }
        if team == game.awayTeam { return awayAbbr }
        return NFLTeamAssets.abbr(for: team)
    }

    private func percent(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(Int((value * 100).rounded()))%"
    }

    private func trendDateText(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "—" }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        for pattern in ["yyyy-MM-dd", "yyyy-MM-dd HH:mm:ss"] {
            fmt.dateFormat = pattern
            if let date = fmt.date(from: raw) {
                let out = DateFormatter()
                out.locale = Locale(identifier: "en_US_POSIX")
                out.dateFormat = "MM/dd"
                return out.string(from: date)
            }
        }
        return shortDate(raw)
    }

    private func shortDate(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "—" }
        if raw.count >= 10 {
            let monthStart = raw.index(raw.startIndex, offsetBy: 5)
            let dayEnd = raw.index(raw.startIndex, offsetBy: 10)
            return raw[monthStart..<dayEnd].replacingOccurrences(of: "-", with: "/")
        }
        return raw
    }

    private func matchupHistoryDateLabel(_ row: NFLMatchupHistoryRow) -> String {
        let season = row.season.map(String.init) ?? seasonFromDate(row.date)
        guard let season else { return shortDate(row.date) }
        return "\(season) Season - \(shortDate(row.date))"
    }

    private func seasonFromDate(_ raw: String?) -> String? {
        guard let raw, raw.count >= 4 else { return nil }
        return String(raw.prefix(4))
    }
}

private struct NFLPickGroup: Identifiable {
    var id: String { cardGroup }
    let cardGroup: String
    let picks: [NFLDryrunPickRow]

    var title: String {
        switch cardGroup {
        case "spread": return "Spread Prediction"
        case "total": return "Total Prediction"
        case "team_total": return "Team Total Prediction"
        case "moneyline": return "Moneyline Prediction"
        case "h1_spread": return "1H Spread Prediction"
        case "h1_total": return "1H Total Prediction"
        case "h1_ml": return "1H Moneyline Prediction"
        default: return cardGroup.capitalized
        }
    }

    var systemImage: String {
        switch cardGroup {
        case "spread", "h1_spread": return "target"
        case "total", "h1_total": return "arrow.up.arrow.down.circle.fill"
        case "team_total": return "chart.bar.fill"
        case "moneyline", "h1_ml": return "dollarsign.circle.fill"
        default: return "football.fill"
        }
    }

    var tint: Color {
        switch cardGroup {
        case "total", "h1_total": return Color.appAccentBlue
        case "moneyline", "h1_ml": return Color.appAccentAmber
        case "team_total": return Color.appPrimary
        default: return Color.appPrimary
        }
    }
}

private struct NFLDryrunPickRow: Decodable, Identifiable, Sendable {
    let id: Int
    let gameId: String?
    let cardGroup: String?
    let betType: String?
    let sortOrder: Int?
    let pickSide: String?
    let pickTeam: String?
    let pickLabel: String?
    let modelNumber: Double?
    let modelLine: Double?
    let vegasLine: Double?
    let vegasPrice: Double?
    let edge: Double?
    let bestBook: String?
    let bestBookName: String?
    let bestBookLogo: String?
    let bestLine: Double?
    let bestOdds: Double?
    let conviction: String?
    let recommendation: String?
    let isMammoth: Bool?
    let stakeUnits: Double?
    let hasPlay: Bool?
    let displayOnly: Bool?
    let signals: [NFLPickSignalRow]
    let signalKeys: [String]

    enum CodingKeys: String, CodingKey {
        case id
        case gameId = "game_id"
        case cardGroup = "card_group"
        case betType = "bet_type"
        case sortOrder = "sort_order"
        case pickSide = "pick_side"
        case pickTeam = "pick_team"
        case pickLabel = "pick_label"
        case modelNumber = "model_number"
        case modelLine = "model_line"
        case vegasLine = "vegas_line"
        case vegasPrice = "vegas_price"
        case edge
        case bestBook = "best_book"
        case bestBookName = "best_book_name"
        case bestBookLogo = "best_book_logo"
        case bestLine = "best_line"
        case bestOdds = "best_odds"
        case conviction
        case recommendation
        case isMammoth = "is_mammoth"
        case stakeUnits = "stake_units"
        case hasPlay = "has_play"
        case displayOnly = "display_only"
        case signals
        case signalKeys = "signal_keys"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(Int.self, forKey: .id)) ?? Int.random(in: 1...Int.max)
        gameId = try c.decodeIfPresent(String.self, forKey: .gameId)
        cardGroup = try c.decodeIfPresent(String.self, forKey: .cardGroup)
        betType = try c.decodeIfPresent(String.self, forKey: .betType)
        sortOrder = try c.decodeIfPresent(Int.self, forKey: .sortOrder)
        pickSide = try c.decodeIfPresent(String.self, forKey: .pickSide)
        pickTeam = try c.decodeIfPresent(String.self, forKey: .pickTeam)
        pickLabel = try c.decodeIfPresent(String.self, forKey: .pickLabel)
        modelNumber = try c.decodeIfPresent(Double.self, forKey: .modelNumber)
        modelLine = try c.decodeIfPresent(Double.self, forKey: .modelLine)
        vegasLine = try c.decodeIfPresent(Double.self, forKey: .vegasLine)
        vegasPrice = try c.decodeIfPresent(Double.self, forKey: .vegasPrice)
        edge = try c.decodeIfPresent(Double.self, forKey: .edge)
        bestBook = try c.decodeIfPresent(String.self, forKey: .bestBook)
        bestBookName = try c.decodeIfPresent(String.self, forKey: .bestBookName)
        bestBookLogo = try c.decodeIfPresent(String.self, forKey: .bestBookLogo)
        bestLine = try c.decodeIfPresent(Double.self, forKey: .bestLine)
        bestOdds = try c.decodeIfPresent(Double.self, forKey: .bestOdds)
        conviction = try c.decodeIfPresent(String.self, forKey: .conviction)
        recommendation = try c.decodeIfPresent(String.self, forKey: .recommendation)
        isMammoth = try c.decodeIfPresent(Bool.self, forKey: .isMammoth)
        stakeUnits = try c.decodeIfPresent(Double.self, forKey: .stakeUnits)
        hasPlay = try c.decodeIfPresent(Bool.self, forKey: .hasPlay)
        displayOnly = try c.decodeIfPresent(Bool.self, forKey: .displayOnly)
        signals = (try? c.decodeIfPresent([NFLPickSignalRow].self, forKey: .signals)) ?? []
        signalKeys = (try? c.decodeIfPresent(NFLFlexibleStringList.self, forKey: .signalKeys))?.values ?? []
    }
}

private struct NFLPickSignalRow: Decodable, Identifiable, Sendable {
    var id: String { "\(key)-\(stance ?? "")-\(team ?? "")" }
    let key: String
    let label: String?
    let team: String?
    let action: String?
    let stance: String?
    let tier: String?
}

private struct NFLSignalDisplay: Identifiable, Sendable {
    var id: String { "\(key)-\(stance)-\(team ?? "")" }
    let key: String
    let displayName: String
    let team: String?
    let label: String?
    let action: String?
    let stance: String
    let tier: String?
    let definition: NFLSignalDefinition?
}

private struct NFLSignalDefinition: Decodable, Identifiable, Sendable {
    var id: String { signalKey }
    let signalKey: String
    let displayName: String?
    let oneLiner: String?
    let definition: String?
    let whyItWorks: String?
    let betDirection: String?
    let typicalHit: String?

    enum CodingKeys: String, CodingKey {
        case signalKey = "signal_key"
        case displayName = "display_name"
        case oneLiner = "one_liner"
        case definition
        case whyItWorks = "why_it_works"
        case betDirection = "bet_direction"
        case typicalHit = "typical_hit"
    }
}

private struct NFLTeamTrendRow: Decodable, Identifiable, Sendable {
    var id: String { teamAbbr }
    let teamAbbr: String
    let teamName: String?
    let suW: Int?
    let suL: Int?
    let suRecord: String?
    let atsW: Int?
    let atsL: Int?
    let atsP: Int?
    let atsPct: Double?
    let ouO: Int?
    let ouU: Int?
    let ouP: Int?
    let overPct: Double?
    let ttO: Int?
    let ttU: Int?
    let ttOverPct: Double?
    let h1AtsW: Int?
    let h1AtsL: Int?
    let h1AtsP: Int?
    let h1AtsPct: Double?
    let h1OuO: Int?
    let h1OuU: Int?
    let h1OverPct: Double?
    let last5Su: [String]
    let last5Ats: [String]
    let last5Ou: [String]
    let gameLog: [NFLTeamTrendGameLog]

    enum CodingKeys: String, CodingKey {
        case teamAbbr = "team_abbr"
        case teamName = "team_name"
        case suW = "su_w"
        case suL = "su_l"
        case suRecord = "su_record"
        case atsW = "ats_w"
        case atsL = "ats_l"
        case atsP = "ats_p"
        case atsPct = "ats_pct"
        case ouO = "ou_o"
        case ouU = "ou_u"
        case ouP = "ou_p"
        case overPct = "over_pct"
        case ttO = "tt_o"
        case ttU = "tt_u"
        case ttOverPct = "tt_over_pct"
        case h1AtsW = "h1_ats_w"
        case h1AtsL = "h1_ats_l"
        case h1AtsP = "h1_ats_p"
        case h1AtsPct = "h1_ats_pct"
        case h1OuO = "h1_ou_o"
        case h1OuU = "h1_ou_u"
        case h1OverPct = "h1_over_pct"
        case last5Su = "last5_su"
        case last5Ats = "last5_ats"
        case last5Ou = "last5_ou"
        case gameLog = "game_log"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        teamAbbr = try c.decode(String.self, forKey: .teamAbbr)
        teamName = try c.decodeIfPresent(String.self, forKey: .teamName)
        suW = try c.decodeIfPresent(Int.self, forKey: .suW)
        suL = try c.decodeIfPresent(Int.self, forKey: .suL)
        suRecord = try c.decodeIfPresent(String.self, forKey: .suRecord)
        atsW = try c.decodeIfPresent(Int.self, forKey: .atsW)
        atsL = try c.decodeIfPresent(Int.self, forKey: .atsL)
        atsP = try c.decodeIfPresent(Int.self, forKey: .atsP)
        atsPct = try c.decodeIfPresent(Double.self, forKey: .atsPct)
        ouO = try c.decodeIfPresent(Int.self, forKey: .ouO)
        ouU = try c.decodeIfPresent(Int.self, forKey: .ouU)
        ouP = try c.decodeIfPresent(Int.self, forKey: .ouP)
        overPct = try c.decodeIfPresent(Double.self, forKey: .overPct)
        ttO = try c.decodeIfPresent(Int.self, forKey: .ttO)
        ttU = try c.decodeIfPresent(Int.self, forKey: .ttU)
        ttOverPct = try c.decodeIfPresent(Double.self, forKey: .ttOverPct)
        h1AtsW = try c.decodeIfPresent(Int.self, forKey: .h1AtsW)
        h1AtsL = try c.decodeIfPresent(Int.self, forKey: .h1AtsL)
        h1AtsP = try c.decodeIfPresent(Int.self, forKey: .h1AtsP)
        h1AtsPct = try c.decodeIfPresent(Double.self, forKey: .h1AtsPct)
        h1OuO = try c.decodeIfPresent(Int.self, forKey: .h1OuO)
        h1OuU = try c.decodeIfPresent(Int.self, forKey: .h1OuU)
        h1OverPct = try c.decodeIfPresent(Double.self, forKey: .h1OverPct)
        last5Su = (try? c.decodeIfPresent(NFLFlexibleStringList.self, forKey: .last5Su))?.values ?? []
        last5Ats = (try? c.decodeIfPresent(NFLFlexibleStringList.self, forKey: .last5Ats))?.values ?? []
        last5Ou = (try? c.decodeIfPresent(NFLFlexibleStringList.self, forKey: .last5Ou))?.values ?? []
        gameLog = (try? c.decodeIfPresent([NFLTeamTrendGameLog].self, forKey: .gameLog)) ?? []
    }
}

private struct NFLTeamTrendGameLog: Decodable, Identifiable, Sendable {
    var id: String { "\(date ?? "")-\(opp ?? UUID().uuidString)" }
    let week: Int?
    let opp: String?
    let date: String?
    let isHome: Bool?
    let spread: Double?
    let total: Double?
    let ttLine: Double?
    let h1Spread: Double?
    let h1Total: Double?
    let su: String?
    let ats: String?
    let ou: String?
    let tt: String?
    let h1Ats: String?
    let h1Ou: String?
    let coverMargin: Double?
    let ouMargin: Double?
    let ttMargin: Double?
    let h1CoverMargin: Double?
    let h1OuMargin: Double?

    enum CodingKeys: String, CodingKey {
        case week, opp, date
        case isHome = "is_home"
        case spread, total
        case ttLine = "tt_line"
        case h1Spread = "h1_spread"
        case h1Total = "h1_total"
        case su, ats, ou, tt
        case h1Ats = "h1_ats"
        case h1Ou = "h1_ou"
        case coverMargin = "cover_margin"
        case ouMargin = "ou_margin"
        case ttMargin = "tt_margin"
        case h1CoverMargin = "h1_cover_margin"
        case h1OuMargin = "h1_ou_margin"
    }
}

private struct NFLMatchupHistoryRow: Decodable, Identifiable, Sendable {
    var id: String { gameId ?? "\(awayTeam)-\(homeTeam)-\(date ?? "")" }
    let matchupKey: String?
    let gameId: String?
    let season: Int?
    let date: String?
    let awayTeam: String
    let homeTeam: String
    let neutralSite: Bool?
    let awayScore: Int?
    let homeScore: Int?
    let totalPoints: Int?
    let closingSpreadHome: Double?
    let closingTotal: Double?
    let closingMlHome: Int?
    let closingMlAway: Int?
    let winnerTeam: String?
    let coverTeam: String?
    let atsResult: String?
    let ouResult: String?

    enum CodingKeys: String, CodingKey {
        case matchupKey = "matchup_key"
        case gameId = "game_id"
        case season
        case date
        case awayTeam = "away_team"
        case homeTeam = "home_team"
        case neutralSite = "neutral_site"
        case awayScore = "away_score"
        case homeScore = "home_score"
        case totalPoints = "total_points"
        case closingSpreadHome = "closing_spread_home"
        case closingTotal = "closing_total"
        case closingMlHome = "closing_ml_home"
        case closingMlAway = "closing_ml_away"
        case winnerTeam = "winner_team"
        case coverTeam = "cover_team"
        case atsResult = "ats_result"
        case ouResult = "ou_result"
    }
}

private struct NFLTrendDetailSelection: Identifiable {
    var id: String { "\(team.teamAbbr)-\(kind.rawValue)" }
    let team: NFLTeamTrendRow
    let kind: NFLTrendKind
}

private struct NFLTrendGameDetailRow: Identifiable {
    var id: String { "\(date ?? "")-\(opponent)-\(result)-\(lineText)" }
    let date: String?
    let opponent: String
    let locationMarker: String
    let lineText: String
    let result: String
    let margin: Double?
}

private enum NFLTrendKind: String {
    case spread
    case total
    case teamTotal
    case moneyline
    case h1Spread
    case h1Total

    var title: String {
        switch self {
        case .spread: return "ATS Trend"
        case .total: return "O/U Trend"
        case .teamTotal: return "Team Total Trend"
        case .moneyline: return "Moneyline Trend"
        case .h1Spread: return "1H ATS Trend"
        case .h1Total: return "1H O/U Trend"
        }
    }

    var lineHeader: String {
        switch self {
        case .moneyline: return "Line"
        case .teamTotal: return "TT"
        case .h1Spread: return "1H Spr"
        case .h1Total: return "1H Tot"
        case .spread: return "Spread"
        case .total: return "Total"
        }
    }

    var resultHeader: String {
        switch self {
        case .total, .h1Total: return "O/U"
        case .teamTotal: return "TT"
        case .moneyline: return "SU"
        default: return "ATS"
        }
    }

    var marginHeader: String {
        switch self {
        case .spread, .h1Spread: return "Cover +/-"
        case .total, .h1Total: return "O/U +/-"
        case .teamTotal: return "TT +/-"
        case .moneyline: return "Margin"
        }
    }
}

private struct NFLFlexibleStringList: Decodable, Sendable {
    let values: [String]

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let array = try? c.decode([String].self) {
            values = array.filter { !$0.isEmpty }
        } else if let string = try? c.decode(String.self) {
            if let data = string.data(using: .utf8),
               let parsed = try? JSONDecoder().decode([String].self, from: data) {
                values = parsed.filter { !$0.isEmpty }
            } else {
                values = string
                    .split(separator: ",")
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
            }
        } else {
            values = []
        }
    }
}

private struct NFLFlowLayout: Layout {
    var spacing: CGFloat = 8
    var rowSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 320
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + rowSpacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }

        return CGSize(width: width, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + rowSpacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
