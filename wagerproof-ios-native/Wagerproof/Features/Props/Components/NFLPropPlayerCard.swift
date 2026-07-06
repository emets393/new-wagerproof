import SwiftUI
import WagerproofModels
import WagerproofDesign

/// NFL player-prop card. Mirrors `PropPlayerCard`'s chrome (rounded lifted
/// surface, avatar-with-team-glow, O/U pills, L10 trend strip, bottom info
/// row) — the dry-run contract carries a season game log per market, so the
/// NFL card sells the same trend story the MLB card does.
struct NFLPropPlayerCard: View {
    let item: NFLPropFeedItem
    let namespace: Namespace.ID
    let onSelect: (NFLPlayerPropSelection) -> Void

    @Environment(\.colorScheme) private var colorScheme

    private var player: NFLPropPlayer { item.player }
    private var headline: NFLPropMarket? { item.displayMarket }

    private var teamColors: NFLTeamColors.Pair {
        NFLTeamColors.colors(for: player.team ?? "")
    }
    private var primary: Color { teamColors.primary.teamVisible(in: colorScheme) }
    private var secondary: Color { teamColors.secondary.teamVisible(in: colorScheme) }

    /// Same lifted card surface as the MLB prop cards.
    private var cardFill: Color { Color(light: 0xFFFFFF, dark: 0x202024) }

    var body: some View {
        Button {
            onSelect(item.selection)
        } label: {
            content
        }
        .buttonStyle(.plain)
        .matchedTransitionSource(id: item.selection.transitionID, in: namespace)
        .sensoryFeedback(.impact(weight: .light), trigger: item.selection.id)
    }

    private var content: some View {
        let shape = RoundedRectangle(cornerRadius: 26, style: .continuous)
        return VStack(alignment: .leading, spacing: 8) {
            mainRow
            Divider().background(Color.appBorder.opacity(0.5))
            bottomInfoRow
            if let flags = headline?.flags, !flags.isEmpty {
                NFLPropSignalFeedStrip(flags: flags)
            }
        }
        .padding(.leading, 12)
        .padding(.trailing, 14)
        .padding(.vertical, 9)
        .background {
            ZStack {
                // Matches AgentRowCard's glass treatment: ultraThinMaterial
                // thinned in dark mode so more of the page shows through.
                shape.fill(.ultraThinMaterial)
                    .opacity(colorScheme == .dark ? 0.55 : 1)
                shape.strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5)
            }
        }
        .clipShape(shape)
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    // MARK: - Main row

    private var mainRow: some View {
        HStack(alignment: .center, spacing: 10) {
            avatar
            identity
            Spacer(minLength: 8)
            overUnderBlock
            Spacer(minLength: 8)
            trendBlock
        }
    }

    private var identity: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(player.playerName)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text(subtitle)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .lineLimit(1)
        }
    }

    private var subtitle: String {
        let opp = player.opponentLabel
        if let pos = player.position, !pos.isEmpty {
            return opp.isEmpty ? pos : "\(pos) · \(opp)"
        }
        return opp
    }

    // MARK: - Avatar (headshot + team logo badge + glow)

    private var avatar: some View {
        LiquidGlassMergeContainer(spacing: 14) {
            ZStack(alignment: .bottomTrailing) {
                NFLPlayerHeadshot(playerName: player.playerName, playerId: player.playerId, headshotUrl: player.headshotUrl, size: 40)
                    .frame(width: 44, height: 44)
                    .teamGlassDisc(primary: primary, secondary: secondary, fallbackStroke: cardFill)
                    .shadow(color: primary.opacity(0.22), radius: 5, x: 0, y: 1)

                if let team = player.team,
                   let logo = NFLTeamAssets.logo(for: team), let url = URL(string: logo) {
                    AsyncImage(url: url) { phase in
                        if case .success(let img) = phase {
                            img.resizable().scaledToFit()
                        } else {
                            Color.clear
                        }
                    }
                    .frame(width: 16, height: 16)
                    .padding(2)
                    .liquidGlassBackground(in: Circle())
                    .offset(x: 2, y: 2)
                }
            }
            .frame(width: 44, height: 44)
        }
    }

    // MARK: - Over / Under pills (consensus close line + prices)

    @ViewBuilder
    private var overUnderBlock: some View {
        if headline?.isYesNo == true {
            // Anytime TD: a single yes-price pill + the implied probability.
            VStack(spacing: 4) {
                yesPill
                if let p = headline?.closeYesProb {
                    Text("\(NFLPlayerProps.formatPct(p)) implied")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Color.appTextMuted)
                }
            }
            .fixedSize()
        } else {
            VStack(spacing: 4) {
                ouPill(
                    prefix: "O",
                    value: NFLPlayerProps.formatOdds(headline?.overPrice),
                    tint: Color.appPrimary
                )
                ouPill(
                    prefix: "U",
                    value: NFLPlayerProps.formatOdds(headline?.underPrice),
                    tint: Color.appTextSecondary
                )
            }
            .fixedSize()
        }
    }

    private var yesPill: some View {
        HStack(spacing: 4) {
            Text("TD")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
            Text(NFLPlayerProps.formatOdds(headline?.overPrice))
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(Color.appPrimary)
        }
        .lineLimit(1)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.appSurfaceMuted.opacity(0.55), in: Capsule())
        .overlay(Capsule().stroke(Color.appBorder.opacity(0.6), lineWidth: 0.5))
    }

    private func ouPill(prefix: String, value: String, tint: Color) -> some View {
        HStack(spacing: 4) {
            Text("\(prefix) \(NFLPlayerProps.formatLine(headline?.closeLine))")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(tint)
        }
        .lineLimit(1)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.appSurfaceMuted.opacity(0.55), in: Capsule())
        .overlay(Capsule().stroke(Color.appBorder.opacity(0.6), lineWidth: 0.5))
    }

    // MARK: - Trend strip (season game log vs the close line)

    private var trendBlock: some View {
        VStack(alignment: .trailing, spacing: 3) {
            Text("L10 TREND")
                .font(.system(size: 8, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextMuted)
            RecentFormStrip(
                strip: headline?.miniStrip ?? [],
                line: headline?.clearThreshold ?? 1
            )
            .frame(width: 74, height: 46)
        }
    }

    // MARK: - Bottom info row

    private var bottomInfoRow: some View {
        HStack(alignment: .center, spacing: 16) {
            infoItem(
                label: item.metricLabel,
                value: headline?.label ?? "-",
                valueColor: Color.appPrimary
            )
            infoItem(
                label: "L10",
                value: l10Label,
                valueColor: Color.appTextPrimary
            )
            infoItem(
                label: "HIT",
                value: hitLabel,
                valueColor: hitColor
            )
            Spacer(minLength: 0)
            timePill
        }
    }

    private var l10Label: String {
        guard let m = headline else { return "-" }
        let (hits, n) = m.l10Hits
        guard n > 0 else { return "-" }
        return "\(hits)/\(n) Over"
    }

    private var hitLabel: String {
        guard let rate = headline?.l10HitRate else { return "-" }
        return "\(Int((rate * 100).rounded()))%"
    }

    private var hitColor: Color {
        guard let rate = headline?.l10HitRate else { return Color.appTextMuted }
        let pct = rate * 100
        if pct >= 70 { return Color.appPrimary }
        if pct >= 55 { return Color(hex: 0xEAB308) }
        return Color.appTextSecondary
    }

    private func infoItem(label: String, value: String, valueColor: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.system(size: 8, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(valueColor)
                .lineLimit(1)
        }
    }

    private var timePill: some View {
        Text(player.slotLabel ?? MLBFormatting.dateLabel(player.gameDate))
            .font(.system(size: 9, weight: .bold, design: .monospaced))
            .foregroundStyle(Color.appTextSecondary)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .liquidGlassBackground(in: Capsule())
            .overlay(Capsule().stroke(Color.appBorder.opacity(0.6), lineWidth: 0.5))
    }
}

// MARK: - Prop signal UI (P1–P10 rule flags)

/// Compact prop-signal row shown beneath an NFL prop feed card when the
/// displayed market fired one or more P-flags.
struct NFLPropSignalFeedStrip: View {
    let flags: [String]

    private var signals: [NFLPropSignalDefinition] {
        NFLPropSignalDefinitions.resolve(flags)
    }

    private var actionable: [NFLPropSignalDefinition] {
        signals.filter { !$0.isAntiSignal }
    }

    private var anti: [NFLPropSignalDefinition] {
        signals.filter(\.isAntiSignal)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            if !actionable.isEmpty {
                signalGroup(title: "Supports this prop", signals: actionable, muted: false)
            }
            if !anti.isEmpty {
                signalGroup(title: "Avoid this prop", signals: anti, muted: true)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .background(Color.appSurfaceElevated.opacity(0.55), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.appBorder.opacity(0.45), lineWidth: 0.6)
        )
    }

    private var header: some View {
        HStack(spacing: 6) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 11, weight: .black))
                .foregroundStyle(Color(hex: 0xF97316))
            Text(signals.count == 1 ? "1 Prop Signal" : "\(signals.count) Prop Signals")
                .font(.system(size: 11, weight: .black))
                .foregroundStyle(Color(hex: 0xF97316))
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private func signalGroup(title: String, signals: [NFLPropSignalDefinition], muted: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 9, weight: .black))
                .foregroundStyle(muted ? Color.appAccentAmber : Color.appTextMuted)
            VStack(spacing: 6) {
                ForEach(signals) { signal in
                    NFLPropSignalCompactRow(signal: signal, muted: muted)
                }
            }
        }
    }
}

private struct NFLPropSignalCompactRow: View {
    let signal: NFLPropSignalDefinition
    let muted: Bool

    private var tint: Color { muted ? Color.appAccentAmber : Color.appAccentBlue }

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: muted ? "exclamationmark.triangle.fill" : "info.circle.fill")
                .font(.system(size: 11, weight: .black))
                .foregroundStyle(tint)
            VStack(alignment: .leading, spacing: 1) {
                Text(signal.displayName)
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(tint)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(signal.betDirection)
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundStyle(tint.opacity(0.75))
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(tint.opacity(muted ? 0.12 : 0.16), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(tint.opacity(muted ? 0.45 : 0.38), lineWidth: 0.8)
        )
    }
}

struct NFLPropSignalGroup: View {
    let flags: [String]
    var onSelect: (NFLPropSignalDefinition) -> Void = { _ in }

    private var signals: [NFLPropSignalDefinition] {
        NFLPropSignalDefinitions.resolve(flags)
    }

    var body: some View {
        if signals.isEmpty {
            EmptyView()
        } else {
            let actionable = signals.filter { !$0.isAntiSignal }
            let anti = signals.filter(\.isAntiSignal)
            VStack(alignment: .leading, spacing: 9) {
                if !actionable.isEmpty {
                    detailGroup(title: "Supports this prop", signals: actionable, muted: false)
                }
                if !anti.isEmpty {
                    detailGroup(title: "Avoid this prop", signals: anti, muted: true)
                }
            }
        }
    }

    @ViewBuilder
    private func detailGroup(title: String, signals: [NFLPropSignalDefinition], muted: Bool) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(.system(size: 9, weight: .black))
                .foregroundStyle(muted ? Color.appAccentAmber : Color.appTextMuted)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 118), spacing: 7)], alignment: .leading, spacing: 7) {
                ForEach(signals) { signal in
                    NFLPropSignalButton(signal: signal, muted: muted, onSelect: onSelect)
                }
            }
        }
    }
}

private struct NFLPropSignalButton: View {
    let signal: NFLPropSignalDefinition
    let muted: Bool
    let onSelect: (NFLPropSignalDefinition) -> Void

    private var color: Color { muted ? Color.appAccentAmber : Color.appAccentBlue }

    var body: some View {
        Button { onSelect(signal) } label: {
            HStack(spacing: 8) {
                Image(systemName: muted ? "exclamationmark.triangle.fill" : "info.circle.fill")
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(color)
                VStack(alignment: .leading, spacing: 2) {
                    Text(signal.displayName)
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(color)
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                    Text(signal.betDirection)
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
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(color.opacity(muted ? 0.55 : 0.46), lineWidth: 1.1)
            )
            .shadow(color: color.opacity(0.16), radius: 6, x: 0, y: 3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct NFLPropSignalDetailSheet: View {
    let signal: NFLPropSignalDefinition
    let seasonRecord: SignalPerformance?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(signal.displayName)
                        .font(.system(size: 22, weight: .black))
                        .foregroundStyle(Color.appTextPrimary)
                    if !signal.oneLiner.isEmpty {
                        Text(signal.oneLiner)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    signalBlock("Definition", signal.definition)
                    signalBlock("Why It Works", signal.whyItWorks)
                    signalBlock("Bet Direction", signal.betDirection)
                    SignalPerformanceStatsSection(
                        backtestHit: signal.typicalHit,
                        seasonDisplay: SignalSeasonRecordDisplay(performance: seasonRecord)
                    )
                    if signal.isAntiSignal {
                        Text("This is an anti-signal — the backtest says to avoid betting this market when it fires.")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color.appAccentAmber)
                    }
                }
                .padding(20)
            }
            .background(Color.appSurface)
            .navigationTitle("Prop Signal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .tint(Color.appPrimary)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private func signalBlock(_ title: String, _ body: String) -> some View {
        if !body.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text(title.uppercased())
                    .font(.system(size: 10, weight: .black))
                    .tracking(0.6)
                    .foregroundStyle(Color.appTextMuted)
                Text(body)
                    .font(.system(size: 14))
                    .foregroundStyle(Color.appTextPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// NFL headshot with an initials-disc fallback. Prefers the official photo
/// the props row carries (`headshotUrl`); without one, the `player_id` is
/// only usable when numeric (ESPN id) — otherwise, and on any load failure,
/// the disc shows the player's initials.
struct NFLPlayerHeadshot: View {
    let playerName: String
    let playerId: String?
    var headshotUrl: String?
    var size: CGFloat = 44

    var body: some View {
        Group {
            if let urlString = headshotUrl ?? NFLTeams.headshotUrl(playerId: playerId),
               let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    if case .success(let img) = phase {
                        img.resizable().scaledToFill()
                    } else {
                        initialsDisc
                    }
                }
            } else {
                initialsDisc
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var initialsDisc: some View {
        Circle()
            .fill(Color.appSurfaceMuted)
            .overlay {
                Text(initials)
                    .font(.system(size: size * 0.34, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
            }
    }

    private var initials: String {
        playerName.split(separator: " ").compactMap(\.first).prefix(2).map(String.init).joined().uppercased()
    }
}
