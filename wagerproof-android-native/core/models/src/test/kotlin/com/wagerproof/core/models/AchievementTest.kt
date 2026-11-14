package com.wagerproof.core.models

import kotlin.test.*
import kotlinx.serialization.json.Json

class AchievementTest {
    @Test fun catalogMatchesExpandedMilestones() {
        val definitions = AchievementCatalog.definitions
        assertEquals(35, definitions.size)
        assertEquals(35, definitions.map { it.id }.toSet().size)
        assertEquals(5000.0, definitions.first { it.id == "experience-5000" }.target)
        assertEquals(25.0, definitions.first { it.id == "streak-25" }.target)
        assertEquals(5.0, definitions.first { it.id == "full-lineup" }.target)
        assertTrue(definitions.first { it.id == "consistent-500" }.requirement.contains("500 decided"))
    }
    @Test fun progressCannotUnlockAnAchievement() {
        val definition = AchievementCatalog.definitions.first()
        assertFalse(Achievement(definition, AchievementStatus(definition.id, progress = 1.0)).earned)
        assertEquals(0f, Achievement(definition, AchievementStatus(definition.id, progress = Double.NaN)).fraction)
    }
    @Test fun persistedUnlockSurvivesMissingOrLockedIncomingRow() {
        val definition = AchievementCatalog.definitions.first()
        val prior = Achievement(definition, AchievementStatus(definition.id, earnedAt = "2026-09-01T00:00:00Z", creditedAgentId = "original-agent"))
        for (incoming in listOf(emptyList(), listOf(AchievementStatus(definition.id)))) {
            val merged = mergeAchievementStatuses(listOf(prior), incoming).first()
            assertTrue(merged.earned)
            assertEquals(prior.status.earnedAt, merged.status.earnedAt)
            assertEquals("original-agent", merged.status.creditedAgentId)
        }
    }
    @Test fun earliestUnlockAndItsAttributionRemainAuthoritative() {
        val definition = AchievementCatalog.definitions.first()
        val prior = Achievement(definition, AchievementStatus(definition.id, earnedAt = "2026-09-01T00:00:00Z", isBackfilled = true, creditedAgentId = "original-agent"))
        val incoming = AchievementStatus(definition.id, earnedAt = "2026-09-09T00:00:00Z", creditedAgentId = "other-agent")
        val merged = mergeAchievementStatuses(listOf(prior), listOf(incoming)).first()
        assertEquals(prior.status.earnedAt, merged.status.earnedAt)
        assertTrue(merged.status.isBackfilled)
        assertEquals("original-agent", merged.status.creditedAgentId)
    }
    @Test fun wireContractDecodesServerFields() {
        val snapshot = Json { ignoreUnknownKeys = true }.decodeFromString<AchievementSnapshot>("""{"catalog_version":2,"initialized_at":"2026-09-09T00:00:00Z","generated_at":"2026-09-09T00:00:01Z","newly_unlocked_ids":["streak-25"],"achievements":[{"id":"streak-25","earned_at":"2026-09-09T00:00:01Z","is_backfilled":false,"current_value":25,"target_value":25,"progress":1}]}""")
        assertEquals(2, snapshot.catalogVersion)
        assertEquals(listOf("streak-25"), snapshot.newlyUnlockedIds)
        assertEquals(25.0, snapshot.achievements.single().currentValue)
    }
}
