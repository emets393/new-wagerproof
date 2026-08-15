import SwiftUI
import WagerproofModels

/// The backtest visuals inside a signal's detail sheet.
///
/// A signal's whole claim is "this hits often enough to beat the vig", so the
/// chart is a hit rate measured against the break-even it has to clear, not a
/// bare percentage. `SignalPerformanceStatsSection` used to print
/// `12-8 • 60.0% • +3.2u` as one bullet-joined line, which is the exact thing
/// `WIDGET_DESIGN.md` rule 5 forbids — every value now gets its own column, and
/// the rate gets a meter with the threshold marked.

/// One rate placed on a losing→winning track, with the break-even between them.
///
/// The track is a ZONE chart, not a fill bar: red left of break-even, green
/// right of it, and a marker where this signal lands. A fill growing from the
/// window's left edge implied 35% was "zero" and left a losing signal as a
/// four-point sliver, which read as a rendering fault rather than a result.
/// Same grammar as `SpreadCoverBar` — the bar you must clear, where you are,
/// and the gap between.
///
/// The window is 35–70% rather than 0–100% because every real signal lives in a
/// narrow band around the vig; it widens when a value falls outside, so nothing
/// is ever clamped onto the edge and misreported.
struct SignalHitRateMeter: View {
    let label: String
    let caption: String
    /// 0–1.
    let rate: Double
    /// Dims the marker when the sample is too small to mean much.
    var lowConfidence: Bool = false

    private var window: (lower: Double, upper: Double) { SignalHitRate.window(for: rate) }

    private func fraction(_ value: Double) -> Double {
        SignalHitRate.position(value, in: window)
    }

    private var beatsBreakEven: Bool { rate >= SignalHitRate.breakEvenRate }
    private var tone: Color { beatsBreakEven ? Color(hex: 0x22C55E) : Color(hex: 0xEF4444) }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(label.uppercased())
                    .font(.system(size: 10, weight: .black))
                    .tracking(0.6)
                    .foregroundStyle(Color.appTextSecondary)
                Spacer(minLength: 4)
                Text(String(format: "%.1f%%", rate * 100))
                    .font(.system(size: 20, weight: .black, design: .monospaced))
                    .foregroundStyle(tone)
                Text(beatsBreakEven ? "beats the vig" : "loses to the vig")
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(tone.opacity(0.85))
            }

            GeometryReader { geo in
                let width = geo.size.width
                let breakEvenX = width * fraction(SignalHitRate.breakEvenRate)
                let markerX = width * fraction(rate)

                ZStack(alignment: .leading) {
                    // Losing zone, then winning zone. Flat fills: every rate
                    // inside a zone means the same thing.
                    Capsule()
                        .fill(Color(hex: 0xEF4444).opacity(0.22))
                        .frame(height: 14)
                    Capsule()
                        .fill(Color(hex: 0x22C55E).opacity(0.30))
                        .frame(width: max(width - breakEvenX, 0), height: 14)
                        .offset(x: breakEvenX)

                    Rectangle()
                        .fill(Color.appTextPrimary.opacity(0.85))
                        .frame(width: 2, height: 22)
                        .offset(x: breakEvenX - 1)

                    Capsule()
                        .fill(tone)
                        .frame(width: 5, height: 26)
                        .shadow(color: tone.opacity(lowConfidence ? 0 : 0.55), radius: 5)
                        .opacity(lowConfidence ? 0.65 : 1)
                        .offset(x: min(max(markerX - 2.5, 0), width - 5))
                }
                .frame(height: 26)
            }
            .frame(height: 26)

            HStack(spacing: 0) {
                Text("Break-even 52.4%")
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(Color.appTextMuted)
                Spacer(minLength: 8)
                Text(caption)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Color.appTextMuted)
                    .multilineTextAlignment(.trailing)
            }
        }
    }
}

/// Wins / losses / pushes as one divided bar — two numbers that should be
/// compared become one bar, per rule 5.
struct SignalRecordBar: View {
    let wins: Int
    let losses: Int
    let pushes: Int

    private var total: Int { max(wins + losses + pushes, 1) }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 0) {
                segment(count: wins, color: Color(hex: 0x22C55E))
                segment(count: pushes, color: Color.appTextSecondary.opacity(0.55))
                segment(count: losses, color: Color(hex: 0xEF4444))
            }
            .frame(height: 12)
            .clipShape(Capsule())

            HStack(spacing: 12) {
                legend(color: Color(hex: 0x22C55E), label: "\(wins)W")
                if pushes > 0 {
                    legend(color: Color.appTextSecondary.opacity(0.55), label: "\(pushes)P")
                }
                legend(color: Color(hex: 0xEF4444), label: "\(losses)L")
                Spacer(minLength: 0)
            }
        }
    }

    @ViewBuilder
    private func segment(count: Int, color: Color) -> some View {
        if count > 0 {
            Rectangle()
                .fill(color)
                .frame(maxWidth: .infinity)
                .layoutPriority(Double(count))
        }
    }

    private func legend(color: Color, label: String) -> some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(label)
                .font(.system(size: 10, weight: .black, design: .monospaced))
                .foregroundStyle(Color.appTextSecondary)
        }
    }
}

/// Chart block: backtest meter, live-season meter, and the season record bar.
struct SignalBacktestChart: View {
    let backtestRaw: String?
    let performance: SignalPerformance?

    private var backtestRate: Double? { SignalHitRate.fraction(backtestRaw) }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            if let backtestRate {
                SignalHitRateMeter(
                    label: "Historical backtest",
                    caption: "Multi-season, not this year",
                    rate: backtestRate
                )
            } else if let backtestRaw, !backtestRaw.isEmpty {
                // Unparseable prose — show it rather than dropping the only
                // backtest figure the signal has.
                VStack(alignment: .leading, spacing: 4) {
                    Text("HISTORICAL BACKTEST")
                        .font(.system(size: 10, weight: .black))
                        .tracking(0.6)
                        .foregroundStyle(Color.appTextSecondary)
                    Text(backtestRaw)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                }
            }

            if let performance, performance.n > 0 {
                SignalHitRateMeter(
                    label: "This season",
                    caption: performance.n < 10
                        ? "Only \(performance.n) graded — too few to trust"
                        : "\(performance.n) graded picks",
                    rate: performance.hitRate,
                    lowConfidence: performance.n < 10
                )
                SignalRecordBar(
                    wins: performance.wins,
                    losses: performance.losses,
                    pushes: performance.pushes
                )
            }
            // Nothing when the season has no graded picks. Offseason and early
            // weeks are the common case, and an empty-state line there is noise
            // under a backtest chart that already answered the question.
        }
    }
}
