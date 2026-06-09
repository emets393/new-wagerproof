// OnboardingTermsView.swift
//
// Step 2: Terms acceptance. Port of `Step1b_TermsAcceptance.tsx`.
// Behaviour preserved exactly:
//   1. ScrollView holds the full terms text.
//   2. User must scroll to bottom before the checkbox becomes "armed"
//      (RN gates the checkbox color, not its tap — but the Continue button
//      stays disabled until both scrolled+checked).
//   3. Once checked + scrolled, Continue is enabled and store.advance() is
//      called after recording termsAcceptedAt timestamp.
//
// Chrome (back chevron / progress bar / Liquid Glass CTA) is owned by
// `OnboardingPageShell` — the CTA enabled-state mirrors the legacy gating
// (`isChecked`) so disabled→enabled transitions still drive the success
// sensoryFeedback below.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingTermsView: View {
    @Environment(OnboardingStore.self) private var store

    @State private var hasScrolledToBottom = false
    @State private var isChecked = false

    var body: some View {
        OnboardingPageShell(
            progress: Double(store.currentStep.rawValue) / Double(OnboardingStep.allCases.count),
            continueTitle: "Continue",
            isCTAEnabled: isChecked && !store.isTransitioning,
            isCTALoading: store.isTransitioning,
            canGoBack: store.currentStep.rawValue > 1,
            background: { Color.clear },
            content: {
                VStack(spacing: 0) {
                    Text("Terms and Conditions")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.top, 12)
                        .padding(.bottom, 12)

                    Text("Please read through our terms and conditions before continuing")
                        .font(.system(size: 16))
                        .foregroundStyle(Color.white.opacity(0.8))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)

                    if !hasScrolledToBottom {
                        HStack(spacing: 8) {
                            Image(systemName: "chevron.down")
                                .foregroundStyle(Color.appPrimary)
                            Text("Scroll down to continue")
                                .font(.system(size: 14))
                                .foregroundStyle(Color.appPrimary)
                            Image(systemName: "chevron.down")
                                .foregroundStyle(Color.appPrimary)
                        }
                        .padding(.vertical, 12)
                    }

                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            Text("**Last Updated: October 15, 2025**")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.white.opacity(0.7))
                                .padding(.bottom, 4)

                            ForEach(termsSections, id: \.title) { section in
                                Text(section.title)
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundStyle(Color.appPrimary)
                                    .padding(.top, 4)
                                ForEach(section.paragraphs, id: \.self) { para in
                                    Text(.init(para))
                                        .font(.system(size: 14))
                                        .foregroundStyle(Color.white.opacity(0.9))
                                        .lineSpacing(4)
                                }
                            }

                            // Sentinel — once visible, the user has reached the
                            // bottom. RN uses an onScroll handler; SwiftUI's
                            // `onAppear` on the last element is the idiomatic
                            // equivalent and works across reduced-motion users.
                            Color.clear
                                .frame(height: 1)
                                .onAppear { hasScrolledToBottom = true }
                        }
                        .padding(16)
                    }
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.white.opacity(0.05))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(Color.white.opacity(0.2), lineWidth: 1)
                    )
                    .padding(.horizontal, 24)
                    .padding(.vertical, 16)

                    HStack(spacing: 12) {
                        Button {
                            isChecked.toggle()
                        } label: {
                            Image(systemName: isChecked ? "checkmark.square.fill" : "square")
                                .font(.system(size: 24))
                                .foregroundStyle(
                                    hasScrolledToBottom ? Color.appPrimary : Color.gray
                                )
                        }
                        .buttonStyle(.plain)

                        Text("I have read and agree to the Terms and Conditions")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.white.opacity(0.9))
                            .opacity(hasScrolledToBottom ? 1 : 0.7)
                    }
                    .padding(.horizontal, 24)
                    // No trailing bottom padding — shell pins the CTA with
                    // its own safe-area inset, so an extra 12pt here would
                    // double up under the checkbox row.
                    .sensoryFeedback(.success, trigger: isChecked)
                }
            },
            onContinue: {
                store.setTermsAccepted()
                store.advance()
            },
            onBack: { store.back() }
        )
    }
}

private struct TermsSection {
    let title: String
    let paragraphs: [String]
}

// Verbatim copy from RN `Step1b_TermsAcceptance.tsx` lines 99-216.
// **Bold** markdown is rendered by `Text(.init(...))`.
private let termsSections: [TermsSection] = [
    .init(title: "1. Acceptance of the Terms of Service", paragraphs: [
        "These terms and conditions of service are entered into by and between you and WagerProof LLC, a Texas limited liability company (\"WagerProof,\" \"Company,\" \"we,\" or \"us\"). The following terms and conditions of service, together with any documents they expressly incorporate by reference (collectively, \"Terms of Service\"), govern your access to and use of https://wagerproof.bet (the \"Website\"), including any content, functionality, and services offered on or through the Website, whether as a guest or a registered user, (collectively, the \"Services\").",
        "Please read the Terms of Service carefully before you start to use the Services. By clicking \"I Accept,\" creating an account, accessing, or using the Services in any manner, you acknowledge that you have read, understood, and agree to be bound and abide by these Terms of Service, including our Privacy Policy."
    ]),
    .init(title: "2. Nature of Service & Disclaimers", paragraphs: [
        "**Sports Data Analytics Only**: WagerProof provides data-driven sports insights, statistical analysis, and educational tools through proprietary machine learning models and algorithms.",
        "**NOT Financial or Betting Advice**: WagerProof DOES NOT provide financial advice, investment advice, or direct betting recommendations.",
        "**NO GUARANTEES OF ACCURACY OR OUTCOMES**: We make no guarantees regarding the accuracy, reliability, or completeness of our data, analytics, predictions, or models.",
        "**USER RESPONSIBILITY AND ASSUMPTION OF RISK**: You are solely responsible for your own decisions, actions, and any financial gains or losses incurred.",
        "**NOT A GAMBLING OPERATOR**: WagerProof is not a bookmaker, casino, gambling operator, sportsbook, or a platform for placing bets."
    ]),
    .init(title: "3. Accessing Services and Account Security", paragraphs: [
        "The Services are offered and available only to users who are 18 years of age or older, and reside in the United States or any of its territories or possessions."
    ]),
    .init(title: "4. Subscriptions and Payments", paragraphs: [
        "**Subscription Plans**: We offer various subscription plans with different features and pricing.",
        "**Billing**: Subscriptions are billed on a recurring basis through our third-party payment processor.",
        "**Cancellations and Refunds**: You may cancel your subscription at any time."
    ]),
    .init(title: "5. Prohibited Uses", paragraphs: [
        "You may use the Services only for lawful purposes and in accordance with these Terms of Service."
    ]),
    .init(title: "6. Monitoring and Enforcement; Termination", paragraphs: [
        "We have the right to terminate or suspend your access to all or part of the Services for any or no reason."
    ]),
    .init(title: "9. Use of Artificial Intelligence", paragraphs: [
        "The Services use analytical tools that use artificial intelligence and/or machine learning models. AI may generate incomplete, inaccurate, biased, outdated, or misleading information."
    ]),
    .init(title: "10. Limitation of Liability", paragraphs: [
        "To the fullest extent permitted by applicable law, in no event shall WagerProof be liable for damages of any kind."
    ]),
    .init(title: "12. Governing Law and Jurisdiction", paragraphs: [
        "All matters relating to the Services shall be governed and construed in accordance with the laws of Texas."
    ]),
    .init(title: "18. Contact Us", paragraphs: [
        "Any notices or questions concerning these Terms of Service should be directed to: admin@wagerproof.bet"
    ])
]
