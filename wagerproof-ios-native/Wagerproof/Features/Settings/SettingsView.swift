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
    @Environment(ThemeStore.self) private var theme
    @Environment(SettingsStore.self) private var settings
    @Environment(RevenueCatStore.self) private var revenueCat
    @Environment(AdminModeStore.self) private var adminMode
    @Environment(ProAccessStore.self) private var proAccess
    @Environment(\.openURL) private var openURL

    @State private var modal: SettingsModal?
    @State private var isVoicePresented = false
    @State private var isPaywallPresented = false

    /// Persisted WagerBot Voice personality — read here only so the settings
    /// row subtitle reflects the user's current mode. Owned/written by
    /// `WagerBotVoiceView` (same `@AppStorage` key).
    @AppStorage("wagerbot.personality") private var voicePersonality: String = "friendly"
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
            dangerSection
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
        .fullScreenCover(isPresented: $isVoicePresented) {
            WagerBotVoiceView()
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
            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
            .listRowBackground(Color.clear)
        }
    }

    // MARK: - Preferences
    @ViewBuilder
    private var preferencesSection: some View {
        Section("Preferences") {
            @Bindable var binding = theme
            Toggle(isOn: Binding(
                get: { theme.mode != .light },
                set: { newValue in
                    theme.mode = newValue ? .dark : .light
                }
            )) {
                rowLabel(
                    icon: "circle.righthalf.filled",
                    iconColor: Color(hex: 0x5F56D8),
                    iconBackground: Color(hex: 0xF1EFFF),
                    title: "Dark Mode",
                    subtitle: theme.mode == .dark ? "Dark theme enabled" : "Light theme enabled"
                )
            }
            .tint(Color.appPrimary)

            @Bindable var settingsBinding = settings
            Toggle(isOn: $settingsBinding.wagerBotSuggestionsEnabled) {
                rowLabel(
                    icon: "bubble.left.fill",
                    iconColor: Color(hex: 0x2B9E76),
                    iconBackground: Color(hex: 0xE9F8F2),
                    title: "WagerBot Suggestions",
                    subtitle: settings.wagerBotSuggestionsEnabled
                        ? "Proactive suggestions enabled"
                        : "Suggestions are off"
                )
            }
            .tint(Color.appPrimary)

            HStack {
                if settings.isCheckingNotificationPermission {
                    rowLabel(
                        icon: "bell.fill",
                        iconColor: Color(hex: 0xE65100),
                        iconBackground: Color(hex: 0xFFF3E0),
                        title: "Push Notifications",
                        subtitle: "Checking permission…"
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
                                    if result == .denied {
                                        notificationDeniedAlert = true
                                    }
                                } else {
                                    await settings.disableNotifications(userId: currentUserId)
                                }
                            }
                        }
                    )) {
                        rowLabel(
                            icon: "bell.fill",
                            iconColor: Color(hex: 0xE65100),
                            iconBackground: Color(hex: 0xFFF3E0),
                            title: "Push Notifications",
                            subtitle: settings.notificationPermission.isEnabled
                                ? "Get notified when agent picks are ready"
                                : "Notifications are off"
                        )
                    }
                    .tint(Color.appPrimary)
                }
            }

            // FIDELITY-WAIVER #050: Thinking Sprite picker row (RN settings.tsx:438-445)
            // not yet ported — sprite asset bundle deferred to B14 (Pixel Office).

            // WagerBot Voice — opens the realtime voice chat full-screen.
            // Subtitle reflects the current personality mode (Friendly/Spicy).
            Button {
                isVoicePresented = true
            } label: {
                row(
                    icon: "waveform",
                    iconColor: Color(hex: 0x16A34A),
                    iconBackground: Color(hex: 0xE9F8F2),
                    title: "WagerBot Voice",
                    subtitle: voicePersonality == "spicy"
                        ? "Spicy mode — talk picks out loud"
                        : "Friendly mode — talk picks out loud"
                )
            }
            .buttonStyle(.plain)

            // iOS Home Screen Widget row — iOS-only feature so the row is
            // always visible on this build.
            Button {
                modal = .iosWidget
            } label: {
                row(
                    icon: "square.grid.2x2.fill",
                    iconColor: Color(hex: 0xF08B00),
                    iconBackground: Color(hex: 0xFFF2DE),
                    title: "iOS Home Screen Widget",
                    subtitle: "Add a quick access widget"
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
            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
            .listRowBackground(Color.clear)
        }
    }

    // MARK: - Community & support
    @ViewBuilder
    private var communitySupportSection: some View {
        Section("Community & Support") {
            Button { modal = .discord } label: {
                row(
                    icon: "bubble.left.and.bubble.right.fill",
                    iconColor: Color(hex: 0x7289DA),
                    iconBackground: Color(hex: 0xEEF1FF),
                    title: "Discord Channel",
                    subtitle: proAccess.isPro ? "Join our community" : "Member community access"
                )
            }
            .buttonStyle(.plain)

            Button {
                openURL(URL(string: "mailto:admin@wagerproof.bet?subject=Contact%20Us%20-%20WagerProof%20Mobile")!)
            } label: {
                row(
                    icon: "envelope.fill",
                    iconColor: Color(hex: 0xEB7A00),
                    iconBackground: Color(hex: 0xFFF1E3),
                    title: "Contact Us",
                    subtitle: "Reach support directly"
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
                row(
                    icon: "shield.lefthalf.filled",
                    iconColor: Color(hex: 0xF4A000),
                    iconBackground: Color(hex: 0xFFF6DF),
                    title: "Privacy Policy",
                    subtitle: "How we collect and use data"
                )
            }
            .buttonStyle(.plain)

            Button {
                openURL(URL(string: "https://wagerproof.bet/terms-and-conditions")!)
            } label: {
                row(
                    icon: "doc.text.fill",
                    iconColor: Color(hex: 0xF4A000),
                    iconBackground: Color(hex: 0xFFF6DF),
                    title: "Terms of Use",
                    subtitle: "Service terms and billing rules"
                )
            }
            .buttonStyle(.plain)

            Button {
                handleVersionTap()
            } label: {
                row(
                    icon: "info.circle.fill",
                    iconColor: Color(hex: 0x8B8B8B),
                    iconBackground: Color(hex: 0xF4F1EC),
                    title: "App Version",
                    subtitle: appVersionString
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
                // The signed-in account's email leads the section so the user
                // can confirm which account they're in before signing out.
                // Static row (no chevron) — informational, not tappable.
                if let email = auth.profile?.email ?? authEmail {
                    row(
                        icon: "envelope.fill",
                        iconColor: Color(hex: 0xEB7A00),
                        iconBackground: Color(hex: 0xFFF1E3),
                        title: "Email",
                        subtitle: email,
                        chevron: false
                    )
                }
                Button {
                    isLogoutAlertPresented = true
                } label: {
                    row(
                        icon: "rectangle.portrait.and.arrow.right",
                        iconColor: Color(hex: 0xD16A00),
                        iconBackground: Color(hex: 0xFFF0E1),
                        title: isSigningOut ? "Logging out…" : "Log Out",
                        subtitle: "Sign out of this device",
                        trailing: {
                            if isSigningOut {
                                ProgressView()
                            } else {
                                chevron()
                            }
                        }
                    )
                }
                .buttonStyle(.plain)
                .disabled(isSigningOut)
            }
        }
    }

    @ViewBuilder
    private var dangerSection: some View {
        if case .authenticated = auth.phase {
            Section("Danger Zone") {
                Button {
                    modal = .deleteAccount
                } label: {
                    row(
                        icon: "exclamationmark.octagon.fill",
                        iconColor: Color(hex: 0xDD4D3F),
                        iconBackground: Color(hex: 0xFFF0EE),
                        title: "Delete Account",
                        subtitle: "Opens the delete-account tool with swipe confirmation",
                        destructive: true
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Row primitive

    /// A compact `HStack` row that matches the RN `ActionRow`: rounded icon
    /// chip on the left, two-line text in the middle, optional trailing
    /// view on the right.
    private func row<Trailing: View>(
        icon: String,
        iconColor: Color,
        iconBackground: Color,
        title: String,
        subtitle: String? = nil,
        destructive: Bool = false,
        chevron: Bool = true,
        @ViewBuilder trailing: () -> Trailing
    ) -> some View {
        HStack(spacing: Spacing.md) {
            rowIcon(icon, color: iconColor, background: iconBackground)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(AppFont.headline)
                    .foregroundStyle(destructive ? Color(hex: 0xDD4D3F) : Color.appTextPrimary)
                if let subtitle {
                    Text(subtitle)
                        .font(AppFont.caption)
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 8)
            trailing()
        }
        .contentShape(Rectangle())
    }

    private func row(
        icon: String,
        iconColor: Color,
        iconBackground: Color,
        title: String,
        subtitle: String? = nil,
        destructive: Bool = false,
        chevron showChevron: Bool = true
    ) -> some View {
        row(
            icon: icon,
            iconColor: iconColor,
            iconBackground: iconBackground,
            title: title,
            subtitle: subtitle,
            destructive: destructive,
            chevron: showChevron,
            trailing: { showChevron ? AnyView(chevron()) : AnyView(EmptyView()) }
        )
    }

    private func rowLabel(
        icon: String,
        iconColor: Color,
        iconBackground: Color,
        title: String,
        subtitle: String? = nil
    ) -> some View {
        HStack(spacing: Spacing.md) {
            rowIcon(icon, color: iconColor, background: iconBackground)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(AppFont.headline)
                    .foregroundStyle(Color.appTextPrimary)
                if let subtitle {
                    Text(subtitle)
                        .font(AppFont.caption)
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
        }
    }

    private func rowIcon(_ system: String, color: Color, background: Color) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 13)
                .fill(background)
                .frame(width: 42, height: 42)
            Image(systemName: system)
                .font(.system(size: 18, weight: .regular))
                .foregroundStyle(color)
        }
    }

    private func chevron() -> some View {
        Image(systemName: "chevron.right")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color.appTextMuted)
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
