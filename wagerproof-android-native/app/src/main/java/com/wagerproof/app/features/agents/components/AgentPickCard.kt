package com.wagerproof.app.features.agents.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.core.models.AgentPick

// =====================================================================
// AgentPickCard — thin wrapper over AgentPickItem with full reasoning.
// No live call sites; ported for parity. Port of iOS AgentPickCard.swift.
// =====================================================================

@Composable
fun AgentPickCard(
    pick: AgentPick,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    onTap: () -> Unit = {},
) {
    AgentPickItem(
        pick = pick,
        modifier = modifier,
        showReasoning = ReasoningMode.Full,
        loading = loading,
        onTap = onTap,
    )
}
