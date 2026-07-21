// CustomPaywallView.swift
//
// Fully custom SwiftUI checkout. RevenueCat remains the source of truth for
// offerings, localized prices, trial eligibility, purchases, restores, and the
// WagerProof Pro entitlement. The visual hierarchy is intentionally product-led:
// one flexible feature hero, compact plans, and one branded purchase action.

import RevenueCat
import SwiftUI
import WagerproofDesign
import WagerproofServices

struct CustomPaywallView: View {
    let offering: Offering
    let allowClose: Bool
    let source: String
    let accent: Color
    let agentName: String
    let spriteIndex: Int
    let researchBucketRaw: String?
    let stakesBucketRaw: String?
    let onPurchaseFinalized: (StoreTransaction?, CustomerInfo) -> Void
    let onRequestClose: () -> Void
    /// Secret-Settings debug preview flag. When true, the close control renders
    /// as a bright red DEBUG button so a tester can escape the otherwise-hard
    /// onboarding paywall and see at a glance that it's a debug invocation, not
    /// the real gate. Requires `allowClose` (the host forces it on in debug).
    var debugClose: Bool = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    @State private var selected: Package?
    @State private var trialEligibility: [String: IntroEligibilityStatus] = [:]
    @State private var isPurchasing = false
    @State private var isRestoring = false
    @State private var errorMessage: String?
    @State private var infoMessage: String?
    @State private var didTrackPresented = false

    private struct DisplayPlan: Identifiable {
        let package: Package
        let name: String
        var id: String { package.identifier }
    }

    // MARK: - Package resolution

    /// RevenueCat package `lookup_key` for the pay-up-front intro annual
    /// (`rc_ios_pro_yearly_intro`: $19.99 first month, then $99.99/yr).
    private var introPackageIdentifier: String { "yearly_intro" }

    /// Remote-config switch (offering metadata `entry_offer`) that swaps the
    /// second ("entry") plan card between the recurring monthly plan and the
    /// pay-up-front intro annual. Absent/unknown value = `monthly` (no change),
    /// so the paywall is unaffected until the offering metadata opts in.
    private enum EntryOffer: String { case monthly, introAnnual = "intro_annual" }
    private var entryOffer: EntryOffer {
        guard let raw = offering.metadata["entry_offer"] as? String,
              let value = EntryOffer(rawValue: raw) else { return .monthly }
        return value
    }

    private func package(_ identifier: String) -> Package? {
        offering.availablePackages.first { $0.identifier == identifier }
    }

    private var monthlyPackage: Package? {
        package("$rc_monthly")
            ?? package("$rc_monthly_discount")
            ?? offering.availablePackages.first { $0.packageType == .monthly }
    }

    private var introPackage: Package? { package(introPackageIdentifier) }

    /// RevenueCat exposes two yearly packages in the onboarding offering. The
    /// discounted yearly package has no free trial and is the intended default
    /// for this checkout. Fail closed to another non-trial annual package rather
    /// than silently presenting the trial-backed annual product. The intro
    /// annual is excluded here — it only ever fills the entry slot below, never
    /// the headline Yearly card.
    private var annualPackage: Package? {
        let annualCandidates = offering.availablePackages.filter {
            $0.identifier != introPackageIdentifier
                && ($0.packageType == .annual
                    || $0.identifier == "$rc_yearly_discount"
                    || $0.identifier == "$rc_annual")
        }
        return annualCandidates.first {
            $0.identifier == "$rc_yearly_discount" && !hasFreeTrialOffer($0)
        } ?? annualCandidates.first(where: { !hasFreeTrialOffer($0) })
    }

    /// Second ("entry") plan slot. Remotely toggled between the standard monthly
    /// plan and the intro annual. Falls back to monthly when the intro package
    /// is missing or the shopper is a returning customer RevenueCat has flagged
    /// ineligible for the intro price — never strand them on an intro they can't get.
    private var entryPackage: Package? {
        if entryOffer == .introAnnual,
           let introPackage,
           introDisplayEligible(introPackage) {
            return introPackage
        }
        return monthlyPackage
    }

    private var entryPlanName: String {
        entryPackage?.identifier == introPackageIdentifier ? "1st Month" : "Monthly"
    }

    /// Yearly leads because it is the recommended and preselected plan.
    private var plans: [DisplayPlan] {
        var result: [DisplayPlan] = []
        if let annualPackage { result.append(.init(package: annualPackage, name: "Yearly")) }
        if let entryPackage { result.append(.init(package: entryPackage, name: entryPlanName)) }
        return result
    }

    // MARK: - Trial eligibility

    private func hasFreeTrialOffer(_ package: Package) -> Bool {
        package.storeProduct.introductoryDiscount?.paymentMode == .freeTrial
    }

    /// An introductory offer on the product is not enough. Returning customers
    /// can be ineligible, so trial copy only appears after RevenueCat confirms it.
    private func hasEligibleFreeTrial(_ package: Package) -> Bool {
        hasFreeTrialOffer(package)
            && trialEligibility[package.storeProduct.productIdentifier] == .eligible
    }

    /// Non-nil when the package carries a pay-up-front introductory offer
    /// (e.g. $19.99 for the first month, then the standard renewal price).
    private func payUpFrontIntro(_ package: Package) -> StoreProductDiscount? {
        guard let intro = package.storeProduct.introductoryDiscount,
              intro.paymentMode == .payUpFront else { return nil }
        return intro
    }

    /// Show the intro price unless RevenueCat has explicitly reported the shopper
    /// as ineligible (returning customers). Unknown / not-yet-loaded counts as
    /// eligible — the post-onboarding audience is overwhelmingly new users and we
    /// don't want a one-frame monthly→intro swap while eligibility resolves.
    private func introDisplayEligible(_ package: Package) -> Bool {
        switch trialEligibility[package.storeProduct.productIdentifier] {
        case .ineligible, .noIntroOfferExists: return false
        default: return true
        }
    }

    /// "first month" / "first 3 months" for a pay-up-front intro's prepaid span.
    private func introDurationPhrase(_ intro: StoreProductDiscount) -> String {
        let unit = unitName(intro.subscriptionPeriod.unit, value: intro.subscriptionPeriod.value)
        return intro.subscriptionPeriod.value == 1
            ? "first \(unit)"
            : "first \(intro.subscriptionPeriod.value) \(unit)"
    }

    private var selectedTrial: (value: Int, unit: String)? {
        guard let selected,
              hasEligibleFreeTrial(selected),
              let intro = selected.storeProduct.introductoryDiscount else { return nil }
        return (
            intro.subscriptionPeriod.value,
            unitName(intro.subscriptionPeriod.unit, value: intro.subscriptionPeriod.value)
        )
    }

    private func loadTrialEligibility() async {
        // Check both free-trial and pay-up-front intro packages — returning
        // customers are ineligible for either, and the entry card must fall back
        // to the standard monthly plan for them.
        let products = plans
            .map(\.package)
            .filter { hasFreeTrialOffer($0) || payUpFrontIntro($0) != nil }
            .map { $0.storeProduct.productIdentifier }
        guard !products.isEmpty else { return }

        let result = await Purchases.shared.checkTrialOrIntroDiscountEligibility(
            productIdentifiers: products
        )
        var statuses: [String: IntroEligibilityStatus] = [:]
        for (identifier, eligibility) in result {
            statuses[identifier] = eligibility.status
        }
        trialEligibility = statuses
    }

    private func zeroPriceString(for package: Package) -> String {
        package.storeProduct.priceFormatter?.string(from: 0) ?? "$0.00"
    }

    // MARK: - Price presentation

    private var ctaTitle: String {
        guard let selected else { return "Choose a plan" }
        return selectedTrial == nil
            ? "Continue"
            : "Continue for \(zeroPriceString(for: selected))"
    }

    private var billingLine: String {
        guard let selected else { return "Choose a plan to continue" }
        let price = selected.storeProduct.localizedPriceString
        let period = billingPeriod(for: selected.storeProduct)
        // Pay-up-front intro ($19.99 for the first month, then $99.99 per year).
        if let intro = payUpFrontIntro(selected), introDisplayEligible(selected) {
            return "\(intro.localizedPriceString) for your \(introDurationPhrase(intro)), then \(price) per \(period)"
        }
        if let trial = selectedTrial {
            return "\(trial.value) \(trial.unit) free, then \(price) per \(period)"
        }
        return "\(price) per \(period)"
    }

    private func billingPeriod(for product: StoreProduct) -> String {
        guard let period = product.subscriptionPeriod else { return "purchase" }
        if period.value == 1 {
            return unitName(period.unit, value: 1)
        }
        return "\(period.value) \(unitName(period.unit, value: period.value))"
    }

    private func unitName(_ unit: SubscriptionPeriod.Unit, value: Int) -> String {
        let singular: String = switch unit {
        case .day: "day"
        case .week: "week"
        case .month: "month"
        case .year: "year"
        }
        return value == 1 ? singular : "\(singular)s"
    }

    private func perMonthString(_ product: StoreProduct) -> String? {
        guard let period = product.subscriptionPeriod,
              let formatter = product.priceFormatter else { return nil }
        let months: Decimal = switch period.unit {
        case .day: Decimal(period.value) / Decimal(string: "30.4375")!
        case .week: Decimal(period.value) / Decimal(string: "4.345")!
        case .month: Decimal(period.value)
        case .year: Decimal(period.value * 12)
        }
        guard months > 0 else { return nil }
        return formatter.string(from: NSDecimalNumber(decimal: product.price / months))
    }

    private func annualizedPrice(_ product: StoreProduct) -> Decimal? {
        guard let period = product.subscriptionPeriod, period.value > 0 else { return nil }
        let value = Decimal(period.value)
        return switch period.unit {
        case .day: product.price / value * 365
        case .week: product.price / value * 52
        case .month: product.price / value * 12
        case .year: product.price / value
        }
    }

    private var annualSavingsPercent: Int? {
        guard let annualPackage,
              let monthlyPackage,
              let annualized = annualizedPrice(annualPackage.storeProduct),
              let monthlyAnnualized = annualizedPrice(monthlyPackage.storeProduct),
              monthlyAnnualized > 0 else { return nil }
        let fraction = (monthlyAnnualized - annualized) / monthlyAnnualized
        let percent = Int((NSDecimalNumber(decimal: fraction).doubleValue * 100).rounded())
        return percent > 0 ? percent : nil
    }

    // MARK: - Body

    var body: some View {
        GeometryReader { geometry in
            let compactPortrait = geometry.size.height < 820

            ZStack {
                background

                if dynamicTypeSize.isAccessibilitySize {
                    accessibilityCheckout
                } else {
                    checkout(compactHeight: compactPortrait)
                }
            }
        }
        .preferredColorScheme(.dark)
        .sensoryFeedback(.selection, trigger: selected?.identifier)
        .task(id: offering.identifier) {
            await loadTrialEligibility()
        }
        .onAppear {
            if selected == nil {
                selected = annualPackage ?? monthlyPackage ?? plans.first?.package
            }
            guard !didTrackPresented else { return }
            didTrackPresented = true
            AnalyticsService.shared.track("paywall_presented", properties: [
                "source": source,
                "variant": "custom_v2_product_hero",
                "plans": plans.map(\.name).joined(separator: ","),
                "research_time_bucket": researchBucketRaw ?? "none",
            ])
        }
        .alert("Something went wrong", isPresented: .init(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .alert("Restore Purchases", isPresented: .init(
            get: { infoMessage != nil },
            set: { if !$0 { infoMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(infoMessage ?? "")
        }
    }

    private var background: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: 0x07110B), Color(hex: 0x090C0A), Color(hex: 0x050706)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                colors: [accent.opacity(0.18), Color.clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 320
            )

            PixelDotBackground(
                animation: .aurora,
                baseColor: .white,
                accentColor: accent,
                spacing: 29,
                dotSize: 4.2,
                baseOpacity: 0.012,
                peakOpacity: 0.20,
                speed: 0.42,
                edgeFade: true,
                isPaused: reduceMotion
            )
            .opacity(0.72)

            LinearGradient(
                colors: [Color.clear, Color.black.opacity(0.12), Color.black.opacity(0.48)],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        .ignoresSafeArea()
    }

    private func checkout(compactHeight: Bool) -> some View {
        VStack(spacing: 0) {
            topBar
                .padding(.horizontal, 18)
                .padding(.top, 4)

            if verticalSizeClass == .compact {
                HStack(spacing: 18) {
                    PaywallValueCarousel(
                        accent: accent,
                        agentName: agentName,
                        spriteIndex: spriteIndex,
                        researchBucketRaw: researchBucketRaw,
                        stakesBucketRaw: stakesBucketRaw,
                        compactHeight: true
                    )

                    ScrollView {
                        plansAndCTA(compact: true)
                            .padding(.vertical, 6)
                    }
                    .scrollBounceBehavior(.basedOnSize)
                    .frame(width: 370)
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 8)
            } else if compactHeight {
                PaywallValueCarousel(
                    accent: accent,
                    agentName: agentName,
                    spriteIndex: spriteIndex,
                    researchBucketRaw: researchBucketRaw,
                    stakesBucketRaw: stakesBucketRaw,
                    compactHeight: true
                )
                .frame(maxHeight: .infinity)
                .layoutPriority(1)

                // Keep the purchase decision anchored while individual
                // feature slides handle any compact-height overflow.
                plansAndCTA(compact: true)
                    .padding(.horizontal, 18)
                    .padding(.bottom, 10)
            } else {
                PaywallValueCarousel(
                    accent: accent,
                    agentName: agentName,
                    spriteIndex: spriteIndex,
                    researchBucketRaw: researchBucketRaw,
                    stakesBucketRaw: stakesBucketRaw,
                    compactHeight: compactHeight
                )
                .frame(maxHeight: .infinity)

                plansAndCTA(compact: compactHeight)
                    .padding(.horizontal, 18)
                    .padding(.bottom, 7)
            }
        }
        .frame(maxWidth: horizontalSizeClass == .regular ? 640 : .infinity)
        .frame(maxWidth: .infinity)
    }

    /// Accessibility sizes get a scroll escape hatch so larger text never clips.
    private var accessibilityCheckout: some View {
        ScrollView {
            VStack(spacing: 0) {
                topBar
                    .padding(.horizontal, 18)
                    .padding(.top, 4)

                PaywallValueCarousel(
                    accent: accent,
                    agentName: agentName,
                    spriteIndex: spriteIndex,
                    researchBucketRaw: researchBucketRaw,
                    stakesBucketRaw: stakesBucketRaw,
                    compactHeight: false
                )
                .frame(height: 590)

                plansAndCTA(compact: false)
                    .padding(.horizontal, 18)
                    .padding(.bottom, 10)
            }
            .frame(maxWidth: horizontalSizeClass == .regular ? 640 : .infinity)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(spacing: 8) {
            HStack(spacing: 0) {
                Text("Wager")
                    .foregroundStyle(Color.white.opacity(0.92))
                Text("Proof")
                    .foregroundStyle(accent)
                    .shimmering(active: !reduceMotion)
            }
            .font(.system(size: 16, weight: .black, design: .rounded))

            Text("PRO")
                .font(.system(size: 9, weight: .heavy, design: .monospaced))
                .tracking(0.7)
                .foregroundStyle(.black)
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(Capsule().fill(accent))

            Spacer()

            if allowClose {
                Button {
                    AnalyticsService.shared.track("paywall_dismissed", properties: [
                        "source": source,
                        "variant": "custom_v2_product_hero",
                        "result": debugClose ? "debug_closed" : "closed",
                    ])
                    onRequestClose()
                } label: {
                    if debugClose {
                        debugCloseLabel
                    } else {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Color.appTextSecondary)
                            .frame(width: 44, height: 44)
                            .contentShape(Circle())
                            .liquidGlassBackground(in: Circle(), tint: Color.white.opacity(0.06), interactive: true)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(debugClose ? "Close debug paywall" : "Close paywall")
            } else {
                Color.clear.frame(width: 44, height: 44)
            }
        }
        .frame(height: 44)
    }

    /// Bright red DEBUG close pill — only rendered when the paywall is presented
    /// from Secret Settings. Deliberately loud so a tester can never mistake a
    /// debug run for the real hard onboarding gate (which has no close button).
    private var debugCloseLabel: some View {
        HStack(spacing: 5) {
            Image(systemName: "xmark")
                .font(.system(size: 12, weight: .heavy))
            Text("DEBUG")
                .font(.system(size: 11, weight: .heavy, design: .monospaced))
                .tracking(0.5)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 12)
        .frame(height: 34)
        .background(Capsule().fill(Color.red))
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.55), lineWidth: 1))
    }

    // MARK: - Plans and CTA

    @ViewBuilder
    private func plansAndCTA(compact: Bool) -> some View {
        if plans.isEmpty {
            unavailablePlans
        } else {
            VStack(spacing: compact ? 9 : 12) {
                planRow(compact: compact)

                HStack(spacing: 6) {
                    Image(systemName: "checkmark.shield.fill")
                        .foregroundStyle(accent)
                    Text("No commitment - Cancel anytime")
                }
                .font(.system(size: compact ? 10.5 : 11.5, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .accessibilityElement(children: .combine)

                PaywallPurchaseButton(
                    title: ctaTitle,
                    subtitle: billingLine,
                    loading: isPurchasing,
                    enabled: selected != nil && !isPurchasing && !isRestoring,
                    accent: accent,
                    reduceMotion: reduceMotion
                ) {
                    Task { await buy() }
                }

                footer
            }
        }
    }

    private var unavailablePlans: some View {
        VStack(spacing: 10) {
            Label("Subscription options unavailable", systemImage: "wifi.exclamationmark")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(Color.appTextPrimary)

            Text("We couldn't load the Monthly or non-trial Yearly plan.")
                .font(.system(size: 11.5, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)

            Button("Continue without subscription") {
                AnalyticsService.shared.track("paywall_dismissed", properties: [
                    "source": source,
                    "variant": "custom_v2_product_hero",
                    "result": "plans_unavailable",
                ])
                onRequestClose()
            }
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(accent, in: RoundedRectangle(cornerRadius: 15, style: .continuous))

            footer
        }
        .padding(14)
        .background(Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
        )
    }

    private func planRow(compact: Bool) -> some View {
        HStack(spacing: 10) {
            ForEach(plans) { plan in
                planCard(plan, compact: compact)
            }
        }
        .padding(.top, 8)
    }

    private func planCard(_ plan: DisplayPlan, compact: Bool) -> some View {
        let isSelected = selected?.identifier == plan.id
        let product = plan.package.storeProduct
        let hasTrial = hasEligibleFreeTrial(plan.package)
        let intro = payUpFrontIntro(plan.package)
        let showIntro = intro != nil && introDisplayEligible(plan.package)
        let isAnnual = plan.package.identifier == annualPackage?.identifier
        let shape = RoundedRectangle(cornerRadius: 17, style: .continuous)

        return Button {
            withAnimation(.smooth(duration: 0.2)) {
                selected = plan.package
            }
            AnalyticsService.shared.track("paywall_plan_selected", properties: [
                "plan": plan.name.lowercased(),
                "product_id": product.productIdentifier,
                "source": source,
            ])
        } label: {
            VStack(spacing: compact ? 2 : 4) {
                HStack(spacing: 5) {
                    Text(plan.name)
                        .font(.system(size: compact ? 13 : 15, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.appTextPrimary)
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(accent)
                    }
                }

                Text((showIntro ? intro?.localizedPriceString : nil) ?? product.localizedPriceString)
                    .font(.system(size: compact ? 19 : 22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                if showIntro {
                    // e.g. "then $99.99/year" under the $19.99 first-month price.
                    Text("then \(product.localizedPriceString)/\(billingPeriod(for: product))")
                        .foregroundStyle(accent)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                } else if isAnnual, let monthly = perMonthString(product) {
                    HStack(spacing: 4) {
                        Text("\(monthly)/mo")
                        if let savings = annualSavingsPercent {
                            Text("• Save \(savings)%")
                                .foregroundStyle(accent)
                        }
                    }
                } else {
                    Text("per \(billingPeriod(for: product))")
                }
            }
            .font(.system(size: compact ? 10.5 : 12, weight: .medium))
            .foregroundStyle(Color.appTextSecondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, compact ? 10 : 13)
            .background(shape.fill(Color.white.opacity(isSelected ? 0.12 : 0.045)))
            .overlay(
                shape.strokeBorder(
                    isSelected ? accent : Color.white.opacity(0.12),
                    lineWidth: isSelected ? 2 : 1
                )
            )
            .overlay(alignment: .top) {
                if isAnnual, let savings = annualSavingsPercent {
                    planRibbon("SAVE \(savings)%")
                        .offset(y: -9)
                } else if showIntro {
                    planRibbon("INTRO OFFER")
                        .offset(y: -9)
                } else if hasTrial, let trialIntro = product.introductoryDiscount {
                    planRibbon(
                        "\(trialIntro.subscriptionPeriod.value) \(unitName(trialIntro.subscriptionPeriod.unit, value: trialIntro.subscriptionPeriod.value).uppercased()) FREE"
                    )
                    .offset(y: -9)
                }
            }
            .shadow(color: isSelected ? accent.opacity(0.20) : .clear, radius: 12, y: 5)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(planAccessibilityLabel(plan, selected: isSelected, trial: hasTrial))
    }

    private func planRibbon(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 9, weight: .heavy, design: .monospaced))
            .tracking(0.4)
            .foregroundStyle(.black)
            .padding(.horizontal, 9)
            .padding(.vertical, 3)
            .background(Capsule().fill(Color.appAccentAmber))
            .shadow(color: Color.appAccentAmber.opacity(0.3), radius: 5, y: 2)
            .fixedSize()
    }

    private func planAccessibilityLabel(_ plan: DisplayPlan, selected: Bool, trial: Bool) -> String {
        let product = plan.package.storeProduct
        var label: String
        if let intro = payUpFrontIntro(plan.package), introDisplayEligible(plan.package) {
            label = "\(plan.name), \(intro.localizedPriceString) for the \(introDurationPhrase(intro)), then \(product.localizedPriceString) per \(billingPeriod(for: product))"
        } else {
            label = "\(plan.name), \(product.localizedPriceString) per \(billingPeriod(for: product))"
        }
        if trial { label += ", includes an eligible free trial" }
        if selected { label += ", selected" }
        return label
    }

    // MARK: - Footer

    private var footer: some View {
        HStack(spacing: 14) {
            Button {
                Task { await restore() }
            } label: {
                if isRestoring {
                    ProgressView().tint(.white).scaleEffect(0.7)
                } else {
                    Text("Restore")
                }
            }
            .disabled(isRestoring || isPurchasing)

            Text("·").foregroundStyle(Color.appTextMuted.opacity(0.5))
            Link("Terms", destination: URL(string: "https://wagerproof.bet/terms-and-conditions")!)
            Text("·").foregroundStyle(Color.appTextMuted.opacity(0.5))
            Link("Privacy", destination: URL(string: "https://wagerproof.bet/privacy-policy")!)
        }
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(Color.appTextSecondary)
    }

    // MARK: - Purchase and restore

    private func buy() async {
        guard let selected, !isPurchasing else { return }
        let product = selected.storeProduct
        let baseProperties: [String: String] = [
            "source": source,
            "variant": "custom_v2_product_hero",
            "plan": plans.first(where: { $0.id == selected.identifier })?.name.lowercased() ?? selected.identifier,
            "product_id": product.productIdentifier,
        ]
        AnalyticsService.shared.track("paywall_checkout_started", properties: baseProperties)
        isPurchasing = true

        do {
            let result = try await Purchases.shared.purchase(package: selected)
            isPurchasing = false
            if result.userCancelled {
                AnalyticsService.shared.track("paywall_purchase_cancelled", properties: baseProperties)
                return
            }

            guard result.customerInfo.entitlements.active[RevenueCatService.entitlementIdentifier] != nil else {
                var properties = baseProperties
                properties["error"] = "missing_entitlement_after_purchase"
                AnalyticsService.shared.track("paywall_purchase_failed", properties: properties)
                errorMessage = "Your purchase completed, but Pro access is still syncing. Tap Restore Purchases to refresh it."
                return
            }

            var properties = baseProperties
            properties["price"] = "\(product.price)"
            properties["currency"] = product.currencyCode ?? "USD"
            properties["is_trial"] = selectedTrial != nil ? "true" : "false"
            AnalyticsService.shared.track("paywall_converted", properties: properties)
            onPurchaseFinalized(result.transaction, result.customerInfo)
        } catch {
            isPurchasing = false
            let revenueCatError = (error as NSError).asErrorCode
            if revenueCatError == .purchaseCancelledError {
                AnalyticsService.shared.track("paywall_purchase_cancelled", properties: baseProperties)
                return
            }
            var properties = baseProperties
            properties["error"] = error.localizedDescription
            AnalyticsService.shared.track("paywall_purchase_failed", properties: properties)
            switch revenueCatError {
            case .paymentPendingError:
                errorMessage = "Your purchase is pending approval. Pro will unlock automatically when the App Store completes it."
            case .storeProblemError:
                errorMessage = "We couldn't confirm the purchase status. Check your App Store subscriptions or tap Restore before trying again."
            default:
                errorMessage = "The purchase couldn't be completed. You haven't been charged. \(error.localizedDescription)"
            }
        }
    }

    private func restore() async {
        guard !isRestoring else { return }
        AnalyticsService.shared.track("paywall_restore_tapped", properties: ["source": source])
        isRestoring = true

        do {
            let customerInfo = try await Purchases.shared.restorePurchases()
            isRestoring = false
            if customerInfo.entitlements.active[RevenueCatService.entitlementIdentifier] != nil {
                AnalyticsService.shared.track("paywall_restore_completed", properties: [
                    "source": source,
                    "became_pro": "true",
                ])
                onPurchaseFinalized(nil, customerInfo)
            } else {
                AnalyticsService.shared.track("paywall_restore_completed", properties: [
                    "source": source,
                    "became_pro": "false",
                ])
                infoMessage = "No previous purchases found to restore."
            }
        } catch {
            isRestoring = false
            errorMessage = "Restore failed. \(error.localizedDescription)"
        }
    }
}

// MARK: - Branded purchase button

private struct PaywallPurchaseButton: View {
    let title: String
    let subtitle: String
    let loading: Bool
    let enabled: Bool
    let accent: Color
    let reduceMotion: Bool
    let action: () -> Void

    @State private var shimmer = false
    @State private var pulse = false

    var body: some View {
        Button(action: action) {
            ZStack {
                if loading {
                    ProgressView().tint(Color(hex: 0x04120A))
                } else {
                    VStack(spacing: 2) {
                        Text(title)
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                        Text(subtitle)
                            .font(.system(size: 10.5, weight: .semibold))
                            .opacity(0.76)
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                    }
                    .foregroundStyle(Color(hex: 0x04120A))
                    .padding(.horizontal, 44)

                    HStack {
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Color(hex: 0x04120A).opacity(0.78))
                            .accessibilityHidden(true)
                    }
                    .padding(.horizontal, 22)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 60)
            .background {
                ZStack {
                    LinearGradient(
                        colors: [accent, Color(hex: 0x8EF0B6), Color.appAccentAmber],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    if !reduceMotion {
                        GeometryReader { geometry in
                            LinearGradient(
                                colors: [.clear, .white.opacity(0.62), .clear],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                            .frame(width: geometry.size.width * 0.45)
                            .offset(x: shimmer ? geometry.size.width * 1.25 : -geometry.size.width * 0.7)
                            .blendMode(.screen)
                        }
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.3), lineWidth: 1)
            )
            .shadow(color: accent.opacity(0.48), radius: pulse ? 24 : 14, y: 6)
            .scaleEffect(pulse ? 1.01 : 1)
        }
        .buttonStyle(PaywallPressStyle())
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.58)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: 2.6).repeatForever(autoreverses: false)) {
                shimmer = true
            }
            withAnimation(.easeInOut(duration: 1.9).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
    }
}

private struct PaywallPressStyle: ButtonStyle {
    func makeBody(configuration: ButtonStyleConfiguration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}
