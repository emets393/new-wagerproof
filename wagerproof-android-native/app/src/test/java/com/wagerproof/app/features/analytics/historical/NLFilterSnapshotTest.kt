package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.NLFilterSnapshot
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * The snapshot ⇄ canonical-web-filter conversion the NL filter chat rides on.
 * Everything here is pure: no edge function, no store.
 */
class NLFilterSnapshotTest {

    private fun web(json: String): JsonObject = Json.parseToJsonElement(json) as JsonObject

    // MARK: - serialize

    @Test
    fun untouchedSnapshotSerializesToBetTypeOnly() {
        val nfl = NLFilterSnapshot.serialize(
            HistoricalAnalysisSport.NFL,
            HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL),
        )
        // A full dump of 120 default dims makes every untouched slider look
        // deliberate to the model — defaults must be omitted entirely.
        assertEquals(setOf("betType"), nfl.keys)
        assertEquals("fg_spread", nfl.getValue("betType").jsonPrimitive.content)

        val mlb = NLFilterSnapshot.serialize(
            HistoricalAnalysisSport.MLB,
            HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB),
        )
        assertEquals(setOf("betType"), mlb.keys)
    }

    @Test
    fun changedFootballDimsEmitCanonicalPairKeys() {
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL).apply {
            seasonMin = 2019
            side = "away"
            favDog = "underdog"
            spreadMin = 3.0
            spreadMax = 7.0
            primetime = true
            winStreak = listOf(3, 16)
            lastResult = "lost"
            teams = listOf("KC", "BUF")
        }

        val out = NLFilterSnapshot.serialize(HistoricalAnalysisSport.NFL, snapshot)

        assertEquals(listOf(2019, 2025), out.getValue("seasons").jsonArray.map { it.jsonPrimitive.int })
        assertEquals("away", out.getValue("side").jsonPrimitive.content)
        assertEquals("underdog", out.getValue("favDog").jsonPrimitive.content)
        assertEquals(listOf(3.0, 7.0), out.getValue("spreadSize").jsonArray.map { it.jsonPrimitive.double })
        assertTrue(out.getValue("primetime").jsonPrimitive.boolean)
        assertEquals(listOf(3, 16), out.getValue("winStreak").jsonArray.map { it.jsonPrimitive.int })
        assertEquals("lost", out.getValue("lastResult").jsonPrimitive.content)
        assertEquals(listOf("KC", "BUF"), out.getValue("teams").jsonArray.map { it.jsonPrimitive.content })
    }

    @Test
    fun mlbDomeSerializesAsBooleanAndFootballAsEnumString() {
        val mlb = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB).apply { dome = "dome" }
        assertTrue(NLFilterSnapshot.serialize(HistoricalAnalysisSport.MLB, mlb).getValue("dome").jsonPrimitive.boolean)

        val outdoor = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB).apply { dome = "outdoor" }
        assertFalse(NLFilterSnapshot.serialize(HistoricalAnalysisSport.MLB, outdoor).getValue("dome").jsonPrimitive.boolean)

        val nfl = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL).apply { dome = "dome" }
        assertEquals("dome", NLFilterSnapshot.serialize(HistoricalAnalysisSport.NFL, nfl).getValue("dome").jsonPrimitive.content)
    }

    @Test
    fun mlbOnlyDimsAreSerializedWithSentinelDefaults() {
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB).apply {
            monthMin = 7
            monthMax = 8
            tripMin = 3
            spHand = "L"
            seriesGames = listOf(3, 1)
            streakMax = "-3"
        }

        val out = NLFilterSnapshot.serialize(HistoricalAnalysisSport.MLB, snapshot)

        assertEquals(listOf(7, 8), out.getValue("months").jsonArray.map { it.jsonPrimitive.int })
        // Only one bound set → the other fills from the canonical span, not from null.
        assertEquals(listOf(3, 5), out.getValue("trip").jsonArray.map { it.jsonPrimitive.int })
        assertEquals("L", out.getValue("spHand").jsonPrimitive.content)
        assertEquals(listOf(1, 3), out.getValue("seriesGames").jsonArray.map { it.jsonPrimitive.int })
        assertEquals(listOf(-25.0, -3.0), out.getValue("winLossStreak").jsonArray.map { it.jsonPrimitive.double })
    }

    @Test
    fun footballOnlyDimsStayOutOfMlbPayloadAndViceVersa() {
        val mlb = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB).apply {
            above500 = true       // football-only tri-state
            rpg = listOf(3.0, 6.0) // MLB-only range
        }
        val out = NLFilterSnapshot.serialize(HistoricalAnalysisSport.MLB, mlb)
        assertFalse("above500" in out)
        assertTrue("rpg" in out)

        val nfl = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL).apply {
            above500 = true
            rpg = listOf(3.0, 6.0)
        }
        val nflOut = NLFilterSnapshot.serialize(HistoricalAnalysisSport.NFL, nfl)
        assertTrue("above500" in nflOut)
        assertFalse("rpg" in nflOut)
    }

    // MARK: - restore

    @Test
    fun restoreAppliesCanonicalPairsAndLeavesAbsentKeysAlone() {
        val target = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL).apply { referee = "Shawn Hochuli" }

        NLFilterSnapshot.restore(
            HistoricalAnalysisSport.NFL, target,
            web("""{"betType":"fg_ml","seasons":[2020,2024],"side":"home","spreadSize":[1.5,6.5],"lastMargin":[-14,14]}"""),
        )

        assertEquals("fg_ml", target.betType)
        assertEquals(2020, target.seasonMin)
        assertEquals(2024, target.seasonMax)
        assertEquals("home", target.side)
        assertEquals(1.5, target.spreadMin)
        assertEquals(6.5, target.spreadMax)
        assertEquals(listOf(-14, 14), target.lastMargin)
        // Untouched by the patch → must survive.
        assertEquals("Shawn Hochuli", target.referee)
    }

    @Test
    fun restoreReadsMlbDomeAsBooleanNotTheStringTrue() {
        val target = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB)

        NLFilterSnapshot.restore(HistoricalAnalysisSport.MLB, target, web("""{"dome":true}"""))
        assertEquals("dome", target.dome)

        NLFilterSnapshot.restore(HistoricalAnalysisSport.MLB, target, web("""{"dome":false}"""))
        assertEquals("outdoor", target.dome)
    }

    @Test
    fun restoreMapsCanonicalMlbFullSpansBackToUnsetSentinels() {
        val target = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB).apply {
            tripMin = 2; tripMax = 4
            restMin = 1; restMax = 3
            streakMin = "2"; streakMax = "6"
            pfRunsMin = 100.0; pfRunsMax = 110.0
        }

        // The server always echoes the FULL canonical snapshot, so every dim the
        // user did not set comes back at its full span. Those must clear, not stick.
        NLFilterSnapshot.restore(
            HistoricalAnalysisSport.MLB, target,
            web("""{"trip":[1,5],"restRange":[0,10],"winLossStreak":[-25,25],"pfRuns":[85,115]}"""),
        )

        assertNull(target.tripMin)
        assertNull(target.tripMax)
        assertNull(target.restMin)
        assertNull(target.restMax)
        assertEquals("", target.streakMin)
        assertEquals("", target.streakMax)
        assertNull(target.pfRunsMin)
        assertNull(target.pfRunsMax)
    }

    @Test
    fun restoreKeepsFullSpanWeatherFromExcludingDomeGames() {
        val target = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB)

        NLFilterSnapshot.restore(
            HistoricalAnalysisSport.MLB, target,
            web("""{"tempRange":[30,110],"windRange":[0,40]}"""),
        )

        // temp_min=30 would silently drop every dome game (NULL temps).
        assertEquals(-10, target.tempMin)
        assertEquals(110, target.tempMax)
        assertNull(target.windMin)
        assertEquals(60, target.windMax)
    }

    @Test
    fun restoreExpandsLegacySeriesGameRangeIntoTheMultiSelect() {
        val target = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB)
        NLFilterSnapshot.restore(HistoricalAnalysisSport.MLB, target, web("""{"seriesGame":[2,4]}"""))
        assertEquals(listOf(2, 3, 4), target.seriesGames)

        // The full span means "any series game" — it must not become a filter.
        val untouched = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB)
        NLFilterSnapshot.restore(HistoricalAnalysisSport.MLB, untouched, web("""{"seriesGame":[1,6]}"""))
        assertTrue(untouched.seriesGames.isEmpty())
    }

    @Test
    fun restoreKeepsMlbLegacyDayFieldInSyncWithTheMultiSelect() {
        val target = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB)
        NLFilterSnapshot.restore(HistoricalAnalysisSport.MLB, target, web("""{"daysOfWeek":["Fri","Sat"]}"""))
        assertEquals(listOf("Fri", "Sat"), target.daysOfWeek)
        assertEquals("Fri", target.dayOfWeek)
    }

    @Test
    fun restoreIgnoresMlbOnlyDimsOnFootballAndFootballOnlyDimsOnMlb() {
        val nfl = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL)
        NLFilterSnapshot.restore(HistoricalAnalysisSport.NFL, nfl, web("""{"spHand":"L","rpg":[3,6]}"""))
        assertEquals("any", nfl.spHand)
        assertEquals(HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL).rpg, nfl.rpg)

        val mlb = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB)
        NLFilterSnapshot.restore(HistoricalAnalysisSport.MLB, mlb, web("""{"above500":true,"h2hSpreadCmp":"lower"}"""))
        assertNull(mlb.above500)
        assertEquals("any", mlb.h2hSpreadCmp)
    }

    @Test
    fun serializeThenRestoreRoundTripsAFootballSearch() {
        val original = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL).apply {
            betType = "fg_ml"
            seasonMin = 2019
            weekMin = 10
            weekMax = 18
            side = "away"
            favDog = "underdog"
            lastResult = "lost"
            winPct = listOf(50.0, 100.0)
            daysOfWeek = listOf("Sun")
            division = true
        }

        val restored = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL)
        NLFilterSnapshot.restore(
            HistoricalAnalysisSport.NFL,
            restored,
            NLFilterSnapshot.serialize(HistoricalAnalysisSport.NFL, original),
        )

        assertEquals(original, restored)
    }

    @Test
    fun serializeEmitsNoEmptyArrayKeysForUnsetMultiSelects() {
        val out = NLFilterSnapshot.serialize(
            HistoricalAnalysisSport.MLB,
            HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB),
        )
        listOf("teams", "opponents", "daysOfWeek", "teamDivisions", "seriesGames", "spNames").forEach {
            assertFalse(it in out, "$it must be omitted when unset")
        }
        assertTrue(out.values.none { it is JsonArray && it.isEmpty() })
    }
}
