// PicksExpiryPill.swift
//
// The scarcity clock on the custom paywall: one glass capsule counting the
// 3-hour hold on the picks the user just watched their agent generate.
//
// The countdown is `Text(timerInterval:)`, not a `Timer` — SwiftUI ticks it
// natively at second resolution with no state churn, and it is the same
// primitive the Live Activity uses, so the pill and the Lock Screen card can
// never drift apart by a frame.
//
// See .claude/docs/19_picks_expiry_hold.md

import SwiftUI
import WagerproofDesign
import WagerproofServices

struct PicksExpiryPill: View {
    let window: PicksExpiryService.Window
    var compact: Bool = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false

    /// Amber, not the paywall's green accent — this is the one element on the
    /// screen that has to read as a deadline rather than as product chrome,
    /// and it matches the `SAVE %` / `INTRO OFFER` ribbons already in use.
    private var urgent: Color { .appAccentAmber }

    var body: some View {
        HStack(spacing: compact ? 5 : 9) {
            Image(systemName: "hourglass")
                .font(.system(size: compact ? 10 : 12.5, weight: .bold))
                .foregroundStyle(urgent)
                .opacity(pulse ? 0.55 : 1)

            Text(compact ? "Picks expire in:" : holdLabel)
                .font(.system(size: compact ? 9 : 11.5, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.appTextSecondary)
                .lineLimit(1)
                .fixedSize(horizontal: compact, vertical: false)

            // Monospaced digits keep the capsule from breathing every second
            // as glyph widths change.
            Text(timerInterval: window.range, countsDown: true)
                .font(.system(size: compact ? 11.5 : 15, weight: .heavy, design: .monospaced))
                .foregroundStyle(urgent)
                // 2:58:52 is the widest the timer ever gets; without a fixed
                // width the pill would jitter as it drops to 59:59.
                .frame(width: compact ? 54 : 68, alignment: .leading)
        }
        .padding(.horizontal, compact ? 9 : 14)
        .frame(height: compact ? 26 : 34)
        .liquidGlassBackground(in: Capsule(), tint: urgent.opacity(0.10))
        .overlay(Capsule().strokeBorder(urgent.opacity(0.34), lineWidth: 1))
        .shadow(color: urgent.opacity(pulse ? 0.30 : 0.12), radius: compact ? 6 : 10, y: 3)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.15).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
    }

    private var holdLabel: String {
        window.pickCount == 1 ? "Your pick expires in" : "Your \(window.pickCount) picks expire in"
    }

    /// VoiceOver reads a rounded remaining time instead of the live ticker —
    /// a per-second announcement would fight the user for the audio channel.
    private var accessibilityLabel: String {
        let minutes = max(0, Int(window.expiresAt.timeIntervalSinceNow / 60))
        let hours = minutes / 60
        let remainder = minutes % 60
        let time = hours > 0
            ? "\(hours) hour\(hours == 1 ? "" : "s") \(remainder) minute\(remainder == 1 ? "" : "s")"
            : "\(remainder) minute\(remainder == 1 ? "" : "s")"
        return "\(window.pickCount) picks expire in \(time)"
    }
}
