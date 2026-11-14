@file:OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)

package com.wagerproof.app.features.ncaab

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.serialization.FlexibleDoubleSerializer
import com.wagerproof.core.models.serialization.FlexibleIntSerializer
import com.wagerproof.core.models.serialization.WagerproofJson
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.nullable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.intOrNull
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * College game board joined on the CBBD game id. A model play is tier "bet"
 * only. A tracking flag, or a candidate definition, is a read and not a play.
 */
class NCAABGameDetailStore {
    var board by mutableStateOf<NCAABDetailBoard?>(null)
        private set
    var loading by mutableStateOf(true)
        private set
    var failed by mutableStateOf(false)
        private set

    val tournament: String? get() = board?.tournament
    val tv: String? get() = board?.tv

    suspend fun load(gameId: Int, gameDate: String, home: String, away: String) {
        loading = true
        failed = false
        val season = NCAABCopy.seasonEnd(gameDate)
        val cfb = SupabaseClients.cfb
        try {
            val header = attempt<List<NcaabHeaderRow>> {
                cfb.from("v_cbb_input_values").select(
                    columns = Columns.raw("game_id,home_team_id,away_team_id,neutral_site,tournament,broadcasts,game_type"),
                ) { filter { eq("game_id", gameId) }; limit(1) }.decodeList<NcaabHeaderRow>()
            }
            val models = attempt<List<NcaabModelRow>> {
                cfb.from("ncaab_model_preds").select(
                    columns = Columns.raw("game_id,market,model_home_margin,model_total,market_home_spread,market_total,disagreement,tier,bet_side"),
                ) { filter { eq("game_id", gameId) } }.decodeList<NcaabModelRow>()
            }
            val flags = attempt<List<NcaabFlagRow>> {
                cfb.from("ncaab_slate_flags").select(
                    columns = Columns.raw("game_id,signal_key,market,side,tier,trigger_text,record_text"),
                ) { filter { eq("game_id", gameId) } }.decodeList<NcaabFlagRow>()
            }
            val defs = attempt<List<NcaabDefRow>> {
                cfb.from("ncaab_signal_defs").select(
                    columns = Columns.raw("signal_key,display_name,one_liner,market,tier,record_text,season_record_text"),
                ).decodeList<NcaabDefRow>()
            }
            val homeId = header?.firstOrNull()?.homeTeamId
            val awayId = header?.firstOrNull()?.awayTeamId
            val teamIds = listOfNotNull(homeId, awayId)
            val trends = if (teamIds.isEmpty()) emptyList() else attempt<List<NcaabTrendRow>> {
                cfb.from("ncaab_team_trends").select(columns = Columns.raw(TREND_COLUMNS)) {
                    filter {
                        isIn("team_id", teamIds)
                        eq("season", season)
                    }
                }.decodeList<NcaabTrendRow>()
            }
            val ratings = if (teamIds.isEmpty()) emptyList() else attempt<List<NcaabRatingRow>> {
                cfb.from("ncaab_team_ratings").select(columns = Columns.raw(RATING_COLUMNS)) {
                    filter {
                        isIn("team_id", teamIds)
                        eq("season", season)
                    }
                }.decodeList<NcaabRatingRow>()
            }
            val fanmatch = attempt<List<NcaabFanmatchRow>> {
                cfb.from("ncaab_fanmatch_daily").select(
                    columns = Columns.raw("cbbd_game_id,home_pred,away_pred,home_win_prob,pred_tempo,thrill_score"),
                ) { filter { eq("cbbd_game_id", gameId) }; limit(1) }.decodeList<NcaabFanmatchRow>()
            }
            if (models == null && flags == null && trends == null) {
                failed = true
                return
            }
            board = NCAABCopy.board(
                header = header?.firstOrNull(),
                models = models.orEmpty(),
                flags = flags.orEmpty(),
                defs = defs.orEmpty(),
                trends = trends.orEmpty(),
                ratings = ratings.orEmpty(),
                fanmatch = fanmatch?.firstOrNull(),
                trendsLoaded = trends != null,
                homeId = homeId,
                awayId = awayId,
                home = home,
                away = away,
            )
        } catch (cancelled: CancellationException) {
            throw cancelled
        } finally {
            loading = false
        }
    }
}

private suspend fun <T> attempt(block: suspend () -> T): T? = try {
    block()
} catch (cancelled: CancellationException) {
    throw cancelled
} catch (_: Exception) {
    null
}

private const val TREND_COLUMNS =
    "team_id,team_name,games,su_w,su_l,su_record,ats_w,ats_l,ats_p,ats_pct,ou_o,ou_u,ou_p,over_pct,tt_o,tt_u,tt_over_pct,h1_ats_w,h1_ats_l,h1_ats_p,h1_ats_pct,h1_ou_o,h1_ou_u,h1_over_pct,last5_su,last5_ats,last5_ou,last5_tt,last5_h1_ats,last5_h1_ou,game_log,matchups"

private const val RATING_COLUMNS =
    "team_id,wins,losses,rating,rating_rank,adj_offense,adj_offense_rank,adj_defense,adj_defense_rank,tempo,tempo_rank,luck,sos"

data class NCAABDetailBoard(
    val tournament: String?,
    val tv: String?,
    val fullGame: List<NcaabModelLine>,
    val firstHalf: List<NcaabModelLine>,
    val signals: List<NcaabSignalLine>,
    val markets: List<NcaabMarketLine>,
    val ratings: List<NcaabRatingLine>,
    val awayRecord: String?,
    val homeRecord: String?,
    val thrillScore: String?,
    val thrillDetail: String,
    val earlySeason: Boolean,
    val catalog: List<NcaabCatalogLine>,
    val awayTrend: NcaabTrendRow? = null,
    val homeTrend: NcaabTrendRow? = null,
)

data class NcaabModelLine(
    val id: String,
    val label: String,
    val model: String,
    val posted: String,
    val disagreement: String,
    val play: Boolean,
    val betSide: String?,
    val modelMargin: Double? = null,
    val modelTotal: Double? = null,
    val marketSpread: Double? = null,
    val marketTotal: Double? = null,
    val disagreementPts: Double? = null,
)

data class NcaabSignalLine(
    val id: String,
    val name: String,
    val market: String = "",
    val side: String,
    val trigger: String,
    val record: String,
    val seasonRecord: String,
    val play: Boolean,
)

data class NcaabMarketLine(
    val id: String,
    val label: String,
    val awayRecord: String,
    val homeRecord: String,
    val awayChips: List<String>,
    val homeChips: List<String>,
    val series: String,
)

data class NcaabRatingLine(
    val label: String,
    val away: String,
    val home: String,
    /** "away", "home", or null when neither side is better. */
    val better: String?,
)

data class NcaabCatalogLine(
    val id: String,
    val name: String,
    val market: String,
    val oneLiner: String,
    val record: String,
    val seasonRecord: String,
    val active: Boolean,
)

private data class MarketSpec(
    val id: String,
    val label: String,
    val verb: String,
    val record: (NcaabTrendRow) -> String,
    val chips: (NcaabTrendRow) -> List<String>,
    val series: (NcaabSeries) -> NcaabRec?,
)

object NCAABCopy {
    const val thrillEmpty = "The watchability score posts the morning of the game."
    const val earlyNote =
        "Season records start after opening night. Last five and head-to-head still use prior seasons. In-season rating fields stay blank until games are played."

    private val markets = listOf(
        MarketSpec("spread", "Spread", "covered", { record(it.atsW, it.atsL, it.atsP, it.atsPct) }, { it.last5Ats }, { it.spread }),
        MarketSpec("total", "Total", "saw the over in", { record(it.ouO, it.ouU, it.ouP, it.overPct) }, { it.last5Ou }, { it.total }),
        MarketSpec("moneyline", "Moneyline", "won", { it.suRecord?.takeIf { s -> s.isNotBlank() } ?: record(it.suW, it.suL, 0, null) }, { it.last5Su }, { it.moneyline }),
        MarketSpec("team_total", "Team total", "went over its team total in", { record(it.ttO, it.ttU, 0, it.ttOverPct) }, { it.last5Tt }, { it.teamTotal }),
        MarketSpec("h1_spread", "1st half spread", "covered the first half in", { record(it.h1AtsW, it.h1AtsL, it.h1AtsP, it.h1AtsPct) }, { it.last5H1Ats }, { it.h1Spread }),
        MarketSpec("h1_total", "1st half total", "saw the first-half over in", { record(it.h1OuO, it.h1OuU, 0, it.h1OverPct) }, { it.last5H1Ou }, { it.h1Total }),
    )

    fun seasonEnd(iso: String): Int {
        val parts = iso.split("-")
        if (parts.size >= 2) {
            val year = parts[0].toIntOrNull()
            val month = parts[1].toIntOrNull()
            if (year != null && month != null) return if (month >= 6) year + 1 else year
        }
        val now = java.time.LocalDate.now()
        return if (now.monthValue >= 6) now.year + 1 else now.year
    }

    fun hideProvider(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        return raw
            .replace(Regex("\\bkenpom(?:'s|’s)?\\b", RegexOption.IGNORE_CASE), "")
            .replace(Regex("\\s{2,}"), " ")
            .replace(Regex("\\s+([,.;:])"), "$1")
            .replace(Regex("\\(\\s+"), "(")
            .trim()
    }

    /** STD is the feed's code for a standard game. It is not a label. */
    fun publicGameType(raw: String): String {
        val key = raw.trim().uppercase()
        if (key.isEmpty() || key == "STD" || key == "STANDARD" || key == "REG" || key.contains("REGULAR")) return ""
        if (key == "TRNMNT" || key == "TOURNAMENT") return "Tournament"
        return raw
    }

    fun points(value: Double): String {
        val rounded = (value * 10).roundToInt() / 10.0
        return if (rounded == rounded.roundToInt().toDouble()) rounded.roundToInt().toString() else String.format("%.1f", rounded)
    }

    private fun spread(value: Double): String {
        val text = points(value)
        return if (value > 0) "+$text" else text
    }

    private fun disagreement(market: String, value: Double?, home: String, away: String): String {
        if (value == null) return ""
        val magnitude = abs(value)
        if (magnitude < 0.05) return "In line with the posted number."
        val amount = points(magnitude)
        val unit = if (amount == "1") "point" else "points"
        if (market.contains("total")) {
            return "$amount $unit toward ${if (value > 0) "the over" else "the under"}."
        }
        return "$amount $unit toward ${if (value > 0) home else away}."
    }

    private fun record(w: Int?, l: Int?, p: Int?, pct: Double?): String {
        val ww = w ?: 0
        val ll = l ?: 0
        val pp = p ?: 0
        val base = if (pp > 0) "$ww-$ll-$pp" else "$ww-$ll"
        if (pct == null) return base
        val shown = if (pct <= 1) pct * 100 else pct
        return "$base ${shown.roundToInt()}%"
    }

    private fun modelLine(market: String, row: NcaabModelRow?, home: String, away: String): NcaabModelLine {
        val label = when (market) {
            "spread" -> "Spread"
            "total" -> "Total"
            "h1_spread" -> "1st half spread"
            "h1_total" -> "1st half total"
            else -> market
        }
        if (row == null) {
            return NcaabModelLine(market, label, "—", "—", "No line posted.", false, null)
        }
        val play = row.tier.equals("bet", ignoreCase = true)
        val isTotal = market.contains("total")
        val model = if (isTotal) row.modelTotal?.let(::points) ?: "—"
        else row.modelHomeMargin?.let { "$home ${spread(-it)}" } ?: "—"
        val posted = if (isTotal) row.marketTotal?.let(::points) ?: "—"
        else row.marketHomeSpread?.let { "$home ${spread(it)}" } ?: "—"
        val side = if (play) hideProvider(row.betSide) else ""
        return NcaabModelLine(
            market, label, model, posted,
            disagreement(market, row.disagreement, home, away),
            play,
            side.ifBlank { null },
            modelMargin = row.modelHomeMargin,
            modelTotal = row.modelTotal,
            marketSpread = row.marketHomeSpread,
            marketTotal = row.marketTotal,
            disagreementPts = row.disagreement,
        )
    }

    private fun seriesText(
        homeTrend: NcaabTrendRow?,
        awayTrend: NcaabTrendRow?,
        homeId: Int?,
        awayId: Int?,
        homeName: String,
        awayName: String,
        market: MarketSpec,
    ): String {
        val homeRec = awayId?.let { homeTrend?.matchups?.get(it.toString()) }?.let(market.series)
        val awayRec = homeId?.let { awayTrend?.matchups?.get(it.toString()) }?.let(market.series)
        val fromHome = homeRec?.takeIf { (it.n ?: 0) > 0 }
        if (fromHome != null) return "$homeName ${market.verb} ${fromHome.h ?: 0} of ${fromHome.n}."
        val fromAway = awayRec?.takeIf { (it.n ?: 0) > 0 }
        if (fromAway != null) return "$awayName ${market.verb} ${fromAway.h ?: 0} of ${fromAway.n}."
        return "No meetings in the window on file."
    }

    private fun better(away: Double?, home: Double?, lower: Boolean): String? {
        if (away == null || home == null || away == home) return null
        return if (lower) { if (away < home) "away" else "home" } else { if (away > home) "away" else "home" }
    }

    private fun shown(value: Double?, rank: Boolean = false, digits: Int = 1): String {
        if (value == null) return "—"
        if (rank) return "#${value.roundToInt()}"
        return when (digits) {
            3 -> String.format("%.3f", value)
            2 -> String.format("%.2f", value)
            else -> points(value)
        }
    }

    fun board(
        header: NcaabHeaderRow?,
        models: List<NcaabModelRow>,
        flags: List<NcaabFlagRow>,
        defs: List<NcaabDefRow>,
        trends: List<NcaabTrendRow>,
        ratings: List<NcaabRatingRow>,
        fanmatch: NcaabFanmatchRow?,
        trendsLoaded: Boolean,
        homeId: Int?,
        awayId: Int?,
        home: String,
        away: String,
    ): NCAABDetailBoard {
        val byMarket = models.associateBy { it.market.orEmpty() }
        val defByKey = defs.associateBy { it.signalKey.orEmpty() }
        val signals = flags.map { flag ->
            val def = defByKey[flag.signalKey]
            val name = hideProvider(def?.displayName).ifBlank { flag.signalKey.orEmpty() }
            val fromDef = hideProvider(def?.recordText)
            NcaabSignalLine(
                id = "${flag.signalKey}-${flag.side}",
                name = name,
                market = flag.market?.takeIf { it.isNotBlank() } ?: def?.market.orEmpty(),
                side = hideProvider(flag.side),
                trigger = hideProvider(flag.triggerText),
                record = fromDef.ifBlank { hideProvider(flag.recordText) },
                seasonRecord = hideProvider(def?.seasonRecordText),
                play = def?.tier.equals("active", ignoreCase = true) && !flag.tier.equals("tracking", ignoreCase = true),
            )
        }.sortedWith(compareByDescending<NcaabSignalLine> { it.play }.thenBy { it.name })

        val homeTrend = trends.firstOrNull { it.teamId == homeId }
        val awayTrend = trends.firstOrNull { it.teamId == awayId }
        val marketLines = markets.map { market ->
            NcaabMarketLine(
                id = market.id,
                label = market.label,
                awayRecord = awayTrend?.let(market.record) ?: "No games yet",
                homeRecord = homeTrend?.let(market.record) ?: "No games yet",
                awayChips = awayTrend?.let(market.chips).orEmpty(),
                homeChips = homeTrend?.let(market.chips).orEmpty(),
                series = seriesText(homeTrend, awayTrend, homeId, awayId, home, away, market),
            )
        }

        val homeRating = ratings.firstOrNull { it.teamId == homeId }
        val awayRating = ratings.firstOrNull { it.teamId == awayId }
        data class Spec(val label: String, val away: Double?, val home: Double?, val lower: Boolean, val rank: Boolean, val digits: Int)
        val specs = listOf(
            Spec("Rating", awayRating?.rating, homeRating?.rating, false, false, 1),
            Spec("Rating rank", awayRating?.ratingRank, homeRating?.ratingRank, true, true, 0),
            Spec("Adj. offense", awayRating?.adjOffense, homeRating?.adjOffense, false, false, 1),
            Spec("Offense rank", awayRating?.adjOffenseRank, homeRating?.adjOffenseRank, true, true, 0),
            Spec("Adj. defense", awayRating?.adjDefense, homeRating?.adjDefense, true, false, 1),
            Spec("Defense rank", awayRating?.adjDefenseRank, homeRating?.adjDefenseRank, true, true, 0),
            Spec("Tempo", awayRating?.tempo, homeRating?.tempo, false, false, 1),
            Spec("Tempo rank", awayRating?.tempoRank, homeRating?.tempoRank, false, true, 0),
            Spec("Luck", awayRating?.luck, homeRating?.luck, false, false, 3),
            Spec("Strength of schedule", awayRating?.sos, homeRating?.sos, false, false, 2),
        )
        val neutral = setOf("Tempo", "Tempo rank", "Luck", "Strength of schedule")
        val ratingLines = specs.map { spec ->
            NcaabRatingLine(
                label = spec.label,
                away = shown(spec.away, spec.rank, spec.digits),
                home = shown(spec.home, spec.rank, spec.digits),
                better = if (spec.label in neutral) null else better(spec.away, spec.home, spec.lower),
            )
        }

        val parts = mutableListOf<String>()
        val homePred = fanmatch?.homePred
        val awayPred = fanmatch?.awayPred
        if (homePred != null && awayPred != null) parts += "Projected ${points(awayPred)}–${points(homePred)}"
        fanmatch?.predTempo?.let { parts += "Tempo ${points(it)}" }
        fanmatch?.homeWinProb?.let { win ->
            val pct = (if (win <= 1) win * 100 else win).roundToInt()
            parts += "$home $pct%"
        }

        val tournament = hideProvider(header?.tournament)
        val gameType = hideProvider(header?.gameType)
        val named = tournament.ifBlank { publicGameType(gameType) }
        val tv = hideProvider(header?.broadcasts)
        val catalog = defs.map { def ->
            NcaabCatalogLine(
                id = def.signalKey.orEmpty(),
                name = hideProvider(def.displayName).ifBlank { def.signalKey.orEmpty() },
                market = hideProvider(def.market).replace('_', ' '),
                oneLiner = hideProvider(def.oneLiner),
                record = hideProvider(def.recordText),
                seasonRecord = hideProvider(def.seasonRecordText),
                active = def.tier.equals("active", ignoreCase = true),
            )
        }.filter { it.id.isNotBlank() }
            .sortedWith(compareByDescending<NcaabCatalogLine> { it.active }.thenBy { it.name })

        return NCAABDetailBoard(
            tournament = named.ifBlank { null },
            tv = tv.ifBlank { null },
            fullGame = listOf(modelLine("spread", byMarket["spread"], home, away), modelLine("total", byMarket["total"], home, away)),
            firstHalf = listOf(modelLine("h1_spread", byMarket["h1_spread"], home, away), modelLine("h1_total", byMarket["h1_total"], home, away)),
            signals = signals,
            markets = marketLines,
            ratings = ratingLines,
            awayRecord = awayRating?.let { "${it.wins ?: 0}-${it.losses ?: 0}" },
            homeRecord = homeRating?.let { "${it.wins ?: 0}-${it.losses ?: 0}" },
            thrillScore = fanmatch?.thrillScore?.roundToInt()?.toString(),
            thrillDetail = parts.joinToString("  ·  "),
            earlySeason = trendsLoaded && ((awayTrend?.games ?: 0) == 0 || (homeTrend?.games ?: 0) == 0),
            catalog = catalog,
            awayTrend = awayTrend,
            homeTrend = homeTrend,
        )
    }
}

object FlexText : KSerializer<String?> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("FlexText", PrimitiveKind.STRING).nullable

    override fun deserialize(decoder: Decoder): String? {
        val input = decoder as? JsonDecoder ?: return runCatching { decoder.decodeString() }.getOrNull()
        val el = runCatching { input.decodeJsonElement() }.getOrNull() ?: return null
        if (el is JsonNull) return null
        if (el is JsonPrimitive) return el.content.trim().ifBlank { null }
        if (el is JsonArray) {
            return el.mapNotNull { (it as? JsonPrimitive)?.content?.trim() }
                .filter { it.isNotEmpty() }
                .joinToString(", ")
                .ifBlank { null }
        }
        return null
    }

    override fun serialize(encoder: Encoder, value: String?) {
        if (value == null) encoder.encodeNull() else encoder.encodeString(value)
    }
}

object NcaabLetters : KSerializer<List<String>> {
    private val delegate = ListSerializer(kotlinx.serialization.serializer<String>())
    override val descriptor: SerialDescriptor = delegate.descriptor

    override fun deserialize(decoder: Decoder): List<String> {
        val input = decoder as? JsonDecoder ?: return emptyList()
        val el = runCatching { input.decodeJsonElement() }.getOrNull() ?: return emptyList()
        if (el is JsonNull) return emptyList()
        if (el is JsonArray) {
            return el.mapNotNull { (it as? JsonPrimitive)?.content?.trim() }.filter { it.isNotEmpty() }
        }
        val raw = (el as? JsonPrimitive)?.content?.trim().orEmpty()
        if (raw.startsWith("[")) {
            runCatching { WagerproofJson.decodeFromString(delegate, raw) }.getOrNull()?.let { return it.filter { item -> item.isNotBlank() } }
        }
        return raw.replace("{", "").replace("}", "").split(",").map { it.trim() }.filter { it.isNotEmpty() }
    }

    override fun serialize(encoder: Encoder, value: List<String>) = delegate.serialize(encoder, value)
}

@Serializable
data class NcaabHeaderRow(
    @SerialName("home_team_id") @Serializable(with = FlexibleIntSerializer::class) val homeTeamId: Int? = null,
    @SerialName("away_team_id") @Serializable(with = FlexibleIntSerializer::class) val awayTeamId: Int? = null,
    val tournament: String? = null,
    @Serializable(with = FlexText::class) val broadcasts: String? = null,
    @SerialName("game_type") val gameType: String? = null,
)

@Serializable
data class NcaabModelRow(
    val market: String? = null,
    @SerialName("model_home_margin") @Serializable(with = FlexibleDoubleSerializer::class) val modelHomeMargin: Double? = null,
    @SerialName("model_total") @Serializable(with = FlexibleDoubleSerializer::class) val modelTotal: Double? = null,
    @SerialName("market_home_spread") @Serializable(with = FlexibleDoubleSerializer::class) val marketHomeSpread: Double? = null,
    @SerialName("market_total") @Serializable(with = FlexibleDoubleSerializer::class) val marketTotal: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class) val disagreement: Double? = null,
    val tier: String? = null,
    @SerialName("bet_side") val betSide: String? = null,
)

@Serializable
data class NcaabFlagRow(
    @SerialName("signal_key") val signalKey: String? = null,
    val market: String? = null,
    val side: String? = null,
    val tier: String? = null,
    @SerialName("trigger_text") val triggerText: String? = null,
    @SerialName("record_text") val recordText: String? = null,
)

@Serializable
data class NcaabDefRow(
    @SerialName("signal_key") val signalKey: String? = null,
    @SerialName("display_name") val displayName: String? = null,
    @SerialName("one_liner") val oneLiner: String? = null,
    val market: String? = null,
    val tier: String? = null,
    @SerialName("record_text") val recordText: String? = null,
    @SerialName("season_record_text") val seasonRecordText: String? = null,
)

@Serializable
data class NcaabRec(
    @Serializable(with = FlexibleIntSerializer::class) val h: Int? = null,
    @Serializable(with = FlexibleIntSerializer::class) val n: Int? = null,
)

@Serializable
data class NcaabSeries(
    val spread: NcaabRec? = null,
    val moneyline: NcaabRec? = null,
    val total: NcaabRec? = null,
    @SerialName("team_total") val teamTotal: NcaabRec? = null,
    @SerialName("h1_spread") val h1Spread: NcaabRec? = null,
    @SerialName("h1_total") val h1Total: NcaabRec? = null,
)

@Serializable
data class NcaabTrendRow(
    @SerialName("team_id") @Serializable(with = FlexibleIntSerializer::class) val teamId: Int? = null,
    @Serializable(with = FlexibleIntSerializer::class) val games: Int? = null,
    @SerialName("su_w") @Serializable(with = FlexibleIntSerializer::class) val suW: Int? = null,
    @SerialName("su_l") @Serializable(with = FlexibleIntSerializer::class) val suL: Int? = null,
    @SerialName("su_record") val suRecord: String? = null,
    @SerialName("ats_w") @Serializable(with = FlexibleIntSerializer::class) val atsW: Int? = null,
    @SerialName("ats_l") @Serializable(with = FlexibleIntSerializer::class) val atsL: Int? = null,
    @SerialName("ats_p") @Serializable(with = FlexibleIntSerializer::class) val atsP: Int? = null,
    @SerialName("ats_pct") @Serializable(with = FlexibleDoubleSerializer::class) val atsPct: Double? = null,
    @SerialName("ou_o") @Serializable(with = FlexibleIntSerializer::class) val ouO: Int? = null,
    @SerialName("ou_u") @Serializable(with = FlexibleIntSerializer::class) val ouU: Int? = null,
    @SerialName("ou_p") @Serializable(with = FlexibleIntSerializer::class) val ouP: Int? = null,
    @SerialName("over_pct") @Serializable(with = FlexibleDoubleSerializer::class) val overPct: Double? = null,
    @SerialName("tt_o") @Serializable(with = FlexibleIntSerializer::class) val ttO: Int? = null,
    @SerialName("tt_u") @Serializable(with = FlexibleIntSerializer::class) val ttU: Int? = null,
    @SerialName("tt_over_pct") @Serializable(with = FlexibleDoubleSerializer::class) val ttOverPct: Double? = null,
    @SerialName("h1_ats_w") @Serializable(with = FlexibleIntSerializer::class) val h1AtsW: Int? = null,
    @SerialName("h1_ats_l") @Serializable(with = FlexibleIntSerializer::class) val h1AtsL: Int? = null,
    @SerialName("h1_ats_p") @Serializable(with = FlexibleIntSerializer::class) val h1AtsP: Int? = null,
    @SerialName("h1_ats_pct") @Serializable(with = FlexibleDoubleSerializer::class) val h1AtsPct: Double? = null,
    @SerialName("h1_ou_o") @Serializable(with = FlexibleIntSerializer::class) val h1OuO: Int? = null,
    @SerialName("h1_ou_u") @Serializable(with = FlexibleIntSerializer::class) val h1OuU: Int? = null,
    @SerialName("h1_over_pct") @Serializable(with = FlexibleDoubleSerializer::class) val h1OverPct: Double? = null,
    @SerialName("last5_su") @Serializable(with = NcaabLetters::class) val last5Su: List<String> = emptyList(),
    @SerialName("last5_ats") @Serializable(with = NcaabLetters::class) val last5Ats: List<String> = emptyList(),
    @SerialName("last5_ou") @Serializable(with = NcaabLetters::class) val last5Ou: List<String> = emptyList(),
    @SerialName("last5_tt") @Serializable(with = NcaabLetters::class) val last5Tt: List<String> = emptyList(),
    @SerialName("last5_h1_ats") @Serializable(with = NcaabLetters::class) val last5H1Ats: List<String> = emptyList(),
    @SerialName("last5_h1_ou") @Serializable(with = NcaabLetters::class) val last5H1Ou: List<String> = emptyList(),
    @SerialName("game_log") @Serializable(with = NcaabGameLogs::class) val gameLog: List<NcaabGameLog> = emptyList(),
    val matchups: Map<String, NcaabSeries>? = null,
)

@Serializable
data class NcaabGameLog(
    val date: String? = null,
    val opp: String? = null,
    @SerialName("is_home") @Serializable(with = FlexBool::class) val isHome: Boolean? = null,
    @SerialName("pts_for") @Serializable(with = FlexibleIntSerializer::class) val ptsFor: Int? = null,
    @SerialName("pts_against") @Serializable(with = FlexibleIntSerializer::class) val ptsAgainst: Int? = null,
    @SerialName("team_pts") @Serializable(with = FlexibleIntSerializer::class) val teamPts: Int? = null,
    @SerialName("opp_pts") @Serializable(with = FlexibleIntSerializer::class) val oppPts: Int? = null,
    val su: String? = null,
    val ats: String? = null,
    val ou: String? = null,
    val tt: String? = null,
    @SerialName("h1_ats") val h1Ats: String? = null,
    @SerialName("h1_ou") val h1Ou: String? = null,
) {
    val scoreFor: Int? get() = ptsFor ?: teamPts
    val scoreAgainst: Int? get() = ptsAgainst ?: oppPts
    fun result(marketId: String): String? = when (marketId) {
        "spread" -> ats
        "total" -> ou
        "moneyline" -> su
        "team_total" -> tt
        "h1_spread" -> h1Ats
        "h1_total" -> h1Ou
        else -> null
    }
}

object NcaabGameLogs : KSerializer<List<NcaabGameLog>> {
    private val delegate = ListSerializer(NcaabGameLog.serializer())
    override val descriptor: SerialDescriptor = delegate.descriptor

    override fun deserialize(decoder: Decoder): List<NcaabGameLog> {
        val input = decoder as? JsonDecoder ?: return emptyList()
        val el = runCatching { input.decodeJsonElement() }.getOrNull()
        if (el !is JsonArray) return emptyList()
        return el.mapNotNull { item ->
            runCatching { WagerproofJson.decodeFromJsonElement(NcaabGameLog.serializer(), item) }.getOrNull()
        }
    }

    override fun serialize(encoder: Encoder, value: List<NcaabGameLog>) = delegate.serialize(encoder, value)
}

object FlexBool : KSerializer<Boolean?> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("FlexBool", PrimitiveKind.BOOLEAN).nullable

    override fun deserialize(decoder: Decoder): Boolean? {
        val input = decoder as? JsonDecoder ?: return null
        val el = runCatching { input.decodeJsonElement() }.getOrNull() ?: return null
        if (el is JsonNull) return null
        val primitive = el as? JsonPrimitive ?: return null
        primitive.booleanOrNull?.let { return it }
        primitive.intOrNull?.let { return it != 0 }
        return when (primitive.content.trim().lowercase()) {
            "true", "t", "yes", "1" -> true
            "false", "f", "no", "0" -> false
            else -> null
        }
    }

    override fun serialize(encoder: Encoder, value: Boolean?) {
        if (value == null) encoder.encodeNull() else encoder.encodeBoolean(value)
    }
}

@Serializable
data class NcaabRatingRow(
    @SerialName("team_id") @Serializable(with = FlexibleIntSerializer::class) val teamId: Int? = null,
    @Serializable(with = FlexibleIntSerializer::class) val wins: Int? = null,
    @Serializable(with = FlexibleIntSerializer::class) val losses: Int? = null,
    @Serializable(with = FlexibleDoubleSerializer::class) val rating: Double? = null,
    @SerialName("rating_rank") @Serializable(with = FlexibleDoubleSerializer::class) val ratingRank: Double? = null,
    @SerialName("adj_offense") @Serializable(with = FlexibleDoubleSerializer::class) val adjOffense: Double? = null,
    @SerialName("adj_offense_rank") @Serializable(with = FlexibleDoubleSerializer::class) val adjOffenseRank: Double? = null,
    @SerialName("adj_defense") @Serializable(with = FlexibleDoubleSerializer::class) val adjDefense: Double? = null,
    @SerialName("adj_defense_rank") @Serializable(with = FlexibleDoubleSerializer::class) val adjDefenseRank: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class) val tempo: Double? = null,
    @SerialName("tempo_rank") @Serializable(with = FlexibleDoubleSerializer::class) val tempoRank: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class) val luck: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class) val sos: Double? = null,
)

@Serializable
data class NcaabFanmatchRow(
    @SerialName("home_pred") @Serializable(with = FlexibleDoubleSerializer::class) val homePred: Double? = null,
    @SerialName("away_pred") @Serializable(with = FlexibleDoubleSerializer::class) val awayPred: Double? = null,
    @SerialName("home_win_prob") @Serializable(with = FlexibleDoubleSerializer::class) val homeWinProb: Double? = null,
    @SerialName("pred_tempo") @Serializable(with = FlexibleDoubleSerializer::class) val predTempo: Double? = null,
    @SerialName("thrill_score") @Serializable(with = FlexibleDoubleSerializer::class) val thrillScore: Double? = null,
)
