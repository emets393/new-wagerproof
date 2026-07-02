import SwiftUI
import WagerproofDesign
#if canImport(UIKit)
import UIKit
#endif

// Shared building blocks for the Today's Picks generation card
// (`AgentGenerationCard`, in AgentGenerationGlyphLoader.swift): the seated
// pixel-character-at-a-laptop avatar, the "Research in Progress" text shimmer,
// and the swipe-to-commit generation pill (ported from the Orbital Focus
// mission-launch slider). The card composes these across its research → polling
// morph; they're kept here as standalone pieces so the card stays focused on the
// state machine.

// MARK: - Working desk avatar (character + laptop)

/// The agent's pixel character seated + typing (`frontSitWork` frames) with an
/// open laptop composited in front of it, over a soft accent floor glow so the
/// little scene reads on pure black. Nearest-neighbor scaling keeps the pixel
/// art crisp; the seated frames are cropped from the same `avatar_N` sheet the
/// office HQ walks (see `PixelSpriteAvatar` for the standing/idle sibling).
struct WorkingDeskAvatar: View {
    let spriteIndex: Int
    var accent: Color
    /// On-screen height of the 48×64 character sprite. Everything else scales
    /// off this so the composition stays proportional at any size.
    var charHeight: CGFloat = 120

    /// Character sprite is 48×64; laptop sprite is 32×64. Derive display sizes
    /// from `charHeight` so they share one pixel scale (crisp + aligned).
    private var charWidth: CGFloat { charHeight * 48 / 64 }
    private var laptopHeight: CGFloat { charHeight * 0.60 }
    private var laptopWidth: CGFloat { laptopHeight * 32 / 64 }

    var body: some View {
        ZStack {
            // Accent floor glow — grounds the character on the black tile.
            Ellipse()
                .fill(accent.opacity(0.30))
                .frame(width: charWidth * 2.3, height: charHeight * 0.42)
                .blur(radius: 28)
                .offset(y: charHeight * 0.36)

            SitWorkSprite(spriteIndex: spriteIndex)
                .frame(width: charWidth, height: charHeight)

            // Laptop art is centered in its 64px frame; nudge it down onto the
            // character's hands/desk line and draw it last so it sits in FRONT.
            LaptopSprite()
                .frame(width: laptopWidth, height: laptopHeight)
                .offset(y: charHeight * 0.22)
        }
        .frame(height: charHeight * 1.12)
    }
}

/// The seated `frontSitWork` loop cropped from `avatar_{index}`, animated at a
/// gentle "typing" cadence. Frozen on frame 0 if the sheet is missing. Also used
/// by the agent detail HERO avatar (laptop-working mode while a run is in flight).
struct SitWorkSprite: View {
    let spriteIndex: Int

    /// Typing cadence — a touch livelier than the office's 6fps work loop so the
    /// hands read as busy in this close-up.
    private static let fps: Double = 5

    var body: some View {
        let frames = WorkingDeskFrames.sitWork(for: spriteIndex)
        if frames.count > 1 {
            TimelineView(.periodic(from: .now, by: 1.0 / Self.fps)) { context in
                pixel(frames[Self.frameIndex(at: context.date, count: frames.count)])
            }
        } else if let first = frames.first {
            pixel(first)
        } else {
            Color.clear
        }
    }

    private func pixel(_ ui: UIImage) -> some View {
        Image(uiImage: ui).interpolation(.none).resizable().scaledToFit()
    }

    private static func frameIndex(at date: Date, count: Int) -> Int {
        Int(date.timeIntervalSinceReferenceDate * fps) % count
    }
}

/// The open front-facing laptop sprite (a loose PixelOffice resource in the
/// design bundle — same asset the office HQ opens on occupied desks).
struct LaptopSprite: View {
    var body: some View {
        #if canImport(UIKit)
        if let ui = UIImage(named: "office_laptop_front_open", in: .wagerproofDesign, with: nil) {
            Image(uiImage: ui).interpolation(.none).resizable().scaledToFit()
        } else {
            Color.clear
        }
        #else
        Color.clear
        #endif
    }
}

/// Crops + caches the `frontSitWork` frames out of an `avatar_N` sheet. Mirrors
/// `PixelSpriteAvatar.frames(for:)` but plays the seated-work animation instead
/// of front-idle; kept separate so the widely-used idle avatar is untouched.
private enum WorkingDeskFrames {
    @MainActor private static var cache: [Int: [UIImage]] = [:]

    @MainActor
    static func sitWork(for index: Int) -> [UIImage] {
        let idx = max(0, min(7, index))
        if let cached = cache[idx] { return cached }
        #if canImport(UIKit)
        guard let sheet = UIImage(named: "avatar_\(idx)", in: .wagerproofDesign, with: nil),
              let cg = sheet.cgImage else { return [] }
        // Reuse the office geometry + animation table so the frame layout stays
        // a single source of truth (8×9 sheet, 48×64 frames).
        let cols = PixelOfficeGeo.sheetCols
        let fw = cg.width / cols
        let fh = cg.height / PixelOfficeGeo.sheetRows
        let result: [UIImage] = PixelAnim.frontSitWork.frameIndices.compactMap { fi in
            let col = fi % cols
            let row = fi / cols
            let rect = CGRect(x: col * fw, y: row * fh, width: fw, height: fh)
            guard let cropped = cg.cropping(to: rect) else { return nil }
            return UIImage(cgImage: cropped, scale: sheet.scale, orientation: .up)
        }
        cache[idx] = result
        return result
        #else
        return []
        #endif
    }
}

// MARK: - Research shimmer text

/// A left→right shimmer glint that sweeps across dim-white text — the "iOS
/// thinking" motif for the Research in Progress line. Dim base text plus a
/// bright band masked to the glyph shapes and composited `plusLighter`, so only
/// the letters light up as the band travels. Static under Reduce Motion.
struct ResearchShimmerText: View {
    let text: String
    var font: Font = .system(size: 15, weight: .heavy)

    @State private var phase: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(font)
            .kerning(0.5)
            .foregroundStyle(Color.white.opacity(0.34))
            .overlay {
                GeometryReader { geo in
                    let w = geo.size.width
                    let band = max(56, w * 0.5)
                    Rectangle()
                        .fill(LinearGradient(colors: [.clear, .white, .clear],
                                             startPoint: .leading, endPoint: .trailing))
                        .frame(width: band)
                        // phase 0→1 sweeps the band from fully-left to fully-right.
                        .offset(x: phase * (w + band) - band)
                        .blendMode(.plusLighter)
                }
                .mask(Text(text).font(font).kerning(0.5))
                .allowsHitTesting(false)
            }
            .onAppear {
                guard !reduceMotion else { return }
                phase = 0
                withAnimation(.linear(duration: 1.9).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

// MARK: - Swipe to generate pill

/// Swipe-to-commit generation trigger, ported from the Orbital Focus mission
/// launch slider (`SwipeToLaunchButton`). Three escalating layers of feedback as
/// you drag the thumb across:
///   • a shimmering label whose glyphs flip white → black under the fill,
///   • a heat-up ignition fill that grows and warms (accent → gold) with travel,
///   • building soft haptics whose intensity ramps with the drag, capped by a
///     success + heavy-impact rumble at commit.
/// Past 90% it commits (`onCommit`); short of that it springs back. Disabled →
/// a static locked capsule with no interaction.
struct SwipeToGeneratePill: View {
    /// Label copy, e.g. "Swipe to get picks".
    let title: String
    /// Agent brand tint — drives the ignition fill + thumb accent.
    var accent: Color
    /// false → static locked capsule, no gesture.
    var isEnabled: Bool = true
    /// Fired once the swipe crosses the commit threshold.
    let onCommit: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var dragProgress: CGFloat = 0
    @State private var confirmed = false
    @State private var lastNotch = 0
    @State private var shimmerPhase: CGFloat = 0

    /// Soft impact generator for the per-notch building haptics, kept warm with
    /// prepare() so the ramp feels tight.
    #if canImport(UIKit)
    private let dragHaptic = UIImpactFeedbackGenerator(style: .soft)
    #endif

    private let height: CGFloat = 56
    private let thumbInset: CGFloat = 4
    private var thumbSize: CGFloat { height - thumbInset * 2 }

    var body: some View {
        Group {
            if isEnabled { slider } else { lockedLabel }
        }
        .frame(height: height)
        .onChange(of: title) { _, _ in reset() }
    }

    // MARK: Locked

    private var lockedLabel: some View {
        HStack(spacing: 7) {
            Image(systemName: "lock.fill").font(.system(size: 13, weight: .bold))
            Text(title).font(.system(size: 14, weight: .heavy)).lineLimit(1)
        }
        .foregroundStyle(Color.appTextSecondary)
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .background(Color.white.opacity(0.08), in: Capsule())
        .overlay(Capsule().strokeBorder(.white.opacity(0.10), lineWidth: 1))
    }

    // MARK: Slider

    private var slider: some View {
        GeometryReader { proxy in
            let trackW = proxy.size.width
            let maxDrag = max(1, trackW - thumbSize - thumbInset * 2)
            let fillW = dragProgress * maxDrag + thumbSize + thumbInset * 2

            ZStack(alignment: .leading) {
                // 1. Track base.
                Capsule()
                    .fill(Color.white.opacity(0.08))
                    .overlay(Capsule().strokeBorder(.white.opacity(0.12), lineWidth: 1))

                // 2. Heat-up ignition fill — grows with the thumb and warms from
                //    the agent accent toward gold as progress builds, glowing
                //    stronger toward commit.
                Capsule()
                    .fill(LinearGradient(
                        colors: [accent, accent, Color(hex: 0xFFE7A6)],
                        startPoint: .leading, endPoint: .trailing))
                    .frame(width: fillW)
                    .opacity(0.4 + Double(dragProgress) * 0.6)
                    .brightness(Double(dragProgress) * 0.12)
                    .shadow(color: accent.opacity(Double(dragProgress) * 0.8),
                            radius: 16 * dragProgress)
                    .animation(.linear(duration: 0.08), value: dragProgress)

                // 3. Centered label — the SAME glyphs render white on the not-yet
                //    swiped side and black under the bright fill, so the text
                //    appears to recolor as the swipe crosses it. One shimmer
                //    sweep rides over both.
                swipeLabel(fillWidth: fillW)
                    .opacity(confirmed ? 0 : 1)
                    .allowsHitTesting(false)

                // 4. Draggable thumb.
                thumb
                    .offset(x: dragProgress * maxDrag + thumbInset)
                    .gesture(dragGesture(maxDrag: maxDrag))
            }
            .clipShape(Capsule())
        }
        .frame(height: height)
        .onAppear {
            #if canImport(UIKit)
            dragHaptic.prepare()
            #endif
            startShimmer()
        }
        // Accessibility: VoiceOver can't swipe a custom slider — expose a plain
        // button action that commits directly.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
        .accessibilityHint("Swipe to generate today's picks")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { onCommit() }
    }

    private var thumb: some View {
        ZStack {
            Circle()
                .fill(.white)
                .shadow(color: .black.opacity(0.25), radius: 5, y: 2)
            Image(systemName: confirmed ? "sparkles" : "chevron.right")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(confirmed ? accent : Color(hex: 0x0B0E0D))
        }
        .frame(width: thumbSize, height: thumbSize)
    }

    // MARK: Shimmer label

    private func swipeLabel(fillWidth: CGFloat) -> some View {
        ZStack {
            labelText(.white.opacity(0.82))
            labelText(.black)
                .mask(alignment: .leading) { Rectangle().frame(width: fillWidth) }
        }
        .overlay { shimmerSweep.mask { labelText(.white) } }
    }

    private func labelText(_ color: Color) -> some View {
        Text(title)
            .font(.system(size: 15, weight: .bold))
            .lineLimit(1)
            .foregroundStyle(color)
            .frame(maxWidth: .infinity)   // center within the full track width
    }

    /// Moving highlight band across the glyphs. `.plusLighter` brightens whatever
    /// is beneath, so it reads as a shimmer on both the white and black portions.
    private var shimmerSweep: some View {
        GeometryReader { g in
            let w = g.size.width
            let band = max(70, w * 0.26)
            Rectangle()
                .fill(LinearGradient(colors: [.clear, .white, .clear],
                                     startPoint: .leading, endPoint: .trailing))
                .frame(width: band)
                .offset(x: shimmerPhase * (w + band) - band)
        }
        .blendMode(.plusLighter)
    }

    private func startShimmer() {
        guard !reduceMotion else { return }
        shimmerPhase = 0
        withAnimation(.linear(duration: 1.7).repeatForever(autoreverses: false)) {
            shimmerPhase = 1
        }
    }

    // MARK: Drag

    private func dragGesture(maxDrag: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard !confirmed else { return }
                let p = min(max(value.translation.width / maxDrag, 0), 1)
                dragProgress = p
                // Building haptics: each new notch fires a soft impact whose
                // intensity ramps with the drag (0.35 → 1.0).
                let notch = Int(p * 14)
                if notch != lastNotch {
                    lastNotch = notch
                    #if canImport(UIKit)
                    dragHaptic.impactOccurred(intensity: 0.35 + p * 0.65)
                    dragHaptic.prepare()
                    #endif
                }
            }
            .onEnded { _ in
                guard !confirmed else { return }
                if dragProgress > 0.9 {
                    commit()
                } else {
                    lastNotch = 0
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        dragProgress = 0
                    }
                    #if canImport(UIKit)
                    UIImpactFeedbackGenerator(style: .rigid).impactOccurred(intensity: 0.5)
                    #endif
                }
            }
    }

    private func commit() {
        confirmed = true
        withAnimation(.easeOut(duration: 0.18)) { dragProgress = 1 }
        #if canImport(UIKit)
        // Ignition finale: success cue + a heavy impact rumble.
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        #endif
        onCommit()
    }

    private func reset() {
        confirmed = false
        lastNotch = 0
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { dragProgress = 0 }
    }
}

#if DEBUG
#Preview("Working desk avatar") {
    ZStack {
        Color(hex: 0x0B1011).ignoresSafeArea()
        WorkingDeskAvatar(spriteIndex: 2, accent: Color(hex: 0x6366F1))
    }
    .preferredColorScheme(.dark)
}
#endif
