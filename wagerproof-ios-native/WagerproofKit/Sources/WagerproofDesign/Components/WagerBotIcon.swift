import SwiftUI

/// Robot glyph used as the WagerBot AI chat icon across the app — toolbars,
/// welcome states, message-bubble avatars, insight pills. Drawn with SwiftUI
/// shapes (no asset bundle) so it scales crisply at any size and respects
/// the surrounding `.foregroundStyle(...)` like an SF Symbol would.
///
/// SF Symbols doesn't ship a "robot" glyph; this fills the gap so every AI
/// surface gets a single consistent icon. Single source of truth — change
/// the geometry here and every entry point updates.
public struct WagerBotIcon: View {
    public var size: CGFloat

    public init(size: CGFloat = 24) {
        self.size = size
    }

    public var body: some View {
        Canvas { context, canvasSize in
            let s = min(canvasSize.width, canvasSize.height)
            let stroke = max(1.0, s * 0.075)
            let foreground = GraphicsContext.Shading.color(.primary)

            // Antenna stem (vertical line above the head).
            var antenna = Path()
            antenna.move(to: CGPoint(x: s * 0.5, y: s * 0.10))
            antenna.addLine(to: CGPoint(x: s * 0.5, y: s * 0.22))
            context.stroke(antenna, with: foreground, style: StrokeStyle(lineWidth: stroke, lineCap: .round))

            // Antenna ball (circle at the antenna tip).
            let ballR = s * 0.07
            let ball = Path(ellipseIn: CGRect(
                x: s * 0.5 - ballR,
                y: s * 0.04,
                width: ballR * 2,
                height: ballR * 2
            ))
            context.fill(ball, with: foreground)

            // Head — rounded rectangle the eyes / sensor live in.
            let headRect = CGRect(
                x: s * 0.13,
                y: s * 0.22,
                width: s * 0.74,
                height: s * 0.58
            )
            let head = Path(roundedRect: headRect, cornerRadius: s * 0.18)
            context.stroke(head, with: foreground, style: StrokeStyle(lineWidth: stroke, lineJoin: .round))

            // Eyes — two solid circles. Sit slightly above center so the
            // glyph reads as "alert" at every size.
            let eyeR = s * 0.06
            let eyeY = s * 0.40
            let eyeOffset = s * 0.13
            let leftEye = Path(ellipseIn: CGRect(
                x: s * 0.5 - eyeOffset - eyeR,
                y: eyeY,
                width: eyeR * 2,
                height: eyeR * 2
            ))
            let rightEye = Path(ellipseIn: CGRect(
                x: s * 0.5 + eyeOffset - eyeR,
                y: eyeY,
                width: eyeR * 2,
                height: eyeR * 2
            ))
            context.fill(leftEye, with: foreground)
            context.fill(rightEye, with: foreground)

            // Mouth — short horizontal sensor bar below the eyes.
            var mouth = Path()
            mouth.move(to: CGPoint(x: s * 0.36, y: s * 0.62))
            mouth.addLine(to: CGPoint(x: s * 0.64, y: s * 0.62))
            context.stroke(mouth, with: foreground, style: StrokeStyle(lineWidth: stroke, lineCap: .round))

            // Side antennae — small notches on either side of the head so
            // the silhouette reads as "robot" even at toolbar size.
            var leftEar = Path()
            leftEar.move(to: CGPoint(x: s * 0.08, y: s * 0.42))
            leftEar.addLine(to: CGPoint(x: s * 0.13, y: s * 0.42))
            var rightEar = Path()
            rightEar.move(to: CGPoint(x: s * 0.87, y: s * 0.42))
            rightEar.addLine(to: CGPoint(x: s * 0.92, y: s * 0.42))
            context.stroke(leftEar, with: foreground, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
            context.stroke(rightEar, with: foreground, style: StrokeStyle(lineWidth: stroke, lineCap: .round))

            var leftEar2 = Path()
            leftEar2.move(to: CGPoint(x: s * 0.08, y: s * 0.58))
            leftEar2.addLine(to: CGPoint(x: s * 0.13, y: s * 0.58))
            var rightEar2 = Path()
            rightEar2.move(to: CGPoint(x: s * 0.87, y: s * 0.58))
            rightEar2.addLine(to: CGPoint(x: s * 0.92, y: s * 0.58))
            context.stroke(leftEar2, with: foreground, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
            context.stroke(rightEar2, with: foreground, style: StrokeStyle(lineWidth: stroke, lineCap: .round))

            // Shoulders — short horizontal bar under the head that hints at
            // a torso without ballooning the icon's footprint.
            var shoulders = Path()
            shoulders.move(to: CGPoint(x: s * 0.30, y: s * 0.88))
            shoulders.addLine(to: CGPoint(x: s * 0.70, y: s * 0.88))
            context.stroke(shoulders, with: foreground, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
        }
        .frame(width: size, height: size)
    }
}

#Preview {
    VStack(spacing: 24) {
        WagerBotIcon(size: 17).foregroundStyle(.primary)
        WagerBotIcon(size: 28).foregroundStyle(Color(hex: 0x00E676))
        WagerBotIcon(size: 56).foregroundStyle(.white)
        WagerBotIcon(size: 96).foregroundStyle(.purple)
    }
    .padding()
    .background(Color.black)
}
