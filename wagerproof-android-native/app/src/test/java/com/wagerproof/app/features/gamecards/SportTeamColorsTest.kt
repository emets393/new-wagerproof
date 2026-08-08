package com.wagerproof.app.features.gamecards

import androidx.compose.ui.graphics.Color
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

/**
 * The NBA table is keyed on full team names because that is what the adapters
 * pass. The regression these guard: "charlotte hornets" used to miss a
 * nickname-only table and hit "nets" in the substring scan, painting Charlotte
 * in Brooklyn's black/white on the card avatar, Polymarket sparkline and aura.
 */
class SportTeamColorsTest {

    private fun rgb(value: Long) = Color(0xFF000000 or value)

    /** All 30 franchises, as the adapters spell them, → iOS's primary color. */
    private val fullNames = mapOf(
        "Atlanta Hawks" to 0xE03A3EL,
        "Boston Celtics" to 0x007A33L,
        "Brooklyn Nets" to 0x1A1A1AL,
        "Charlotte Hornets" to 0x1D1160L,
        "Chicago Bulls" to 0xCE1141L,
        "Cleveland Cavaliers" to 0x860038L,
        "Dallas Mavericks" to 0x00538CL,
        "Denver Nuggets" to 0x0E2240L,
        "Detroit Pistons" to 0xC8102EL,
        "Golden State Warriors" to 0x1D428AL,
        "Houston Rockets" to 0xCE1141L,
        "Indiana Pacers" to 0x002D62L,
        "LA Clippers" to 0xC8102EL,
        "Los Angeles Clippers" to 0xC8102EL,
        "Los Angeles Lakers" to 0x552583L,
        "Memphis Grizzlies" to 0x5D76A9L,
        "Miami Heat" to 0x98002EL,
        "Milwaukee Bucks" to 0x00471BL,
        "Minnesota Timberwolves" to 0x0C2340L,
        "New Orleans Pelicans" to 0x0C2340L,
        "New York Knicks" to 0x006BB6L,
        "Oklahoma City Thunder" to 0x007AC1L,
        "Orlando Magic" to 0x0077C0L,
        "Philadelphia 76ers" to 0x006BB6L,
        "Phoenix Suns" to 0x1D1160L,
        "Portland Trail Blazers" to 0xE03A3EL,
        "Sacramento Kings" to 0x5A2D81L,
        "San Antonio Spurs" to 0x8A8D8FL,
        "Toronto Raptors" to 0xCE1141L,
        "Utah Jazz" to 0x002B5CL,
        "Washington Wizards" to 0x002B5CL,
    )

    @Test
    fun everyFullTeamNameResolvesToItsOwnBrandColor() {
        fullNames.forEach { (name, primary) ->
            assertEquals(rgb(primary), NBATeams.colorPair(name).primary, "primary for $name")
        }
    }

    @Test
    fun charlotteIsNotPaintedWithBrooklynsColors() {
        val hornets = NBATeams.colorPair("Charlotte Hornets")
        val nets = NBATeams.colorPair("Brooklyn Nets")
        assertNotEquals(nets.primary, hornets.primary)
        assertEquals(rgb(0x1D1160), hornets.primary)
        assertEquals(rgb(0x00788C), hornets.secondary)
    }

    @Test
    fun nicknameOnlyFeedsStillResolve() {
        assertEquals(rgb(0x552583), NBATeams.colorPair("Lakers").primary)
        assertEquals(rgb(0x1D1160), NBATeams.colorPair("Hornets").primary)
        assertEquals(rgb(0xE03A3E), NBATeams.colorPair("Trail Blazers").primary)
    }

    @Test
    fun substringScanPrefersTheLongestMatchingNickname() {
        // "hornets" contains "nets"; the longer key has to win regardless of
        // map iteration order.
        assertEquals(rgb(0x1D1160), NBATeams.colorPair("CHA Hornets 2026").primary)
    }
}
