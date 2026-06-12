import SwiftUI
import WagerproofDesign
import WagerproofServices
import WagerproofStores

/// Settings screen — the SwiftUI port of `wagerproof-mobile/app/(drawer)/(tabs)/settings.tsx`.
///
/// Layout strategy (spec §16):
/// - `Form` with `.insetGrouped` `List` style — same affordance as iOS
///   Settings.app. RN built this with hand-rolled `SectionCard` blocks; the
///   native `Form` gives us free section spacing, dynamic-type sizing, dark
///   mode, and HIG-correct row insets.
/// - Hero membership card stays bespoke because it's a visual hook (gold
///   gradient + "GO PRO TODAY") that doesn't map cleanly to a `Form` row.
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

    var body: some View {
        // No `NavigationStack` here — Settings is pushed onto the active tab's
        // stack (see MainTabToolbar.wagerProofSettingsDestination), so wrapping
        // it in its own stack would double the nav bar. The system back button
        // pops it.
        Form {
            heroSection
            preferencesSection
            discordPromoSection
            communitySupportSection
            legalSection
            accountSection
            footerSection
        }
        .scrollContentBackground(.hidden)
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
    // Full port of Honeydew's `optionCard` design language from
    // `AddRecipeBottomSheet.swift:959-1117`: two-stop horizontal gradient,
    // drifting SF Symbol chrome in the card's `primaryColor`, fade-over-
    // icons overlay, white title/subtitle, liquid-glass action pill.
    // Implementation lives in `WagerproofDesign/Components/HoneydewOptionCard.swift`
    // so the Pro + Discord banners share the same animation engine.
    @ViewBuilder
    private var heroSection: some View {
        let isLoading = proAccess.isLoading
        let isPro = proAccess.isPro
        let title = isLoading
            ? "Verifying access"
            : (isPro ? "You are Pro" : "Go Pro Today")
        let subtitle = isLoading
            ? "Checking plan"
            : (isPro ? "Premium picks unlocked" : "Unlock premium picks")
        let actionWord = isLoading ? "Hold" : (isPro ? "Manage" : "Upgrade")

        Section {
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
            // Zero horizontal insets so the card spans the same width as the
            // inset-grouped section containers below it.
            .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
            .listRowBackground(Color.clear)
        }
    }

    // MARK: - Preferences
    @ViewBuilder
    private var preferencesSection: some View {
        Section("Preferences") {
            // Theme changer intentionally hidden — the app ships dark-mode-only.
            // See ThemeStore (default `.dark`).
            HStack {
                if settings.isCheckingNotificationPermission {
                    SettingsRow(
                        icon: "bell.fill", iconColor: Color.appPrimary,
                        title: "Push Notifications", subtitle: "Checking permission…",
                        chevron: false
                    )
                    Spacer()
                    ProgressView()
                } else {
                    Toggle(isOn: Binding(
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
                    )) {
                        SettingsRow(
                            icon: "bell.fill", iconColor: Color.appPrimary,
                            title: "Push Notifications",
                            subtitle: settings.notificationPermission.isEnabled
                                ? "On — agent picks & alerts"
                                : "Off",
                            chevron: false
                        )
                    }
                    .tint(Color.appPrimary)
                }
            }

            // FIDELITY-WAIVER #050: Thinking Sprite picker row (RN settings.tsx:438-445)
            // not yet ported — sprite asset bundle deferred to B14 (Pixel Office).

            // WagerBot Voice row moved to SecretSettingsView while the
            // feature is incubating — not ready for general availability.

            Button { modal = .iosWidget } label: {
                SettingsRow(
                    icon: "square.grid.2x2.fill",
                    iconColor: Color(hex: 0x7C83FD),
                    title: "iOS Home Screen Widget"
                )
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Discord promo
    @ViewBuilder
    private var discordPromoSection: some View {
        Section {
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
            // Zero horizontal insets — match the Pro hero card / section width.
            .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
            .listRowBackground(Color.clear)
        }
    }

    // MARK: - Community & support
    @ViewBuilder
    private var communitySupportSection: some View {
        Section("Community & Support") {
            Button { modal = .discord } label: {
                SettingsRow(
                    icon: "bubble.left.and.bubble.right.fill",
                    iconColor: Color(hex: 0x7289DA),
                    title: "Discord Channel"
                )
            }
            .buttonStyle(.plain)

            Button {
                openURL(URL(string: "mailto:admin@wagerproof.bet?subject=Contact%20Us%20-%20WagerProof%20Mobile")!)
            } label: {
                SettingsRow(
                    icon: "envelope.fill",
                    iconColor: Color(hex: 0x42A5F5),
                    title: "Contact Us"
                )
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Legal & policies
    @ViewBuilder
    private var legalSection: some View {
        Section("Legal & Policies") {
            Button {
                openURL(URL(string: "https://wagerproof.bet/privacy-policy")!)
            } label: {
                SettingsRow(
                    icon: "shield.lefthalf.filled",
                    iconColor: Color(hex: 0x607D8B),
                    title: "Privacy Policy"
                )
            }
            .buttonStyle(.plain)

            Button {
                openURL(URL(string: "https://wagerproof.bet/terms-and-conditions")!)
            } label: {
                SettingsRow(
                    icon: "doc.text.fill",
                    iconColor: Color(hex: 0x607D8B),
                    title: "Terms of Use"
                )
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Account
    @ViewBuilder
    private var accountSection: some View {
        if case .authenticated = auth.phase {
            Section("Account") {
                // Static email row — informational only, no chevron.
                if let email = auth.profile?.email ?? authEmail {
                    SettingsRow(
                        icon: "envelope.fill",
                        iconColor: Color(hex: 0x78909C),
                        title: "Email",
                        subtitle: email,
                        chevron: false
                    )
                }

                // Logout — custom trailing so we can swap in a spinner mid-sign-out.
                Button {
                    isLogoutAlertPresented = true
                } label: {
                    HStack(spacing: 14) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .font(.system(size: 16, weight: .medium))
                            .frame(width: 34, height: 34)
                            .foregroundStyle(Color(hex: 0xFF7043))
                            .background(Color(hex: 0xFF7043).opacity(0.18),
                                        in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        Text(isSigningOut ? "Logging out…" : "Log Out")
                            .font(AppFont.headline)
                            .foregroundStyle(Color.appTextPrimary)
                        Spacer(minLength: 8)
                        if isSigningOut {
                            ProgressView()
                        } else {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Color.appTextMuted)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(isSigningOut)

                Button {
                    modal = .deleteAccount
                } label: {
                    SettingsRow(
                        icon: "exclamationmark.octagon.fill",
                        iconColor: Color(hex: 0xE53935),
                        title: "Delete Account",
                        subtitle: "Permanently delete your account and data",
                        destructive: true
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Footer

    @ViewBuilder
    private var footerSection: some View {
        Section {
            Button {
                handleVersionTap()
            } label: {
                VStack(spacing: 4) {
                    Text(appVersionString)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextMuted)
                    Text("Developed by nerds from Ohio.")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextMuted)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            .buttonStyle(.plain)
        }
        .listRowBackground(Color.clear)
    }

    // MARK: - Row primitive

    /// Native-style settings row: SF Symbol chip + title + optional subtitle +
    /// optional disclosure chevron. The chip background is derived from the icon
    /// color at 18% opacity so it reads correctly on both dark and light surfaces
    /// without requiring separate background hex tokens.
    private struct SettingsRow: View {
        let icon: String
        let iconColor: Color
        let title: String
        var subtitle: String? = nil
        var chevron: Bool = true
        var destructive: Bool = false

        var body: some View {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .medium))
                    .frame(width: 34, height: 34)
                    .foregroundStyle(iconColor)
                    .background(iconColor.opacity(0.18),
                                in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(AppFont.headline)
                        .foregroundStyle(destructive ? Color(hex: 0xE53935) : Color.appTextPrimary)
                    if let subtitle {
                        Text(subtitle)
                            .font(AppFont.caption)
                            .foregroundStyle(Color.appTextSecondary)
                            .lineLimit(2)
                    }
                }
                Spacer(minLength: 8)
                if chevron {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.appTextMuted)
                }
            }
            .contentShape(Rectangle())
        }
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
