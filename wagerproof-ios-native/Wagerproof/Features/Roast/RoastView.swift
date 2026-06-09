import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Voice-driven "roast me about my worst bets" screen. SwiftUI port of
/// `wagerproof-mobile/components/roast/RoastScreen.tsx` (300+ lines)
/// + the `useRoastSession` hook.
///
/// Layout (matches spec §5):
///   ZStack (dark gradient background)
///     VStack {
///       custom header  -> back / "Roast Mode" / clear
///       intensity selector pills
///       optional status banner (connecting / error)
///       ScrollView { messages + live transcripts }
///       bottom section (orb + status text + mic button)
///     }
///
/// Stylistic mirror: Honeydew's `RoastChefView` uses a similar
/// dramatic/conversational layout with a centered orb + bottom controls.
/// We borrow the visual rhythm (header → animated focal point → mic CTA)
/// while keeping every brand token Wagerproof green.
///
/// Reached via `SideMenuSheet` "Roast" row → `tabStore.isRoastPresented`
/// flag → `MainTabView` presents this view as a full-screen sheet. NOT a
/// bottom-bar tab.
struct RoastView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store: RoastSessionStore
    @State private var showClearConfirm: Bool = false

    /// Production callers use the default initializer.
    init() {
        _store = State(initialValue: RoastSessionStore())
    }

    /// DEBUG init for the screenshot harness — accepts a pre-seeded store
    /// so the view can render empty / loaded / error states deterministically
    /// without an actual Gemini Live session.
    #if DEBUG
    init(store: RoastSessionStore) {
        _store = State(initialValue: store)
    }
    #endif

    var body: some View {
        ZStack {
            // Full-bleed dark gradient. RN: ['#0a0a0a', '#111827', '#0a0a0a'].
            LinearGradient(
                colors: [
                    Color(hex: 0x0A0A0A),
                    Color(hex: 0x111827),
                    Color(hex: 0x0A0A0A),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                header

                RoastIntensitySelectorView(
                    intensity: store.intensity,
                    onChange: { intensity in
                        await store.setIntensity(intensity)
                    }
                )
                .padding(.horizontal, 16)

                statusBanners

                conversation

                bottomSection
            }
        }
        .preferredColorScheme(.dark)
        // Hide the system nav bar — we draw our own header per RN parity.
        .navigationBarHidden(true)
        // Spec §5 haptics — `.sensoryFeedback` fires on counter bumps from
        // the store. Each counter only ticks when the relevant event happens.
        .sensoryFeedback(.impact(weight: .heavy), trigger: store.micToggleCount)
        .sensoryFeedback(.selection, trigger: store.intensityChangeCount)
        .sensoryFeedback(.success, trigger: store.connectionEventCount)
        .sensoryFeedback(.error, trigger: store.errorEventCount)
        .task {
            // Mirror RN's `useEffect(() => connectService(intensity), [intensity])`.
            // The store's `connect()` is a no-op until a driver is attached;
            // for B19 the surface ships without the audio driver, so the
            // status banner flickers `Connecting…` once and resolves to idle.
            await store.connect()
        }
        .onDisappear {
            // Tear down the (possibly nil) driver so a long-lived store
            // instance doesn't keep a socket open after dismiss.
            Task { await store.disconnect() }
        }
        .confirmationDialog(
            "Clear conversation?",
            isPresented: $showClearConfirm,
            titleVisibility: .visible
        ) {
            Button("Clear", role: .destructive) {
                Task { await store.clearConversation() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The Bookie will forget everything you've said this session.")
        }
    }

    // MARK: - Header (back / title / clear)

    @ViewBuilder
    private var header: some View {
        HStack {
            Button {
                dismiss()
            } label: {
                Image(systemName: "arrow.left")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44, alignment: .leading)
                    .padding(.leading, 8)
            }
            .accessibilityLabel("Close roast")

            Spacer()

            Text("Roast Mode")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(.white)

            Spacer()

            Button {
                showClearConfirm = true
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44, alignment: .trailing)
                    .padding(.trailing, 8)
            }
            .accessibilityLabel("Clear conversation")
        }
        .padding(.top, 8)
        .padding(.bottom, 8)
    }

    // MARK: - Connecting / error banners

    @ViewBuilder
    private var statusBanners: some View {
        VStack(spacing: 6) {
            if store.isConnecting {
                statusBanner(
                    text: "Connecting to The Bookie...",
                    isError: false
                )
            }
            if let err = store.error {
                statusBanner(text: err, isError: true)
            }
        }
        .padding(.horizontal, 16)
        .animation(.appQuick, value: store.isConnecting)
        .animation(.appQuick, value: store.error)
    }

    private func statusBanner(text: String, isError: Bool) -> some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundStyle(.white.opacity(0.7))
            .padding(.vertical, 6)
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isError
                          ? Color.appLoss.opacity(0.2)
                          : Color.white.opacity(0.1))
            )
            .transition(.move(edge: .top).combined(with: .opacity))
    }

    // MARK: - Conversation scroll

    @ViewBuilder
    private var conversation: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 10) {
                    if store.messages.isEmpty
                        && store.liveTranscript.isEmpty
                        && store.aiTranscript.isEmpty {
                        emptyState
                            .frame(maxWidth: .infinity)
                            .padding(.top, 60)
                            .padding(.horizontal, 32)
                    } else {
                        ForEach(store.messages) { msg in
                            RoastMessageBubble(
                                text: msg.text,
                                variant: .finalized(role: msg.role)
                            )
                            .id(msg.id)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                            .contextMenu {
                                Button {
                                    UIPasteboard.general.string = msg.text
                                } label: {
                                    Label("Copy text", systemImage: "doc.on.doc")
                                }
                                ShareLink(item: msg.text) {
                                    Label("Share roast", systemImage: "square.and.arrow.up")
                                }
                            }
                        }

                        // Live user transcript (interim STT result)
                        if !store.liveTranscript.isEmpty {
                            RoastMessageBubble(
                                text: store.liveTranscript,
                                variant: .liveUser
                            )
                            .id("live-user")
                            .transition(.opacity)
                        }

                        // Live assistant transcript (interim Gemini output text)
                        if !store.aiTranscript.isEmpty {
                            RoastMessageBubble(
                                text: store.aiTranscript,
                                variant: .liveAssistant
                            )
                            .id("live-assistant")
                            .transition(.opacity)
                        }

                        // Spacer anchor so `scrollTo(.bottom)` always lands
                        // past the last bubble (`scrollToEnd` parity).
                        Color.clear
                            .frame(height: 1)
                            .id("scroll-tail")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 8)
                .animation(.appStandard, value: store.messages)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: store.messages.count) { _, _ in
                scrollToBottom(proxy)
            }
            .onChange(of: store.liveTranscript) { _, _ in
                scrollToBottom(proxy)
            }
            .onChange(of: store.aiTranscript) { _, _ in
                scrollToBottom(proxy)
            }
            .onChange(of: store.state) { _, _ in
                scrollToBottom(proxy)
            }
        }
    }

    /// Mirrors RN's 100ms `setTimeout` before `scrollToEnd` so the layout has
    /// settled before we ask the scroll view to animate.
    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 100_000_000)
            withAnimation(.appQuick) {
                proxy.scrollTo("scroll-tail", anchor: .bottom)
            }
        }
    }

    // MARK: - Empty state

    @ViewBuilder
    private var emptyState: some View {
        // Spec §5: ContentUnavailableView w/ `mic.fill`, "Ready to get
        // roasted?" + description. We use the native container so it picks
        // up dynamic type + dark mode without any extra wiring.
        ContentUnavailableView {
            Label("Ready to get roasted?", systemImage: "mic.fill")
                .foregroundStyle(.white)
        } description: {
            Text("Tell The Bookie about your worst bets and prepare to get destroyed.")
                .foregroundStyle(.white.opacity(0.6))
        }
        .foregroundStyle(.white)
        .symbolRenderingMode(.hierarchical)
    }

    // MARK: - Bottom section (orb + status text + mic)

    @ViewBuilder
    private var bottomSection: some View {
        VStack(spacing: 4) {
            BookieOrbView()

            // Status text — color shifts based on state.
            Text(store.isConnecting
                 ? "Connecting to The Bookie..."
                 : store.state.statusText)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(statusTextColor)
                .animation(.appQuick, value: store.state)
                .padding(.bottom, 4)

            RoastMicButtonView(state: store.state) {
                Task { await store.toggleRecording() }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, 16)
    }

    private var statusTextColor: Color {
        switch store.state {
        case .recording: return Color.appPrimary
        case .responding: return Color.appAccentAmber
        case .idle, .processing: return Color.white.opacity(0.5)
        }
    }
}

#if DEBUG
#Preview("Roast — Empty") {
    RoastView()
}

#Preview("Roast — Loaded") {
    let store = RoastSessionStore()
    store.debugSet(
        state: .idle,
        intensity: .savage,
        messages: [
            .init(role: .user, text: "I parlayed the Lions ML with the Bears -3."),
            .init(role: .assistant, text: "A Detroit-Chicago parlay. Beautiful — you found the one wager that's worse than burning the cash for warmth."),
            .init(role: .user, text: "And I added Trubisky over 1.5 TDs."),
            .init(role: .assistant, text: "Stop. Just stop. I'm not a therapist, I'm a sportsbook. Even I have limits."),
        ]
    )
    return RoastView(store: store)
}

#Preview("Roast — Recording") {
    let store = RoastSessionStore()
    store.debugSet(
        state: .recording,
        liveTranscript: "Okay so I bet $200 on the Knicks…"
    )
    return RoastView(store: store)
}

#Preview("Roast — Error") {
    let store = RoastSessionStore()
    store.debugSet(
        state: .idle,
        error: "Network error: could not reach The Bookie"
    )
    return RoastView(store: store)
}
#endif
