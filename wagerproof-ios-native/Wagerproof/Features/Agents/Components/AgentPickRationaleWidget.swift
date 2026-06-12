import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Native port of `wagerproof-mobile/components/agents/AgentPickRationaleWidget.tsx`.
///
/// Renders a terminal-styled "agent rationale" card inside a sport-specific
/// game bottom sheet. The widget only appears when the audit store has a
/// `selectedPick` AND that pick's `gameId` matches one of the sheet's game
/// keys — the same gate as RN's `gameKeySet.has(String(selectedAgentPick.game_id))`.
///
/// Visual language mirrors RN exactly: monospace Menlo, green accent, dark
/// terminal background, factor pills along the bottom. Light mode uses the
/// same near-black surface as RN (`#101617`) because the terminal aesthetic
/// is intentional regardless of theme.
///
/// Reads `AgentPickAuditStore` from the environment. The audit store doesn't
/// surface the RN `ai_decision_trace.rationale_summary` field today
/// (B16 ticket #079), so we fall back to `pick.reasoningText` exactly like
/// the RN code does when the trace key is missing.
struct AgentPickRationaleWidget: View {
    /// Game keys for the currently-open bottom sheet. The widget shows the
    /// rationale only if the audit store's selected pick matches one of
    /// these. Passing keys as `Any?` mirrors RN's `Array<string | number | null>`.
    let gameKeys: [String?]

    @Environment(AgentPickAuditStore.self) private var auditStore
    @Environment(\.colorScheme) private var colorScheme

    /// Set of non-empty stringified game keys for O(1) lookup. Mirrors RN's
    /// `useMemo` gate that filters out `null`/`undefined`/empty strings.
    private var gameKeySet: Set<String> {
        Set(gameKeys.compactMap { $0 }.filter { !$0.isEmpty })
    }

    var body: some View {
        if let pick = auditStore.selectedPick, gameKeySet.contains(pick.gameId) {
            content(pick: pick)
        }
    }

    @ViewBuilder
    private func content(pick: AgentPick) -> some View {
        // Match RN: keep the green border + dark surface in both light and
        // dark mode. The terminal aesthetic is deliberate, the RN code uses a
        // near-black background regardless of theme.
        let surface = colorScheme == .dark ? Color(hex: 0x0B1010) : Color(hex: 0x101617)
        let borderColor = colorScheme == .dark
            ? Color(hex: 0x00E676, opacity: 0.22)
            : Color(hex: 0x00BA62, opacity: 0.24)
        let headerColor = colorScheme == .dark ? Color(hex: 0x9FB3AD) : Color(hex: 0xB4C5C0)
        let accent = colorScheme == .dark ? Color(hex: 0x00E676) : Color(hex: 0x1ECF7B)

        // RN truncates to the first 3 factors. Honour that ceiling here so the
        // pill row never overflows the sheet width.
        let factors = (pick.keyFactors ?? []).prefix(3)

        VStack(alignment: .leading, spacing: 0) {
            Text("terminal://agent-rationale")
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(headerColor)
                .padding(.bottom, 8)

            HStack(spacing: 8) {
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(accent)
                Text(pick.pickSelection)
                    .font(.system(size: 15, weight: .heavy, design: .monospaced))
                    .lineSpacing(2)
                    .foregroundStyle(accent)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.bottom, 4)

            Text("\(pick.betType.uppercased()) pick with \(pick.confidence)/5 confidence")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .padding(.bottom, 10)

            // Prefer the decision trace's rationale_summary (now decoded on
            // AgentPick); fall back to reasoning_text exactly like RN.
            let rationale = pick.aiDecisionTrace?["rationale_summary"]?.stringValue
                ?? pick.reasoningText
            Text(rationale.isEmpty ? "No rationale text available." : rationale)
                .font(.system(size: 13))
                .lineSpacing(3)
                .foregroundStyle(Color.appTextPrimary)
                .fixedSize(horizontal: false, vertical: true)

            if !factors.isEmpty {
                FactorPillFlow(factors: Array(factors), colorScheme: colorScheme)
                    .padding(.top, 10)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(borderColor, lineWidth: 1)
        )
        .padding(.bottom, 14)
    }
}

/// Wrapping flow layout for the rationale factor pills. Uses iOS 16's
/// `Layout` protocol so the pills wrap naturally — RN's `flexWrap: 'wrap'`
/// has no direct SwiftUI primitive. Each pill auto-sizes to its label.
private struct FactorPillFlow: View {
    let factors: [String]
    let colorScheme: ColorScheme

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(Array(factors.enumerated()), id: \.offset) { _, factor in
                Text(factor)
                    .font(.system(size: 11, weight: .semibold))
                    .lineSpacing(3)
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        Capsule().fill(
                            colorScheme == .dark
                                ? Color.white.opacity(0.06)
                                : Color.white.opacity(0.08)
                        )
                    )
                    .overlay(
                        Capsule().strokeBorder(
                            colorScheme == .dark
                                ? Color.white.opacity(0.08)
                                : Color.white.opacity(0.12),
                            lineWidth: 1
                        )
                    )
            }
        }
    }
}

/// Minimal flow layout used to wrap the factor pills. Hand-rolled because
/// SwiftUI ships no wrap-on-overflow primitive before iOS 17 (`Lazy*Grid`
/// requires a fixed column count). Keeps the implementation under ~30 lines
/// — a full `FlowLayout` library would be overkill for a single use site.
private struct FlowLayout: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        let lines = computeLines(subviews: subviews, maxWidth: width)
        let height = lines.reduce(CGFloat(0)) { acc, line in
            acc + (line.maxHeight) + (acc > 0 ? spacing : 0)
        }
        let usedWidth = lines.map { $0.totalWidth }.max() ?? 0
        return CGSize(width: min(usedWidth, width), height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let lines = computeLines(subviews: subviews, maxWidth: bounds.width)
        var y = bounds.minY
        for line in lines {
            var x = bounds.minX
            for index in line.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += line.maxHeight + spacing
        }
    }

    private struct Line {
        var indices: [Int] = []
        var totalWidth: CGFloat = 0
        var maxHeight: CGFloat = 0
    }

    private func computeLines(subviews: Subviews, maxWidth: CGFloat) -> [Line] {
        var lines: [Line] = [Line()]
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            var current = lines[lines.count - 1]
            let prospective = current.totalWidth + size.width + (current.indices.isEmpty ? 0 : spacing)
            if prospective > maxWidth, !current.indices.isEmpty {
                lines.append(Line(indices: [index], totalWidth: size.width, maxHeight: size.height))
            } else {
                current.indices.append(index)
                current.totalWidth = prospective
                current.maxHeight = max(current.maxHeight, size.height)
                lines[lines.count - 1] = current
            }
        }
        return lines
    }
}
