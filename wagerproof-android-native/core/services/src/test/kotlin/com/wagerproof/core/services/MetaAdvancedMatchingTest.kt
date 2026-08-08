package com.wagerproof.core.services

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * Meta hashes first and last name as SEPARATE fields, so a bad split silently
 * costs match rate — and hashing an empty string is worse than sending nothing.
 */
class MetaAdvancedMatchingTest {

    @Test
    fun `splits a two-part name`() {
        assertEquals("Chris" to "Habib", MetaAnalyticsService.splitDisplayName("Chris Habib"))
    }

    @Test
    fun `keeps every trailing part as the last name`() {
        assertEquals(
            "Jean" to "Luc Picard",
            MetaAnalyticsService.splitDisplayName("Jean Luc Picard"),
        )
    }

    @Test
    fun `single-word names have no last name`() {
        assertEquals("Cher" to null, MetaAnalyticsService.splitDisplayName("Cher"))
    }

    @Test
    fun `collapses runs of whitespace instead of emitting empty parts`() {
        assertEquals("Chris" to "Habib", MetaAnalyticsService.splitDisplayName("  Chris   Habib  "))
    }

    @Test
    fun `blank and null names hash nothing`() {
        assertEquals(null to null, MetaAnalyticsService.splitDisplayName(null))
        assertEquals(null to null, MetaAnalyticsService.splitDisplayName("   "))
    }

    @Test
    fun `nonEmpty trims and nulls out blanks`() {
        assertEquals("a@b.com", MetaAnalyticsService.nonEmpty("  a@b.com "))
        assertNull(MetaAnalyticsService.nonEmpty("   "))
        assertNull(MetaAnalyticsService.nonEmpty(null))
    }
}
