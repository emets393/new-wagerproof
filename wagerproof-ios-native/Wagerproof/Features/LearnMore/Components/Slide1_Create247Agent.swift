import SwiftUI
import WagerproofDesign

/// Mirrors `wagerproof-mobile/components/learn-wagerproof/slides/Slide1_Create247Agent.tsx`.
///
/// The RN version optionally renders a Lottie `RobotAnalyzing.json`. We don't
/// bundle Lottie in the Swift port (no dependency yet) — instead we render a
/// large SF Symbol robot inside the hero card with the same gentle pulse the
/// Lottie scene used. See `// FIDELITY-WAIVER #063` below.
struct Slide1_Create247Agent: View {
    @State private var pulse: Bool = false

    private struct Bullet: Identifiable {
        let id = UUID()
        let systemImage: String
        let title: String
        let description: String
    }

    private let bullets: [Bullet] = [
        Bullet(
            systemImage: "brain.head.profile",
            title: "Build multiple agents",
            description: "Create as many agents as you want, each with a different betting strategy."
        ),
        Bullet(
            systemImage: "clock.fill",
            title: "24/7 research",
            description: "Your agents continuously research games and surface picks around the clock."
        ),
        Bullet(
            systemImage: "trophy.fill",
            title: "Global leaderboard",
            description: "View the world's best agents, their records, and their latest picks."
        ),
    ]

    var body: some View {
        VStack(spacing: Spacing.sm) {
            // Hero animation card — Lottie placeholder.
            // FIDELITY-WAIVER #063 — RN renders `RobotAnalyzing.json`; the Swift
            // port draws the static SF Symbol robot with a gentle scale pulse.
            ZStack {
                Image(systemName: "brain.head.profile")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(Color.appPrimary)
                    .frame(width: 72, height: 72)
                    .scaleEffect(pulse ? 1.05 : 0.95)
                    .animation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true), value: pulse)
            }
            .frame(maxWidth: .infinity, minHeight: 150)
            .background(Color.appSurfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .onAppear { pulse = true }

            VStack(spacing: Spacing.sm) {
                ForEach(bullets) { bullet in
                    bulletCard(bullet)
                }
            }
        }
    }

    private func bulletCard(_ bullet: Bullet) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: Spacing.sm) {
                ZStack {
                    Circle().fill(Color.appPrimary.opacity(0.14))
                    Image(systemName: bullet.systemImage)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.appPrimary)
                }
                .frame(width: 26, height: 26)

                Text(bullet.title)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            Text(bullet.description)
                .font(.system(size: 11))
                .lineSpacing(2)
                .foregroundStyle(Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
