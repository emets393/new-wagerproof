// OnboardingAgeView.swift
//
// Step 4: age input + 18+ gate. Port of `Step3_AgeConfirmation.tsx`.
// Behaviour preserved: parses numeric age, validates >= 18, shows inline
// error otherwise. Continue is disabled until something is typed.
//
// Chrome (back chevron / progress bar / Liquid Glass CTA) lives in
// `OnboardingPageShell`; the CTA is the validation surface. On tap it calls
// `submit()` which still owns the >=18 check + inline-error rendering.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingAgeView: View {
    @Environment(OnboardingStore.self) private var store

    @State private var ageText: String = ""
    @State private var error: String?

    private var parsed: Int? { Int(ageText) }

    var body: some View {
        OnboardingPageShell(
            progress: Double(store.currentStep.rawValue) / Double(OnboardingStep.allCases.count),
            continueTitle: "Continue",
            // Gate the CTA on a real parsed age >= 18. Previously we only
            // checked `!ageText.isEmpty`, so the user could type "0" and
            // tap Continue before the inline error surfaced.
            isCTAEnabled: (parsed ?? 0) >= 18 && !store.isTransitioning,
            isCTALoading: store.isTransitioning,
            canGoBack: store.currentStep.rawValue > 1,
            background: { Color.clear },
            content: {
                ScrollView {
                    VStack(spacing: 16) {
                        Text("Confirm your age")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.top, 16)

                        Text("WagerProof provides analytics for educational use only. You must be 18+ to continue.")
                            .font(.system(size: 16))
                            .foregroundStyle(Color.white.opacity(0.7))
                            .multilineTextAlignment(.center)
                            .lineSpacing(4)
                            .padding(.horizontal, 24)

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Age")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Color.white.opacity(0.7))
                            TextField("", text: $ageText, prompt: Text("Enter your age").foregroundColor(Color.white.opacity(0.4)))
                                .keyboardType(.numberPad)
                                .textContentType(.none)
                                .font(.system(size: 16))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 12)
                                .background(
                                    RoundedRectangle(cornerRadius: 12)
                                        .fill(Color.white.opacity(0.08))
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .strokeBorder(error != nil ? Color.appLoss : Color.white.opacity(0.2), lineWidth: 1)
                                )
                                .onChange(of: ageText) { _, _ in error = nil }

                            if let error {
                                Text(error)
                                    .font(.system(size: 13))
                                    .foregroundStyle(Color.appLoss)
                            }
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 12)
                        // Shell owns bottom-edge spacing; no Spacer needed.
                    }
                }
                .scrollDismissesKeyboard(.immediately)
                .sensoryFeedback(.error, trigger: error)
            },
            onContinue: { submit() },
            onBack: { store.back() }
        )
    }

    private func submit() {
        guard let age = parsed, age >= 18 else {
            error = "You must be 18 or older to continue."
            return
        }
        store.setAge(age)
        store.advance()
    }
}
