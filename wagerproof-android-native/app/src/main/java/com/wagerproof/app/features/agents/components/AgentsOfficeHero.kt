package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.pixeloffice.PixelOffice
import com.wagerproof.core.design.pixeloffice.PixelOfficeAgentSpec
import com.wagerproof.core.models.AgentWithPerformance
import java.time.Instant
import java.time.ZoneId

/**
 * "Agent HQ" hero row — Compose port of iOS `AgentsView.officeRow` / the spec
 * derivation in `PixelOffice.swift`. Wraps the reusable [PixelOffice] Canvas
 * scene at the 864×800 logical aspect ratio and feeds it per-agent display
 * specs derived from live agent state.
 *
 * The corner overlays ("Agent HQ — Live" pill + agency stats) are added by the
 * caller (`AgentsScreen.OfficeHero`), matching iOS's `.overlay` composition —
 * this component owns only the scene itself.
 */
@Composable
fun AgentsOfficeHero(
    agents: List<AgentWithPerformance>,
    isActive: Boolean,
    modifier: Modifier = Modifier,
) {
    // Up to 8 rendered — one per desk. Empty list → PixelOffice seeds its own
    // 4-agent fallback roster (mirrors iOS's nil/empty branch).
    val specs = agents.take(8).map { it.toOfficeSpec() }

    PixelOffice(
        agents = specs,
        isActive = isActive,
        // Explicit 864:800 clip mirrors the iOS SKView frame; PixelOffice also
        // aspect-fits internally, so this stays idempotent.
        modifier = modifier
            .aspectRatio(864f / 800f)
            .clip(RoundedCornerShape(20.dp)),
    )
}

/**
 * Derive an office display state from an [AgentWithPerformance]. Mirrors
 * `PixelOfficeAgentSpec.make(from:)` in PixelOfficeScene.swift (itself a port of
 * `deriveOfficeState` in PixelOffice.tsx): off when paused, "picks ready" when
 * generated today, otherwise "working".
 */
private fun AgentWithPerformance.toOfficeSpec(): PixelOfficeAgentSpec {
    val state: String
    val label: String
    when {
        !agent.isActive -> {
            state = "idle"; label = "OFF"
        }
        agent.lastGeneratedAt?.let(::isToday) == true -> {
            state = "done"; label = "PICKS READY"
        }
        else -> {
            state = "working"; label = "WORKING"
        }
    }
    return PixelOfficeAgentSpec(
        displayName = agent.name,
        emoji = agent.avatarEmoji,
        accentColorHex = agent.avatarColor,
        spriteIndex = agent.spriteIndex,
        state = state,
        stateLabel = label,
        isActive = agent.isActive,
    )
}

/** True when an ISO-8601 timestamp falls on the device's current local date. */
private fun isToday(iso: String): Boolean = runCatching {
    val date = Instant.parse(iso).atZone(ZoneId.systemDefault()).toLocalDate()
    date == java.time.LocalDate.now()
}.getOrDefault(false)
