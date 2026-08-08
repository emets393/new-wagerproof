package com.wagerproof.app.features.agents

import com.wagerproof.core.stores.LoadState
import kotlin.test.Test
import kotlin.test.assertEquals

class AgentsScreenStateTest {

    @Test
    fun loadedEmptyOwnedListWithFollowsShowsFollowingRail() {
        assertEquals(
            MyAgentsBodyMode.FOLLOWING_ONLY,
            myAgentsBodyMode(
                loadState = LoadState.Loaded,
                ownedAgentsEmpty = true,
                hasFollows = true,
            ),
        )
    }

    @Test
    fun loadedAllEmptyStateStillShowsTrueEmptyExperience() {
        assertEquals(
            MyAgentsBodyMode.TRUE_EMPTY,
            myAgentsBodyMode(
                loadState = LoadState.Loaded,
                ownedAgentsEmpty = true,
                hasFollows = false,
            ),
        )
    }

    @Test
    fun initialAndFailedEmptyStatesStillTakePriorityOverFollows() {
        assertEquals(
            MyAgentsBodyMode.INITIAL_LOADING,
            myAgentsBodyMode(LoadState.Loading, ownedAgentsEmpty = true, hasFollows = true),
        )
        assertEquals(
            MyAgentsBodyMode.FAILED_EMPTY,
            myAgentsBodyMode(LoadState.Failed("offline"), ownedAgentsEmpty = true, hasFollows = true),
        )
    }

    @Test
    fun ownedAgentsKeepTheNormalContentMode() {
        assertEquals(
            MyAgentsBodyMode.OWNED_AGENTS,
            myAgentsBodyMode(LoadState.Loaded, ownedAgentsEmpty = false, hasFollows = true),
        )
    }
}
