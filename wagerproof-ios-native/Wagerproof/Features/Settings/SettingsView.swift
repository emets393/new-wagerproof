import SwiftUI
import UIKit
import WagerproofDesign
import WagerproofServices
import WagerproofStores

/// Settings screen — the SwiftUI port of `wagerproof-mobile/app/(drawer)/(tabs)/settings.tsx`.
///
/// Layout strategy:
/// - Flat, borderless "profile" list (NOT a `Form`/inset-grouped `List`). The
///   reference design is the minimal Cursor-style profile page: monochrome
///   outline SF Symbols (no tinted icon chips), airy muted section headers,
///   hairline dividers between rows, an `arrow.up.right` accessory for rows
///   that leave the app vs `chevron.right` for in-app navigation, and a red
///   "Danger Zone". A native `Form` fights all of this (it forces grouped
///   card backgrounds + system insets), so we hand-roll it as a `ScrollView`
///   of `ProfileSectionHeader` + `ProfileRow` primitives.
/// - The two `HoneydewOptionCard` hero banners (Pro CTA + Discord) are kept
///   from the prior design — they're the visual hook (gradient + drifting
///   chrome + glass pill) and double as the "Plan" affordance, so they sit at
///   the top above the flat sections.
/// - All sheet/modal triggers go through `@State` flags that flip
///   `.sheet(item:)` / `.sheet(isPresented:)` / `.fullScreenCover(isPresented:)`
///   to mount the modal views from the same file. The modals themselves
///   live in `SettingsView` sibling files (DeleteAccountView, DiscordView,
///   IosWidgetView, SecretSettingsView).
/// - Presentation: this view is PUSHED onto the active tab's `NavigationStack`
///   (via `MainTabToolbar.wagerProofSettingsDestination`, triggered by tapping
///   the WagerProof wordmark), so it owns no `NavigationStack` of its own and
///   relies on the system back button to pop. It hides the tab bar while open
///   so it reads as a dedicated page rather than a tab-level surface.
struct SettingsView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(SettingsStore.self) private var settings
    @Environment(RevenueCatStore.self) private var revenueCat
    @Environment(AdminModeStore.self) private var adminMode
    @Environment(ProAccessStore.self) private var proAccess
    @Environment(\.openURL) private var openURL

    @State private var modal: SettingsModal?
    @State private var isPaywallPresented = false
    @State private var isCustomerCenterPresented = false
    @State private var isLogoutAlertPresented = false
    @State private var isSigningOut = false
    @State private var versionTapCount = 0
    @State private var versionTapTask: Task<Void, Never>?
    @State private var isOpeningCustomerCenter = false
    @State private var notificationDeniedAlert = false
    @State private var didCopyUserId = false
    @State private var copyResetTask: Task<Void, Never>?
    /// Opens the branded walkthrough for WagerProof's remote MCP connector.
    /// The connector is deliberately available to every signed-in user: it is
    /// read-only and uses the account they explicitly authorize in Claude.
    @State private var isClaudeConnectorGuidePresented = false

    /// Modal targets — `Identifiable` lets us drive `.sheet(item:)` with a
    /// single state variable instead of one bool per modal. Keeps animations
    /// clean (only one sheet ever mounted at a time).
    private enum SettingsModal: String, Identifiable {
        case discord
        case iosWidget
        case deleteAccount
        case secretSettings
        var id: String { rawValue }
    }

    /// Leading inset that lines hairline row dividers up with the row title
    /// (page padding + icon column + icon→title spacing). Kept as one constant
    /// so the icon column width and divider inset never drift apart.
    private static let iconColumnWidth: CGFloat = 26
    private static let dividerInset = Spacing.lg + iconColumnWidth + Spacing.lg

    var body: some View {
        // No `NavigationStack` here — Settings is pushed onto the active tab's
        // stack (see MainTabToolbar.wagerProofSettingsDestination), so wrapping
        // it in its own stack would double the nav bar. The system back button
        // pops it.
        ScrollView {
            VStack(spacing: 0) {
                // Hero banners (kept) double as the "Plan" affordance.
                VStack(spacing: 10) {
                    heroCard
                    discordCard
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)

                preferencesSection
                claudeConnectorSection
                supportSection
                legalSection
                accountSection
                footerSection
            }
            .padding(.bottom, Spacing.xl)
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.large)
        // Hide the tab bar while Settings is open so it reads as a dedicated
        // page rather than a peer of the tab surfaces — and so the only way out
        // is the system back button, which clears `isSettingsPresented`.
        .toolbar(.hidden, for: .tabBar)
        .task {
            await settings.refreshNotificationPermission()
        }
        .onAppear {
            // System Settings may have changed permissions while the app was
            // backgrounded — re-poll on every appear.
            Task { await settings.refreshNotificationPermission() }
        }
        // Single `.sheet(item:)` powers Discord / iOS Widget / Delete
        // Account modals so SwiftUI only mounts one at a time. The
        // secret settings screen uses `.fullScreenCover` (matches RN's
        // full-screen presentation), so we FILTER `.secretSettings` out
        // of the sheet's binding — otherwise SwiftUI fires both modifiers
        // simultaneously and the (first-declared) sheet wins with an
        // EmptyView, surfacing as a blank white sheet that traps the user.
        .sheet(item: Binding(
            get: { modal != .secretSettings ? modal : nil },
            set: { newValue in modal = newValue }
        )) { which in
            switch which {
            case .discord:
                DiscordView()
            case .iosWidget:
                IosWidgetView()
            case .deleteAccount:
                DeleteAccountView()
            case .secretSettings:
                // Defensive — filtered out by the binding above.
                EmptyView()
            }
        }
        .fullScreenCover(isPresented: Binding(
            get: { modal == .secretSettings },
            set: { if !$0 { modal = nil } }
        )) {
            SecretSettingsView()
        }
        .sheet(isPresented: $isPaywallPresented) {
            RevenueCatPaywallView(placementId: RevenueCatService.Placement.genericFeature)
        }
        .sheet(isPresented: $isCustomerCenterPresented) {
            CustomerCenterView()
        }
        .sheet(isPresented: $isClaudeConnectorGuidePresented) {
            WagerproofClaudeConnectorGuideSheet()
        }
        .alert("Logout", isPresented: $isLogoutAlertPresented) {
            Button("Cancel", role: .cancel) {}
            Button("Logout", role: .destructive) {
                Task { await performSignOut() }
            }
        } message: {
            Text("Are you sure you want to logout?")
        }
        .alert("Notifications Disabled", isPresented: $notificationDeniedAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    openURL(url)
                }
            }
        } message: {
            Text("Push notifications are blocked by your device. Open Settings to enable them.")
        }
        .sensoryFeedback(.selection, trigger: revenueCat.entitlementStatus)
    }

    // MARK: - Hero (Pro banner)
    //
    // Full port of Honeydew's `optionCard` design language: two-stop horizontal
    // gradient, drifting SF Symbol chrome in the card's `primaryColor`, fade-
    // over-icons overlay, white title/subtitle, liquid-glass action pill.
    // Implementation lives in `WagerproofDesign/Components/HoneydewOptionCard.swift`
    // so the Pro + Discord banners share the same animation engine.
    @ViewBuilder
    private var heroCard: some View {
        let isLoading = proAccess.isLoading
        let isPro = proAccess.isPro
        let title = isLoading
            ? "Verifying access"
            : (isPro ? "You are Pro" : "Go Pro Today")
        let subtitle = isLoading
            ? "Checking plan"
            : (isPro ? "Premium picks unlocked" : "Unlock premium picks")
        let actionWord = isLoading ? "Hold" : (isPro ? "Manage" : "Upgrade")

        HoneydewOptionCard(
            title: title,
            subtitle: subtitle,
            actionWord: actionWord,
            // Vivid pumpkin → warm gold gradient — Honeydew's `pantry`
            // tile palette repurposed for the Pro CTA so the banner
            // reads as "premium / unlock" without using the brand
            // green (reserved for the WP onboarding CTA).
            primaryColor: Color(red: 1.00, green: 0.50, blue: 0.00),
            secondaryColor: Color(red: 1.00, green: 0.78, blue: 0.30),
            symbols: [
                "crown.fill", "sparkles", "star.fill", "gift.fill",
                "dollarsign.circle.fill", "chart.line.uptrend.xyaxis",
                "bolt.fill", "trophy.fill", "flame.fill", "rosette"
            ],
            seed: 0.13,
            speedFactor: 1.04,
            yJitter: 0.02,
            onTap: handleHeroTap
        )
        .disabled(proAccess.isLoading)
    }

    // MARK: - Discord promo
    @ViewBuilder
    private var discordCard: some View {
        HoneydewOptionCard(
            title: "Join our Discord",
            subtitle: "Picks, updates, and live chat",
            actionWord: "Join",
            // Discord blurple → lighter periwinkle. Same hue family
            // as Honeydew's `askAI` violet tile, retuned to match
            // Discord's brand palette.
            primaryColor: Color(red: 0.36, green: 0.40, blue: 0.95),
            secondaryColor: Color(red: 0.62, green: 0.66, blue: 1.00),
            symbols: [
                "bubble.left.and.bubble.right.fill", "message.fill",
                "person.2.fill", "hand.wave.fill", "headphones",
                "mic.fill", "heart.fill", "star.fill",
                "ellipsis.bubble.fill", "person.3.fill"
            ],
            seed: 0.46,
            speedFactor: 0.95,
            yJitter: -0.04,
            onTap: { modal = .discord }
        )
    }

    // MARK: - Preferences
    @ViewBuilder
    private var preferencesSection: some View {
        ProfileSectionHeader(title: "Preferences")
        VStack(spacing: 0) {
            // Theme changer intentionally hidden — the app ships dark-mode-only.
            // See ThemeStore (default `.dark`).
            pushNotificationsRow
            rowDivider
            ProfileRow(
                icon: "square.grid.2x2",
                title: "iOS Home Screen Widget",
                accessory: .chevron,
                action: { modal = .iosWidget }
            )
        }
    }

    // MARK: - WagerProof AI connector

    /// Reuses the multi-provider connector banner from the custom paywall's
    /// final feature page. Tapping it keeps the existing Claude setup guide as
    /// the currently supported in-app walkthrough.
    @ViewBuilder
    private var claudeConnectorSection: some View {
        ProfileSectionHeader(title: "AI Connector")
        claudeConnectorCard
            .padding(.horizontal, Spacing.lg)
    }

    private var claudeConnectorCard: some View {
        Button {
            isClaudeConnectorGuidePresented = true
        } label: {
            AIConnectorBanner(compact: false)
                .contentShape(RoundedRectangle(cornerRadius: 23, style: .continuous))
        }
        .buttonStyle(ClaudeConnectorCardButtonStyle())
        .accessibilityLabel("Connect WagerProof to your AI. Claude, ChatGPT, Gemini, Grok, and Codex.")
        .accessibilityHint("Opens the Claude custom connector setup guide.")
    }

    /// Push-notification row — bespoke because it carries a `Toggle` (or a
    /// spinner while we re-poll the OS permission) rather than a tap accessory.
    @ViewBuilder
    private var pushNotificationsRow: some View {
        HStack(spacing: Spacing.lg) {
            Image(systemName: "bell")
                .font(.system(size: 20, weight: .regular))
                .foregroundStyle(Color.appTextSecondary)
                .frame(width: Self.iconColumnWidth)
            VStack(alignment: .leading, spacing: 2) {
                Text("Push Notifications")
                    .font(.system(size: 17, weight: .regular))
                    .foregroundStyle(Color.appTextPrimary)
                Text(notificationSubtitle)
                    .font(AppFont.caption)
                    .foregroundStyle(Color.appTextMuted)
            }
            Spacer(minLength: Spacing.sm)
            if settings.isCheckingNotificationPermission {
                ProgressView()
            } else {
                Toggle("", isOn: Binding(
                    get: { settings.notificationPermission.isEnabled },
                    set: { newValue in
                        Task {
                            if newValue {
                                let result = await settings.enableNotifications(userId: currentUserId)
                                if result == .denied { notificationDeniedAlert = true }
                            } else {
                                await settings.disableNotifications(userId: currentUserId)
                            }
                        }
                    }
                ))
                .labelsHidden()
                .tint(Color.appPrimary)
            }
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.vertical, 14)
    }

    private var notificationSubtitle: String {
        if settings.isCheckingNotificationPermission { return "Checking permission…" }
        return settings.notificationPermission.isEnabled ? "On — agent picks & alerts" : "Off"
    }

    // MARK: - Support
    @ViewBuilder
    private var supportSection: some View {
        ProfileSectionHeader(title: "Support")
        VStack(spacing: 0) {
            ProfileRow(
                icon: "bubble.left.and.bubble.right",
                title: "Discord Channel",
                accessory: .chevron,
                action: { modal = .discord }
            )
            rowDivider
            ProfileRow(
                icon: "envelope",
                title: "Contact Us",
                accessory: .external,
                action: {
                    openURL(URL(string: "mailto:admin@wagerproof.bet?subject=Contact%20Us%20-%20WagerProof%20Mobile")!)
                }
            )
        }
    }

    // MARK: - Legal & policies
    @ViewBuilder
    private var legalSection: some View {
        ProfileSectionHeader(title: "Legal")
        VStack(spacing: 0) {
            ProfileRow(
                icon: "lock.shield",
                title: "Privacy Policy",
                accessory: .external,
                action: { openURL(URL(string: "https://wagerproof.bet/privacy-policy")!) }
            )
            rowDivider
            ProfileRow(
                icon: "doc.text",
                title: "Terms of Use",
                accessory: .external,
                action: { openURL(URL(string: "https://wagerproof.bet/terms-and-conditions")!) }
            )
        }
    }

    // MARK: - Account / More / Danger Zone
    @ViewBuilder
    private var accountSection: some View {
        if case let .authenticated(userId) = auth.phase {
            ProfileSectionHeader(title: "Account")
            VStack(spacing: 0) {
                // Static email row — informational only, no accessory.
                if let email = auth.profile?.email ?? authEmail {
                    ProfileRow(
                        icon: "at",
                        title: "Email",
                        subtitle: email,
                        accessory: .none
                    )
                    rowDivider
                }
                userIdRow(userId: userId)
            }

            ProfileSectionHeader(title: "More")
            logOutRow

            ProfileSectionHeader(title: "Danger Zone")
            ProfileRow(
                icon: "trash",
                title: "Delete Account",
                subtitle: "Permanently delete your account and data",
                accessory: .none,
                destructive: true,
                action: { modal = .deleteAccount }
            )
        }
    }

    /// Sign-out row — bespoke so we can swap the leading glyph context for a
    /// spinner + "Logging out…" label mid-sign-out.
    @ViewBuilder
    private var logOutRow: some View {
        Button {
            isLogoutAlertPresented = true
        } label: {
            HStack(spacing: Spacing.lg) {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(width: Self.iconColumnWidth)
                Text(isSigningOut ? "Logging out…" : "Sign out")
                    .font(.system(size: 17, weight: .regular))
                    .foregroundStyle(Color.appTextPrimary)
                Spacer(minLength: Spacing.sm)
                if isSigningOut { ProgressView() }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isSigningOut)
    }

    /// User ID row — tap anywhere on it to copy the authenticated user's UUID to
    /// the clipboard (handy for support handoffs + debugging). The full id is
    /// shown monospaced and truncated in the middle; the copy glyph flips to a
    /// checkmark + "Copied" for a beat as confirmation.
    @ViewBuilder
    private func userIdRow(userId: UUID) -> some View {
        let idString = userId.uuidString
        Button {
            UIPasteboard.general.string = idString
            withAnimation(.easeInOut(duration: 0.2)) { didCopyUserId = true }
            // Revert the "Copied" affordance after a short beat.
            copyResetTask?.cancel()
            copyResetTask = Task {
                try? await Task.sleep(nanoseconds: 1_600_000_000)
                if Task.isCancelled { return }
                await MainActor.run {
                    withAnimation(.easeInOut(duration: 0.2)) { didCopyUserId = false }
                }
            }
        } label: {
            HStack(spacing: Spacing.lg) {
                Image(systemName: "number")
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(width: Self.iconColumnWidth)
                VStack(alignment: .leading, spacing: 2) {
                    Text("User ID")
                        .font(.system(size: 17, weight: .regular))
                        .foregroundStyle(Color.appTextPrimary)
                    Text(idString)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.appTextMuted)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                Spacer(minLength: Spacing.sm)
                HStack(spacing: 4) {
                    if didCopyUserId {
                        Text("Copied")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.appPrimary)
                    }
                    Image(systemName: didCopyUserId ? "checkmark" : "doc.on.doc")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(didCopyUserId ? Color.appPrimary : Color.appTextMuted)
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // Haptic only on copy (rising edge), not on the auto-reset back to false.
        .sensoryFeedback(trigger: didCopyUserId) { _, newValue in
            newValue ? .success : nil
        }
    }

    // MARK: - Footer

    @ViewBuilder
    private var footerSection: some View {
        Button {
            handleVersionTap()
        } label: {
            VStack(spacing: 4) {
                Text(appVersionString)
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundStyle(Color.appTextMuted)
                Text("Developed by nerds from Ohio.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextMuted)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, Spacing.xxl)
            .padding(.bottom, Spacing.sm)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Row primitives (flat "profile" aesthetic)

    /// Muted, airy section header — sentence case, sits flush-left above its
    /// rows with generous top breathing room between sections.
    private struct ProfileSectionHeader: View {
        let title: String
        var body: some View {
            Text(title)
                .font(.system(size: 15, weight: .regular))
                .foregroundStyle(Color.appTextMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.xl)
                .padding(.bottom, Spacing.sm)
        }
    }

    /// Flat settings row: monochrome outline glyph + title (+ optional
    /// subtitle) + trailing accessory. No tinted icon chip, no card background
    /// — the row sits directly on the page surface. `action == nil` renders a
    /// non-interactive display row (e.g. the email row).
    private struct ProfileRow: View {
        enum Accessory { case chevron, external, none }

        let icon: String
        let title: String
        var subtitle: String? = nil
        var accessory: Accessory = .chevron
        var destructive: Bool = false
        var action: (() -> Void)? = nil

        var body: some View {
            if let action {
                Button(action: action) { rowContent }
                    .buttonStyle(.plain)
            } else {
                rowContent
            }
        }

        private var rowContent: some View {
            HStack(spacing: Spacing.lg) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(destructive ? Color.appAccentRed : Color.appTextSecondary)
                    .frame(width: SettingsView.iconColumnWidth)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 17, weight: .regular))
                        .foregroundStyle(destructive ? Color.appAccentRed : Color.appTextPrimary)
                    if let subtitle {
                        Text(subtitle)
                            .font(AppFont.caption)
                            .foregroundStyle(Color.appTextMuted)
                            .lineLimit(2)
                    }
                }
                Spacer(minLength: Spacing.sm)
                accessoryView
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }

        @ViewBuilder
        private var accessoryView: some View {
            switch accessory {
            case .chevron:
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
            case .external:
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
            case .none:
                EmptyView()
            }
        }
    }

    /// Hairline divider between rows in a section, inset to start under the
    /// row title (so it clears the icon column).
    private var rowDivider: some View {
        Rectangle()
            .fill(Color.appBorder)
            .frame(height: 0.5)
            .padding(.leading, Self.dividerInset)
    }

    // MARK: - Helpers

    private var currentUserId: UUID? {
        if case let .authenticated(id) = auth.phase { return id }
        return nil
    }

    private var authEmail: String? {
        // AuthStore.profile.email might be nil during initial sync; nothing
        // to display until the profile row resolves.
        nil
    }

    private var appVersionString: String {
        let info = Bundle.main.infoDictionary
        let version = (info?["CFBundleShortVersionString"] as? String) ?? "1.0.0"
        let build = (info?["CFBundleVersion"] as? String) ?? ""
        return build.isEmpty ? version : "\(version) (\(build))"
    }

    // MARK: - Handlers

    private func handleHeroTap() {
        if proAccess.isLoading { return }
        if proAccess.isPro {
            handleManageSubscriptionTap()
        } else {
            isPaywallPresented = true
        }
    }

    private func handleManageSubscriptionTap() {
        if proAccess.isLoading { return }
        if proAccess.isPro {
            // Mirrors RN: prefer the in-SDK customer center, fall back to
            // App Store subscriptions URL if the SDK didn't enable the UI.
            isOpeningCustomerCenter = true
            Task {
                await revenueCat.refreshCustomerInfo()
                isOpeningCustomerCenter = false
                isCustomerCenterPresented = true
            }
        } else {
            isPaywallPresented = true
        }
    }

    private func performSignOut() async {
        isSigningOut = true
        defer { isSigningOut = false }
        if let userId = currentUserId {
            await NotificationService.shared.deactivatePushTokens(userId: userId)
        }
        await revenueCat.detachUser()
        adminMode.reset()
        await auth.signOut()
    }

    private func handleVersionTap() {
        versionTapCount += 1
        versionTapTask?.cancel()
        if versionTapCount >= 2 {
            versionTapCount = 0
            modal = .secretSettings
            return
        }
        versionTapTask = Task {
            try? await Task.sleep(nanoseconds: 500_000_000)
            if !Task.isCancelled {
                await MainActor.run { versionTapCount = 0 }
            }
        }
    }
}

// MARK: - Shared AI connector banner

/// The multi-provider connector banner used by the custom paywall's final
/// feature page. Settings wraps it in a button while the paywall presents the
/// same banner as a display-only benefit preview.
struct AIConnectorBanner: View {
    let compact: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private struct Provider: Identifiable {
        let id: String
        let assetName: String
        let usesInsetLogo: Bool
    }

    private let providers: [Provider] = [
        .init(id: "Claude", assetName: "AIClaudeIcon", usesInsetLogo: false),
        .init(id: "ChatGPT", assetName: "AIChatGPTIcon", usesInsetLogo: false),
        .init(id: "Gemini", assetName: "AIGeminiIcon", usesInsetLogo: false),
        .init(id: "Grok", assetName: "AIGrokIcon", usesInsetLogo: false),
        .init(id: "Codex", assetName: "AICodexIcon", usesInsetLogo: false),
    ]

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 23, style: .continuous)
        let primary = Color(hex: 0x30231F)
        let secondary = Color(hex: 0xD97757)

        ZStack {
            LinearGradient(
                colors: [primary, secondary],
                startPoint: .leading,
                endPoint: .trailing
            )

            OptionCardIconChrome(
                primaryColor: primary,
                symbols: [
                    "link", "sparkles", "brain.head.profile",
                    "text.bubble.fill", "magnifyingglass",
                    "chart.bar.fill", "bolt.fill", "network",
                    "terminal.fill", "doc.text.fill",
                ],
                seed: 0.72,
                speedFactor: 0.86,
                yJitter: 0.01,
                motionEnabled: !reduceMotion
            )

            LinearGradient(
                colors: [primary, primary.opacity(0.88), primary.opacity(0.18)],
                startPoint: .leading,
                endPoint: .trailing
            )
            .allowsHitTesting(false)

            VStack(alignment: .leading, spacing: compact ? 7 : 9) {
                HStack(spacing: compact ? -9 : -11) {
                    ForEach(Array(providers.enumerated()), id: \.element.id) { index, provider in
                        ZStack {
                            Circle()
                                .fill(Color.black)

                            Image(provider.assetName)
                                .resizable()
                                .renderingMode(.original)
                                .aspectRatio(contentMode: provider.usesInsetLogo ? .fit : .fill)
                                .padding(provider.usesInsetLogo ? (compact ? 8 : 10) : 0)
                        }
                        .frame(width: compact ? 38 : 46, height: compact ? 38 : 46)
                        .clipShape(Circle())
                        .overlay(
                            Circle().strokeBorder(
                                Color.white.opacity(0.82),
                                lineWidth: compact ? 1.5 : 2
                            )
                        )
                        .shadow(color: .black.opacity(0.34), radius: 5, y: 3)
                        .zIndex(Double(providers.count - index))
                    }
                }
                .accessibilityHidden(true)

                Text("Connect WagerProof to your AI")
                    .font(.system(size: compact ? 15 : 18, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)

                Text("Bring your agents, picks, and model analytics into a read-only AI workflow.")
                    .font(.system(size: compact ? 12.5 : 15, weight: .medium))
                    .foregroundStyle(.white.opacity(0.92))
                    .lineLimit(3)
                    .minimumScaleFactor(0.9)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Claude  ·  ChatGPT  ·  Gemini  ·  Grok  ·  Codex")
                    .font(.system(size: compact ? 7.5 : 9, weight: .bold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.72))
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }
            .padding(compact ? 10 : 14)
        }
        .frame(maxWidth: .infinity)
        .frame(height: compact ? 152 : 184)
        .clipShape(shape)
        .overlay(shape.strokeBorder(.white.opacity(0.14), lineWidth: 1))
        .shadow(color: .black.opacity(0.15), radius: 12, y: 5)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "AI connector setup for Claude, ChatGPT, Gemini, Grok, and Codex. Read-only access included with Pro."
        )
    }
}

// MARK: - WagerProof for Claude guide

/// A focused, user-facing walkthrough for WagerProof's remote MCP connector.
/// Unlike Honeydew's directory listing, WagerProof currently uses Claude's
/// custom-connector path, so the endpoint and the expected "Custom" label are
/// explicit. The richer examples also explain the read-only analytics boundary
/// before a user grants access.
private struct WagerproofClaudeConnectorGuideSheet: View {
    @Environment(\.dismiss) private var dismiss

    @State private var copiedValue: String?
    @State private var copyResetTask: Task<Void, Never>?

    private let accent = Color(hex: 0xD97757)
    private let accentDark = Color(hex: 0x4D2D27)
    private let endpoint = "https://wagerproof-mcp.habib225.workers.dev/mcp"
    private let claudeConnectorsURL = URL(string: "https://claude.ai/settings/connectors")!
    private let wagerproofGuideURL = URL(string: "https://wagerproof-mcp.habib225.workers.dev/docs")!
    private let examplePrompts = [
        "How have my prediction agents performed over the last 30 days?",
        "Show my contrarian agent's last 10 picks and how they graded.",
        "Compare WagerProof's model for tonight's NBA games with prediction-market odds.",
        "Which agents do I follow, and what is their recent record?",
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                hero

                VStack(alignment: .leading, spacing: 28) {
                    customConnectorCallout
                    setupSection
                    useCasesSection
                    promptSection
                    privacySection

                    Link(destination: wagerproofGuideURL) {
                        HStack(spacing: 7) {
                            Text("Read the full connector guide")
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 12, weight: .bold))
                        }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(accent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                    }
                }
                .padding(.horizontal, 20)
            }
            .padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
        .background(Color.appSurface)
        .overlay(alignment: .topTrailing) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .frame(width: 30, height: 30)
                    .background(.regularMaterial, in: Circle())
            }
            .accessibilityLabel("Close")
            .padding(.top, 14)
            .padding(.trailing, 16)
        }
        .presentationDragIndicator(.hidden)
        .presentationDetents([.large])
        .presentationBackground(Color.appSurface)
        .onDisappear {
            copyResetTask?.cancel()
        }
    }

    // MARK: Branded introduction

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [accentDark, Color(hex: 0xA6533F), accent],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Image("ClaudeSymbol")
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .foregroundStyle(.white)
                .frame(width: 230, height: 230)
                .opacity(0.08)
                .offset(x: 104, y: 44)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .center, spacing: 12) {
                    Image("ClaudeSymbol")
                        .resizable()
                        .scaledToFit()
                        .padding(12)
                        .frame(width: 60, height: 60)
                        .background(
                            RoundedRectangle(cornerRadius: 17, style: .continuous)
                                .fill(Color.white.opacity(0.96))
                        )
                        .accessibilityHidden(true)

                    Text("WAGERPROOF CUSTOM CONNECTOR")
                        .font(.system(size: 10, weight: .bold))
                        .kerning(1.1)
                        .foregroundStyle(Color.white.opacity(0.78))
                }

                Text("Put your agents and models in the conversation.")
                    .font(.system(size: 27, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Claude can review your prediction agents and their history, then compare WagerProof model estimates with market prices — right inside your chats.")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.9))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 24)
            .padding(.top, 34)
            .padding(.bottom, 28)
        }
        .clipShape(
            UnevenRoundedRectangle(
                bottomLeadingRadius: 28,
                bottomTrailingRadius: 28,
                style: .continuous
            )
        )
        .accessibilityElement(children: .combine)
    }

    // MARK: Custom-connector context

    private var customConnectorCallout: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 11) {
                Image(systemName: "point.3.connected.trianglepath.dotted")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(accent)
                Text("Add it once, then use it everywhere")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.appTextPrimary)
            }

            Text("WagerProof is waiting for inclusion in Claude's connector directory, so add it manually from Claude on the web or desktop. Once connected, it follows your Claude account onto mobile too.")
                .font(AppFont.caption)
                .foregroundStyle(Color.appTextSecondary)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)

            Label {
                Text("Claude will label it Custom because Anthropic has not reviewed the listing yet. The endpoint below is operated by WagerProof and exposes read-only tools.")
                    .font(.system(size: 12, weight: .medium))
                    .fixedSize(horizontal: false, vertical: true)
            } icon: {
                Image(systemName: "info.circle.fill")
                    .foregroundStyle(accent)
            }
            .foregroundStyle(Color.appTextSecondary)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(accent.opacity(0.10))
        )
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(accent.opacity(0.24), lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Setup walkthrough

    private var setupSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle(
                eyebrow: "GET CONNECTED",
                title: "Four steps on Claude web or desktop",
                subtitle: "No API keys or advanced OAuth settings required."
            )

            VStack(spacing: 12) {
                setupStep(
                    number: 1,
                    title: "Open Claude Settings",
                    detail: "In Claude, click your name at the bottom-left and choose Settings.",
                    imageName: "ClaudeSetupSettings",
                    imageMaxHeight: 210,
                    imageBackground: Color(
                        red: 34.0 / 255.0,
                        green: 34.0 / 255.0,
                        blue: 34.0 / 255.0
                    ),
                    imageLabel: "Claude account menu with Settings selected."
                )

                setupStep(
                    number: 2,
                    title: "Choose Connectors",
                    detail: "Under Customize, open Connectors, then click the plus button next to the Connectors heading.",
                    imageName: "ClaudeSetupConnectors",
                    imageMaxHeight: 140,
                    imageBackground: Color(
                        red: 26.0 / 255.0,
                        green: 26.0 / 255.0,
                        blue: 25.0 / 255.0
                    ),
                    imageLabel: "Claude Settings with Connectors selected under Customize."
                )

                setupStep(
                    number: 3,
                    title: "Add WagerProof as a custom connector",
                    detail: "Choose Add custom connector. Name it WagerProof, paste the URL below, leave Advanced settings empty, and click Add."
                ) {
                    endpointCard
                }

                setupStep(
                    number: 4,
                    title: "Connect your WagerProof account",
                    detail: "Click Connect, sign in with the same WagerProof email and password you use in the app, and approve read-only access."
                ) {
                    Label {
                        Text("Claude may show an unverified custom-connector warning. Confirm the URL ends in wagerproof-mcp.habib225.workers.dev/mcp before continuing.")
                            .font(.system(size: 12, weight: .medium))
                            .fixedSize(horizontal: false, vertical: true)
                    } icon: {
                        Image(systemName: "checkmark.shield.fill")
                            .foregroundStyle(Color.appPrimary)
                    }
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Color.appPrimary.opacity(0.09))
                    )
                }
            }

            Link(destination: claudeConnectorsURL) {
                HStack(spacing: 9) {
                    Image("ClaudeSymbol")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 20, height: 20)
                    Text("Open Claude Connectors")
                        .font(.system(size: 16, weight: .semibold))
                    Spacer(minLength: 8)
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 14, weight: .bold))
                }
                .foregroundStyle(Color.white)
                .padding(.horizontal, 18)
                .padding(.vertical, 15)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(accent)
                )
            }
            .accessibilityHint("Opens Claude's connector settings on the web.")

            Label {
                Text("On Claude Team or Enterprise, an Owner must add the custom web connector for the organization before members can connect their own accounts.")
                    .font(.system(size: 12, weight: .regular))
                    .fixedSize(horizontal: false, vertical: true)
            } icon: {
                Image(systemName: "person.2.badge.gearshape.fill")
                    .foregroundStyle(accent)
            }
            .foregroundStyle(Color.appTextSecondary)
            .padding(.horizontal, 4)
        }
    }

    private func setupStep(
        number: Int,
        title: String,
        detail: String,
        imageName: String,
        imageMaxHeight: CGFloat,
        imageBackground: Color,
        imageLabel: String
    ) -> some View {
        setupStep(number: number, title: title, detail: detail) {
            framedScreenshot(
                imageName,
                maxHeight: imageMaxHeight,
                background: imageBackground,
                label: imageLabel
            )
        }
    }

    private func setupStep<Supplement: View>(
        number: Int,
        title: String,
        detail: String,
        @ViewBuilder supplement: () -> Supplement
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 13) {
                Text("\(number)")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(accent))

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text(detail)
                        .font(AppFont.caption)
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 0)
            }

            supplement()
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color.appSurfaceElevated)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.appBorder, lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(number). \(title). \(detail)")
    }

    private func setupStep(number: Int, title: String, detail: String) -> some View {
        setupStep(number: number, title: title, detail: detail) {
            EmptyView()
        }
    }

    private func framedScreenshot(
        _ name: String,
        maxHeight: CGFloat,
        background: Color,
        label: String
    ) -> some View {
        Image(name)
            .resizable()
            .scaledToFit()
            .frame(maxWidth: .infinity, maxHeight: maxHeight)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.white.opacity(0.10), lineWidth: 1)
            }
            .shadow(color: Color.black.opacity(0.18), radius: 8, y: 3)
            .accessibilityLabel(label)
    }

    private var endpointCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("NAME")
                        .font(.system(size: 10, weight: .bold))
                        .kerning(0.8)
                        .foregroundStyle(Color.appTextMuted)
                    Text("WagerProof")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                }
                Spacer(minLength: 8)
                Text("CUSTOM")
                    .font(.system(size: 9, weight: .bold))
                    .kerning(0.6)
                    .foregroundStyle(accent)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(accent.opacity(0.12), in: Capsule())
            }

            Button {
                copy(endpoint)
            } label: {
                HStack(spacing: 10) {
                    Text(endpoint)
                        .font(.system(size: 11.5, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Spacer(minLength: 6)

                    Image(systemName: copiedValue == endpoint ? "checkmark.circle.fill" : "doc.on.doc")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(copiedValue == endpoint ? Color.appPrimary : accent)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.appSurfaceMuted)
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(copiedValue == endpoint ? Color.appPrimary.opacity(0.45) : Color.appBorder, lineWidth: 1)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(copiedValue == endpoint ? "WagerProof MCP URL copied" : "Copy WagerProof MCP URL")
        }
    }

    // MARK: Examples

    private var useCasesSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionTitle(
                eyebrow: "SEE IT IN ACTION",
                title: "A few things to try",
                subtitle: "Claude can combine your account history with WagerProof's public analytics."
            )

            chatMockup(
                caption: "Review your prediction agents",
                captionIcon: "person.2.wave.2",
                userText: "How have my agents performed over the last 30 days?",
                toolText: "WagerProof · checked your agents"
            ) {
                mockReply("I found three active agents. Here's the 30-day snapshot:")
                mockBullet(name: "Contrarian", meta: "18–12 · 60%")
                mockBullet(name: "NBA Specialist", meta: "14–11 · 56%")
                mockBullet(name: "Market Watcher", meta: "10–10 · 50%")
                mockReply("Want me to break down their most recent picks?")
            }

            chatMockup(
                caption: "Compare models with the market",
                captionIcon: "chart.line.uptrend.xyaxis",
                userText: "Where do WagerProof's NBA estimates differ most from prediction-market prices tonight?",
                toolText: "WagerProof · compared model and market"
            ) {
                mockReply("The largest probability gaps in the current slate are:")
                mockLine("Game A — model 64% · market 55%")
                mockLine("Game B — model 41% · market 49%")
                mockReply("These are model estimates, not guaranteed outcomes or betting advice.")
            }
        }
    }

    private func chatMockup<Reply: View>(
        caption: String,
        captionIcon: String,
        userText: String,
        toolText: String,
        @ViewBuilder reply: () -> Reply
    ) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Label(caption, systemImage: captionIcon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .padding(.leading, 2)

            VStack(alignment: .leading, spacing: 13) {
                HStack {
                    Spacer(minLength: 44)
                    Text(userText)
                        .font(.system(size: 14.5))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.leading)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(Color(hex: 0x2A2A28))
                        )
                }

                HStack(spacing: 7) {
                    Circle()
                        .fill(Color(hex: 0x9CCB7A))
                        .frame(width: 7, height: 7)
                    Text(toolText)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.white.opacity(0.5))
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.35))
                }

                VStack(alignment: .leading, spacing: 8) {
                    reply()
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Color(hex: 0x0F0F0F))
            )
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Example Claude chat. You ask: \(userText)")
        }
    }

    private func mockReply(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 14.5, design: .serif))
            .foregroundStyle(Color.white.opacity(0.9))
            .fixedSize(horizontal: false, vertical: true)
    }

    private func mockBullet(name: String, meta: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("•")
                .font(.system(size: 15, weight: .bold, design: .serif))
                .foregroundStyle(accent)
            (
                Text(name).font(.system(size: 14.5, weight: .semibold, design: .serif))
                    + Text("   \(meta)")
                    .font(.system(size: 14.5, design: .serif))
                    .foregroundStyle(Color.white.opacity(0.5))
            )
            .foregroundStyle(Color.white.opacity(0.92))
            .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }

    private func mockLine(_ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("•")
                .font(.system(size: 15, weight: .bold, design: .serif))
                .foregroundStyle(accent)
            Text(text)
                .font(.system(size: 14, design: .serif))
                .foregroundStyle(Color.white.opacity(0.88))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }

    // MARK: Copyable prompts and permission boundary

    private var promptSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle(
                eyebrow: "TRY ASKING",
                title: "Start with one of these",
                subtitle: "Tap a prompt to copy it, then paste it into a Claude chat."
            )

            VStack(spacing: 10) {
                ForEach(examplePrompts, id: \.self) { prompt in
                    Button {
                        copy(prompt)
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: "quote.opening")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(accent)
                                .padding(.top, 2)

                            Text(prompt)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Color.appTextPrimary)
                                .multilineTextAlignment(.leading)
                                .fixedSize(horizontal: false, vertical: true)

                            Spacer(minLength: 4)

                            Image(systemName: copiedValue == prompt ? "checkmark.circle.fill" : "doc.on.doc")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(copiedValue == prompt ? Color.appPrimary : Color.appTextMuted)
                        }
                        .padding(15)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(Color.appSurfaceElevated)
                        )
                        .overlay {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(
                                    copiedValue == prompt ? Color.appPrimary.opacity(0.45) : Color.appBorder,
                                    lineWidth: 1
                                )
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Copies this prompt.")
                }
            }
        }
    }

    private var privacySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Read-only analytics", systemImage: "lock.shield.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)

            Text("Claude can retrieve your own agents, picks, follows, and community record when you ask. It can also read WagerProof's public model estimates, market prices, and editor analyses. It cannot create, change, or delete your data, and it cannot place a bet.")
                .font(AppFont.caption)
                .foregroundStyle(Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)

            Label("Model estimates are informational, not betting advice or guaranteed outcomes.", systemImage: "exclamationmark.shield.fill")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(accent)
                .padding(.top, 2)

            Label("Disconnect at any time in Claude's connector settings.", systemImage: "rectangle.portrait.and.arrow.right")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(accent.opacity(0.10))
        )
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(accent.opacity(0.24), lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
    }

    private func sectionTitle(eyebrow: String, title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(eyebrow)
                .font(.system(size: 10, weight: .bold))
                .kerning(1.1)
                .foregroundStyle(accent)
            Text(title)
                .font(.system(size: 21, weight: .bold, design: .rounded))
                .foregroundStyle(Color.appTextPrimary)
            Text(subtitle)
                .font(AppFont.caption)
                .foregroundStyle(Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func copy(_ value: String) {
        UIPasteboard.general.string = value
        UINotificationFeedbackGenerator().notificationOccurred(.success)

        copyResetTask?.cancel()
        withAnimation(.easeInOut(duration: 0.18)) {
            copiedValue = value
        }

        copyResetTask = Task {
            try? await Task.sleep(nanoseconds: 1_600_000_000)
            guard !Task.isCancelled, copiedValue == value else { return }
            await MainActor.run {
                withAnimation(.easeInOut(duration: 0.18)) {
                    copiedValue = nil
                }
            }
        }
    }
}

/// A subtle press treatment keeps the discovery card tactile while respecting
/// the user's system Reduce Motion preference.
private struct ClaudeConnectorCardButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.98 : 1)
            .opacity(configuration.isPressed ? 0.94 : 1)
            .animation(
                reduceMotion ? nil : .spring(response: 0.24, dampingFraction: 0.78),
                value: configuration.isPressed
            )
    }
}
