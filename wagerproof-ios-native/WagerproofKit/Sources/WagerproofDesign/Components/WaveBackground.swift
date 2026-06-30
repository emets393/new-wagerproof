import SwiftUI

/// Three overlapping "sheets" the same color as the background, stacked at
/// different heights. Each sheet fills upward to the top of the view and has a
/// wavy bottom edge that casts a soft **drop shadow** onto the layer behind it —
/// so the only thing you actually see is three gentle wavy shadow contours,
/// giving the deep background a layered, dimensional feel. Each wave continuously
/// breathes both its **amplitude** and its **wavelength** (frequency) on its own
/// phase, so the trio never looks synchronized or static.
///
/// Meant to sit *behind* a foreground layer (e.g. `PixelGlyphField`). Pure
/// decoration — no hit testing, freezes under Reduce Motion.
public struct WaveBackground: View {
    /// Sheet fill — should match the background so only the shadows read.
    private let sheetColor: Color
    private let shadowColor: Color
    /// Drop-shadow opacity. The whole effect lives here — keep it gentle.
    private let shadowStrength: Double
    private let shadowRadius: CGFloat
    private let shadowOffset: CGFloat

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        sheetColor: Color = Color(hex: 0x111111),
        shadowColor: Color = .black,
        shadowStrength: Double = 0.4,
        shadowRadius: CGFloat = 16,
        shadowOffset: CGFloat = 9
    ) {
        self.sheetColor = sheetColor
        self.shadowColor = shadowColor
        self.shadowStrength = shadowStrength
        self.shadowRadius = shadowRadius
        self.shadowOffset = shadowOffset
    }

    /// One sheet's character. `amp*`/`wave*` pairs give each its own amplitude-
    /// and frequency-breathing so they drift independently.
    private struct Sheet {
        let baseline: CGFloat   // wavy edge position, 0...1 of height
        let ampBase: CGFloat    // resting amplitude (pt)
        let ampVary: CGFloat    // how much amplitude breathes
        let ampSpeed: Double
        let waveBase: CGFloat   // resting count of waves across the width
        let waveVary: CGFloat   // how much wavelength breathes
        let waveSpeed: Double
        let scrollSpeed: Double // horizontal drift
        let phase: Double       // static offset so the three differ
    }

    // All three share the same speeds, frequency, breathing, and drift, so they
    // move in UNISON. Only the baseline (height), amplitude, and a small phase
    // offset differ — so they read as nested/concentric waves that are related
    // but not identical, connected but individual. Drawn back-to-front (lowest
    // edge first) so a higher sheet never paints over a lower one's shadow.
    private let sheets: [Sheet] = [
        Sheet(baseline: 0.72, ampBase: 17, ampVary: 4, ampSpeed: 0.11,
              waveBase: 1.4, waveVary: 0.30, waveSpeed: 0.05, scrollSpeed: 0.08, phase: 0.8),
        Sheet(baseline: 0.52, ampBase: 13, ampVary: 4, ampSpeed: 0.11,
              waveBase: 1.4, waveVary: 0.30, waveSpeed: 0.05, scrollSpeed: 0.08, phase: 0.4),
        Sheet(baseline: 0.32, ampBase: 9, ampVary: 4, ampSpeed: 0.11,
              waveBase: 1.4, waveVary: 0.30, waveSpeed: 0.05, scrollSpeed: 0.08, phase: 0.0)
    ]

    public var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            Canvas(opaque: false, rendersAsynchronously: false) { context, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                for sheet in sheets {
                    draw(sheet, into: context, size: size, time: t)
                }
            }
        }
        .allowsHitTesting(false)
    }

    private func draw(_ sheet: Sheet, into context: GraphicsContext, size: CGSize, time t: Double) {
        guard size.width > 1, size.height > 0 else { return }

        // Amplitude and wavelength each breathe on their own slow sine.
        let amp = sheet.ampBase + sheet.ampVary * CGFloat(sin(t * sheet.ampSpeed + sheet.phase))
        let waves = sheet.waveBase + sheet.waveVary * CGFloat(sin(t * sheet.waveSpeed + sheet.phase * 1.3))
        let k = Double(waves) * 2 * .pi / Double(size.width)   // radians per point
        let scroll = t * sheet.scrollSpeed * 2 * .pi
        let baseY = size.height * sheet.baseline

        func edgeY(_ x: CGFloat) -> CGFloat {
            baseY + amp * CGFloat(sin(Double(x) * k + scroll + sheet.phase))
        }

        // Sheet fills from the top of the view down to its wavy bottom edge.
        var path = Path()
        path.move(to: CGPoint(x: 0, y: 0))
        path.addLine(to: CGPoint(x: size.width, y: 0))
        path.addLine(to: CGPoint(x: size.width, y: edgeY(size.width)))
        var x = size.width
        let step: CGFloat = 6
        while x >= 0 {
            path.addLine(to: CGPoint(x: x, y: edgeY(x)))
            x -= step
        }
        path.addLine(to: CGPoint(x: 0, y: 0))
        path.closeSubpath()

        // Drop shadow falls just below the wavy edge (the only exposed part of
        // the silhouette), painting the soft wave contour. Top/side edges of the
        // sheet sit off-screen, so their shadows never show.
        var ctx = context
        ctx.addFilter(.shadow(
            color: shadowColor.opacity(shadowStrength),
            radius: shadowRadius,
            x: 0,
            y: shadowOffset
        ))
        ctx.fill(path, with: .color(sheetColor))
    }
}

#Preview("Wave sheets") {
    ZStack {
        Color(hex: 0x111111).ignoresSafeArea()
        WaveBackground(shadowStrength: 0.7)   // boosted for the preview
            .ignoresSafeArea()
    }
    .preferredColorScheme(.dark)
}
