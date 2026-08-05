package com.wagerproof.app.features.outliers

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

class OutliersTrendRowIconTest {
    @Test
    fun compactFixtureLabelsResolveToSemanticIcons() {
        assertEquals("house.fill", rowIcon("At home"))
        assertEquals("pawprint.fill", rowIcon("As an underdog"))
        assertEquals("person.line.dotted.person.fill", rowIcon("Vs Kansas City"))
        assertNotEquals("circle.fill", rowIcon("In series openers"))
    }
}
