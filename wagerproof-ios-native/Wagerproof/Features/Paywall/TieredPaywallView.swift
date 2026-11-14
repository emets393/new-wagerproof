import SwiftUI
import StoreKit
import RevenueCat
import WagerproofDesign
import WagerproofServices
import WagerproofStores
import WagerproofModels

/// Reference-style tier comparison, kept alongside CustomPaywallView.
/// Preview prices never act as purchasable products. Only the exact dedicated
/// offering/package/product combination can reach RevenueCat checkout.
struct TieredPaywallView: View {
    var initialTier: PaywallTier = .pro
    var minimumTier: PaywallTier = .standard
    var preview = false
    var allowClose = true
    /// Only the onboarding host may opt into the first-picks hold.
    var showsPicksExpiry = false
    var source = "tiered_paywall"
    var placementID = RevenueCatService.Placement.genericFeature
    var offering: Offering?
    var onPurchaseFinalized: (StoreTransaction?, CustomerInfo) -> Void = { _, _ in }
    var onRequestClose: () -> Void = {}

    @Environment(AuthStore.self) private var auth
    @Environment(RevenueCatStore.self) private var revenueCat
    @Environment(ProAccessStore.self) private var proAccess
    @Environment(\.openURL) private var openURL
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @State private var tier: PaywallTier = .pro
    @State private var yearly = false
    @State private var busy = false
    @State private var loading = true
    @State private var message: String?
    @State private var storefrontIsUS = false
    @State private var awaitingBrowser = false
    @State private var picksWindow: PicksExpiryService.Window?
    @State private var purchaseFinalized = false

    private let features = TieredPaywallFeature.previewFeatures
    private var accent: LinearGradient {
        LinearGradient(colors: [.appPrimarySubtle, .appPrimary, .appPrimaryStrong], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
    private var selectedPackage: Package? { package(for: tier) }
    private var catalogReady: Bool {
        TieredPaywallConfiguration.enabled && offering?.identifier == TieredPaywallConfiguration.offeringID && offering?.metadata["tiered_catalog_ready"] as? Bool == true
    }
    private var webReady: Bool {
        guard catalogReady, offering?.metadata["tiered_hosted_web_ready"] as? Bool == true,
              hostedCheckoutURL != nil,
              let product = selectedPackage?.storeProduct else { return false }
        return product.currencyCode == "USD" && product.price == Decimal(tier.priceCents(yearly: yearly)) / 100
    }

    private var hostedCheckoutURL: URL? {
        guard RevenueCatService.shared.isConfigured,
              case .authenticated(let userID) = auth.phase else { return nil }
        return HostedTierCheckout.url(
            baseURL: offering?.metadata["tiered_hosted_web_url"] as? String,
            appUserID: Purchases.shared.appUserID,
            authenticatedUserID: userID
        )
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 26) {
                    header
                    planList.padding(.horizontal, 10)
                    featureComparison
                    tierCard.padding(.horizontal, 10)
                    reviews
                    if !preview && !loading && !catalogReady {
                        VStack(spacing: 16) {
                            Button("Retry loading plans") { Task { loading = true; await load() } }
                            Button("Continue without subscription", action: closeWithoutPurchase)
                        }
                        .font(.system(size: 14, weight: .semibold))
                    }
                    accountFooter
                }
                .padding(.bottom, 190)
                .frame(maxWidth: 640)
                .frame(maxWidth: .infinity)
            }
            .defaultScrollAnchor(previewScrollAnchor)
            .accessibilityIdentifier("tieredPaywall.scroll")
            checkoutFooter
        }
        .foregroundStyle(.white)
        .preferredColorScheme(.dark)
        .interactiveDismissDisabled(busy || !allowClose)
        .alert("WagerProof", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("OK", role: .cancel) { message = nil }
        } message: { Text(message ?? "") }
        .task {
            tier = initialTier.rawValue < minimumTier.rawValue ? minimumTier : initialTier
            if showsPicksExpiry && (preview || !proAccess.hasSubscription) {
                picksWindow = PicksExpiryService.shared.ensureWindow(pickCount: 3, agentName: "Your agent")
            }
            await load()
        }
        .task {
            try? await Task.sleep(for: .seconds(10))
            if !Task.isCancelled && loading && !preview {
                loading = false
                message = "Plans are taking longer than expected. You can retry or continue without a subscription."
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .inactive { startPicksActivity(reason: "app_inactive") }
            if phase == .active {
                Task {
                    storefrontIsUS = await StoreKit.Storefront.current?.countryCode == "USA"
                    if awaitingBrowser { await reconcileBrowser() }
                }
            }
        }
        .onDisappear { startPicksActivity(reason: "tiered_dismissed") }
    }

    private var previewScrollAnchor: UnitPoint {
        #if DEBUG
        if preview,
           let value = UserDefaults.standard.string(forKey: "tieredPreviewAnchor"),
           let fraction = Double(value), fraction.isFinite {
            return UnitPoint(x: 0.5, y: min(1, max(0, fraction)))
        }
        if preview && UserDefaults.standard.bool(forKey: "tieredPreviewBottom") { return .bottom }
        #endif
        return .top
    }

    private var header: some View {
        VStack(spacing: 28) {
            ZStack {
                if showsPicksExpiry, let picksWindow, !picksWindow.isExpired {
                    PicksExpiryPill(window: picksWindow, compact: true)
                }
                HStack {
                    Image("WagerproofLogo").resizable().scaledToFit()
                        .frame(width: 24, height: 24, alignment: .leading)
                    Spacer()
                    if allowClose {
                        Button(action: closeWithoutPurchase) {
                            Image(systemName: "xmark").font(.system(size: 19, weight: .semibold))
                                .frame(width: 44, height: 44)
                                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
                        }
                        .disabled(busy)
                        .accessibilityLabel("Close tiered paywall")
                    }
                }
            }
            .frame(height: 44)
            .padding(.horizontal, 16)
            Text("Choose your plan")
                .font(.system(size: 32, weight: .bold)).tracking(-0.8)
                .multilineTextAlignment(.center)
            HStack(spacing: 12) {
                Button("Monthly") { selectPeriod(false) }
                Toggle("Yearly billing", isOn: $yearly).labelsHidden().tint(.appPrimary)
                    .fixedSize().accessibilityIdentifier("tieredPaywall.period")
                Button("Yearly") { selectPeriod(true) }
            }
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(.white.opacity(0.65))
            .padding(.horizontal, 18).padding(.vertical, 7)
            .background(Color.appSurfaceElevated, in: Capsule())
            .overlay(Capsule().strokeBorder(.white.opacity(0.09)))
            .disabled(busy)
        }
        .padding(.top, 8)
        .background(alignment: .top) {
            Image("TieredPaywallArtwork")
                .resizable().scaledToFill().frame(height: 280).clipped()
                .blur(radius: reduceTransparency ? 0 : 12)
                .opacity(0.62)
                .mask(LinearGradient(colors: [.white, .clear], startPoint: .top, endPoint: .bottom))
                .offset(y: -90).allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }

    private var planList: some View {
        VStack(spacing: 10) {
            if proAccess.isPreviewing || proAccess.hasSubscription {
                HStack(spacing: 8) {
                    Image(systemName: proAccess.isPreviewing ? "viewfinder" : "checkmark.seal.fill")
                    Text("\(proAccess.isPreviewing ? "Previewing" : "Current plan"): \(proAccess.planTitle)")
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appPrimarySubtle)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16).padding(.vertical, 12)
                .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
            }
            ForEach(PaywallTier.allCases.filter { $0.rawValue >= minimumTier.rawValue }) { item in
                Button {
                    withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.24)) { tier = item }
                } label: {
                    HStack(spacing: 14) {
                        ZStack {
                            Circle().fill(item == tier ? item.selectionTint : .black)
                            if item == tier { Image(systemName: "checkmark").font(.system(size: 17, weight: .bold)).foregroundStyle(.black) }
                        }.frame(width: 26, height: 26)
                        VStack(alignment: .leading, spacing: 4) {
                            if item == tier {
                                TierGlowTitle(text: "\(item.title.replacingOccurrences(of: " ", with: "\u{00a0}")) \(yearly ? "Yearly" : "Monthly")", tier: item, size: 19)
                            } else {
                                Text("\(item.title.replacingOccurrences(of: " ", with: "\u{00a0}")) \(yearly ? "Yearly" : "Monthly")")
                                    .font(.system(size: 19, weight: .bold))
                                    .foregroundStyle(.white)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            Text(subtitle(for: item))
                                .font(.system(size: 14)).foregroundStyle(.white.opacity(0.52))
                        }
                        Spacer(minLength: 2)
                        VStack(alignment: .trailing, spacing: 5) {
                            if let tag = planTag(for: item) {
                                Text(tag)
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(accent)
                                    .padding(.horizontal, 7).padding(.vertical, 4)
                                    .background(Color.appPrimary.opacity(0.10), in: Capsule())
                                    .overlay(Capsule().strokeBorder(Color.appPrimarySubtle.opacity(0.16), lineWidth: 0.5))
                                    .accessibilityLabel(yearly ? "\(tag) compared with \(comparisonPrice(for: item)?.label ?? "the comparison price")" : tag)
                            }
                            ViewThatFits(in: .horizontal) {
                                HStack(alignment: .firstTextBaseline, spacing: 5) {
                                    amountLabel(for: item)
                                    compareAtLabel(for: item)
                                }
                                VStack(alignment: .trailing, spacing: 3) {
                                    amountLabel(for: item)
                                    compareAtLabel(for: item)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 14).padding(.vertical, 16)
                    .frame(maxWidth: .infinity, minHeight: planTag(for: item) != nil ? 82 : 72)
                    .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 11))
                    .overlay {
                        if item == tier {
                            RoundedRectangle(cornerRadius: 11)
                                .strokeBorder(Color.appPrimary, lineWidth: 2)
                        } else {
                            RoundedRectangle(cornerRadius: 11).strokeBorder(.white.opacity(0.04))
                        }
                    }
                }
                .buttonStyle(.plain).disabled(busy)
                .accessibilityIdentifier("tieredPaywall.\(item.slug)")
                .accessibilityAddTraits(item == tier ? .isSelected : [])
            }
        }
    }

    private var featureComparison: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("What do I get?").font(.system(size: 21, weight: .bold)).padding(.horizontal, 18).padding(.top, 16)
            VStack(spacing: 0) {
                ForEach(features.filter { $0.tier.rawValue <= tier.rawValue }) { feature in
                    featureRow(feature, covered: true)
                }
                ForEach(features.filter { $0.tier.rawValue > tier.rawValue }) { feature in
                    featureRow(feature, covered: false)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .padding(5)
        }
        .background(Color.appSurface, in: RoundedRectangle(cornerRadius: 16))
    }

    private func featureRow(_ feature: TieredPaywallFeature, covered: Bool) -> some View {
        HStack(alignment: .center, spacing: 14) {
            Image(systemName: feature.icon).font(.system(size: 21, weight: .medium))
                .frame(width: 38, height: 38)
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(.white.opacity(0.10)))
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 5) {
                    if !covered { Image(systemName: "lock").font(.system(size: 12, weight: .semibold)) }
                    Text(feature.title).font(.system(size: 16, weight: .bold))
                    if !covered {
                        Text(feature.tier.title.uppercased())
                            .font(.system(size: 12, weight: .heavy)).tracking(0.1)
                            .foregroundStyle(LinearGradient(
                                colors: [.appPrimarySubtle, .appPrimary],
                                startPoint: .leading, endPoint: .trailing))
                            .padding(.horizontal, 6).padding(.vertical, 4)
                            .background {
                                RoundedRectangle(cornerRadius: 5)
                                    .fill(LinearGradient(colors: [Color.appPrimarySubtle.opacity(0.18), Color.appPrimary.opacity(0.08)], startPoint: .topLeading, endPoint: .bottomTrailing))
                                    .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(
                                        LinearGradient(colors: [.white.opacity(0.15), Color.appPrimary.opacity(0.05)], startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 0.5))
                            }
                            .fixedSize()
                    }
                }
                Text(feature.detail).font(.system(size: 15)).foregroundStyle(.white.opacity(0.57))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 14).padding(.vertical, 16)
        .foregroundStyle(.white.opacity(covered ? 1 : 0.48))
        .background(covered ? Color.appSurfaceElevated : .black)
        .overlay(alignment: .bottom) { Rectangle().fill(.white.opacity(0.08)).frame(height: 1) }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(feature.title). \(covered ? "Included" : "Requires \(feature.tier.title)"). \(feature.detail)")
        .accessibilityIdentifier("tieredPaywall.feature.\(feature.id).\(covered ? "included" : "locked")")
    }

    private var tierCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("WAGERPROOF").font(.system(size: 11, weight: .heavy)).tracking(2)
                    TierGlowTitle(text: tier.title, tier: tier, size: 34)
                }
                Spacer()
                Image(TierArtwork.bolt(for: tier.accessTier)).resizable().scaledToFit().frame(width: 68, height: 86).blendMode(.screen).accessibilityHidden(true)
            }
            Text(tier.summary).font(.system(size: 17, weight: .medium))
            HStack(spacing: 6) {
                ForEach(PaywallTier.allCases) { item in
                    Capsule().fill(item.rawValue <= tier.rawValue ? tier.selectionTint : .white.opacity(0.15)).frame(height: 4)
                }
            }
            Text("\(features.filter { $0.tier.rawValue <= tier.rawValue }.count) features included")
                .font(.system(size: 13)).foregroundStyle(.white.opacity(0.65))
        }
        .padding(24)
        .background {
            Image(TierArtwork.background(for: tier.accessTier)).resizable().scaledToFill().opacity(0.3)
                .overlay(Color.black.opacity(0.35))
                .accessibilityHidden(true)
        }
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).strokeBorder(Color.appPrimary.opacity(0.3)))
    }

    private var accountFooter: some View {
        VStack(spacing: 25) {
            Button("Restore purchase") { Task { await restore() } }.disabled(busy)
            Button("Sign out") {
                if preview { message = "Preview only. Your account has not been signed out." }
                else { Task { await auth.signOut(); onRequestClose() } }
            }.disabled(busy)
            HStack(spacing: 24) {
                Link("Terms of Use", destination: URL(string: "https://wagerproof.bet/terms-and-conditions")!)
                Link("Privacy Policy", destination: URL(string: "https://wagerproof.bet/privacy-policy")!)
            }.font(.system(size: 12))
            Text("Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period. Manage or cancel in your App Store account settings.")
                .font(.system(size: 11)).multilineTextAlignment(.center).padding(.horizontal, 26)
            Text("© \(String(Calendar.current.component(.year, from: Date()))) WagerProof. All rights reserved.")
                .font(.system(size: 11))
        }
        .font(.system(size: 15)).foregroundStyle(.white.opacity(0.5))
    }

    /// US App Store snapshot verified 2026-09-14. The rating count is deliberately
    /// not shown. Review excerpts link to WagerProof's own listing; never reuse the
    /// reference app's rating/claims.
    private static let appStoreRating = 4.7

    private var reviews: some View {
        VStack(spacing: 18) {
            VStack(spacing: 10) {
                starRow(size: 20, fill: Self.appStoreRating / 5, spacing: 4)
                    .accessibilityLabel("Rated \(Self.appStoreRating) out of 5 stars")
                HStack(alignment: .firstTextBaseline, spacing: 7) {
                    Text(Self.appStoreRating.formatted()).font(.system(size: 40, weight: .bold)).tracking(-1.5)
                    Text("out of 5").font(.system(size: 15, weight: .medium)).foregroundStyle(.white.opacity(0.55))
                }
                Text("App Store rating")
                    .font(.system(size: 11, weight: .bold)).tracking(1.4)
                    .foregroundStyle(.white.opacity(0.55))
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) {
                    reviewCard("So much information to help you make better decisions. By far the best app I have come across!", author: "EveeD525")
                    reviewCard("This app is cool because it takes complicated data and makes it easy to read…and THEN it lets you use AI to ask questions…", author: "SpaceGuy4")
                    reviewCard("If you’re looking for an actual edge, don’t waste your time looking elsewhere. This app is legit.", author: "All3nu")
                    reviewCard("With WagerProof every value decision is backed by complete, reliable data. You don’t need no other app!!! I love WagerProof", author: "Umm…Tray")
                    reviewCard("It has tons of data for every game along with the editors real picks with suggested units and best available odds.", author: "Esoler393")
                    reviewCard("This app is awesome! It has helped me make a lot of very smart bets!", author: "felo1963")
                }
                .scrollTargetLayout()
                .padding(.horizontal, 14)
            }
            .scrollTargetBehavior(.viewAligned)
            Link("Read reviews on the App Store", destination: URL(string: "https://apps.apple.com/us/app/id6757089957?see-all=reviews")!)
                .font(.system(size: 11)).foregroundStyle(.white.opacity(0.5))
        }
        .padding(.vertical, 26)
        .frame(maxWidth: .infinity)
        .background {
            GeometryReader { proxy in
                Image("TieredReviewsBackground")
                    .resizable().scaledToFill()
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .blur(radius: 8)
                    .overlay(.black.opacity(0.12))
                    .clipped()
            }
            .accessibilityHidden(true)
        }
        .background(.black)
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).strokeBorder(.white.opacity(0.08)))
        .padding(.horizontal, 10)
    }

    /// Muted five-star base with an identical accent row clipped to `fill`, so a
    /// 4.7 reads as 4.7 instead of rounding up to five solid stars.
    private func starRow(size: CGFloat, fill: Double, spacing: CGFloat) -> some View {
        let glyphs = HStack(spacing: spacing) {
            ForEach(0..<5) { _ in Image(systemName: "star.fill").font(.system(size: size)) }
        }
        return glyphs
            .foregroundStyle(.white.opacity(0.13))
            .overlay {
                glyphs
                    .foregroundStyle(Color.appPrimary)
                    .mask(alignment: .leading) {
                        GeometryReader { proxy in
                            Rectangle().frame(width: proxy.size.width * fill)
                        }
                    }
            }
            .accessibilityElement()
    }

    private func reviewCard(_ quote: String, author: String) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("“\(quote)”")
                .font(.system(size: 15, weight: .medium)).lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
                .frame(minHeight: 126, alignment: .topLeading)
            HStack(spacing: 9) {
                Text(String(author.prefix(1)))
                    .font(.system(size: 13, weight: .heavy)).foregroundStyle(Color.black.opacity(0.85))
                    .frame(width: 29, height: 29)
                    .background(LinearGradient(colors: [.appPrimarySubtle, .appPrimary], startPoint: .topLeading, endPoint: .bottomTrailing), in: Circle())
                Text(author).font(.system(size: 14, weight: .bold))
                Spacer(minLength: 8)
                starRow(size: 11, fill: 1, spacing: 3).accessibilityLabel("Rated 5 out of 5 stars")
            }
        }
        .padding(20).frame(width: 300, alignment: .leading)
        .background(reduceTransparency ? Color.appSurfaceElevated : .black.opacity(0.72), in: RoundedRectangle(cornerRadius: 20))
        .background(LinearGradient(colors: [.white.opacity(0.08), .clear], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 20))
        .overlay {
            RoundedRectangle(cornerRadius: 20)
                .strokeBorder(LinearGradient(colors: [Color.appPrimary.opacity(0.35), .white.opacity(0.06)], startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 1)
        }
    }

    private var checkoutFooter: some View {
        VStack(spacing: 10) {
            Button { Task { await buy() } } label: {
                HStack(spacing: 8) {
                    if !busy { Image(systemName: "apple.logo").accessibilityHidden(true) }
                    Text(busy ? "Processing…" : "Continue with Apple")
                }
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(.black).frame(maxWidth: .infinity).frame(height: 51)
                .background(.white, in: RoundedRectangle(cornerRadius: 14))
            }
            .accessibilityIdentifier("tieredPaywall.continue").disabled(busy || (!preview && (loading || selectedPackage == nil || !catalogReady)))
            if preview || (storefrontIsUS && webReady) {
                Button(action: { Task { await continueInBrowser() } }) {
                    HStack(spacing: 7) {
                        Text("Continue with")
                        Image("StripeWordmark").resizable().scaledToFit()
                            .frame(width: 46, height: 20).accessibilityHidden(true)
                        Text("·").foregroundStyle(Color.appPrimarySubtle)
                        VStack(spacing: 0) {
                            Text("30% off")
                            Text("additional").font(.system(size: 8, weight: .medium))
                        }
                        .foregroundStyle(Color.appPrimarySubtle)
                    }
                    .font(.system(size: 15, weight: .bold))
                    .frame(maxWidth: .infinity).frame(height: 49)
                    .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14))
                }
                .disabled(busy)
                .accessibilityLabel("Continue with Stripe, an additional 30% off")
                .accessibilityHint("Opens secure checkout in your browser")
                .accessibilityIdentifier("tieredPaywall.browser")
            }
        }
        .padding(.horizontal, 10).padding(.top, 30).padding(.bottom, 12)
        .frame(maxWidth: 640)
        .frame(maxWidth: .infinity)
        .background {
            Rectangle().fill(reduceTransparency ? AnyShapeStyle(Color.appSurface) : AnyShapeStyle(.ultraThinMaterial))
                .overlay(Color.black.opacity(0.22))
                .mask(LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: .white.opacity(0.65), location: 0.35), .init(color: .white, location: 0.75)], startPoint: .top, endPoint: .bottom))
                .ignoresSafeArea(edges: .bottom)
                .allowsHitTesting(false)
        }
    }

    private func selectPeriod(_ value: Bool) {
        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { yearly = value }
    }
    private func amountLabel(for item: PaywallTier) -> some View {
        Text(price(for: item)).font(.system(size: 22, weight: .bold)).monospacedDigit()
            .minimumScaleFactor(0.75).lineLimit(1)
    }
    /// The strike-through and savings badge always share this exact baseline.
    private func comparisonPrice(for item: PaywallTier) -> (amount: Decimal, label: String)? {
        guard item != .standard else { return nil }
        if preview {
            guard let cents = item.usdCompareAtCents(yearly: yearly) else { return nil }
            return (Decimal(cents) / 100, PaywallTier.usd(cents))
        }
        guard let product = package(for: item)?.storeProduct,
              let formatter = product.priceFormatter else { return nil }
        let amount: Decimal
        if product.currencyCode == "USD", let cents = item.usdCompareAtCents(yearly: yearly) {
            amount = Decimal(cents) / 100
        } else {
            // No USD reference price is relabeled as a different currency.
            guard yearly, let monthly = package(for: item, yearly: false)?.storeProduct,
                  monthly.currencyCode == product.currencyCode else { return nil }
            amount = monthly.price * 12
        }
        guard amount > product.price,
              let label = formatter.string(from: NSDecimalNumber(decimal: amount)) else { return nil }
        return (amount, label)
    }

    @ViewBuilder
    private func compareAtLabel(for item: PaywallTier) -> some View {
        if let comparison = comparisonPrice(for: item) {
            Text(comparison.label).font(.system(size: 13)).strikethrough()
                .foregroundStyle(.white.opacity(0.5)).lineLimit(1)
                .accessibilityLabel("Comparison price \(comparison.label)")
        }
    }
    private func startPicksActivity(reason: String) {
        guard showsPicksExpiry, !busy, !purchaseFinalized, picksWindow != nil,
              preview || !proAccess.hasSubscription else { return }
        PicksExpiryService.shared.startLiveActivity(reason: reason)
    }
    private func closeWithoutPurchase() {
        startPicksActivity(reason: "tiered_close")
        onRequestClose()
    }
    private func finalizePurchase(_ transaction: StoreTransaction?, _ info: CustomerInfo) {
        purchaseFinalized = true
        picksWindow = nil
        PicksExpiryService.shared.reconcile(isPro: true)
        onPurchaseFinalized(transaction, info)
    }
    private func planTag(for item: PaywallTier) -> String? {
        guard yearly else { return item == .pro ? "Most popular" : nil }
        guard let comparison = comparisonPrice(for: item) else { return nil }
        let annualPrice = package(for: item)?.storeProduct.price
            ?? (preview ? Decimal(item.priceCents(yearly: true)) / 100 : 0)
        guard annualPrice > 0, comparison.amount > annualPrice else { return nil }
        let percent = NSDecimalNumber(decimal: (1 - annualPrice / comparison.amount) * 100).doubleValue.rounded()
        guard percent > 0 else { return nil }
        return "Save \(Int(percent))%"
    }
    private func package(for item: PaywallTier, yearly period: Bool? = nil) -> Package? {
        let annual = period ?? yearly
        return offering?.availablePackages.first {
            $0.identifier == item.packageID(yearly: annual) && $0.storeProduct.productIdentifier == item.productID(yearly: annual)
        }
    }
    private func price(for item: PaywallTier) -> String {
        if let product = package(for: item)?.storeProduct { return product.localizedPriceString }
        return preview ? PaywallTier.usd(item.priceCents(yearly: yearly)) : "Unavailable"
    }
    private func subtitle(for item: PaywallTier) -> String {
        guard yearly else { return "Monthly billing" }
        if let product = package(for: item)?.storeProduct,
           let formatter = product.priceFormatter,
           let amount = formatter.string(from: NSDecimalNumber(decimal: product.price / 12)) { return "\(amount)/month" }
        return preview ? "\(PaywallTier.usd((item.priceCents(yearly: true) + 6) / 12))/month" : "Yearly billing"
    }
    private func load() async {
        defer { loading = false }
        guard !preview else { return }
        storefrontIsUS = await StoreKit.Storefront.current?.countryCode == "USA"
        guard RevenueCatService.shared.isConfigured else { message = "Subscriptions are not available. Please try again later."; return }
        guard offering != nil && catalogReady else {
            message = "These plans are not available yet. Please try again later."
            return
        }
        AnalyticsService.shared.track("paywall_presented", properties: ["source": source, "placement": placementID, "variant": "tiered_v1"])
        PaywallConversionTracker.shared.trackPaywallView(source: source, offering: offering)
    }

    private func buy() async {
        if preview { message = "Design preview. \(tier.title) costs \(price(for: tier)) per \(yearly ? "year" : "month"). No purchase was started."; return }
        guard !busy, catalogReady, let selectedPackage else { return }
        busy = true
        defer { busy = false }
        PaywallConversionTracker.shared.trackCheckoutStarted(source: source, package: selectedPackage)
        do {
            let result = try await Purchases.shared.purchase(package: selectedPackage)
            guard !result.userCancelled else { return }
            guard RevenueCatService.shared.subscriptionTier(result.customerInfo)?.includes(tier.accessTier) == true else {
                message = "Your purchase is processing. Restore purchases to refresh your access."; return
            }
            await revenueCat.refreshCustomerInfo()
            PaywallConversionTracker.shared.trackConversion(source: source, transaction: result.transaction, customerInfo: result.customerInfo, package: selectedPackage, offering: offering)
            finalizePurchase(result.transaction, result.customerInfo)
        } catch {
            if (error as NSError).asErrorCode != .purchaseCancelledError { message = error.localizedDescription }
        }
    }
    private func restore() async {
        if preview { message = "Restore is available when testing with the live subscription catalog."; return }
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let info = try await Purchases.shared.restorePurchases()
            await revenueCat.refreshCustomerInfo()
            if hasTierEntitlement(info) { finalizePurchase(nil, info) }
            else { message = "No active WagerProof subscription was found for this Apple account." }
        } catch { message = error.localizedDescription }
    }
    private func hasTierEntitlement(_ info: CustomerInfo) -> Bool {
        RevenueCatService.shared.subscriptionTier(info)?.includes(minimumTier.accessTier) == true
    }
    private func continueInBrowser() async {
        if preview { message = "\(tier.title) on the web: \(PaywallTier.usd(tier.webPriceCents(yearly: yearly))) per \(yearly ? "year" : "month"), 30% off. Web checkout is not enabled in the design preview."; return }
        storefrontIsUS = await StoreKit.Storefront.current?.countryCode == "USA"
        guard storefrontIsUS, webReady, let url = hostedCheckoutURL else { return }
        awaitingBrowser = true
        openURL(url) { accepted in
            if !accepted {
                awaitingBrowser = false
                message = "Your browser could not be opened. Please try again."
            }
        }
    }
    private func reconcileBrowser() async {
        guard !busy, RevenueCatService.shared.isConfigured else { return }
        guard hostedCheckoutURL != nil else { awaitingBrowser = false; return }
        let checkoutUserID = Purchases.shared.appUserID
        busy = true
        defer { busy = false }
        do {
            let info = try await Purchases.shared.customerInfo(fetchPolicy: .fetchCurrent)
            guard Purchases.shared.appUserID == checkoutUserID, hostedCheckoutURL != nil else { return }
            if hasTierEntitlement(info) {
                awaitingBrowser = false
                await revenueCat.refreshCustomerInfo()
                finalizePurchase(nil, info)
            }
        } catch { /* Keep the paywall available for retry and restore. */ }
    }
}


private extension PaywallTier {
    var selectionTint: Color {
        switch self {
        case .standard: .appPrimary
        case .premium: Color(red: 0.36, green: 0.94, blue: 0.73)
        case .pro: Color(red: 0.38, green: 1, blue: 0.49)
        }
    }

    var selectionColors: [Color] {
        switch self {
        case .standard: [.appPrimarySubtle, .appPrimary, .appPrimaryStrong]
        case .premium: [selectionTint, Color(red: 0.22, green: 0.86, blue: 0.63)]
        case .pro: [selectionTint, Color(red: 0.14, green: 0.96, blue: 0.40)]
        }
    }
}

/// Static gradient and glow shared by the selected plan and summary tier name.
private struct TierGlowTitle: View {
    let text: String
    let tier: PaywallTier
    let size: CGFloat

    private var title: some View {
        Text(text)
            .font(.system(size: size, weight: .bold))
            .fixedSize(horizontal: false, vertical: true)
    }

    var body: some View {
        Group {
            if tier == .standard {
                title.foregroundStyle(Color.appPrimary)
            } else {
                let isPro = tier == .pro
                let gradient = LinearGradient(colors: tier.selectionColors, startPoint: .leading, endPoint: .trailing)
                title.foregroundStyle(gradient)
                    .shadow(color: tier.selectionTint.opacity(isPro ? 0.75 : 0.35), radius: size * (isPro ? 0.28 : 0.18))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }
}
