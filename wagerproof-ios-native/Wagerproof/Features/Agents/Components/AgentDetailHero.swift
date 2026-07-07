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
    /// Lets the hero avatar ripple this field (easter egg). The page paints this
    /// background twice (full-bleed + hero mask); both share one emitter so the
    /// ripple lands identically in each, matching how the glyph colonies align.
    var rippleEmitter: GlyphRippleEmitter? = nil

    var body: some View {
        PixelWaveBackground(
            accentColor: AgentColorPalette.primary(for: avatarColor),
            screenAnchored: true,
            rippleEmitter: rippleEmitter
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
    /// While a generation run is in flight, the disc swaps the standing avatar for
    /// the seated-at-laptop "working" pose (the corner worker moved up here).
    var isGenerating: Bool = false
    /// Easter egg: when set, tapping the avatar disc reports its global center so
    /// the caller can ripple the pixelwave background behind it. Nil = inert disc.
    var onAvatarTap: ((CGPoint) -> Void)? = nil

    var bigSize: CGFloat = 76
    var smallSize: CGFloat = 44

    @Environment(\.colorScheme) private var colorScheme
    /// Live global center of the avatar disc (it shrinks + shifts as the hero
    /// collapses), captured so a tap can ripple the background at the right spot.
    @State private var avatarGlobalCenter: CGPoint = .zero

    private var primary: Color { AgentColorPalette.primary(for: agent.avatarColor) }
    private var secondary: Color { AgentColorPalette.secondary(for: agent.avatarColor) }

    var body: some View {
        let p = clamp(progress)
        // Hard cut (no crossfade) between the two layouts, both anchored
        // top-leading so the avatar disc reads as staying put while only the
        // stat treatment morphs. Expanded (avatar + name + pills on the left,
        // 2×2 stat quadrant on the right) holds until the midpoint, then the
        // compact bar (small avatar + name + one-line stats) takes over.
        ZStack(alignment: .topLeading) {
            if p < 0.5 {
                expandedHeader
            } else {
                compactHeader
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    // MARK: Expanded — avatar + name (left), 2×2 stat quadrant (right)

    private var expandedHeader: some View {
        // Sports drop to a full-width row UNDER the avatar+name / stat-quadrant
        // row, so the 2×2 stats get the whole right-hand width to work with (they
        // no longer share it with the pills). The name is enlarged to fill the
        // freed vertical space next to the quadrant.
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    avatarDisc(size: bigSize, tappable: true)
                    Text(agent.name)
                        .font(.system(size: 26, weight: .heavy))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    if let subtitle {
                        HStack(spacing: 4) {
                            if let subtitleSystemImage {
                                Image(systemName: subtitleSystemImage).font(.system(size: 10))
                            }
                            Text(subtitle).font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(Color.appTextSecondary)
                    }
                }
                Spacer(minLength: 10)
                AgentStatQuadrant(performance: performance, lockedNetUnits: lockedNetUnits)
                    .frame(maxWidth: 210)
            }
            sportPills
        }
    }

    // MARK: Compact — small avatar + name + one-line stats, all left-aligned

    private var compactHeader: some View {
        HStack(alignment: .center, spacing: 10) {
            avatarDisc(size: smallSize, tappable: true)
            VStack(alignment: .leading, spacing: 3) {
                Text(agent.name)
                    .font(.system(size: 16, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                compactStatLine
            }
            Spacer(minLength: 0)
        }
    }

    // MARK: Avatar

    /// Disc contents: the standing avatar normally, or the seated-at-laptop
    /// "working" pose (character + laptop) while a run is in flight.
    @ViewBuilder
    private func discContent(size: CGFloat) -> some View {
        if isGenerating {
            ZStack {
                SitWorkSprite(spriteIndex: agent.spriteIndex)
                    .frame(width: size * 0.60, height: size * 0.80)
                LaptopSprite()
                    .frame(width: size * 0.30, height: size * 0.44)
                    .offset(y: size * 0.16)
            }
            .transition(.opacity)
        } else {
            PixelSpriteAvatar(spriteIndex: agent.spriteIndex)
                .padding(size * 0.18)
                .transition(.opacity)
        }
    }

    @ViewBuilder
    private func avatarDisc(size: CGFloat, tappable: Bool) -> some View {
        let p = primary.teamVisible(in: colorScheme)
        let s = secondary.teamVisible(in: colorScheme)
        let disc = discContent(size: size)
            .frame(width: size, height: size)
            .teamGlassDisc(primary: p, secondary: s, tint: 0.5)
            .shadow(color: p.opacity(0.3), radius: 7, x: 0, y: 3)
            .animation(.easeInOut(duration: 0.35), value: isGenerating)

        if tappable, let onAvatarTap {
            disc
                // Track the disc's global center every frame (it moves while the
                // hero collapses) so the tap ripples from the live position.
                .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { f in
                    avatarGlobalCenter = CGPoint(x: f.midX, y: f.midY)
                }
                // Circular hit area so corner taps fall through to the field below.
                .contentShape(Circle())
                .onTapGesture { onAvatarTap(avatarGlobalCenter) }
        } else {
            disc
        }
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

/// 2×2 quadrant of the agent's headline stats — Record / Net Units / Win Rate /
/// Streak — each on its own Liquid-Glass tile. The expanded hero's right column;
/// replaces the old single-row `AgentStatStrip`. Net Units lock-blurs for non-Pro
/// (the lock lives inside `AgentStatCell`).
struct AgentStatQuadrant: View {
    let performance: AgentPerformance?
    var lockedNetUnits: Bool = false

    var body: some View {
        let perf = performance
        let netTint: Color = (perf?.netUnits ?? 0) >= 0 ? Color.appWin : Color.appLoss
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                tile { AgentStatCell(label: "Record", value: perf?.recordLabel ?? "0-0") }
                tile { AgentStatCell(label: "Net Units", value: perf?.netUnitsLabel ?? "+0.00u", tint: netTint, locked: lockedNetUnits) }
            }
            HStack(spacing: 8) {
                tile { AgentStatCell(label: "Win Rate", value: perf?.winRate.map { String(format: "%.1f%%", $0 * 100) } ?? "-") }
                tile { AgentStatCell(label: "Streak", value: perf?.currentStreakLabel ?? "-", tint: streakColor) }
            }
        }
    }

    private func tile<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        content()
            .padding(.vertical, 8)
            .padding(.horizontal, 6)
            .frame(maxWidth: .infinity)
            .liquidGlassBackground(in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
            )
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
                    // Long records ("95-103-5") must shrink to one line, not wrap —
                    // the 2×2 quadrant tiles are too narrow to hold a wrapped value.
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
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
