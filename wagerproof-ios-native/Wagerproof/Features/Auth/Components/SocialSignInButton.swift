// SocialSignInButton.swift
//
// White pill button used for the "Continue with Google" CTA on LoginView
// and the "Google" / "Apple" buttons on SignupView. Matches the RN
// `socialButton` style (white bg, rounded 30, centered icon + label).
//
// Apple sign-in uses Apple's `SignInWithAppleButton` directly (see LoginView);
// this component is only used for non-native social glyphs where we don't
// have an SF Symbol (Google) or want a uniform pill shape (Signup screen).

import SwiftUI
import WagerproofDesign

enum SocialSignInProvider {
    case apple
    case google

    var label: String {
        switch self {
        case .apple:  return "Continue with Apple"
        case .google: return "Continue with Google"
        }
    }

    var shortLabel: String {
        switch self {
        case .apple:  return "Apple"
        case .google: return "Google"
        }
    }
}

/// White pill button — 54pt min height, corner radius 30, black text & icon.
/// Disabled state matches RN: opacity 0.4.
struct SocialSignInButton: View {
    let provider: SocialSignInProvider
    var compact: Bool = false
    var loading: Bool = false
    var disabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button {
            action()
        } label: {
            HStack(spacing: 8) {
                if loading {
                    ProgressView().tint(.black)
                } else {
                    glyph
                    Text(compact ? provider.shortLabel : provider.label)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.black)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 54)
        }
        .buttonStyle(SocialPillButtonStyle())
        .disabled(loading || disabled)
        .opacity(disabled ? 0.4 : 1.0)
    }

    @ViewBuilder
    private var glyph: some View {
        switch provider {
        case .apple:
            Image(systemName: "applelogo")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(.black)
        case .google:
            // SF Symbols has no Google glyph and we don't yet have the
            // `google_logo` asset in the iOS bundle — use a tinted "G" as
            // a temporary mark until B01 asset import lands.
            // FIDELITY-WAIVER #002: missing official Google logo asset.
            Text("G")
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(.black)
        }
    }
}

private struct SocialPillButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, 24)
            .background(
                RoundedRectangle(cornerRadius: 30).fill(Color.white)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .opacity(configuration.isPressed ? 0.85 : 1.0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
