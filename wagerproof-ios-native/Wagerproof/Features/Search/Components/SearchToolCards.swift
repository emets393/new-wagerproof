import SwiftUI
import WagerproofDesign

// MARK: - Card chrome

/// Explore-grid card for the Search tab's empty state. Composition mirrors the
/// reference design: an edge-to-edge graphic area on top (an oversized, angled
/// "stat sheet" clipped by the card bounds — see `AngledStatSheetGraphic`),
/// then a bold title block below. Cards are 2-up in an HStack, so everything
/// inside is sized to survive ~170pt of width.
struct SearchToolCard<Graphic: View>: View {
    let title: String
    var subtitle: String? = nil
    let action: () -> Void
    @ViewBuilder let graphic: () -> Graphic

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                // Graphic bleeds to the card edges — the clipShape below crops
                // it with the card's own rounded corners, like the reference.
                graphic()
                    .frame(maxWidth: .infinity)
                    .frame(height: 104)
                    .clipped()
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    if let subtitle {
                        Text(subtitle)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.appTextSecondary)
                            .lineLimit(2, reservesSpace: true)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.top, 8)
                .padding(.bottom, 14)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.appSurfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(Color.appBorder, lineWidth: 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Angled stat sheet graphic

/// The reference card's hero: an oversized rounded "sheet" of real example
/// stat rows, tilted a few degrees and zoomed in so it bleeds past the card's
/// top and right edges. One row reads dark/active while the rest sit faded.
///
/// The loop: the highlight walks down the 3 visible rows; each time it leaves
/// a row, that row erases and typewriter-types the stat 3 positions ahead in
/// the pool (pass 6 stats → every row alternates between two of them), with
/// the icon morphing via a symbol-replace transition mid-rewrite. A soft
/// gradient washes the top of the graphic so clipped content fades out
/// instead of hitting the card edge.
struct AngledStatSheetGraphic: View {
    /// Stat pool. The first 3 seed the visible rows; rewrites pull the rest.
    let rows: [(icon: String, text: String)]
    /// Stagger between sibling cards so they don't highlight in lockstep.
    var startDelay: Double = 0

    private static let visibleSlots = 3

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var activeSlot = 0
    /// Pool index currently shown in each visible row.
    @State private var slotStat: [Int]
    @State private var slotIcon: [String]
    @State private var slotText: [String]

    init(rows: [(icon: String, text: String)], startDelay: Double = 0) {
        self.rows = rows
        self.startDelay = startDelay
        let seed = Array(rows.prefix(Self.visibleSlots))
        _slotStat = State(initialValue: Array(seed.indices))
        _slotIcon = State(initialValue: seed.map { $0.icon })
        _slotText = State(initialValue: seed.map { $0.text })
    }

    var body: some View {
        // The sheet is deliberately wider than the card. Rendering it as an
        // overlay on a clear base keeps it out of layout — otherwise its
        // 280pt width would inflate the card and blow the 2-up row off
        // screen. The card's `.clipped()` crops the bleed.
        Color.clear
            .overlay(alignment: .topLeading) {
                sheet
                    // bottomLeading anchor keeps the visible bottom-left
                    // corner stable while the tilt swings the far edge off
                    // the card.
                    .rotationEffect(.degrees(-8), anchor: .bottomLeading)
                    .offset(x: 12, y: -22)
            }
        .overlay(alignment: .top) {
            // "Slight gradient at the top" — card surface fading over the
            // sheet so clipped rows dissolve instead of slicing off.
            LinearGradient(
                colors: [Color.appSurfaceElevated.opacity(0.9), Color.appSurfaceElevated.opacity(0)],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 30)
            .allowsHitTesting(false)
        }
        .task {
            // Highlight cycling and the typewriter are color/text crossfades
            // (no positional motion), so they run under Reduce Motion too —
            // just with plain eases instead of springs.
            if startDelay > 0 {
                try? await Task.sleep(for: .seconds(startDelay))
            }
            guard !slotText.isEmpty else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.6))
                guard !Task.isCancelled else { break }
                let prev = activeSlot
                withAnimation(
                    reduceMotion
                        ? .easeInOut(duration: 0.35)
                        : .spring(response: 0.5, dampingFraction: 0.8)
                ) {
                    activeSlot = (prev + 1) % slotText.count
                }
                // Rewrite the row the highlight just left with the stat 3
                // ahead in the pool. Runs inline (not a spawned Task) so it
                // auto-cancels with the view and stays under the 1.6s tick.
                let next = (slotStat[prev] + Self.visibleSlots) % rows.count
                slotStat[prev] = next
                await typewrite(slot: prev, to: rows[next])
            }
        }
    }

    /// Backspace the slot's current text, morph the icon, then type the new
    /// stat character-by-character. ~1s total for a 20-char stat, so a full
    /// rewrite always lands inside one highlight tick.
    private func typewrite(slot: Int, to stat: (icon: String, text: String)) async {
        while !slotText[slot].isEmpty {
            guard !Task.isCancelled else { return }
            slotText[slot].removeLast()
            try? await Task.sleep(for: .milliseconds(14))
        }
        if reduceMotion {
            slotIcon[slot] = stat.icon
        } else {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                slotIcon[slot] = stat.icon
            }
        }
        for ch in stat.text {
            guard !Task.isCancelled else { return }
            slotText[slot].append(ch)
            try? await Task.sleep(for: .milliseconds(32))
        }
    }

    private var sheet: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(slotText.indices, id: \.self) { i in
                statRow(slot: i)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 18)
        .frame(width: 280, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.appSurfaceMuted)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.appBorderStrong.opacity(0.6), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.35), radius: 10, y: 4)
    }

    private func statRow(slot: Int) -> some View {
        HStack(spacing: 9) {
            Image(systemName: slotIcon[slot])
                .font(.system(size: 13, weight: .semibold))
                .frame(width: 18)
                // "Animated into the new icon" — old symbol scales out, new
                // one scales in when the typewriter swaps slotIcon.
                .contentTransition(.symbolEffect(.replace))
            // Space placeholder keeps the row's line height when the
            // typewriter has erased everything.
            Text(slotText[slot].isEmpty ? " " : slotText[slot])
                .font(.system(size: 13.5, weight: .semibold))
                .lineLimit(1)
                .fixedSize() // overflow is the point — the card clips it
        }
        .foregroundStyle(activeSlot == slot ? Color.appTextPrimary : Color.appTextMuted.opacity(0.65))
    }
}

// MARK: - Stacked stat cards graphic

/// Second reference style: a fanned stack of mini stat cards (headline +
/// subline, italic) that loops by sending the front card to the back of the
/// stack while the next one springs forward. Pass 4 items — 3 render as the
/// visible fan, the 4th slot is the hidden hand-off position the exiting
/// front card fades through.
struct StackedStatCardsGraphic: View {
    let items: [(headline: String, subline: String)]
    /// Stagger between sibling cards so they don't shuffle in lockstep.
    var startDelay: Double = 0

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var step = 0

    var body: some View {
        // Like the angled sheet, the stack is zoomed past the card bounds —
        // overlay on a clear base keeps the oversized cards out of layout;
        // SearchToolCard's `.clipped()` crops the bleed.
        Color.clear
            .overlay {
                ZStack {
                    ForEach(items.indices, id: \.self) { i in
                        let slot = ((i - step) % items.count + items.count) % items.count
                        miniCard(items[i])
                            .offset(x: xOffset(for: slot), y: yOffset(for: slot))
                            // Slots past the visible fan are the hand-off
                            // position — the exiting front card fades out
                            // animating into it, and re-fades in at the back
                            // of the fan next tick.
                            .opacity(slot >= 3 ? 0 : 1)
                            .zIndex(Double(items.count - slot))
                    }
                }
                // Bias down-left so the back cards' up-right steps stay
                // centered as a group.
                .offset(x: -6, y: 2)
            }
        .overlay(alignment: .leading) {
            // The stack's left side melts into the card background, per the
            // reference.
            LinearGradient(
                colors: [Color.appSurfaceElevated, Color.appSurfaceElevated.opacity(0)],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(width: 56)
            .allowsHitTesting(false)
        }
        .task {
            // The whole effect is positional, so Reduce Motion shows the
            // resting fan instead of shuffling.
            guard !reduceMotion else { return }
            if startDelay > 0 {
                try? await Task.sleep(for: .seconds(startDelay))
            }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2.0))
                guard !Task.isCancelled else { break }
                withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                    step += 1
                }
            }
        }
    }

    // Stack geometry — translation only, no rotation: each back card steps
    // toward the top-right in parallel with the front, like the reference.
    private func xOffset(for slot: Int) -> CGFloat { CGFloat(slot) * 10 }
    private func yOffset(for slot: Int) -> CGFloat { CGFloat(slot) * -8 }

    private func miniCard(_ item: (headline: String, subline: String)) -> some View {
        VStack(spacing: 2) {
            Text(item.headline)
                .font(.system(size: 21, weight: .heavy))
                .italic()
                .foregroundStyle(Color.appTextPrimary)
            Text(item.subline)
                .font(.system(size: 14, weight: .semibold))
                .italic()
                .foregroundStyle(Color.appTextMuted)
        }
        .lineLimit(1)
        .fixedSize()
        .frame(width: 124, height: 78)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.appSurfaceMuted)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.appBorderStrong.opacity(0.6), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.3), radius: 8, y: 4)
    }
}

// MARK: - Radar sweep graphic

/// Third style: a radar scanning for betting outliers. A beam sweeps a ring
/// grid on a loop; each blip flashes with a glow (plus an optional "+EV" /
/// "FADE" tag) the moment the beam passes its bearing, then decays until the
/// next pass. The radar is oversized so the outer ring bleeds past the card
/// edges, with the family's soft top fade.
struct RadarSweepGraphic: View {
    /// Beam revolutions period (seconds). Blip flash timing derives from it.
    var period: Double = 4.0

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var beamAngle: Double = 0

    private static let diameter: CGFloat = 150

    /// Bearing (degrees, 0 = 3 o'clock, clockwise), radius fraction, tint,
    /// and optional tag for each contact.
    private let blips: [(angle: Double, radius: CGFloat, color: Color, tag: String?)] = [
        (300, 0.62, .appPrimary, "+EV"),
        (170, 0.68, .appAccentRed, "FADE"),
        (80, 0.45, .appPrimary, nil),
    ]

    var body: some View {
        Color.clear
            .overlay {
                ZStack {
                    ringGrid
                    if !reduceMotion {
                        beam
                    }
                    ForEach(blips.indices, id: \.self) { i in
                        let blip = blips[i]
                        RadarBlip(
                            color: blip.color,
                            tag: blip.tag,
                            // The beam's bright edge starts at bearing 0 and
                            // sweeps counterclockwise (so its trail lags), so
                            // a blip at bearing θ is hit (360-θ)/360 of the
                            // way through each revolution.
                            delay: (360 - blip.angle) / 360 * period,
                            period: period,
                            frozen: reduceMotion
                        )
                        .offset(blipOffset(blip.angle, blip.radius))
                    }
                }
                .frame(width: Self.diameter, height: Self.diameter)
            }
        .overlay(alignment: .top) {
            LinearGradient(
                colors: [Color.appSurfaceElevated.opacity(0.85), Color.appSurfaceElevated.opacity(0)],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 26)
            .allowsHitTesting(false)
        }
        .task {
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: period).repeatForever(autoreverses: false)) {
                beamAngle = 360
            }
        }
    }

    private var ringGrid: some View {
        ZStack {
            ForEach([Self.diameter, 104, 60], id: \.self) { d in
                Circle()
                    .stroke(Color.appBorderStrong.opacity(0.4), lineWidth: 1)
                    .frame(width: d, height: d)
            }
            Rectangle().fill(Color.appBorderStrong.opacity(0.25))
                .frame(width: Self.diameter, height: 1)
            Rectangle().fill(Color.appBorderStrong.opacity(0.25))
                .frame(width: 1, height: Self.diameter)
            Circle().fill(Color.appTextMuted)
                .frame(width: 4, height: 4)
        }
    }

    /// Sweep wedge: an angular gradient whose bright edge leads at bearing 0,
    /// trailing off over a quarter turn, spun by `beamAngle`.
    private var beam: some View {
        Circle()
            .fill(
                AngularGradient(
                    stops: [
                        .init(color: Color.appPrimary.opacity(0.25), location: 0),
                        .init(color: Color.appPrimary.opacity(0), location: 0.3),
                        .init(color: Color.appPrimary.opacity(0), location: 1),
                    ],
                    center: .center
                )
            )
            .frame(width: Self.diameter, height: Self.diameter)
            .rotationEffect(.degrees(-beamAngle)) // counterclockwise: trail lags the bright edge
    }

    private func blipOffset(_ angle: Double, _ radiusFraction: CGFloat) -> CGSize {
        let r = Double(Self.diameter / 2 * radiusFraction)
        let rad = angle * .pi / 180
        return CGSize(width: r * Darwin.cos(rad), height: r * Darwin.sin(rad))
    }
}

/// One radar contact: flashes to full glow when the beam passes (its `delay`
/// into each revolution), then eases back down to a faint resting state.
private struct RadarBlip: View {
    let color: Color
    let tag: String?
    let delay: Double
    let period: Double
    let frozen: Bool

    /// 0 = resting faint dot, 1 = just-pinged full glow.
    @State private var energy: Double = 0

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 7, height: 7)
                .shadow(color: color.opacity(0.9), radius: 3 + energy * 5)
            if let tag {
                Text(tag)
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(color)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(color.opacity(0.18)))
                    .fixedSize()
            }
        }
        .opacity(0.3 + energy * 0.7)
        .scaleEffect(0.85 + energy * 0.25)
        .task {
            // Reduce Motion: no sweep, so show every contact steadily lit.
            if frozen {
                energy = 0.8
                return
            }
            try? await Task.sleep(for: .seconds(delay))
            while !Task.isCancelled {
                energy = 1 // instant flash as the beam crosses
                withAnimation(.easeOut(duration: period * 0.75)) {
                    energy = 0
                }
                try? await Task.sleep(for: .seconds(period))
            }
        }
    }
}

#Preview("Search tool cards") {
    HStack(alignment: .top, spacing: 12) {
        SearchToolCard(
            title: "Angles",
            subtitle: "Situational betting trends",
            action: {}
        ) {
            AngledStatSheetGraphic(rows: [
                ("trophy.fill", "CHC rank poor vs LHP"),
                ("scope", "Home favs 8-2 ATS"),
                ("sun.max.fill", "Unders 6-1 in day games"),
                ("flame.fill", "SF on a 5-game heater"),
                ("calendar", "NYM 1-6 in day games"),
                ("chart.line.uptrend.xyaxis", "Overs 12-3 at Coors"),
            ])
        }
        SearchToolCard(
            title: "Props",
            subtitle: "Player prop matchups",
            action: {}
        ) {
            AngledStatSheetGraphic(rows: [
                ("figure.baseball", "Judge O 1.5 total bases"),
                ("target", "Has 4 hits in last 10"),
                ("flame.fill", "8+ K's in 3 straight"),
                ("baseball.fill", "Ohtani O 0.5 HR +320"),
                ("chart.bar.fill", "Hits prop cashing 70%"),
                ("bolt.fill", "Skenes 7+ K streak"),
            ], startDelay: 0.8)
        }
        SearchToolCard(
            title: "Agents",
            subtitle: "Top performing AI experts",
            action: {}
        ) {
            StackedStatCardsGraphic(items: [
                ("100%", "10/10"),
                ("+12.4u", "Last 30"),
                ("73%", "ATS picks"),
                ("58-31", "Season"),
            ], startDelay: 0.4)
        }
        SearchToolCard(
            title: "Outliers",
            subtitle: "Value & fade alerts",
            action: {}
        ) { RadarSweepGraphic() }
    }
    .padding(16)
    .background(Color.appSurface)
}
