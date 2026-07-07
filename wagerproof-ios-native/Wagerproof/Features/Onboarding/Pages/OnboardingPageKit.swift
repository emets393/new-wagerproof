import SwiftUI
import WagerproofDesign

// Shared primitives for the onboarding carousel pages: entrance choreography
// gated on page activation, and the chip/card/feature-row building blocks
// every survey page composes. Pages own NO chrome — the carousel container's
// single shell provides progress/back/CTA.

// MARK: - Entrance choreography

extension View {
    /// Staggered fade+lift that fires when the page becomes the ACTIVE
    /// carousel page. With the button-driven pager that's mount time (the
    /// slide-in), but gating on `\.onboardingPageIsActive` keeps this
    /// correct if a pre-mounting pager ever returns.
    func pageEntrance(index: Int) -> some View {
        modifier(OnboardingPageEntrance(index: index))
    }
}

private struct OnboardingPageEntrance: ViewModifier {
    @Environment(\.onboardingPageIsActive) private var isActive
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let index: Int

    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 14)
            .onChange(of: isActive, initial: true) { _, active in
                guard active, !shown else { return }
                guard !reduceMotion else {
                    var t = Transaction()
                    t.disablesAnimations = true
                    withTransaction(t) { shown = true }
                    return
                }
                withAnimation(
                    .spring(response: 0.45, dampingFraction: 0.85)
                        .delay(Double(min(index, 8)) * 0.06)
                ) {
                    shown = true
                }
            }
    }
}

// MARK: - Stamp entrance

extension View {
    /// Rubber-stamp entrance: the element slams in from a larger, blurred,
    /// transparent state down to rest with a springy thud + haptic, staggered
    /// per index. Like `pageEntrance` it fires when the page becomes ACTIVE.
    func stampEntrance(index: Int) -> some View {
        modifier(OnboardingStampEntrance(index: index))
    }
}

private struct OnboardingStampEntrance: ViewModifier {
    @Environment(\.onboardingPageIsActive) private var isActive
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let index: Int

    @State private var stamped = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(stamped ? 1 : 1.35)
            .opacity(stamped ? 1 : 0)
            .blur(radius: stamped ? 0 : 6)
            // Each row thuds as it lands — staggered, so the stamps read as a
            // rhythmic cadence rather than one buzz.
            .sensoryFeedback(.impact(weight: .medium), trigger: stamped)
            .onChange(of: isActive, initial: true) { _, active in
                guard active, !stamped else { return }
                guard !reduceMotion else {
                    var t = Transaction()
                    t.disablesAnimations = true
                    withTransaction(t) { stamped = true }
                    return
                }
                // Under-damped spring gives the slight overshoot that sells the
                // "stamp pressing down" feel.
                withAnimation(
                    .spring(response: 0.34, dampingFraction: 0.62)
                        .delay(Double(min(index, 8)) * 0.12)
                ) {
                    stamped = true
                }
            }
    }
}

// MARK: - Page scaffold

/// Standard page body: headline + optional subtitle above scrollable content.
/// Keeps typography identical across all 13 pages.
struct OnboardingPageScaffold<Content: View>: View {
    let title: String
    var subtitle: String? = nil
    @ViewBuilder let content: () -> Content

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Text(title)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .padding(.top, 16)
                    .padding(.horizontal, 24)
                    .pageEntrance(index: 0)

                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 16))
                        .foregroundStyle(Color.white.opacity(0.7))
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                        .padding(.horizontal, 28)
                        .pageEntrance(index: 1)
                }

                content()
            }
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
    }
}

// MARK: - Press feedback

/// Shared pressed-state for every tappable onboarding element: a quick
/// scale-down + slight dim with a springy release. Gives chips/cards the
/// reactive, physical feel of native iOS controls (the Liquid Glass CTA
/// already gets this from `interactive: true`).
struct OnboardingPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.965 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.spring(response: 0.28, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

// MARK: - Selectable chip (icon + label pill)

struct OnboardingChip: View {
    let label: String
    var icon: String? = nil
    let isSelected: Bool
    var accent: Color = .appPrimary
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(isSelected ? accent : Color.white.opacity(0.8))
                }
                Text(label)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    // One line always — a wrapping label ("College Football")
                    // would make its chip taller than its row siblings.
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 48)
            .padding(.horizontal, 16)
            // Liquid Glass pill; the accent stroke marks selection only.
            .liquidGlassBackground(
                in: Capsule(),
                tint: isSelected ? accent.opacity(0.25) : Color.white.opacity(0.06)
            )
            .overlay(
                Capsule()
                    .strokeBorder(isSelected ? accent : Color.clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(OnboardingPressStyle())
        // The pixel background reacts at this chip whenever its selection
        // flips (select AND deselect — any tap should feel alive).
        .glyphRipple(on: isSelected)
        .animation(.appQuick, value: isSelected)
    }
}

// MARK: - Selectable option card (title + detail)

struct OnboardingOptionCard: View {
    let title: String
    var detail: String? = nil
    var icon: String? = nil
    let isSelected: Bool
    var accent: Color = .appPrimary
    /// Uniform card height for lists where some titles wrap and some don't
    /// (e.g. the goals page) — keeps every card in the stack the same size.
    var minHeight: CGFloat? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 24))
                        .foregroundStyle(isSelected ? accent : Color.white.opacity(0.85))
                        .frame(width: 32)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(.white)
                    if let detail {
                        Text(detail)
                            .font(.system(size: 14))
                            .foregroundStyle(Color.white.opacity(0.6))
                            .multilineTextAlignment(.leading)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 16)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .leading)
            // Liquid Glass card; the accent stroke marks selection only.
            .liquidGlassBackground(
                in: RoundedRectangle(cornerRadius: 16, style: .continuous),
                tint: isSelected ? accent.opacity(0.20) : Color.white.opacity(0.05)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(isSelected ? accent : Color.clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(OnboardingPressStyle())
        .glyphRipple(on: isSelected)
        .animation(.appQuick, value: isSelected)
    }
}

// MARK: - Feature row (icon + title + copy)

struct OnboardingFeatureRow: View {
    let icon: String
    let title: String
    let text: String
    var accent: Color = .appPrimary

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(accent)
                .frame(width: 44, height: 44)
                .liquidGlassBackground(
                    in: RoundedRectangle(cornerRadius: 12, style: .continuous),
                    tint: accent.opacity(0.18)
                )

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                Text(text)
                    .font(.system(size: 14))
                    .foregroundStyle(Color.white.opacity(0.7))
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        // Liquid Glass surface — the pixelwave refracts through the card
        // instead of sitting behind a flat panel. No custom rim; the glass
        // material provides its own edge.
        .liquidGlassBackground(
            in: RoundedRectangle(cornerRadius: 16, style: .continuous),
            tint: Color.white.opacity(0.06)
        )
    }
}

// MARK: - Marker row (icon + per-line highlighter blobs)

/// A benefit styled like a highlighter swipe, matching the onboarding value
/// reference: colored copy sitting on dark, soft-edged "marker" blobs that hug
/// each line individually, with a matching colored icon tile that alternates
/// sides row-to-row for a zig-zag. Bold markdown runs render at full color
/// while the base copy sits a shade dimmer — echoing the reference's
/// emphasized numbers/keywords.
struct OnboardingMarkerRow: View {
    let icon: String
    /// One markdown string per rendered line (`**bold**` for emphasis).
    /// Authored explicitly so each line gets its own hugging blob like the
    /// reference — keep lines short so they stay single-line on small screens.
    let lines: [String]
    let color: Color
    /// Flip the icon + text to the trailing edge — alternate per row.
    var iconTrailing: Bool = false

    // Charcoal a touch lighter than the backdrop so it reads as a marker
    // swipe; the slight transparency lets the pixelwave shimmer through.
    private var blobFill: Color { Color(white: 0.13).opacity(0.9) }

    private var iconTile: some View {
        Image(systemName: icon)
            .font(.system(size: 30, weight: .semibold))
            .foregroundStyle(color)
            .frame(width: 64, height: 64)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous).fill(blobFill)
            )
    }

    // The stat (bold markdown run) is the loudest thing on the line: extra-heavy
    // weight at full color. Base copy sits a shade dimmer at semibold, matching
    // the reference where the numbers are what pop.
    private func styledLine(_ markdown: String) -> AttributedString {
        var attr = (try? AttributedString(markdown: markdown)) ?? AttributedString(markdown)
        // Snapshot ranges first — mutating attributes mid-iteration re-segments
        // the runs collection we'd be walking.
        let runs = attr.runs.map {
            (range: $0.range,
             bold: $0.inlinePresentationIntent?.contains(.stronglyEmphasized) ?? false)
        }
        for run in runs {
            attr[run.range].font = .system(size: 19, weight: run.bold ? .black : .semibold)
            attr[run.range].foregroundColor = run.bold ? color : color.opacity(0.72)
        }
        return attr
    }

    private var markerText: some View {
        // spacing 0 so the per-line blobs touch and read as one unified marker;
        // each line steps in from the aligned edge for the reference's stagger.
        VStack(alignment: iconTrailing ? .trailing : .leading, spacing: 0) {
            ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                Text(styledLine(line))
                    .font(.system(size: 19, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(
                        RoundedRectangle(cornerRadius: 11, style: .continuous)
                            .fill(blobFill)
                            .blur(radius: 1.2)   // soft, highlighter-like edges
                    )
                    .offset(x: CGFloat(index) * (iconTrailing ? -24 : 24))
            }
        }
    }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            if iconTrailing {
                Spacer(minLength: 0)
                markerText
                iconTile
            } else {
                iconTile
                markerText
                Spacer(minLength: 0)
            }
        }
    }
}
