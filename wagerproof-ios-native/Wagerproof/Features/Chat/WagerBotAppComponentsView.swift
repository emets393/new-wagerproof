import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Renders a V2 chat `appComponents` block — the rich, tappable components that
/// mirror the app's real list items / widgets. Dispatches each component by
/// `type`; tapping a component with a `nav` descriptor calls `onNav`, which the
/// chat view maps onto the app's existing navigation (cross-tab handoff).
///
/// V2 ONLY (wagerbot-agent). The legacy `chatWidgets`/`gameCards` renderers are
/// untouched.
struct WagerBotAppComponentsView: View {
    let summary: String?
    let components: [WagerBotAppComponent]
    let ui: WagerBotUiTokens
    var onNav: (WagerBotChatNav) -> Void

    /// Fixed card width when horizontally scrolling, sized to peek the next column.
    private var cardWidth: CGFloat { min(290, UIScreen.main.bounds.width * 0.74) }

    /// Components grouped into columns of up to 2 → at most two rows on screen.
    private var columns: [[WagerBotAppComponent]] {
        stride(from: 0, to: components.count, by: 2).map { start in
            Array(components[start ..< min(start + 2, components.count)])
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let summary, !summary.isEmpty {
                // Markdown, not plain Text — summaries arrive with **bold** etc.
                WagerBotMarkdownText(
                    summary,
                    baseFont: .system(size: 14, weight: .regular),
                    primaryColor: ui.primaryText,
                    secondaryColor: ui.mutedText
                )
                .padding(.leading, 4)
                .padding(.trailing, 12)
            }
            if components.count <= 1 {
                // Single component reads best full-width.
                ForEach(components) { component in
                    WagerBotComponentCard(component: component, ui: ui, width: nil, onNav: onNav)
                }
            } else {
                // Lists are capped at two rows and scroll horizontally — columns
                // of up to 2 cards laid left-to-right.
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 10) {
                        ForEach(Array(columns.enumerated()), id: \.offset) { _, column in
                            VStack(spacing: 10) {
                                ForEach(column) { component in
                                    WagerBotComponentCard(component: component, ui: ui, width: cardWidth, onNav: onNav)
                                }
                            }
                            .frame(width: cardWidth)
                        }
                    }
                    .padding(.trailing, 4)
                }
                .scrollClipDisabled()
            }
        }
    }
}

// MARK: - Card chrome + dispatch

private struct WagerBotComponentCard: View {
    let component: WagerBotAppComponent
    let ui: WagerBotUiTokens
    /// Fixed width when shown in the horizontal 2-row scroller; nil = full width.
    var width: CGFloat?
    var onNav: (WagerBotChatNav) -> Void

    @Environment(\.colorScheme) private var colorScheme

    private var isTappable: Bool {
        guard let nav = component.nav else { return false }
        return nav.kind != "none"
    }

    var body: some View {
        Group {
            if isTappable {
                Button {
                    if let nav = component.nav {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        onNav(nav)
                    }
                } label: { cardBody }
                .buttonStyle(.plain)
            } else {
                cardBody
            }
        }
    }

    @ViewBuilder
    private var cardBody: some View {
        let content = ComponentContent(component: component, ui: ui)
        HStack(alignment: .center, spacing: 8) {
            content
                .frame(maxWidth: .infinity, alignment: .leading)
            if isTappable {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(ui.mutedText.opacity(0.7))
            }
        }
        .padding(12)
        .background {
            // Real Liquid Glass surface, matching GameRowCard: translucent
            // material dimmed slightly in dark mode + a hairline border.
            let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
            ZStack {
                shape.fill(.ultraThinMaterial).opacity(colorScheme == .dark ? 0.78 : 1)
                shape.strokeBorder(ui.borderColor.opacity(0.5), lineWidth: 0.5)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
        .frame(width: width, alignment: .leading)
    }
}

/// Type dispatch — each case is a compact card mirroring a real app surface.
private struct ComponentContent: View {
    let component: WagerBotAppComponent
    let ui: WagerBotUiTokens

    var body: some View {
        switch component.type {
        case "game", "value":
            GameComponentView(c: component, ui: ui, isValue: component.type == "value")
        case "prop":
            PropComponentView(c: component, ui: ui)
        case "agent":
            AgentComponentView(c: component, ui: ui)
        case "agent_pick":
            AgentPickComponentView(c: component, ui: ui)
        case "editor_pick":
            EditorPickComponentView(c: component, ui: ui)
        case "tool":
            ToolComponentView(c: component, ui: ui)
        case "model_projection":
            ModelProjectionComponentView(c: component, ui: ui)
        case "polymarket":
            PolymarketComponentView(c: component, ui: ui)
        case "betting_trends":
            BettingTrendsComponentView(c: component, ui: ui)
        case "model_accuracy":
            ModelAccuracyComponentView(c: component, ui: ui)
        case "injury":
            InjuryComponentView(c: component, ui: ui)
        case "weather":
            WeatherComponentView(c: component, ui: ui)
        case "public_betting":
            PublicBettingComponentView(c: component, ui: ui)
        default:
            // Forward-compatible: unknown component → its title/analysis text.
            UnknownComponentView(c: component, ui: ui)
        }
    }
}

// MARK: - Shared bits

private struct ComponentHeader: View {
    let icon: String
    let title: String
    let accent: Color
    let ui: WagerBotUiTokens
    var trailing: String? = nil

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(accent)
            Text(title)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(ui.mutedText)
                .textCase(.uppercase)
            Spacer(minLength: 4)
            if let trailing {
                Text(trailing)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(ui.mutedText)
            }
        }
    }
}

/// Resolve a team's `TeamColorPair` the same way the sport game cards do
/// (NBA/NFL/MLB real tables; CFB/NCAAB hashed fallback).
private func chatTeamColorPair(team: String, sport: String) -> TeamColorPair {
    switch sport.lowercased() {
    case "nba": return NBATeams.colorPair(for: team)
    case "nfl": return NFLTeamColors.colorPair(for: team)
    case "mlb":
        let c = MLBTeams.colors(for: team)
        return TeamColorPair(primary: Color(hex: Int(c.primary)), secondary: Color(hex: Int(c.secondary)))
    default: return FallbackTeamColor.colorPair(for: team) // cfb, ncaab
    }
}

/// Contrast plate behind a same-color logo so it doesn't vanish on its disc.
/// Direct port of GameRowCard.logoContrastPlate.
private func chatContrastPlate(for primary: Color, scheme: ColorScheme) -> Color? {
    let lum = primary.relativeLuminance
    switch scheme {
    case .dark: return lum < 0.45 ? Color(white: 0.78).opacity(0.15) : nil
    default: return lum > 0.6 ? Color.black.opacity(0.55) : nil
    }
}

/// Real ESPN team logo on a team-tinted Liquid Glass disc — a direct port of
/// GameRowCard's `avatar`: real `TeamColorPair`, `teamVisible` lift, a contrast
/// plate behind same-color logos, `teamGlassDisc(tint: 0.5)`, initials fallback.
private struct ChatTeamLogo: View {
    let team: String
    let sport: String
    var size: CGFloat = 36

    @Environment(\.colorScheme) private var colorScheme
    private var league: SportLeague { SportLeague(rawValue: sport.lowercased()) ?? .nba }

    var body: some View {
        let pair = chatTeamColorPair(team: team, sport: sport)
        let primary = pair.primary.teamVisible(in: colorScheme)
        let secondary = pair.secondary.teamVisible(in: colorScheme)
        let plate = chatContrastPlate(for: primary, scheme: colorScheme)
        ZStack {
            if let s = OutlierTeamPalette.logoURL(for: team, sport: league), let url = URL(string: s) {
                AsyncImage(url: url) { phase in
                    if case .success(let img) = phase {
                        ZStack {
                            if let plate { Circle().fill(plate) }
                            img.resizable().scaledToFit()
                                .padding(plate != nil ? size * 0.07 : 0)
                        }
                    } else {
                        initials
                    }
                }
                .frame(width: size * 0.82, height: size * 0.82)
                .clipShape(Circle())
            } else {
                initials
            }
        }
        .frame(width: size, height: size)
        .teamGlassDisc(primary: primary, secondary: secondary, tint: 0.5)
        .shadow(color: primary.opacity(0.22), radius: 5, x: 0, y: 1)
    }

    private var initials: some View {
        Text(OutlierTeamPalette.initials(for: team))
            .font(.system(size: size * 0.32, weight: .bold))
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.25), radius: 1, x: 0, y: 1)
    }
}

/// Two overlapping team-logo discs that liquid-merge (away over home) —
/// mirrors the overlapping-avatar treatment on the real game/outlier cards.
private struct ChatMatchupLogos: View {
    let awayTeam: String
    let homeTeam: String
    let sport: String
    var size: CGFloat = 36

    var body: some View {
        LiquidGlassMergeContainer(spacing: 16) {
            HStack(spacing: -8) {
                ChatTeamLogo(team: awayTeam, sport: sport, size: size)
                ChatTeamLogo(team: homeTeam, sport: sport, size: size)
            }
        }
    }
}

private func pill(_ text: String, color: Color) -> some View {
    Text(text)
        .font(.system(size: 11, weight: .bold))
        .foregroundStyle(color)
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(Capsule().fill(color.opacity(0.14)))
}

private func edgeColor(_ edge: Double?) -> Color {
    guard let e = edge else { return .gray }
    if e >= 5 { return Color(hex: 0x00C853) }
    if e >= 2 { return Color(hex: 0x8BC34A) }
    return .gray
}

private func fmtSigned(_ v: Double?) -> String {
    guard let v else { return "—" }
    return v > 0 ? "+\(trimNum(v))" : trimNum(v)
}
private func trimNum(_ v: Double) -> String {
    v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v)
}

/// Format a game time for display. ISO timestamps (e.g. "2026-06-10T00:40:00+00:00")
/// are parsed and shown as ET clock time; already-friendly strings pass through.
private func gameTimeLabel(_ raw: String?) -> String? {
    guard let raw, !raw.isEmpty else { return nil }
    guard raw.contains("T") else { return raw }
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime]
    var date = iso.date(from: raw)
    if date == nil {
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        date = iso.date(from: raw)
    }
    guard let d = date else { return raw }
    let out = DateFormatter()
    out.timeZone = TimeZone(identifier: "America/New_York")
    out.dateFormat = "h:mm a"
    return out.string(from: d) + " ET"
}

// MARK: - Game / Value

private struct GameComponentView: View {
    let c: WagerBotAppComponent
    let ui: WagerBotUiTokens
    let isValue: Bool

    var body: some View {
        let sport = c.string("sport") ?? "nba"
        let awayName = c.string("away_team") ?? c.string("away_abbr") ?? "Away"
        let homeName = c.string("home_team") ?? c.string("home_abbr") ?? "Home"
        let awayAbbr = c.string("away_abbr") ?? OutlierTeamPalette.initials(for: awayName)
        let homeAbbr = c.string("home_abbr") ?? OutlierTeamPalette.initials(for: homeName)
        return VStack(alignment: .leading, spacing: 8) {
            ComponentHeader(
                icon: isValue ? "bolt.fill" : "sportscourt.fill",
                title: isValue ? "Value Play" : sport.uppercased(),
                accent: isValue ? Color(hex: 0xF59E0B) : ui.accent,
                ui: ui,
                trailing: gameTimeLabel(c.string("game_time"))
            )
            HStack(spacing: 10) {
                ChatMatchupLogos(awayTeam: awayName, homeTeam: homeName, sport: sport)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(awayAbbr) @ \(homeAbbr)")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(ui.primaryText)
                    if let pick = c.string("pick"), !pick.isEmpty {
                        Text(pick)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(isValue ? Color(hex: 0xF59E0B) : ui.accent)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }
            HStack(spacing: 6) {
                if let spread = c.string("spread") { pill(spread, color: ui.accent) }
                if let total = c.string("total") { pill("O/U \(total)", color: ui.accent) }
                if let edge = c.double("spread_edge"), abs(edge) >= 0.5 {
                    pill("Edge \(fmtSigned(edge))", color: edgeColor(abs(edge)))
                }
            }
        }
    }
}

// MARK: - Prop

private struct PropComponentView: View {
    let c: WagerBotAppComponent
    let ui: WagerBotUiTokens
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ComponentHeader(icon: "figure.basketball", title: "Player Prop", accent: Color(hex: 0x14B8A6), ui: ui, trailing: c.string("team"))
            Text(c.string("player") ?? "Player")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(ui.primaryText)
            HStack(spacing: 6) {
                if let line = c.string("line") { pill(line, color: ui.accent) }
                if let hit = c.double("l10_hit_rate") { pill("L10 \(Int(hit))%", color: edgeColor(hit/10)) }
                if let trend = c.string("trend") { pill(trend, color: ui.mutedText) }
            }
        }
    }
}

// MARK: - Agent

private struct AgentComponentView: View {
    let c: WagerBotAppComponent
    let ui: WagerBotUiTokens
    var body: some View {
        let units = c.double("net_units") ?? 0
        return HStack(spacing: 10) {
            Text(c.string("emoji") ?? "🎯")
                .font(.system(size: 26))
                .frame(width: 44, height: 44)
                .background(RoundedRectangle(cornerRadius: 10).fill(ui.accent.opacity(0.14)))
            VStack(alignment: .leading, spacing: 3) {
                Text(c.string("name") ?? "Agent")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(ui.primaryText)
                HStack(spacing: 6) {
                    if let rec = c.string("record") { pill(rec, color: ui.mutedText) }
                    pill("\(fmtSigned(units))u", color: units >= 0 ? Color(hex: 0x00C853) : Color(hex: 0xE53935))
                    if let wr = c.double("win_rate") { pill("\(Int(wr * 100))%", color: ui.accent) }
                }
            }
        }
    }
}

// MARK: - Agent pick

private struct AgentPickComponentView: View {
    let c: WagerBotAppComponent
    let ui: WagerBotUiTokens
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ComponentHeader(icon: "brain.head.profile", title: c.string("agent_name") ?? "Agent Pick", accent: ui.accent, ui: ui, trailing: resultLabel)
            Text(c.string("selection") ?? "")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(ui.primaryText)
            if let matchup = c.string("matchup") {
                Text(matchup).font(.system(size: 12, weight: .medium)).foregroundStyle(ui.mutedText)
            }
            if let reasoning = c.string("reasoning"), !reasoning.isEmpty {
                Text(reasoning)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(ui.mutedText)
                    .lineLimit(3)
            }
        }
    }
    private var resultLabel: String? {
        switch c.string("result") {
        case "won": return "WON"
        case "lost": return "LOST"
        case "push": return "PUSH"
        default: return "PENDING"
        }
    }
}

// MARK: - Editor pick

private struct EditorPickComponentView: View {
    let c: WagerBotAppComponent
    let ui: WagerBotUiTokens
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ComponentHeader(icon: "star.fill", title: "Editor's Pick", accent: Color(hex: 0xF59E0B), ui: ui, trailing: c.string("result")?.uppercased())
            Text(c.string("selection") ?? "")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(ui.primaryText)
            HStack(spacing: 6) {
                if let matchup = c.string("matchup") {
                    Text(matchup).font(.system(size: 12, weight: .medium)).foregroundStyle(ui.mutedText)
                }
                if let price = c.string("best_price") { pill(price, color: ui.accent) }
                if let book = c.string("sportsbook") { pill(book, color: ui.mutedText) }
            }
            if let analysis = c.string("analysis"), !analysis.isEmpty {
                Text(analysis).font(.system(size: 12)).foregroundStyle(ui.mutedText).lineLimit(3)
            }
        }
    }
}

// MARK: - Tool / report banner

private struct ToolComponentView: View {
    let c: WagerBotAppComponent
    let ui: WagerBotUiTokens
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: c.string("icon") ?? "wrench.and.screwdriver.fill")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(RoundedRectangle(cornerRadius: 12).fill(ui.accent))
            VStack(alignment: .leading, spacing: 2) {
                Text(c.string("title") ?? "Open tool")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(ui.primaryText)
                if let subtitle = c.string("subtitle") {
                    Text(subtitle).font(.system(size: 12)).foregroundStyle(ui.mutedText).lineLimit(2)
                }
            }
        }
    }
}

// MARK: - Model projection

private struct ModelProjectionComponentView: View {
    let c: WagerBotAppComponent
    let ui: WagerBotUiTokens
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ComponentHeader(icon: "chart.bar.doc.horizontal.fill", title: "Model Projection", accent: ui.accent, ui: ui, trailing: c.string("matchup"))
            HStack(spacing: 14) {
                stat("Proj. Score", c.string("predicted_score") ?? "—")
                stat("Fair Line", fmtSigned(c.double("model_fair_spread")))
                stat("Fair Total", c.double("model_fair_total").map { trimNum($0) } ?? "—")
            }
            HStack(spacing: 6) {
                if let se = c.double("spread_edge") { pill("Spread edge \(fmtSigned(se))", color: edgeColor(abs(se))) }
                if let te = c.double("total_edge") { pill("Total edge \(fmtSigned(te))", color: edgeColor(abs(te))) }
            }
        }
    }
    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.system(size: 10, weight: .semibold)).foregroundStyle(ui.mutedText)
            Text(value).font(.system(size: 14, weight: .bold)).foregroundStyle(ui.primaryText)
        }
    }
}

// MARK: - Polymarket

private struct PolymarketComponentView: View {
    let c: WagerBotAppComponent
    let ui: WagerBotUiTokens
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ComponentHeader(icon: "chart.line.uptrend.xyaxis", title: "Prediction Market", accent: Color(hex: 0x8B5CF6), ui: ui)
            HStack(spacing: 14) {
                stat(c.string("away_abbr") ?? "Away", c.double("away_implied").map { "\(Int($0))%" } ?? "—")
                stat(c.string("home_abbr") ?? "Home", c.double("home_implied").map { "\(Int($0))%" } ?? "—")
                if let model = c.double("model_prob") { stat("Model", "\(Int(model))%") }
            }
        }
    }
    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.system(size: 10, weight: .semibold)).foregroundStyle(ui.mutedText)
            Text(value).font(.system(size: 15, weight: .bold)).foregroundStyle(ui.primaryText)
        }
    }
}

// MARK: - Betting trends

private struct BettingTrendsComponentView: View {
    let c: WagerBotAppComponent
    let ui: WagerBotUiTokens
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ComponentHeader(icon: "chart.bar.fill", title: "Betting Trends", accent: ui.accent, ui: ui, trailing: c.string("matchup"))
            ForEach(Array(c.rows("rows").enumerated()), id: \.offset) { _, row in
                HStack {
                    Text((row["label"] as? String) ?? "")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(ui.mutedText)
                    Spacer()
                    Text((row["value"] as? String) ?? "")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(ui.primaryText)
                }
            }
        }
    }
}

// MARK: - Model accuracy

private struct ModelAccuracyComponentView: View {
    let c: WagerBotAppComponent
    let ui: WagerBotUiTokens
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ComponentHeader(icon: "scope", title: "Model Accuracy", accent: Color(hex: 0x14B8A6), ui: ui, trailing: c.string("bet_type"))
            HStack(spacing: 14) {
                stat("Record", c.string("record") ?? "—")
                stat("Win %", c.double("win_pct").map { "\(Int($0))%" } ?? "—")
                if let roi = c.double("roi_pct") { stat("ROI", fmtSigned(roi) + "%") }
            }
        }
    }
    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.system(size: 10, weight: .semibold)).foregroundStyle(ui.mutedText)
            Text(value).font(.system(size: 15, weight: .bold)).foregroundStyle(ui.primaryText)
        }
    }
}

// MARK: - Injury

private struct InjuryComponentView: View {
    let c: WagerBotAppComponent
    let ui: WagerBotUiTokens
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ComponentHeader(icon: "cross.case.fill", title: "Injury Report", accent: Color(hex: 0xE53935), ui: ui, trailing: c.string("matchup"))
            let players = c.rows("players")
            if players.isEmpty {
                Text("No notable injuries").font(.system(size: 12)).foregroundStyle(ui.mutedText)
            } else {
                ForEach(Array(players.enumerated()), id: \.offset) { _, p in
                    HStack {
                        Text((p["name"] as? String) ?? "")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(ui.primaryText)
                        if let team = p["team"] as? String { Text(team).font(.system(size: 11)).foregroundStyle(ui.mutedText) }
                        Spacer()
                        Text((p["status"] as? String) ?? "")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Color(hex: 0xE53935))
                    }
                }
            }
        }
    }
}

// MARK: - Weather

private struct WeatherComponentView: View {
    let c: WagerBotAppComponent
    let ui: WagerBotUiTokens
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ComponentHeader(icon: "cloud.sun.fill", title: "Weather", accent: Color(hex: 0x0EA5E9), ui: ui, trailing: c.string("matchup"))
            HStack(spacing: 14) {
                if let t = c.double("temperature") { stat("Temp", "\(Int(t))°") }
                if let w = c.double("wind_speed") { stat("Wind", "\(Int(w)) mph") }
                if let p = c.string("precipitation") { stat("Precip", p) }
                if let sky = c.string("sky") { stat("Sky", sky) }
            }
        }
    }
    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.system(size: 10, weight: .semibold)).foregroundStyle(ui.mutedText)
            Text(value).font(.system(size: 14, weight: .bold)).foregroundStyle(ui.primaryText)
        }
    }
}

// MARK: - Public betting

private struct PublicBettingComponentView: View {
    let c: WagerBotAppComponent
    let ui: WagerBotUiTokens
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ComponentHeader(icon: "person.3.fill", title: "Public Betting", accent: ui.accent, ui: ui, trailing: c.string("matchup"))
            ForEach(Array(c.rows("splits").enumerated()), id: \.offset) { _, row in
                HStack {
                    Text((row["label"] as? String) ?? "")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(ui.mutedText)
                    Spacer()
                    Text((row["value"] as? String) ?? "")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(ui.primaryText)
                }
            }
        }
    }
}

// MARK: - Unknown (forward-compat)

private struct UnknownComponentView: View {
    let c: WagerBotAppComponent
    let ui: WagerBotUiTokens
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let title = c.string("title") {
                Text(title).font(.system(size: 14, weight: .bold)).foregroundStyle(ui.primaryText)
            }
            if let analysis = c.string("analysis") {
                Text(analysis).font(.system(size: 12)).foregroundStyle(ui.mutedText)
            }
        }
    }
}
