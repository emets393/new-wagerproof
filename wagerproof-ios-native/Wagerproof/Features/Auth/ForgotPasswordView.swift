// ForgotPasswordView.swift
//
// Request a password-reset email. Submits via
// `AuthStore.sendPasswordReset(email:)` which uses `wagerproof://reset-password`
// as the Supabase `redirectTo`. Success state replaces the form with a
// "check your email" confirmation that highlights the entered address.
//
// Visual: shared pixel-glyph gate background, left-aligned minimalist logo +
// header, Liquid Glass input row + CTA — matching the rest of the auth stack.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct ForgotPasswordView: View {
    @Environment(AuthStore.self) private var authStore
    @Environment(\.dismiss) private var dismiss

    @State private var email: String = ""
    @State private var loading: Bool = false
    @State private var errorMessage: String?
    @State private var success: Bool = false
    @State private var submittedEmail: String = ""
    @State private var submitTapCount: Int = 0

    var body: some View {
        ZStack {
            AuthGateBackground()

            Group {
                if success {
                    successView
                } else {
                    formView
                }
            }
            .animation(.easeInOut(duration: 0.3), value: success)
        }
        .preferredColorScheme(.dark)
        .navigationBarBackButtonHidden()
        .toolbar(.hidden, for: .navigationBar)
        .sensoryFeedback(.impact(weight: .light), trigger: submitTapCount)
        .sensoryFeedback(.success, trigger: success)
        .sensoryFeedback(.error, trigger: errorMessage)
    }

    // MARK: - Form view

    private var formView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                backButton.padding(.bottom, 28)

                Image("WagerproofLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 40, height: 40)
                    .padding(.bottom, 18)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Forgot password?")
                        .font(.system(size: 26, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Enter your email and we'll send you a reset link.")
                        .font(.system(size: 15))
                        .foregroundStyle(.white.opacity(0.6))
                        .lineSpacing(2)
                }
                .padding(.bottom, 28)

                VStack(alignment: .leading, spacing: 16) {
                    AuthFieldRow(label: "Email", icon: "envelope") {
                        TextField("", text: $email, prompt:
                            Text("you@example.com").foregroundStyle(.white.opacity(0.3)))
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .submitLabel(.send)
                            .foregroundStyle(.white)
                            .tint(.appPrimary)
                            .onChange(of: email) { _, _ in errorMessage = nil }
                            .onSubmit { Task { await sendReset() } }
                            .disabled(loading)
                    }

                    if let error = errorMessage {
                        AuthErrorBanner(message: error).transition(.opacity)
                    }

                    LiquidGlassPillButton(
                        title: "Send Reset Link",
                        loading: loading,
                        isEnabled: !email.isEmpty
                    ) {
                        submitTapCount += 1
                        Task { await sendReset() }
                    }
                    .padding(.top, 4)
                    .animation(.easeInOut(duration: 0.2), value: errorMessage)
                }
                .padding(.bottom, 28)

                HStack(spacing: 0) {
                    Spacer()
                    Text("Remember your password? ")
                        .font(.system(size: 14))
                        .foregroundStyle(.white.opacity(0.45))
                    Button {
                        dismiss()
                    } label: {
                        Text("Sign In")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.appPrimary)
                    }
                    .buttonStyle(.plain)
                    .disabled(loading)
                    Spacer()
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .scrollDismissesKeyboard(.interactively)
        .scrollIndicators(.hidden)
    }

    // MARK: - Success view

    private var successView: some View {
        VStack(spacing: 0) {
            Spacer()

            ZStack {
                Circle()
                    .fill(Color.appPrimary.opacity(0.12))
                    .frame(width: 96, height: 96)
                Image(systemName: "envelope.badge")
                    .font(.system(size: 44))
                    .foregroundStyle(Color.appPrimary)
                    .symbolEffect(.bounce, value: success)
            }
            .padding(.bottom, 28)

            Text("Check your email")
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.bottom, 16)

            Text("We've sent a password reset link to:")
                .font(.system(size: 15))
                .foregroundStyle(.white.opacity(0.55))
                .multilineTextAlignment(.center)
                .padding(.bottom, 8)

            Text(submittedEmail)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.appPrimary)
                .padding(.bottom, 12)

            Text("Follow the instructions in the email to reset your password.")
                .font(.system(size: 15))
                .foregroundStyle(.white.opacity(0.55))
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.bottom, 20)

            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "info.circle")
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.4))
                Text("If you don't see the email, check your spam folder.")
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.4))
            }
            .padding(.bottom, 24)

            LiquidGlassPillButton(title: "Back to Login") {
                dismiss()
            }

            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.top, 60)
        .padding(.bottom, 24)
    }

    private var backButton: some View {
        Button {
            dismiss()
        } label: {
            Image(systemName: "chevron.left")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .liquidGlassBackground(in: Circle())
        }
        .buttonStyle(.plain)
        // Visual stays 40pt; tap area expands to 44pt (matches RN hitSlop).
        .contentShape(Rectangle())
        .frame(minWidth: 44, minHeight: 44)
        .disabled(loading)
        .accessibilityLabel("Back")
    }

    // MARK: - Actions

    private func validate() -> Bool {
        if email.trimmingCharacters(in: .whitespaces).isEmpty {
            errorMessage = "Please enter your email"; return false
        }
        if !email.contains("@") {
            errorMessage = "Please enter a valid email"; return false
        }
        return true
    }

    private func sendReset() async {
        errorMessage = nil
        guard validate() else { return }
        loading = true
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        await authStore.sendPasswordReset(email: trimmed)
        loading = false
        if let raw = authStore.lastError {
            errorMessage = raw
            authStore.clearError()
            return
        }
        submittedEmail = trimmed
        success = true
    }
}
