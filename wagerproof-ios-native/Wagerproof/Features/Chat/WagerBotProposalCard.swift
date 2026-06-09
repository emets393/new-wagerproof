import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Lightweight inline preview card used when an assistant emits a
/// suggestion the user can confirm. Honeydew's `ChatV3ProposalCard`
/// fallback path: full-width card with a leading icon, a one-liner
/// summary, and a confirm / skip pair.
///
/// Wagerproof currently has no first-class proposal types (recipes,
/// meal plans, grocery lists) — `present_analysis` widgets are
/// informational, not actionable. This card is wired in for forward
/// compatibility: when the edge function gains an action shape
/// (e.g. "save pick", "track game") we can route through this view.
struct WagerBotProposalCard: View {
    let title: String
    let detail: String?
    let iconSystemName: String
    let ui: WagerBotUiTokens
    var onConfirm: (() -> Void)?
    var onSkip: (() -> Void)?

    enum Status { case pending, executing, confirmed, failed, skipped }

    var status: Status = .pending

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: iconSystemName)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(ui.accent)
                    .frame(width: 28, height: 28)
                    .background(Circle().fill(ui.accent.opacity(0.15)))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(ui.primaryText)
                    if let detail, !detail.isEmpty {
                        Text(detail)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(ui.mutedText)
                            .lineLimit(3)
                    }
                }
                Spacer(minLength: 0)
            }

            HStack(spacing: 8) {
                Button {
                    onSkip?()
                } label: {
                    Text("Skip")
                        .font(.system(size: 13, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(ui.controlBackground)
                        .foregroundStyle(ui.primaryText)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                .disabled(status != .pending)

                Button {
                    onConfirm?()
                } label: {
                    HStack {
                        if status == .executing {
                            ProgressView().controlSize(.small)
                        }
                        Text(confirmLabel)
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(ui.primaryActionBackground)
                    .foregroundStyle(ui.primaryActionForeground)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                .disabled(status != .pending)
            }
        }
        .padding(14)
        .background(ui.hintChipBackground)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(ui.borderColor, lineWidth: 1)
        )
    }

    private var confirmLabel: String {
        switch status {
        case .pending:   return "Confirm"
        case .executing: return "Working…"
        case .confirmed: return "Done"
        case .failed:    return "Retry"
        case .skipped:   return "Skipped"
        }
    }
}
