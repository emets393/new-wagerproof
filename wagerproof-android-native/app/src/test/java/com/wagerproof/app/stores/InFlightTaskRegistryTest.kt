package com.wagerproof.app.stores

import com.wagerproof.core.stores.InFlightTaskRegistry
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/**
 * Mirrors iOS `InFlightTaskRegistryTests.swift`. Lives in :app because
 * :core:stores has no unit-test source set.
 */
class InFlightTaskRegistryTest {

    private fun registryScope() = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)

    @Test
    fun matchingKeysShareOneOperation() = runBlocking {
        val registry = InFlightTaskRegistry<String>(registryScope())
        val starts = AtomicInteger(0)
        val gate = CompletableDeferred<Unit>()

        val first = launch { registry.run("games") { starts.incrementAndGet(); gate.await() } }
        val second = launch { registry.run("games") { starts.incrementAndGet(); gate.await() } }
        // Let both callers reach the registry before the shared work finishes.
        yield()
        gate.complete(Unit)
        first.join()
        second.join()

        assertEquals(1, starts.get())
    }

    @Test
    fun differentKeysRunIndependently() = runBlocking {
        val registry = InFlightTaskRegistry<String>(registryScope())
        val starts = AtomicInteger(0)

        val games = launch { registry.run("games") { starts.incrementAndGet() } }
        val props = launch { registry.run("props") { starts.incrementAndGet() } }
        games.join()
        props.join()

        assertEquals(2, starts.get())
    }

    @Test
    fun keyIsReleasedOnceItsOperationFinishes() = runBlocking {
        val registry = InFlightTaskRegistry<String>(registryScope())
        val starts = AtomicInteger(0)

        registry.run("games") { starts.incrementAndGet() }
        // A later call is a NEW request, not a join on the finished one —
        // otherwise pull-to-refresh would never reach the server again.
        registry.run("games") { starts.incrementAndGet() }

        assertEquals(2, starts.get())
    }

    @Test
    fun cancelAllStopsOwnedWorkAndReleasesItsKey() = runBlocking {
        val registry = InFlightTaskRegistry<String>(registryScope())
        val starts = AtomicInteger(0)
        val started = CompletableDeferred<Unit>()
        val gate = CompletableDeferred<Unit>()

        val first = async {
            registry.run("follows:user-a") {
                starts.incrementAndGet()
                started.complete(Unit)
                gate.await()
            }
        }
        started.await()

        registry.cancelAll()

        assertFailsWith<CancellationException> { first.await() }
        registry.run("follows:user-a") { starts.incrementAndGet() }
        assertEquals(2, starts.get())
    }
}
