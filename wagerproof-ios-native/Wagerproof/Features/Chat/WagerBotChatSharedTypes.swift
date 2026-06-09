import SwiftUI
import WagerproofDesign

/// Color tokens for the WagerBot chat surface. Mirrors Honeydew's
/// `AssistantUiTokens` shape (resolved once at the top of the chat view
/// and passed down by value to children) but pulls hex values from the
/// Wagerproof palette so the chat reads as part of the host app rather
/// than borrowed chrome from the Honeydew port.
///
/// Light values match the standard Wagerproof paper background; dark
/// values match the near-black surface used across every other dark-mode
/// tab. Single-purpose token names mirror the Honeydew naming so a
/// side-by-side audit lines up row-for-row.
struct WagerBotUiTokens {
    let pageBackground: Color
    let surfaceBackground: Color
    let borderColor: Color
    let primaryText: Color
    let mutedText: Color
    let userBubbleBackground: Color
    let userBubbleText: Color
    let assistantBubbleBackground: Color
    let assistantBubbleText: Color
    let composerBackground: Color
    let composerBorder: Color
    let hintChipBackground: Color
    let hintChipText: Color
    let controlBackground: Color
    let primaryActionBackground: Color
    let primaryActionForeground: Color
    /// Brand-tint used for tool chips, thinking indicator, send button.
    let accent: Color

    static func resolve(_ scheme: ColorScheme) -> WagerBotUiTokens {
        if scheme == .dark {
            return WagerBotUiTokens(
                pageBackground: Color(hex: 0x0A0A0A),
                surfaceBackground: Color(hex: 0x141414),
                borderColor: Color(hex: 0x262626),
                primaryText: Color(hex: 0xF8FAFC),
                mutedText: Color(hex: 0x94A3B8),
                userBubbleBackground: Color(hex: 0x1F1F1F),
                userBubbleText: Color(hex: 0xF8FAFC),
                assistantBubbleBackground: Color(hex: 0x141414),
                assistantBubbleText: Color(hex: 0xF8FAFC),
                composerBackground: Color(hex: 0x141414),
                composerBorder: Color(hex: 0x2A2A2A),
                hintChipBackground: Color(hex: 0x1A1A1A),
                hintChipText: Color(hex: 0xE2E8F0),
                controlBackground: Color(hex: 0x1F1F1F),
                primaryActionBackground: Color(hex: 0xF8FAFC),
                primaryActionForeground: Color(hex: 0x0A0A0A),
                accent: Color(hex: 0x22C55E)
            )
        }
        return WagerBotUiTokens(
            pageBackground: Color(hex: 0xFFFFFF),
            surfaceBackground: Color(hex: 0xF8FAFC),
            borderColor: Color(hex: 0xE2E8F0),
            primaryText: Color(hex: 0x0F172A),
            mutedText: Color(hex: 0x64748B),
            userBubbleBackground: Color(hex: 0xF1F5F9),
            userBubbleText: Color(hex: 0x0F172A),
            assistantBubbleBackground: Color(hex: 0xFFFFFF),
            assistantBubbleText: Color(hex: 0x0F172A),
            composerBackground: Color(hex: 0xFFFFFF),
            composerBorder: Color(hex: 0xE2E8F0),
            hintChipBackground: Color(hex: 0xF1F5F9),
            hintChipText: Color(hex: 0x334155),
            controlBackground: Color(hex: 0xF1F5F9),
            primaryActionBackground: Color(hex: 0x0F172A),
            primaryActionForeground: Color(hex: 0xFFFFFF),
            accent: Color(hex: 0x16A34A)
        )
    }
}

/// Brand AI avatar for the empty / welcome state. Mirrors Honeydew's
/// `AIChatDynamicIcon` — a rotating circle with a sparkle inside, scaled
/// to the size the caller asks for. We don't use Apple's IntelligenceGlow
/// (it's a Honeydew-specific package); instead we paint a soft green
/// radial halo behind the disc so the surface still reads as "the AI is
/// awake."
struct WagerBotDynamicIcon: View {
    var size: CGFloat = 72

    @Environment(\.colorScheme) private var colorScheme
    @State private var rotation: Double = 0
    @State private var pulsing: Bool = false

    var body: some View {
        ZStack {
            // Halo — gradient bloom behind the disc.
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.appPrimary.opacity(0.45),
                            Color.appPrimary.opacity(0.0)
                        ],
                        center: .center,
                        startRadius: 0,
                        endRadius: size * 0.9
                    )
                )
                .frame(width: size * 1.6, height: size * 1.6)
                .scaleEffect(pulsing ? 1.05 : 0.95)
                .opacity(pulsing ? 0.95 : 0.7)

            Circle()
                .fill(circleFill)
                .frame(width: size, height: size)
                .overlay(
                    Circle().stroke(Color.appPrimary.opacity(0.35), lineWidth: 1.5)
                )
                .rotationEffect(.degrees(rotation))

            WagerBotIcon(size: size * 0.6)
                .foregroundStyle(sparkleColor)
                .scaleEffect(pulsing ? 1.08 : 1.0)
                .rotationEffect(.degrees(pulsing ? 1.8 : -1.8))
        }
        .frame(width: size, height: size)
        .onAppear {
            withAnimation(.linear(duration: 7).repeatForever(autoreverses: false)) {
                rotation = 360
            }
            withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                pulsing = true
            }
        }
    }

    private var circleFill: Color {
        colorScheme == .dark ? Color(white: 0.10) : Color(white: 0.97)
    }

    private var sparkleColor: Color {
        colorScheme == .dark ? Color.appPrimary.opacity(0.95) : Color.appPrimaryStrong
    }
}

#Preview {
    HStack {
        WagerBotDynamicIcon(size: 60)
        WagerBotDynamicIcon(size: 72)
    }
    .padding()
}
