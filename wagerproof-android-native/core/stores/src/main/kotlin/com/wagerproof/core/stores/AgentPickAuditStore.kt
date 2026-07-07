package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.AgentPickAuditPayload

/**
 * Port of iOS `AgentPickAuditStore.swift` (doc §8.6). "Pick Audit"
 * terminal-style sheet state + payload derivation from a pick's
 * `ai_decision_trace` / `ai_audit_payload` JSONB (V2 + V3), with legacy
 * fallbacks. One instance app-wide (environment-injected at app root).
 *
 * The payload derivation itself lives on the model layer as
 * [AgentPickAuditPayload.from] (byte-for-byte port of the Swift `buildPayload`);
 * this store owns the presentation state and delegates.
 */
@Stable
class AgentPickAuditStore {
    var selectedPick by mutableStateOf<AgentPick?>(null); private set
    var payload by mutableStateOf(AgentPickAuditPayload()); private set
    var isPresented by mutableStateOf(false)

    fun present(pick: AgentPick) {
        selectedPick = pick
        payload = buildPayload(pick)
        isPresented = true
    }

    fun dismiss() {
        isPresented = false
        // Keep `selectedPick` so the sheet can fade out cleanly; cleared on the
        // next `present()`.
    }

    /**
     * Drops the entire audit selection — sets [selectedPick] back to null so
     * widgets gated on it (e.g. the rationale card in game bottom sheets) stop
     * rendering as soon as the sheet closes.
     */
    fun clear() {
        selectedPick = null
        payload = AgentPickAuditPayload()
        isPresented = false
    }

    private fun buildPayload(pick: AgentPick): AgentPickAuditPayload =
        AgentPickAuditPayload.from(pick)
}
