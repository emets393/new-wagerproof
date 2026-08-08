package com.wagerproof.app.widgets

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class WidgetSyncDomainsTest {

    @Test
    fun coalescingRequiresEveryCurrentlyInstalledDomain() {
        val agentsOnly = WidgetSyncCoordinator.InstalledDomains(
            agents = true,
            outliers = false,
        )
        val both = WidgetSyncCoordinator.InstalledDomains(
            agents = true,
            outliers = true,
        )

        assertTrue(agentsOnly.covers(agentsOnly))
        assertFalse(agentsOnly.covers(both))
        assertTrue((agentsOnly + both).covers(both))
    }
}
