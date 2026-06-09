import SwiftUI
import UIKit
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Native port of `components/agents/AgentPickPayloadAuditWidget.tsx`. The
/// "terminal" debug surface that dumps the raw audit payload (game inputs,
/// personality inputs, model response, leaned metrics) for a single pick.
///
/// Driven by `AgentPickAuditStore.payload`. Includes a copy-to-clipboard
/// button so developers / debugging users can paste the dump elsewhere.
struct AgentPickPayloadAuditWidget: View {
    let pick: AgentPick
    let payload: AgentPickAuditPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header — terminal-style pick id label
            Text("terminal://pick-audit/\(pick.id.prefix(8))")
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(Color(hex: 0x9FB3AD))

            // Matchup banner row
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("›")
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color(hex: 0x00E676))
                Text("\(pick.matchup) | \(pick.pickSelection)")
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Color(hex: 0x26DF85))
            }

            section(title: "LEANED METRICS") {
                if payload.leanedMetrics.isEmpty {
                    Text("No explicit leaned metrics were returned for this pick.")
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundStyle(Color.appTextSecondary)
                } else {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(payload.leanedMetrics) { metric in
                            VStack(alignment: .leading, spacing: 3) {
                                Text("\(metric.metricKey) = \(metric.metricValue)")
                                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(Color(hex: 0x26DF85))
                                Text(metric.whyItMattered)
                                    .font(.system(size: 12, design: .monospaced))
                                    .foregroundStyle(Color.appTextSecondary)
                                Text("trait: \(metric.personalityTrait)")
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundStyle(Color.appTextSecondary.opacity(0.7))
                            }
                        }
                    }
                }
            }

            section(title: "WHY THIS PICK") {
                Text(payload.rationaleText)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            section(title: "PERSONALITY ALIGNMENT") {
                Text(payload.personalityAlignmentText)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            payloadSection(title: "MODEL INPUT GAME PAYLOAD", json: payload.modelInputGameJSON)
            if !payload.payloadIsFormatted {
                Text("Note: This appears to be a legacy raw snapshot. New picks store the exact formatted model input payload.")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Color(hex: 0xF59E0B))
            }
            payloadSection(title: "AGENT PERSONALITY PAYLOAD", json: payload.modelInputPersonalityJSON)
            payloadSection(title: "AGENT RESPONSE PAYLOAD", json: payload.modelResponseJSON)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(hex: 0x050909))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color(hex: 0x00E676).opacity(0.25), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func section<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 11, weight: .heavy, design: .monospaced))
                .tracking(1.2)
                .foregroundStyle(Color(hex: 0x9FB3AD))
            content()
        }
        .padding(.top, 8)
    }

    private func payloadSection(title: String, json: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.system(size: 11, weight: .heavy, design: .monospaced))
                    .tracking(1.2)
                    .foregroundStyle(Color(hex: 0x9FB3AD))
                Spacer()
                Button {
                    UIPasteboard.general.string = json
                } label: {
                    HStack(spacing: 3) {
                        Image(systemName: "doc.on.doc")
                            .font(.system(size: 10, weight: .semibold))
                        Text("Copy")
                            .font(.system(size: 10, weight: .heavy, design: .monospaced))
                            .tracking(0.5)
                    }
                    .foregroundStyle(Color(hex: 0x26DF85))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Copy \(title)")
            }
            ScrollView(.horizontal, showsIndicators: false) {
                Text(json)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Color(hex: 0x8CA89B))
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(Color.black.opacity(0.4))
                    )
            }
        }
        .padding(.top, 8)
    }
}
