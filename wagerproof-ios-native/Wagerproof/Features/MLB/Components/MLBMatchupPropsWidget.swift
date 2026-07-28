import SwiftUI
import Charts
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Player-props digest for the MLB game-detail sheet.
///
/// The strongest qualified recent-form signal gets a real values-vs-line
/// chart. The remaining starter/extreme/top-order signals stay compact and
/// tappable. Full team-grouped depth remains in `MatchupPropsDetailSheet`.
struct MLBMatchupPropsWidget: View {
    /// Passed in rather than looked up here — the parent already resolves it
    /// for the expand action, and doing the lookup twice per body pass was
    /// pure waste.
    let matchup: MLBPropMatchup
    /// Shared zoom namespace owned by the carousel; rows are the
    /// `matchedTransitionSource` and the pushed detail is the `.zoom` target.
    let namespace: Namespace.ID
    let onSelect: (PlayerPropSelection) -> Void
    let onExpand: () -> Void

    @Environment(PropsStore.self) private var propsStore

    var body: some View {
        // Both halves of the props pipeline are memoized against the store's
        // slate version; recomputing them inline ran the full analytics walk
        // (every player × every prop × their season log) on every body pass.
        if let summary = propsStore.propsInsightSummary(forGamePk: matchup.gamePk) {
            let itemsById = PlayerPropFeedCache.itemsById(for: matchup,
                                                          version: propsStore.matchupsVersion)
            InsightWidgetSection(
                title: "Player Props",
                systemImage: "figure.baseball",
                iconTint: Color.appPrimary,
                badge: summary.badge,
                expandLabel: "All \(summary.totalProps) props",
                onExpand: onExpand
            ) {
                VStack(alignment: .leading, spacing: 16) {
                    Text(summary.headline)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityLabel("Player props summary: \(summary.headline)")

                    Label(summary.explainer, systemImage: "chart.bar.fill")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    if let featuredId = summary.featuredPlayerId,
                       let signal = summary.signals.first(where: { $0.playerId == featuredId }),
                       let item = itemsById[featuredId] {
                        FeaturedPropSignalCard(signal: signal, item: item) {
                            onSelect(item.selection)
                        }
                        .matchedTransitionSource(id: item.selection.transitionID, in: namespace)
                    }

                    let secondarySignals = summary.signals.filter {
                        $0.playerId != summary.featuredPlayerId
                    }
                    if !secondarySignals.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(summary.featuredPlayerId == nil ? "POSTED PROP SIGNALS" : "OTHER POSTED PROP SIGNALS")
                                .font(.system(size: 9, weight: .bold))
                                .tracking(0.7)
                                .foregroundStyle(Color.appTextMuted)

                            VStack(spacing: 8) {
                                ForEach(secondarySignals) { signal in
                                    if let item = itemsById[signal.playerId] {
                                        PropSignalRow(signal: signal, item: item) {
                                            onSelect(item.selection)
                                        }
                                        .matchedTransitionSource(id: item.selection.transitionID, in: namespace)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Featured signal

private struct FeaturedPropSignalCard: View {
    let signal: PropSignal
    let item: PlayerPropFeedItem
    let onTap: () -> Void

    private var computed: MLBPropComputedAtLine { signal.headline.computed }
    private var market: String { MLBPlayerProps.marketLabel(signal.headline.row.market) }
    private var tint: Color { propRateTint(computed) }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    PlayerHeadshot(playerId: signal.playerId, size: 40)
                        .frame(width: 40, height: 40)
                        .overlay(
                            Circle()
                                .stroke(Color(hex: Int(item.teamPrimaryHex)).opacity(0.85), lineWidth: 1.5)
                        )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(signal.playerName)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Text(playerContext)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                    }

                    Spacer(minLength: 8)

                    VStack(alignment: .trailing, spacing: 0) {
                        Text(computed.l10.pctLabel)
                            .font(.system(size: 24, weight: .heavy, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(tint)
                        Text("\(computed.l10.fractionLabel) over")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(Color.appTextMuted)
                    }

                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.appTextMuted)
                }

                HStack(spacing: 7) {
                    Text(market)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)

                    Text("OVER \(MLBPlayerProps.formatLine(computed.line))")
                        .font(.system(size: 9, weight: .heavy, design: .rounded))
                        .tracking(0.35)
                        .foregroundStyle(tint)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(tint.opacity(0.13), in: Capsule())

                    Spacer(minLength: 4)

                    let overOdds = MLBPlayerProps.formatOdds(computed.overOdds)
                    if overOdds != "-" {
                        Text(overOdds)
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }

                PropEvidenceChart(
                    bars: Array(computed.chartGames.suffix(10)),
                    line: computed.line
                )

                HStack(spacing: 18) {
                    propStat(label: "RECENT", value: computed.l10.pctLabel, tint: tint)
                    propStat(
                        label: "SEASON",
                        value: computed.season.pctLabel,
                        tint: Color.appTextPrimary
                    )
                    Spacer(minLength: 0)
                    chartLegend
                }
            }
            .padding(12)
            .background(
                Color.appSurfaceMuted.opacity(0.30),
                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.appBorder.opacity(0.50), lineWidth: 0.75)
            )
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.impact(weight: .light), trigger: item.selection.id)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "\(signal.playerName), \(market), over \(MLBPlayerProps.formatLine(computed.line)), \(computed.l10.fractionLabel) recent games over, \(computed.l10.pctLabel) recent over rate, \(computed.season.pctLabel) season over rate"
        )
        .accessibilityHint("Opens this player's prop details")
    }

    private var playerContext: String {
        let role = signal.isPitcher ? "Starting pitcher" : signal.battingOrder.map { "Batting #\($0)" }
        return [signal.teamAbbr.isEmpty ? nil : signal.teamAbbr, role]
            .compactMap { $0 }
            .joined(separator: " · ")
    }

    private func propStat(label: String, value: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.system(size: 8, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(tint)
        }
    }

    private var chartLegend: some View {
        HStack(spacing: 9) {
            legendItem("Above", color: .appWin)
            legendItem("At/below", color: .appAccentBlue)
        }
    }

    private func legendItem(_ text: String, color: Color) -> some View {
        HStack(spacing: 3) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(color)
                .frame(width: 7, height: 7)
            Text(text)
                .font(.system(size: 8, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
        }
    }
}

private struct PropEvidenceChart: View {
    let bars: [MLBPropChartBar]
    let line: Double

    private var maxValue: Double {
        max(line * 1.5, bars.map(\.value).max() ?? 0, line + 1, 1)
    }

    private var dateLabelIds: [String] {
        guard !bars.isEmpty else { return [] }
        let middle = bars[bars.count / 2]
        return Array(Set([bars[0].id, middle.id, bars[bars.count - 1].id]))
            .sorted()
            .map(String.init)
    }

    var body: some View {
        if bars.isEmpty {
            Text("No recent game results")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color.appTextMuted)
                .frame(maxWidth: .infinity, minHeight: 96)
        } else {
            Chart {
                ForEach(bars) { bar in
                    BarMark(
                        x: .value("Game", String(bar.id)),
                        y: .value("Result", bar.value),
                        width: .ratio(0.56)
                    )
                    .cornerRadius(3)
                    .foregroundStyle(bar.cleared ? Color.appWin : Color.appAccentBlue.opacity(0.72))
                    .annotation(position: .top, spacing: 2) {
                        Text(MLBPlayerProps.formatBarValue(bar.value))
                            .font(.system(size: 7, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(bar.cleared ? Color.appWin : Color.appAccentBlue)
                    }
                }

                RuleMark(y: .value("Posted line", line))
                    .lineStyle(StrokeStyle(lineWidth: 1.25, dash: [4, 3]))
                    .foregroundStyle(Color.appAccentAmber)
                    .annotation(position: .top, alignment: .trailing, spacing: 2) {
                        Text("LINE \(MLBPlayerProps.formatLine(line))")
                            .font(.system(size: 7, weight: .heavy, design: .rounded))
                            .tracking(0.35)
                            .foregroundStyle(Color.appAccentAmber)
                    }
            }
            .chartXScale(domain: bars.map { String($0.id) })
            .chartYScale(domain: 0...maxValue)
            .chartYAxis(.hidden)
            .chartXAxis {
                AxisMarks(values: dateLabelIds) { value in
                    AxisTick().foregroundStyle(Color.appBorder.opacity(0.4))
                    AxisValueLabel {
                        if let idString = value.as(String.self),
                           let id = Int(idString),
                           let date = bars.first(where: { $0.id == id })?.date,
                           let short = shortDate(date) {
                            Text(short)
                                .font(.system(size: 8, weight: .medium))
                                .foregroundStyle(Color.appTextMuted)
                        }
                    }
                }
            }
            .chartPlotStyle { plot in
                plot
                    .background(Color.appSurface.opacity(0.28))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .frame(height: 112)
            .accessibilityHidden(true)
        }
    }

    private func shortDate(_ iso: String) -> String? {
        let parts = iso.split(separator: "-")
        guard parts.count >= 3,
              let month = Int(parts[1]),
              let day = Int(parts[2].prefix(2)) else { return nil }
        return "\(month)/\(day)"
    }
}

// MARK: - Secondary signals

/// Compact evidence row: identity + explicit line + recent outcomes + over rate.
private struct PropSignalRow: View {
    let signal: PropSignal
    let item: PlayerPropFeedItem
    let onTap: () -> Void

    init(signal: PropSignal, item: PlayerPropFeedItem, onTap: @escaping () -> Void) {
        self.signal = signal
        self.item = item
        self.onTap = onTap
    }

    private var computed: MLBPropComputedAtLine { signal.headline.computed }
    private var market: String { MLBPlayerProps.marketLabel(signal.headline.row.market) }
    private var pctColor: Color { propRateTint(computed) }

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 8) {
                HStack(spacing: 10) {
                    PlayerHeadshot(playerId: signal.playerId, size: 30)
                        .frame(width: 30, height: 30)
                        .overlay(
                            Circle().stroke(Color(hex: Int(item.teamPrimaryHex)).opacity(0.8), lineWidth: 1.5)
                        )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(signal.playerName)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Text("\(market) · Over \(MLBPlayerProps.formatLine(computed.line))")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }

                    Spacer(minLength: 6)

                    VStack(alignment: .trailing, spacing: 0) {
                        Text(computed.l10.pctLabel)
                            .font(.system(size: 17, weight: .heavy, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(pctColor)
                        Text("\(computed.l10.fractionLabel) over")
                            .font(.system(size: 8, weight: .semibold))
                            .foregroundStyle(Color.appTextMuted)
                    }

                    Image(systemName: "chevron.right")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.appTextMuted)
                }

                PropRecentOutcomeTrack(strip: computed.miniStrip)
            }
            .padding(10)
            .background(
                Color.appSurfaceMuted.opacity(0.24),
                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.appBorder.opacity(0.42), lineWidth: 0.75)
            )
            .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.impact(weight: .light), trigger: item.selection.id)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "\(signal.playerName), \(market), over \(MLBPlayerProps.formatLine(computed.line)), \(computed.l10.fractionLabel) recent games over, \(computed.l10.pctLabel)"
        )
        .accessibilityHint("Opens this player's prop details")
    }
}

private struct PropRecentOutcomeTrack: View {
    let strip: [(cleared: Bool, value: Double)]

    var body: some View {
        GeometryReader { geometry in
            let count = max(strip.count, 1)
            let gap: CGFloat = 3
            let width = max(2, (geometry.size.width - gap * CGFloat(count - 1)) / CGFloat(count))

            HStack(spacing: gap) {
                ForEach(Array(strip.enumerated()), id: \.offset) { _, result in
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(result.cleared ? Color.appWin : Color.appAccentBlue.opacity(0.66))
                        .frame(width: width)
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
        }
        .frame(height: 7)
        .accessibilityHidden(true)
    }
}

private func propRateTint(_ computed: MLBPropComputedAtLine) -> Color {
    guard !computed.l10.lowConfidence, let pct = computed.l10.pct else {
        return Color.appTextSecondary
    }
    if pct >= 70 { return Color.appWin }
    if pct <= 30 { return Color.appAccentBlue }
    if pct >= 55 { return Color.appAccentAmber }
    return Color.appTextSecondary
}
