import SwiftUI
import WagerproofModels
import WagerproofDesign

/// Full-page player-prop detail, styled like the MLB game detail
/// (`MLBGameBottomSheet`): a `CollapsingWidgetScroll` whose identity row docks
/// into the toolbar on scroll (36pt disc + name, same 44pt target as
/// `MatchupGlassHero`), with the native market picker pinned under that
/// toolbar row so it stays visible. Widgets use the same flat card fill as
/// game-detail cards. The line scrubber floats over the scrolling content.
struct PlayerPropDetailView: View {
    let selection: PlayerPropSelection

    /// Per-market selected line (lazily falls back to each market's fair line).
    @State private var selectedLines: [String: Double] = [:]
    /// Market currently in view — driven by scroll-spy or a picker tap.
    @State private var activeMarket: String
    /// Briefly ignore scroll-spy right after a picker-driven jump.
    @State private var suppressSpy = false
    /// Live bottom of the collapsing identity hero — the picker parks here,
    /// clamped below the nav bar so it never slides under the back button.
    @State private var heroBottom: CGFloat = 0
    /// Line-pill expand state lives here so a market change cannot remount
    /// the scrubber and snap it shut. Scroll eases it closed.
    @State private var lineExpanded = false
    /// Section top offsets in a reference type so high-frequency scroll updates
    /// don't re-render the charts — only an `activeMarket` change does.
    @State private var spy = SpyStore()

    private final class SpyStore { var tops: [String: CGFloat] = [:] }

    private var hasPicker: Bool { markets.count > 1 }
    /// Native segmented control + a little air so the first widget can't
    /// clip its bottom curve.
    private let pickerBand: CGFloat = 40
    /// Identity only — the picker is a pin-accessory, not part of the hero.
    /// Collapsed height is the 44pt nav-row plus air above the picker.
    private let heroMax: CGFloat = 96
    private let heroMin: CGFloat = 54

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
            let chrome = PropDetailChrome(safeTop: root.safeAreaInsets.top, safeBottom: root.safeAreaInsets.bottom)
            ScrollViewReader { proxy in
                CollapsingWidgetScroll(
                    heroMaxHeight: heroMax,
                    heroMinHeight: heroMin,
                    heroTopInset: chrome.expandedTop,
                    usesLiquidGlass: false,
                    pinAccessoryHeight: hasPicker ? pickerBand : 0,
                    heroBottom: $heroBottom,
                    dockedTopInsetOverride: chrome.dockedTop,
                    onUserScroll: collapseLineIfExpanded
                ) { progress in
                    TeamAuraBackground(awayColor: teamColor, homeColor: oppColor, progress: progress)
                } hero: { progress in
                    heroView(progress: progress)
                } content: {
                    LazyVStack(spacing: 0) {
                        ForEach(markets) { row in
                            marketWidget(row)
                                .id(row.market)
                                .background(spyTracker(market: row.market, topInset: chrome.expandedTop))
                        }
                    }
                }
                .overlay(alignment: .top) {
                    if hasPicker {
                        marketPicker(proxy: proxy, viewportHeight: root.size.height)
                            .padding(.horizontal, 16)
                            .padding(.top, max(chrome.expandedTop, heroBottom))
                    }
                }
                .overlay(alignment: .bottom) { scrubber(bottomInset: chrome.bottom) }
            }
        }
        .ignoresSafeArea()
        .toolbarBackground(.hidden, for: .navigationBar)
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
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
    /// hero's bottom edge (title + pinned picker), matching the pin line.
    private func spyAnchor(topInset: CGFloat) -> CGFloat {
        max(topInset, heroBottom) + (hasPicker ? pickerBand : 0) + 8
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

    // MARK: - Collapsing hero (title docks; picker stays)

    @ViewBuilder
    private func heroView(progress p: CGFloat) -> some View {
        // Match `MatchupGlassHero`: 50→36 disc, last stretch slides right to
        // clear the circular back button (~16 + 44 control + 16 gap + air).
        let headSize = lerp(50, 36, p)
        let ringPad = lerp(4, 0, p)
        let detail = Double(max(0, 1 - p * 1.9))
        let dock = min(1, max(0, (p - 0.45) / 0.55))
        let leading = lerp(20, 90, dock)
        let pct = activeComputed?.l10.pct

        VStack(spacing: lerp(8, 6, p)) {
            heroTopRow
                .opacity(detail)
                .frame(height: lerp(18, 0, min(1, p * 1.6)))
                .clipped()

            HStack(alignment: .center, spacing: lerp(16, 12, p)) {
                PlayerHeadshot(playerId: selection.playerId, size: headSize)
                    .padding(ringPad)
                    .teamGlassDisc(primary: teamColor, secondary: oppColor)
                    .shadow(color: teamColor.opacity(lerp(0.35, 0.18, p)), radius: lerp(8, 3, p))
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
                HStack(alignment: .firstTextBaseline, spacing: 0) {
                    Text(pct.map(String.init) ?? "—")
                        .font(.system(size: lerp(27, 17, p), weight: .heavy))
                        .foregroundStyle(Color.appPrimary)
                    if pct != nil {
                        Text("%")
                            .font(.system(size: lerp(16, 11, p), weight: .heavy))
                            .foregroundStyle(Color.appPrimary)
                    }
                }
                .contentTransition(.numericText())
                .animation(.snappy(duration: 0.28), value: pct)
            }
            .frame(height: lerp(58, 44, p), alignment: .center)
        }
        .padding(.leading, leading)
        .padding(.trailing, 16)
        .padding(.top, lerp(8, 0, p))
        .padding(.bottom, lerp(0, 10, p))
        .frame(maxWidth: .infinity, alignment: .top)
    }

    private func marketPicker(proxy: ScrollViewProxy, viewportHeight: CGFloat) -> some View {
        Picker("Market", selection: pickerBinding(proxy: proxy, viewportHeight: viewportHeight)) {
            ForEach(markets) { row in
                Text(MLBPlayerProps.marketAbbr(row.market)).tag(row.market)
            }
        }
        .pickerStyle(.segmented)
        .sensoryFeedback(.selection, trigger: activeMarket)
    }

    private func pickerBinding(proxy: ScrollViewProxy, viewportHeight: CGFloat) -> Binding<String> {
        Binding(
            get: { activeMarket },
            set: { market in
                activeMarket = market
                suppressSpy = true
                let anchorY = min(0.45, max(0.08, heroMin / max(viewportHeight, 1)))
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

    // MARK: - Floating scrubber (overlays the widgets)

    @ViewBuilder
    private func scrubber(bottomInset: CGFloat) -> some View {
        if let activeRow {
            // Spacers eat the overlay's full-width proposal so the pill hugs
            // its content instead of becoming a banner.
            HStack {
                Spacer(minLength: 0)
                PropLineScrubber(
                    lines: activeRow.lines,
                    selectedLine: activeLineBinding,
                    isExpanded: $lineExpanded
                )
                Spacer(minLength: 0)
            }
            .padding(.bottom, bottomInset)
        }
    }

    private func collapseLineIfExpanded() {
        guard lineExpanded else { return }
        lineExpanded = false
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

/// Insets for a full-bleed prop detail page. `safeTop` from a GeometryReader
/// that ignores the safe area is often just the status-bar band (~59pt) because
/// the nav bar is transparent — we add the 44pt back-button row plus air so
/// the header and picker don't jam into the Dynamic Island. The pill uses the
/// home-indicator inset so it floats above the bezel without reserving a
/// layout band.
struct PropDetailChrome {
    let expandedTop: CGFloat
    let dockedTop: CGFloat
    let bottom: CGFloat

    init(safeTop: CGFloat, safeBottom: CGFloat) {
        let status = min(max(safeTop, 54), 62)
        self.expandedTop = status + 56
        self.dockedTop = status + 12
        self.bottom = max(safeBottom, 28)
    }
}
