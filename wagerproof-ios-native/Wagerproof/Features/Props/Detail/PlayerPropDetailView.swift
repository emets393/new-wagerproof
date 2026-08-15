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
    /// Section top offsets in a reference type so high-frequency scroll updates
    /// don't re-render the charts — only an `activeMarket` change does.
    @State private var spy = SpyStore()

    private final class SpyStore { var tops: [String: CGFloat] = [:] }

    private var hasPicker: Bool { markets.count > 1 }
    /// Top row + identity + native picker. Must clear the segmented control's
    /// bottom edge — a short max clips it against the first scrolling widget.
    private var heroMax: CGFloat { hasPicker ? 148 : 96 }
    /// 44pt toolbar title (game-detail dock) + gap + native segmented picker.
    private var heroMin: CGFloat { hasPicker ? 88 : 44 }

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
                .overlay(alignment: .bottom) { scrubber }
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

    // MARK: - Collapsing hero (title docks; picker stays)

    @ViewBuilder
    private func heroView(progress p: CGFloat, proxy: ScrollViewProxy, viewportHeight: CGFloat) -> some View {
        // Match `MatchupGlassHero`: 50→36 disc, last stretch slides right to
        // clear the circular back button (~16 + 36 + 16 + gap = 80pt).
        let headSize = lerp(50, 36, p)
        let ringPad = lerp(4, 0, p)
        let detail = Double(max(0, 1 - p * 1.9))
        let dock = min(1, max(0, (p - 0.45) / 0.55))
        let leading = lerp(16, 80, dock)
        let pct = activeComputed?.l10.pct

        VStack(spacing: lerp(8, 6, p)) {
            VStack(spacing: lerp(8, 6, p)) {
                heroTopRow
                    .opacity(detail)
                    .frame(height: lerp(18, 0, min(1, p * 1.6)))
                    .clipped()

                HStack(alignment: .center, spacing: lerp(12, 8, p)) {
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

            if hasPicker {
                marketPicker(proxy: proxy, viewportHeight: viewportHeight)
                    .padding(.horizontal, 16)
            }
        }
        .padding(.top, lerp(8, 0, p))
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
    private var scrubber: some View {
        if let activeRow {
            PropLineScrubber(lines: activeRow.lines, selectedLine: activeLineBinding)
                .id(activeMarket)
                .padding(.bottom, 8)
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
