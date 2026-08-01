package com.wagerproof.core.services

import com.wagerproof.core.models.OutliersTrendsBettingLine
import com.wagerproof.core.models.OutliersTrendsCard
import com.wagerproof.core.models.OutliersTrendsCardRow
import com.wagerproof.core.models.OutliersTrendsMarketSection
import com.wagerproof.core.models.OutliersTrendsSport
import com.wagerproof.core.models.OutliersTrendsSubjectKind
import com.wagerproof.core.models.OutliersWidgetMarketData
import com.wagerproof.core.models.OutliersWidgetItem
import com.wagerproof.core.models.ParlayGodCategory
import com.wagerproof.core.models.ParlayLeg
import com.wagerproof.core.models.ParlaySport
import com.wagerproof.core.models.ParlayTicket
import com.wagerproof.core.models.WidgetDataPayload
import com.wagerproof.core.models.serialization.WagerproofJson
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertSame

class OutliersWidgetMarketTest {

    @Test
    fun trendProjectionUsesStrongestLiveRowAndMatchingTeamLine() {
        val card = OutliersTrendsCard(
            id = "trend-1",
            gameId = "game-1",
            matchupLabel = "BOS @ NYY",
            subjectKind = OutliersTrendsSubjectKind.TEAM,
            subjectName = "Yankees",
            subjectDetail = null,
            teamAbbr = "NYY",
            playerId = null,
            marketKey = "ml",
            betTypeLabel = "Moneyline",
            trendValue = 0.75,
            trendSampleN = 8,
            lineContext = "NYY moneyline",
            bettingLines = listOf(
                OutliersTrendsBettingLine(
                    id = "bos",
                    label = "Boston",
                    lineText = "BOS ML",
                    oddsText = "+120",
                    teamAbbr = "BOS",
                ),
                OutliersTrendsBettingLine(
                    id = "nyy",
                    label = "New York",
                    lineText = "NYY ML",
                    oddsText = "-135",
                    teamAbbr = "NYY",
                ),
            ),
            rows = listOf(
                OutliersTrendsCardRow("recent", "Won 6 of 8", null, 0.75, 8),
                OutliersTrendsCardRow("home", "Won 9 of 10", null, 0.90, 10),
                OutliersTrendsCardRow("thin", "Won 2 of 2", null, 1.0, 0),
            ),
        )

        val projected = assertNotNull(
            OutliersWidgetService.trendWidgetItem(card, OutliersTrendsSport.MLB),
        )

        assertEquals("mlb-trend-1", projected.id)
        assertEquals("NYY ML", projected.selection)
        assertEquals("-135", projected.oddsText)
        assertEquals(9, projected.hitCount)
        assertEquals(10, projected.sampleSize)
        assertEquals("9/10", projected.fractionText)
        assertEquals(2, projected.additionalTrendCount)
    }

    @Test
    fun canonicalMarketIdentityNormalizesFirstFiveTotal() {
        val identity = OutliersWidgetService.canonicalMarketIdentity(
            OutliersTrendsMarketSection(
                marketKey = "f5_ou",
                title = "First Five Over/Under",
                cards = emptyList(),
            ),
        )

        assertEquals("first-five-total", identity.id)
        assertEquals("1st 5 Total", identity.title)
        assertEquals("5.circle.fill", identity.symbol)
    }

    @Test
    fun parlayProjectionUsesDeepestLegAndTicketPrice() {
        val shallow = leg(subject = "Yankees", n = 5, game = "1")
        val deepest = leg(subject = "Dodgers", n = 12, game = "2")
        val ticket = ParlayTicket(
            id = "recent-form-1",
            sports = listOf(ParlaySport.MLB),
            category = ParlayGodCategory.RECENT_FORM,
            legs = listOf(shallow, deepest),
            combinedOddsText = "+264",
        )

        val projected = assertNotNull(OutliersWidgetService.parlayWidgetItem(ticket))

        assertEquals("parlay-recent-form-1", projected.id)
        assertEquals("100% Recent Form", projected.subject)
        assertEquals("Dodgers LAD ML", projected.selection)
        assertEquals("+264", projected.oddsText)
        assertEquals(12, projected.hitCount)
        assertEquals(12, projected.sampleSize)
        assertEquals(1, projected.additionalTrendCount)
    }

    @Test
    fun freeEntitlementRemovesParlayGodFromWidgetMarkets() {
        val parlay = market("parlay-god")
        val moneyline = market("moneyline")

        val visible = OutliersWidgetService.sanitizeMarketsForEntitlement(
            listOf(parlay, moneyline),
            isPro = false,
        )

        assertEquals(listOf(moneyline), visible)
    }

    @Test
    fun proEntitlementPreservesAllWidgetMarkets() {
        val markets = listOf(market("parlay-god"), market("moneyline"))

        val visible = OutliersWidgetService.sanitizeMarketsForEntitlement(markets, isPro = true)

        assertSame(markets, visible)
    }

    @Test
    fun legacyWidgetPayloadDefaultsMarketSchemaToVersionZero() {
        val payload = WagerproofJson.decodeFromString(
            WidgetDataPayload.serializer(),
            "{}",
        )

        assertEquals(0, payload.outlierMarketsVersion)
        assertEquals(emptyList(), payload.outlierMarkets)
    }

    @Test
    fun partialMarketRefreshRetainsRowsFromFailedSports() {
        val cached = listOf(
            market(
                "moneyline",
                item("old-nfl", "nfl"),
                item("old-mlb", "mlb"),
            ),
        )
        val fresh = listOf(market("moneyline", item("new-nfl", "nfl")))

        val merged = OutliersWidgetService.mergeMarketsWithLastKnownGood(
            fresh = fresh,
            cached = cached,
            succeededSports = setOf("nfl"),
            parlaySourcesComplete = false,
            isPro = true,
        )

        assertEquals(setOf("new-nfl", "old-mlb"), merged.single().items.map { it.id }.toSet())
    }

    @Test
    fun successfulEmptySportRemovesItsStaleRows() {
        val cached = listOf(market("moneyline", item("old-nfl", "nfl")))

        val merged = OutliersWidgetService.mergeMarketsWithLastKnownGood(
            fresh = emptyList(),
            cached = cached,
            succeededSports = setOf("nfl"),
            parlaySourcesComplete = false,
            isPro = true,
        )

        assertEquals(emptyList(), merged)
    }

    private fun market(id: String, vararg items: OutliersWidgetItem) = OutliersWidgetMarketData(
        id = id,
        title = id,
        symbolName = "bolt.fill",
        items = items.toList(),
        totalCount = items.size,
    )

    private fun item(id: String, sport: String) = OutliersWidgetItem(
        id = id,
        sport = sport,
        matchup = "A @ B",
        subject = id,
        selection = "Moneyline",
        hitCount = 5,
        sampleSize = 5,
    )

    private fun leg(subject: String, n: Int, game: String) = ParlayLeg(
        kind = ParlayLeg.Kind.TEAM,
        sport = ParlaySport.MLB,
        category = ParlayGodCategory.RECENT_FORM,
        gameKey = game,
        matchupLabel = "BOS @ NYY",
        gameTimeEt = null,
        subject = subject,
        teamAbbr = "LAD",
        playerId = null,
        betText = "LAD ML",
        odds = -110,
        evidence = "Won $n straight",
        streakN = n,
        marketKey = "ml",
        backedTeamAbbr = "LAD",
    )
}
