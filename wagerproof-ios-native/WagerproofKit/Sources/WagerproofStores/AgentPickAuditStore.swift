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

    /// Mirrors the RN `useMemo` block. The RN code reads JSONB fields
    /// (`ai_decision_trace`, `ai_audit_payload`, `archived_personality`,
    /// `archived_game_data`) — those aren't surfaced on our `AgentPick` model
    /// yet (B16 ticket), so we fall back to the public fields the model does
    /// expose. We still render a fully-formed audit payload so the sheet UI
    /// stays useful and matches the visual rhythm of the RN sheet.
    private func buildPayload(for pick: AgentPick) -> AgentPickAuditPayload {
        let leaned: [AgentPickAuditPayload.LeanedMetric] = (pick.keyFactors ?? []).enumerated().map { idx, factor in
            AgentPickAuditPayload.LeanedMetric(
                metricKey: "key_factor_\(idx + 1)",
                metricValue: factor,
                whyItMattered: factor,
                personalityTrait: "fallback_from_key_factors"
            )
        }

        let rationale = pick.reasoningText.isEmpty
            ? "No rationale text available."
            : pick.reasoningText
        let alignment = "Personality alignment trace will surface once the audit edge function (#079) is wired in B16."

        // Approximate the RN payload structures — these are the same fields
        // the LLM sees server-side, so a developer can sanity-check them.
        let gamePayload: [String: AnyEncodable] = [
            "game_id": AnyEncodable(pick.gameId),
            "sport": AnyEncodable(pick.sport.rawValue),
            "matchup": AnyEncodable(pick.matchup),
            "game_date": AnyEncodable(pick.gameDate)
        ]
        let personalityPayload: [String: AnyEncodable] = [
            "note": AnyEncodable("archived_personality not yet decoded — see ticket #079")
        ]
        let responsePayload: [String: AnyEncodable] = [
            "bet_type": AnyEncodable(pick.betType),
            "selection": AnyEncodable(pick.pickSelection),
            "odds": AnyEncodable(pick.odds ?? ""),
            "confidence": AnyEncodable(pick.confidence),
            "units": AnyEncodable(pick.units),
            "reasoning": AnyEncodable(pick.reasoningText),
            "key_factors": AnyEncodable(pick.keyFactors ?? [])
        ]

        return AgentPickAuditPayload(
            leanedMetrics: leaned,
            rationaleText: rationale,
            personalityAlignmentText: alignment,
            modelInputGameJSON: prettyPrint(gamePayload),
            modelInputPersonalityJSON: prettyPrint(personalityPayload),
            modelResponseJSON: prettyPrint(responsePayload),
            payloadIsFormatted: false
        )
    }

    private func prettyPrint(_ dict: [String: AnyEncodable]) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        do {
            let data = try encoder.encode(dict)
            return String(decoding: data, as: UTF8.self)
        } catch {
            return "{}"
        }
    }
}
