package com.wagerproof.core.services

import kotlinx.coroutines.CancellationException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * `runCatchingCancellable` exists purely to NOT swallow the coroutine
 * cancellation signal, so that is what these assert.
 */
class CancellationTest {

    @Test
    fun `returns success for a normal value`() {
        val result = runCatchingCancellable { 42 }
        assertEquals(42, result.getOrNull())
    }

    @Test
    fun `captures ordinary failures like runCatching`() {
        val result = runCatchingCancellable { error("boom") }
        assertTrue(result.isFailure)
        assertEquals("boom", result.exceptionOrNull()?.message)
    }

    @Test
    fun `rethrows CancellationException instead of capturing it`() {
        assertFailsWith<CancellationException> {
            runCatchingCancellable { throw CancellationException("cancelled") }
        }
    }

    @Test
    fun `stdlib runCatching swallows cancellation - the bug this guards against`() {
        // Documents why the helper exists: same block, opposite outcome.
        @Suppress("TooGenericExceptionThrown")
        val swallowed = runCatching { throw CancellationException("cancelled") }
        assertTrue(swallowed.isFailure)
        assertTrue(swallowed.exceptionOrNull() is CancellationException)
    }
}
