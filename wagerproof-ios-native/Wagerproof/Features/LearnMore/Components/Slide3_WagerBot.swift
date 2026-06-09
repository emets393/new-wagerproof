import SwiftUI
import WagerproofDesign

/// Mirrors `wagerproof-mobile/components/learn-wagerproof/slides/Slide3_WagerBot.tsx`.
///
/// Dynamic-Island-style bubble at the top with:
///   - A countdown progress ring around a robot glyph (animated 0 → 1).
///   - A typewriter-style suggestion message that types character-by-character.
///   - A bottom drag handle indicator (visual only, doesn't gesture in the demo).
/// Followed by 4 feature rows describing what WagerBot does.
struct Slide3_WagerBot: View {
    private static let suggestion = "The Lakers have covered the spread in 8 of their last 10 home games. Consider Lakers -4.5 tonight!"

    @State private var ringProgress: CGFloat = 0
    @State private var typedCount: Int = 0
    @State private var typingTimer: Timer?

    private struct Feature: Identifiable {
        let id = UUID()
        let systemImage: String
        let label: String
        let desc: String
    }

    private let features: [Feature] = [
        Feature(systemImage: "brain.head.profile", label: "Auto-Generated Insights", desc: "WagerBot scans games automatically"),
        Feature(systemImage: "hand.tap.fill",      label: "Tap to View Game",       desc: "Jump to full game details"),
        Feature(systemImage: "timer",              label: "Auto-Dismiss Timer",     desc: "Green ring shows countdown"),
        Feature(systemImage: "arrow.down",         label: "Pull to Detach",         desc: "Floating assistant mode"),
    ]

    var body: some View {
        VStack(spacing: Spacing.lg) {
            bubble
            VStack(spacing: Spacing.sm) {
                ForEach(features) { f in
                    featureRow(f)
                }
            }
        }
        .onAppear { startAnimations() }
        .onDisappear { stopAnimations() }
    }

    // MARK: - Bubble

    private var bubble: some View {
        ZStack {
            // Bubble body
            HStack(alignment: .center, spacing: Spacing.md) {
                // Countdown ring + robot glyph
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.2), lineWidth: 3)
                    Circle()
                        .trim(from: 0, to: ringProgress)
                        .stroke(Color.appPrimary, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 18))
                        .foregroundStyle(Color.appPrimary)
                }
                .frame(width: 44, height: 44)

                // Typewriter text + caret
                let prefix = String(Self.suggestion.prefix(typedCount))
                (Text(prefix) + Text(typedCount < Self.suggestion.count ? "|" : ""))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .lineLimit(4)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.md)
        }
        .background(Color(hex: 0x1A1A1A))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(alignment: .bottom) {
            Capsule()
                .fill(Color.white.opacity(0.3))
                .frame(width: 32, height: 4)
                .padding(.bottom, 4)
        }
        .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
        .frame(maxWidth: .infinity)
    }

    private func featureRow(_ f: Feature) -> some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(Color.appPrimary.opacity(0.15))
                Image(systemName: f.systemImage)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text(f.label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                Text(f.desc)
                    .font(.system(size: 11))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Spacer()
        }
        .padding(10)
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    // MARK: - Animation lifecycle

    private func startAnimations() {
        // Ring fills from 0 → 1 in 8s (visual cue only — not a real countdown).
        withAnimation(.linear(duration: 8)) {
            ringProgress = 1.0
        }
        // Typewriter: ~25ms per character matching RN `speed={25}`.
        typedCount = 0
        typingTimer?.invalidate()
        typingTimer = Timer.scheduledTimer(withTimeInterval: 0.025, repeats: true) { t in
            DispatchQueue.main.async {
                if typedCount >= Self.suggestion.count {
                    t.invalidate()
                } else {
                    typedCount += 1
                }
            }
        }
    }

    private func stopAnimations() {
        typingTimer?.invalidate()
        typingTimer = nil
    }
}
