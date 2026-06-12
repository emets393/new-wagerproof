import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Audit-widget state. Replaces RN `AgentPickAuditContext`.
///
/// One detail screen owns a single instance; tapping "Open Pick Audit" on a
/// row calls `present(pick:)` which derives the structured audit payload from
/// the pick's stored fields. The view binds the resulting `payload` to render
/// the terminal-style sheet.
///
/// All transformations match the inline `useMemo` in the RN screen
/// (`agents/[id]/index.tsx:571-633`).
@Observable
@MainActor
public final class AgentPickAuditStore {
    public private(set) var selectedPick: AgentPick?
    public private(set) var payload: AgentPickAuditPayload = AgentPickAuditPayload()
    public var isPresented: Bool = false

    public init() {}

    public func present(pick: AgentPick) {
        selectedPick = pick
        payload = buildPayload(for: pick)
        isPresented = true
    }

    public func dismiss() {
        isPresented = false
        // Keep `selectedPick` so the sheet can fade out cleanly; cleared on the
        // next `present()`.
    }

    /// Drops the entire audit selection. Mirrors RN's `clearAgentPickAudit()`
    /// in `contexts/AgentPickAuditContext.tsx` — sets `selectedAgentPick` back
    /// to `null` so widgets gated on `selectedPick` (e.g. the rationale card in
    /// game bottom sheets) stop rendering as soon as the sheet closes.
    public func clear() {
        selectedPick = nil
        payload = AgentPickAuditPayload()
        isPresented = false
    }

    // MARK: - Payload derivation

    /// Builds the audit payload from the REAL `ai_decision_trace` /
    /// `ai_audit_payload` JSONB when present (both V2 and V3 generation
    /// payloads), falling back to the public pick fields for legacy rows
    /// where the trace is missing. Also assembles `fullTraceJSON` — the
    /// complete dump the "Copy Full Trace" button exports for debugging.
    private func buildPayload(for pick: AgentPick) -> AgentPickAuditPayload {
        let trace = pick.aiDecisionTrace
        let audit = pick.aiAuditPayload

        // Leaned metrics: real trace first, key_factors fallback.
        var leaned: [AgentPickAuditPayload.LeanedMetric] = (trace?["leaned_metrics"]?.arrayValue ?? []).compactMap { m in
            // V3 tool-schema uses metric_key; lenient Zod also lets "metric" through.
            guard let key = m["metric_key"]?.stringValue ?? m["metric"]?.stringValue else { return nil }
            return AgentPickAuditPayload.LeanedMetric(
                metricKey: key,
                metricValue: m["metric_value"]?.stringValue ?? "",
                whyItMattered: m["why_it_mattered"]?.stringValue ?? "",
                personalityTrait: m["personality_trait"]?.stringValue
                    ?? m["source_tool_call_id"].map { "source: \($0.stringValue ?? "?")" }
                    ?? ""
            )
        }
        if leaned.isEmpty {
            leaned = (pick.keyFactors ?? []).enumerated().map { idx, factor in
                AgentPickAuditPayload.LeanedMetric(
                    metricKey: "key_factor_\(idx + 1)",
                    metricValue: factor,
                    whyItMattered: factor,
                    personalityTrait: "fallback_from_key_factors"
                )
            }
        }

        let rationale = trace?["rationale_summary"]?.stringValue
            ?? (pick.reasoningText.isEmpty ? "No rationale text available." : pick.reasoningText)
        let alignment = trace?["personality_alignment"]?.stringValue
            ?? "No personality-alignment trace stored for this pick."

        // Model input/response panes. V2 stores model_input_*; V3 stores the
        // resolved steering instead of a stuffed input payload (the input was
        // the agentic tool loop — see the run-level v3_tool_trace).
        let gameJSON = audit?["model_input_game_payload"]?.prettyPrinted ?? "{}"
        let personalityJSON = audit?["model_input_personality_payload"]?.prettyPrinted
            ?? audit?["steering"]?.prettyPrinted
            ?? "{}"
        let responseJSON = audit?["model_response_payload"]?.prettyPrinted ?? "{}"
        let isV3 = audit?["generation_version"]?.stringValue == "v3"

        // V3 embeds the loop's tool calls in ai_audit_payload.tool_trace
        // (seq 0 = the slate the model was shown). Empty for V2/legacy picks.
        let toolTraceValue = audit?["tool_trace"]
        let toolTrace: [AgentPickAuditPayload.ToolTraceEntry] = (toolTraceValue?.arrayValue ?? [])
            .compactMap { entry in
                guard let name = entry["name"]?.stringValue else { return nil }
                return AgentPickAuditPayload.ToolTraceEntry(
                    seq: entry["seq"]?.intValue ?? 0,
                    name: name,
                    ms: entry["ms"]?.intValue ?? 0,
                    ok: entry["ok"]?.boolValue ?? false,
                    resultExcerpt: entry["result_excerpt"]?.stringValue
                        ?? entry["result_summary"]?.stringValue
                        ?? ""
                )
            }
            .sorted { $0.seq < $1.seq }

        // Full export: every audit artifact in one copyable JSON document.
        let full: JSONValue = .object([
            "pick": .object([
                "id": .string(pick.id),
                "game_id": .string(pick.gameId),
                "sport": .string(pick.sport.rawValue),
                "matchup": .string(pick.matchup),
                "game_date": .string(pick.gameDate),
                "bet_type": .string(pick.betType),
                "pick_selection": .string(pick.pickSelection),
                "odds": .string(pick.odds ?? ""),
                "units": .double(pick.units),
                "confidence": .int(pick.confidence),
                "result": .string(pick.result.rawValue),
                "reasoning_text": .string(pick.reasoningText),
                "key_factors": .array((pick.keyFactors ?? []).map { JSONValue.string($0) }),
                "created_at": .string(pick.createdAt)
            ]),
            "ai_decision_trace": trace ?? .null,
            "ai_audit_payload": audit ?? .null
        ])

        return AgentPickAuditPayload(
            leanedMetrics: leaned,
            rationaleText: rationale,
            personalityAlignmentText: alignment,
            modelInputGameJSON: gameJSON,
            modelInputPersonalityJSON: personalityJSON,
            modelResponseJSON: responseJSON,
            payloadIsFormatted: isV3 || audit?["model_input_game_payload"] != nil,
            fullTraceJSON: full.prettyPrinted,
            toolTrace: toolTrace,
            toolTraceJSON: toolTraceValue?.prettyPrinted ?? "[]"
        )
    }

}
