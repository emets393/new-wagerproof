import SwiftUI
import WagerproofDesign

/// The player-analysis "number line": a grey rail with an amber (emphasized)
/// marker and an optional slate marker, a colored connector between them, a
/// centered delta pill, and edge captions. Port of the layout the web page
/// reuses for the projection comparison (`ModelStrip`), the touchdown
/// probability comparison, and the scheme production rows (`ComparisonBlock`).
struct PropNumberLineMarker {
    let label: String
    let value: String
    /// Small suffix after the value ("yds").
    var unit: String? = nil
    /// Line under the value ("-112" / "EPA/db").
    var caption: String? = nil
}

struct PropNumberLine: View {
    enum Tone {
        case up, down, neutral

        var color: Color {
            switch self {
            case .up: Color.appWin
            case .down: Color.appLoss
            case .neutral: Color.appTextMuted
            }
        }
    }

    /// The emphasized (amber) marker — WagerProof's number.
    let primary: PropNumberLineMarker
    /// 0…1 across the rail.
    let primaryFraction: Double
    let secondary: PropNumberLineMarker?
    let secondaryFraction: Double?
    let tone: Tone
    let deltaText: String?
    let leadingCaption: String
    let trailingCaption: String
    /// 26 for the projection headline number, 15 for comparison rows.
    var primaryValueSize: CGFloat = 26

    private static let amber = Color(hex: 0xF59E0B)
    private static let slate = Color(hex: 0x94A3B8)
    private let railY: CGFloat = 72
    private let height: CGFloat = 128

    /// Web scale math: pad the [min, max] domain, then place values on the
    /// middle 88% of the rail. `floorAtZero` clamps the padded min (counts
    /// and probabilities can't go negative; EPA can).
    static func fractions(
        primary: Double,
        secondary: Double?,
        padding: Double,
        floorAtZero: Bool = true
    ) -> (primary: Double, secondary: Double?) {
        let values = [primary, secondary].compactMap { $0 }
        guard let minV = values.min(), let maxV = values.max() else { return (0.5, nil) }
        var scaleMin = minV - padding
        if floorAtZero { scaleMin = max(0, scaleMin) }
        let scaleMax = maxV + padding
        let span = max(scaleMax - scaleMin, 0.0001)
        func fraction(_ v: Double) -> Double { 0.06 + ((v - scaleMin) / span) * 0.88 }
        return (fraction(primary), secondary.map(fraction))
    }

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            let primaryX = x(primaryFraction, width: width)
            let secondaryX = secondaryFraction.map { x($0, width: width) }

            ZStack(alignment: .topLeading) {
                // Rail.
                Capsule()
                    .fill(Color.appTextMuted.opacity(0.22))
                    .frame(width: width * 0.9, height: 4)
                    .position(x: width / 2, y: railY)

                // Connector between the two markers.
                if let secondaryX {
                    let left = min(primaryX, secondaryX)
                    let connectorWidth = abs(primaryX - secondaryX)
                    Rectangle()
                        .fill(tone.color.opacity(tone == .neutral ? 0.4 : 0.55))
                        .frame(width: max(connectorWidth, 0), height: 4)
                        .position(x: left + connectorWidth / 2, y: railY)
                }

                if let secondary, let secondaryX {
                    markerColumn(secondary, emphasized: false, valueSize: 15)
                        .frame(width: 110)
                        .position(x: clampLabelX(secondaryX, width: width), y: 0)
                        .offset(y: labelColumnOffset)
                    markerDot(color: Self.slate, glow: false)
                        .position(x: secondaryX, y: railY)
                }

                markerColumn(primary, emphasized: true, valueSize: primaryValueSize)
                    .frame(width: 120)
                    .position(x: clampLabelX(primaryX, width: width), y: 0)
                    .offset(y: labelColumnOffset)
                markerDot(color: Self.amber, glow: true)
                    .position(x: primaryX, y: railY)

                if let deltaText, let secondaryX {
                    let mid = (primaryX + secondaryX) / 2
                    Text(deltaText)
                        .font(.system(size: 10, weight: .black, design: .monospaced))
                        .foregroundStyle(tone == .neutral ? Color.appTextSecondary : tone.color)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(tone.color.opacity(0.14), in: Capsule())
                        .position(x: clampLabelX(mid, width: width), y: railY + 20)
                }

                // Edge captions.
                Text(leadingCaption)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Color.appTextMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, width * 0.05)
                    .offset(y: height - 12)
                Text(trailingCaption)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Color.appTextMuted)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(.trailing, width * 0.05)
                    .offset(y: height - 12)
            }
        }
        .frame(height: height)
    }

    private func x(_ fraction: Double, width: CGFloat) -> CGFloat {
        width * CGFloat(min(1, max(0, fraction)))
    }

    /// Keep the label column's center far enough from the edges that its
    /// text stays on-screen (the dot itself may sit closer to the edge).
    private func clampLabelX(_ x: CGFloat, width: CGFloat) -> CGFloat {
        min(max(x, 52), width - 52)
    }

    /// `.position(y: 0)` centers the column at the top edge; push it down by
    /// half its rough height so the label row starts at the top of the view.
    private var labelColumnOffset: CGFloat { 26 }

    private func markerColumn(_ marker: PropNumberLineMarker, emphasized: Bool, valueSize: CGFloat) -> some View {
        VStack(spacing: 2) {
            Text(marker.label.uppercased())
                .font(.system(size: 9, weight: .black))
                .tracking(0.5)
                .foregroundStyle(emphasized ? Self.amber : Color.appTextMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(marker.value)
                    .font(.system(size: valueSize, weight: .black, design: .monospaced))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                if let unit = marker.unit, !unit.isEmpty {
                    Text(unit)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                }
            }
            if let caption = marker.caption, !caption.isEmpty {
                Text(caption)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.appTextMuted)
            }
            Rectangle()
                .fill((emphasized ? Self.amber : Self.slate).opacity(0.6))
                .frame(width: 1, height: 14)
        }
    }

    private func markerDot(color: Color, glow: Bool) -> some View {
        Circle()
            .fill(color)
            .frame(width: 12, height: 12)
            .overlay(Circle().stroke(Color.appSurface, lineWidth: 2))
            .shadow(color: glow ? color.opacity(0.7) : .clear, radius: glow ? 5 : 0)
    }
}

#Preview("Projection point") {
    let fractions = PropNumberLine.fractions(primary: 271.4, secondary: 250.5, padding: 4.1)
    return PropNumberLine(
        primary: PropNumberLineMarker(label: "WagerProof", value: "271.4", unit: "yds"),
        primaryFraction: fractions.primary,
        secondary: PropNumberLineMarker(label: "Vegas line", value: "250.5", caption: "-112"),
        secondaryFraction: fractions.secondary,
        tone: .up,
        deltaText: "+20.9 yds",
        leadingCaption: "Lower total",
        trailingCaption: "Higher total"
    )
    .padding()
}

#Preview("Production row") {
    let fractions = PropNumberLine.fractions(primary: 9.9, secondary: 9.4, padding: 0.25, floorAtZero: false)
    return PropNumberLine(
        primary: PropNumberLineMarker(label: "Vs CHI's look", value: "9.9", caption: "ypt"),
        primaryFraction: fractions.primary,
        secondary: PropNumberLineMarker(label: "Career avg", value: "9.4", caption: "ypt"),
        secondaryFraction: fractions.secondary,
        tone: .up,
        deltaText: "+0.5 ypt",
        leadingCaption: "Lower production",
        trailingCaption: "Higher production",
        primaryValueSize: 15
    )
    .padding()
}
