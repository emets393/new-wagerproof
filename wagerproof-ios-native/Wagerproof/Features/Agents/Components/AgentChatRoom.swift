import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Per-agent chat surface. Ports `components/agents/AgentChatRoom.tsx`.
///
/// The RN component shipped with a static dummy thread (agents banter with
/// each other). We replace that with a real one-on-one chat between the user
/// and the agent, backed by `AgentChatStore`. This is the same shape the
/// product wants long-term — owner can "interview" their agent about a pick.
struct AgentChatRoom: View {
    let agent: Agent
    @Bindable var store: AgentChatStore

    @FocusState private var inputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            header
            messageList
            inputBar
        }
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.appSurfaceElevated)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 1)
        )
        .task {
            if case .idle = store.loadState {
                await store.refresh()
            }
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Image(systemName: "bubble.left.and.bubble.right.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color(hex: 0x20B2AA))
            Text("Chat with \(agent.name)")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            Spacer()
            HStack(spacing: 4) {
                Circle().fill(Color(hex: 0x22C55E)).frame(width: 6, height: 6)
                Text("LIVE")
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(0.3)
                    .foregroundStyle(Color(hex: 0x22C55E))
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Capsule().fill(Color(hex: 0x22C55E).opacity(0.1)))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.appBorder.opacity(0.4)).frame(height: 1)
        }
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    if store.messages.isEmpty {
                        emptyState
                    } else {
                        ForEach(store.messages) { msg in
                            messageBubble(msg).id(msg.id)
                        }
                    }
                    if store.isAssistantTyping {
                        TypingDots()
                            .id("typing")
                    }
                }
                .padding(12)
            }
            .frame(maxHeight: 360)
            .onChange(of: store.messages.count) { _, _ in
                if let lastId = store.messages.last?.id {
                    withAnimation { proxy.scrollTo(lastId, anchor: .bottom) }
                }
            }
            .onChange(of: store.isAssistantTyping) { _, typing in
                if typing {
                    withAnimation { proxy.scrollTo("typing", anchor: .bottom) }
                }
            }
        }
    }

    @ViewBuilder
    private var emptyState: some View {
        VStack(spacing: 8) {
            PixelEmojiInline(emoji: agent.avatarEmoji, size: 28)
            Text("Ask \(agent.name) about a pick")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            Text("\"Why are you on the Nuggets tonight?\"\n\"What's your read on tonight's Lakers/Suns total?\"")
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Color.appTextSecondary.opacity(0.7))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }

    private func messageBubble(_ msg: AgentChatMessage) -> some View {
        let isUser = msg.role == .user
        let bg = isUser ? Color(hex: 0x3B82F6).opacity(0.18) : Color.appBorder.opacity(0.45)
        let textColor = isUser ? Color.appTextPrimary : Color.appTextPrimary
        let align: HorizontalAlignment = isUser ? .trailing : .leading

        return HStack {
            if isUser { Spacer(minLength: 36) }
            VStack(alignment: align, spacing: 3) {
                HStack(spacing: 6) {
                    if !isUser {
                        Text(agent.avatarEmoji).font(.system(size: 14))
                    }
                    Text(isUser ? "You" : agent.name)
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundStyle(isUser ? Color(hex: 0x3B82F6) : Color.appTextSecondary)
                }
                Text(msg.content)
                    .font(.system(size: 13))
                    .foregroundStyle(textColor)
                    .multilineTextAlignment(isUser ? .trailing : .leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(bg)
            )
            if !isUser { Spacer(minLength: 36) }
        }
    }

    private var inputBar: some View {
        HStack(spacing: 8) {
            TextField("Message \(agent.name)…", text: $store.draft, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...4)
                .focused($inputFocused)
                .font(.system(size: 14))
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color.appBorder.opacity(0.4))
                )

            Button {
                Task { await store.send() }
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(canSend ? Color(hex: 0x00E676) : Color.appTextSecondary)
            }
            .disabled(!canSend || store.isAssistantTyping)
            .buttonStyle(.plain)
        }
        .padding(10)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.appBorder.opacity(0.4)).frame(height: 1)
        }
    }

    private var canSend: Bool {
        !store.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

/// Three-dot "typing" indicator. Uses TimelineView so we don't keep an
/// animation alive when offscreen.
private struct TypingDots: View {
    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { idx in
                TimelineView(.periodic(from: .now, by: 0.18)) { context in
                    let t = context.date.timeIntervalSinceReferenceDate
                    let phase = (Int(t * 3) + idx) % 3
                    Circle()
                        .fill(Color.appTextSecondary.opacity(phase == 0 ? 1.0 : 0.4))
                        .frame(width: 6, height: 6)
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.appBorder.opacity(0.45))
        )
    }
}
