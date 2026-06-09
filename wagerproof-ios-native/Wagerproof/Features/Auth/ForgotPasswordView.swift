// ForgotPasswordView.swift
//
// Request a password-reset email. 1:1 port of
// `wagerproof-mobile/app/(auth)/forgot-password.tsx`.
//
// Form state → submits via `AuthStore.sendPasswordReset(email:)` which uses
// `wagerproof://reset-password` as the Supabase `redirectTo` (matches RN).
// Success state replaces the form with a "check your email" confirmation
// that highlights the entered address in teal.

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
            AuthGradientBackground()

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
                backButton.padding(.bottom, 24)
                logo.padding(.bottom, 32)

                VStack(spacing: 24) {
                    ZStack {
                        Circle()
                            .fill(Color(hex: 0x00BFA5).opacity(0.12))
                            .frame(width: 80, height: 80)
                        Image(systemName: "lock.rotation")
                            .font(.system(size: 36))
                            .foregroundStyle(Color(hex: 0x00BFA5))
                    }

                    VStack(spacing: 12) {
                        Text("Forgot Password?")
                            .font(.system(size: 28, weight: .heavy))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                        Text("No worries! Enter your email and we'll send you a link to reset your password.")
                            .font(.system(size: 16))
                            .foregroundStyle(.white.opacity(0.5))
                            .multilineTextAlignment(.center)
                            .lineSpacing(4)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.bottom, 36)

                VStack(alignment: .leading, spacing: 20) {
                    AuthFieldRow(label: "Email", icon: "envelope") {
                        TextField("", text: $email, prompt:
                            Text("you@example.com").foregroundStyle(.white.opacity(0.3)))
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .submitLabel(.send)
                            .foregroundStyle(.white)
                            .tint(Color(hex: 0x00BFA5))
                            .onChange(of: email) { _, _ in errorMessage = nil }
                            .onSubmit { Task { await sendReset() } }
                            .disabled(loading)
                    }

                    if let error = errorMessage {
                        AuthErrorBanner(message: error).transition(.opacity)
                    }

                    Button {
                        submitTapCount += 1
                        Task { await sendReset() }
                    } label: {
                        ZStack {
                            if loading {
                                ProgressView().tint(.black)
                            } else {
                                Text("Send Reset Link")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundStyle(.black)
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .background(RoundedRectangle(cornerRadius: 30).fill(.white))
                    }
                    .buttonStyle(.plain)
                    .disabled(loading || email.isEmpty)
                    .opacity((loading || email.isEmpty) ? 0.4 : 1.0)
                }
                .padding(.bottom, 32)

                HStack(spacing: 0) {
                    Spacer()
                    Text("Remember your password? ")
                        .font(.system(size: 14))
                        .foregroundStyle(.white.opacity(0.4))
                    Button {
                        dismiss()
                    } label: {
                        Text("Sign In")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color(hex: 0x00BFA5))
                    }
                    .buttonStyle(.plain)
                    .disabled(loading)
                    Spacer()
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)
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
                    .fill(Color(hex: 0x00BFA5).opacity(0.12))
                    .frame(width: 96, height: 96)
                Image(systemName: "envelope.badge")
                    .font(.system(size: 44))
                    .foregroundStyle(Color(hex: 0x00BFA5))
                    .symbolEffect(.bounce, value: success)
            }
            .padding(.bottom, 28)

            Text("Check Your Email")
                .font(.system(size: 28, weight: .heavy))
                .foregroundStyle(.white)
                .padding(.bottom, 16)

            Text("We've sent a password reset link to:")
                .font(.system(size: 16))
                .foregroundStyle(.white.opacity(0.5))
                .multilineTextAlignment(.center)
                .padding(.bottom, 8)

            Text(submittedEmail)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color(hex: 0x00BFA5))
                .padding(.bottom, 12)

            Text("Please check your email and follow the instructions to reset your password.")
                .font(.system(size: 16))
                .foregroundStyle(.white.opacity(0.5))
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.bottom, 24)

            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "info.circle")
                    .font(.system(size: 14))
                    .foregroundStyle(.white.opacity(0.4))
                Text("If you don't see the email, check your spam folder.")
                    .font(.system(size: 14))
                    .foregroundStyle(.white.opacity(0.4))
            }
            .padding(.bottom, 24)

            Button {
                dismiss()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.black)
                    Text("Back to Login")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(.black)
                }
                .frame(maxWidth: .infinity, minHeight: 54)
                .background(RoundedRectangle(cornerRadius: 30).fill(.white))
            }
            .buttonStyle(.plain)

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
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(Circle().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
        // Visual stays 40pt; tap area expands to 44pt (matches RN hitSlop).
        .contentShape(Rectangle())
        .frame(minWidth: 44, minHeight: 44)
        .disabled(loading)
        .accessibilityLabel("Back")
    }

    private var logo: some View {
        HStack {
            Spacer()
            // FIDELITY-WAIVER #004: wagerproofGreenDark.png asset not yet imported.
            HStack(spacing: 8) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Color(hex: 0x00BFA5))
                Text("WagerProof")
                    .font(.system(size: 26, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(height: 50)
            Spacer()
        }
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
