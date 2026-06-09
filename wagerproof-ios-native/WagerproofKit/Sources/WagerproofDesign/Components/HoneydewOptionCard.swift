import SwiftUI

/// Honeydew-style hero option card. 1:1 port of the `optionCard` ViewBuilder
/// in `Honeydew/Features/RecipeImport/AddRecipeBottomSheet.swift:959-1030`
/// plus its companion `actionPill`.
///
/// Visual stack (bottom → top):
///   1. Two-stop horizontal gradient (deep leading hue → pale trailing hue)
///   2. Drifting `OptionCardIconChrome` of SF Symbols in `primaryColor`
///   3. Left → right fade overlay in `primaryColor` (opaque leading,
///      transparent trailing — so the icons emerge from the left edge)
///   4. Foreground content: 17pt bold title + 13pt medium subtitle on the
///      leading side, liquid-glass action pill on the trailing side
///   5. Hairline white@0.12 stroke + double drop shadow
///
/// Use as a tap target — the entire card is a `Button` whose action fires
/// the supplied `onTap`.
public struct HoneydewOptionCard: View {
    public let title: String
    public let subtitle: String
    public let actionWord: String
    public let primaryColor: Color
    public let secondaryColor: Color
    public let symbols: [String]
    public let seed: Double
    public let speedFactor: Double
    public let yJitter: CGFloat
    public let onTap: () -> Void

    /// `Reduce Motion` accessibility setting drives whether the SF Symbol
    /// chrome animates. When ON, the icon layer renders at a frozen time
    /// so the spacing is preserved but the per-frame work goes away.
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        title: String,
        subtitle: String,
        actionWord: String,
        primaryColor: Color,
        secondaryColor: Color,
        symbols: [String],
        seed: Double = 0.0,
        speedFactor: Double = 1.0,
        yJitter: CGFloat = 0.0,
        onTap: @escaping () -> Void
    ) {
        self.title = title
        self.subtitle = subtitle
        self.actionWord = actionWord
        self.primaryColor = primaryColor
        self.secondaryColor = secondaryColor
        self.symbols = symbols
        self.seed = seed
        self.speedFactor = speedFactor
        self.yJitter = yJitter
        self.onTap = onTap
    }

    public var body: some View {
        let shape = RoundedRectangle(cornerRadius: 23, style: .continuous)
        Button(action: onTap) {
            ZStack {
                // 1. Gradient base — deep leading → pale trailing.
                LinearGradient(
                    colors: [primaryColor, secondaryColor],
                    startPoint: .leading,
                    endPoint: .trailing
                )

                // 2. Drifting SF Symbol chrome.
                OptionCardIconChrome(
                    primaryColor: primaryColor,
                    symbols: symbols,
                    seed: seed,
                    speedFactor: speedFactor,
                    yJitter: yJitter,
                    motionEnabled: !reduceMotion
                )

                // 3. Fade-over-icons overlay. Drawn above the icons but
                //    below the text/pill so silhouettes dissolve into the
                //    leading color and emerge cleanly on the trailing side.
                LinearGradient(
                    colors: [primaryColor, primaryColor.opacity(0)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .allowsHitTesting(false)

                // 4. Foreground: title/subtitle on the left, glass pill
                //    on the right.
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(title)
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                            .shadow(color: .black.opacity(0.12), radius: 1, x: 0, y: 1)
                        Text(subtitle)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.white.opacity(0.95))
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                            .shadow(color: .black.opacity(0.08), radius: 1, x: 0, y: 1)
                    }
                    Spacer(minLength: 6)
                    actionPill
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 9)
            }
            .frame(maxWidth: .infinity, minHeight: 64)
            .clipShape(shape)
            // Hairline edge — subtle white border to crisp the rounded
            // corner against the surface without reading as a glassy
            // highlight.
            .overlay(
                shape
                    .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
                    .allowsHitTesting(false)
            )
            .shadow(color: .black.opacity(0.10), radius: 8, x: 0, y: 3)
            .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
        }
        .buttonStyle(.plain)
    }

    /// Liquid-glass pill on the trailing edge. Uses the shared
    /// `LiquidGlassCapsule` modifier so on iOS 26 the surface is
    /// `glassEffect(.regular, in: Capsule())` and on iOS 17/18 it falls
    /// back to `.ultraThinMaterial` + hairline-stroke. The extra white
    /// stroke + black shadow are additive — they bring the pill's visual
    /// prominence in line over the smooth color gradient (lower-frequency
    /// content than the recipe photos the original Honeydew pill sat on).
    private var actionPill: some View {
        let capsule = Capsule()
        return HStack(spacing: 4) {
            Text(actionWord)
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
        }
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(.primary)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .modifier(LiquidGlassCapsule())
        .overlay(
            capsule
                .stroke(Color.white.opacity(0.32), lineWidth: 0.75)
                .allowsHitTesting(false)
        )
        .shadow(color: .black.opacity(0.18), radius: 4, x: 0, y: 1)
    }
}

#Preview("Pro + Discord side by side") {
    VStack(spacing: 8) {
        HoneydewOptionCard(
            title: "Go Pro Today",
            subtitle: "Unlock premium picks",
            actionWord: "Upgrade",
            primaryColor: Color(red: 0.98, green: 0.65, blue: 0.05),
            secondaryColor: Color(red: 1.00, green: 0.85, blue: 0.40),
            symbols: ["crown.fill", "sparkles", "star.fill", "gift.fill",
                      "dollarsign.circle.fill", "chart.line.uptrend.xyaxis",
                      "bolt.fill", "trophy.fill", "flame.fill", "rosette"],
            seed: 0.13,
            speedFactor: 1.0,
            yJitter: 0.02,
            onTap: {}
        )
        HoneydewOptionCard(
            title: "Join our Discord",
            subtitle: "Picks, updates, and live chat",
            actionWord: "Join",
            primaryColor: Color(red: 0.36, green: 0.40, blue: 0.95),
            secondaryColor: Color(red: 0.60, green: 0.65, blue: 1.00),
            symbols: ["bubble.left.and.bubble.right.fill", "message.fill",
                      "person.2.fill", "hand.wave.fill", "headphones",
                      "mic.fill", "heart.fill", "star.fill",
                      "ellipsis.bubble.fill", "person.3.fill"],
            seed: 0.46,
            speedFactor: 0.95,
            yJitter: -0.04,
            onTap: {}
        )
    }
    .padding()
    .background(Color.black)
}
