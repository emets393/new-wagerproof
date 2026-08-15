import SwiftUI
import WagerproofDesign

/// The "Pick Signals" row that sits under a market card's recommendation.
///
/// One pill per signal, tappable to open the signal's backtest sheet. Shared by
/// the CFB and NFL game sheets — both sports read the same `signal_defs` shape,
/// so the pill takes plain values rather than a per-sport model.
///
/// ## Why one header instead of two groups
/// The old layout printed "Supports this pick" and "Contradicts this pick" as
/// separate headed groups. That buried the only thing a reader has to do here —
/// tap one — under a taxonomy, and it read as two unrelated lists. Now there is
/// a single labelled affordance, and stance is carried by the pill itself:
/// amber triangle = argues against the pick, tier-coloured circle = backs it.
/// The legend under the header states that in words so the colour isn't load
/// bearing on its own.

/// One signal as it appears on a card.
struct PickSignalPillModel: Identifiable, Equatable {
    let id: String
    let title: String
    /// Argues AGAINST the card's pick. Drives the amber tint and the triangle.
    let contradicts: Bool
    /// Conviction-tier colour, used when the signal supports the pick.
    let tint: Color

    static func == (a: PickSignalPillModel, b: PickSignalPillModel) -> Bool {
        a.id == b.id && a.title == b.title && a.contradicts == b.contradicts
    }
}

/// Wrapping pill layout — `HStack` truncates rather than wrapping, and a
/// `LazyVGrid` forces a fixed column width that leaves long signal names
/// scaled down next to short ones.
struct SignalFlowLayout: Layout {
    var spacing: CGFloat = 7

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var rowHeight: CGFloat = 0
        var total: CGFloat = 0

        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > maxWidth {
                total += rowHeight + spacing
                x = 0
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        total += rowHeight
        return CGSize(width: maxWidth.isFinite ? maxWidth : x, height: total)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x > bounds.minX && x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

/// A single Liquid Glass signal pill.
///
/// `.interactive()` glass gives the system's own touch refraction on iOS 26; the
/// scale + shadow on press is what carries that feedback on the fallback path,
/// so the pill still feels live on iOS < 26.
struct PickSignalPill: View {
    let model: PickSignalPillModel
    let action: () -> Void

    private var tint: Color { model.contradicts ? Color.appAccentAmber : model.tint }
    private var icon: String {
        model.contradicts ? "exclamationmark.triangle.fill" : "exclamationmark.circle.fill"
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(tint)
                Text(model.title)
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 9)
            // Colour rides the ICON, not the fill. A 0.28 tint plus a hard
            // border rendered as a solid mustard button — the glass was doing
            // nothing you could see. Supporting pills take plain glass so the
            // amber ones are the only coloured thing in the row.
            .modifier(SignalPillSurface(tint: model.contradicts ? tint : nil))
            .contentShape(Capsule())
        }
        .buttonStyle(SignalPillButtonStyle(tint: tint))
        .accessibilityLabel(
            "\(model.title). \(model.contradicts ? "Contradicts this pick" : "Supports this pick"). Tap for backtest."
        )
    }
}

/// The pill's glass surface. `tint` is nil for supporting signals, which take
/// plain glass — only the contradicting ones carry amber, so the warning reads
/// at a glance instead of competing with a row of coloured chips.
///
/// A `ViewModifier` rather than an inline `@ViewBuilder` branch because
/// `liquidGlassBackground` is generic over the shape and the two arities return
/// different opaque types, which won't unify inside one `if`.
private struct SignalPillSurface: ViewModifier {
    let tint: Color?

    func body(content: Content) -> some View {
        if let tint {
            content
                .liquidGlassBackground(in: Capsule(), tint: tint.opacity(0.16), interactive: true)
                .overlay(Capsule().strokeBorder(tint.opacity(0.45), lineWidth: 1))
        } else {
            content
                .liquidGlassBackground(in: Capsule(), interactive: true)
                .overlay(Capsule().strokeBorder(Color.appBorder.opacity(0.35), lineWidth: 0.8))
        }
    }
}

/// Press feedback: a spring squeeze plus a tint glow, so the pill answers the
/// finger on every OS version.
private struct SignalPillButtonStyle: ButtonStyle {
    let tint: Color

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.94 : 1)
            .shadow(
                color: tint.opacity(configuration.isPressed ? 0.45 : 0),
                radius: configuration.isPressed ? 9 : 0
            )
            .animation(.spring(response: 0.26, dampingFraction: 0.62), value: configuration.isPressed)
    }
}

/// Header + wrapped pills. Renders nothing when there are no signals.
struct PickSignalsSection: View {
    let signals: [PickSignalPillModel]
    let onSelect: (PickSignalPillModel) -> Void

    private var hasContradicting: Bool { signals.contains(where: \.contradicts) }

    var body: some View {
        if !signals.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Text("PICK SIGNALS")
                        .font(.system(size: 10, weight: .black))
                        .tracking(0.6)
                        .foregroundStyle(Color.appTextSecondary)
                    Text("(tap for details)")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(Color.appTextMuted)
                }

                // Stance is otherwise colour-only, which fails for anyone who
                // can't separate amber from the tier tints.
                if hasContradicting {
                    HStack(spacing: 5) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 8, weight: .black))
                            .foregroundStyle(Color.appAccentAmber)
                        Text("Amber signals argue against this pick")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Color.appTextMuted)
                    }
                }

                LiquidGlassMergeContainer(spacing: 12) {
                    SignalFlowLayout(spacing: 7) {
                        ForEach(signals) { signal in
                            PickSignalPill(model: signal) { onSelect(signal) }
                        }
                    }
                }
            }
        }
    }
}
