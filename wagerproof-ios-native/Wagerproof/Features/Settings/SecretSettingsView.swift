import SwiftUI
import WagerproofDesign
import WagerproofServices
import WagerproofStores
#if canImport(UserNotifications)
import UserNotifications
#endif

/// Secret/Developer settings — port of `wagerproof-mobile/app/(modals)/secret-settings.tsx`.
///
/// Reached via the 2-tap shortcut on the App Version row in `SettingsView`.
/// Surfaces dev-only toggles + diagnostics:
///   - Simulate Freemium (force `RevenueCatStore.forceFreemiumMode = true`)
///   - Admin Mode toggle (only shown when `adminMode.canEnableAdminMode`)
///   - Push diagnostics / register & test
///   - RevenueCat sync / fetch offerings / present paywall
///   - Reset onboarding
struct SecretSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthStore.self) private var auth
    @Environment(RevenueCatStore.self) private var revenueCat
    @Environment(AdminModeStore.self) private var adminMode
    @Environment(OnboardingStore.self) private var onboarding
    #if DEBUG
    @Environment(DebugDataModeStore.self) private var debugDataMode
    #endif
    @State private var diagnosticsMessage: DiagMessage?
    @State private var isPaywallPresented = false

    private struct DiagMessage: Identifiable {
        let id = UUID()
        let title: String
        let body: String
        /// When true, tapping OK on the alert also dismisses the SecretSettings
        /// sheet. Used after Reset Onboarding so the user immediately lands
        /// back on the (now-active) onboarding wizard instead of seeing the
        /// SecretSettings sheet still pinned over a defunct MainTabView.
        var dismissOnAck: Bool = false
    }

    var body: some View {
        NavigationStack {
            Form {
                testingTogglesSection
                diagnosticsSection
                if case let .authenticated(userId) = auth.phase {
                    Section("Info") {
                        labelRow("User ID", value: userId.uuidString)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.appSurface.ignoresSafeArea())
            .navigationTitle("Developer")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 17, weight: .semibold))
                    }
                    .tint(Color.appTextPrimary)
                    .accessibilityLabel("Back")
                }
            }
            .alert(item: $diagnosticsMessage) { msg in
                Alert(
                    title: Text(msg.title),
                    message: Text(msg.body),
                    dismissButton: .default(Text("OK")) {
                        if msg.dismissOnAck { dismiss() }
                    }
                )
            }
            .sheet(isPresented: $isPaywallPresented) {
                RevenueCatPaywallView(placementId: RevenueCatService.Placement.genericFeature)
            }
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var testingTogglesSection: some View {
        Section("Testing Toggles") {
            @Bindable var rcBinding = revenueCat
            Toggle(isOn: $rcBinding.forceFreemiumMode) {
                rowLabel(
                    icon: "person.crop.circle.badge.exclamationmark",
                    iconColor: Color(hex: 0xF59E0B),
                    iconBackground: Color(hex: 0xFFF8E6),
                    title: "Simulate Freemium",
                    subtitle: revenueCat.forceFreemiumMode
                        ? "Viewing as non-subscriber"
                        : "Test the app as a non-subscriber"
                )
            }
            .tint(Color.appPrimary)

            if adminMode.canEnableAdminMode {
                @Bindable var adminBinding = adminMode
                Toggle(isOn: Binding(
                    get: { adminMode.adminModeEnabled },
                    set: { _ in adminMode.toggleAdminMode() }
                )) {
                    rowLabel(
                        icon: "checkmark.shield.fill",
                        iconColor: Color(hex: 0x22C55E),
                        iconBackground: Color(hex: 0xE9F8F0),
                        title: "Admin Mode",
                        subtitle: adminMode.adminModeEnabled
                            ? "Admin features enabled"
                            : "Enable editor picks management"
                    )
                }
                .tint(Color.appPrimary)
            }

            #if DEBUG
            // Offseason UI development: serve a captured slate of real
            // historical games so cards / details / widgets all populate.
            @Bindable var dummyBinding = debugDataMode
            Toggle(isOn: $dummyBinding.enabled) {
                rowLabel(
                    icon: "wand.and.stars",
                    iconColor: Color(hex: 0x8B5CF6),
                    iconBackground: Color(hex: 0xF3EEFF),
                    title: "Dummy Data Mode",
                    subtitle: debugDataMode.enabled
                        ? "Serving real captured sample games"
                        : "Populate cards & widgets in the offseason"
                )
            }
            .tint(Color.appPrimary)
            #endif
        }
    }

    @ViewBuilder
    private var diagnosticsSection: some View {
        Section("Diagnostics") {
            Button {
                Task { await runPushDiagnostics() }
            } label: {
                row(
                    icon: "stethoscope",
                    iconColor: Color(hex: 0xF59E0B),
                    iconBackground: Color(hex: 0xFFF8E6),
                    title: "Push Diagnostics",
                    subtitle: "Check device, permission, token, and DB status"
                )
            }
            .buttonStyle(.plain)

            Button {
                Task { await registerAndTestPush() }
            } label: {
                row(
                    icon: "bell.badge.fill",
                    iconColor: Color(hex: 0x22C55E),
                    iconBackground: Color(hex: 0xE9F8F0),
                    title: "Register & Test Push",
                    subtitle: "Request permission, register token, send notification"
                )
            }
            .buttonStyle(.plain)

            Button {
                Task { await syncRevenueCat() }
            } label: {
                row(
                    icon: "arrow.triangle.2.circlepath",
                    iconColor: Color(hex: 0x2A86FF),
                    iconBackground: Color(hex: 0xEDF5FF),
                    title: "Sync Offerings",
                    subtitle: "Force refresh from RevenueCat servers"
                )
            }
            .buttonStyle(.plain)

            Button {
                Task { await checkOfferings() }
            } label: {
                row(
                    icon: "shippingbox.fill",
                    iconColor: Color(hex: 0x2A86FF),
                    iconBackground: Color(hex: 0xEDF5FF),
                    title: "Check Offerings",
                    subtitle: "Debug available RevenueCat offerings"
                )
            }
            .buttonStyle(.plain)

            Button {
                isPaywallPresented = true
            } label: {
                row(
                    icon: "creditcard.fill",
                    iconColor: Color(hex: 0x2A86FF),
                    iconBackground: Color(hex: 0xEDF5FF),
                    title: "Test Paywall",
                    subtitle: "Present the dynamic paywall"
                )
            }
            .buttonStyle(.plain)

            Button {
                Task { await resetOnboarding() }
            } label: {
                row(
                    icon: "arrow.counterclockwise",
                    iconColor: Color(hex: 0xD16A00),
                    iconBackground: Color(hex: 0xFFF0E1),
                    title: "Reset Onboarding",
                    subtitle: "Go through the onboarding flow again"
                )
            }
            .buttonStyle(.plain)

            // FIDELITY-WAIVER #053: Three WagerBot admin rows (Reset Suggestions,
            // Refresh Cache, Resync Threads) deferred to B17 (Chat batch) which
            // owns WagerBotSuggestionStore + WagerBotChatStore.

            // FIDELITY-WAIVER #055: Meta SDK Events row (Subscribe / StartTrial /
            // CompleteRegistration) not surfaced in Secret Settings — Meta SDK
            // integration lands with the post-cutover analytics sweep.
        }
    }

    // MARK: - Actions

    private func runPushDiagnostics() async {
        var lines: [String] = []
        lines.append("Platform: iOS")
        lines.append("Device model: \(deviceModel())")
        let status = await NotificationService.shared.permissionStatus()
        lines.append("Permission: \(status.rawValue)")
        let token = NotificationService.shared.currentDeviceToken() ?? "<none>"
        lines.append("APNs token: \(token.prefix(30))…")
        if case let .authenticated(userId) = auth.phase {
            lines.append("User ID: \(userId.uuidString)")
        } else {
            lines.append("User: not logged in")
        }
        diagnosticsMessage = DiagMessage(title: "Push Diagnostics", body: lines.joined(separator: "\n"))
    }

    private func registerAndTestPush() async {
        guard case let .authenticated(userId) = auth.phase else {
            diagnosticsMessage = DiagMessage(title: "Error", body: "Must be logged in")
            return
        }
        let status = await NotificationService.shared.permissionStatus()
        if status != .granted {
            let next = await NotificationService.shared.requestPermission()
            if next != .granted {
                diagnosticsMessage = DiagMessage(
                    title: "Permission Denied",
                    body: "Status: \(next.rawValue). Cannot send push without permission."
                )
                return
            }
        }
        await NotificationService.shared.initialize()
        await NotificationService.shared.registerPushToken(userId: userId)
        await scheduleLocalTestNotification()
        diagnosticsMessage = DiagMessage(
            title: "Test Scheduled",
            body: "A local test notification will fire in ~3 seconds. Token registered with Supabase for delivery testing."
        )
    }

    private func scheduleLocalTestNotification() async {
        #if canImport(UserNotifications)
        let content = UNMutableNotificationContent()
        content.title = "Test Agent Picks Ready!"
        content.body = "3 new picks just dropped. Tap to view."
        content.sound = .default
        content.userInfo = ["type": "auto_pick_ready", "agent_id": "test", "run_id": "test"]
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 3, repeats: false)
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: trigger)
        try? await UNUserNotificationCenter.current().add(request)
        #endif
    }

    private func syncRevenueCat() async {
        do {
            try await revenueCat.syncPurchases()
            diagnosticsMessage = DiagMessage(title: "Success", body: "Offerings refreshed from server.")
        } catch {
            diagnosticsMessage = DiagMessage(title: "Error", body: "Failed to sync: \(error.localizedDescription)")
        }
    }

    private func checkOfferings() async {
        await revenueCat.refreshOffering()
        if let offering = revenueCat.offering {
            let packageCount = offering.availablePackages.count
            diagnosticsMessage = DiagMessage(
                title: "Offering Found",
                body: "Identifier: \(offering.identifier)\nPackages: \(packageCount)"
            )
        } else {
            diagnosticsMessage = DiagMessage(title: "No Offerings", body: "Check RevenueCat dashboard config.")
        }
    }

    private func resetOnboarding() async {
        guard case let .authenticated(userId) = auth.phase else {
            diagnosticsMessage = DiagMessage(title: "Error", body: "You must be logged in to reset onboarding")
            return
        }
        struct Update: Encodable { let onboarding_completed: Bool }
        do {
            let client = await MainSupabase.shared.client
            try await client
                .from("profiles")
                .update(Update(onboarding_completed: false))
                .eq("user_id", value: userId)
                .execute()
            // `onboarding.reset()` flips `isComplete=false` AND wipes the
            // per-user AppGroup cache key, so RootRouter swaps to .onboarding
            // immediately via the .onChange(of: onboardingStore.isComplete)
            // observer in WagerproofApp. No relaunch needed.
            onboarding.reset()
            diagnosticsMessage = DiagMessage(
                title: "Onboarding Reset",
                body: "Tap OK to return to the onboarding wizard.",
                dismissOnAck: true
            )
        } catch {
            diagnosticsMessage = DiagMessage(title: "Error", body: error.localizedDescription)
        }
    }

    private func deviceModel() -> String {
        #if canImport(UIKit)
        return UIDevice.current.model
        #else
        return "Unknown"
        #endif
    }

    // MARK: - Row helpers

    private func row(
        icon: String,
        iconColor: Color,
        iconBackground: Color,
        title: String,
        subtitle: String
    ) -> some View {
        HStack(spacing: Spacing.md) {
            rowIcon(icon, color: iconColor, background: iconBackground)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(AppFont.headline)
                    .foregroundStyle(Color.appTextPrimary)
                Text(subtitle)
                    .font(AppFont.caption)
                    .foregroundStyle(Color.appTextSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
        }
    }

    private func rowLabel(
        icon: String,
        iconColor: Color,
        iconBackground: Color,
        title: String,
        subtitle: String
    ) -> some View {
        HStack(spacing: Spacing.md) {
            rowIcon(icon, color: iconColor, background: iconBackground)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(AppFont.headline)
                    .foregroundStyle(Color.appTextPrimary)
                Text(subtitle)
                    .font(AppFont.caption)
                    .foregroundStyle(Color.appTextSecondary)
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

    private func labelRow(_ title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(AppFont.captionEmphasized)
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(AppFont.body.monospaced())
                .foregroundStyle(Color.appTextPrimary)
        }
    }
}
