package com.wagerproof.app.features.agents

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.agents.components.TopAgentPicksFeed
import com.wagerproof.core.models.TopAgentPickFeedRow
import com.wagerproof.core.stores.FavoriteAgentsStore
import com.wagerproof.core.stores.LoadState
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
    val isFirstBind = remember { mutableStateOf(true) }

    // iOS splits this in two: `.task` guards the FIRST fetch with `if case
    // .idle`, and only a real viewer change refreshes unconditionally
    // (AgentsView+TopPicks.swift:94-98). A single unguarded effect here refetched
    // a feed the store had already loaded every time this container remounted.
    LaunchedEffect(viewerUserId) {
        store.bind(viewerUserId)
        val isInitial = isFirstBind.value
        isFirstBind.value = false
        if (!isInitial || store.loadState is LoadState.Idle) store.refresh()
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
