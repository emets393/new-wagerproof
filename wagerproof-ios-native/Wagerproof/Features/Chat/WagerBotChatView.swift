import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// V3 WagerBot chat surface — Supabase Edge Function (`wagerbot-chat`) +
/// content-block streaming. Honeydew's ChatV3View ported into the
/// Wagerproof shell with brand tokens.
///
/// Layout pattern (ported from Honeydew's ChatV3View):
///   • Composer floats at the bottom via `.safeAreaInset(edge: .bottom)`.
///   • On user submit, the new message scrolls to the TOP of the
///     viewport with anchor `.top` so the assistant response streams
///     into the empty space below it. An 85%-viewport phantom spacer at
///     the bottom of the LazyVStack guarantees there's room to pull the
///     bubble all the way up.
///   • While streaming we NEVER auto-scroll — the user bubble stays
///     nailed to the top while assistant blocks land underneath.
///   • A scroll-to-bottom puck rises above the composer when the user
///     scrolls away from the latest content.
struct WagerBotChatView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.horizontalSizeClass) private var hSize
    @Environment(\.dismiss) private var dismiss

    @Environment(AuthStore.self) private var auth
    @Environment(ProAccessStore.self) private var proAccess
    @Environment(MainTabStore.self) private var tabStore
    @Environment(GamesStore.self) private var gamesStore
    @Environment(NFLGameSheetStore.self) private var nflSheetStore
    @Environment(CFBGameSheetStore.self) private var cfbSheetStore
    @Environment(NBAGameSheetStore.self) private var nbaSheetStore
    @Environment(NCAABGameSheetStore.self) private var ncaabSheetStore
    @Environment(MLBGameSheetStore.self) private var mlbSheetStore

    // Hoisted as @State so the store owns the streaming task lifetime —
    // dismissing the sheet tears down the view and cancels the task via
    // `WagerBotChatStore.cancel()` triggered by the dismiss `.task`.
    @State private var store = WagerBotChatStore()
    @State private var lastUserMessageId: String?
    @State private var isAtBottom: Bool = true
    @State private var scrollToBottomTrigger: Int = 0
    @State private var isShowingHistory: Bool = false
    @FocusState private var inputFocused: Bool
    #if DEBUG
    // DEBUG-only: hot-switch the chat's LLM (default = production wagerbot-chat;
    // others route to the parallel multi-provider wagerbot-agent function).
    @State private var debugModelId: String = WagerBotModelSelection.currentId
    #endif

    var body: some View {
        Group {
            if isLoadingPro {
                // RevenueCat sometimes hasn't finished hydrating when the
                // user lands on the chat. We render a spinner instead of
                // flashing the locked state and then the chat — keeps
                // the entry feel calm.
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.appSurface.ignoresSafeArea())
            } else if !proAccess.isPro {
                lockedState
            } else {
                chatBody
            }
        }
        .task {
            store.bind(userId: currentUserId)
            if let uid = currentUserId {
                await store.refreshHistory(userId: uid)
            }
        }
        .onDisappear {
            // Tear down any in-flight stream when the page is popped.
            store.cancel()
        }
        // Presented as a real page pushed on the active tab's NavigationStack
        // (see MainTabToolbar.wagerProofChatDestination), not a bottom sheet.
        // Hide the system back button — the toolbar's own ✕ pops via dismiss() —
        // and the tab bar, matching the Settings page treatment.
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .tabBar)
    }

    // MARK: - Pro gate

    private var isLoadingPro: Bool {
        proAccess.isLoading
    }

    private var lockedState: some View {
        ZStack {
            Color.appSurface.ignoresSafeArea()
            VStack(spacing: 16) {
                ZStack(alignment: .topTrailing) {
                    WagerBotIcon(size: 56)
                        .foregroundStyle(Color.appPrimary)
                        .padding(.top, 8)
                    Image(systemName: "lock.fill")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Color.appAccentAmber)
                        .padding(6)
                        .background(Circle().fill(Color.appSurfaceElevated))
                        .overlay(Circle().stroke(Color.appBorder, lineWidth: 1))
                        .offset(x: 8, y: -4)
                }
                Text("WagerBot Pro")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Text("Get unlimited AI-powered betting analysis across every sport.")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 36)

                Button {
                    // Launch the RevenueCat paywall via the existing
                    // CustomerCenter flow. We dismiss the chat sheet
                    // first so the paywall can present cleanly from the
                    // tab shell (chained sheets flicker on iOS).
                    dismiss()
                    DispatchQueue.main.async {
                        // The Settings sheet path opens the paywall via
                        // CustomerCenterView — same surface used
                        // elsewhere for upsells.
                        tabStore.isSettingsPresented = true
                    }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "crown.fill")
                            .font(.system(size: 13, weight: .bold))
                        Text("Unlock with Pro")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .padding(.horizontal, 22)
                    .padding(.vertical, 12)
                    .background(Color.appAccentAmber)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 24)
        }
        .overlay(alignment: .topTrailing) {
            Button("Close") { dismiss() }
                .padding(16)
        }
    }

    // MARK: - Chat body (Pro path)

    private var chatBody: some View {
        let ui = WagerBotUiTokens.resolve(colorScheme)
        // No own NavigationStack — this view is pushed onto the active tab's
        // stack via `wagerProofChatDestination`, so the toolbar + title attach
        // to the host stack and it reads as a real page.
        return messagesList(ui: ui)
                .background(ui.pageBackground.ignoresSafeArea())
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { toolbarContent(ui: ui) }
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    VStack(spacing: 8) {
                        if !isAtBottom && !store.messages.isEmpty {
                            scrollToBottomPuck(ui: ui)
                                .frame(maxWidth: .infinity)
                                .transition(
                                    .scale(scale: 0.6, anchor: .bottom)
                                        .combined(with: .opacity)
                                )
                        }
                        composer(ui: ui)
                    }
                    .frame(maxWidth: 720)
                    .frame(maxWidth: .infinity)
                    .animation(.spring(response: 0.42, dampingFraction: 0.84), value: isAtBottom)
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    UIApplication.shared.sendAction(
                        #selector(UIResponder.resignFirstResponder),
                        to: nil, from: nil, for: nil
                    )
                }
                .sheet(isPresented: $isShowingHistory) {
                    WagerBotConversationsSheet(
                        activeThreadId: store.threadId,
                        userId: currentUserId,
                        onSelect: { summary in
                            isShowingHistory = false
                            Task { await store.loadThread(summary) }
                        }
                    )
                    .environment(store)
                }
                .environment(store)
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private func toolbarContent(ui: WagerBotUiTokens) -> some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(ui.primaryText)
            }
            .accessibilityLabel("Close")
        }
        ToolbarItem(placement: .principal) {
            HStack(spacing: 8) {
                WagerBotIcon(size: 18)
                    .foregroundStyle(ui.accent)
                VStack(alignment: .leading, spacing: 0) {
                    Text(
                        store.threadTitle?.isEmpty == false
                            ? store.threadTitle!
                            : "WagerBot"
                    )
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(ui.primaryText)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .animation(.easeInOut(duration: 0.25), value: store.threadTitle)
                    Text("Sports betting AI")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(ui.mutedText)
                }
            }
        }
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                if !store.messages.isEmpty {
                    Button {
                        store.newConversation()
                    } label: {
                        Label("New conversation", systemImage: "square.and.pencil")
                    }
                }
                Button {
                    isShowingHistory = true
                } label: {
                    Label("History", systemImage: "clock.arrow.circlepath")
                }
                #if DEBUG
                Picker(selection: $debugModelId) {
                    ForEach(WagerBotModelSelection.options) { opt in
                        Text(opt.label).tag(opt.id)
                    }
                } label: {
                    Label("Model (debug)", systemImage: "cpu")
                }
                .onChange(of: debugModelId) { _, newValue in
                    // Persist so the (non-view) chat service reads it on the next run.
                    WagerBotModelSelection.currentId = newValue
                    // Start a fresh thread so the new model doesn't inherit a
                    // conversation built under a different one.
                    store.newConversation()
                }
                #endif
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundStyle(ui.primaryText)
            }
            .accessibilityLabel("More")
        }
    }

    // MARK: - Messages list

    @ViewBuilder
    private func messagesList(ui: WagerBotUiTokens) -> some View {
        if store.messages.isEmpty {
            welcomeState(ui: ui)
        } else {
            GeometryReader { geo in
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 16) {
                            Color.clear.frame(height: 0).id("chat-top-anchor")
                            ForEach(store.messages) { message in
                                WagerBotChatBubble(
                                    message: message,
                                    ui: ui,
                                    isStreaming: isStreaming(message),
                                    onFollowUpTap: { q in
                                        store.send(text: q)
                                        lastUserMessageId = store.messages.last { $0.role == .user }?.id
                                    },
                                    onTapWidget: { widget in
                                        openSheet(forGameId: widget.gameId, sport: widget.sport)
                                    },
                                    onTapGameCard: { card in
                                        openSheet(forGameId: card.gameId, sport: card.sport)
                                    },
                                    onComponentNav: { nav in
                                        handleComponentNav(nav)
                                    }
                                )
                                .id(message.id)
                            }
                            // Bottom-detector — drives the scroll-to-bottom puck.
                            Color.clear
                                .frame(height: 1)
                                .id("chat-bottom-detector")
                                .onAppear { isAtBottom = true }
                                .onDisappear { isAtBottom = false }
                            // Tail anchor for explicit scroll-to-bottom.
                            Color.clear.frame(height: 1).id("chat-tail-anchor")
                            // Phantom 85% viewport spacer — gives the proxy
                            // enough headroom to pin the latest user
                            // message to the top of the visible area on
                            // submit. Same trick Honeydew's ChatV3View uses.
                            Color.clear
                                .frame(height: max(geo.size.height * 0.85, 200))
                                .accessibilityHidden(true)
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                        .frame(maxWidth: 720)
                        .frame(maxWidth: .infinity)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .onChange(of: lastUserMessageId) { _, newId in
                        guard let newId else { return }
                        // Two-tick hop — the LazyVStack needs a layout pass
                        // for the new row + spacer recompute before the
                        // proxy can pin .top reliably. One hop sometimes
                        // lands before the spacer expands; two is safe.
                        DispatchQueue.main.async {
                            DispatchQueue.main.async {
                                withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) {
                                    proxy.scrollTo(newId, anchor: .top)
                                }
                            }
                        }
                    }
                    .onChange(of: scrollToBottomTrigger) { _, _ in
                        withAnimation(.spring(response: 0.5, dampingFraction: 0.86)) {
                            proxy.scrollTo("chat-tail-anchor", anchor: .bottom)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Welcome / empty state

    /// 12 betting-themed prompts — 3 pages × 4. Phrased so each
    /// exercises a different tool path (predictions, polymarket, editor
    /// picks, search, web). Direct visual port of Honeydew's welcome
    /// carousel — single-column full-width chips, custom capsule dots.
    private static let welcomePrompts: [String] = [
        // Page 1 — best bets discovery
        "What are the best bets today?",
        "Show me NBA value plays tonight",
        "Break down today's MLB slate",
        "Top NFL picks for this week",
        // Page 2 — comparisons + market
        "Where is the model fading the public?",
        "How does Polymarket compare to Vegas?",
        "Find me the biggest spread mismatches",
        "Which underdogs look live?",
        // Page 3 — picks + news + analysis
        "What are the current editor picks?",
        "Any injury news affecting tonight's lines?",
        "Search news on the Lakers",
        "Explain how the model weights matchups"
    ]
    private static let promptsPerPage: Int = 4
    private static var welcomePageCount: Int {
        Int(ceil(Double(welcomePrompts.count) / Double(promptsPerPage)))
    }

    @State private var welcomePage: Int = 0

    private func welcomeState(ui: WagerBotUiTokens) -> some View {
        VStack(spacing: 16) {
            Spacer(minLength: 0)
            WagerBotDynamicIcon(size: 72)
            Text("What's on your slip today?")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(ui.primaryText)
                .multilineTextAlignment(.center)
            // Collapse the carousel on focus — keyboard rise + the seed
            // chip column otherwise overflow the safe area on small
            // devices. Matches Honeydew's ChatV3 welcome behavior.
            if !inputFocused {
                Text("Try one of these")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(ui.mutedText)
                    .transition(.opacity)
                welcomeCarousel(ui: ui)
                    .transition(.opacity.combined(with: .scale(scale: 0.96, anchor: .top)))
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: 560)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 20)
        .animation(.spring(response: 0.32, dampingFraction: 0.88), value: inputFocused)
    }

    private func welcomeCarousel(ui: WagerBotUiTokens) -> some View {
        VStack(spacing: 10) {
            TabView(selection: $welcomePage) {
                ForEach(0..<Self.welcomePageCount, id: \.self) { page in
                    welcomePageColumn(pageIndex: page, ui: ui)
                        .padding(.horizontal, 4)
                        .tag(page)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 240)
            .animation(.spring(response: 0.42, dampingFraction: 0.86), value: welcomePage)

            pageDots(ui: ui)
        }
    }

    private func welcomePageColumn(pageIndex: Int, ui: WagerBotUiTokens) -> some View {
        let start = pageIndex * Self.promptsPerPage
        let end = min(start + Self.promptsPerPage, Self.welcomePrompts.count)
        let slice = Array(Self.welcomePrompts[start..<end])
        return VStack(spacing: 8) {
            ForEach(Array(slice.enumerated()), id: \.element) { _, text in
                seedChip(text: text, ui: ui)
            }
        }
    }

    private func seedChip(text: String, ui: WagerBotUiTokens) -> some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            sendDraft(initial: text)
        } label: {
            HStack(spacing: 10) {
                Text(text)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(ui.primaryText)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .lineLimit(2)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(ui.hintChipBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(ui.borderColor, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func pageDots(ui: WagerBotUiTokens) -> some View {
        HStack(spacing: 6) {
            ForEach(0..<Self.welcomePageCount, id: \.self) { i in
                Capsule()
                    .fill(i == welcomePage ? ui.accent : ui.borderColor)
                    .frame(width: i == welcomePage ? 18 : 6, height: 6)
                    .animation(.spring(response: 0.32, dampingFraction: 0.86), value: welcomePage)
                    .onTapGesture {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        welcomePage = i
                    }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Page \(welcomePage + 1) of \(Self.welcomePageCount)")
    }

    // MARK: - Composer

    private func composer(ui: WagerBotUiTokens) -> some View {
        @Bindable var binding = store
        return VStack(spacing: 0) {
            Color.clear.frame(height: 10)
            HStack {
                TextField("", text: $binding.draft, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.system(size: 16, weight: .regular))
                    .foregroundStyle(ui.primaryText)
                    .lineLimit(1...4)
                    .focused($inputFocused)
                    .submitLabel(.send)
                    .onSubmit { sendDraft() }
                    // `axis: .vertical` makes Return insert a newline.
                    // Intercept any newline as a Send so the keyboard's
                    // Send key fires. Same trick Honeydew's composer uses.
                    .onChange(of: store.draft) { _, newValue in
                        guard newValue.contains("\n") else { return }
                        let cleaned = newValue
                            .replacingOccurrences(of: "\n", with: " ")
                            .trimmingCharacters(in: .whitespacesAndNewlines)
                        Task { @MainActor in
                            store.draft = cleaned
                            if !cleaned.isEmpty { sendDraft() }
                        }
                    }
                    .padding(.vertical, 12)
                    .background(alignment: .leading) {
                        if store.draft.isEmpty {
                            Text("Ask anything")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(ui.mutedText)
                                .allowsHitTesting(false)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 24)

            HStack {
                Spacer()
                Button {
                    if store.isStreaming { store.cancel() } else { sendDraft() }
                } label: {
                    Image(systemName: store.isStreaming ? "stop.fill" : "arrow.up")
                        .font(.system(size: 22, weight: .regular))
                        .foregroundStyle(ui.primaryActionForeground)
                        .frame(width: 44, height: 44)
                        .background(canSend || store.isStreaming ? ui.primaryActionBackground : ui.controlBackground)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .opacity(store.isStreaming ? 1.0 : (canSend || inputFocused ? 1.0 : 0.0))
                .animation(.easeInOut(duration: 0.25), value: inputFocused)
                .animation(.easeInOut(duration: 0.2), value: canSend)
                .padding(.trailing, 12)
                .accessibilityLabel(store.isStreaming ? "Stop" : "Send")
            }
            Color.clear.frame(height: 10)
        }
        // Liquid Glass input surface (iOS 26): interactive so tapping into the
        // field gives the signature glass refraction; falls back to
        // .ultraThinMaterial pre-26. Replaces the opaque composerBackground fill.
        .liquidGlassBackground(in: RoundedRectangle(cornerRadius: 24, style: .continuous), interactive: true)
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(ui.composerBorder.opacity(0.6), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.10), radius: 16, x: 0, y: 6)
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }

    private func scrollToBottomPuck(ui: WagerBotUiTokens) -> some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            scrollToBottomTrigger &+= 1
        } label: {
            Image(systemName: "arrow.down")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(ui.primaryText)
                .frame(width: 40, height: 40)
                .background(
                    Circle().fill(ui.composerBackground)
                )
                .overlay(Circle().stroke(ui.composerBorder, lineWidth: 1))
                .shadow(color: Color.black.opacity(0.18), radius: 10, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Scroll to latest")
    }

    // MARK: - Send

    private var canSend: Bool {
        !store.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func sendDraft(initial: String? = nil) {
        let text = (initial ?? store.draft).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        inputFocused = false
        store.send(text: text)
        // Drive the scroll-to-top pin by reading back the just-appended
        // user message id from the store.
        lastUserMessageId = store.messages.last { $0.role == .user }?.id
    }

    // MARK: - Game sheet dispatch

    /// Resolve a chat-card / widget tap by looking up the typed game in
    /// `GamesStore` and opening the matching sport sheet. Falls back to
    /// no-op if the cache hasn't loaded yet — better than crashing on a
    /// stale id.
    private func openSheet(forGameId gameId: String, sport: String) {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        // Dismiss the chat sheet first so the sport sheet has a clean
        // presentation context. iOS doesn't reliably present a second
        // sheet on top of an existing one without a hand-off.
        let normalizedSport = sport.lowercased()
        let dismissThenOpen: () -> Void = {
            // Each sport model exposes its primary key differently — NFL
            // and CFB use a string `id`, NBA/NCAAB use an Int `gameId`,
            // MLB uses a string `id` mirrored from `gamePk`. We try the
            // shapes we know about so the chat tap resolves regardless
            // of which sport produced the widget.
            let intGameId = Int(gameId)
            switch normalizedSport {
            case "nfl":
                if let game = gamesStore.games.nfl.first(where: { $0.id == gameId }) {
                    nflSheetStore.openGameSheet(game)
                }
            case "cfb":
                if let game = gamesStore.games.cfb.first(where: { $0.id == gameId }) {
                    cfbSheetStore.openGameSheet(game)
                }
            case "nba":
                if let intGameId, let game = gamesStore.games.nba.first(where: { $0.gameId == intGameId }) {
                    nbaSheetStore.openGameSheet(game)
                }
            case "ncaab":
                if let intGameId, let game = gamesStore.games.ncaab.first(where: { $0.gameId == intGameId }) {
                    ncaabSheetStore.openGameSheet(game)
                }
            case "mlb":
                if let game = gamesStore.games.mlb.first(where: { $0.id == gameId || String($0.gamePk) == gameId }) {
                    mlbSheetStore.openGameSheet(game)
                }
            default:
                break
            }
        }
        dismiss()
        DispatchQueue.main.async(execute: dismissThenOpen)
    }

    /// Cross-tab handoff for V2 rich components — lands the user on the same
    /// surface the rest of the app would open (app-standard pattern). Game nav
    /// is fully deep-linked via `openSheet`; the other kinds switch to the
    /// relevant tab (their per-id deep links can be tightened later).
    private func handleComponentNav(_ nav: WagerBotChatNav) {
        switch nav.kind {
        case "game", "value":
            guard let gameId = nav.gameId, let sport = nav.sport else { return }
            tabStore.select(.games)
            openSheet(forGameId: gameId, sport: sport)
        case "prop":
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            tabStore.select(.props)
            dismiss()
        case "agent", "agent_pick":
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            tabStore.select(.agents)
            dismiss()
        case "tool":
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            tabStore.select(.games)
            dismiss()
        default:
            break
        }
    }

    // MARK: - Helpers

    private var currentUserId: String? {
        auth.profile?.id.uuidString
    }

    private func isStreaming(_ message: WagerBotMessage) -> Bool {
        store.isStreaming
            && message.id == store.messages.last?.id
            && message.role == .assistant
    }
}
