// OnboardingTermsPage.swift
//
// Page 1: Terms acceptance. First screen of onboarding (v2 killed the
// welcome interstitial). Behaviour:
//   1. ScrollView holds the full terms text.
//   2. User must scroll to the bottom before the checkbox arms.
//   3. The checkbox copy folds in the 18+ attestation (the redesign removed
//      the separate age page) — ticking it enables the shared chrome's CTA
//      via `OnboardingStore.canAdvance(.terms)`; the CTA's continue action
//      stamps `termsAcceptedAt` + `overEighteenAttested`.
//
// Scroll/checkbox state lives on the store (not view @State) so the pager's
// windowed unmounting can't force a re-scroll.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingTermsPage: View {
    @Environment(OnboardingStore.self) private var store

    var body: some View {
        VStack(spacing: 0) {
            Text("Terms and Conditions")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(.white)
                .padding(.top, 12)
                .padding(.bottom, 12)
                .pageEntrance(index: 0)

            Text("Please read through our terms and conditions before continuing")
                .font(.system(size: 16))
                .foregroundStyle(Color.white.opacity(0.8))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
                .pageEntrance(index: 1)

            if !store.hasScrolledTermsToBottom {
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
                .transition(.opacity)
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
                    // bottom. `onAppear` on the last element works across
                    // reduced-motion users.
                    Color.clear
                        .frame(height: 1)
                        .onAppear { store.setTermsScrolledToBottom() }
                }
                .padding(16)
            }
            .liquidGlassBackground(
                in: RoundedRectangle(cornerRadius: 12, style: .continuous),
                tint: Color.white.opacity(0.05)
            )
            .padding(.horizontal, 24)
            .padding(.vertical, 16)
            .pageEntrance(index: 2)

            Button {
                store.setTermsChecked(!store.hasCheckedTerms)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: store.hasCheckedTerms ? "checkmark.square.fill" : "square")
                        .font(.system(size: 24))
                        .foregroundStyle(
                            store.hasScrolledTermsToBottom ? Color.appPrimary : Color.gray
                        )

                    Text("I have read and agree to the Terms and Conditions, and confirm I am 18 or older")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.white.opacity(0.9))
                        .multilineTextAlignment(.leading)
                        .opacity(store.hasScrolledTermsToBottom ? 1 : 0.7)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(OnboardingPressStyle())
            .padding(.horizontal, 24)
            .padding(.bottom, 8)
            .pageEntrance(index: 3)
            .sensoryFeedback(.success, trigger: store.hasCheckedTerms)
        }
        .animation(.appQuick, value: store.hasScrolledTermsToBottom)
    }
}

private struct TermsSection {
    let title: String
    let paragraphs: [String]
}

// Verbatim legal copy (matches the shipped RN terms). **Bold** markdown is
// rendered by `Text(.init(...))`.
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
