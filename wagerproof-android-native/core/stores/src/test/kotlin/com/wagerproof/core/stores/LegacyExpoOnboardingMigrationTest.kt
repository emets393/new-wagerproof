package com.wagerproof.core.stores

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class LegacyExpoOnboardingMigrationTest {
    private val userId = "75a94469-ece8-4e4b-8811-b53018bc7315"

    @Test
    fun `expo completion migrates only when native state is absent`() {
        val decision = decide(nativeValue = null, legacyCompletionRaw = "true")

        assertTrue(decision.isComplete)
        assertTrue(decision.shouldPersistNativeCompletion)
    }

    @Test
    fun `native false reset tombstone wins over stale expo completion`() {
        val decision = decide(nativeValue = false, legacyCompletionRaw = "true")

        assertFalse(decision.isComplete)
        assertFalse(decision.shouldPersistNativeCompletion)
    }

    @Test
    fun `native true avoids repeat migration`() {
        val decision = decide(nativeValue = true, legacyCompletionRaw = null)

        assertTrue(decision.isComplete)
        assertFalse(decision.shouldPersistNativeCompletion)
    }

    @Test
    fun `missing legacy state keeps a genuinely new user incomplete`() {
        val decision = decide(nativeValue = null, legacyCompletionRaw = null)

        assertFalse(decision.isComplete)
        assertFalse(decision.shouldPersistNativeCompletion)
    }

    @Test
    fun `literal values other than true do not complete onboarding`() {
        for (raw in listOf("false", "TRUE", "1", "", "not-json")) {
            assertFalse(decide(nativeValue = null, legacyCompletionRaw = raw).isComplete, raw)
        }
    }

    @Test
    fun `pending expo onboarding write preserves offline completion`() {
        val queue = """
            [
              {"type":"onboarding_completion","userId":"${userId.uppercase()}","payload":{}},
              {"type":"something_else","userId":"different-user","payload":{}}
            ]
        """.trimIndent()

        val decision = decide(
            nativeValue = null,
            legacyCompletionRaw = null,
            legacyOfflineQueueRaw = queue,
        )

        assertTrue(decision.isComplete)
        assertTrue(decision.shouldPersistNativeCompletion)
    }

    @Test
    fun `malformed or another users queue does not complete onboarding`() {
        val otherUserQueue = """[{"type":"onboarding_completion","userId":"other-user"}]"""

        assertFalse(
            decide(
                nativeValue = null,
                legacyCompletionRaw = null,
                legacyOfflineQueueRaw = otherUserQueue,
            ).isComplete,
        )
        assertFalse(
            decide(
                nativeValue = null,
                legacyCompletionRaw = null,
                legacyOfflineQueueRaw = "{malformed",
            ).isComplete,
        )
    }

    private fun decide(
        nativeValue: Boolean?,
        legacyCompletionRaw: String?,
        legacyOfflineQueueRaw: String? = null,
    ): LegacyExpoOnboardingMigration.Decision = LegacyExpoOnboardingMigration.decide(
        nativeValue = nativeValue,
        legacyCompletionRaw = legacyCompletionRaw,
        legacyOfflineQueueRaw = legacyOfflineQueueRaw,
        userId = userId,
    )
}
