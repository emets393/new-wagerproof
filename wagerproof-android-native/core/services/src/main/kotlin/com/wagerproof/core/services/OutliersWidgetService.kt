package com.wagerproof.core.services

import com.wagerproof.core.models.MLBTrendsSlateBundle
import com.wagerproof.core.models.NFLTrendsSlateBundle
import com.wagerproof.core.models.OutlierAlertForWidget
import com.wagerproof.core.models.OutlierFadeAlert
import com.wagerproof.core.models.OutlierValueAlert
import com.wagerproof.core.models.OutliersTrendsCard
import com.wagerproof.core.models.OutliersTrendsGameMarket
import com.wagerproof.core.models.OutliersTrendsMarketSection
import com.wagerproof.core.models.OutliersTrendsMatchupFilter
import com.wagerproof.core.models.OutliersTrendsPropMarket
import com.wagerproof.core.models.OutliersTrendsSport
import com.wagerproof.core.models.OutliersTrendsSubject
import com.wagerproof.core.models.OutliersWidgetItem
import com.wagerproof.core.models.OutliersWidgetMarketData
import com.wagerproof.core.models.ParlayTicket
import com.wagerproof.core.models.serialization.WagerproofJson
import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.shared.AppGroupKey
import com.wagerproof.core.shared.WidgetPayloadStore
import kotlin.math.roundToInt
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.encodeToJsonElement

/**
 * Composes the "Top Outliers" home-screen widget payload (iOS
 * OutliersWidgetService.swift). Reuses OutliersService's full fetch pipeline
 * (fetchWeekGames -> value/fade alerts) — several Supabase queries per sport
 * plus prediction hydration, far too expensive to run from a widget refresh.
 * Only the main app calls [sync]; the widget just reads the cached payload.
 *
 * The App Group blob is ONE JSON document shared across domains (agent picks,
 * outliers, entitlement mirror...), so this replaces only `topOutliers`, the
 * versioned `outlierMarkets` slice, and `lastUpdated`, preserving every other key. That merge belongs to
 * [WidgetPayloadStore], whose mutex is what keeps the concurrent TopAgents sync
 * from clobbering this slice.
 */
object OutliersWidgetService {
    private const val MAX_WIDGET_ALERTS = 6
    private const val MAX_WIDGET_ITEMS_PER_MARKET = 12
    internal const val OUTLIER_MARKETS_SCHEMA_VERSION = 1

    data class Snapshot(
        /** null = source failed, empty = source succeeded with no current rows. */
        val alerts: List<OutlierAlertForWidget>?,
        /** null = every market source failed, empty = successful empty slate. */
        val markets: List<OutliersWidgetMarketData>?,
    )

    private data class TrendMarketSource(
        val sport: OutliersTrendsSport,
        val sections: List<OutliersTrendsMarketSection>,
        val mlbBundle: MLBTrendsSlateBundle? = null,
        val nflBundle: NFLTrendsSlateBundle? = null,
        val succeeded: Boolean,
    )

    private data class MarketAccumulator(
        val id: String,
        val title: String,
        val symbolName: String,
        val items: MutableList<OutliersWidgetItem>,
        var totalCount: Int,
    )

    suspend fun sync(): List<OutlierAlertForWidget> {
        val includeParlayGod = hasProEntitlementSnapshot()
        val snapshot = fetchSnapshot(includeParlayGod)
        val cached = WidgetPayloadStore.read()
        val cachedContainsLockedMarket = cached.outlierMarkets.any { it.id == "parlay-god" }
        if (snapshot.alerts == null && snapshot.markets == null &&
            (includeParlayGod || !cachedContainsLockedMarket)
        ) {
            return cached.topOutliers
        }

        // Independent writes are deliberate: one source failing must preserve
        // the last-known-good slice from that source. WidgetPayloadStore's mutex
        // makes both raw-JSON merges safe alongside the Agent Monitor writer.
        snapshot.alerts?.let { alerts ->
            runCatchingCancellable {
                WidgetPayloadStore.updateSlice(
                    key = "topOutliers",
                    value = WagerproofJson.encodeToJsonElement(alerts),
                )
            }
        }
        val marketUpdate = when {
            snapshot.markets != null -> sanitizeMarketsForEntitlement(
                snapshot.markets,
                includeParlayGod,
            )
            !includeParlayGod && cachedContainsLockedMarket ->
                sanitizeMarketsForEntitlement(cached.outlierMarkets, isPro = false)
            else -> null
        }
        marketUpdate?.let { markets ->
            runCatchingCancellable {
                WidgetPayloadStore.updateSlices(
                    mapOf(
                        "outlierMarkets" to WagerproofJson.encodeToJsonElement(markets),
                        "outlierMarketsVersion" to JsonPrimitive(OUTLIER_MARKETS_SCHEMA_VERSION),
                    ),
                )
            }
        }

        return snapshot.alerts ?: cached.topOutliers
    }

    suspend fun fetchSnapshot(includeParlayGod: Boolean = hasProEntitlementSnapshot()): Snapshot =
        coroutineScope {
            val alerts = async { optionalLegacyAlerts() }
            val markets = async { optionalMarketGroups(includeParlayGod) }
            Snapshot(alerts = alerts.await(), markets = markets.await())
        }

    private suspend fun optionalLegacyAlerts(): List<OutlierAlertForWidget>? =
        runCatchingCancellable { fetchLegacyAlerts() }.getOrNull()

    private suspend fun fetchLegacyAlerts(): List<OutlierAlertForWidget> {
        val games = OutliersService.shared.fetchWeekGames()
        if (games.isEmpty()) return emptyList()

        val (values, fades) = coroutineScope {
            val valuesTask = async { OutliersService.shared.fetchValueAlerts(games) }
            val fadesTask = async { OutliersService.shared.fetchFadeAlerts(games) }
            valuesTask.await() to fadesTask.await()
        }

        return (values.map(::toWidget) + fades.map(::toWidget))
            .sortedByDescending { it.confidence }
            .take(MAX_WIDGET_ALERTS)
    }

    private suspend fun optionalMarketGroups(includeParlayGod: Boolean): List<OutliersWidgetMarketData>? =
        runCatchingCancellable { fetchMarketGroups(includeParlayGod) }.getOrNull()

    private suspend fun fetchMarketGroups(
        includeParlayGod: Boolean,
    ): List<OutliersWidgetMarketData> = coroutineScope {
        val mlbTask = async { fetchMLBSource() }
        val nflTask = async { fetchNFLSource() }
        val ncaafTask = async { fetchPrecomputedSource(OutliersTrendsSport.NCAAF) }
        val mlb = mlbTask.await()
        val nfl = nflTask.await()
        val ncaaf = ncaafTask.await()

        check(mlb.succeeded || nfl.succeeded || ncaaf.succeeded) {
            "No Outliers widget market source was available"
        }

        val groups = LinkedHashMap<String, MarketAccumulator>()

        // Parlay God mirrors the first in-app Outliers header, so it is the
        // default widget market whenever qualifying perfect-streak tickets exist.
        if (includeParlayGod) {
            val nflOdds = nfl.nflBundle?.games
                ?.map { it.id }
                ?.takeIf { it.isNotEmpty() }
                ?.let { ids ->
                    runCatchingCancellable {
                        ParlayGodNflOddsService.shared.fetchSlateOdds(ids)
                    }.getOrNull()
                }
                .orEmpty()
            val teamLegs = mlb.mlbBundle?.let(ParlayGodEngine::teamLegs).orEmpty() +
                nfl.nflBundle?.let { ParlayGodEngine.nflTeamLegs(it, nflOdds) }.orEmpty()
            val tickets = ParlayGodEngine.slateTickets(teamLegs)
            val parlayItems = tickets.mapNotNull(::parlayWidgetItem)
            if (parlayItems.isNotEmpty()) {
                groups["parlay-god"] = MarketAccumulator(
                    id = "parlay-god",
                    title = "Parlay God",
                    symbolName = "bolt.fill",
                    items = parlayItems.toMutableList(),
                    totalCount = tickets.size,
                )
            }
        }

        for (source in listOf(nfl, ncaaf, mlb).filter { it.succeeded }) {
            for (section in source.sections) {
                val identity = canonicalMarketIdentity(section)
                val mapped = section.cards.mapNotNull { trendWidgetItem(it, source.sport) }
                if (mapped.isEmpty()) continue
                val group = groups.getOrPut(identity.id) {
                    MarketAccumulator(
                        id = identity.id,
                        title = identity.title,
                        symbolName = identity.symbol,
                        items = mutableListOf(),
                        totalCount = 0,
                    )
                }
                group.items += mapped
                group.totalCount += mapped.size
            }
        }

        val freshMarkets = groups.values.map { group ->
            OutliersWidgetMarketData(
                id = group.id,
                title = group.title,
                symbolName = group.symbolName,
                items = group.items.sortedWith(::compareStrongest).take(MAX_WIDGET_ITEMS_PER_MARKET),
                totalCount = group.totalCount,
            )
        }
        val succeededSports = listOf(mlb, nfl, ncaaf)
            .filter { it.succeeded }
            .mapTo(mutableSetOf()) { it.sport.raw }
        mergeMarketsWithLastKnownGood(
            fresh = freshMarkets,
            cached = WidgetPayloadStore.read().outlierMarkets,
            succeededSports = succeededSports,
            parlaySourcesComplete = mlb.succeeded && nfl.succeeded,
            isPro = includeParlayGod,
        )
    }

    private suspend fun fetchMLBSource(): TrendMarketSource =
        runCatchingCancellable {
            val bundle = OutliersTrendsService.shared.fetchMLBBundle()
            val cards = MLBTrendsEngine.buildCards(
                bundle = bundle,
                gameFilter = OutliersTrendsMatchupFilter.AllGames,
                subject = OutliersTrendsSubject.TEAMS,
                gameMarket = OutliersTrendsGameMarket.ALL,
                visibleLimit = Int.MAX_VALUE,
            )
            TrendMarketSource(
                sport = OutliersTrendsSport.MLB,
                sections = OutliersTrendsMarketSection.sections(cards, Int.MAX_VALUE),
                mlbBundle = bundle,
                succeeded = true,
            )
        }.getOrElse {
            TrendMarketSource(OutliersTrendsSport.MLB, emptyList(), succeeded = false)
        }

    private suspend fun fetchNFLSource(): TrendMarketSource =
        runCatchingCancellable {
            val bundle = OutliersTrendsService.shared.fetchNFLBundle()
            val first = bundle.games.firstOrNull()
                ?: return@runCatchingCancellable TrendMarketSource(
                    sport = OutliersTrendsSport.NFL,
                    sections = emptyList(),
                    nflBundle = bundle,
                    succeeded = true,
                )
            val precomputed = OutliersTrendsService.shared.fetchPrecomputedCards(
                sport = OutliersTrendsSport.NFL,
                season = first.season,
                week = first.week,
            )
            val cards = NFLTrendsEngine.filterPrecomputedCards(
                cards = precomputed,
                games = bundle.games,
                sport = OutliersTrendsSport.NFL,
                gameFilter = OutliersTrendsMatchupFilter.AllGames,
                subject = OutliersTrendsSubject.ALL,
                gameMarket = OutliersTrendsGameMarket.ALL,
                propMarket = OutliersTrendsPropMarket.ALL,
                includeAllPlayers = true,
                visibleLimit = Int.MAX_VALUE,
            )
            TrendMarketSource(
                sport = OutliersTrendsSport.NFL,
                sections = OutliersTrendsMarketSection.sections(cards, Int.MAX_VALUE),
                nflBundle = bundle,
                succeeded = true,
            )
        }.getOrElse {
            TrendMarketSource(OutliersTrendsSport.NFL, emptyList(), succeeded = false)
        }

    private suspend fun fetchPrecomputedSource(sport: OutliersTrendsSport): TrendMarketSource =
        runCatchingCancellable {
            val games = OutliersTrendsService.shared.fetchSlateGames(sport)
            val first = games.firstOrNull()
                ?: return@runCatchingCancellable TrendMarketSource(sport, emptyList(), succeeded = true)
            val precomputed = OutliersTrendsService.shared.fetchPrecomputedCards(
                sport = sport,
                season = first.season,
                week = first.week,
            )
            val cards = NFLTrendsEngine.filterPrecomputedCards(
                cards = precomputed,
                games = games,
                sport = sport,
                gameFilter = OutliersTrendsMatchupFilter.AllGames,
                subject = OutliersTrendsSubject.ALL,
                gameMarket = OutliersTrendsGameMarket.ALL,
                propMarket = OutliersTrendsPropMarket.ALL,
                includeAllPlayers = true,
                visibleLimit = Int.MAX_VALUE,
            )
            TrendMarketSource(
                sport = sport,
                sections = OutliersTrendsMarketSection.sections(cards, Int.MAX_VALUE),
                succeeded = true,
            )
        }.getOrElse { TrendMarketSource(sport, emptyList(), succeeded = false) }

    internal fun sanitizeMarketsForEntitlement(
        markets: List<OutliersWidgetMarketData>,
        isPro: Boolean,
    ): List<OutliersWidgetMarketData> =
        if (isPro) markets else markets.filterNot { it.id == "parlay-god" }

    /**
     * Replace rows only for sports whose source completed. Rows from a failed
     * sport retain their last-known-good projection, while a successful empty
     * response remains authoritative and removes that sport's stale rows.
     * Parlay tickets can span MLB and NFL, so the whole group is replaced only
     * when both source bundles completed.
     */
    internal fun mergeMarketsWithLastKnownGood(
        fresh: List<OutliersWidgetMarketData>,
        cached: List<OutliersWidgetMarketData>,
        succeededSports: Set<String>,
        parlaySourcesComplete: Boolean,
        isPro: Boolean,
    ): List<OutliersWidgetMarketData> {
        val freshById = fresh.associateBy { it.id }
        val cachedById = cached.associateBy { it.id }
        val marketIds = LinkedHashSet<String>().apply {
            addAll(fresh.map { it.id })
            addAll(cached.map { it.id })
        }
        return marketIds.mapNotNull { marketId ->
            if (marketId == "parlay-god") {
                if (!isPro) return@mapNotNull null
                return@mapNotNull if (parlaySourcesComplete) {
                    freshById[marketId]
                } else {
                    cachedById[marketId] ?: freshById[marketId]
                }
            }

            val freshMarket = freshById[marketId]
            val cachedMarket = cachedById[marketId]
            val retained = cachedMarket?.items.orEmpty()
                .filterNot { it.sport in succeededSports }
            val combined = (freshMarket?.items.orEmpty() + retained)
                .distinctBy { it.id }
                .sortedWith(::compareStrongest)
                .take(MAX_WIDGET_ITEMS_PER_MARKET)
            if (combined.isEmpty()) return@mapNotNull null
            val template = freshMarket ?: cachedMarket ?: return@mapNotNull null
            template.copy(
                items = combined,
                totalCount = maxOf(freshMarket?.totalCount ?: 0, combined.size),
            )
        }
    }

    private fun hasProEntitlementSnapshot(): Boolean =
        runCatching {
            AppGroup.prefs.getBoolean(AppGroupKey.PRO_ENTITLEMENT_GRANTED, false)
        }.getOrDefault(false)

    internal fun trendWidgetItem(
        card: OutliersTrendsCard,
        sport: OutliersTrendsSport,
    ): OutliersWidgetItem? {
        val strongest = card.rows.asSequence()
            .filter { it.sampleN > 0 }
            .maxWithOrNull(
            compareBy<com.wagerproof.core.models.OutliersTrendsCardRow> { it.dominantPct }
                .thenBy { it.sampleN },
        ) ?: return null
        val line = card.teamAbbr?.let { team ->
            card.bettingLines.firstOrNull { it.teamAbbr == team }
        } ?: card.bettingLines.firstOrNull()
        val selection = line?.lineText ?: card.lineContext ?: card.betTypeLabel
        val hits = (strongest.dominantPct * strongest.sampleN)
            .roundToInt()
            .coerceIn(0, strongest.sampleN)
        return OutliersWidgetItem(
            id = "${sport.raw}-${card.id}",
            sport = sport.raw,
            matchup = card.matchupLabel,
            subject = card.subjectName,
            selection = selection,
            oddsText = line?.oddsText,
            hitCount = hits,
            sampleSize = strongest.sampleN,
            additionalTrendCount = (card.rows.size - 1).coerceAtLeast(0),
        )
    }

    internal fun parlayWidgetItem(ticket: ParlayTicket): OutliersWidgetItem? {
        val topLeg = ticket.legs.maxByOrNull { it.streakN } ?: return null
        return OutliersWidgetItem(
            id = "parlay-${ticket.id}",
            sport = ticket.sports.firstOrNull()?.raw ?: topLeg.sport.raw,
            matchup = topLeg.matchupLabel,
            subject = ticket.category.title,
            selection = "${topLeg.subject} ${topLeg.betText}",
            oddsText = ticket.combinedOddsText,
            hitCount = topLeg.streakN,
            sampleSize = topLeg.streakN,
            additionalTrendCount = (ticket.legs.size - 1).coerceAtLeast(0),
        )
    }

    private fun compareStrongest(left: OutliersWidgetItem, right: OutliersWidgetItem): Int {
        val leftRate = left.hitCount.toDouble() / left.sampleSize.coerceAtLeast(1)
        val rightRate = right.hitCount.toDouble() / right.sampleSize.coerceAtLeast(1)
        return when {
            leftRate != rightRate -> rightRate.compareTo(leftRate)
            left.sampleSize != right.sampleSize -> right.sampleSize.compareTo(left.sampleSize)
            else -> left.subject.lowercase().compareTo(right.subject.lowercase())
        }
    }

    internal data class MarketIdentity(val id: String, val title: String, val symbol: String)

    internal fun canonicalMarketIdentity(section: OutliersTrendsMarketSection): MarketIdentity =
        when (section.marketKey) {
            "moneyline", "ml" -> MarketIdentity("moneyline", "Moneyline", "dollarsign.circle.fill")
            "spread" -> MarketIdentity("spread", "Spread", "arrow.left.and.right")
            "rl" -> MarketIdentity("run-line", "Run Line", "arrow.left.and.right")
            "total", "ou" -> MarketIdentity("total", "Total", "sum")
            "team_total" -> MarketIdentity("team-total", "Team Total", "person.2.fill")
            "h1_spread" -> MarketIdentity("first-half-spread", "1H Spread", "clock.fill")
            "h1_total" -> MarketIdentity("first-half-total", "1H Total", "clock.badge.checkmark")
            "f5_ml" -> MarketIdentity("first-five-moneyline", "1st 5 Moneyline", "5.circle.fill")
            "f5_rl" -> MarketIdentity("first-five-run-line", "1st 5 Run Line", "5.circle.fill")
            "f5_ou" -> MarketIdentity("first-five-total", "1st 5 Total", "5.circle.fill")
            "player_pass_yds" -> MarketIdentity("passing-yards", "Passing Yards", "paperplane.fill")
            "player_pass_tds" -> MarketIdentity("passing-tds", "Passing TDs", "trophy.fill")
            "player_pass_attempts" -> MarketIdentity("pass-attempts", "Pass Attempts", "paperplane")
            "player_pass_completions" -> MarketIdentity("completions", "Completions", "checkmark.circle.fill")
            "player_rush_yds" -> MarketIdentity("rushing-yards", "Rushing Yards", "figure.run")
            "player_rush_attempts" -> MarketIdentity("rush-attempts", "Rush Attempts", "figure.run")
            "player_reception_yds" -> MarketIdentity("receiving-yards", "Receiving Yards", "arrow.down.right.circle.fill")
            "player_receptions" -> MarketIdentity("receptions", "Receptions", "hand.raised.fill")
            "player_anytime_td" -> MarketIdentity("anytime-td", "Anytime TD", "figure.run.circle.fill")
            else -> MarketIdentity(slug(section.marketKey), section.title, "chart.line.uptrend.xyaxis")
        }

    private fun slug(value: String): String = value
        .lowercase()
        .replace(Regex("[^a-z0-9]+"), "-")
        .trim('-')

    // -- Mapping ---------------------------------------------------------------

    private fun toWidget(alert: OutlierValueAlert) = OutlierAlertForWidget(
        id = "value-${alert.id}",
        kind = OutlierAlertForWidget.Kind.VALUE,
        sport = alert.sport.raw,
        awayTeam = alert.awayTeam,
        homeTeam = alert.homeTeam,
        marketType = alert.marketType.raw,
        side = alert.side,
        confidence = alert.percentage.roundToInt(),
        gameTime = alert.game.gameTime,
    )

    private fun toWidget(alert: OutlierFadeAlert) = OutlierAlertForWidget(
        id = "fade-${alert.id}",
        kind = OutlierAlertForWidget.Kind.FADE,
        sport = alert.sport.raw,
        awayTeam = alert.awayTeam,
        homeTeam = alert.homeTeam,
        marketType = alert.pickType.raw,
        // Raw model-favored side — the widget view computes the "fade to the
        // opposite side" recommendation from this + kind.
        side = alert.predictedTeam,
        confidence = alert.confidence,
        gameTime = alert.game.gameTime,
    )

}
