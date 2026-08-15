import SwiftUI
import WagerproofModels
import WagerproofDesign

/// Full-page player-prop detail, styled like the MLB game detail
/// (`MLBGameBottomSheet`): a `CollapsingWidgetScroll` whose hero docks into
/// the toolbar on scroll over a `TeamAuraBackground` glow, with one collapsing
/// `WidgetCollapsingSection` widget per posted market (same flat card fill as
/// game-detail widgets).
///
/// Functionality preserved across the restyle:
///   - A compact icon+abbr market picker pinned in the expanded hero. As the
///     user scrolls, it highlights whichever market widget is in view; tapping
///     a chip scrolls/jumps to that market's widget.
///   - The bottom Liquid Glass `PropLineScrubber` and the hero hit-rate %
///     track the market currently in view; each market keeps its own line.
///   - Every line-driven number rolls via the numeric-text transition.
struct PlayerPropDetailView: View {
    let selection: PlayerPropSelection

    /// Per-market selected line (lazily falls back to each market's fair line).
    @State private var selectedLines: [String: Double] = [:]
    /// Market currently in view — driven by scroll-spy or a picker tap.
    @State private var activeMarket: String
    /// Briefly ignore scroll-spy right after a picker-driven jump.
    @State private var suppressSpy = false
    /// Section top offsets in a reference type so high-frequency scroll updates
    /// don't re-render the charts — only an `activeMarket` change does.
    @State private var spy = SpyStore()

    private final class SpyStore { var tops: [String: CGFloat] = [:] }

    /// Identity + optional market chips. The collapsing shell adds the nav-bar
    /// inset separately so this height is content-only, matching game details.
    private var heroMax: CGFloat { markets.count > 1 ? 134 : 88 }
    /// Toolbar-height docked row — same compact target as game-detail heroes.
    private let heroMin: CGFloat = 44

    init(selection: PlayerPropSelection, initialLine: Double? = nil) {
        self.selection = selection
        let preferred = selection.preferredMarket
        let firstRow = preferred.flatMap { m in selection.props.first { $0.market == m } }
            ?? selection.props.first
        let firstMarket = firstRow?.market ?? ""
        _activeMarket = State(initialValue: firstMarket)
        var seed: [String: Double] = [:]
        if let firstRow, let initialLine, firstRow.lines.contains(where: { $0.line == initialLine }) {
            seed[firstMarket] = initialLine
        }
        _selectedLines = State(initialValue: seed)
    }

    private var markets: [MLBPlayerPropRow] { selection.props }
    private var activeRow: MLBPlayerPropRow? { markets.first { $0.market == activeMarket } ?? markets.first }

    private var teamColor: Color { Color(hex: Int(MLBTeams.colors(for: selection.teamName).primary)) }
    private var oppColor: Color { Color(hex: Int(MLBTeams.colors(for: selection.opponentName).primary)) }

    var body: some View {
        GeometryReader { root in
            let topInset = root.safeAreaInsets.top
            ScrollViewReader { proxy in
                CollapsingWidgetScroll(
                    heroMaxHeight: heroMax,
                    heroMinHeight: heroMin,
                    heroTopInset: topInset,
                    usesLiquidGlass: false
                ) { progress in
                    TeamAuraBackground(awayColor: teamColor, homeColor: oppColor, progress: progress)
                } hero: { progress in
                    heroView(progress: progress, proxy: proxy, viewportHeight: root.size.height)
                } content: {
                    LazyVStack(spacing: 0) {
                        ForEach(markets) { row in
                            marketWidget(row)
                                .id(row.market)
                                .background(spyTracker(market: row.market, topInset: topInset))
                        }
                    }
                }
                .safeAreaInset(edge: .bottom) { scrubber }
            }
            .ignoresSafeArea(edges: .top)
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        // Name lives permanently in the hero — keep the nav title empty.
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        // The bottom scrubber replaces the tab bar on this page.
        .toolbar(.hidden, for: .tabBar)
    }

    // MARK: - Per-market line state

    private func line(for market: String) -> Double {
        if let l = selectedLines[market] { return l }
        guard let row = markets.first(where: { $0.market == market }),
              let dl = MLBPlayerProps.defaultLine(row.lines) else { return 0 }
        return dl
    }

    private var activeComputed: MLBPropComputedAtLine? {
        guard let activeRow else { return nil }
        return MLBPlayerProps.computePropAtLine(activeRow, line: line(for: activeRow.market))
    }

    // MARK: - Scroll-spy

    /// Global Y at which a market widget counts as "in view" — the docked
    /// hero's bottom edge, matching `CollapsingWidgetScroll`'s pin line.
    private func spyAnchor(topInset: CGFloat) -> CGFloat {
        heroMin + max(8, topInset * 0.35) + 8
    }

    private func spyTracker(market: String, topInset: CGFloat) -> some View {
        GeometryReader { geo in
            Color.clear
                .onChange(of: geo.frame(in: .global).minY, initial: true) { _, y in
                    updateTop(market, y, anchor: spyAnchor(topInset: topInset))
                }
        }
    }

    private func updateTop(_ market: String, _ y: CGFloat, anchor: CGFloat) {
        spy.tops[market] = y
        guard !suppressSpy else { return }
        let passed = markets.compactMap { row -> (String, CGFloat)? in
            guard let v = spy.tops[row.market] else { return nil }
            return v <= anchor ? (row.market, v) : nil
        }
        let newActive = passed.max(by: { $0.1 < $1.1 })?.0 ?? markets.first?.market
        if let newActive, newActive != activeMarket {
            activeMarket = newActive
        }
    }

    // MARK: - Collapsing hero (docks into the toolbar)

    @ViewBuilder
    private func heroView(progress p: CGFloat, proxy: ScrollViewProxy, viewportHeight: CGFloat) -> some View {
        let headSize = lerp(50, 36, p)
        let detail = Double(max(0, 1 - p * 1.9))
        // Last stretch: slide the compact row right so the headshot clears
        // the circular back button, same docking inset as `MatchupGlassHero`.
        let dock = min(1, max(0, (p - 0.45) / 0.55))
        let leading = lerp(16, 72, dock)
        let pct = activeComputed?.l10.pct

        VStack(spacing: lerp(8, 0, p)) {
            heroTopRow
                .opacity(detail)
                .frame(height: lerp(18, 0, min(1, p * 1.6)))
                .clipped()
            HStack(alignment: .center, spacing: 12) {
                // Team-tinted Liquid Glass ring around the headshot — the
                // padding turns the disc into a ring outside the opaque
                // headshot so the glass + team color actually read.
                PlayerHeadshot(playerId: selection.playerId, size: headSize)
                    .padding(4)
                    .teamGlassDisc(primary: teamColor, secondary: oppColor)
                    .shadow(color: teamColor.opacity(0.35), radius: 8)
                VStack(alignment: .leading, spacing: 2) {
                    Text(selection.playerName)
                        .font(.system(size: lerp(19, 15, p), weight: .heavy))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if detail > 0.04 {
                        Text(subtitle)
                            .font(.system(size: 11))
                            .foregroundStyle(Color.appTextSecondary)
                            .lineLimit(1)
                            .opacity(detail)
                    }
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 1) {
                    HStack(alignment: .firstTextBaseline, spacing: 0) {
                        Text(pct.map(String.init) ?? "—")
                            .font(.system(size: lerp(27, 18, p), weight: .heavy))
                            .foregroundStyle(Color.appPrimary)
                        if pct != nil {
                            Text("%").font(.system(size: lerp(16, 11, p), weight: .heavy)).foregroundStyle(Color.appPrimary)
                        }
                    }
                    .contentTransition(.numericText())
                    .animation(.snappy(duration: 0.28), value: pct)
                    if detail > 0.04, let c = activeComputed {
                        Text("\(c.l10.over)/\(c.l10.games) L10")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.appTextSecondary)
                            .opacity(detail)
                            .contentTransition(.numericText())
                            .animation(.snappy(duration: 0.28), value: c.l10.over)
                    }
                }
            }
            if markets.count > 1, detail > 0.04 {
                marketPicker(proxy: proxy, viewportHeight: viewportHeight)
                    .opacity(detail)
            }
        }
        .padding(.leading, leading)
        .padding(.trailing, 16)
        .padding(.top, lerp(8, 0, p))
        .frame(maxWidth: .infinity, alignment: .top)
    }

    private func marketPicker(proxy: ScrollViewProxy, viewportHeight: CGFloat) -> some View {
        PropMarketPicker(
            chips: markets.map {
                .init(
                    market: $0.market,
                    icon: MLBPlayerProps.marketEmoji($0.market),
                    abbr: MLBPlayerProps.marketAbbr($0.market)
                )
            },
            selection: pickerBinding(proxy: proxy, viewportHeight: viewportHeight)
        )
    }

    private func pickerBinding(proxy: ScrollViewProxy, viewportHeight: CGFloat) -> Binding<String> {
        Binding(
            get: { activeMarket },
            set: { market in
                activeMarket = market
                suppressSpy = true
                // Land the widget just below the collapsed hero.
                let anchorY = min(0.4, max(0.05, heroMin / max(viewportHeight, 1)))
                withAnimation(.snappy) { proxy.scrollTo(market, anchor: UnitPoint(x: 0.5, y: anchorY)) }
                Task { @MainActor in
                    try? await Task.sleep(for: .seconds(0.45))
                    suppressSpy = false
                }
            }
        )
    }

    private var heroTopRow: some View {
        HStack(spacing: 8) {
            Text(selection.gameIsDay ? "☀️ Day" : "🌙 Night")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            if !selection.opponentAbbr.isEmpty {
                Text("vs \(selection.opponentAbbr)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Spacer()
            Text(MLBFormatting.gameTime(selection.gameTimeEt))
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        }
    }

    // MARK: - Bottom scrubber (tracks the in-view market)

    @ViewBuilder
    private var scrubber: some View {
        if let activeRow {
            PropLineScrubber(lines: activeRow.lines, selectedLine: activeLineBinding)
                .id(activeMarket)
                .padding(.bottom, 4)
        }
    }

    private var activeLineBinding: Binding<Double> {
        Binding(
            get: { line(for: activeMarket) },
            set: { selectedLines[activeMarket] = $0 }
        )
    }

    // MARK: - Per-market collapsing widget

    @ViewBuilder
    private func marketWidget(_ row: MLBPlayerPropRow) -> some View {
        let l = line(for: row.market)
        if let c = MLBPlayerProps.computePropAtLine(row, line: l) {
            WidgetCollapsingSection(title: MLBPlayerProps.marketLabel(row.market), systemImage: "chart.bar.fill") {
                VStack(alignment: .leading, spacing: 14) {
                    Text(MLBPlayerProps.buildVerdict(row, c))
                        .font(.system(size: 14))
                        .lineSpacing(4)
                        .foregroundStyle(Color.appTextPrimary)
                        .contentTransition(.numericText())
                        .animation(.snappy(duration: 0.3), value: l)

                    RecentPropBarChart(bars: c.chartGames, line: l)

                    Divider().background(Color.appBorder.opacity(0.5))

                    PropContextTiles(row: row, computed: c)

                    Text("\(MLBPlayerProps.marketLabel(row.market)) · O \(MLBPlayerProps.formatLine(l)) · \(MLBPlayerProps.formatOdds(c.overOdds)) / \(MLBPlayerProps.formatOdds(c.underOdds))")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                        .contentTransition(.numericText())
                        .animation(.snappy(duration: 0.3), value: l)
                }
            }
        }
    }

    private var subtitle: String {
        var parts: [String] = []
        if let pos = selection.position, !pos.isEmpty { parts.append(pos) }
        if let side = selection.batSide, !side.isEmpty { parts.append(side) }
        if !selection.isPitcher {
            parts.append("vs \(selection.opposingStarterName) (\(selection.opposingStarterHand)HP)")
        }
        if let meta = MLBPitcherArchetypes.displayMeta(selection.opposingArchetypeName), !selection.isPitcher {
            parts.append("\(meta.icon) \(meta.label)")
        }
        return parts.joined(separator: " · ")
    }

    private func lerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat {
        a + (b - a) * min(1, max(0, t))
    }
}
