import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// CFB Week 7 dry-run detail screen: a seven-market bet board from
/// `cfb_dryrun_games`, plus fired flags split into active picks and tracking.
struct CFBGameBottomSheet: View {
    let game: CFBPrediction
    var onClose: () -> Void = {}
    var showAura: Bool = true
    var heroTopInset: CGFloat = 0
    var contentBottomInset: CGFloat = 0

    @Environment(AgentPickAuditStore.self) private var auditStore
    @State private var selectedSignal: CFBDryRunFlag?
    @State private var dryRunPicks: [CFBDryRunPickRow] = []
    @State private var signalDefinitionsBySource: [String: CFBSignalDefinition] = [:]
    @State private var signalPerformanceByKey: [String: SignalPerformance] = [:]
    @State private var teamTrendsByTeam: [String: CFBTeamTrendRow] = [:]
    @State private var selectedTrendDetail: TrendDetailSelection?
    @State private var marketOddsHeadline: String?
    @State private var bookOdds: SportsbookGameOdds?
    @AppStorage(SportsbookPreference.defaultsKey) private var preferredBookKeysRaw: String = ""

    /// Hero text that depends only on the game, not on scroll progress.
    ///
    /// `CollapsingWidgetScroll` re-invokes the hero builder on every scroll
    /// frame, so building these inline re-parsed the kickoff date/time and
    /// re-interpolated the stat values 120 times a second.
    private struct HeroText {
        let dateLabel: String
        let timeLabel: String
        let expandedStats: [MatchupGlassHero.Stat]
        let collapsedStats: [MatchupGlassHero.Stat]

        init(_ game: CFBPrediction) {
            dateLabel = GameCardFormatting.formatCompactDate(game.kickoff ?? game.gameDate)
            timeLabel = GameCardFormatting.convertTimeToEST(game.kickoff ?? game.gameTime)
            let ml = "\(GameCardFormatting.formatMoneyline(game.awayMl)) / \(GameCardFormatting.formatMoneyline(game.homeMl))"
            let spread = "\(GameCardFormatting.formatSpread(game.awaySpread)) / \(GameCardFormatting.formatSpread(game.homeSpread))"
            let ou = GameCardFormatting.roundToNearestHalf(game.overLine)
            expandedStats = [
                .init(label: "ML", value: ml),
                .init(label: "Spread", value: spread),
                .init(label: "O/U", value: ou)
            ]
            collapsedStats = [
                .init(label: "Spread", value: spread),
                .init(label: "O/U", value: ou)
            ]
        }
    }

    @State private var heroTextCache: HeroText?
    /// Falls back to computing inline on the very first frame (before `.task`
    /// seeds the cache) so the hero never renders blank.
    private var heroText: HeroText { heroTextCache ?? HeroText(game) }

    private var awayColors: TeamColorPair { CFBTeamColors.colorPair(for: game.awayTeam) }
    private var homeColors: TeamColorPair { CFBTeamColors.colorPair(for: game.homeTeam) }

    var body: some View {
        CollapsingWidgetScroll(
            heroMaxHeight: hasWeather ? 246 : 206,
            heroMinHeight: 44,
            transparentPage: !showAura,
            heroTopInset: heroTopInset,
            contentBottomInset: contentBottomInset,
            usesLiquidGlass: false
        ) { progress in
            // Standalone pages paint this aura themselves. In carousel mode the
            // shared fixed aura is the only rendered copy; the collapsing shell
            // masks scrolling content without adding a page-colored hero band.
            TeamAuraBackground(awayColor: awayColors.primary, homeColor: homeColors.primary, progress: progress)
        } hero: { progress in
            heroView(progress: progress)
        } content: {
            // FIRST, above every per-sport section — the crowd's read on the
            // game frames everything below it, and the widget is sport-agnostic
            // (same placement as web's detail grid).
            AgentConsensusSection(sport: .cfb, gameId: GameConsensusKey.cfb(game), gameDate: game.gameDate)
            marketOddsSection
            projectedScoreSection
            ForEach(marketRows) { row in
                marketSection(row)
            }
            honestySection
            AgentPickRationaleWidget(gameKeys: [game.gameId, game.trainingKey, game.uniqueId, "\(game.awayTeam)_\(game.homeTeam)"])
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
        }
        .weatherPrecipitation(weatherPrecipitationKind)
        .background(showAura ? Color.appSurface : Color.clear)
        .toolbarBackground(.hidden, for: .navigationBar)
        .presentationDetents([.fraction(0.85), .large])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.disabled)
        .onDisappear { auditStore.clear() }
        .task(id: game.gameId) {
            // Seed the hero text cache so subsequent scroll frames reuse it
            // instead of re-parsing the kickoff and re-building the stat rows.
            heroTextCache = HeroText(game)
            async let picks: () = loadDryRunPicks()
            async let trends: () = loadTeamTrends()
            async let books: () = loadSportsbookOdds()
            async let performance = SignalPerformanceService.shared.performances(
                for: .cfb,
                season: game.season ?? 2025
            )
            _ = await (picks, trends, books)
            signalPerformanceByKey = await performance
        }
        .sheet(item: $selectedSignal) { flag in
            signalDefinitionSheet(flag)
        }
        .sheet(item: $selectedTrendDetail) { selection in
            trendDetailSheet(selection)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Hero

    /// Matchup hero — same format as `NFLGameBottomSheet.heroView`: date/time
    /// row on top of a `MatchupGlassHero` (fused liquid-glass team discs that
    /// flow apart as the hero collapses). Expanded shows full ML / Spread /
    /// O/U stacked under the discs; collapsed keeps Spread + O/U centered
    /// while each team's abbreviation + ML moves under its disc. Rank badges
    /// stay on the discs while expanded. The weather row (when the game has
    /// weather data) fades in below the discs while expanded.
    @ViewBuilder
    private func heroView(progress p: CGFloat) -> some View {
        let detail = Double(max(0, 1 - p * 1.9))
        let text = heroText
        VStack(spacing: heroLerp(12, 0, p)) {
            topRow(text)
                .opacity(detail)
                .frame(height: heroLerp(28, 0, min(1, p * 1.6)))
                .clipped()
            MatchupGlassHero(
                away: heroSide(team: game.awayTeam, ml: game.awayMl, rank: game.awayRank),
                home: heroSide(team: game.homeTeam, ml: game.homeMl, rank: game.homeRank),
                expandedStats: text.expandedStats,
                collapsedStats: text.collapsedStats,
                progress: p
            )
            if detail > 0.08, hasWeather {
                heroWeatherRow
                    .opacity(detail)
                    .padding(.top, 2)
            }
        }
        .padding(.horizontal, heroLerp(16, 0, p))
        .padding(.top, heroLerp(8, 0, p))
        .frame(maxWidth: .infinity, alignment: .top)
    }

    /// Build a `MatchupGlassHero.Side` from a CFB team string — logo + abbr
    /// from the `cfb_teams` reference table, colors from the static map.
    private func heroSide(team: String, ml: Int?, rank: Int?) -> MatchupGlassHero.Side {
        let pair = CFBTeamColors.colorPair(for: team)
        return MatchupGlassHero.Side(
            logoURL: CFBTeamAssets.logo(for: team),
            abbr: CFBTeamAssets.abbr(for: team),
            primary: pair.primary,
            secondary: pair.secondary,
            ml: ml,
            rank: rank
        )
    }

    private func heroLerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat {
        a + (b - a) * min(1, max(0, t))
    }

    @ViewBuilder
    private func topRow(_ text: HeroText) -> some View {
        HStack(spacing: 8) {
            Spacer(minLength: 0)
            Text(text.dateLabel)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text(text.timeLabel)
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
        if game.wxIndoors == true {
            HStack(spacing: 5) {
                weatherChip(systemImage: "building.2.fill", text: "Indoor / Dome", tint: Color(hex: 0xA78BFA))
            }
            .frame(maxWidth: .infinity, alignment: .center)
        } else if hasOutdoorWeather {
            HStack(spacing: 8) {
                if let condition = weatherConditionDisplay {
                    weatherChip(systemImage: condition.systemImage, text: condition.text, tint: condition.tint)
                }
                if let temp = game.wxTempF ?? game.temperature {
                    weatherChip(systemImage: "thermometer.medium", text: "\(Int(temp.rounded()))°", tint: temperatureTint(temp))
                }
                if let wind = game.wxWindMph ?? game.windSpeed {
                    weatherChip(systemImage: "wind", text: "\(Int(wind.rounded())) mph", tint: Color(hex: 0x60A5FA))
                }
            }
            .frame(maxWidth: .infinity, alignment: .center)
        }
    }

    private var hasWeather: Bool {
        game.wxIndoors == true || hasOutdoorWeather
    }

    private var hasOutdoorWeather: Bool {
        weatherConditionDisplay != nil || game.wxTempF != nil || game.temperature != nil || game.wxWindMph != nil || game.windSpeed != nil
    }

    private var weatherPrecipitationKind: WeatherPrecipitationKind? {
        WeatherPrecipitationKind.from(
            icon: game.wxIcon ?? game.icon,
            summary: game.wxSummary,
            isIndoor: game.wxIndoors == true
        )
    }

    private var weatherConditionDisplay: (systemImage: String, text: String, tint: Color)? {
        let key = (game.wxIcon ?? game.icon ?? "").lowercased()
        let summary = game.wxSummary?.trimmingCharacters(in: .whitespacesAndNewlines)

        if key.contains("indoor") || key.contains("dome") {
            return ("building.2.fill", "Indoor", Color(hex: 0xA78BFA))
        }
        if key.contains("thunder") || key.contains("storm") {
            return ("cloud.bolt.rain.fill", "Storms", Color(hex: 0xFACC15))
        }
        if key.contains("rain") || key.contains("shower") {
            return ("cloud.rain.fill", "Rain", Color(hex: 0x38BDF8))
        }
        if key.contains("snow") || key.contains("sleet") {
            return ("cloud.snow.fill", "Snow", Color(hex: 0xBAE6FD))
        }
        if key.contains("fog") || key.contains("mist") {
            return ("cloud.fog.fill", "Fog", Color(hex: 0x94A3B8))
        }
        if key.contains("wind") {
            return ("wind", "Windy", Color(hex: 0x60A5FA))
        }
        if key.contains("cold") {
            return ("thermometer.snowflake", "Cold", Color(hex: 0x93C5FD))
        }
        if key.contains("hot") {
            return ("thermometer.sun.fill", "Hot", Color(hex: 0xFB923C))
        }
        if key.contains("partly") || key.contains("partly-cloudy") {
            return ("cloud.sun.fill", "Partly", Color(hex: 0xFBBF24))
        }
        if key.contains("cloud") || key.contains("overcast") {
            return ("cloud.fill", "Cloudy", Color(hex: 0xCBD5E1))
        }
        if key.contains("clear") || key.contains("sun") {
            return ("sun.max.fill", "Clear", Color(hex: 0xFACC15))
        }

        guard let summary, !summary.isEmpty else { return nil }
        let shortSummary = summary
            .replacingOccurrences(of: "°F", with: "°")
            .split(separator: "·")
            .first
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) } ?? summary
        return ("cloud.sun.fill", shortSummary, Color(hex: 0xFBBF24))
    }

    private func weatherChip(systemImage: String, text: String, tint: Color) -> some View {
        HStack(spacing: 3) {
            Image(systemName: systemImage)
                .font(.system(size: 12, weight: .black))
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(tint)
            Text(text)
                .font(.system(size: 12, weight: .black, design: .rounded))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.86)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(tint.opacity(0.13), in: Capsule())
        .overlay(Capsule().stroke(tint.opacity(0.32), lineWidth: 0.6))
    }

    private func temperatureTint(_ temp: Double) -> Color {
        if temp <= 38 { return Color(hex: 0x60A5FA) }
        if temp >= 82 { return Color(hex: 0xF97316) }
        return Color(hex: 0x22C55E)
    }

    // MARK: - Sections

    @ViewBuilder
    private var mammothContext: some View {
        if game.mammoth {
            WidgetCollapsingSection(title: "Mammoth Play", systemImage: "diamond.fill", iconTint: Color(hex: 0xF97316)) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(game.headlinePick ?? "Top CFB play")
                        .font(.system(size: 18, weight: .black))
                        .foregroundStyle(Color.appTextPrimary)
                    Text("Rare 5u dry-run signal. Conflicting flags can still appear below; the headline follows the model side and conviction tier.")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                }
                .padding(14)
            }
        }
    }

    private func marketSection(_ row: MarketRow) -> some View {
        WidgetCollapsingSection(
            title: row.sectionTitle,
            systemImage: row.systemImage,
            iconTint: row.tint,
            icon: sectionHeaderIcon(for: row),
            showsHeader: false,
            headline: chartHeadline(for: row) ?? row.pickSubtitle
        ) {
            ProContentSection(title: row.sectionTitle, minHeight: signalBuckets(for: row).isEmpty ? 132 : 210) {
                marketRow(row)
            }
        }
    }

    private func sectionHeaderIcon(for row: MarketRow) -> AnyView? {
        guard row.id == "tt-home" || row.id == "tt-away" else { return nil }
        let team = row.id == "tt-home" ? game.homeTeam : game.awayTeam
        return AnyView(
            GameCardTeamAvatar(teamName: team, sport: "cfb", size: 18, colors: CFBTeamColors.colorPair(for: team))
                .frame(width: 18, height: 18)
        )
    }

    private func marketRow(_ row: MarketRow) -> some View {
        let buckets = signalBuckets(for: row)
        let pick = dryRunPick(for: row)
        let mammoth = isMammothPick(pick)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                if let icon = sectionHeaderIcon(for: row) {
                    icon
                }
                Text(row.sectionTitle)
                    .font(.system(size: 15, weight: .black))
                    .foregroundStyle(Color.appTextPrimary)
                if mammoth {
                    mammothBadge
                }
                if row.isDisplayOnly {
                    Text("Display only")
                        .font(.system(size: 9, weight: .black))
                        .foregroundStyle(Color.appTextSecondary)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Color.appTextSecondary.opacity(0.10), in: Capsule())
                }
                Spacer()
                Text(pick?.recommendation ?? row.pick)
                    .font(.system(size: 13, weight: .black))
                    .foregroundStyle(mammoth ? mammothTint : ((pick?.hasPlay == false || pick?.displayOnly == true) ? Color.appTextSecondary : (row.isNoPlay ? Color.appAccentAmber : row.tint)))
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }
            marketRecommendationRow(row)
            PickSignalsSection(signals: signalPills(buckets)) { selected in
                selectedSignal = (buckets.supporting + buckets.contradicting)
                    .first { $0.id == selected.id }
            }
            teamTrendStrip(for: row)
        }
        .padding(4)
    }

    @ViewBuilder
    private func teamTrendStrip(for row: MarketRow) -> some View {
        let away = teamTrendsByTeam[game.awayTeam]
        let home = teamTrendsByTeam[game.homeTeam]
        let showStrip = row.id == "tt-home" ? home != nil : (row.id == "tt-away" ? away != nil : (away != nil || home != nil))
        if showStrip {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "chart.bar.xaxis")
                        .font(.system(size: 9, weight: .black))
                    Text("Team Trends")
                        .font(.system(size: 9, weight: .black))
                    if let sample = away ?? home {
                        Text(sample.sampleLabel)
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Color.appTextMuted)
                    }
                    Spacer(minLength: 0)
                }
                .foregroundStyle(Color.appTextSecondary)

                HStack(alignment: .top, spacing: 8) {
                    if row.id == "tt-home" {
                        trendTeamColumn(team: game.homeTeam, trend: home, row: row)
                    } else if row.id == "tt-away" {
                        trendTeamColumn(team: game.awayTeam, trend: away, row: row)
                    } else {
                        trendTeamColumn(team: game.awayTeam, trend: away, row: row)
                        trendTeamColumn(team: game.homeTeam, trend: home, row: row)
                    }
                }
            }
            // No wrapper box: the per-team cards below are already a surface, and
            // boxing them again made this three deep. NFL's `teamTrendStrip` is a
            // bare label + row of cards for the same reason.
        }
    }

    @ViewBuilder
    private func trendTeamColumn(team: String, trend: CFBTeamTrendRow?, row: MarketRow) -> some View {
        let metric = trendMetric(for: row, trend: trend)
        if let trend {
            Button {
                selectedTrendDetail = TrendDetailSelection(team: team, rowId: row.id, trend: trend)
            } label: {
                trendTeamCard(team: team, row: row, metric: metric, isClickable: true)
            }
            .buttonStyle(.plain)
        } else {
            trendTeamCard(team: team, row: row, metric: metric, isClickable: false)
        }
    }

    private func trendTeamCard(team: String, row: MarketRow, metric: TrendMetric, isClickable: Bool) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 6) {
                GameCardTeamAvatar(teamName: team, sport: "cfb", size: 20, colors: CFBTeamColors.colorPair(for: team))
                VStack(alignment: .leading, spacing: 1) {
                    Text(CFBTeamAssets.abbr(for: team))
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(Color.appTextPrimary)
                    Text(metric.label)
                        .font(.system(size: 8, weight: .black))
                        .foregroundStyle(Color.appTextMuted)
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 1) {
                    Text("Season")
                        .font(.system(size: 7, weight: .black))
                        .tracking(0.4)
                        .foregroundStyle(Color.appTextMuted)
                    Text(metric.value)
                        .font(.system(size: 11, weight: .black, design: .monospaced))
                        .foregroundStyle(metric.tint)
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                }
            }
            trendChips(metric.chips)
            if isClickable {
                HStack(spacing: 4) {
                    Text("Tap to expand")
                        .font(.system(size: 8, weight: .black))
                    Image(systemName: "chevron.up.forward")
                        .font(.system(size: 8, weight: .black))
                }
                .foregroundStyle(Color.appTextMuted)
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurface.opacity(0.42), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(metric.tint.opacity(0.18), lineWidth: 0.7))
    }

    private func trendChips(_ chips: [String]) -> some View {
        HStack(spacing: 4) {
            if !chips.isEmpty {
                Text("L\(min(chips.count, 5))")
                    .font(.system(size: 8, weight: .black))
                    .foregroundStyle(Color.appTextMuted)
                    .padding(.trailing, 1)
            }
            ForEach(Array(chips.prefix(5).enumerated()), id: \.offset) { _, chip in
                Text(chip.uppercased())
                    .font(.system(size: 8, weight: .black))
                    .foregroundStyle(Color.appSurface)
                    .frame(width: 17, height: 17)
                    .background(trendChipColor(chip), in: Circle())
            }
            if chips.isEmpty {
                Text("No L5")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(Color.appTextMuted)
            }
        }
    }

    private func trendMetric(for row: MarketRow, trend: CFBTeamTrendRow?) -> TrendMetric {
        guard let trend else {
            return TrendMetric(label: trendMetricLabel(for: row), value: "—", chips: [], tint: Color.appTextMuted)
        }

        switch row.id {
        case "spread":
            return TrendMetric(
                label: "ATS",
                value: recordPct(w: trend.atsW, l: trend.atsL, p: trend.atsP, pct: trend.atsPct),
                chips: trend.last5Ats,
                tint: trendTint(trend.atsPct)
            )
        case "total":
            return TrendMetric(
                label: "O/U",
                value: ouPct(o: trend.ouO, u: trend.ouU, p: trend.ouP, pct: trend.overPct),
                chips: trend.last5Ou,
                tint: trendTint(trend.overPct)
            )
        case "tt-home", "tt-away":
            return TrendMetric(
                label: "TT Over",
                value: "\(trend.ttO)-\(trend.ttU) \(pctText(trend.ttOverPct))",
                chips: trend.last5Logs.compactMap(\.tt),
                tint: trendTint(trend.ttOverPct)
            )
        case "h1-spread":
            return TrendMetric(
                label: "1H ATS",
                value: recordPct(w: trend.h1AtsW, l: trend.h1AtsL, p: trend.h1AtsP, pct: trend.h1AtsPct),
                chips: trend.last5Logs.compactMap(\.h1Ats),
                tint: trendTint(trend.h1AtsPct)
            )
        case "h1-total":
            return TrendMetric(
                label: "1H O/U",
                value: "\(trend.h1OuO)-\(trend.h1OuU) \(pctText(trend.h1OverPct))",
                chips: trend.last5Logs.compactMap(\.h1Ou),
                tint: trendTint(trend.h1OverPct)
            )
        case "moneyline", "h1-ml":
            return TrendMetric(
                label: "SU",
                value: trend.suRecord,
                chips: trend.last5Su,
                tint: Color.appTextPrimary
            )
        default:
            return TrendMetric(label: "Trend", value: "—", chips: [], tint: Color.appTextMuted)
        }
    }

    private func trendMetricLabel(for row: MarketRow) -> String {
        switch row.id {
        case "spread": return "ATS"
        case "total": return "O/U"
        case "tt-home", "tt-away": return "TT Over"
        case "h1-spread": return "1H ATS"
        case "h1-total": return "1H O/U"
        case "moneyline", "h1-ml": return "SU"
        default: return "Trend"
        }
    }

    private func recordPct(w: Int, l: Int, p: Int, pct: Double?) -> String {
        let record = p > 0 ? "\(w)-\(l)-\(p)" : "\(w)-\(l)"
        return "\(record) \(pctText(pct))"
    }

    private func ouPct(o: Int, u: Int, p: Int, pct: Double?) -> String {
        let record = p > 0 ? "\(o)-\(u)-\(p)" : "\(o)-\(u)"
        return "\(record) \(pctText(pct))"
    }

    private func pctText(_ pct: Double?) -> String {
        guard let pct else { return "—" }
        return "\(Int(pct.rounded()))%"
    }

    private func trendTint(_ pct: Double?) -> Color {
        guard let pct else { return Color.appTextSecondary }
        if pct >= 55 { return Color(hex: 0x22C55E) }
        if pct <= 45 { return Color(hex: 0xEF4444) }
        return Color.appTextSecondary
    }

    private func trendChipColor(_ value: String) -> Color {
        switch value.uppercased() {
        case "W", "O": return Color(hex: 0x22C55E)
        case "L", "U": return Color(hex: 0xEF4444)
        case "P": return Color.appTextMuted
        default: return Color.appTextMuted
        }
    }

    private func trendDetailSheet(_ selection: TrendDetailSelection) -> some View {
        let rows = trendDetailRows(for: selection)
        return NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 10) {
                        GameCardTeamAvatar(teamName: selection.team, sport: "cfb", size: 34, colors: CFBTeamColors.colorPair(for: selection.team))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(CFBTeamAssets.abbr(for: selection.team)) \(trendDetailTitle(for: selection.rowId))")
                                .font(.system(size: 18, weight: .black))
                                .foregroundStyle(Color.appTextPrimary)
                            Text("Season game log · newest first")
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
                        VStack(alignment: .leading, spacing: 0) {
                            trendDetailHeader(for: selection.rowId)
                            ForEach(rows) { row in
                                trendDetailRow(row, rowId: selection.rowId)
                            }
                        }
                        .padding(10)
                        .frame(width: trendDetailTableWidth(for: selection.rowId), alignment: .leading)
                        .background(Color.appSurfaceElevated.opacity(0.56), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.appBorder.opacity(0.32), lineWidth: 0.8))
                        .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                .padding(8)
            }
            .background(Color.appSurface.ignoresSafeArea())
            .navigationTitle("Team Trend Detail")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func trendDetailHeader(for rowId: String) -> some View {
        HStack(spacing: trendTableSpacing(for: rowId)) {
            tableHeader("Date", width: trendDateWidth(for: rowId))
            tableHeader("Opp", width: trendOppWidth(for: rowId))
            switch rowId {
            case "spread":
                tableHeader("Spread", width: 64)
                tableHeader("ATS", width: 42)
                tableHeader("Cover +/-", width: 78)
            case "total":
                tableHeader("Total", width: 54)
                tableHeader("O/U", width: 42)
                tableHeader("O/U +/-", width: 68)
                tableHeader("Final", width: 42)
            case "tt-home", "tt-away":
                tableHeader("TT", width: 48)
                tableHeader("O/U", width: 42)
                tableHeader("Pts", width: 42)
                tableHeader("TT +/-", width: 66)
            case "h1-spread":
                tableHeader("1H Spr", width: 64)
                tableHeader("ATS", width: 42)
                tableHeader("Cover +/-", width: 78)
            case "h1-total":
                tableHeader("1H Tot", width: 58)
                tableHeader("O/U", width: 42)
                tableHeader("O/U +/-", width: 72)
            default:
                tableHeader("Score", width: 84)
                tableHeader("SU", width: 42)
            }
        }
        .padding(.bottom, 10)
    }

    private func trendDetailTableWidth(for rowId: String) -> CGFloat {
        switch rowId {
        case "total":
            return 376
        case "tt-home", "tt-away":
            return 372
        case "spread", "h1-spread":
            return 370
        case "h1-total":
            return 342
        case "moneyline", "h1-ml":
            return 334
        default:
            return 370
        }
    }

    private func trendTableSpacing(for rowId: String) -> CGFloat {
        switch rowId {
        case "moneyline", "h1-ml": return 9
        default: return 7
        }
    }

    private func trendDateWidth(for rowId: String) -> CGFloat {
        switch rowId {
        case "moneyline", "h1-ml": return 54
        default: return 48
        }
    }

    private func trendOppWidth(for rowId: String) -> CGFloat {
        switch rowId {
        case "moneyline", "h1-ml": return 112
        case "spread", "h1-spread": return 96
        default: return 82
        }
    }

    private func trendDetailRow(_ row: TrendDetailGameRow, rowId: String) -> some View {
        HStack(spacing: trendTableSpacing(for: rowId)) {
            Text(row.date)
                .font(.system(size: trendBodyFontSize(for: rowId), weight: .bold, design: .monospaced))
                .foregroundStyle(Color.appTextSecondary)
                .frame(width: trendDateWidth(for: rowId), alignment: .leading)
            HStack(spacing: 4) {
                Text(row.locationMarker)
                    .font(.system(size: trendLocationFontSize(for: rowId), weight: .black, design: .rounded))
                    .foregroundStyle(Color.appTextMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(width: trendLocationMarkerWidth(for: rowId), alignment: .trailing)
                GameCardTeamAvatar(teamName: row.opponent, sport: "cfb", size: trendOpponentLogoSize(for: rowId), colors: CFBTeamColors.colorPair(for: row.opponent))
                Text(CFBTeamAssets.abbr(for: row.opponent))
                    .font(.system(size: trendOpponentFontSize(for: rowId), weight: .black))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(width: trendOppWidth(for: rowId), alignment: .leading)

            switch rowId {
            case "spread":
                tableValue(row.line, width: 64, rowId: rowId)
                trendResultChip(row.result)
                tableMargin(row.margin, width: 78, rowId: rowId)
            case "total":
                tableValue(row.line, width: 54, rowId: rowId)
                trendResultChip(row.result)
                tableMargin(row.margin, width: 68, rowId: rowId)
                tableValue(row.extra ?? "—", width: 42, rowId: rowId)
            case "tt-home", "tt-away":
                tableValue(row.line, width: 48, rowId: rowId)
                trendResultChip(row.result)
                tableValue(row.extra ?? "—", width: 42, rowId: rowId)
                tableMargin(row.margin, width: 66, rowId: rowId)
            case "h1-spread":
                tableValue(row.line, width: 64, rowId: rowId)
                trendResultChip(row.result)
                tableMargin(row.margin, width: 78, rowId: rowId)
            case "h1-total":
                tableValue(row.line, width: 58, rowId: rowId)
                trendResultChip(row.result)
                tableMargin(row.margin, width: 72, rowId: rowId)
            default:
                tableValue(row.line, width: 84, rowId: rowId)
                trendResultChip(row.result)
            }
        }
        .padding(.vertical, 11)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.appBorder.opacity(0.22))
                .frame(height: 0.7)
        }
    }

    private func tableHeader(_ text: String, width: CGFloat) -> some View {
        Text(text.uppercased())
            .font(.system(size: 9, weight: .black))
            .tracking(0.18)
            .foregroundStyle(Color.appTextMuted)
            .frame(width: width, alignment: .leading)
            .lineLimit(1)
            .minimumScaleFactor(0.62)
    }

    private func tableValue(_ text: String, width: CGFloat, rowId: String) -> some View {
        Text(text)
            .font(.system(size: trendBodyFontSize(for: rowId), weight: .bold, design: .monospaced))
            .foregroundStyle(Color.appTextSecondary)
            .frame(width: width, alignment: .leading)
            .lineLimit(1)
            .minimumScaleFactor(0.65)
    }

    private func tableMargin(_ value: Double?, width: CGFloat, rowId: String) -> some View {
        Text(value.map(signed) ?? "—")
            .font(.system(size: trendBodyFontSize(for: rowId), weight: .black, design: .monospaced))
            .foregroundStyle(marginColor(value))
            .frame(width: width, alignment: .leading)
            .lineLimit(1)
            .minimumScaleFactor(0.65)
    }

    private func trendResultChip(_ result: String) -> some View {
        Text(result.uppercased())
            .font(.system(size: 11, weight: .black))
            .foregroundStyle(Color.appSurface)
            .frame(width: 30, height: 24)
            .background(trendChipColor(result), in: Capsule())
            .frame(width: 42, alignment: .leading)
    }

    private func trendBodyFontSize(for rowId: String) -> CGFloat {
        switch rowId {
        case "moneyline", "h1-ml": return 15
        case "spread", "h1-spread": return 14
        default: return 13
        }
    }

    private func trendLocationMarkerWidth(for rowId: String) -> CGFloat {
        switch rowId {
        case "moneyline", "h1-ml": return 18
        default: return 16
        }
    }

    private func trendLocationFontSize(for rowId: String) -> CGFloat {
        switch rowId {
        case "moneyline", "h1-ml": return 11
        default: return 10
        }
    }

    private func trendOpponentFontSize(for rowId: String) -> CGFloat {
        switch rowId {
        case "moneyline", "h1-ml": return 15
        case "spread", "h1-spread": return 14
        default: return 13
        }
    }

    private func trendOpponentLogoSize(for rowId: String) -> CGFloat {
        switch rowId {
        case "moneyline", "h1-ml": return 28
        case "spread", "h1-spread": return 26
        default: return 24
        }
    }

    private func marginColor(_ value: Double?) -> Color {
        guard let value else { return Color.appTextMuted }
        if value > 0 { return Color(hex: 0x22C55E) }
        if value < 0 { return Color(hex: 0xEF4444) }
        return Color.appTextMuted
    }

    private func trendDetailTitle(for rowId: String) -> String {
        switch rowId {
        case "spread": return "ATS this season"
        case "total": return "O/U this season"
        case "tt-home", "tt-away": return "Team Total this season"
        case "h1-spread": return "1H ATS this season"
        case "h1-total": return "1H O/U this season"
        default: return "Moneyline this season"
        }
    }

    private func trendDetailRows(for selection: TrendDetailSelection) -> [TrendDetailGameRow] {
        selection.trend.gameLog.compactMap { log in
            guard let opp = log.opp else { return nil }
            let date = trendDateText(log.date, week: log.week)
            let locationMarker = trendLocationMarker(for: log)
            switch selection.rowId {
            case "spread":
                guard let spread = log.spread, let result = log.ats else { return nil }
                return TrendDetailGameRow(date: date, opponent: opp, locationMarker: locationMarker, line: formatSpreadValue(spread), result: result, margin: log.coverMargin)
            case "total":
                guard let total = log.total, let result = log.ou else { return nil }
                return TrendDetailGameRow(date: date, opponent: opp, locationMarker: locationMarker, line: num(total), result: result, margin: log.ouMargin, extra: log.totalPoints.map(String.init))
            case "tt-home", "tt-away":
                guard let line = log.ttLine, let result = log.tt else { return nil }
                return TrendDetailGameRow(date: date, opponent: opp, locationMarker: locationMarker, line: num(line), result: result, margin: log.ttMargin, extra: log.teamPts.map(String.init))
            case "h1-spread":
                guard let spread = log.h1Spread, let result = log.h1Ats else { return nil }
                return TrendDetailGameRow(date: date, opponent: opp, locationMarker: locationMarker, line: formatSpreadValue(spread), result: result, margin: log.h1CoverMargin)
            case "h1-total":
                guard let total = log.h1Total, let result = log.h1Ou else { return nil }
                return TrendDetailGameRow(date: date, opponent: opp, locationMarker: locationMarker, line: num(total), result: result, margin: log.h1OuMargin)
            default:
                guard let result = log.su else { return nil }
                let score = "\(log.ptsFor.map(String.init) ?? "—")-\(log.ptsAgainst.map(String.init) ?? "—")"
                return TrendDetailGameRow(date: date, opponent: opp, locationMarker: locationMarker, line: score, result: result)
            }
        }
    }

    private func trendLocationMarker(for log: CFBTeamTrendGameLog) -> String {
        if log.neutralSite == true { return "(n)" }
        if log.isHome == false { return "@" }
        return ""
    }

    private func trendDateText(_ raw: String?, week: Int?) -> String {
        if let raw, !raw.isEmpty {
            let normalized = raw.prefix(10)
            if normalized.count == 10 {
                let monthStart = normalized.index(normalized.startIndex, offsetBy: 5)
                let monthEnd = normalized.index(monthStart, offsetBy: 2)
                let dayStart = normalized.index(normalized.startIndex, offsetBy: 8)
                return "\(normalized[monthStart..<monthEnd])/\(normalized[dayStart...])"
            }
            return raw
        }
        if let week {
            return "W\(week)"
        }
        return "—"
    }

    private func marketRecommendationRow(_ row: MarketRow) -> some View {
        let pick = dryRunPick(for: row)
        let comparisonPick = comparisonPick(for: row)
        let board = sportsbookQuotes(for: row, pick: comparisonPick)
        let selectedKeys = SportsbookPreference.decode(preferredBookKeysRaw)
        let resolvedLine = board?.preferred(selectedKeys)?.line
        let mammoth = isMammothPick(pick)
        let displayDirection = pickDirection(pick?.pickSide) ?? pickDirection(pick?.pickLabel) ?? pickDirection(row.pick)
        let cardTint = mammoth ? mammothTint : tint(forDirection: displayDirection, fallback: row.tint)
        return VStack(alignment: .leading, spacing: 14) {
            if let chart = marketChart(for: row, pick: comparisonPick) {
                marketChartView(chart)
            } else if shouldShowComparison(for: row) {
                HStack(spacing: 10) {
                    comparisonBox(
                        label: resolvedLine == nil ? row.vegasLabel : "Sportsbook line",
                        value: resolvedLine.map { formatMarketLine($0, row: row) }
                            ?? comparisonPick.map { formatMarketLine($0.bestLine ?? $0.vegasLine, row: row) }
                            ?? row.vegas,
                        tint: Color.appTextPrimary
                    )
                    Image(systemName: "arrow.right")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                    comparisonBox(label: row.modelLabel, value: comparisonPick.map { formatMarketLine($0.modelLine, row: row) } ?? row.model, tint: cardTint, highlighted: true)
                }
            }

            HStack(spacing: 12) {
                pickIcon(row, teamNameOverride: pick?.pickTeam, directionOverride: displayDirection, tintOverride: cardTint)
                VStack(alignment: .leading, spacing: 5) {
                    if mammoth {
                        HStack(spacing: 5) {
                            Image(systemName: "flame.fill")
                                .font(.system(size: 9, weight: .black))
                            Text("Rare 5u mammoth spot")
                                .font(.system(size: 9, weight: .black))
                                .tracking(0.5)
                        }
                        .foregroundStyle(mammothTint)
                    }
                    Text(pick?.pickLabel ?? row.pickTitle)
                        .font(.system(size: 13, weight: .heavy, design: .monospaced))
                        .foregroundStyle(cardTint)
                        .lineLimit(1)
                    bestBookRow(pick: pick, row: row)
                }
                Spacer(minLength: 0)
            }
        }
        // Flat, like `NFLGameBottomSheet.pickRow`. `WidgetCollapsingSection` is
        // already the card surface, so a filled+stroked box here made every CFB
        // market read as a panel inside a panel — WIDGET_DESIGN.md rule 3. The
        // mammoth call-out survives as the flame line and the section badge,
        // which is where NFL carries conviction too.
        .padding(.vertical, 2)
    }

    @ViewBuilder
    private func detailMetaPills(row: MarketRow, pick: CFBDryRunPickRow?, buckets: SignalBuckets) -> some View {
        let signalCount = buckets.supporting.count + buckets.contradicting.count
        let showConviction = pick?.hasPlay == true && isHighConviction(pick)
        if showConviction || signalCount > 0 {
            HStack(spacing: 7) {
                if showConviction {
                    detailMetaPill(
                        text: isMammothPick(pick) ? "Mammoth play" : "High conviction",
                        systemImage: "flame.fill",
                        tint: mammothTint
                    )
                }
                if signalCount > 0 {
                    detailMetaPill(
                        text: "\(signalCount) signal\(signalCount == 1 ? "" : "s")",
                        systemImage: "bolt.fill",
                        tint: Color.appTextSecondary
                    )
                }
            }
        }
    }

    private func detailMetaPill(text: String, systemImage: String, tint: Color) -> some View {
        HStack(spacing: 5) {
            Image(systemName: systemImage)
                .font(.system(size: 9, weight: .black))
            Text(text)
                .font(.system(size: 10, weight: .black))
                .lineLimit(1)
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(tint.opacity(0.13), in: Capsule())
        .overlay(Capsule().stroke(tint.opacity(0.30), lineWidth: 0.7))
    }

    private var mammothTint: Color { Color(hex: 0xF97316) }

    private var mammothBadge: some View {
        HStack(spacing: 4) {
            Image(systemName: "flame.fill")
                .font(.system(size: 8, weight: .black))
            Text("MAMMOTH")
                .font(.system(size: 8, weight: .black))
                .tracking(0.8)
        }
        .foregroundStyle(Color.appSurface)
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(
            LinearGradient(colors: [Color(hex: 0xF97316), Color(hex: 0xFACC15)], startPoint: .leading, endPoint: .trailing),
            in: Capsule()
        )
    }

    private func isMammothPick(_ pick: CFBDryRunPickRow?) -> Bool {
        pick?.isMammoth == true
            || pick?.conviction?.lowercased() == "mammoth"
            || pick?.recommendation?.uppercased().contains("MAMMOTH") == true
    }

    private func isHighConviction(_ pick: CFBDryRunPickRow?) -> Bool {
        guard let pick else { return false }
        let conviction = pick.conviction?.lowercased()
        return isMammothPick(pick) || conviction == "high" || pick.recommendation?.lowercased().contains("high conviction") == true
    }

    private func tint(forDirection direction: String?, fallback: Color) -> Color {
        switch direction {
        case "UNDER":
            return Color.appAccentRed
        case "OVER":
            return Color.appPrimary
        default:
            return fallback
        }
    }

    private func shouldShowComparison(for row: MarketRow) -> Bool {
        row.id != "moneyline" && row.id != "h1-ml"
    }

    // MARK: - Edge charts
    //
    // All seven market rows share `marketRecommendationRow`, so the chart is
    // resolved once here and every row picks up whichever visual its numbers
    // support. Anything missing a market OR a model number keeps the old
    // two-box comparison rather than drawing an empty chart.

    private enum MarketChart {
        case spread(line: Double, modelMargin: Double, pickAbbrev: String?, opponentAbbrev: String?)
        case total(market: Double, model: Double, marketCaption: String, modelCaption: String)
        case moneyline(price: Int, probability: Double, teamAbbrev: String?, teamName: String)
    }

    /// The pick-team side for a row, as HOME/AWAY. Prefers the dryrun pick row
    /// (which is already stored pick-side) and falls back to the game row's own
    /// pick column.
    private func chartSide(for row: MarketRow, pick: CFBDryRunPickRow?) -> String? {
        if let side = pick?.pickSide?.uppercased(), side.contains("HOME") || side.contains("AWAY") {
            return side.contains("HOME") ? "HOME" : "AWAY"
        }
        if let team = pick?.pickTeam {
            if team == game.homeTeam { return "HOME" }
            if team == game.awayTeam { return "AWAY" }
        }
        let fallback = (row.id == "h1-spread" ? game.h1SpreadPick : game.fgSpreadPick)?.uppercased()
        if let fallback, fallback.contains("HOME") { return "HOME" }
        if let fallback, fallback.contains("AWAY") { return "AWAY" }
        return nil
    }

    private func chartAbbrevs(side: String) -> (pick: String, opponent: String) {
        let home = CFBTeamAssets.abbr(for: game.homeTeam)
        let away = CFBTeamAssets.abbr(for: game.awayTeam)
        return side == "HOME" ? (home, away) : (away, home)
    }

    private func chartTeamName(side: String) -> String {
        side == "HOME" ? game.homeTeam : game.awayTeam
    }

    private func marketChart(for row: MarketRow, pick: CFBDryRunPickRow?) -> MarketChart? {
        switch row.id {
        case "spread", "h1-spread":
            guard let side = chartSide(for: row, pick: pick) else { return nil }
            let abbrevs = chartAbbrevs(side: side)
            // Two shapes feed the same bar. A dryrun pick row stores the line and
            // the fair spread ALREADY pick-side, so the fair spread is negated
            // once to become a margin. The game row stores everything
            // home-side, so it's flipped for an away pick and — for 1H — is
            // already a margin (`h1_pred_margin`), needing no negation at all.
            if row.id == "spread",
               let line = pick?.bestLine ?? pick?.vegasLine,
               let modelLine = pick?.modelLine,
               line.isFinite, modelLine.isFinite {
                return .spread(line: line, modelMargin: -modelLine,
                               pickAbbrev: abbrevs.pick, opponentAbbrev: abbrevs.opponent)
            }
            let close = row.id == "spread" ? game.fgSpreadClose : game.h1SpreadClose
            let homeMargin = row.id == "spread" ? game.fgPredMargin : game.h1PredMargin
            guard let close, let homeMargin, close.isFinite, homeMargin.isFinite else { return nil }
            let line = side == "HOME" ? close : -close
            let margin = side == "HOME" ? homeMargin : -homeMargin
            return .spread(line: line, modelMargin: margin,
                           pickAbbrev: abbrevs.pick, opponentAbbrev: abbrevs.opponent)

        case "total", "h1-total":
            let close = row.id == "total" ? game.fgTotalClose : game.h1TotalClose
            let projection = row.id == "total" ? game.fgPredTotal : game.h1PredTotal
            let market = (pick?.bestLine ?? pick?.vegasLine) ?? close
            let model = pick?.modelLine ?? projection
            guard let market, let model, market.isFinite, model.isFinite else { return nil }
            return .total(market: market, model: model, marketCaption: "Market", modelCaption: "Model")

        case "tt-home", "tt-away":
            let isHome = row.id == "tt-home"
            let team = isHome ? game.homeTeam : game.awayTeam
            let market = bestTeamTotalLine(
                pick: isHome ? game.ttHomePick : game.ttAwayPick,
                close: isHome ? game.ttHomeClose : game.ttAwayClose,
                over: isHome ? game.ttHomeBestOver : game.ttAwayBestOver,
                under: isHome ? game.ttHomeBestUnder : game.ttAwayBestUnder
            )
            let model = teamTotalProjection(team: team, storedPred: isHome ? game.ttHomePred : game.ttAwayPred)
            guard let market, let model, market.isFinite, model.isFinite else { return nil }
            return .total(market: market, model: model, marketCaption: "Market TT", modelCaption: "Proj Pts")

        case "moneyline", "h1-ml":
            guard let side = chartSide(for: row, pick: pick) ?? moneylinePickSide else { return nil }
            let homeClose = row.id == "moneyline" ? game.fgMlHomeClose : game.h1MlHomeClose
            let awayClose = row.id == "moneyline" ? game.fgMlAwayClose : game.h1MlAwayClose
            let fallbackPrice = side == "HOME" ? (homeClose ?? game.homeMl) : (awayClose ?? game.awayMl)
            let rawPrice = (pick?.vegasPrice ?? pick?.bestOdds).map { Int($0.rounded()) } ?? fallbackPrice
            guard let price = rawPrice, abs(price) >= 100 else { return nil }
            // Full-game win prob is stored home-side; complement it for an away pick.
            let modelProbability: Double? = pick?.modelLine ?? game.fgHomeWinProb.map { side == "HOME" ? $0 : 1 - $0 }
            guard let probability = modelProbability,
                  probability.isFinite, probability > 0, probability < 1 else { return nil }
            let abbrevs = chartAbbrevs(side: side)
            return .moneyline(price: price, probability: probability,
                              teamAbbrev: abbrevs.pick, teamName: chartTeamName(side: side))

        default:
            return nil
        }
    }

    @ViewBuilder
    private func marketChartView(_ chart: MarketChart) -> some View {
        switch chart {
        case let .spread(line, modelMargin, pickAbbrev, opponentAbbrev):
            SpreadCoverBar(
                line: line,
                modelMargin: modelMargin,
                scale: .cfb,
                pickAbbrev: pickAbbrev,
                opponentAbbrev: opponentAbbrev
            )
        case let .total(market, model, marketCaption, modelCaption):
            ModelEdgeRail(
                market: market,
                model: model,
                marketCaption: marketCaption,
                modelCaption: modelCaption,
                scale: .cfb
            )
        case let .moneyline(price, probability, teamAbbrev, _):
            MoneylineEdgeBar(
                price: price,
                modelProbability: probability,
                scale: .cfb,
                teamAbbrev: teamAbbrev
            )
        }
    }

    /// Section headline for rows whose chart carries its own generated copy, so
    /// the sentence and the graphic are computed from one set of numbers.
    /// Totals keep `pickSubtitle`, which already quotes the projection the rail
    /// draws.
    private func chartHeadline(for row: MarketRow) -> String? {
        guard let chart = marketChart(for: row, pick: dryRunPick(for: row)) else { return nil }
        switch chart {
        case let .spread(line, modelMargin, pickAbbrev, _):
            let sentence = SpreadCoverOutcome(line: line, modelMargin: modelMargin)
                .headline(team: pickAbbrev ?? "The pick")
            return row.id == "h1-spread" ? "First half — \(sentence)" : sentence
        case let .moneyline(price, probability, _, teamName):
            let sentence = MoneylineOutcome(price: price, modelProbability: probability, scale: .cfb)
                .headline(team: teamName)
            return row.id == "h1-ml" ? "First half — \(sentence)" : sentence
        case .total:
            return nil
        }
    }

    private func comparisonBox(label: String, value: String, tint: Color, highlighted: Bool = false) -> some View {
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
    private func bestBookRow(pick: CFBDryRunPickRow?, row: MarketRow) -> some View {
        if let board = sportsbookQuotes(for: row, pick: pick), board.best != nil {
            BestBookChip(
                quotes: board,
                selectedBookKeys: SportsbookPreference.decode(preferredBookKeysRaw),
                marketTitle: row.market,
                selectionTitle: pick?.pickLabel ?? row.pickTitle,
                formatLine: { formatMarketLine($0, row: row) }
            )
        } else if let pick {
            HStack(spacing: 7) {
                SportsbookLogoView(
                    logoURL: pick.bestBookLogo,
                    bookKey: pick.bestBook,
                    bookName: pick.bestBookName,
                    style: .compact
                )
                Text("\(pick.bestBookName ?? "Best book") \(formatMarketLine(pick.bestLine, row: row)) \(formatOdds(pick.bestOdds))")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
        } else if row.isDisplayOnly {
            Text(row.pickSubtitle)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
                .lineLimit(1)
        } else {
            Text(row.pickSubtitle)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
                .lineLimit(2)
        }
    }

    /// Supporting first, then contradicting — a reader scans for what backs the
    /// pick before what argues with it, and the amber pills group naturally at
    /// the end of the flow.
    private func signalPills(_ buckets: SignalBuckets) -> [PickSignalPillModel] {
        buckets.supporting.map { signalPill($0, contradicts: false) }
            + buckets.contradicting.map { signalPill($0, contradicts: true) }
    }

    private func signalPill(_ flag: CFBDryRunFlag, contradicts: Bool) -> PickSignalPillModel {
        let definition = flag.signalDefinition ?? CFBSignalDefinitionsService.definition(
            for: flag.source,
            in: signalDefinitionsBySource
        )
        return PickSignalPillModel(
            id: flag.id,
            title: definition?.displayName ?? flag.source,
            contradicts: contradicts,
            tint: signalColor(flag)
        )
    }

    @ViewBuilder
    private func pickIcon(_ row: MarketRow, teamNameOverride: String? = nil, directionOverride: String? = nil, tintOverride: Color? = nil) -> some View {
        let tint = tintOverride ?? row.tint
        if let direction = directionOverride ?? pickDirection(row.pick) {
            Image(systemName: direction == "UNDER" ? "arrow.down.circle.fill" : "arrow.up.circle.fill")
                .font(.system(size: 22, weight: .black))
                .foregroundStyle(tint)
                .frame(width: 42, height: 42)
                .background(tint.opacity(0.12), in: Circle())
        } else if let teamName = teamNameOverride ?? row.pickTeamName {
            GameCardTeamAvatar(teamName: teamName, sport: "cfb", size: 42, colors: CFBTeamColors.colorPair(for: teamName))
        } else {
            Image(systemName: row.iconName)
                .font(.system(size: 22, weight: .black))
                .foregroundStyle(tint)
                .frame(width: 42, height: 42)
                .background(tint.opacity(0.12), in: Circle())
        }
    }

    /// The team a signal is betting, when it names a side. Totals signals
    /// (OVER/UNDER) name no team, so the caller falls back to the bolt glyph.
    private func signalTeam(_ flag: CFBDryRunFlag) -> String? {
        let side = flag.side.trimmingCharacters(in: .whitespacesAndNewlines)
        let upper = side.uppercased()
        if upper.contains("HOME") { return game.homeTeam }
        if upper.contains("AWAY") { return game.awayTeam }
        // Team-total flags (and some structured sides) carry the club name.
        if side == game.homeTeam { return game.homeTeam }
        if side == game.awayTeam { return game.awayTeam }
        let homeAbbr = CFBTeamAssets.abbr(for: game.homeTeam).uppercased()
        let awayAbbr = CFBTeamAssets.abbr(for: game.awayTeam).uppercased()
        if upper == homeAbbr || upper.hasPrefix(homeAbbr + " ") { return game.homeTeam }
        if upper == awayAbbr || upper.hasPrefix(awayAbbr + " ") { return game.awayTeam }
        return nil
    }

    /// Concrete per-game pick copy — never raw HOME/AWAY.
    /// Mirrors web `resolveSignalDirectionDisplay` for the common cases.
    private func signalDirectionLabel(_ flag: CFBDryRunFlag) -> String {
        let market = flag.market.lowercased()
        let side = flag.side.trimmingCharacters(in: .whitespacesAndNewlines)
        let upper = side.uppercased()
        let half = market.hasPrefix("h1_") ? "1H " : ""

        if upper == "OVER" || upper == "UNDER" || upper.hasPrefix("OVER ") || upper.hasPrefix("UNDER ") {
            let isOver = upper.hasPrefix("OVER")
            let dir = isOver ? "Over" : "Under"
            if let line = flag.line { return "\(half)\(dir) \(num(line))" }
            let rest = side.split(separator: " ").dropFirst().joined(separator: " ")
            return rest.isEmpty ? "\(half)\(dir)" : "\(half)\(dir) \(rest)"
        }

        if let team = signalTeam(flag) {
            let abbr = CFBTeamAssets.abbr(for: team)
            if market.contains("moneyline") || market.hasSuffix("_ml") || market == "ml" {
                return market.hasPrefix("h1_") ? "\(abbr) 1H ML" : "\(abbr) ML"
            }
            if market.contains("team_total") {
                let hay = upper
                let dir = hay.contains("UNDER") ? "Under" : hay.contains("OVER") ? "Over" : nil
                if let dir, let line = flag.line { return "\(abbr) \(dir) \(num(line))" }
                if let dir { return "\(abbr) \(dir)" }
            }
            let prefix = market.hasPrefix("h1_") ? "\(abbr) 1H" : abbr
            if let line = flag.line {
                return "\(prefix) \(GameCardFormatting.formatSpread(line))"
            }
            return prefix
        }

        let line = lineText(flag.line)
        if line.isEmpty { return side }
        return "\(side) \(line)".trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Static def copy that is not a per-game pick (web `isGenericBetDirection`).
    private func isGenericBetDirection(_ value: String?) -> Bool {
        guard let value else { return true }
        let text = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if text.isEmpty { return true }
        return text == "side indicated by the rule"
            || text == "follow the indicated side"
            || text.hasPrefix("side indicated")
    }

    @ViewBuilder
    private func signalDefinitionSheet(_ flag: CFBDryRunFlag) -> some View {
        let resolvedDefinition = flag.signalDefinition ?? CFBSignalDefinitionsService.definition(for: flag.source, in: signalDefinitionsBySource)
        let team = signalTeam(flag)
        let direction = signalDirectionLabel(flag)
        NavigationStack {
            ScrollView {
                // Chart first, then the numbers, then the prose — the reader
                // asks "does this actually win?" before "what is it?".
                VStack(alignment: .leading, spacing: 22) {
                    HStack(spacing: 11) {
                        signalHeaderGlyph
                        VStack(alignment: .leading, spacing: 4) {
                            Text(resolvedDefinition?.displayName ?? flag.source)
                                .font(.system(size: 20, weight: .black))
                                .foregroundStyle(Color.appTextPrimary)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(marketLabel(flag.market))
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(Color.appTextMuted)
                        }
                    }

                    // Concrete pick — same job as web SignalDetail's Direction row.
                    HStack(spacing: 8) {
                        Text("DIRECTION")
                            .font(.system(size: 10, weight: .black))
                            .tracking(0.6)
                            .foregroundStyle(Color.appTextMuted)
                        if let team {
                            GameCardTeamAvatar(
                                teamName: team,
                                sport: "cfb",
                                size: 18,
                                colors: CFBTeamColors.colorPair(for: team)
                            )
                        }
                        Text(direction)
                            .font(.system(size: 15, weight: .black))
                            .foregroundStyle(Color.appTextPrimary)
                    }

                    if let oneLiner = resolvedDefinition?.oneLiner, !oneLiner.isEmpty {
                        Text(oneLiner)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.appTextPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    SignalBacktestChart(
                        backtestRaw: resolvedDefinition?.typicalHit,
                        performance: signalPerformance(for: flag)
                    )

                    if let def = resolvedDefinition {
                        VStack(alignment: .leading, spacing: 14) {
                            if let definition = def.definition { definitionLine("What it means", definition) }
                            if let why = def.whyItWorks { definitionLine("Why it works", why) }
                            // Skip generic "side indicated by the rule" — the Direction
                            // row above already names the concrete pick.
                            if let betDir = def.betDirection, !isGenericBetDirection(betDir) {
                                definitionLine("Bet direction", betDir)
                            }
                        }
                    } else {
                        Text("Signal definition unavailable.")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }
                .padding(18)
            }
            .background(Color.appSurface.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        selectedSignal = nil
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .black))
                            .foregroundStyle(Color.appTextPrimary)
                            .frame(width: 32, height: 32)
                            .background(Color.appSurfaceMuted.opacity(0.7), in: Circle())
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var signalHeaderGlyph: some View {
        Image(systemName: "waveform.path.ecg")
            .font(.system(size: 18, weight: .black))
            .foregroundStyle(Color.appAccentAmber)
            .frame(width: 42, height: 42)
            .background(Color.appAccentAmber.opacity(0.14), in: Circle())
            .accessibilityLabel("Signal")
    }

    private func signalPerformance(for flag: CFBDryRunFlag) -> SignalPerformance? {
        let def = flag.signalDefinition ?? CFBSignalDefinitionsService.definition(
            for: flag.source,
            in: signalDefinitionsBySource
        )
        if let key = def?.signalKey, let row = signalPerformanceByKey[key] {
            return row
        }
        if let key = def?.sourceKey, let row = signalPerformanceByKey[key] {
            return row
        }
        return signalPerformanceByKey[flag.source]
    }

    /// Prose block in the signal sheet. Sized for reading, not for a card — 8pt
    /// over 11pt was card chrome that got reused in a full-height sheet.
    private func definitionLine(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .black))
                .tracking(0.6)
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private var marketOddsSection: some View {
        WidgetCollapsingSection(title: "Market Odds", systemImage: "chart.bar.fill", iconTint: Color.appPrimary, headline: marketOddsHeadline ?? GameWidgetHeadlines.marketOdds()) {
            PolymarketWidget(league: "cfb", awayTeam: game.awayTeam, homeTeam: game.homeTeam, awayLabel: CFBTeamAssets.abbr(for: game.awayTeam), homeLabel: CFBTeamAssets.abbr(for: game.homeTeam), awayColor: awayColors.primary, homeColor: homeColors.primary) {
                marketOddsHeadline = $0
            }
        }
    }

    /// A quick, matchup-level read before the user gets into individual market
    /// predictions and their supporting signals.
    @ViewBuilder
    private var projectedScoreSection: some View {
        if let score = game.predictedScore {
            let awayAbbr = CFBTeamAssets.abbr(for: game.awayTeam)
            let homeAbbr = CFBTeamAssets.abbr(for: game.homeTeam)
            WidgetCollapsingSection(
                title: "Score Prediction",
                systemImage: "sportscourt",
                iconTint: Color.appPrimary
            ) {
                ProjectedScoreRow(
                    away: projectedScoreSide(
                        team: game.awayTeam,
                        abbreviation: awayAbbr,
                        score: score.away
                    ),
                    home: projectedScoreSide(
                        team: game.homeTeam,
                        abbreviation: homeAbbr,
                        score: score.home
                    )
                )
            }
        }
    }

    private func projectedScoreSide(
        team: String,
        abbreviation: String,
        score: Double
    ) -> ProjectedScoreRow.Side {
        let colors = CFBTeamColors.colorPair(for: team)
        return ProjectedScoreRow.Side(
            logoURL: CFBTeamAssets.logo(for: team),
            abbr: abbreviation,
            primary: colors.primary,
            secondary: colors.secondary,
            score: score
        )
    }

    private var honestySection: some View {
        WidgetCollapsingSection(title: "Display Notes", systemImage: "checkmark.shield.fill", iconTint: Color.appAccentBlue) {
            VStack(alignment: .leading, spacing: 8) {
                note("Full-game moneyline is context only for CFB, never a surfaced pick.")
                note("If spread edge is capped, the board shows model off-market and no play.")
                note("Tracking flags are paper-trade/small-sample spots, separated from active picks.")
            }
            .padding(12)
        }
    }

    private func note(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "info.circle.fill")
                .font(.system(size: 12))
                .foregroundStyle(Color.appAccentBlue)
            Text(text)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
        }
    }

    // MARK: - Bet board data

    private struct MarketRow: Identifiable {
        let id: String
        let market: String
        let sectionTitle: String
        let systemImage: String
        let prediction: String
        let vegasLabel: String
        let vegas: String
        let modelLabel: String
        let model: String
        let edge: String
        let pickTitle: String
        let pickSubtitle: String
        let pickTeamName: String?
        let iconName: String
        let pick: String
        let note: String?
        let tint: Color
        let isNoPlay: Bool
        let isDisplayOnly: Bool
        let signals: [CFBDryRunFlag]
    }

    private struct SignalBuckets {
        let supporting: [CFBDryRunFlag]
        let contradicting: [CFBDryRunFlag]

        var isEmpty: Bool { supporting.isEmpty && contradicting.isEmpty }
    }

    private struct TrendMetric {
        let label: String
        let value: String
        let chips: [String]
        let tint: Color
    }

    private struct TrendDetailSelection: Identifiable {
        let team: String
        let rowId: String
        let trend: CFBTeamTrendRow

        var id: String { "\(team)-\(rowId)" }
    }

    private struct TrendDetailGameRow: Identifiable {
        let id = UUID()
        let date: String
        let opponent: String
        let locationMarker: String
        let line: String
        let result: String
        let margin: Double?
        let extra: String?

        init(date: String, opponent: String, locationMarker: String, line: String, result: String, margin: Double? = nil, extra: String? = nil) {
            self.date = date
            self.opponent = opponent
            self.locationMarker = locationMarker
            self.line = line
            self.result = result
            self.margin = margin
            self.extra = extra
        }
    }

    private var marketRows: [MarketRow] {
        [
            MarketRow(
                id: "spread",
                market: "Spread",
                sectionTitle: "Spread Prediction",
                systemImage: "target",
                prediction: spreadPredictionText,
                vegasLabel: spreadSideLabel,
                vegas: spreadVegasLine,
                modelLabel: "Model line",
                model: spreadModelLine,
                edge: edgeText(spreadEdgeTowardPick),
                pickTitle: spreadPickTitle,
                pickSubtitle: spreadPickSubtitle,
                pickTeamName: teamName(forSide: game.fgSpreadPick),
                iconName: "target",
                pick: game.fgSpreadCapped == true ? "No Play" : spreadPickText,
                note: game.fgSpreadCapped == true ? "Model uncertain / off-market — no play." : nil,
                tint: Color.appPrimary,
                isNoPlay: game.fgSpreadCapped == true,
                isDisplayOnly: false,
                signals: game.fgSpreadCapped == true ? [] : signalsFor(market: "spread", side: game.fgSpreadPick)
            ),
            MarketRow(id: "total", market: "Total", sectionTitle: "Over/Under Prediction", systemImage: (game.fgTotalPick ?? "").uppercased() == "UNDER" ? "arrow.down.circle.fill" : "arrow.up.circle.fill", prediction: totalPredictionText, vegasLabel: "Vegas total", vegas: num(game.fgTotalClose), modelLabel: "Model total", model: num(game.fgPredTotal), edge: edgeText(game.fgTotalEdge), pickTitle: totalPickTitle, pickSubtitle: totalPickSubtitle, pickTeamName: nil, iconName: (game.fgTotalPick ?? "").uppercased() == "UNDER" ? "arrow.down.circle.fill" : "arrow.up.circle.fill", pick: pickText(game.fgTotalPick), note: totalContradictionNote, tint: totalTint(game.fgTotalPick), isNoPlay: false, isDisplayOnly: false, signals: signalsFor(market: "total", side: game.fgTotalPick)),
            MarketRow(id: "tt-home", market: "\(CFBTeamAssets.abbr(for: game.homeTeam)) team total", sectionTitle: "\(CFBTeamAssets.abbr(for: game.homeTeam)) Team Total", systemImage: "sum", prediction: teamTotalPredictionText(team: game.homeTeam, pred: teamTotalProjection(team: game.homeTeam, storedPred: game.ttHomePred)), vegasLabel: "Best Vegas TT", vegas: num(bestTeamTotalLine(pick: game.ttHomePick, close: game.ttHomeClose, over: game.ttHomeBestOver, under: game.ttHomeBestUnder)), modelLabel: "Predicted pts", model: num(teamTotalProjection(team: game.homeTeam, storedPred: game.ttHomePred)), edge: derivativeEdge(pred: teamTotalProjection(team: game.homeTeam, storedPred: game.ttHomePred), line: bestTeamTotalLine(pick: game.ttHomePick, close: game.ttHomeClose, over: game.ttHomeBestOver, under: game.ttHomeBestUnder)), pickTitle: teamTotalPickTitle(team: game.homeTeam, pick: game.ttHomePick, line: bestTeamTotalLine(pick: game.ttHomePick, close: game.ttHomeClose, over: game.ttHomeBestOver, under: game.ttHomeBestUnder)), pickSubtitle: teamTotalPickSubtitle(team: game.homeTeam, pred: teamTotalProjection(team: game.homeTeam, storedPred: game.ttHomePred), bestLine: bestTeamTotalLine(pick: game.ttHomePick, close: game.ttHomeClose, over: game.ttHomeBestOver, under: game.ttHomeBestUnder)), pickTeamName: game.homeTeam, iconName: "sum", pick: pickOrNoBet(game.ttHomePick), note: routeNote(pick: game.ttHomePick, over: game.ttHomeBestOver, under: game.ttHomeBestUnder), tint: totalTint(game.ttHomePick), isNoPlay: false, isDisplayOnly: false, signals: signalsFor(market: "team_total", side: game.ttHomePick, teamSide: "HOME")),
            MarketRow(id: "tt-away", market: "\(CFBTeamAssets.abbr(for: game.awayTeam)) team total", sectionTitle: "\(CFBTeamAssets.abbr(for: game.awayTeam)) Team Total", systemImage: "sum", prediction: teamTotalPredictionText(team: game.awayTeam, pred: teamTotalProjection(team: game.awayTeam, storedPred: game.ttAwayPred)), vegasLabel: "Best Vegas TT", vegas: num(bestTeamTotalLine(pick: game.ttAwayPick, close: game.ttAwayClose, over: game.ttAwayBestOver, under: game.ttAwayBestUnder)), modelLabel: "Predicted pts", model: num(teamTotalProjection(team: game.awayTeam, storedPred: game.ttAwayPred)), edge: derivativeEdge(pred: teamTotalProjection(team: game.awayTeam, storedPred: game.ttAwayPred), line: bestTeamTotalLine(pick: game.ttAwayPick, close: game.ttAwayClose, over: game.ttAwayBestOver, under: game.ttAwayBestUnder)), pickTitle: teamTotalPickTitle(team: game.awayTeam, pick: game.ttAwayPick, line: bestTeamTotalLine(pick: game.ttAwayPick, close: game.ttAwayClose, over: game.ttAwayBestOver, under: game.ttAwayBestUnder)), pickSubtitle: teamTotalPickSubtitle(team: game.awayTeam, pred: teamTotalProjection(team: game.awayTeam, storedPred: game.ttAwayPred), bestLine: bestTeamTotalLine(pick: game.ttAwayPick, close: game.ttAwayClose, over: game.ttAwayBestOver, under: game.ttAwayBestUnder)), pickTeamName: game.awayTeam, iconName: "sum", pick: pickOrNoBet(game.ttAwayPick), note: routeNote(pick: game.ttAwayPick, over: game.ttAwayBestOver, under: game.ttAwayBestUnder), tint: totalTint(game.ttAwayPick), isNoPlay: false, isDisplayOnly: false, signals: signalsFor(market: "team_total", side: game.ttAwayPick, teamSide: "AWAY")),
            MarketRow(id: "h1-spread", market: "1H spread", sectionTitle: "1H Spread Prediction", systemImage: "clock.badge", prediction: h1SpreadPredictionText, vegasLabel: h1SpreadSideLabel, vegas: h1SpreadVegasLine, modelLabel: "Model margin", model: signedNum(game.h1PredMargin), edge: "—", pickTitle: h1SpreadPickTitle, pickSubtitle: h1SpreadPickSubtitle, pickTeamName: teamName(forSide: game.h1SpreadPick), iconName: "clock.badge", pick: pickText(game.h1SpreadPick), note: nil, tint: Color.appPrimary, isNoPlay: false, isDisplayOnly: false, signals: signalsFor(market: "h1_spread", side: game.h1SpreadPick)),
            MarketRow(id: "h1-total", market: "1H total", sectionTitle: "1H Total Prediction", systemImage: "clock.arrow.circlepath", prediction: h1TotalPredictionText, vegasLabel: "Vegas 1H", vegas: num(game.h1TotalClose), modelLabel: "Model 1H", model: num(game.h1PredTotal), edge: derivativeEdge(pred: game.h1PredTotal, line: game.h1TotalClose), pickTitle: h1TotalPickTitle, pickSubtitle: h1TotalPickSubtitle, pickTeamName: nil, iconName: (game.h1TotalPick ?? "").uppercased() == "UNDER" ? "arrow.down.circle.fill" : "arrow.up.circle.fill", pick: pickText(game.h1TotalPick), note: nil, tint: totalTint(game.h1TotalPick), isNoPlay: false, isDisplayOnly: false, signals: signalsFor(market: "h1_total", side: game.h1TotalPick)),
            MarketRow(id: "moneyline", market: "Moneyline", sectionTitle: "Moneyline Prediction", systemImage: "dollarsign.circle.fill", prediction: moneylinePredictionText, vegasLabel: "Vegas ML", vegas: "\(CFBTeamAssets.abbr(for: game.awayTeam)) \(GameCardFormatting.formatMoneyline(game.awayMl)) / \(CFBTeamAssets.abbr(for: game.homeTeam)) \(GameCardFormatting.formatMoneyline(game.homeMl))", modelLabel: "Projected winner", model: moneylineLean, edge: "Display", pickTitle: moneylinePickTitle, pickSubtitle: "Best available moneyline for the projected winner.", pickTeamName: moneylinePickTeamName, iconName: "dollarsign.circle.fill", pick: "ML", note: nil, tint: Color.appTextSecondary, isNoPlay: false, isDisplayOnly: true, signals: signalsFor(market: "moneyline", side: moneylinePickSide))
        ]
    }

    // MARK: - Formatting

    private func smallChip(_ text: String, tint: Color) -> some View {
        Text(text)
            .font(.system(size: 9, weight: .black))
            .foregroundStyle(tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(tint.opacity(0.14), in: Capsule())
    }

    private func convictionChip(_ conviction: CFBFlagConviction) -> some View {
        Text(conviction.label)
            .font(.system(size: 9, weight: .black))
            .foregroundStyle(tierColor(conviction))
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(tierColor(conviction).opacity(0.12), in: Capsule())
    }

    private func tierColor(_ tier: CFBConvictionTier) -> Color {
        switch tier {
        case .mammoth: return Color(hex: 0xF97316)
        case .high: return Color(hex: 0xF97316)
        case .med: return Color(hex: 0x94A3B8)
        case .low: return Color(hex: 0xCD7F32)
        case .lean: return Color.appTextSecondary
        case .none: return Color.appBorder
        }
    }

    private func tierColor(_ tier: CFBFlagConviction) -> Color {
        switch tier {
        case .mammoth: return Color(hex: 0xF97316)
        case .t1: return Color(hex: 0xFACC15)
        case .t2: return Color(hex: 0x94A3B8)
        case .t3: return Color(hex: 0xCD7F32)
        case .track: return Color.appTextSecondary
        }
    }

    private func totalTint(_ pick: String?) -> Color {
        (pick ?? "").uppercased().contains("UNDER") ? Color.appAccentRed : Color.appPrimary
    }

    private func num(_ value: Double?) -> String {
        guard let value else { return "—" }
        return String(format: "%.1f", value)
    }

    private func signedNum(_ value: Double?) -> String {
        guard let value else { return "—" }
        return value >= 0 ? "+\(num(value))" : num(value)
    }

    private func signed(_ value: Double) -> String {
        value >= 0 ? "+\(num(value))" : num(value)
    }

    private func scoreText(_ value: Double) -> String {
        String(format: "%.1f", value)
    }

    private func pickText(_ pick: String?) -> String {
        guard let pick, !pick.isEmpty else { return "—" }
        return pickDirection(pick) ?? pick.uppercased()
    }

    private func pickOrNoBet(_ pick: String?) -> String {
        guard let pick, !pick.isEmpty else { return "No bet" }
        return pickDirection(pick) ?? pick.uppercased()
    }

    private func pickDirection(_ pick: String?) -> String? {
        let upper = (pick ?? "").uppercased()
        if upper.contains("UNDER") { return "UNDER" }
        if upper.contains("OVER") { return "OVER" }
        return nil
    }

    private func edgeText(_ value: Double?) -> String {
        guard let value else { return "—" }
        return signed(value)
    }

    private func derivativeEdge(pred: Double?, line: Double?) -> String {
        guard let pred, let line else { return "—" }
        return signed(pred - line)
    }

    private func routeNote(pick: String?, over: Double?, under: Double?) -> String? {
        switch (pick ?? "").uppercased() {
        case "OVER":
            return over.map { "Route to best OVER \(num($0))" }
        case "UNDER":
            return under.map { "Route to best UNDER \(num($0))" }
        default:
            return "Model points shown; no team-total bet fired."
        }
    }

    private var spreadPickText: String {
        guard let pick = game.fgSpreadPick, !pick.isEmpty else { return "—" }
        return "\(teamAbbr(forSide: pick)) \(spreadLineForSide(pick, model: false))"
    }

    private var spreadSideLabel: String {
        guard let pick = game.fgSpreadPick, !pick.isEmpty else { return "Vegas line" }
        return "Vegas \(teamAbbr(forSide: pick))"
    }

    private var spreadVegasLine: String {
        guard let pick = game.fgSpreadPick else { return GameCardFormatting.formatSpread(game.fgSpreadClose) }
        return spreadLineForSide(pick, model: false)
    }

    private var spreadModelLine: String {
        guard let pick = game.fgSpreadPick else { return GameCardFormatting.formatSpread(game.fgPredSpread) }
        return spreadLineForSide(pick, model: true)
    }

    private var spreadEdgeTowardPick: Double? {
        guard let edge = game.fgSpreadEdge else { return nil }
        return abs(edge)
    }

    private var spreadPredictionText: String {
        guard game.fgSpreadCapped != true else {
            return "Model is off-market here, so we do not surface a spread bet."
        }
        guard let pick = game.fgSpreadPick, !pick.isEmpty else {
            return "Model spread is \(GameCardFormatting.formatSpread(game.fgPredSpread)) vs market \(GameCardFormatting.formatSpread(game.fgSpreadClose))."
        }
        return "Model points to \(teamAbbr(forSide: pick)) at \(spreadVegasLine)."
    }

    private var totalPredictionText: String {
        return "Model projects \(num(game.fgPredTotal)) total points vs Vegas \(num(game.fgTotalClose))."
    }

    private func teamTotalPredictionText(team: String, pred: Double?) -> String {
        "Model projects \(CFBTeamAssets.abbr(for: team)) for \(num(pred)) points."
    }

    private var h1SpreadPredictionText: String {
        guard let pick = game.h1SpreadPick, !pick.isEmpty else {
            return "Model 1H margin is \(signedNum(game.h1PredMargin))."
        }
        return "Model leans \(teamAbbr(forSide: pick)) in the first half."
    }

    private var h1TotalPredictionText: String {
        "Model projects \(num(game.h1PredTotal)) first-half points vs Vegas \(num(game.h1TotalClose))."
    }

    private var moneylinePredictionText: String {
        "Projected score implies \(moneylineLean), but full-game ML stays display-only for CFB."
    }

    private var h1SpreadSideLabel: String {
        guard let pick = game.h1SpreadPick, !pick.isEmpty else { return "Vegas 1H" }
        return "Vegas \(teamAbbr(forSide: pick))"
    }

    private var h1SpreadVegasLine: String {
        guard let pick = game.h1SpreadPick, let close = game.h1SpreadClose else {
            return GameCardFormatting.formatSpread(game.h1SpreadClose)
        }
        return GameCardFormatting.formatSpread(pick.uppercased() == "HOME" ? close : -close)
    }

    private var moneylineLean: String {
        guard let score = game.predictedScore else { return "—" }
        let margin = score.home - score.away
        if margin > 0 {
            return "\(CFBTeamAssets.abbr(for: game.homeTeam)) by \(num(margin))"
        }
        if margin < 0 {
            return "\(CFBTeamAssets.abbr(for: game.awayTeam)) by \(num(abs(margin)))"
        }
        return "Pick'em"
    }

    private var spreadPickTitle: String {
        guard game.fgSpreadCapped != true, let side = game.fgSpreadPick, let team = teamName(forSide: side) else {
            return "No spread play"
        }
        return "\(team) \(spreadLineForSide(side, model: false))"
    }

    private var spreadPickSubtitle: String {
        guard game.fgSpreadCapped != true, let side = game.fgSpreadPick, let team = teamName(forSide: side) else {
            return "Model is off-market here, so this is not a bet."
        }
        return "\(team) is the side we think covers."
    }

    private var totalPickTitle: String {
        guard let direction = pickDirection(game.fgTotalPick) else { return "No total play" }
        return "\(direction) \(num(game.fgTotalClose))"
    }

    private var totalPickSubtitle: String {
        return "Projected total: \(num(game.fgPredTotal)) points."
    }

    private var totalContradictionNote: String? {
        nil
    }

    private func teamTotalProjection(team: String, storedPred: Double?) -> Double? {
        projectionPick(forTeamTotal: team)?.modelLine ?? storedPred
    }

    private func teamTotalPickTitle(team: String, pick: String?, line: Double?) -> String {
        guard let direction = pickDirection(pick) else { return "\(team) team total" }
        return "\(team) \(direction) \(num(line))"
    }

    private func teamTotalPickSubtitle(team: String, pred: Double?, bestLine: Double?) -> String {
        let diff = derivativeEdge(pred: pred, line: bestLine)
        return "\(team) predicted team total: \(num(pred)) pts · Difference vs best line: \(diff)."
    }

    private func bestTeamTotalLine(pick: String?, close: Double?, over: Double?, under: Double?) -> Double? {
        switch (pick ?? "").uppercased() {
        case "OVER":
            return over ?? close
        case "UNDER":
            return under ?? close
        default:
            return close
        }
    }

    private var h1SpreadPickTitle: String {
        guard let side = game.h1SpreadPick, let team = teamName(forSide: side) else { return "No 1H spread play" }
        return "\(team) \(h1SpreadVegasLine)"
    }

    private var h1SpreadPickSubtitle: String {
        guard let side = game.h1SpreadPick, let team = teamName(forSide: side) else {
            return "Model 1H margin: \(signedNum(game.h1PredMargin))."
        }
        return "\(team) is the first-half side."
    }

    private var h1TotalPickTitle: String {
        guard let direction = pickDirection(game.h1TotalPick) else { return "No 1H total play" }
        return "\(direction) \(num(game.h1TotalClose))"
    }

    private var h1TotalPickSubtitle: String {
        "Projected first-half total: \(num(game.h1PredTotal)) points."
    }

    private var moneylinePickTeamName: String? {
        guard let score = game.predictedScore else { return nil }
        if score.home > score.away { return game.homeTeam }
        if score.away > score.home { return game.awayTeam }
        return nil
    }

    private var moneylinePickSide: String? {
        guard let score = game.predictedScore else { return nil }
        if score.home > score.away { return "HOME" }
        if score.away > score.home { return "AWAY" }
        return nil
    }

    private var moneylinePickTitle: String {
        guard let team = moneylinePickTeamName else { return "Moneyline context" }
        return "\(team) projected winner"
    }

    private func teamAbbr(forSide side: String) -> String {
        side.uppercased() == "HOME" ? CFBTeamAssets.abbr(for: game.homeTeam) : CFBTeamAssets.abbr(for: game.awayTeam)
    }

    private func teamName(forSide side: String?) -> String? {
        guard let side else { return nil }
        let upper = side.uppercased()
        if upper.contains("HOME") { return game.homeTeam }
        if upper.contains("AWAY") { return game.awayTeam }
        return nil
    }

    private func spreadLineForSide(_ side: String, model: Bool) -> String {
        let homeValue = model ? game.fgPredSpread : game.fgSpreadClose
        guard let homeValue else { return "—" }
        return GameCardFormatting.formatSpread(side.uppercased() == "HOME" ? homeValue : -homeValue)
    }

    private func signalHeadline(_ flag: CFBDryRunFlag) -> String {
        "\(marketLabel(flag.market)) · \(signalDirectionLabel(flag))"
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func signalsFor(market: String, side: String?, teamSide: String? = nil) -> [CFBDryRunFlag] {
        let normalizedMarket = market.lowercased()
        let normalizedSide = side?.uppercased()
        let normalizedTeamSide = teamSide?.uppercased()
        return game.activeFlags
            .filter { $0.market.lowercased() == normalizedMarket }
            .filter { flag in
                guard let normalizedSide, !normalizedSide.isEmpty else { return false }
                let flagSide = flag.side.uppercased()
                let source = flag.source.uppercased()
                let display = flag.signalDefinition?.displayName.uppercased() ?? ""

                if let normalizedTeamSide {
                    let teamMatches = flagSide.contains(normalizedTeamSide)
                        || source.contains(normalizedTeamSide)
                        || display.contains(normalizedTeamSide)
                    let pickMatches = flagSide.contains(normalizedSide)
                        || source.contains(normalizedSide)
                        || display.contains(normalizedSide)
                    return teamMatches || pickMatches
                }

                return flagSide.contains(normalizedSide)
                    || source.contains(normalizedSide)
                    || display.contains(normalizedSide)
            }
            .sorted { a, b in
                if a.convictionTier.sortRank != b.convictionTier.sortRank {
                    return a.convictionTier.sortRank < b.convictionTier.sortRank
                }
                return (a.stakeUnits ?? 0) > (b.stakeUnits ?? 0)
            }
    }

    private func signalBuckets(for row: MarketRow) -> SignalBuckets {
        let signals = relevantSignals(for: row)
        let supporting = signals.filter { signalSupportsPick($0, row: row) }
        let contradicting = signals.filter { !signalSupportsPick($0, row: row) }
        return SignalBuckets(supporting: supporting, contradicting: contradicting)
    }

    private func relevantSignals(for row: MarketRow) -> [CFBDryRunFlag] {
        // Game-detail chips come from picks.signal_keys + counter_signal_keys (joined to
        // defs), not flags. Counter keys carry the OPPOSITE side so signalSupportsPick
        // sorts them into "Contradicts this pick" (e.g. the regime fade taking Tulsa
        // rendered under an Oklahoma State pick card).
        guard let pick = dryRunPick(for: row) else { return [] }
        let keys = FootballBlanketSignals.displayKeys(sport: "cfb", keys: pick.signalKeys)
        let counterKeys = FootballBlanketSignals.displayKeys(sport: "cfb", keys: pick.counterSignalKeys)
        guard !keys.isEmpty || !counterKeys.isEmpty else { return [] }

        func pickFlag(_ key: String, side: String?) -> CFBDryRunFlag {
            let definition = CFBSignalDefinitionsService.definition(for: key, in: signalDefinitionsBySource)
            return CFBDryRunFlag(
                id: "pick-\(pick.id.value)-\(signalIdentity(source: key, definition: definition))",
                gameId: game.gameId,
                source: key,
                market: normalizeCardGroup(pick.cardGroup),
                side: side ?? row.pick,
                line: pick.bestLine,
                price: pick.bestOdds.map { Int($0.rounded()) },
                edge: pick.edge,
                conviction: pickConvictionForFlag(pick.conviction),
                tier: pick.hasPlay == false ? "tracking" : "active",
                stakeUnits: nil,
                gradeLine: pick.bestBookName ?? pick.bestBook,
                mammoth: pick.isMammoth,
                signalDefinition: definition
            )
        }
        let opposite = ["HOME": "AWAY", "AWAY": "HOME", "OVER": "UNDER", "UNDER": "OVER"][pick.pickSide?.uppercased() ?? ""]
        return dedupedSignals(
            keys.map { pickFlag($0, side: pick.pickSide) }
            + counterKeys.map { pickFlag($0, side: opposite) }
        )
    }

    private func relevantGameFlags(for row: MarketRow) -> [CFBDryRunFlag] {
        let market = marketKey(for: row)
        return game.activeFlags
            .filter { $0.market.lowercased() == market }
            .filter { flag in
                guard row.id == "tt-home" || row.id == "tt-away" else { return true }
                let team = row.id == "tt-home" ? game.homeTeam : game.awayTeam
                let abbr = CFBTeamAssets.abbr(for: team)
                let haystack = "\(flag.side) \(flag.source) \(flag.signalDefinition?.displayName ?? "")".uppercased()
                return haystack.contains(team.uppercased())
                    || haystack.contains(abbr.uppercased())
                    || haystack.contains(row.id == "tt-home" ? "HOME" : "AWAY")
            }
            .sorted { a, b in
                if a.convictionTier.sortRank != b.convictionTier.sortRank {
                    return a.convictionTier.sortRank < b.convictionTier.sortRank
                }
                return (a.stakeUnits ?? 0) > (b.stakeUnits ?? 0)
            }
    }

    private func dedupedSignals(_ signals: [CFBDryRunFlag]) -> [CFBDryRunFlag] {
        var seen = Set<String>()
        return signals.filter { signal in
            seen.insert(signalIdentity(signal)).inserted
        }
    }

    private func signalIdentity(_ signal: CFBDryRunFlag) -> String {
        signalIdentity(source: signal.source, definition: signal.signalDefinition ?? CFBSignalDefinitionsService.definition(for: signal.source, in: signalDefinitionsBySource))
    }

    private func signalIdentity(source: String, definition: CFBSignalDefinition?) -> String {
        if let definition {
            return CFBSignalDefinitionsService.normalize(definition.sourceKey)
        }
        return CFBSignalDefinitionsService.normalize(source)
    }

    private func marketKey(for row: MarketRow) -> String {
        switch row.id {
        case "tt-home", "tt-away":
            return "team_total"
        case "h1-spread":
            return "h1_spread"
        case "h1-total":
            return "h1_total"
        case "h1-ml":
            return "h1_ml"
        case "moneyline":
            return "moneyline"
        default:
            return row.id
        }
    }

    private func signalSupportsPick(_ flag: CFBDryRunFlag, row: MarketRow) -> Bool {
        // Signal-driven plays leave the games-row pick empty ("No bet") while the card
        // displays the picks-row side — stance must compare against what the card shows,
        // or a supporting OVER chip renders amber (UNC@TCU TT, 2026 wk1).
        var pick = row.pick.uppercased()
        if normalizedOverUnder(pick) == nil, normalizedHomeAway(pick) == nil,
           let side = dryRunPick(for: row)?.pickSide?.uppercased(), !side.isEmpty {
            pick = side
        }

        if pick == "OVER" || pick == "UNDER" {
            if let flagDirection = normalizedOverUnder(flag.side) {
                return flagDirection == pick
            }
            let haystack = "\(flag.side) \(flag.source) \(flag.signalDefinition?.displayName ?? "")".uppercased()
            return haystack.contains(pick)
        }

        if let pickSide = pickSide(for: row), let flagSide = normalizedHomeAway(flag.side) {
            return flagSide == pickSide
        }

        if row.id == "tt-home" || row.id == "tt-away" {
            let expectedTeamSide = row.id == "tt-home" ? "HOME" : "AWAY"
            if let flagTeam = normalizedHomeAway(flag.side), flagTeam != expectedTeamSide {
                return false
            }
            if pick.contains("OVER") || pick.contains("UNDER"),
               let flagDirection = normalizedOverUnder(flag.side) {
                return flagDirection == (pick.contains("OVER") ? "OVER" : "UNDER")
            }
            if let team = row.pickTeamName {
                let haystack = "\(flag.side) \(flag.source)".uppercased()
                return haystack.contains(team.uppercased())
                    || haystack.contains(CFBTeamAssets.abbr(for: team).uppercased())
            }
        }

        return true
    }

    private func pickSide(for row: MarketRow) -> String? {
        if let side = dryRunPick(for: row)?.pickSide,
           !side.isEmpty,
           let normalized = normalizedHomeAway(side) ?? teamSideMentioned(in: side) {
            return normalized
        }
        if row.pick == "HOME" || row.pick == "AWAY" {
            return row.pick
        }
        if let team = row.pickTeamName {
            if team == game.homeTeam { return "HOME" }
            if team == game.awayTeam { return "AWAY" }
        }
        if let side = teamSideMentioned(in: row.pick) {
            return side
        }
        if let side = teamSideMentioned(in: row.pickTitle) {
            return side
        }
        return nil
    }

    private func teamSideMentioned(in value: String) -> String? {
        let upper = value.uppercased()
        if upper.contains(game.homeTeam.uppercased()) || upper.contains(CFBTeamAssets.abbr(for: game.homeTeam).uppercased()) {
            return "HOME"
        }
        if upper.contains(game.awayTeam.uppercased()) || upper.contains(CFBTeamAssets.abbr(for: game.awayTeam).uppercased()) {
            return "AWAY"
        }
        return nil
    }

    private func normalizedHomeAway(_ value: String) -> String? {
        let upper = value.uppercased()
        if upper.contains("HOME") { return "HOME" }
        if upper.contains("AWAY") { return "AWAY" }
        return nil
    }

    private func normalizedOverUnder(_ value: String) -> String? {
        let upper = value.uppercased()
        if upper.contains("UNDER") { return "UNDER" }
        if upper.contains("OVER") { return "OVER" }
        return nil
    }

    private func pickConvictionForFlag(_ conviction: String?) -> String {
        switch conviction?.lowercased() {
        case "mammoth": return "mammoth"
        case "high": return "T1"
        case "med", "medium": return "T2"
        case "low", "lean": return "T3"
        default: return conviction ?? "track"
        }
    }

    private func marketLabel(_ raw: String) -> String {
        switch raw.lowercased() {
        case "spread": return "Spread"
        case "total": return "Total"
        case "team_total": return "Team Total"
        case "h1_spread": return "1H Spread"
        case "h1_total": return "1H Total"
        case "h1_ml": return "1H ML"
        default:
            return raw.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private func lineText(_ value: Double?) -> String {
        guard let value else { return "" }
        return num(value)
    }

    private func bookText(_ value: String?) -> String {
        guard let value, !value.isEmpty else { return "" }
        return "@\(value)"
    }

    private func signalColor(_ flag: CFBDryRunFlag) -> Color {
        tierColor(flag.convictionTier)
    }

    private func unitsText(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }

    private func formatSpreadValue(_ value: Double?) -> String {
        guard let value else { return "—" }
        return GameCardFormatting.formatSpread(value)
    }

    private func formatMarketLine(_ value: Double?, row: MarketRow) -> String {
        guard let value else { return "—" }
        if row.id == "spread" || row.id == "h1-spread" {
            return GameCardFormatting.formatSpread(value)
        }
        if row.id == "moneyline" || row.id == "h1-ml" {
            return formatOdds(value)
        }
        return num(value)
    }

    private func formatOdds(_ value: Double?) -> String {
        guard let value else { return "" }
        let rounded = Int(value.rounded())
        return rounded > 0 ? "+\(rounded)" : "\(rounded)"
    }

    private func dryRunPick(for row: MarketRow) -> CFBDryRunPickRow? {
        dryRunPicks.first { pick in
            let group = normalizeCardGroup(pick.cardGroup)
            switch row.id {
            case "spread":
                return group == "spread"
            case "total":
                return group == "total"
            case "tt-home":
                return group == "team_total" && (pick.pickTeam == game.homeTeam || (pick.cardGroup ?? "").lowercased().contains("home"))
            case "tt-away":
                return group == "team_total" && (pick.pickTeam == game.awayTeam || (pick.cardGroup ?? "").lowercased().contains("away"))
            case "h1-spread":
                return group == "h1_spread"
            case "h1-total":
                return group == "h1_total"
            case "moneyline":
                return group == "moneyline"
            case "h1-ml":
                return group == "h1_ml"
            default:
                return false
            }
        }
    }

    private func comparisonPick(for row: MarketRow) -> CFBDryRunPickRow? {
        dryRunPick(for: row)
    }

    private func sportsbookQuotes(
        for row: MarketRow,
        pick: CFBDryRunPickRow?
    ) -> SportsbookMarketQuotes? {
        guard let bookOdds, let market = sportsbookMarket(for: row, pick: pick) else { return nil }
        let quotes = bookOdds.quotes(for: market)
        return quotes.quotes.isEmpty ? nil : quotes
    }

    private func sportsbookMarket(
        for row: MarketRow,
        pick: CFBDryRunPickRow?
    ) -> SportsbookMarket? {
        let side = (pick?.pickSide ?? "").uppercased()
        switch row.id {
        case "spread":
            let isHome = side.contains("HOME") || pick?.pickTeam == game.homeTeam
            return .spread(isHome: isHome)
        case "total":
            let direction = pickDirection(pick?.pickSide)
                ?? pickDirection(pick?.pickLabel)
                ?? pickDirection(row.pick)
            return .total(isOver: direction != "UNDER")
        case "moneyline":
            let isHome = side.contains("HOME") || pick?.pickTeam == game.homeTeam
            return .moneyline(isHome: isHome)
        default:
            // The full-game archive has no 1H or team-total columns.
            return nil
        }
    }

    private func projectionPick(forTeamTotal team: String) -> CFBDryRunPickRow? {
        dryRunPicks.first { pick in
            normalizeCardGroup(pick.cardGroup) == "team_total" && pick.pickTeam == team
        }
    }

    private func normalizeCardGroup(_ group: String?) -> String {
        let key = (group ?? "other").lowercased()
        if key.hasPrefix("team_total") { return "team_total" }
        if key == "ml" { return "moneyline" }
        if key == "h1_moneyline" { return "h1_ml" }
        return key
    }

    private func loadDryRunPicks() async {
        guard (game.runId ?? "").localizedCaseInsensitiveContains("dryrun") else {
            dryRunPicks = []
            return
        }
        await SportsbookCatalogService.shared.ensureLoaded()
        let cfb = await CFBSupabase.shared.client
        let definitions = await CFBSignalDefinitionsService.shared.definitionsBySource()
        signalDefinitionsBySource = definitions
        guard let rows: [CFBDryRunPickRow] = try? await cfb
            .from("cfb_dryrun_picks")
            .select("id,game_id,card_group,bet_type,pick_team,pick_side,pick_label,model_number,model_line,vegas_line,vegas_price,edge,best_book,best_book_name,best_book_logo,best_line,best_odds,conviction,is_mammoth,stake_units,recommendation,display_only,signal_keys,counter_signal_keys,has_play")
            .eq("game_id", value: game.gameId)
            .order("sort_order", ascending: true)
            .execute()
            .value
        else {
            dryRunPicks = []
            return
        }
        dryRunPicks = rows
    }

    private func loadSportsbookOdds() async {
        let kickoff = game.kickoff.flatMap { raw -> Date? in
            let fractional = ISO8601DateFormatter()
            fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let plain = ISO8601DateFormatter()
            plain.formatOptions = [.withInternetDateTime]
            return fractional.date(from: raw) ?? plain.date(from: raw)
        }
        bookOdds = await SportsbookOddsService.shared.cfbOdds(
            gameId: game.gameId,
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam,
            kickoff: kickoff
        )
    }

    private func loadTeamTrends() async {
        let cfb = await CFBSupabase.shared.client
        let season = game.season ?? Calendar.current.component(.year, from: Date())
        guard let rows: [CFBTeamTrendRow] = try? await cfb
            .from("cfb_team_trends")
            .select("team_name,season,through_week,games,su_w,su_l,su_record,ats_w,ats_l,ats_p,ats_pct,ou_o,ou_u,ou_p,over_pct,tt_o,tt_u,tt_games,tt_over_pct,h1_ats_w,h1_ats_l,h1_ats_p,h1_ats_games,h1_ats_pct,h1_ou_o,h1_ou_u,h1_ou_games,h1_over_pct,last5_su,last5_ats,last5_ou,game_log")
            .eq("season", value: season)
            .in("team_name", values: [game.awayTeam, game.homeTeam])
            .execute()
            .value
        else {
            teamTrendsByTeam = [:]
            return
        }
        teamTrendsByTeam = Dictionary(uniqueKeysWithValues: rows.map { ($0.teamName, $0) })
    }

    private struct CFBTeamTrendRow: Decodable, Sendable {
        let teamName: String
        let season: Int?
        let throughWeek: Int?
        let games: Int
        let suW: Int
        let suL: Int
        let suRecord: String
        let atsW: Int
        let atsL: Int
        let atsP: Int
        let atsPct: Double?
        let ouO: Int
        let ouU: Int
        let ouP: Int
        let overPct: Double?
        let ttO: Int
        let ttU: Int
        let ttGames: Int
        let ttOverPct: Double?
        let h1AtsW: Int
        let h1AtsL: Int
        let h1AtsP: Int
        let h1AtsGames: Int
        let h1AtsPct: Double?
        let h1OuO: Int
        let h1OuU: Int
        let h1OuGames: Int
        let h1OverPct: Double?
        let last5Su: [String]
        let last5Ats: [String]
        let last5Ou: [String]
        let gameLog: [CFBTeamTrendGameLog]

        var last5Logs: [CFBTeamTrendGameLog] { Array(gameLog.prefix(5)) }

        var sampleLabel: String {
            if let throughWeek {
                return "\(games) games · thru W\(throughWeek)"
            }
            return "\(games) games"
        }

        enum CodingKeys: String, CodingKey {
            case teamName = "team_name"
            case season
            case throughWeek = "through_week"
            case games
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
            case ttGames = "tt_games"
            case ttOverPct = "tt_over_pct"
            case h1AtsW = "h1_ats_w"
            case h1AtsL = "h1_ats_l"
            case h1AtsP = "h1_ats_p"
            case h1AtsGames = "h1_ats_games"
            case h1AtsPct = "h1_ats_pct"
            case h1OuO = "h1_ou_o"
            case h1OuU = "h1_ou_u"
            case h1OuGames = "h1_ou_games"
            case h1OverPct = "h1_over_pct"
            case last5Su = "last5_su"
            case last5Ats = "last5_ats"
            case last5Ou = "last5_ou"
            case gameLog = "game_log"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            teamName = try c.decode(String.self, forKey: .teamName)
            season = try c.decodeIfPresent(Int.self, forKey: .season)
            throughWeek = try c.decodeIfPresent(Int.self, forKey: .throughWeek)
            games = try c.decodeIfPresent(Int.self, forKey: .games) ?? 0
            suW = try c.decodeIfPresent(Int.self, forKey: .suW) ?? 0
            suL = try c.decodeIfPresent(Int.self, forKey: .suL) ?? 0
            suRecord = try c.decodeIfPresent(String.self, forKey: .suRecord) ?? "\(suW)-\(suL)"
            atsW = try c.decodeIfPresent(Int.self, forKey: .atsW) ?? 0
            atsL = try c.decodeIfPresent(Int.self, forKey: .atsL) ?? 0
            atsP = try c.decodeIfPresent(Int.self, forKey: .atsP) ?? 0
            atsPct = try c.decodeIfPresent(Double.self, forKey: .atsPct)
            ouO = try c.decodeIfPresent(Int.self, forKey: .ouO) ?? 0
            ouU = try c.decodeIfPresent(Int.self, forKey: .ouU) ?? 0
            ouP = try c.decodeIfPresent(Int.self, forKey: .ouP) ?? 0
            overPct = try c.decodeIfPresent(Double.self, forKey: .overPct)
            ttO = try c.decodeIfPresent(Int.self, forKey: .ttO) ?? 0
            ttU = try c.decodeIfPresent(Int.self, forKey: .ttU) ?? 0
            ttGames = try c.decodeIfPresent(Int.self, forKey: .ttGames) ?? 0
            ttOverPct = try c.decodeIfPresent(Double.self, forKey: .ttOverPct)
            h1AtsW = try c.decodeIfPresent(Int.self, forKey: .h1AtsW) ?? 0
            h1AtsL = try c.decodeIfPresent(Int.self, forKey: .h1AtsL) ?? 0
            h1AtsP = try c.decodeIfPresent(Int.self, forKey: .h1AtsP) ?? 0
            h1AtsGames = try c.decodeIfPresent(Int.self, forKey: .h1AtsGames) ?? 0
            h1AtsPct = try c.decodeIfPresent(Double.self, forKey: .h1AtsPct)
            h1OuO = try c.decodeIfPresent(Int.self, forKey: .h1OuO) ?? 0
            h1OuU = try c.decodeIfPresent(Int.self, forKey: .h1OuU) ?? 0
            h1OuGames = try c.decodeIfPresent(Int.self, forKey: .h1OuGames) ?? 0
            h1OverPct = try c.decodeIfPresent(Double.self, forKey: .h1OverPct)
            last5Su = (try? c.decodeIfPresent(FlexibleStringList.self, forKey: .last5Su))?.values ?? []
            last5Ats = (try? c.decodeIfPresent(FlexibleStringList.self, forKey: .last5Ats))?.values ?? []
            last5Ou = (try? c.decodeIfPresent(FlexibleStringList.self, forKey: .last5Ou))?.values ?? []
            gameLog = (try? c.decodeIfPresent([CFBTeamTrendGameLog].self, forKey: .gameLog)) ?? []
        }
    }

    private struct CFBTeamTrendGameLog: Decodable, Sendable {
        let week: Int?
        let date: String?
        let opp: String?
        let isHome: Bool?
        let neutralSite: Bool?
        let ptsFor: Int?
        let ptsAgainst: Int?
        let su: String?
        let spread: Double?
        let ats: String?
        let coverMargin: Double?
        let total: Double?
        let ou: String?
        let totalPoints: Int?
        let ouMargin: Double?
        let ttLine: Double?
        let tt: String?
        let teamPts: Int?
        let ttMargin: Double?
        let h1Spread: Double?
        let h1Ats: String?
        let h1CoverMargin: Double?
        let h1Total: Double?
        let h1Ou: String?
        let h1OuMargin: Double?

        enum CodingKeys: String, CodingKey {
            case week
            case date
            case opp
            case isHome = "is_home"
            case neutralSite = "neutral_site"
            case neutral
            case ptsFor = "pts_for"
            case ptsAgainst = "pts_against"
            case su
            case spread
            case ats
            case coverMargin = "cover_margin"
            case total
            case ou
            case totalPoints = "total_points"
            case ouMargin = "ou_margin"
            case ttLine = "tt_line"
            case tt
            case teamPts = "team_pts"
            case ttMargin = "tt_margin"
            case h1Spread = "h1_spread"
            case h1Ats = "h1_ats"
            case h1CoverMargin = "h1_cover_margin"
            case h1Total = "h1_total"
            case h1Ou = "h1_ou"
            case h1OuMargin = "h1_ou_margin"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            week = try c.decodeIfPresent(Int.self, forKey: .week)
            date = try c.decodeIfPresent(String.self, forKey: .date)
            opp = try c.decodeIfPresent(String.self, forKey: .opp)
            isHome = try c.decodeIfPresent(Bool.self, forKey: .isHome)
            neutralSite = try c.decodeIfPresent(Bool.self, forKey: .neutralSite) ?? c.decodeIfPresent(Bool.self, forKey: .neutral)
            ptsFor = try c.decodeIfPresent(Int.self, forKey: .ptsFor)
            ptsAgainst = try c.decodeIfPresent(Int.self, forKey: .ptsAgainst)
            su = try c.decodeIfPresent(String.self, forKey: .su)
            spread = try c.decodeIfPresent(Double.self, forKey: .spread)
            ats = try c.decodeIfPresent(String.self, forKey: .ats)
            coverMargin = try c.decodeIfPresent(Double.self, forKey: .coverMargin)
            total = try c.decodeIfPresent(Double.self, forKey: .total)
            ou = try c.decodeIfPresent(String.self, forKey: .ou)
            totalPoints = try c.decodeIfPresent(Int.self, forKey: .totalPoints)
            ouMargin = try c.decodeIfPresent(Double.self, forKey: .ouMargin)
            ttLine = try c.decodeIfPresent(Double.self, forKey: .ttLine)
            tt = try c.decodeIfPresent(String.self, forKey: .tt)
            teamPts = try c.decodeIfPresent(Int.self, forKey: .teamPts)
            ttMargin = try c.decodeIfPresent(Double.self, forKey: .ttMargin)
            h1Spread = try c.decodeIfPresent(Double.self, forKey: .h1Spread)
            h1Ats = try c.decodeIfPresent(String.self, forKey: .h1Ats)
            h1CoverMargin = try c.decodeIfPresent(Double.self, forKey: .h1CoverMargin)
            h1Total = try c.decodeIfPresent(Double.self, forKey: .h1Total)
            h1Ou = try c.decodeIfPresent(String.self, forKey: .h1Ou)
            h1OuMargin = try c.decodeIfPresent(Double.self, forKey: .h1OuMargin)
        }
    }

    private struct CFBDryRunPickRow: Decodable, Sendable {
        let id: FlexibleText
        let gameId: FlexibleText
        let cardGroup: String?
        let betType: String?
        let pickTeam: String?
        let pickSide: String?
        let pickLabel: String?
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
        let isMammoth: Bool?
        let stakeUnits: Double?
        let recommendation: String?
        let displayOnly: Bool?
        let signalKeys: [String]
        let counterSignalKeys: [String]
        let hasPlay: Bool?

        enum CodingKeys: String, CodingKey {
            case id
            case gameId = "game_id"
            case cardGroup = "card_group"
            case betType = "bet_type"
            case pickTeam = "pick_team"
            case pickSide = "pick_side"
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
            case isMammoth = "is_mammoth"
            case stakeUnits = "stake_units"
            case recommendation
            case displayOnly = "display_only"
            case signalKeys = "signal_keys"
            case counterSignalKeys = "counter_signal_keys"
            case hasPlay = "has_play"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(FlexibleText.self, forKey: .id)
            gameId = try c.decode(FlexibleText.self, forKey: .gameId)
            cardGroup = try c.decodeIfPresent(String.self, forKey: .cardGroup)
            betType = try c.decodeIfPresent(String.self, forKey: .betType)
            pickTeam = try c.decodeIfPresent(String.self, forKey: .pickTeam)
            pickSide = try c.decodeIfPresent(String.self, forKey: .pickSide)
            pickLabel = try c.decodeIfPresent(String.self, forKey: .pickLabel)
            modelLine = try c.decodeIfPresent(Double.self, forKey: .modelLine) ?? c.decodeIfPresent(Double.self, forKey: .modelNumber)
            vegasLine = try c.decodeIfPresent(Double.self, forKey: .vegasLine)
            vegasPrice = try c.decodeIfPresent(Double.self, forKey: .vegasPrice)
            edge = try c.decodeIfPresent(Double.self, forKey: .edge)
            bestBook = try c.decodeIfPresent(String.self, forKey: .bestBook)
            bestBookName = try c.decodeIfPresent(String.self, forKey: .bestBookName)
            bestBookLogo = try c.decodeIfPresent(String.self, forKey: .bestBookLogo)
            bestLine = try c.decodeIfPresent(Double.self, forKey: .bestLine)
            bestOdds = try c.decodeIfPresent(Double.self, forKey: .bestOdds)
            conviction = try c.decodeIfPresent(String.self, forKey: .conviction)
            isMammoth = try c.decodeIfPresent(Bool.self, forKey: .isMammoth)
            stakeUnits = try c.decodeIfPresent(Double.self, forKey: .stakeUnits)
            recommendation = try c.decodeIfPresent(String.self, forKey: .recommendation)
            displayOnly = try c.decodeIfPresent(Bool.self, forKey: .displayOnly)
            signalKeys = (try? c.decodeIfPresent(FlexibleStringList.self, forKey: .signalKeys))?.values ?? []
            counterSignalKeys = (try? c.decodeIfPresent(FlexibleStringList.self, forKey: .counterSignalKeys))?.values ?? []
            hasPlay = try c.decodeIfPresent(Bool.self, forKey: .hasPlay)
        }
    }

    private struct FlexibleStringList: Decodable, Sendable {
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

    private struct FlexibleText: Decodable, Sendable {
        let value: String

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let s = try? c.decode(String.self) {
                value = s
            } else if let i = try? c.decode(Int.self) {
                value = String(i)
            } else if let d = try? c.decode(Double.self) {
                value = d.rounded() == d ? String(Int(d)) : String(d)
            } else {
                value = ""
            }
        }
    }
}
