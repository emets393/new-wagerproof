import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Shared chrome for the main tab pages (Games · Props · Agents · Outliers).
///
/// The layout the app uses on every main tab:
///   - Top-leading: the stylized `WagerProofWordmark` — a passive brand mark
///     (no longer a button) rendered as a faint watermark. "Proof" catches a
///     looping iOS shimmer.
///   - Top-trailing group (left → right): page-specific actions, then the
///     WagerBot launcher, then `SettingsToolbarButton` pinned as the rightmost
///     icon. The gear is the single entry point into Settings now (it used to
///     live behind the wordmark tap).
///
/// Settings opens as a pushed page on the calling tab's own `NavigationStack`
/// (via `wagerProofSettingsDestination`) rather than a modal cover — so it
/// slides in from the right like any other page and keeps the app's
/// navigation feel instead of reading as a bottom sheet. The gear button flips
/// the shell-level `MainTabStore.isSettingsPresented` flag; the side menu and
/// WagerBot upsell flip the same flag, so every entry point funnels through the
/// one per-tab destination.
///
/// These are plain `View`s (not `ToolbarContent`) so each page can drop them
/// into its own `ToolbarItem` / `ToolbarItemGroup` slots and interleave any
/// page-specific buttons. The buttons take the page's `MainTabStore`
/// explicitly rather than reading `@Environment` — environment propagation
/// into toolbar item content is unreliable across iOS versions, and the store
/// is a reference type so flipping its flags here drives the centrally-mounted
/// chrome.

/// Two-tone "Wager**Proof**" wordmark shown in the top-leading toolbar slot of
/// every main tab. A passive brand mark (not a button) at 30% opacity so it
/// reads as a faint watermark. "Proof" picks up the brand green (#00E676) — the
/// same accent used for the tab bar tint and WagerBot glyph — and catches a
/// looping shimmer; "Wager" stays in the primary text color.
struct WagerProofWordmark: View {
    var body: some View {
        // An HStack (spacing 0), not a single concatenated Text, so the shimmer
        // can mask "Proof" on its own. `.fixedSize()` is what stops the leading
        // toolbar slot from width-starving the pair down to "…".
        HStack(spacing: 0) {
            Text("Wager")
                // Translucent watermark now that it isn't interactive — kept
                // legible (not fully faded) per design feedback.
                .foregroundStyle(Color.appTextPrimary.opacity(0.55))
            Text("Proof")
                // Same translucent base, but the shimmer rides on top at full
                // strength — dimming the whole wordmark would wash the shine out,
                // so the transparency lives on the base color only.
                .foregroundStyle(Color(hex: 0x00E676).opacity(0.55))
                .modifier(TextShimmer())
        }
        // Default SF Pro design (sharper than `.rounded`), sized down a touch.
        .font(.system(size: 15, weight: .heavy))
        .fixedSize()
        // Negative leading inset pulls the mark tight to the screen edge (the
        // glass capsule that used to need breathing room is gone); small
        // trailing gap keeps it off the centered nav title.
        .padding(.leading, -8)
        .padding(.trailing, 12)
        .accessibilityLabel("WagerProof")
    }
}

/// The leading wordmark item, ready to drop into any tab's `.toolbar`. On
/// iOS 26 the toolbar would otherwise tuck the wordmark inside its own Liquid
/// Glass capsule (it reads as a button); `.sharedBackgroundVisibility(.hidden)`
/// strips that glass so the brand mark floats free as bare text. The pre-26
/// branch has no glass capsule to hide, so it just renders the item plainly.
struct WagerProofLeadingToolbarItem: ToolbarContent {
    var body: some ToolbarContent {
        if #available(iOS 26.0, *) {
            ToolbarItem(placement: .topBarLeading) {
                WagerProofWordmark()
            }
            .sharedBackgroundVisibility(.hidden)
        } else {
            ToolbarItem(placement: .topBarLeading) {
                WagerProofWordmark()
            }
        }
    }
}

/// Sweeps a bright highlight across the modified glyphs on a loop — the classic
/// iOS "shine" used on the wordmark's "Proof". A white copy of the content is
/// masked first by the glyphs (so only the letters light up) and then by a
/// moving gradient window. The window is a `scaleEffect`-magnified gradient
/// rather than a `GeometryReader`-sized band: GeometryReader reports unreliable
/// (often zero) width inside a toolbar item, which silently kills the sweep —
/// this is the markiv/SwiftUI-Shimmer trick that sidesteps it.
private struct TextShimmer: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay {
                content
                    .foregroundStyle(Color.white.opacity(0.9))
                    .mask {
                        ShimmerSweep(phase: phase)
                            // Magnify so the gradient's bright stripe travels the
                            // full width of the short word (and rests off-screen
                            // between passes) as `phase` runs 0 → 1.
                            .scaleEffect(3)
                    }
                    .allowsHitTesting(false)
            }
            .onAppear {
                withAnimation(.linear(duration: 1.6).delay(0.3).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

/// The moving bright stripe used as the shimmer mask. `Animatable` so `phase`
/// interpolates every frame instead of snapping between the 0 and 1 keyframes.
private struct ShimmerSweep: View, Animatable {
    var phase: CGFloat
    var animatableData: CGFloat {
        get { phase }
        set { phase = newValue }
    }

    var body: some View {
        LinearGradient(
            stops: [
                .init(color: .clear, location: phase - 0.08),
                .init(color: .white, location: phase),
                .init(color: .clear, location: phase + 0.08),
            ],
            startPoint: .leading,
            endPoint: .trailing
        )
    }
}

/// WagerBot launcher button — flips the shell-level chat sheet flag that
/// `MainTabView` observes. Reused across every main tab's trailing group.
struct WagerBotToolbarButton: View {
    let tabStore: MainTabStore

    var body: some View {
        Button {
            tabStore.isChatPresented = true
        } label: {
            WagerBotIcon(size: 22)
                .foregroundStyle(Color.appTextPrimary)
        }
        .tint(Color.appTextPrimary)
        .accessibilityLabel("WagerBot")
    }
}

/// Settings launcher — pinned as the rightmost icon in every main tab's
/// trailing toolbar group. Flips the shell-level `isSettingsPresented` flag
/// that each tab's `wagerProofSettingsDestination` observes. This is the single
/// entry point into Settings now that the wordmark is a passive brand mark.
struct SettingsToolbarButton: View {
    let tabStore: MainTabStore

    var body: some View {
        Button {
            tabStore.isSettingsPresented = true
        } label: {
            Image(systemName: "gearshape")
                .foregroundStyle(Color.appTextPrimary)
        }
        .tint(Color.appTextPrimary)
        .accessibilityLabel("Settings")
    }
}

extension View {
    /// Push `SettingsView` onto the calling tab's `NavigationStack` when the
    /// shell-level `isSettingsPresented` flag flips AND this tab is the one on
    /// screen. The `selected == tab` guard matters: every main tab attaches
    /// this destination to its own stack, so without it all four hidden stacks
    /// would push Settings too and the user would find it already open when
    /// switching tabs. Settings hides the tab bar while pushed, so the back
    /// button (which clears the flag via the binding's setter) is the only way
    /// out — no tab-switch-while-open edge to handle.
    func wagerProofSettingsDestination(
        tabStore: MainTabStore,
        tab: MainTabStore.Tab
    ) -> some View {
        navigationDestination(isPresented: Binding(
            get: { tabStore.isSettingsPresented && tabStore.selected == tab },
            set: { tabStore.isSettingsPresented = $0 }
        )) {
            SettingsView()
        }
    }

    /// Push `WagerBotChatView` onto the calling tab's `NavigationStack` when the
    /// shell-level `isChatPresented` flag flips AND this tab is on screen — the
    /// same pattern (and `selected == tab` guard) as `wagerProofSettingsDestination`.
    /// Makes WagerBot a real page (slides in from the right, hides the tab bar)
    /// instead of a bottom sheet.
    func wagerProofChatDestination(
        tabStore: MainTabStore,
        tab: MainTabStore.Tab
    ) -> some View {
        navigationDestination(isPresented: Binding(
            get: { tabStore.isChatPresented && tabStore.selected == tab },
            set: { tabStore.isChatPresented = $0 }
        )) {
            WagerBotChatView()
        }
    }
}
