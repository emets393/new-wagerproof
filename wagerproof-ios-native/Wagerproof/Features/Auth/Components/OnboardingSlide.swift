// OnboardingSlide.swift
//
// One page of the LoginView carousel. Mirrors the entries in
// `ONBOARDING_SCREENS` from `wagerproof-mobile/app/(auth)/login.tsx`:
// each slide has a title + subtitle + an optional visual.
//
// The visuals in the RN source are bespoke React components (LineMoveCard,
// StatsCard, AIModelCard, DiscordCard, PixelOffice). The PixelOffice 3D
// office scene is not portable in scope of B01 — we file FIDELITY-WAIVER
// #001 and render an SF Symbol placeholder for that slide. All other
// visuals are reproduced with SwiftUI primitives.

import SwiftUI
import WagerproofDesign

enum OnboardingSlideKind: Int, CaseIterable, Identifiable {
    case proData
    case createBots
    case aiModels
    case publicBetting
    case discord
    case getStarted

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .proData:        return "Access Pro-Level Sports Data"
        case .createBots:     return "Create Bots"
        case .aiModels:       return "Advanced AI Models"
        case .publicBetting:  return "Live Public Betting Data"
        case .discord:        return "Exclusive Discord Community"
        case .getStarted:     return "Get Started"
        }
    }

    var subtitle: String {
        switch self {
        case .proData:
            return "We take the data that the pros use and make it accessible to you."
        case .createBots:
            return "Build multiple bots that research picks for you 24/7."
        case .aiModels:
            return "We run thousands of historical games through advanced models and give you the results."
        case .publicBetting:
            return "Track where the public is leaning and make your own decisions."
        case .discord:
            return "Gain access to a private chat with other data driven bettors."
        case .getStarted:
            return "Join today. Money-back guarantee. Cancel at any time."
        }
    }

    /// Per-slide auto-advance duration. Slide 1 (createBots) gets 10s in RN.
    var duration: TimeInterval {
        switch self {
        case .createBots: return 10
        default: return 5
        }
    }

    /// Whether this slide uses the looping login-background video as backdrop
    /// (vs the teal placeholder).
    var hasVideoBackground: Bool {
        switch self {
        case .proData, .getStarted: return true
        default: return false
        }
    }
}

struct OnboardingSlide: View {
    let kind: OnboardingSlideKind
    let isActive: Bool

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)
            visual
                .frame(maxWidth: .infinity)
                .frame(height: 350)
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private var visual: some View {
        switch kind {
        case .proData, .getStarted:
            // Video slides have no floating widget — the looping video shows
            // through the gradient. Render a transparent spacer.
            Color.clear
        case .publicBetting:
            FloatingPublicBettingVisual(isActive: isActive)
        case .aiModels:
            FloatingAIModelVisual(isActive: isActive)
        case .createBots:
            // FIDELITY-WAIVER #001: PixelOffice 3D scene not portable in B01 scope.
            // Render a centred SF-symbol bot trio as a stand-in.
            CreateBotsPlaceholder()
        case .discord:
            FloatingDiscordVisual(isActive: isActive)
        }
    }
}

// MARK: - Per-slide visuals

/// Two overlapping cards — public betting stats + line movement chart.
private struct FloatingPublicBettingVisual: View {
    let isActive: Bool
    @State private var revealed = false

    var body: some View {
        ZStack {
            LineMovementCard()
                .rotationEffect(.degrees(5))
                .offset(x: revealed ? 50 : 20, y: revealed ? 30 : 10)
                .zIndex(2)

            StatsCard()
                .rotationEffect(.degrees(-10))
                .offset(x: revealed ? -70 : -40, y: revealed ? -10 : 0)
                .scaleEffect(0.9)
                .zIndex(1)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 5.0)) { revealed = true }
        }
        .onChange(of: isActive) { _, active in
            if active {
                revealed = false
                withAnimation(.easeOut(duration: 5.0)) { revealed = true }
            }
        }
    }
}

private struct FloatingAIModelVisual: View {
    let isActive: Bool
    @State private var revealed = false

    var body: some View {
        AIModelCard()
            .offset(y: revealed ? -15 : 0)
            .scaleEffect(revealed ? 1.03 : 1.0)
            .opacity(revealed ? 1 : 0.0)
            .onAppear {
                withAnimation(.easeOut(duration: 0.5)) { revealed = true }
            }
            .onChange(of: isActive) { _, active in
                if active {
                    revealed = false
                    withAnimation(.easeOut(duration: 0.5)) { revealed = true }
                }
            }
    }
}

private struct FloatingDiscordVisual: View {
    let isActive: Bool
    @State private var revealed = false

    var body: some View {
        DiscordCard()
            .offset(y: revealed ? -10 : 30)
            .scaleEffect(revealed ? 1.0 : 0.95)
            .opacity(revealed ? 1 : 0.0)
            .onAppear {
                withAnimation(.easeOut(duration: 0.5)) { revealed = true }
            }
            .onChange(of: isActive) { _, active in
                if active {
                    revealed = false
                    withAnimation(.easeOut(duration: 0.5)) { revealed = true }
                }
            }
    }
}

// MARK: - Stats card

private struct StatsCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("% Statistics")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white.opacity(0.9))

            HStack(alignment: .bottom, spacing: 20) {
                statBar(top: "13", height: 60, color: Color(hex: 0xFF4081), bottom: "12/19")
                statBar(top: "15", height: 80, color: Color(hex: 0x00BFA5), bottom: "12/21")
                statBar(top: "26", height: 120, color: Color(hex: 0x00E5FF), bottom: "12/23")
            }
            .frame(maxWidth: .infinity)
        }
        .padding(16)
        .frame(width: 220, height: 240)
        .background(Color.black)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(.white.opacity(0.1), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.5), radius: 24, x: 0, y: 12)
    }

    private func statBar(top: String, height: CGFloat, color: Color, bottom: String) -> some View {
        VStack(spacing: 4) {
            Text(top).font(.system(size: 10, weight: .bold)).foregroundStyle(.white)
            RoundedRectangle(cornerRadius: 6).fill(color).frame(width: 28, height: height)
            Text(bottom).font(.system(size: 10)).foregroundStyle(.white.opacity(0.5))
        }
    }
}

// MARK: - Line movement card

private struct LineMovementCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Line movement and public bet %")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white.opacity(0.9))

            HStack(spacing: 24) {
                statColumn(value: "+1.5 CIN", label: "Line", tint: .white)
                statColumn(value: "69% CIN", label: "Public Bet %", tint: Color(hex: 0x448AFF))
                statColumn(value: "49% CIN", label: "Public Money %", tint: Color(hex: 0x00BFA5))
            }

            // Sparkline-style chart row — mirrors the RN SVG path with two lines.
            ChartScribble()
                .frame(height: 90)
        }
        .padding(16)
        .frame(width: 300, height: 220)
        .background(Color(hex: 0x1E1E1E))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(.white.opacity(0.1), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.5), radius: 24, x: 0, y: 12)
    }

    private func statColumn(value: String, label: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(.system(size: 13, weight: .bold)).foregroundStyle(tint)
            Text(label).font(.system(size: 10)).foregroundStyle(.white.opacity(0.5))
        }
    }
}

private struct ChartScribble: View {
    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Purple area fill
                Path { p in
                    let w = geo.size.width
                    let h = geo.size.height
                    p.move(to: CGPoint(x: 0, y: h * 0.55))
                    p.addLine(to: CGPoint(x: w * 0.1, y: h * 0.55))
                    p.addLine(to: CGPoint(x: w * 0.1, y: h * 0.35))
                    p.addLine(to: CGPoint(x: w * 0.2, y: h * 0.40))
                    p.addLine(to: CGPoint(x: w * 0.3, y: h * 0.30))
                    p.addLine(to: CGPoint(x: w * 0.45, y: h * 0.32))
                    p.addLine(to: CGPoint(x: w * 0.55, y: h * 0.22))
                    p.addLine(to: CGPoint(x: w * 0.7, y: h * 0.28))
                    p.addLine(to: CGPoint(x: w * 0.85, y: h * 0.30))
                    p.addLine(to: CGPoint(x: w * 1.0, y: h * 0.40))
                    p.addLine(to: CGPoint(x: w, y: h))
                    p.addLine(to: CGPoint(x: 0, y: h))
                    p.closeSubpath()
                }
                .fill(
                    LinearGradient(
                        colors: [Color(hex: 0x7C4DFF).opacity(0.4), Color(hex: 0x7C4DFF).opacity(0)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

                // Purple stroke
                Path { p in
                    let w = geo.size.width
                    let h = geo.size.height
                    p.move(to: CGPoint(x: 0, y: h * 0.55))
                    p.addLine(to: CGPoint(x: w * 0.1, y: h * 0.55))
                    p.addLine(to: CGPoint(x: w * 0.1, y: h * 0.35))
                    p.addLine(to: CGPoint(x: w * 0.2, y: h * 0.40))
                    p.addLine(to: CGPoint(x: w * 0.3, y: h * 0.30))
                    p.addLine(to: CGPoint(x: w * 0.45, y: h * 0.32))
                    p.addLine(to: CGPoint(x: w * 0.55, y: h * 0.22))
                    p.addLine(to: CGPoint(x: w * 0.7, y: h * 0.28))
                    p.addLine(to: CGPoint(x: w * 0.85, y: h * 0.30))
                    p.addLine(to: CGPoint(x: w * 1.0, y: h * 0.40))
                }
                .stroke(Color(hex: 0x7C4DFF).opacity(0.8), lineWidth: 2)

                // Cyan stepped line
                Path { p in
                    let w = geo.size.width
                    let h = geo.size.height
                    p.move(to: CGPoint(x: w * 0.03, y: h * 0.65))
                    p.addLine(to: CGPoint(x: w * 0.15, y: h * 0.65))
                    p.addLine(to: CGPoint(x: w * 0.15, y: h * 0.80))
                    p.addLine(to: CGPoint(x: w * 0.30, y: h * 0.80))
                    p.addLine(to: CGPoint(x: w * 0.30, y: h * 0.55))
                    p.addLine(to: CGPoint(x: w * 0.47, y: h * 0.55))
                    p.addLine(to: CGPoint(x: w * 0.47, y: h * 0.65))
                    p.addLine(to: CGPoint(x: w * 0.60, y: h * 0.65))
                    p.addLine(to: CGPoint(x: w * 0.60, y: h * 0.40))
                    p.addLine(to: CGPoint(x: w * 0.80, y: h * 0.40))
                    p.addLine(to: CGPoint(x: w * 0.80, y: h * 0.65))
                    p.addLine(to: CGPoint(x: w * 1.0, y: h * 0.65))
                }
                .stroke(Color(hex: 0x00E5FF), lineWidth: 2)
            }
        }
    }
}

// MARK: - AI Model card

private struct AIModelCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 18))
                    .foregroundStyle(Color(hex: 0x00BFA5))
                Text("NFL Predictor v2.1")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Text("LIVE")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color(hex: 0x00BFA5))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Color(hex: 0x00BFA5).opacity(0.2))
                    .clipShape(Capsule())
            }

            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Win Rate").font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                    Text("68.4%").font(.system(size: 24, weight: .heavy))
                        .foregroundStyle(Color(hex: 0x00BFA5))
                    Text("Last 50 games").font(.system(size: 10)).foregroundStyle(.white.opacity(0.5))
                }
                Spacer()
                VStack(alignment: .leading, spacing: 2) {
                    Text("ROI").font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                    Text("+12.8%").font(.system(size: 24, weight: .heavy))
                        .foregroundStyle(Color(hex: 0x00E5FF))
                    Text("All time").font(.system(size: 10)).foregroundStyle(.white.opacity(0.5))
                }
            }

            GeometryReader { geo in
                Path { p in
                    let w = geo.size.width
                    let h = geo.size.height
                    p.move(to: CGPoint(x: 0, y: h * 0.8))
                    p.addQuadCurve(to: CGPoint(x: w * 0.5, y: h * 0.3),
                                   control: CGPoint(x: w * 0.25, y: h * 0.8))
                    p.addQuadCurve(to: CGPoint(x: w, y: h * 0.15),
                                   control: CGPoint(x: w * 0.75, y: 0))
                }
                .stroke(Color(hex: 0x00BFA5), lineWidth: 3)
            }
            .frame(height: 50)
        }
        .padding(16)
        .frame(width: 280, height: 220)
        .background(Color(hex: 0x1E1E1E))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(.white.opacity(0.1), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.5), radius: 24, x: 0, y: 12)
    }
}

// MARK: - Discord card

private struct DiscordCard: View {
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Image(systemName: "number")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                Text("sharp-plays")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .background(Color(hex: 0x5865F2))

            VStack(alignment: .leading, spacing: 14) {
                discordRow(color: Color(hex: 0xFF4081), name: "SharpShooter",
                           text: "Hitting the over on LeBron props tonight",
                           opacity: 1.0)
                discordRow(color: Color(hex: 0x00E5FF), name: "DataDave",
                           text: "Model agrees. 5 star value.",
                           opacity: 1.0)
                discordRow(color: Color(hex: 0x00BFA5), name: "WinBot",
                           text: "New alert: Line movement detected...",
                           opacity: 0.5)
            }
            .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(width: 280, height: 240)
        .background(Color(hex: 0x1E1E1E))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(.white.opacity(0.1), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.5), radius: 24, x: 0, y: 12)
    }

    private func discordRow(color: Color, name: String, text: String, opacity: Double) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Circle().fill(color).frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                Text(text)
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.7))
                    .lineLimit(2)
            }
            Spacer()
        }
        .opacity(opacity)
    }
}

// MARK: - Create-bots placeholder (FIDELITY-WAIVER #001)

private struct CreateBotsPlaceholder: View {
    var body: some View {
        VStack(spacing: 16) {
            HStack(spacing: 24) {
                bot(emoji: "🦅", color: Color(hex: 0x3B82F6))
                bot(emoji: "🌮", color: Color(hex: 0xF59E0B))
                bot(emoji: "🤖", color: Color(hex: 0x8B5CF6))
            }
            Text("Sharp Edge · Taco King · Data Bot")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white.opacity(0.7))
        }
        .padding(24)
        .frame(width: 320)
        .background(Color(hex: 0x1A1A2E))
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    private func bot(emoji: String, color: Color) -> some View {
        ZStack {
            Circle().fill(color.opacity(0.2))
                .overlay(Circle().stroke(color, lineWidth: 2))
                .frame(width: 64, height: 64)
            Text(emoji).font(.system(size: 32))
        }
    }
}
