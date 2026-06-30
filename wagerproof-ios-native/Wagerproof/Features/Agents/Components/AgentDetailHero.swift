import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Single-agent collapsing detail hero + aura, matching the MLB game-detail
/// theme (`MLBGameBottomSheet` / `MatchupGlassHero`) but for one entity rather
/// than a two-team matchup. Hosted by `CollapsingWidgetScroll`: the hero builder
/// receives `progress` (0 = expanded, 1 = collapsed) and continuously morphs the
/// avatar disc + name + stats from a tall centered block into a compact bar.
///
/// Used by both `AgentDetailView` (owner) and `PublicAgentDetailView`.

// MARK: - Background

/// Per-agent "pixelwave" backdrop — the animated pixel-glyph field from the auth
/// gate (`PixelWaveBackground`), tinted with the agent's primary color so the
/// glyphs glow in the agent's hue. Screen-anchored so the `CollapsingWidgetScroll`
/// page background and its opaque hero mask render one seamless field. Replaces
/// the old team-style aura glow.
struct AgentPixelWaveBackground: View {
    let avatarColor: String
    var progress: CGFloat

    var body: some View {
        PixelWaveBackground(
            accentColor: AgentColorPalette.primary(for: avatarColor),
            progress: progress,
            screenAnchored: true
        )
    }
}

// MARK: - Hero

struct AgentGlassHero: View {
    let agent: Agent
    let performance: AgentPerformance?
    /// When true, the Net Units stat shows a lock blur (non-Pro).
    var lockedNetUnits: Bool = false
    /// Optional subtitle shown under the name in the expanded state (e.g.
    /// "Public Agent"). The public detail screen passes this.
    var subtitleSystemImage: String? = nil
    var subtitle: String? = nil
    let progress: CGFloat

    var bigSize: CGFloat = 76
    var smallSize: CGFloat = 44

    @Environment(\.colorScheme) private var colorScheme

    private var primary: Color { AgentColorPalette.primary(for: agent.avatarColor) }
    private var secondary: Color { AgentColorPalette.secondary(for: agent.avatarColor) }

    var body: some View {
        let p = clamp(progress)
        let size = lerp(bigSize, smallSize, p)
        // Expanded extras (sport pills + full stat strip) fade over the first
        // ~half of the collapse, then drop out of layout so the hero shrinks.
        let detail = clamp(1 - p * 1.9)
        // The compact one-line stat summary fades in over the back half.
        let compact = clamp((p - 0.45) / 0.55)

        VStack(spacing: lerp(10, 5, p)) {
            avatarDisc(size: size)

            Text(agent.name)
                .font(.system(size: lerp(20, 16, p), weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            // Expanded zone: sport pills + the full four-cell stat strip.
            if detail > 0.02 {
                VStack(spacing: 8) {
                    sportPills
                    if let subtitle {
                        HStack(spacing: 4) {
                            if let subtitleSystemImage {
                                Image(systemName: subtitleSystemImage).font(.system(size: 10))
                            }
                            Text(subtitle).font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(Color.appTextSecondary)
                    }
                    AgentStatStrip(performance: performance, lockedNetUnits: lockedNetUnits)
                }
                .opacity(detail)
            }

            // Collapsed zone: a single condensed stat line under the small disc.
            if compact > 0.02 {
                compactStatLine
                    .opacity(compact)
            }
        }
        .frame(maxWidth: .infinity, alignment: .top)
    }

    // MARK: Avatar

    @ViewBuilder
    private func avatarDisc(size: CGFloat) -> some View {
        let p = primary.teamVisible(in: colorScheme)
        let s = secondary.teamVisible(in: colorScheme)
        PixelSpriteAvatar(spriteIndex: agent.spriteIndex)
            .padding(size * 0.18)
            .frame(width: size, height: size)
            .teamGlassDisc(primary: p, secondary: s, tint: 0.5)
            .shadow(color: p.opacity(0.3), radius: 7, x: 0, y: 3)
    }

    // MARK: Sport pills

    private var sportPills: some View {
        HStack(spacing: 5) {
            ForEach(agent.preferredSports, id: \.self) { sport in
                Text(sport.label)
                    .font(.system(size: 10, weight: .semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .liquidGlassBackground(in: Capsule())
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
        .fixedSize(horizontal: true, vertical: false)
    }

    // MARK: Compact stat line

    private var compactStatLine: some View {
        let perf = performance
        let netTint: Color = (perf?.netUnits ?? 0) >= 0 ? Color.appWin : Color.appLoss
        return HStack(spacing: 8) {
            compactStat(perf?.recordLabel ?? "0-0", tint: Color.appTextPrimary)
            dot
            compactStat(lockedNetUnits ? "•••" : (perf?.netUnitsLabel ?? "+0.00u"), tint: lockedNetUnits ? Color.appTextSecondary : netTint)
            dot
            compactStat(perf?.winRate.map { String(format: "%.0f%%", $0 * 100) } ?? "-", tint: Color.appTextPrimary)
            if let streak = perf?.currentStreakLabel, streak != "-" {
                dot
                compactStat(streak, tint: streakColor)
            }
        }
        .font(.system(size: 13, weight: .bold, design: .monospaced))
        .lineLimit(1)
        .fixedSize(horizontal: true, vertical: false)
    }

    private func compactStat(_ value: String, tint: Color) -> some View {
        Text(value).foregroundStyle(tint)
    }

    private var dot: some View {
        Text("·").foregroundStyle(Color.appTextMuted)
    }

    private var streakColor: Color {
        let cs = performance?.currentStreak ?? 0
        if cs > 0 { return Color.appWin }
        if cs < 0 { return Color.appLoss }
        return Color.appTextSecondary
    }

    // MARK: Helpers

    private func clamp(_ t: CGFloat) -> CGFloat { min(1, max(0, t)) }
    private func lerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat {
        a + (b - a) * clamp(t)
    }
}

// MARK: - Stat strip (shared)

/// Four-cell Record / Net Units / Win Rate / Streak strip. Extracted from the
/// old profile cards so both detail screens render an identical strip, with the
/// Net Units lock-blur preserved for non-Pro users.
struct AgentStatStrip: View {
    let performance: AgentPerformance?
    var lockedNetUnits: Bool = false

    var body: some View {
        let perf = performance
        HStack(spacing: 0) {
            AgentStatCell(label: "Record", value: perf?.recordLabel ?? "0-0")
            divider
            AgentStatCell(
                label: "Net Units",
                value: perf?.netUnitsLabel ?? "+0.00u",
                tint: (perf?.netUnits ?? 0) >= 0 ? Color.appWin : Color.appLoss,
                locked: lockedNetUnits
            )
            divider
            AgentStatCell(
                label: "Win Rate",
                value: perf?.winRate.map { String(format: "%.1f%%", $0 * 100) } ?? "-"
            )
            divider
            AgentStatCell(
                label: "Streak",
                value: perf?.currentStreakLabel ?? "-",
                tint: streakColor
            )
        }
    }

    private var divider: some View {
        Divider().frame(height: 30)
    }

    private var streakColor: Color {
        let cs = performance?.currentStreak ?? 0
        if cs > 0 { return Color.appWin }
        if cs < 0 { return Color.appLoss }
        return Color.appTextSecondary
    }
}

struct AgentStatCell: View {
    let label: String
    let value: String
    var tint: Color = Color.appTextPrimary
    var locked: Bool = false

    var body: some View {
        VStack(spacing: 3) {
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
            ZStack {
                Text(value)
                    .font(.system(size: 16, weight: .heavy, design: .monospaced))
                    .foregroundStyle(tint)
                if locked {
                    Rectangle().fill(.ultraThinMaterial)
                    Image(systemName: "lock.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
        .frame(maxWidth: .infinity)
    }
}
