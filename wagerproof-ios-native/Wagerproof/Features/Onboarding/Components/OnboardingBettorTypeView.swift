// OnboardingBettorTypeView.swift
//
// Step 5: bettor type chip list. Port of `Step4_BettorType.tsx`.
//
// Chrome (back chevron / progress bar / Liquid Glass CTA) lives in
// `OnboardingPageShell`. CTA stays disabled until the user picks an option.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingBettorTypeView: View {
    @Environment(OnboardingStore.self) private var store

    @State private var selected: OnboardingStore.BettorType?

    private struct Option: Identifiable {
        let id: OnboardingStore.BettorType
        let title: String
        let detail: String
    }

    private let options: [Option] = [
        .init(id: .casual, title: "Casual", detail: "Occasional bets"),
        .init(id: .serious, title: "Serious", detail: "Research lines and trends"),
        .init(id: .professional, title: "Professional", detail: "Track units and ROI")
    ]

    var body: some View {
        OnboardingPageShell(
            progress: Double(store.currentStep.rawValue) / Double(OnboardingStep.allCases.count),
            continueTitle: "Continue",
            isCTAEnabled: selected != nil && !store.isTransitioning,
            isCTALoading: store.isTransitioning,
            canGoBack: store.currentStep.rawValue > 1,
            background: { Color.clear },
            content: {
                ScrollView {
                    VStack(spacing: 16) {
                        Text("What kind of bettor are you?")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                            .padding(.top, 16)
                            .padding(.horizontal, 24)
                            .padding(.bottom, 8)

                        ForEach(options) { option in
                            OptionCard(
                                title: option.title,
                                detail: option.detail,
                                isSelected: selected == option.id
                            ) {
                                selected = option.id
                            }
                            .padding(.horizontal, 24)
                        }
                        // Shell owns bottom-edge spacing; no Spacer needed.
                    }
                }
                .sensoryFeedback(.selection, trigger: selected)
            },
            onContinue: {
                guard let s = selected else { return }
                store.setBettorType(s)
                store.advance()
            },
            onBack: { store.back() }
        )
    }
}

struct OptionCard: View {
    let title: String
    let detail: String?
    let isSelected: Bool
    let action: () -> Void

    init(title: String, detail: String? = nil, isSelected: Bool, action: @escaping () -> Void) {
        self.title = title
        self.detail = detail
        self.isSelected = isSelected
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Text(title)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(.white)
                if let detail {
                    Text(detail)
                        .font(.system(size: 14))
                        .foregroundStyle(Color.white.opacity(0.6))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .padding(.horizontal, 12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(isSelected ? Color.appPrimary.opacity(0.22) : Color.white.opacity(0.06))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(isSelected ? Color.appPrimary : Color.white.opacity(0.15), lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }
}
