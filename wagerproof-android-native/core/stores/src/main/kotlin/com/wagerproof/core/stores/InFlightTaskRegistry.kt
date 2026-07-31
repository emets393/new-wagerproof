package com.wagerproof.core.stores

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async

/**
 * Coalesces matching async store loads so multiple screen lifecycles can await
 * one request instead of starting duplicate network + transformation work.
 * Port of iOS `InFlightTaskRegistry.swift` (commit 7166b538).
 *
 * The work runs on [scope] — the owning store's scope — NOT on the caller's
 * coroutine. That is deliberate and mirrors Swift's unstructured `Task`: a
 * caller that goes away (tab switch, screen disposal) cancels only its own
 * `await`, while the shared request keeps running for whoever else joined it.
 * Structured `coroutineScope { async { } }` would tear the shared work down
 * with the first caller to leave.
 *
 * The registry owns task lifetimes only; it never holds observable state, so
 * store state stays confined to whatever dispatcher [scope] uses.
 */
class InFlightTaskRegistry<K : Any>(private val scope: CoroutineScope) {

    private val lock = Any()
    private val tasks = mutableMapOf<K, Deferred<Unit>>()

    /**
     * Run [operation] for [key], or join the run already in flight for it.
     * [operation] is expected to handle its own failures (stores record errors
     * in their load state); anything it throws surfaces to every joined caller.
     */
    suspend fun run(key: K, operation: suspend () -> Unit) {
        val deferred = synchronized(lock) {
            tasks[key] ?: scope
                // LAZY so the body can't start inside the lock — on
                // Dispatchers.Main.immediate an eager async would run
                // synchronously up to its first suspension point right here.
                .async(start = CoroutineStart.LAZY) { operation() }
                .also { started ->
                    tasks[key] = started
                    started.invokeOnCompletion {
                        synchronized(lock) { if (tasks[key] === started) tasks.remove(key) }
                    }
                }
        }
        deferred.start()
        deferred.await()
    }
}
