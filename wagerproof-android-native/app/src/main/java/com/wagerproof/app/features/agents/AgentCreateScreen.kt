package com.wagerproof.app.features.agents

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.agents.creation.AgentBuilderScreen
import com.wagerproof.app.nav.LocalAppNavigator

/**
 * Route host for in-app agent creation (`AppRoute.AgentCreate`).
 *
 * The Step 1–6 wizard this used to render is RETIRED — iOS replaced it with the
 * onboarding pixelwave carousel builder (`AgentBuilderView`), and the post-create
 * PREPARING + CELEBRATION cinematics went with it. Creation now lands straight on
 * the new agent's detail page, where the existing ticket-printer reveal plays
 * once picks generate.
 *
 * The wizard's step views (`creation/Step1…Step6View.kt`) and its two overlay
 * cinematics (`creation/AgentCreationOverlays.kt`) are no longer reachable from
 * the app; they are left on disk pending a separate deletion pass.
 */
@Composable
fun AgentCreateScreen(modifier: Modifier = Modifier) {
    val navigator = LocalAppNavigator.current
    AgentBuilderScreen(
        modifier = modifier,
        onCreated = { agent ->
            navigator.popAgents()
            navigator.openAgentDetail(agent.id, isPublic = false)
        },
        onCancel = { navigator.popAgents() },
    )
}
