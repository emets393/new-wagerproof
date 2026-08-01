package com.wagerproof.app.features.outliers

import com.wagerproof.core.models.OutliersTrendsBettingLine
import com.wagerproof.core.models.OutliersTrendsCard
import com.wagerproof.core.models.OutliersTrendsCardRow
import com.wagerproof.core.models.OutliersTrendsMarketSection
import com.wagerproof.core.models.OutliersTrendsSubjectKind
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * AND-022 — the Outliers Trends Quick Filter searches the WHOLE card, not just
 * its subject, so a user can reach a card by the book, the price, the coverage
 * note or the trend sentence. Port of iOS `OutliersTrendsView.cardMatches`
 * (:423-443); these cases pin each field group it reads.
 */
class OutliersTrendsQuickFilterTest {

    private fun card(
        id: String = "c1",
        subjectName: String = "Kansas City Chiefs",
        subjectDetail: String? = null,
        teamAbbr: String? = "KC",
        matchupLabel: String = "KC @ BUF",
        betTypeLabel: String = "Spread",
        lineContext: String? = null,
        rows: List<OutliersTrendsCardRow> = emptyList(),
        bettingLines: List<OutliersTrendsBettingLine> = emptyList(),
    ) = OutliersTrendsCard(
        id = id,
        gameId = "g1",
        matchupLabel = matchupLabel,
        subjectKind = OutliersTrendsSubjectKind.TEAM,
        subjectName = subjectName,
        subjectDetail = subjectDetail,
        teamAbbr = teamAbbr,
        playerId = null,
        marketKey = "spread",
        betTypeLabel = betTypeLabel,
        trendValue = 0.78,
        trendSampleN = 18,
        lineContext = lineContext,
        bettingLines = bettingLines,
        rows = rows,
    )

    private fun row(text: String, coverageNote: String? = null) =
        OutliersTrendsCardRow(id = "r-$text", text = text, coverageNote = coverageNote, dominantPct = 0.78, sampleN = 18)

    private fun line(
        label: String = "Spread",
        lineText: String = "-3.5",
        oddsText: String? = null,
        bookName: String? = null,
        teamAbbr: String? = null,
    ) = OutliersTrendsBettingLine(
        id = "l-$label-$lineText",
        label = label,
        lineText = lineText,
        oddsText = oddsText,
        bookName = bookName,
        teamAbbr = teamAbbr,
    )

    @Test
    fun `matches on subject, abbreviation and matchup`() {
        val c = card()
        assertTrue(cardMatches(c, "chiefs"))
        assertTrue(cardMatches(c, "kc"))
        assertTrue(cardMatches(c, "buf"))
        assertFalse(cardMatches(c, "dolphins"))
    }

    @Test
    fun `matches on trend row text and coverage note`() {
        val c = card(
            subjectName = "Shawn Hochuli",
            teamAbbr = null,
            rows = listOf(row("Overs are 14-4 with this referee", coverageNote = "Since 2023")),
        )
        assertTrue(cardMatches(c, "hochuli"))
        assertTrue(cardMatches(c, "referee"))
        assertTrue(cardMatches(c, "since 2023"))
    }

    @Test
    fun `matches on betting line book, odds and label`() {
        val c = card(
            bettingLines = listOf(line(label = "Total", lineText = "o47.5", oddsText = "+105", bookName = "DraftKings", teamAbbr = "BUF")),
        )
        assertTrue(cardMatches(c, "draftkings"))
        assertTrue(cardMatches(c, "+105"))
        assertTrue(cardMatches(c, "o47.5"))
    }

    @Test
    fun `matches on subject detail and line context`() {
        val c = card(subjectDetail = "Head Coach", lineContext = "as a road favorite")
        assertTrue(cardMatches(c, "head coach"))
        assertTrue(cardMatches(c, "road favorite"))
    }

    @Test
    fun `empty query returns sections untouched by identity`() {
        val sections = listOf(OutliersTrendsMarketSection("spread", "Spread", listOf(card())))
        assertTrue(filteredSections(sections, "") === sections)
    }

    @Test
    fun `sections that lose every card are dropped, survivors keep their order`() {
        val sections = listOf(
            OutliersTrendsMarketSection(
                "spread",
                "Spread",
                listOf(card(id = "a", subjectName = "Chiefs"), card(id = "b", subjectName = "Bills", teamAbbr = "BUF")),
            ),
            OutliersTrendsMarketSection(
                "total",
                "Total",
                listOf(card(id = "c", subjectName = "Dolphins", teamAbbr = "MIA", matchupLabel = "MIA @ NYJ")),
            ),
        )

        val filtered = filteredSections(sections, "bills")

        assertEquals(1, filtered.size)
        assertEquals("spread", filtered[0].marketKey)
        assertEquals(listOf("b"), filtered[0].cards.map { it.id })
        // Source sections must not be mutated — the store shares them with Search.
        assertEquals(2, sections[0].cards.size)
    }

    @Test
    fun `no match anywhere yields no sections`() {
        val sections = listOf(OutliersTrendsMarketSection("spread", "Spread", listOf(card())))
        assertTrue(filteredSections(sections, "zzzz").isEmpty())
    }
}
