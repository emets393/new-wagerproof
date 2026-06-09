import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Side menu sheet — the SwiftUI port of RN's `components/SideMenu.tsx`.
/// iOS HIG discourages edge-swipe drawers, so the RN drawer becomes a
/// `.sheet` presented from the toolbar hamburger on every tab root.
///
/// Spec: docs/wagerproof-migration/08-screen-native-spec.md §6 ("side panel
/// sheet"). This sheet exposes the navigation rows that don't have dedicated
/// bottom-bar slots (Agents, Picks, Feature Requests, etc.) plus account
/// actions (sign out, manage subscription, Privacy / Terms).
///
/// Full feature parity (subscription state, dark-mode toggle, secret settings
/// double-tap, RevenueCat integration) lands across B08 / B22 — this batch
/// ships the structural rows + navigation hooks. Each row that depends on a
/// not-yet-ported feature uses `ScaffoldPlaceholder` and is wired up here so
/// the menu surface stays stable as those batches land.
struct SideMenuSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @Environment(AuthStore.self) private var auth
    @Environment(ThemeStore.self) private var theme
    @Environment(MainTabStore.self) private var tabStore
    // B21 — opening the Learn walkthrough from the side menu. Same
    // dismiss-then-flip pattern as Feature Requests / Roast: iOS refuses to
    // chain sheets directly inside another sheet without flicker.
    @Environment(LearnWagerProofStore.self) private var learnStore

    var body: some View {
        NavigationStack {
            List {
                accountSection
                navigationSection
                preferencesSection
                supportSection
                legalSection
                signOutSection
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.appSurface)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .tint(Color.appPrimary)
                }
            }
        }
        .sensoryFeedback(.selection, trigger: tabStore.selected)
    }

    // MARK: - Sections

    @ViewBuilder
    private var accountSection: some View {
        if case .authenticated = auth.phase {
            Section {
                HStack(spacing: Spacing.md) {
                    Image(systemName: "person.crop.circle.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(Color.appPrimary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(auth.profile?.email ?? "Signed in")
                            .font(AppFont.bodyEmphasized)
                            .foregroundStyle(Color.appTextPrimary)
                        Text("Account")
                            .font(AppFont.caption)
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    Spacer()
                }
                .padding(.vertical, Spacing.xxs)
            }
        }
    }

    @ViewBuilder
    private var navigationSection: some View {
        Section {
            tabRow(title: "Games", systemImage: "trophy.fill", tab: .games)
            tabRow(title: "Agents", systemImage: "brain.head.profile", tab: .agents)
            tabRow(title: "Outliers", systemImage: "bell.badge.fill", tab: .outliers)
            tabRow(title: "Scoreboard", systemImage: "sportscourt.fill", tab: .scoreboard)
        } header: {
            Text("Navigate")
        }

        Section {
            // Picks + Settings were removed from the bottom bar but stay
            // reachable here. Both use the dismiss-then-flip dance: close
            // the menu sheet first, then flip the flag on `MainTabStore`
            // that `MainTabView` observes to present the sheet.
            picksRow
            settingsRow
            featureRequestsRow
            roastRow
            learnRow
        } header: {
            Text("More")
        }
    }

    /// Settings row. Picks-style dismiss-then-flip — Settings is no longer a
    /// tab; it presents as a sheet driven by `tabStore.isSettingsPresented`.
    @ViewBuilder
    private var settingsRow: some View {
        Button {
            dismiss()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                tabStore.isSettingsPresented = true
            }
        } label: {
            HStack {
                Label("Settings", systemImage: "gearshape.fill")
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(Color.appTextMuted)
                    .font(.system(size: 12, weight: .semibold))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Picks row. Same dismiss-then-flip dance as Feature Requests / Roast —
    /// the menu sheet closes first, then MainTabView presents PicksView via
    /// `isPicksPresented`.
    @ViewBuilder
    private var picksRow: some View {
        Button {
            dismiss()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                tabStore.isPicksPresented = true
            }
        } label: {
            HStack {
                Label("Picks", systemImage: "star.fill")
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(Color.appTextMuted)
                    .font(.system(size: 12, weight: .semibold))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var preferencesSection: some View {
        Section {
            @Bindable var themeBinding = theme
            Picker(selection: $themeBinding.mode) {
                Text("System").tag(ThemeStore.Mode.system)
                Text("Light").tag(ThemeStore.Mode.light)
                Text("Dark").tag(ThemeStore.Mode.dark)
            } label: {
                Label("Appearance", systemImage: "circle.lefthalf.filled")
            }
        } header: {
            Text("Preferences")
        }
    }

    @ViewBuilder
    private var supportSection: some View {
        Section {
            Button {
                openURL(URL(string: "https://discord.gg/gwy9y7XSDV")!)
            } label: {
                Label("Discord Channel", systemImage: "bubble.left.and.bubble.right.fill")
            }
            .tint(Color.appTextPrimary)

            Button {
                if let url = URL(string: "mailto:admin@wagerproof.bet?subject=\("Contact Us — Wagerproof iOS".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") {
                    openURL(url)
                }
            } label: {
                Label("Contact Us", systemImage: "envelope.fill")
            }
            .tint(Color.appTextPrimary)
        } header: {
            Text("Support")
        }
    }

    @ViewBuilder
    private var legalSection: some View {
        Section {
            Button {
                openURL(URL(string: "https://wagerproof.bet/privacy-policy")!)
            } label: {
                Label("Privacy Policy", systemImage: "lock.shield.fill")
            }
            .tint(Color.appTextPrimary)

            Button {
                openURL(URL(string: "https://wagerproof.bet/terms-and-conditions")!)
            } label: {
                Label("Terms & Conditions", systemImage: "doc.text.fill")
            }
            .tint(Color.appTextPrimary)
        } header: {
            Text("Legal")
        } footer: {
            Text("Wagerproof v3.5.5")
                .font(AppFont.caption)
                .foregroundStyle(Color.appTextMuted)
        }
    }

    @ViewBuilder
    private var signOutSection: some View {
        if case .authenticated = auth.phase {
            Section {
                Button(role: .destructive) {
                    Task {
                        await auth.signOut()
                        dismiss()
                    }
                } label: {
                    Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        .foregroundStyle(Color.appLoss)
                }
            }
        }
    }

    // MARK: - Helpers

    /// Renders a row that switches the active tab and dismisses the sheet.
    /// Mirrors the RN side menu's `router.push(...)` → drawer close flow.
    private func tabRow(title: String, systemImage: String, tab: MainTabStore.Tab) -> some View {
        Button {
            tabStore.select(tab)
            dismiss()
        } label: {
            HStack {
                Label(title, systemImage: systemImage)
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                if tabStore.selected == tab {
                    Image(systemName: "checkmark")
                        .foregroundStyle(Color.appPrimary)
                        .font(.system(size: 13, weight: .semibold))
                } else {
                    Image(systemName: "chevron.right")
                        .foregroundStyle(Color.appTextMuted)
                        .font(.system(size: 12, weight: .semibold))
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Feature Requests row (B09). Dismisses the side menu sheet, then flips
    /// the tab store's `isFeatureRequestsPresented` flag so `MainTabView`
    /// presents `FeatureRequestsView` as its own sheet. We can't chain sheet
    /// presentations directly inside this view because dismissing the
    /// menu would tear down the FR sheet alongside it.
    @ViewBuilder
    private var featureRequestsRow: some View {
        Button {
            dismiss()
            // Defer the flag flip until the menu sheet is fully gone — iOS
            // refuses to present a new sheet while one is still on screen.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                tabStore.isFeatureRequestsPresented = true
            }
        } label: {
            HStack {
                Label("Feature Requests", systemImage: "lightbulb.fill")
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(Color.appTextMuted)
                    .font(.system(size: 12, weight: .semibold))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Roast row (B19). Same dismiss-then-flip-flag dance as feature requests
    /// — chaining sheets directly inside the menu sheet would orphan the
    /// presentation. The cover lives on `MainTabView`.
    @ViewBuilder
    private var roastRow: some View {
        Button {
            dismiss()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                tabStore.isRoastPresented = true
            }
        } label: {
            HStack {
                // `flame.fill` per the canonical SF Symbol map (08-spec §A.6
                // — flame / hot pick), which matches the "roast" semantic.
                Label("Roast Mode", systemImage: "flame.fill")
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(Color.appTextMuted)
                    .font(.system(size: 12, weight: .semibold))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Learn WagerProof row (B21). Same dismiss-then-flip dance as Feature
    /// Requests / Roast: the side menu sheet must close before the Learn
    /// walkthrough sheet can present cleanly from MainTabView.
    @ViewBuilder
    private var learnRow: some View {
        Button {
            dismiss()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                learnStore.openSheet(.createAgent)
            }
        } label: {
            HStack {
                Label("Learn WagerProof", systemImage: "graduationcap.fill")
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(Color.appTextMuted)
                    .font(.system(size: 12, weight: .semibold))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

}
