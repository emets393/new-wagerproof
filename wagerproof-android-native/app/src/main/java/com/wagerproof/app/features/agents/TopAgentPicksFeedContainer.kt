package com.wagerproof.app.features.agents

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.agents.components.TopAgentPicksFeed
import com.wagerproof.core.models.TopAgentPickFeedRow
import com.wagerproof.core.stores.FavoriteAgentsStore
import com.wagerproof.core.stores.TopAgentPicksFeedStore

/**
 * Drop-in wrapper around [TopAgentPicksFeed] that owns its own feed +
 * favorites stores and handles the bind / first-refresh plumbing. iOS
 * `AgentsView+TopPicks.TopAgentPicksFeedContainer`. Usable from any surface
 * (drawer screen, deep link) without redoing the wiring. AgentsScreen lifts its
 * own stores instead so its filter menu can drive `filterMode`; this container
 * is the canonical standalone wiring.
 */
@Composable
fun TopAgentPicksFeedContainer(
    viewerUserId: String?,
    onAgentTap: (String) -> Unit,
    onPickTap: (TopAgentPickFeedRow) -> Unit,
    modifier: Modifier = Modifier,
) {
    val store = remember { TopAgentPicksFeedStore() }
    val favorites = remember { FavoriteAgentsStore() }

    // Rebind + refresh whenever the viewer changes (also fires the first refresh).
    LaunchedEffect(viewerUserId) {
        store.bind(viewerUserId)
        store.refresh()
    }

    TopAgentPicksFeed(
        store = store,
        favorites = favorites,
        showsFilters = true,
        pinnedHeader = {},
        onAgentTap = onAgentTap,
        onPickTap = onPickTap,
        modifier = modifier,
    )
}
