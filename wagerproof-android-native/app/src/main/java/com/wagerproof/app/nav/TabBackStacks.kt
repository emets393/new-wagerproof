package com.wagerproof.app.nav

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.toMutableStateList
import com.wagerproof.core.stores.MainTabStore

/**
 * Per-tab navigation back stacks — the Android stand-in for iOS's per-tab
 * `NavigationStack` paths (doc 08 §3.2 closing note). Each bar tab keeps its own
 * stack so switching tabs preserves where you were; the root composable pushes/
 * pops these in response to `MainTabStore` signals and user taps.
 */
@Stable
class TabBackStacks {

    // One mutable stack per bar tab, each seeded with its home route.
    private val stacks = mutableStateMapOf<MainTabStore.Tab, SnapshotStateList<AppRoute>>().apply {
        BAR_TABS.forEach { tab -> put(tab, mutableListOf(AppRoute.home(tab)).toMutableStateList()) }
    }

    fun stackFor(tab: MainTabStore.Tab): SnapshotStateList<AppRoute> =
        stacks.getOrPut(tab) { mutableListOf(AppRoute.home(tab)).toMutableStateList() }

    fun top(tab: MainTabStore.Tab): AppRoute = stackFor(tab).last()

    fun canPop(tab: MainTabStore.Tab): Boolean = stackFor(tab).size > 1

    /** Push a destination onto a tab's stack (dedupe consecutive identical tops). */
    fun push(tab: MainTabStore.Tab, route: AppRoute) {
        val stack = stackFor(tab)
        if (stack.lastOrNull() != route) stack.add(route)
    }

    /** Pop the tab's top; no-op at the root. Returns true if it actually popped. */
    fun pop(tab: MainTabStore.Tab): Boolean {
        val stack = stackFor(tab)
        if (stack.size <= 1) return false
        stack.removeAt(stack.lastIndex)
        return true
    }

    /** Reset a tab back to its home route (re-tap-active-tab behavior). */
    fun popToRoot(tab: MainTabStore.Tab) {
        val stack = stackFor(tab)
        while (stack.size > 1) stack.removeAt(stack.lastIndex)
    }

    companion object {
        /** Tabs that own a stack. Games/Props/Agents/Outliers/Search + side-menu Scoreboard. */
        val BAR_TABS = listOf(
            MainTabStore.Tab.Games,
            MainTabStore.Tab.Props,
            MainTabStore.Tab.Agents,
            MainTabStore.Tab.Outliers,
            MainTabStore.Tab.Search,
            MainTabStore.Tab.Scoreboard,
        )
    }
}

@Composable
fun rememberTabBackStacks(): TabBackStacks = remember { TabBackStacks() }
