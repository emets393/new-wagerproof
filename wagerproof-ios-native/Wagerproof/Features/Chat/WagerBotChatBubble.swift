import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Single message bubble for the WagerBot chat. Walks the message's
/// blocks and routes each to its dedicated renderer.
///
/// Direct port of Honeydew's `ChatV3Bubble`:
///   • User bubble  — right-aligned rounded rect, system-medium 14.
///   • Assistant    — left-aligned, no background, markdown renderer.
///   • Tool calls   — consolidated into one collapsible pill at the bottom.
///   • Suggestions / widget cards render inside the body.
///   • Follow-ups   — Perplexity-style vertical list at the end.
///
/// Render order is independent of stream arrival order — the model can
/// emit blocks in any sequence, but the user always sees:
///   1. Body (text, widget cards) in arrival order
///   2. Tool calls pill
///   3. Game references pill (when populated)
///   4. Follow-ups list (always last)
///
/// While the assistant is still streaming AND no body block has arrived
/// yet, the thinking indicator takes the body slot.
struct WagerBotChatBubble: View {
    let message: WagerBotMessage
    let ui: WagerBotUiTokens
    var isStreaming: Bool = false

    @Environment(\.horizontalSizeClass) private var hSize

    var onFollowUpTap: ((String) -> Void)?
    var onTapWidget: ((WagerBotChatWidget) -> Void)?
    var onTapGameCard: ((WagerBotChatGameCard) -> Void)?
    /// V2 chat: tap handoff for rich app components.
    var onComponentNav: ((WagerBotChatNav) -> Void)?

    var body: some View {
        if isInvisibleEcho {
            EmptyView()
        } else {
            bubble
        }
    }

    /// Drop assistant messages that only contain tool results — they're
    /// internal to the agent loop and never user-facing.
    private var isInvisibleEcho: Bool {
        if message.blocks.isEmpty { return false }
        return message.blocks.allSatisfy { _ in false }
    }

    private var bubble: some View {
        HStack(alignment: .top, spacing: 8) {
            if message.role == .user {
                Spacer(minLength: 32)
            }
            VStack(alignment: alignment, spacing: 8) {
                renderInFixedOrder()
            }
            .frame(
                maxWidth: message.role == .assistant ? .infinity : nil,
                alignment: message.role == .assistant ? .leading : .trailing
            )
        }
    }

    @ViewBuilder
    private func renderInFixedOrder() -> some View {
        let body = bodyBlocks()
        let toolCalls = consolidatedToolCalls()
        let followUps = consolidatedFollowUps()
        let gameRefs = consolidatedGameRefs()

        let blockTransition: AnyTransition = .asymmetric(
            insertion: .opacity.combined(with: .move(edge: .bottom)),
            removal: .opacity
        )

        // 1. Body slot OR thinking indicator
        if body.isEmpty && isStreaming && message.role == .assistant {
            WagerBotThinkingIndicator(ui: ui)
                .transition(blockTransition)
        } else {
            ForEach(Array(body.enumerated()), id: \.offset) { _, block in
                renderBlock(block)
                    .transition(blockTransition)
            }
        }

        // 2. Tool-calls pill
        if !toolCalls.isEmpty {
            HStack(spacing: 0) {
                WagerBotToolCallsPill(calls: toolCalls)
                Spacer(minLength: 0)
            }
            .padding(.top, 2)
            .transition(blockTransition)
        }

        // 3. Game references pill — shown only when widgets/cards
        // landed and the turn finished streaming (mirrors Honeydew's
        // recipe references behavior).
        if !isStreaming, !gameRefs.isEmpty {
            HStack(spacing: 0) {
                WagerBotGameReferencesPill(references: gameRefs)
                Spacer(minLength: 0)
            }
            .padding(.top, 2)
            .transition(blockTransition)
        }

        // 4. Follow-ups (always last)
        if !followUps.isEmpty {
            followUpRow(followUps)
                .transition(blockTransition)
        }
    }

    private var alignment: HorizontalAlignment {
        message.role == .user ? .trailing : .leading
    }

    // MARK: - Block grouping

    /// Blocks that belong in the body slot. Excludes tool blocks (rolled
    /// into the pill) and follow-ups (own terminal section). Widgets and
    /// game cards are held back during streaming so they don't slam in
    /// mid-stream (matches Honeydew's recipes-carousel deferral).
    private func bodyBlocks() -> [WagerBotContentBlock] {
        message.blocks.filter { block in
            switch block {
            case .toolUse, .followUps:
                return false
            case .gameCards, .chatWidgets, .appComponents:
                return !isStreaming
            default:
                return true
            }
        }
    }

    private func consolidatedFollowUps() -> [String] {
        // Mirrors Honeydew's "follow-ups always last, never during
        // stream" rule — surfacing tappable suggestions mid-stream
        // invites the user to act before the answer's complete.
        if isStreaming { return [] }
        var seen = Set<String>()
        var out: [String] = []
        for block in message.blocks {
            guard case .followUps(_, let items) = block else { continue }
            for q in items {
                let trimmed = q.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty, !seen.contains(trimmed) {
                    seen.insert(trimmed)
                    out.append(trimmed)
                }
            }
        }
        return out
    }

    private func consolidatedToolCalls() -> [WagerBotContentBlock] {
        message.blocks.filter { block in
            if case .toolUse = block { return true }
            return false
        }
    }

    /// Compile the union of all game references across the message's
    /// widget + game-card blocks. Dedup by gameId so the pill avatars
    /// don't repeat a game the model surfaced through multiple widgets.
    private func consolidatedGameRefs() -> [WagerBotGameReferencesPill.Reference] {
        var seen = Set<String>()
        var out: [WagerBotGameReferencesPill.Reference] = []
        for block in message.blocks {
            switch block {
            case .gameCards(_, let cards):
                for c in cards where !seen.contains(c.gameId) {
                    seen.insert(c.gameId)
                    out.append(.init(id: c.gameId, sport: c.sport, awayAbbr: c.awayAbbr, homeAbbr: c.homeAbbr))
                }
            case .chatWidgets(_, let widgets):
                for w in widgets where !seen.contains(w.gameId) {
                    seen.insert(w.gameId)
                    out.append(.init(id: w.gameId, sport: w.sport, awayAbbr: "", homeAbbr: ""))
                }
            default:
                continue
            }
        }
        return out
    }

    // MARK: - Per-block rendering

    @ViewBuilder
    private func renderBlock(_ block: WagerBotContentBlock) -> some View {
        switch block {
        case .text(_, let text):
            textRender(text)
        case .thinking(_, let text):
            thinkingBlock(text)
        case .toolUse, .followUps:
            // Rendered out-of-band by `renderInFixedOrder` so layout is
            // stable regardless of stream arrival order.
            EmptyView()
        case .gameCards(_, let cards):
            WagerBotSuggestedGamesCarousel(cards: cards, ui: ui, onTap: { onTapGameCard?($0) })
        case .chatWidgets(_, let widgets):
            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(widgets.enumerated()), id: \.offset) { _, widget in
                    WagerBotActionPreview(widget: widget, ui: ui) {
                        onTapWidget?(widget)
                    }
                }
            }
        case .appComponents(_, let summary, let components):
            WagerBotAppComponentsView(
                summary: summary,
                components: components,
                ui: ui,
                onNav: { onComponentNav?($0) }
            )
        }
    }

    @ViewBuilder
    private func textRender(_ text: String) -> some View {
        if message.role == .user {
            Text(text)
                .font(.system(size: 15, weight: .regular))
                .foregroundStyle(ui.userBubbleText)
                .padding(12)
                .background(ui.userBubbleBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(ui.borderColor, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .frame(maxWidth: maxUserBubbleWidth(), alignment: .trailing)
        } else {
            // Assistant prose runs through the markdown renderer so
            // paragraphs / lists / headings / quotes pick up real
            // spacing — vs being collapsed by SwiftUI's inline-only
            // markdown path.
            WagerBotMarkdownText(
                text,
                baseFont: .system(size: 15, weight: .regular),
                primaryColor: ui.primaryText,
                secondaryColor: ui.mutedText
            )
            .padding(.leading, 4)
            .padding(.trailing, 12)
            .textSelection(.enabled)
        }
    }

    private func maxUserBubbleWidth() -> CGFloat {
        if hSize == .regular { return 530 }
        let w = UIScreen.main.bounds.width
        if w <= 470 { return 330 }
        return 530
    }

    // Bare muted text — no container/icon, reads as the model "muttering".
    private func thinkingBlock(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .medium).italic())
            .foregroundStyle(ui.mutedText)
            .lineLimit(4)
    }

    /// Perplexity-style vertical follow-up list. Direct visual port of
    /// Honeydew's `followUpRow`. Each row submits the suggestion as the
    /// user's next turn.
    private func followUpRow(_ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { idx, q in
                if idx > 0 {
                    Divider()
                        .background(ui.borderColor.opacity(0.5))
                        .padding(.leading, 28)
                }
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    onFollowUpTap?(q)
                } label: {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "arrow.turn.down.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(ui.mutedText)
                            .padding(.top, 3)
                        Text(q)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(ui.primaryText)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Image(systemName: "plus")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(ui.mutedText.opacity(0.7))
                            .padding(.top, 4)
                    }
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 4)
    }
}
