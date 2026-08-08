package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.HistoricalAnalysisUISnapshotSerializer
import com.wagerproof.core.models.MlbPitcherOption
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Saved systems are shared verbatim across web, iOS and Android, so the snapshot
 * JSON is a cross-platform wire format: an Android-only key name, or a dimension
 * Android drops on encode, corrupts a system the moment it's re-saved here.
 *
 * These tests pin the key set against the iOS `HistoricalAnalysisUISnapshot`
 * CodingKeys and prove every dimension the Wave-2 filter sheets expose survives
 * an encode → decode round trip.
 */
class HistoricalAnalysisSnapshotRoundTripTest {

    private val json = Json

    /** Verbatim from iOS HistoricalAnalysis.swift `enum CodingKeys`. */
    private val iosKeys = setOf(
        "betType", "seasonMin", "seasonMax", "weekMin", "weekMax",
        "side", "favDog", "rlSide", "spreadSide", "spreadMin", "spreadMax",
        "lineMin", "lineMax", "mlMin", "mlMax", "primetime",
        "h1SpreadSide", "h1SpreadMin", "h1SpreadMax", "h1MlMin", "h1MlMax", "h1TotalMin", "h1TotalMax",
        "ttLineMin", "ttLineMax", "oppSpreadSide", "oppSpreadMin", "oppSpreadMax",
        "oppMlMin", "oppMlMax", "oppTtLineMin", "oppTtLineMax",
        "tempMin", "tempMax", "windMax",
        "seasonType", "playoffRound", "division", "dome", "precip", "restBye", "coach", "referee",
        "gameType", "rankedMatchup", "conferenceGame", "neutralSite", "conference", "selectedConferences",
        "weather", "lastAts", "lastTotal", "lastRole", "lastOt", "lastBlowout",
        "monthMin", "monthMax", "teams", "opponents", "interleague",
        "dayOfWeek", "doubleheader",
        "seriesGames", "seriesGameMin", "seriesGameMax", "tripMin", "tripMax", "switchGame",
        "restMin", "restMax", "streakMin", "streakMax", "lastResult",
        "lastMarginMin", "lastMarginMax",
        "sp", "oppSp", "spHand", "oppSpHand",
        "windMin", "windDir", "pfRunsMin", "pfRunsMax",
        "f5TotalMin", "f5TotalMax", "timeMin", "timeMax",
        "spXfipMin", "spXfipMax", "oppSpXfipMin", "oppSpXfipMax",
        "bpIpMin", "bpIpMax", "bpXfipMin", "bpXfipMax",
        "spEraMin", "spEraMax", "oppSpEraMin", "oppSpEraMax",
        "rpg", "rapg", "runDiffPg",
        "rlCoverPct", "rlStreak", "h2hLastMargin",
        "oppRlCoverPct", "oppRpg", "oppRapg",
        "winPct", "winStreak", "lossStreak", "above500", "winPctGtOpp",
        "ppg", "paPg", "pointDiffPg", "minGames",
        "atsWinPct", "atsWinStreak", "avgCoverMargin",
        "overPct", "overStreak", "underStreak",
        "prevWins", "prevWinPct", "madePlayoffsPrev", "moreWinsThanOppPrev",
        "h2hLastWin", "h2hLastAts", "h2hLastOver", "h2hLastHome", "h2hLastFav",
        "h2hSameSeason", "h2hSpreadCmp",
        "oppWinPct", "oppOverPct", "oppWinStreak", "oppLossStreak",
        "oppPpg", "oppPaPg", "oppPrevWinPct",
        "oppLastResult", "oppLastAts", "oppLastTotal", "oppLastRole", "oppLastOt", "oppLastMargin",
        "lastMargin", "daysOfWeek", "teamDivisions",
    )

    @Test
    fun everyDimensionSurvivesAnEncodeDecodeRoundTrip() {
        val original = fullyPopulated()
        val encoded = json.encodeToString(HistoricalAnalysisUISnapshotSerializer, original)
        val restored = json.decodeFromString(HistoricalAnalysisUISnapshotSerializer, encoded)
        assertEquals(original, restored)
    }

    @Test
    fun encodedKeysMatchTheIosAndWebFieldNames() {
        val encoded = json.encodeToJsonElement(
            HistoricalAnalysisUISnapshotSerializer,
            fullyPopulated(),
        ) as JsonObject

        val androidOnly = encoded.keys - iosKeys
        assertTrue(androidOnly.isEmpty(), "Android emits keys iOS/web can't decode: $androidOnly")

        // The only iOS keys legitimately absent are the legacy series-game range,
        // which the multi-select replaced (and which decode migrates away anyway).
        val missing = iosKeys - encoded.keys
        assertEquals(setOf("seriesGameMin", "seriesGameMax"), missing)
    }

    @Test
    fun nullOptionalsStayOffThePayloadInsteadOfEncodingAsFalseOrZero() {
        val defaults = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB)
        val encoded = json.encodeToJsonElement(HistoricalAnalysisUISnapshotSerializer, defaults) as JsonObject

        listOf(
            "primetime", "division", "conferenceGame", "neutralSite", "lastOt", "interleague",
            "doubleheader", "switchGame", "tripMin", "tripMax", "restMin", "restMax",
            "windMin", "pfRunsMin", "pfRunsMax", "above500", "winPctGtOpp", "madePlayoffsPrev",
            "moreWinsThanOppPrev", "h2hLastHome", "h2hLastFav", "h2hSameSeason", "oppLastOt",
        ).forEach { key ->
            assertTrue(key !in encoded, "unset optional `$key` must not be emitted")
        }
    }

    @Test
    fun perSportDefaultsRoundTripUnchanged() {
        HistoricalAnalysisSport.entries.forEach { sport ->
            val defaults = HistoricalAnalysisUISnapshot.defaults(sport)
            val restored = json.decodeFromString(
                HistoricalAnalysisUISnapshotSerializer,
                json.encodeToString(HistoricalAnalysisUISnapshotSerializer, defaults),
            )
            assertEquals(defaults, restored, "defaults for $sport changed across a round trip")
        }
    }

    /**
     * Every field moved off its default — including the dimensions Wave 2 added
     * controls for (teams, cross-market lines, schedule, last game, H2H, team
     * form, opponent, pitching).
     */
    private fun fullyPopulated() = HistoricalAnalysisUISnapshot(
        betType = "rl",
        seasonMin = 2024, seasonMax = 2025, weekMin = 3, weekMax = 15,
        side = "home", favDog = "underdog", rlSide = "plus", spreadSide = "favorite",
        spreadMin = 2.5, spreadMax = 9.5,
        lineMin = 6.5, lineMax = 11.5,
        mlMin = "-200", mlMax = "-110",
        h1SpreadSide = "underdog", h1SpreadMin = 1.5, h1SpreadMax = 8.0,
        h1MlMin = "-150", h1MlMax = "+130",
        h1TotalMin = 18.5, h1TotalMax = 27.5,
        ttLineMin = 17.5, ttLineMax = 31.5,
        oppSpreadSide = "favorite", oppSpreadMin = 1.0, oppSpreadMax = 12.0,
        oppMlMin = "-300", oppMlMax = "+100",
        oppTtLineMin = 14.5, oppTtLineMax = 28.5,
        primetime = true, tempMin = 42, tempMax = 88, windMax = 18,
        seasonType = "postseason", playoffRound = "Divisional", division = true,
        dome = "outdoor", precip = "rain", restBye = "off_bye",
        coach = "Andy Reid", referee = "Carl Cheffers",
        gameType = "bowl", rankedMatchup = "both", conferenceGame = false, neutralSite = true,
        conference = "SEC", selectedConferences = listOf("Big Ten", "SEC"),
        weather = "snow",
        lastAts = "covered", lastTotal = "under", lastRole = "favorite",
        lastOt = true, lastBlowout = "win",
        winPct = listOf(40.0, 90.0), winStreak = listOf(1, 6), lossStreak = listOf(0, 3),
        above500 = true, winPctGtOpp = false,
        ppg = listOf(17.5, 33.0), paPg = listOf(12.0, 28.5), pointDiffPg = listOf(-6.5, 11.0),
        minGames = 12,
        atsWinPct = listOf(45.0, 80.0), atsWinStreak = listOf(2, 7),
        avgCoverMargin = listOf(-4.5, 9.5),
        overPct = listOf(35.0, 75.0), overStreak = listOf(1, 5), underStreak = listOf(2, 8),
        prevWins = listOf(6, 13), prevWinPct = listOf(30.0, 85.0),
        madePlayoffsPrev = true, moreWinsThanOppPrev = false,
        h2hLastWin = "yes", h2hLastAts = "no", h2hLastOver = "yes",
        h2hLastHome = true, h2hLastFav = false, h2hSameSeason = true, h2hSpreadCmp = "lower",
        oppWinPct = listOf(25.0, 70.0), oppOverPct = listOf(33.0, 66.0),
        oppWinStreak = listOf(1, 4), oppLossStreak = listOf(2, 9),
        oppPpg = listOf(14.0, 31.0), oppPaPg = listOf(15.5, 29.0),
        oppPrevWinPct = listOf(20.0, 80.0),
        oppLastResult = "lost", oppLastAts = "not", oppLastTotal = "over", oppLastRole = "underdog",
        oppLastOt = false, oppLastMargin = listOf(-12, 21),
        lastMargin = listOf(-7, 18),
        daysOfWeek = listOf("Sun", "Thu"), teamDivisions = listOf("AFC East", "NFC West"),
        monthMin = 5, monthMax = 9,
        teams = listOf("LAD", "NYY"), opponents = listOf("BOS"),
        interleague = true, dayOfWeek = "Sat", doubleheader = false,
        seriesGames = listOf(1, 3), seriesGameMin = null, seriesGameMax = null,
        tripMin = 2, tripMax = 4, switchGame = true,
        restMin = 1, restMax = 5,
        streakMin = "-4", streakMax = "6",
        lastResult = "won", lastMarginMin = "-3", lastMarginMax = "7",
        sp = listOf(MlbPitcherOption(id = 6, name = "José Berríos", hand = "R", team = "TOR")),
        oppSp = listOf(MlbPitcherOption(id = 12, name = "Blake Snell", hand = "L", team = "LAD")),
        spHand = "R", oppSpHand = "L",
        windMin = 6, windDir = "out",
        pfRunsMin = 96.0, pfRunsMax = 108.0,
        f5TotalMin = 3.5, f5TotalMax = 6.0,
        timeMin = "13:00", timeMax = "19:30",
        spXfipMin = 2.75, spXfipMax = 5.25,
        oppSpXfipMin = 3.0, oppSpXfipMax = 6.5,
        bpIpMin = 2.5, bpIpMax = 14.0,
        bpXfipMin = 3.25, bpXfipMax = 5.75,
        spEraMin = 1.5, spEraMax = 4.25,
        oppSpEraMin = 2.0, oppSpEraMax = 7.5,
        rpg = listOf(3.5, 7.5), rapg = listOf(2.5, 6.0), runDiffPg = listOf(-1.5, 2.5),
        rlCoverPct = listOf(38.0, 72.0), rlStreak = listOf(1, 9),
        h2hLastMargin = listOf(-8, 11),
        oppRlCoverPct = listOf(41.0, 69.0), oppRpg = listOf(3.0, 8.0), oppRapg = listOf(3.5, 7.0),
    )
}
