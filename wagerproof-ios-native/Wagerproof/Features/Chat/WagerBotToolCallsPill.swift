import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Consolidates a run of `toolUse` blocks into one collapsible pill at
/// the bottom of an assistant bubble. Direct port of Honeydew's
/// `ChatV3ToolCallsPill`:
///
///   • Collapsed pill shows up to 4 stacked SF-Symbol circles + a count
///     label ("3 actions") + a chevron.
///   • Auto-expands while any call is `.running` so the user sees live
///     activity. Collapses back automatically when every call finishes.
///   • Tapping toggles the expanded state manually — the manual flag
///     persists across status changes, so users can keep the pill open
///     to inspect what happened after the calls finish.
struct WagerBotToolCallsPill: View {
    let calls: [WagerBotContentBlock]

    @State private var manuallyExpanded: Bool = false

    private let circleDiameter: CGFloat = 22
    private let circleOverlap: CGFloat = 8
    private let maxVisibleIcons: Int = 4

    private var anyRunning: Bool {
        calls.contains { call in
            if case .toolUse(_, _, _, .running) = call { return true }
            return false
        }
    }

    private var showExpanded: Bool { manuallyExpanded || anyRunning }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            collapsedPill
            if showExpanded {
                expandedList
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: showExpanded)
    }

    // MARK: - Collapsed pill

    private var collapsedPill: some View {
        Button {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                manuallyExpanded.toggle()
            }
        } label: {
            HStack(spacing: 8) {
                stackedIcons
                Text(countLabel)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                Image(systemName: showExpanded ? "chevron.up" : "chevron.down")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary.opacity(0.6))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color.appPrimary.opacity(0.10))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private var stackedIcons: some View {
        let visible = Array(calls.prefix(maxVisibleIcons))
        return HStack(spacing: -circleOverlap) {
            ForEach(Array(visible.enumerated()), id: \.offset) { idx, call in
                iconCircle(for: call)
                    .zIndex(Double(visible.count - idx))
            }
        }
    }

    @ViewBuilder
    private func iconCircle(for call: WagerBotContentBlock) -> some View {
        let name = toolName(of: call)
        ZStack {
            Circle().fill(Color.appPrimary.opacity(0.20))
            Image(systemName: WagerBotToolCatalog.icon(for: name))
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color.appPrimary)
        }
        .frame(width: circleDiameter, height: circleDiameter)
        .overlay(
            Circle().stroke(Color.appSurface, lineWidth: 2)
        )
    }

    private var countLabel: String {
        let n = calls.count
        if anyRunning {
            return n == 1 ? "running" : "\(n) running"
        }
        return n == 1 ? "1 action" : "\(n) actions"
    }

    // MARK: - Expanded list

    private var expandedList: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(calls.enumerated()), id: \.offset) { _, call in
                row(for: call)
            }
        }
    }

    @ViewBuilder
    private func row(for call: WagerBotContentBlock) -> some View {
        if case .toolUse(_, let name, let input, let status) = call {
            WagerBotToolUseChip(toolName: name, inputJSON: input, status: status)
        } else {
            EmptyView()
        }
    }

    private func toolName(of call: WagerBotContentBlock) -> String {
        if case .toolUse(_, let name, _, _) = call { return name }
        return ""
    }
}

#Preview("Two running") {
    WagerBotToolCallsPill(calls: [
        .toolUse(id: "1", name: "get_nba_predictions", argumentsJSON: #"{"league":"nba"}"#, status: .running),
        .toolUse(id: "2", name: "get_polymarket_odds", argumentsJSON: #"{"league":"nba"}"#, status: .running),
    ])
    .padding()
}
