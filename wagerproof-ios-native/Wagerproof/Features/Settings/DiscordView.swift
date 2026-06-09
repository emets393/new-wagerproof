import SwiftUI
import WagerproofDesign
import WagerproofStores
import WagerproofServices

/// Discord modal — the SwiftUI port of `wagerproof-mobile/app/(modals)/discord.tsx`.
///
/// Two states:
///   1. Non-Pro user → locked card with "Unlock with Pro" CTA that opens the
///      paywall (matches RN).
///   2. Pro user → two-step join flow:
///        Step 1 — Link Discord account via the Supabase `discord-callback`
///                 edge function URL (opens Safari).
///        Step 2 — Join the Discord invite (https://discord.gg/gwy9y7XSDV).
///
/// The Discord link status comes from `profiles.discord_user_id` — same
/// column RN reads.
struct DiscordView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @Environment(AuthStore.self) private var auth
    @Environment(ProAccessStore.self) private var proAccess
    @State private var isPaywallPresented = false
    @State private var discordLinked: Bool? = nil
    @State private var isCheckingLink = true

    private let inviteURL = URL(string: "https://discord.gg/gwy9y7XSDV")!
    private let linkURLBase = "https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/discord-callback"

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.xl) {
                    heroBlock

                    if proAccess.isPro {
                        proStateCards
                    } else {
                        lockedCard
                    }

                    benefitsList

                    Text("By joining our Discord server, you agree to follow our community guidelines and Discord's Terms of Service")
                        .font(AppFont.caption)
                        .foregroundStyle(Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Spacing.lg)
                }
                .padding(.vertical, Spacing.lg)
            }
            .background(Color.appSurface.ignoresSafeArea())
            .navigationTitle("Discord")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .tint(Color.appTextPrimary)
                    .accessibilityLabel("Close")
                }
            }
            .task {
                await checkDiscordLink()
            }
            .sheet(isPresented: $isPaywallPresented) {
                RevenueCatPaywallView(placementId: RevenueCatService.Placement.genericFeature)
            }
        }
    }

    // MARK: - Hero

    private var heroBlock: some View {
        VStack(spacing: Spacing.lg) {
            ZStack {
                LinearGradient(
                    colors: [Color(hex: 0x5865F2), Color(hex: 0x7289DA)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                Image(systemName: "bubble.left.and.bubble.right.fill")
                    .font(.system(size: 50))
                    .foregroundStyle(.white)
            }
            .frame(width: 100, height: 100)
            .clipShape(Circle())
            .shadow(color: Color(hex: 0x5865F2).opacity(0.3), radius: 16, y: 8)

            Text("Join Our Discord Community")
                .font(AppFont.display)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextPrimary)
                .padding(.horizontal, Spacing.lg)
        }
    }

    // MARK: - Pro state

    @ViewBuilder
    private var proStateCards: some View {
        VStack(spacing: Spacing.lg) {
            // Step 1 — Link Discord
            stepCard(
                iconBackgroundColor: discordLinked == true
                    ? Color(hex: 0x22D35F).opacity(0.15)
                    : Color(hex: 0x5865F2).opacity(0.15),
                iconColor: discordLinked == true ? Color(hex: 0x22D35F) : Color(hex: 0x5865F2),
                iconName: discordLinked == true ? "checkmark.circle.fill" : "link",
                title: discordLinked == true
                    ? "Discord Account Linked!"
                    : "Step 1: Link Your Discord Account",
                description: discordLinked == true
                    ? "Your Discord account is connected. You have the WagerProof Member role and full access to subscriber-only channels."
                    : "Link your Discord account to verify your subscription and get the WagerProof Member role with access to exclusive channels.",
                showButton: discordLinked == false,
                buttonLabel: "Link Discord Account",
                buttonIcon: "link"
            ) {
                handleLinkDiscord()
            }

            // Step 2 — Join Discord
            stepCard(
                iconBackgroundColor: Color(hex: 0x22D35F).opacity(0.15),
                iconColor: Color(hex: 0x22D35F),
                iconName: "checkmark.shield.fill",
                title: discordLinked == true
                    ? "You're all set! Join the server below."
                    : "Step 2: Join the Discord Server",
                description: "Click below to join other community members! Enable notifications to receive instant alerts for Editors Picks on your phone, and share betting insights, strategies, and analysis with the community.",
                showButton: true,
                buttonLabel: "Join Discord Server",
                buttonIcon: "bubble.left.and.bubble.right.fill"
            ) {
                openURL(inviteURL)
            }
        }
        .padding(.horizontal, Spacing.lg)
    }

    // MARK: - Locked

    private var lockedCard: some View {
        VStack(spacing: Spacing.lg) {
            HStack(spacing: 6) {
                Image(systemName: "crown.fill")
                    .font(.system(size: 14))
                Text("PRO FEATURE")
                    .font(.system(size: 13, weight: .bold))
                    .tracking(0.5)
            }
            .foregroundStyle(Color(hex: 0xD97706))
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 6)
            .background(Color(hex: 0xD97706).opacity(0.15))
            .clipShape(Capsule())

            ZStack {
                Circle()
                    .fill(Color(hex: 0x22D35F).opacity(0.15))
                    .frame(width: 80, height: 80)
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 40))
                    .foregroundStyle(Color(hex: 0x22D35F))
            }

            Text("Unlock our private Discord server!")
                .font(AppFont.title)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextPrimary)

            Text("Get instant alerts for Editors Picks on your phone, and share betting insights, strategies, and analysis with the community.")
                .font(AppFont.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextSecondary)

            Button {
                isPaywallPresented = true
            } label: {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "lock.open.fill")
                    Text("Unlock with Pro")
                }
                .font(AppFont.bodyEmphasized)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(
                    LinearGradient(
                        colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }
        .padding(Spacing.lg)
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, Spacing.lg)
    }

    @ViewBuilder
    private func stepCard(
        iconBackgroundColor: Color,
        iconColor: Color,
        iconName: String,
        title: String,
        description: String,
        showButton: Bool,
        buttonLabel: String,
        buttonIcon: String,
        action: @escaping () -> Void
    ) -> some View {
        VStack(spacing: Spacing.md) {
            ZStack {
                Circle()
                    .fill(iconBackgroundColor)
                    .frame(width: 80, height: 80)
                Image(systemName: iconName)
                    .font(.system(size: 36))
                    .foregroundStyle(iconColor)
            }

            Text(title)
                .font(AppFont.title)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextPrimary)

            Text(description)
                .font(AppFont.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextSecondary)

            if showButton {
                Button(action: action) {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: buttonIcon)
                        Text(buttonLabel)
                    }
                    .font(AppFont.bodyEmphasized)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.md)
                    .background(
                        LinearGradient(
                            colors: [Color(hex: 0x5865F2), Color(hex: 0x7289DA)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
            }
        }
        .padding(Spacing.lg)
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Benefits

    private var benefitsList: some View {
        VStack(spacing: Spacing.md) {
            benefit(icon: "person.3.fill", title: "Active Community",
                    body: "Connect with subscribers who share your passion for smart betting")
            benefit(icon: "bell.badge.fill", title: "Push Notifications",
                    body: "Get instant Editors Picks alerts sent directly to your phone")
            benefit(icon: "lock.shield.fill", title: "Exclusive Access",
                    body: "Subscriber-only channels with premium content and analysis")
        }
        .padding(.horizontal, Spacing.lg)
    }

    private func benefit(icon: String, title: String, body: String) -> some View {
        VStack(spacing: Spacing.sm) {
            ZStack {
                Circle()
                    .fill(Color(hex: 0x22D35F).opacity(0.15))
                    .frame(width: 60, height: 60)
                Image(systemName: icon)
                    .font(.system(size: 26))
                    .foregroundStyle(Color(hex: 0x22D35F))
            }
            Text(title)
                .font(AppFont.headline)
                .foregroundStyle(Color.appTextPrimary)
            Text(body)
                .font(AppFont.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity)
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Backend

    /// Probe Supabase for the active user's `discord_user_id`. Byte-identical
    /// to RN's check inside `useEffect` (discord.tsx:35–50).
    private func checkDiscordLink() async {
        guard case let .authenticated(userId) = auth.phase else {
            isCheckingLink = false
            return
        }
        do {
            let client = await MainSupabase.shared.client
            let row: DiscordLinkRow = try await client
                .from("profiles")
                .select("discord_user_id")
                .eq("user_id", value: userId)
                .single()
                .execute()
                .value
            discordLinked = (row.discord_user_id?.isEmpty == false)
        } catch {
            // Treat unknown as "not linked" — same fallback as RN.
            discordLinked = false
        }
        isCheckingLink = false
    }

    private func handleLinkDiscord() {
        guard case let .authenticated(userId) = auth.phase else { return }
        if let url = URL(string: "\(linkURLBase)?user_id=\(userId.uuidString)") {
            openURL(url)
        }
    }

    private struct DiscordLinkRow: Decodable {
        let discord_user_id: String?
    }
}
