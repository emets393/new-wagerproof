package com.wagerproof.core.services

import kotlinx.coroutines.CancellationException

/**
 * `runCatching`, minus the coroutine bug.
 *
 * The stdlib `runCatching` catches `Throwable`, and inside a coroutine that
 * includes the cancellation signal. Swallowing it tells the parent job the
 * child completed normally, so a torn-down screen keeps running its fetch and
 * keeps writing into an app-scoped store. Swift gets this for free — a
 * `CancellationError` propagates unless you explicitly catch it — which is why
 * the iOS stores have no equivalent guard.
 *
 * Use anywhere a *suspending* call is wrapped in a best-effort block. Pure
 * parsing helpers (date/JSON) can keep plain `runCatching`: no suspension
 * point, so no cancellation to lose.
 */
inline fun <T> runCatchingCancellable(block: () -> T): Result<T> =
    try {
        Result.success(block())
    } catch (cancellation: CancellationException) {
        throw cancellation
    } catch (error: Throwable) {
        Result.failure(error)
    }
