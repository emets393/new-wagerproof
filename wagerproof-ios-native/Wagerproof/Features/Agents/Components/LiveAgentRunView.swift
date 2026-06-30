import SwiftUI
import WagerproofDesign
import WagerproofServices

struct LiveAgentRunView: View {
    let state: TriggerV3RunStatus

    private var metadata: TriggerV3RunMetadata { state.metadata }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                ProgressView()
                    .controlSize(.small)
                    .tint(Color(hex: 0x00E676))
                Text("terminal://trigger-run/\(state.id)")
                    .font(.system(size: 12, design: .monospaced))
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .foregroundStyle(Color(hex: 0x9FB3AD))
            }

            terminalRow(title: "status", value: statusLine, active: true)

            if let tool = metadata.currentTool {
                terminalRow(title: "tool", value: toolDetail(tool), active: false)
            }

            HStack(spacing: 8) {
                statPill(label: "turn", value: turnText)
                statPill(label: "tools", value: "\(metadata.toolCalls ?? 0)")
                statPill(label: "picks", value: "\(metadata.picksAccepted ?? 0)")
                if let rejected = metadata.picksRejected, rejected > 0 {
                    statPill(label: "reject", value: "\(rejected)")
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 170, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(hex: 0x070A0A))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color(hex: 0x00E676).opacity(0.25), lineWidth: 1)
        )
    }

    private var statusLine: String {
        if let detail = metadata.phaseDetail, !detail.isEmpty {
            return "\(phaseLabel) - \(detail)"
        }
        if let note = metadata.note, !note.isEmpty {
            return "\(phaseLabel) - \(note)"
        }
        return phaseLabel
    }

    private var phaseLabel: String {
        switch metadata.phase {
        case "queued": return "Queued in Trigger.dev"
        case "starting": return "Starting V3 agent"
        case "loading_slate": return "Loading today's slate"
        case "analyzing": return "Reasoning through candidates"
        case "finalizing": return "Forcing final pick decision"
        case "submitting": return "Validating submitted picks"
        case "done": return "Writing final results"
        case let raw?: return raw.replacingOccurrences(of: "_", with: " ").capitalized
        case nil: return state.status.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private var turnText: String {
        guard let turn = metadata.turn else { return "0" }
        if let max = metadata.maxTurns { return "\(turn)/\(max)" }
        return "\(turn)"
    }

    private func toolDetail(_ tool: String) -> String {
        guard let detail = metadata.currentToolDetail, !detail.isEmpty else { return tool }
        return "\(tool) - \(detail)"
    }

    @ViewBuilder
    private func terminalRow(title: String, value: String, active: Bool) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("›")
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundStyle(Color(hex: 0x00E676))
            Text("\(title):")
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(Color(hex: 0x9FB3AD))
            Text(value)
                .font(.system(size: 13, design: .monospaced))
                .foregroundStyle(active ? Color(hex: 0x00E676) : Color(hex: 0x8CA89B))
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func statPill(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(.system(size: 9, weight: .semibold, design: .monospaced))
                .foregroundStyle(Color(hex: 0x9FB3AD))
            Text(value)
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundStyle(Color(hex: 0x00E676))
        }
        .frame(minWidth: 54, alignment: .leading)
        .padding(.horizontal, 9)
        .padding(.vertical, 7)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color(hex: 0x0E1512))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .strokeBorder(Color(hex: 0x00E676).opacity(0.18), lineWidth: 1)
        )
    }
}
