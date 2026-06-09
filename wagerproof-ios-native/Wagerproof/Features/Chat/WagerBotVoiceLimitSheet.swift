// WagerBotVoiceLimitSheet.swift
//
// Rebranded port of Honeydew's `ChatLimitReachedSheet`. Shown when
// `WagerBotVoiceSession.start(...)` throws a 429 / "daily limit" error from
// the `create-wagerbot-voice-session` edge function. The hard block lives on
// the server; this sheet is the friendly explanation + a path to the paywall
// for free users.
//
// Tone matches Honeydew's: explain WHY, never scold, offer a way forward.
// Free users see "Upgrade to Pro" as the primary action; Pro users (who can
// still hit a much higher limit) just see "Got it" since there's no further
// tier to upsell.

import SwiftUI
import WagerproofDesign

struct WagerBotVoiceLimitSheet: View {
    /// True when the user is on the free tier — drives the upgrade CTA.
    let isPro: Bool

    /// Verbatim message from the edge function (HTTP 429 body). Surfaced so the
    /// user sees the same reset/limit copy the server sent.
    let serverMessage: String?

    /// Fires when a free user taps "Upgrade to Pro". The parent dismisses this
    /// sheet and presents the RevenueCat paywall.
    let onUpgrade: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 0) {
                    // Hero avatar — the same ChattingRobot Lottie used on the
                    // voice screen so this sheet reads as part of the same
                    // surface, not a generic error dialog.
                    LottieView(name: "ChattingRobot")
                        .frame(width: 96, height: 96)
                        .padding(.top, 24)

                    Spacer().frame(height: 16)

                    Text(headline)
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.appTextPrimary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 24)

                    Spacer().frame(height: 10)

                    Text(bodyCopy)
                        .font(AppFont.body)
                        .foregroundStyle(Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 28)
                        .lineSpacing(2)

                    if let serverMessage, !serverMessage.isEmpty {
                        Spacer().frame(height: 18)
                        resetLine(serverMessage)
                            .padding(.horizontal, 24)
                    }

                    Spacer().frame(height: 20)
                }
            }
            .scrollIndicators(.hidden)

            actionButtons
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity)
        .background(Color.appSurface)
    }

    // MARK: - Copy

    private var headline: String {
        isPro ? "You've hit your Pro voice limit" : "You've hit today's voice limit"
    }

    private var bodyCopy: String {
        if isPro {
            return "Wow — you've been talking strategy all day. You've used your full Pro voice budget. It resets automatically, so check back soon."
        }
        return "You've used all your free WagerBot Voice sessions for now. Upgrade to Pro for a much bigger budget, or check back when it resets."
    }

    private func resetLine(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "arrow.clockwise.circle.fill")
                .font(.system(size: 16))
                .foregroundStyle(Color.appPrimary)
            Text(message)
                .font(AppFont.caption)
                .foregroundStyle(Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }

    // MARK: - Buttons

    @ViewBuilder
    private var actionButtons: some View {
        if !isPro {
            VStack(spacing: 10) {
                Button {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    dismiss()
                    // Let the dismiss animation play a clean frame before the
                    // parent slides in the paywall (mirrors Honeydew's beat).
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                        onUpgrade()
                    }
                } label: {
                    Text("Upgrade to Pro")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(Color.appPrimary)
                        )
                }
                .buttonStyle(.plain)

                Button {
                    UISelectionFeedbackGenerator().selectionChanged()
                    dismiss()
                } label: {
                    Text("Maybe later")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.plain)
            }
        } else {
            Button {
                UISelectionFeedbackGenerator().selectionChanged()
                dismiss()
            } label: {
                Text("Got it")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Color.appPrimary)
                    )
            }
            .buttonStyle(.plain)
        }
    }
}

#if DEBUG
#Preview("Free over limit") {
    Color.black
        .sheet(isPresented: .constant(true)) {
            WagerBotVoiceLimitSheet(
                isPro: false,
                serverMessage: "Daily limit reached. Resets at midnight ET.",
                onUpgrade: {}
            )
            .presentationDetents([.medium, .large])
        }
}

#Preview("Pro over limit") {
    Color.black
        .sheet(isPresented: .constant(true)) {
            WagerBotVoiceLimitSheet(
                isPro: true,
                serverMessage: "You've used your Pro voice budget for today.",
                onUpgrade: {}
            )
            .presentationDetents([.medium, .large])
        }
}
#endif
