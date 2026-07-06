import SwiftUI
import CoreMotion
import WagerproofDesign
import WagerproofModels
#if canImport(UIKit)
import UIKit
#endif

// =====================================================================
// AgentPickFocusView — tap-to-focus + print-then-swipe presentation.
//
// Tapping a mini ticket brings its large `ExpandedAgentPickTicket` into focus,
// centered over a darkened backdrop with a "Pick n/N" header + dots. Picks page
// horizontally one at a time (NO fan-out) — the shown card leans with the
// accelerometer, and a native Liquid-Glass back button returns underneath.
//
// `printIntro` (used to reveal freshly generated picks) opens on a high-intensity
// pixel-wave that washes over the whole screen, then recedes into a receipt-
// printer feed: the first ticket prints up out of a slot; after that the user
// swipes through the rest as pages.
//
// The printer-feed mask + `PickTicketMotion` accelerometer parallax + the dual-
// Spacer / fixed-fit centering (so the whole ticket AND printer stay on-screen)
// are ported from the user's own orbital-focus app (Features/MissionControl/
// MissionTicketFlow.swift — PrintStage + TicketMotion), re-skinned for picks.
// =====================================================================

struct AgentPickFocusView: View {
    /// Straight picks + parlay tickets, interleaved — parlays page, print, and
    /// share exactly like picks (their card is `ExpandedAgentParlayTicket`).
    let items: [AgentBetItem]
    var accent: Color = .appPrimary
    /// When true, open on the pixel-wave + printer feed before paging is live.
    var printIntro: Bool = false
    /// Surfaces the per-pick data audit (the card's "View data audit" button).
    /// Parlay cards have no audit — the audit sheet resolves by pick id.
    var onAudit: (AgentPick) -> Void = { _ in }
    /// Owner-only delete affordance — a guaranteed, VoiceOver-accessible
    /// alternative to the rail's swipe gesture. Nil hides the button entirely.
    var onDelete: ((AgentBetItem) -> Void)? = nil
    let onClose: () -> Void

    @State private var index: Int
    @State private var motion = PickTicketMotion()
    @State private var appeared = false
    @State private var started = false
    // Print-intro state.
    @State private var printProgress: CGFloat = 0   // 0 → below the slot, 1 → emerged
    @State private var printed: Bool                // true once the first card has fed out
    /// Tallest natural ticket height seen so far — grows monotonically so the
    /// fit-scale never clips a card once it's been measured.
    @State private var cardHeight: CGFloat = 440
    /// Opacity of the high-intensity pixel-wave cover that washes over everything
    /// as the print UI opens (the generation-complete transition).
    @State private var waveOpacity: Double = 0
    /// Set when the share button renders the current card to an image; drives the
    /// share sheet.
    @State private var shareItem: ShareableTicketImage? = nil

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let cardMaxTiltDeg: Double = 8
    /// Beyond this many picks, the dot row would get noisy — drop to the "n/N"
    /// text alone.
    private let maxDots = 8

    init(
        items: [AgentBetItem],
        accent: Color = .appPrimary,
        startIndex: Int = 0,
        printIntro: Bool = false,
        onAudit: @escaping (AgentPick) -> Void = { _ in },
        onDelete: ((AgentBetItem) -> Void)? = nil,
        onClose: @escaping () -> Void
    ) {
        self.items = items
        self.accent = accent
        self.printIntro = printIntro
        self.onAudit = onAudit
        self.onDelete = onDelete
        self.onClose = onClose
        _index = State(initialValue: max(0, min(startIndex, max(0, items.count - 1))))
        _printed = State(initialValue: !printIntro)
    }

    /// Picks-only convenience — callers without parlay data keep their shape.
    init(
        picks: [AgentPick],
        accent: Color = .appPrimary,
        startIndex: Int = 0,
        printIntro: Bool = false,
        onAudit: @escaping (AgentPick) -> Void = { _ in },
        onClose: @escaping () -> Void
    ) {
        self.init(
            items: picks.map(AgentBetItem.pick),
            accent: accent,
            startIndex: startIndex,
            printIntro: printIntro,
            onAudit: onAudit,
            onClose: onClose
        )
    }

    var body: some View {
        ZStack {
            backdrop
            // Header pinned up top; the near-full-width ticket fills the rest,
            // top-anchored so the most important lines (teams, market, odds) stay
            // visible even when the whole ticket is taller than the screen.
            VStack(spacing: 12) {
                header
                    .opacity(printed ? 1 : 0)
                    .padding(.top, 8)
                printerRegion
            }
            .padding(.horizontal, 10)
            // Tap-to-focus expands the big view in from ~0.9 while the rest fades
            // (the backdrop covers the detail). The print-intro path uses the
            // wave + feed instead, so no scale there.
            .scaleEffect(printIntro ? 1 : (appeared ? 1 : 0.9), anchor: .center)
            // High-intensity pixel-wave cover — the transition INTO the print UI.
            if printIntro {
                PixelWaveBackground(accentColor: accent, intensity: .high)
                    .ignoresSafeArea()
                    .opacity(waveOpacity)
                    .allowsHitTesting(false)
            }
            // Keep the back button as the top-most hit-testing layer so it's never
            // swallowed by the backdrop field or the pager.
            topBar.zIndex(10)
        }
        .opacity(appeared ? 1 : 0)
        .onAppear { present() }
        .onDisappear { motion.stop() }
        .sheet(item: $shareItem) { item in
            ShareSheet(items: [item.image])
        }
    }

    // MARK: Backdrop

    @ViewBuilder
    private var backdrop: some View {
        if printIntro {
            // Generation-complete: the print UI rides over the agent's pulsing
            // pixel field (the agent detail behind is covered by its opaque base,
            // so it reads as fading out). The initial high-intensity flash comes
            // from the wave cover in `body`.
            ZStack {
                Color.black.ignoresSafeArea()
                // Inert: the field installs its own tap-ripple gesture that would
                // otherwise steal taps (incl. the back button). Keep it visual only.
                PixelWaveBackground(accentColor: accent).ignoresSafeArea()
                    .allowsHitTesting(false)
            }
            .contentShape(Rectangle())
            .onTapGesture { close() }
        } else {
            plainBackdrop
        }
    }

    private var plainBackdrop: some View {
        Color.black.opacity(0.74)
            .background(.ultraThinMaterial)
            .ignoresSafeArea()
            .contentShape(Rectangle())
            .onTapGesture { close() }
    }

    // MARK: Header (Pick n/N + dots)

    private var header: some View {
        VStack(spacing: 8) {
            // "Play" not "Pick" — the pager can hold parlay tickets too.
            Text("Play \(index + 1)/\(items.count)")
                .font(.system(size: 13, weight: .heavy))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
                .contentTransition(.numericText())
                .monospacedDigit()
            if items.count > 1 && items.count <= maxDots {
                HStack(spacing: 6) {
                    ForEach(items.indices, id: \.self) { i in
                        Circle()
                            .fill(i == index ? accent : Color.white.opacity(0.25))
                            .frame(width: 6, height: 6)
                    }
                }
                .animation(.easeInOut(duration: 0.2), value: index)
            }
        }
    }

    // MARK: Back button (native Liquid Glass)

    private var topBar: some View {
        VStack {
            HStack {
                Button { close() } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 42, height: 42)
                        .liquidGlassBackground(in: Circle())
                        .overlay(Circle().strokeBorder(.white.opacity(0.16), lineWidth: 1))
                }
                .buttonStyle(.plain)
                Spacer()
                // Share JUST the pick card (no backdrop). Hidden during the feed.
                Button { shareCurrentCard() } label: {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 42, height: 42)
                        .liquidGlassBackground(in: Circle())
                        .overlay(Circle().strokeBorder(.white.opacity(0.16), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .opacity(printed ? 1 : 0)
                // Guaranteed, VoiceOver-reachable delete path — the rail's swipe
                // gesture is a custom drag a screen reader can't perform.
                if let onDelete, items.indices.contains(index) {
                    Button { onDelete(items[index]) } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Color.appLoss)
                            .frame(width: 42, height: 42)
                            .liquidGlassBackground(in: Circle())
                            .overlay(Circle().strokeBorder(.white.opacity(0.16), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .opacity(printed ? 1 : 0)
                    .accessibilityLabel("Delete this play")
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            Spacer()
        }
    }

    // MARK: Printer region (feed → page)

    /// The ticket area. The ticket prints at NEAR-FULL screen width for
    /// readability and is TOP-ANCHORED at natural size — no fit-scale, so tall
    /// tickets simply fill down and clip at the bottom ("print up to fill"). While
    /// the intro feed runs, the first ticket prints up out of a slot at the bottom;
    /// after that it's a single-card horizontal pager.
    private var printerRegion: some View {
        GeometryReader { geo in
            let cardW = geo.size.width - 8   // near full width
            let topInset: CGFloat = 6
            Group {
                if printIntro && !printed {
                    feedingTicket(regionSize: geo.size, cardW: cardW, topInset: topInset)
                } else {
                    pager(regionSize: geo.size, cardW: cardW, topInset: topInset)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            // Clip the overflow below the visible area (the tall ticket keeps
            // feeding "into" the slot off-screen).
            .clipped()
        }
    }

    /// The first ticket feeding up out of a slot bar at the bottom. Top-anchored at
    /// its rest position so the hand-off to `pager` (same anchor + width) is
    /// seamless; the lower part stays clipped below the slot.
    private func feedingTicket(regionSize: CGSize, cardW: CGFloat, topInset: CGFloat) -> some View {
        let h = regionSize.height
        // Ticket top: at the slot (bottom) when printProgress = 0, at `topInset`
        // when fully fed. Center = top + half the natural height.
        let topY = topInset + (h - topInset) * (1 - printProgress)
        let centerY = topY + cardHeight / 2
        return ZStack {
            if let first = items.first {
                ticketView(first, width: cardW, measure: true)
                    .position(x: regionSize.width / 2, y: centerY)
            }
        }
        .frame(width: regionSize.width, height: regionSize.height)
        .overlay {
            slotBar
                .frame(width: cardW)
                .position(x: regionSize.width / 2, y: h)
                .opacity(printed ? 0 : 1)
        }
    }

    /// Printed picks as a horizontal pager of VERTICALLY-SCROLLABLE tickets: the
    /// tall full-width ticket scrolls so the whole thing is reachable, and swiping
    /// left/right pages between picks (native `TabView` paging, orthogonal to the
    /// scroll so they don't fight). `selection` keeps the header "Pick n/N" + dots
    /// in sync; the current page leans with the accelerometer.
    private func pager(regionSize: CGSize, cardW: CGFloat, topInset: CGFloat) -> some View {
        TabView(selection: $index) {
            ForEach(Array(items.enumerated()), id: \.element.id) { i, item in
                ScrollView(.vertical, showsIndicators: false) {
                    ticketView(item, width: cardW, measure: false, withAudit: true)
                        .frame(maxWidth: .infinity)
                        .padding(.top, topInset)
                        .padding(.bottom, 48)
                }
                .rotation3DEffect(.degrees(i == index ? motion.normalizedPitch * cardMaxTiltDeg : 0),
                                  axis: (x: 1, y: 0, z: 0), perspective: 0.5)
                .rotation3DEffect(.degrees(i == index ? -motion.normalizedRoll * cardMaxTiltDeg : 0),
                                  axis: (x: 0, y: 1, z: 0), perspective: 0.5)
                .tag(i)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .frame(width: regionSize.width, height: regionSize.height)
    }

    /// One ticket at `width`, optionally measured into `cardHeight` (which only
    /// grows, so the top-anchor rest position is stable once the tallest card has
    /// been seen).
    @ViewBuilder
    private func ticketView(_ item: AgentBetItem, width: CGFloat, measure: Bool, withAudit: Bool = false) -> some View {
        Group {
            switch item {
            case .pick(let pick):
                ExpandedAgentPickTicket(
                    pick: pick,
                    accent: accent,
                    onAudit: withAudit ? { onAudit(pick) } : nil,
                    showsBranding: true
                )
            case .parlay(let parlay):
                ExpandedAgentParlayTicket(parlay: parlay, accent: accent, showsBranding: true)
            }
        }
        .frame(width: width)
        .background {
            if measure {
                GeometryReader { g in
                    Color.clear
                        .onAppear { cardHeight = max(cardHeight, g.size.height) }
                        .onChange(of: g.size.height) { _, h in cardHeight = max(cardHeight, h) }
                }
            }
        }
    }

    private var slotBar: some View {
        Capsule()
            .fill(LinearGradient(colors: [Color(hex: 0x2C313C), Color(hex: 0x0E1016)],
                                 startPoint: .top, endPoint: .bottom))
            .frame(height: 7)
            .overlay { Capsule().fill(.black.opacity(0.7)).frame(height: 2) }
            .overlay(alignment: .top) { Capsule().fill(.white.opacity(0.14)).frame(height: 1) }
            .shadow(color: .black.opacity(0.55), radius: 8, y: -2)
    }

    // MARK: Presentation lifecycle

    private func present() {
        guard !started else { return }
        started = true
        withAnimation(.easeOut(duration: 0.25)) { appeared = true }

        guard printIntro else {
            // Tap-to-focus: no feed, just bring the shown card to life.
            if !reduceMotion { motion.start(); motion.goLive() }
            return
        }

        if reduceMotion {
            printProgress = 1
            printed = true
            return
        }

        // Generation complete: the high-intensity pixel-wave washes in with the
        // overlay, holds a loud pulse, then recedes into the receipt-printer feed.
        waveOpacity = 1
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 850_000_000)
            withAnimation(.easeOut(duration: 0.5)) { waveOpacity = 0 }
            runFeed()
        }
    }

    /// Feed the first ticket out in discrete chunks so the paper stutters like a
    /// receipt printer, then hand off to the pager and go live under the hand.
    private func runFeed() {
        Task { @MainActor in
            let chunks = 12
            for i in 1...chunks {
                try? await Task.sleep(nanoseconds: 140_000_000)
                if Task.isCancelled { break }
                #if canImport(UIKit)
                UIImpactFeedbackGenerator(style: .light).impactOccurred(intensity: 0.6)
                #endif
                // Pre-warm CoreMotion mid-feed so its spin-up never hitches the
                // completion frame; leans stay flat until goLive() below.
                if i == 3 { motion.start() }
                withAnimation(.easeOut(duration: 0.13)) {
                    printProgress = CGFloat(i) / CGFloat(chunks)
                }
            }
            #if canImport(UIKit)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) { printed = true }
            motion.goLive()
        }
    }

    private func close() {
        motion.stop()
        withAnimation(.easeOut(duration: 0.2)) { appeared = false }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 200_000_000)
            onClose()
        }
    }

    /// Render JUST the current card (its own cardstock; transparent everywhere
    /// else — no darkened backdrop) to an image and open the share sheet, so
    /// the user shares the card alone. Works for picks AND parlay tickets.
    @MainActor private func shareCurrentCard() {
        guard items.indices.contains(index) else { return }
        let card = ticketView(items[index], width: 340, measure: false)
            .environment(\.colorScheme, .dark)
        let renderer = ImageRenderer(content: card)
        renderer.scale = 3
        renderer.isOpaque = false      // keep the area outside the card transparent
        if let image = renderer.uiImage {
            shareItem = ShareableTicketImage(image: image)
        }
    }
}

// MARK: - Share helpers

/// Identifiable wrapper so a freshly rendered card image can drive `.sheet(item:)`.
private struct ShareableTicketImage: Identifiable {
    let id = UUID()
    let image: UIImage
}

/// Minimal UIKit share-sheet bridge for exporting the rendered pick card image.
private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

// =====================================================================
// MARK: - PickTicketMotion (accelerometer parallax)
//
// Ported from orbital-focus TicketMotion. Reads device attitude (CoreMotion)
// and publishes a small, heavily smoothed, self-centering lean the focused
// ticket tilts into — "hold the boarding pass up to the light". Emits a
// normalized [-1, 1] lean; the view scales it to its max tilt.
// =====================================================================

@MainActor
@Observable
final class PickTicketMotion {
    /// Smoothed left/right lean, range [-1, 1] (multiply by the view's max tilt).
    var normalizedRoll: Double = 0
    /// Smoothed forward/back lean, range [-1, 1].
    var normalizedPitch: Double = 0

    // Apple recommends ONE CMMotionManager per app; kept static so repeated
    // focus presentations share the single subscription.
    @ObservationIgnored private static let manager = CMMotionManager()
    @ObservationIgnored private let queue: OperationQueue = {
        let q = OperationQueue()
        q.name = "bet.wagerproof.pick-ticket-tilt"
        q.qualityOfService = .userInteractive
        q.maxConcurrentOperationCount = 1
        return q
    }()
    /// Drifting neutral reference (raw radians). nil until the first sample.
    @ObservationIgnored private var baselineRoll: Double?
    @ObservationIgnored private var baselinePitch: Double?
    /// While false the sensor RUNS but the lean stays pinned flat — lets the
    /// printed ticket pre-warm CoreMotion during the feed yet emerge flat.
    @ObservationIgnored private var live = false

    /// Attitude delta (radians) that maps to a full ±1 lean. Bigger = subtler.
    private let maxRadians = 0.35
    /// Per-frame low-pass toward the latest reading — gentle, so no jitter.
    private let smoothing = 0.09
    /// How fast the neutral baseline chases the held attitude (< smoothing, so a
    /// flick reads fully before the card recenters).
    private let baselineDrift = 0.04

    /// Begin sampling. Leans stay pinned flat until `goLive()`.
    func start() {
        guard Self.manager.isDeviceMotionAvailable, !Self.manager.isDeviceMotionActive else { return }
        live = false
        baselineRoll = nil
        baselinePitch = nil
        Self.manager.deviceMotionUpdateInterval = 1.0 / 60.0
        Self.manager.startDeviceMotionUpdates(to: queue) { [weak self] motion, _ in
            guard let attitude = motion?.attitude else { return }
            let roll = attitude.roll, pitch = attitude.pitch
            Task { @MainActor in self?.apply(roll: roll, pitch: pitch) }
        }
    }

    /// Switch leans on once the ticket has settled (cheap — no sensor work).
    func goLive() { live = true }

    func stop() {
        live = false
        Self.manager.stopDeviceMotionUpdates()
        queue.cancelAllOperations()
        baselineRoll = nil
        baselinePitch = nil
        withAnimation(.easeOut(duration: 0.3)) {
            normalizedRoll = 0
            normalizedPitch = 0
        }
    }

    private func apply(roll: Double, pitch: Double) {
        // Prime the baseline on the first sample → starts perfectly flat wherever
        // the phone is held, no gravity offset to fight.
        guard let bRoll = baselineRoll, let bPitch = baselinePitch else {
            baselineRoll = roll
            baselinePitch = pitch
            normalizedRoll = 0
            normalizedPitch = 0
            return
        }
        let targetRoll = clamp(roll - bRoll) / maxRadians
        let targetPitch = clamp(pitch - bPitch) / maxRadians
        // Drift neutral toward the held attitude → a sustained tilt recenters.
        baselineRoll = bRoll + (roll - bRoll) * baselineDrift
        baselinePitch = bPitch + (pitch - bPitch) * baselineDrift
        guard live else {
            normalizedRoll = 0
            normalizedPitch = 0
            return
        }
        normalizedRoll += (targetRoll - normalizedRoll) * smoothing
        normalizedPitch += (targetPitch - normalizedPitch) * smoothing
    }

    private func clamp(_ v: Double) -> Double { min(max(v, -maxRadians), maxRadians) }
}
