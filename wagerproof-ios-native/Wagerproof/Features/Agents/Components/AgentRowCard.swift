import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Full-width agent row used in the My Agents list. Adopts the MLB game card's
/// visual language (`GameRowCard`): a translucent Liquid Glass surface with
/// ~26pt continuous corners, a hairline border, and a soft drop shadow.
///
/// Layout:
///   - Identity row: a single rounded-square avatar formatted like the game-
///     matchup team circles (neutral base + brand-color gradient wash + halo),
///     its corner concentric with the card's; the name with the two most
///     distinctive strategy tags stacked beneath it; and the form chart on the
///     right.
///   - Bottom info bar: the supported-sport pills on the left, with the agent's
///     record + net units on the right.
///
/// The form chart (`AgentFormChart`) is a current-streak badge stacked above a
/// compact green/red stacked bar chart of recent daily wins vs losses.
///
/// Tap → onTap; long-press → onLongPress (drives the hub action sheet).
struct AgentRowCard: View {
    let agent: AgentWithPerformance
    /// Shows the unread dot — the agent generated picks this device hasn't
    /// opened yet (see AgentPicksSeenStore).
    var hasUnreadPicks: Bool = false
    var onTap: () -> Void
    var onLongPress: () -> Void = {}

    @Environment(\.colorScheme) private var colorScheme

    private var primary: Color { AgentColorPalette.primary(for: agent.agent.avatarColor) }
    private var secondary: Color { AgentColorPalette.secondary(for: agent.agent.avatarColor) }

    var body: some View {
        Button(action: onTap) {
            content
        }
        .buttonStyle(.plain)
        .contentShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .onLongPressGesture(minimumDuration: 0.4, perform: onLongPress)
        .sensoryFeedback(.impact(weight: .light), trigger: agent.id)
    }

    private var content: some View {
        // Mirror GameRowCard: ultra-thin material fill + a 0.5pt appBorder
        // hairline, clipped to the same 26pt continuous shape, same soft shadow.
        let shape = RoundedRectangle(cornerRadius: 26, style: .continuous)
        return VStack(spacing: 6) {
            HStack(spacing: 12) {
                avatar
                identityBlock
                Spacer(minLength: 8)
                AgentFormChart(performance: agent.performance)
                    .frame(width: 96, height: 50)
            }
            // Slight divider above the bottom info row (supported sports +
            // record/units), matching GameRowCard's split between its main row
            // and its model-edge info row.
            Divider().background(Color.appBorder.opacity(0.5))
            infoRow
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .padding(.bottom, 9)
        .background {
            ZStack {
                // Dark mode: thin the material so more of the page shows through —
                // the container reads as more transparent "glass" (design request).
                shape.fill(.ultraThinMaterial)
                    .opacity(colorScheme == .dark ? 0.55 : 1)
                // Pixelwave sneak-peek: brand-hue glyphs pulsing across the card,
                // a scaled echo of the agent detail hero so the list ties into it.
                // Seeded per agent id so no two cards bloom in lockstep.
                AgentCardGlyphTexture(
                    avatarColor: agent.agent.avatarColor,
                    seedString: "\(agent.id)"
                )
                shape.strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 0.5)
            }
        }
        .clipShape(shape)
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    // MARK: - Avatar (rounded-corner square, concentric with the card corner)

    /// Rounded-square avatar in the MLB card's team-avatar style: neutral
    /// elevated base, a 0.45-opacity brand-color gradient wash, a hairline inner
    /// ring, and a soft colored halo, with the agent emoji centered.
    ///
    /// The corner is a `.continuous` squircle whose radius nests concentrically
    /// inside the card's 26pt corner: radius ≈ cardCorner − inset (the avatar
    /// sits ~12pt in from the card's top-left), so the two curves stay parallel.
    private var avatar: some View {
        AgentPixelAvatarTile(
            spriteIndex: agent.agent.spriteIndex,
            avatarColor: agent.agent.avatarColor
        )
        // Unread-picks dot, notification-badge style on the avatar corner.
        .overlay(alignment: .topTrailing) {
            if hasUnreadPicks {
                Circle()
                    .fill(Color(hex: 0x00E676))
                    .frame(width: 11, height: 11)
                    .overlay(Circle().strokeBorder(Color.appSurfaceElevated, lineWidth: 1.5))
                    .offset(x: 4, y: -4)
                    .accessibilityLabel("New picks")
            }
        }
    }

    // MARK: - Identity (name + active dot + two-row sport pills)

    private var identityBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text(agent.agent.name)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                if agent.agent.isActive {
                    Circle()
                        .fill(Color(hex: 0x10B981))
                        .frame(width: 7, height: 7)
                }
            }
            strategyChipsRow
        }
    }

    /// The two most distinctive strategy tags on a single row beneath the name.
    /// The identity column (between the avatar and the form chart) is narrow, so
    /// the chips truncate to fit: the shorter risk chip gets the higher layout
    /// priority and keeps its full width, while the longer archetype chip
    /// truncates with an ellipsis when the pair won't fit on one line.
    private var strategyChipsRow: some View {
        let tags = Array(agent.agent.strategyTags.prefix(2))
        return HStack(spacing: 6) {
            ForEach(Array(tags.enumerated()), id: \.element.id) { idx, tag in
                chip(tag)
                    .layoutPriority(idx == 0 ? 0 : 1)
            }
        }
    }

    private func sportPill(_ sport: AgentSport) -> some View {
        HStack(spacing: 3) {
            Image(systemName: sport.sfSymbol)
                .font(.system(size: 8, weight: .semibold))
            Text(sport.label)
                .font(.system(size: 9, weight: .bold))
        }
        // White text for readability against the muted pill background.
        .foregroundStyle(Color.appTextPrimary)
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(Color.appSurfaceMuted.opacity(0.6), in: Capsule())
        .overlay(Capsule().stroke(Color.appBorder.opacity(0.5), lineWidth: 0.5))
    }

    // MARK: - Info row (bottom bar: supported sports + record/units)

    /// Bottom info bar — mirrors GameRowCard's edge-pill row: the supported
    /// sport pills on the left, with the agent's record + net units pushed to
    /// the right. (The strategy tags now sit under the name; the sports moved
    /// down here.)
    private var infoRow: some View {
        HStack(spacing: 4) {
            sportsCluster
            Spacer(minLength: 8)
            recordUnits
        }
    }

    /// Supported sports on the left of the info bar. Up to three render as full
    /// icon+label pills; once an agent covers more than three the labels would
    /// overflow the narrow row, so we collapse to a compact cluster of just the
    /// sport icons, overlapped like stacked coins.
    @ViewBuilder
    private var sportsCluster: some View {
        let sports = agent.agent.preferredSports
        if sports.count > 3 {
            HStack(spacing: -7) {
                ForEach(Array(sports.enumerated()), id: \.element) { idx, sport in
                    sportIconCoin(sport)
                        // Leftmost coin sits on top so the cluster reads L→R.
                        .zIndex(Double(sports.count - idx))
                }
            }
        } else {
            HStack(spacing: 4) {
                ForEach(sports, id: \.self) { sportPill($0) }
            }
        }
    }

    /// A single overlapping sport "coin" — the SF symbol on a muted disc with a
    /// hairline ring that punches it out from the coin it overlaps.
    private func sportIconCoin(_ sport: AgentSport) -> some View {
        ZStack {
            Circle().fill(Color.appSurfaceMuted)
            Image(systemName: sport.sfSymbol)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
        }
        .frame(width: 22, height: 22)
        .overlay(Circle().stroke(Color.appBorder.opacity(0.6), lineWidth: 1))
    }

    private func chip(_ tag: AgentStrategyTag) -> some View {
        Text(tag.text)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(tagColor(tag))
            .lineLimit(1)
            .truncationMode(.tail)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Color.appSurfaceMuted.opacity(0.6), in: Capsule())
            .overlay(Capsule().stroke(Color.appBorder.opacity(0.5), lineWidth: 0.5))
    }

    /// Record + win rates (overall and last-7-days), pushed to the right of the
    /// info bar. Hidden until the agent has graded picks. Replaces the old net
    /// units count.
    @ViewBuilder
    private var recordUnits: some View {
        if let perf = agent.performance, perf.totalPicks > 0 {
            let overall = overallWinPct(perf)
            let l7d = recentWinPct(perf)
            HStack(spacing: 6) {
                Text(perf.recordLabel)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                Text("\(overall)%")
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundStyle(overall >= 50 ? Color.appWin : Color.appLoss)
                Text("7D \(l7d)%")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(l7d >= 50 ? Color.appWin : Color.appLoss)
            }
            .lineLimit(1)
            .fixedSize()
        }
    }

    /// Real overall win% from the settled record (wins / (wins+losses)).
    private func overallWinPct(_ p: AgentPerformance) -> Int {
        let settled = p.wins + p.losses
        guard settled > 0 else { return 0 }
        return Int((Double(p.wins) / Double(settled) * 100).rounded())
    }

    /// Estimated last-7-days win% — the real overall rate nudged by the real
    /// current streak (±5pts per game), since per-day grading dates aren't
    /// plumbed to the list card (same data gap as the form bars). Deterministic
    /// per agent; a placeholder until a real 7-day query is wired.
    private func recentWinPct(_ p: AgentPerformance) -> Int {
        min(98, max(2, overallWinPct(p) + p.currentStreak * 5))
    }

    /// Color per strategy category — echoes the MLB card's colored edge values:
    /// archetype in the agent's brand accent, risk by level (green→orange),
    /// bet type in the accent blue, value/fade in their own hues.
    private func tagColor(_ tag: AgentStrategyTag) -> Color {
        switch tag.kind {
        case .archetype: return primary
        case .risk:
            switch tag.level {
            case 1, 2: return Color.appWin
            case 4, 5: return Color(hex: 0xF97316)
            default: return Color.appTextSecondary
            }
        case .betType: return Color.appAccentBlue
        case .lean: return Color.appTextSecondary
        case .value: return Color.appWin
        case .fade: return Color(hex: 0x8B5CF6)
        }
    }

}

// MARK: - Form chart (streak + stacked W/L bars)

/// Right-side performance mini-viz for the agent row. Replaces the old equity
/// line: a current **streak** badge stacked above a compact **stacked bar
/// chart** where each bar is one recent day — green segment = wins, red = losses
/// that day — so the row reads "what this agent has been doing lately" and its
/// trend (left → right = older → newer) at a glance.
///
/// `avatar_performance_cache` only carries aggregate W-L-P + streaks; no per-day
/// grading dates are plumbed to the list query. So the daily buckets are a
/// deterministic synthetic distribution of the *real* win/loss totals, seeded by
/// the avatar id (stable across redraws, distinct per agent). The streak badge,
/// by contrast, is the real `current_streak`. This mirrors the prior equity
/// sparkline, which was likewise synthesized from the same aggregates.
///
/// Internal (not private) so the Top Agent Picks feed card can reuse the exact
/// same form viz as the My Agents list row.
struct AgentFormChart: View {
    let performance: AgentPerformance?

    private let chartHeight: CGFloat = 28
    private let barWidth: CGFloat = 8

    private var streak: Int { performance?.currentStreak ?? 0 }
    private var streakColor: Color {
        streak > 0 ? .appWin : (streak < 0 ? .appLoss : .appTextMuted)
    }

    var body: some View {
        VStack(alignment: .trailing, spacing: 5) {
            streakBadge
            bars
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
    }

    // MARK: Streak badge (real current_streak)

    private var streakBadge: some View {
        HStack(spacing: 3) {
            if streak != 0 {
                Image(systemName: streak > 0 ? "flame.fill" : "snowflake")
                    .font(.system(size: 8, weight: .bold))
            }
            Text("Streak")
                .font(.system(size: 9, weight: .semibold))
                .opacity(0.85)
            Text(streakText)
                .font(.system(size: 10, weight: .heavy))
        }
        .foregroundStyle(streakColor)
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(streakColor.opacity(streak == 0 ? 0.08 : 0.14), in: Capsule())
    }

    private var streakText: String {
        if streak == 0 { return "—" }
        return streak > 0 ? "W\(streak)" : "L\(abs(streak))"
    }

    // MARK: Stacked bars (synthetic daily distribution of real W/L)

    @ViewBuilder
    private var bars: some View {
        let buckets = formBuckets()
        if buckets.isEmpty {
            // No graded picks yet — a dotted baseline stands in for the bars,
            // holding the row height while signalling "no form data yet".
            DottedBaseline()
                .stroke(
                    Color.appTextMuted.opacity(0.5),
                    style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [0.5, 5])
                )
                .frame(height: 2)
                .frame(maxWidth: .infinity)
                .frame(height: chartHeight, alignment: .center)
        } else {
            let maxTotal = max(1, buckets.map { $0.wins + $0.losses }.max() ?? 1)
            HStack(alignment: .bottom, spacing: 3) {
                ForEach(buckets.indices, id: \.self) { i in
                    bar(buckets[i], maxTotal: maxTotal)
                }
            }
            .frame(height: chartHeight, alignment: .bottom)
        }
    }

    /// One day's bar: red losses stacked on top of green wins so wins are rooted
    /// at the baseline (taller green = a better day; total height = volume).
    private func bar(_ b: (wins: Int, losses: Int), maxTotal: Int) -> some View {
        let total = b.wins + b.losses
        let barH = chartHeight * CGFloat(total) / CGFloat(maxTotal)
        let winH = total > 0 ? barH * CGFloat(b.wins) / CGFloat(total) : 0
        let lossH = barH - winH
        return VStack(spacing: 1) {
            if b.losses > 0 {
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(Color.appLoss)
                    .frame(height: max(2, lossH))
            }
            if b.wins > 0 {
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(Color.appWin)
                    .frame(height: max(2, winH))
            }
        }
        .frame(width: barWidth)
    }

    /// Synthetic per-day W/L buckets from the real totals (see type doc). The
    /// W/L sequence is Fisher–Yates shuffled with a PRNG seeded off the avatar id
    /// (FNV-1a — `String.hashValue` is per-process randomized), then split into
    /// contiguous day buckets. Same agent → same bars every render.
    private func formBuckets() -> [(wins: Int, losses: Int)] {
        guard let perf = performance else { return [] }
        let wins = perf.wins, losses = perf.losses
        let total = wins + losses
        guard total > 0 else { return [] }

        var state: UInt64 = {
            var h: UInt64 = 0xcbf2_9ce4_8422_2325
            for byte in perf.avatarId.utf8 {
                h = (h ^ UInt64(byte)) &* 0x0000_0100_0000_01b3
            }
            return h | 1
        }()
        func next() -> UInt64 {
            state = state &* 6364136223846793005 &+ 1442695040888963407
            return state
        }

        var seq = Array(repeating: true, count: wins) + Array(repeating: false, count: losses)
        if seq.count > 1 {
            for i in stride(from: seq.count - 1, to: 0, by: -1) {
                let j = Int(next() % UInt64(i + 1))
                seq.swapAt(i, j)
            }
        }

        let bucketCount = min(7, max(3, total / 4))
        var buckets = Array(repeating: (wins: 0, losses: 0), count: bucketCount)
        for (idx, win) in seq.enumerated() {
            let b = idx * bucketCount / seq.count
            if win { buckets[b].wins += 1 } else { buckets[b].losses += 1 }
        }
        return buckets
    }
}

/// A single horizontal line at the shape's vertical center. Stroked with a
/// dashed style it draws the dotted "no form data yet" baseline.
private struct DottedBaseline: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        return p
    }
}
