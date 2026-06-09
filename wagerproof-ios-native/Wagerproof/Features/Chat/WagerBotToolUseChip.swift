import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Per-tool-call chip inside the consolidated `WagerBotToolCallsPill`.
/// Direct port of Honeydew's `ChatV3ToolUseChip` adapted to the
/// WagerBot tool catalog (10 custom data tools + web_search).
///
/// Three visual states (driven by `WagerBotToolStatus`):
///   1. `.running`         — chip leads with a pulsing dot, border
///                            shimmers, "NBA Predictions" / etc.
///   2. `.done(_, true,_)` — leading checkmark, success tint, "412ms"
///                            tail.
///   3. `.done(_, false,_)`— leading red x, danger tint, error label.
struct WagerBotToolUseChip: View {
    let toolName: String
    let inputJSON: String
    let status: WagerBotToolStatus

    @State private var didFinishOnce: Bool = false

    var body: some View {
        HStack(spacing: 8) {
            leadingGlyph
                .frame(width: 14, height: 14)
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            if !inputSummary.isEmpty {
                Text(inputSummary)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            Spacer(minLength: 0)
            // Trailing: server summary first (the meaningful result
            // — "8 games", "found 3 picks"), duration last.
            if case .done(let ms, _, let summary) = status {
                if !summary.isEmpty {
                    Text(summary)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(1)
                }
                Text("\(ms)ms")
                    .font(.system(size: 11, weight: .medium).monospacedDigit())
                    .foregroundStyle(Color.appTextSecondary.opacity(0.7))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(borderOverlay)
        .transition(.scale(scale: 0.92).combined(with: .opacity))
        .sensoryFeedback(.success, trigger: didFinishOnce)
        .onChange(of: status) { _, newValue in
            if case .done(_, true, _) = newValue, !didFinishOnce {
                didFinishOnce = true
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: status)
    }

    // MARK: - Leading glyph

    @ViewBuilder
    private var leadingGlyph: some View {
        switch status {
        case .running:
            // Pulsing dot in brand green — same trick Honeydew uses for
            // its running-tool state, swapped for WagerProof tokens.
            Circle()
                .fill(Color.appPrimary)
                .frame(width: 8, height: 8)
                .phaseAnimator([0.3, 1.0, 0.3]) { dot, phase in
                    dot.opacity(phase)
                } animation: { _ in .easeInOut(duration: 0.7) }
        case .done(_, true, _):
            Image(systemName: "checkmark")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appWin)
        case .done(_, false, _):
            Image(systemName: "xmark")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appLoss)
        }
    }

    // MARK: - Backing + border

    private var background: Color {
        if case .done(_, false, _) = status {
            return Color.appLoss.opacity(0.10)
        }
        return Color.appPrimary.opacity(0.10)
    }

    @ViewBuilder
    private var borderOverlay: some View {
        if case .running = status {
            // Shimmer border: same trick Honeydew uses — gradient stroke
            // masked back onto the rounded rect so the chip pulses while
            // a tool is in flight.
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.appPrimary.opacity(0.0),
                            Color.appPrimary.opacity(0.5),
                            Color.appPrimary.opacity(0.0)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    lineWidth: 1
                )
                .mask(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(.white, lineWidth: 1)
                )
        } else {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.appPrimary.opacity(0.18), lineWidth: 1)
        }
    }

    // MARK: - Tool label / icon

    private var label: String { WagerBotToolCatalog.label(for: toolName) }

    /// Extract a short human-readable summary from the tool input JSON.
    /// Mirrors Honeydew's helper — looks for the common shapes the
    /// WagerBot tools emit (`league`, `query`, `game_id`, `date`).
    private var inputSummary: String {
        guard let data = inputJSON.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return "" }
        if let league = obj["league"] as? String, !league.isEmpty {
            return league.uppercased()
        }
        if let q = obj["query"] as? String, !q.isEmpty {
            return "\u{201C}\(q)\u{201D}"
        }
        if let gameId = obj["game_id"] as? String, !gameId.isEmpty {
            // Game IDs are usually noisy hashes — render the short tail.
            return String(gameId.suffix(8))
        }
        if let date = obj["date"] as? String, !date.isEmpty {
            return date
        }
        if let limit = obj["limit"] as? Int { return "limit \(limit)" }
        return ""
    }
}

#Preview("Running") {
    WagerBotToolUseChip(
        toolName: "get_nba_predictions",
        inputJSON: #"{"league":"nba","date":"2026-05-24"}"#,
        status: .running
    )
    .padding()
}

#Preview("Done OK") {
    WagerBotToolUseChip(
        toolName: "get_polymarket_odds",
        inputJSON: #"{"league":"nba"}"#,
        status: .done(ms: 287, ok: true, summary: "12 markets")
    )
    .padding()
}

#Preview("Done error") {
    WagerBotToolUseChip(
        toolName: "search_games",
        inputJSON: #"{"query":"lakers"}"#,
        status: .done(ms: 134, ok: false, summary: "no games found")
    )
    .padding()
}
