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
