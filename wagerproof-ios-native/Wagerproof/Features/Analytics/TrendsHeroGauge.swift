import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Hollow hit-rate ring that animates when filters change — mirrors web `HeroGauge`.
struct TrendsHeroGauge: View {
    let hitPct: Double
    let baseline: Double
    let outcomeWord: String
    var size: CGFloat = 118

    @State private var displayed: Double = 0

    private var ramp: [Color] {
        let good = hitPct >= max(baseline, 50)
        let near = !good && hitPct >= baseline - 3
        if good { return [Color(hex: 0x34D399), Color(hex: 0x059669)] }
        if near { return [Color(hex: 0xFBBF24), Color(hex: 0xD97706)] }
        return [Color(hex: 0xF87171), Color(hex: 0xDC2626)]
    }

    var body: some View {
        let stroke: CGFloat = 10
        let r = (size / 2) - stroke
        let tickFrac = baseline / 100
        // SVG-style: 0% at 12 o'clock, clockwise.
        let tickRad = tickFrac * 2 * Double.pi - Double.pi / 2
        let inner = r - stroke / 2 - 2
        let outer = r + stroke / 2 + 2
        let cx = size / 2
        let cy = size / 2

        ZStack {
            Circle()
                .stroke(Color.appBorder.opacity(0.35), lineWidth: stroke)
                .frame(width: r * 2, height: r * 2)

            Circle()
                .trim(from: 0, to: min(max(displayed, 0), 100) / 100)
                .stroke(
                    AngularGradient(colors: ramp, center: .center),
                    style: StrokeStyle(lineWidth: stroke, lineCap: .round)
                )
                .frame(width: r * 2, height: r * 2)
                .rotationEffect(.degrees(-90))
                .animation(.easeOut(duration: 0.55), value: displayed)

            Path { path in
                path.move(to: CGPoint(
                    x: cx + inner * CGFloat(Darwin.cos(tickRad)),
                    y: cy + inner * CGFloat(Darwin.sin(tickRad))
                ))
                path.addLine(to: CGPoint(
                    x: cx + outer * CGFloat(Darwin.cos(tickRad)),
                    y: cy + outer * CGFloat(Darwin.sin(tickRad))
                ))
            }
            .stroke(Color.appTextPrimary.opacity(0.7), style: StrokeStyle(lineWidth: 2, lineCap: .round))

            VStack(spacing: 3) {
                Text(formatPct(displayed))
                    .font(.system(size: 24, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Color.appTextPrimary)
                    .contentTransition(.numericText())
                Text("\(outcomeWord.uppercased()) RATE")
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(0.6)
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
        .frame(width: size, height: size)
        .onAppear { displayed = hitPct }
        .onChange(of: hitPct) { _, newValue in
            withAnimation(.easeOut(duration: 0.55)) {
                displayed = newValue
            }
        }
    }

    private func formatPct(_ v: Double) -> String {
        if v.rounded() == v { return "\(Int(v))%" }
        return String(format: "%.1f%%", v)
    }
}
