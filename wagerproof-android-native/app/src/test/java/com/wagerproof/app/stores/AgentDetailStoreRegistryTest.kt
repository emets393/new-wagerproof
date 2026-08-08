package com.wagerproof.app.stores

import com.wagerproof.core.stores.AgentDetailStoreRegistry
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotSame
import kotlin.test.assertSame

class AgentDetailStoreRegistryTest {

    @Test
    fun rebindingSameUserKeepsCachedStore() {
        val registry = AgentDetailStoreRegistry()
        registry.bindUser("user-a")
        val original = registry.store("agent-1")

        registry.bindUser("user-a")

        assertSame(original, registry.store("agent-1"))
        assertEquals(1, registry.size)
        registry.clear()
    }

    @Test
    fun accountSwitchClosesAndDropsCachedStores() {
        val registry = AgentDetailStoreRegistry()
        registry.bindUser("user-a")
        val previousAccountStore = registry.store("agent-1")

        registry.bindUser("user-b")

        assertEquals(0, registry.size)
        assertNotSame(previousAccountStore, registry.store("agent-1"))
        registry.clear()
    }

    @Test
    fun signOutDropsCachedStores() {
        val registry = AgentDetailStoreRegistry()
        registry.bindUser("user-a")
        registry.store("agent-1")

        registry.clear()

        assertEquals(0, registry.size)
    }
}
