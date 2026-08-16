package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull

// MARK: - `nfl_prop_player_pages` row (CFB/research Supabase)
//
// Port of the web contract in `src/features/propBreakdown/types.ts`, mirroring
// iOS `NFLPropPlayerPage.swift`. The jsonb columns (`markets`, `projection`,
// `scheme`, `scheme_game_splits`) are generator-produced and have drifted
// before, so every jsonb decodes as `JsonElement` and maps defensively — one
// bad blob nulls only its widget, never the row.

internal val JsonElement?.asObj: JsonObject? get() = this as? JsonObject
internal val JsonElement?.asArr: JsonArray? get() = this as? JsonArray
internal val JsonElement?.asString: String?
    get() = (this as? JsonPrimitive)?.takeIf { it.isString }?.content
internal val JsonElement?.asDouble: Double? get() = (this as? JsonPrimitive)?.doubleOrNull
internal val JsonElement?.asInt: Int?
    get() = (this as? JsonPrimitive)?.intOrNull ?: asDouble?.toInt()
internal val JsonElement?.asBool: Boolean? get() = (this as? JsonPrimitive)?.booleanOrNull

/**
 * One entry of the page's `markets` array — the posted (or pending) book
 * market for this player. ATD is posted with a null line (yes/no market).
 */
data class NFLPropPageMarket(
    val key: String,
    val label: String,
    val line: Double?,
    val overPrice: Int?,
    val underPrice: Int?,
    /** "pending" | "posted" — raw string so new statuses degrade. */
    val status: String,
) {
    val isPosted: Boolean get() = status == "posted"
}

/**
 * Per-market WagerProof projection. Points are stat totals; rates are score
 * probabilities (anytime TD only).
 */
sealed interface NFLPropProjection {
    val status: String
    val source: String

    data class Point(val value: Double, override val status: String, override val source: String) : NFLPropProjection
    data class Rate(val scoreRate: Double, override val status: String, override val source: String) : NFLPropProjection

    /**
     * The generator writes status "live" + source "model" for model output and
     * status "preview" + source "2025 form/games" for the fallback; the web
     * type contract says status "model". Accept either signal.
     */
    val isModel: Boolean get() = status == "model" || source == "model"
}

/** One defense-usage dim: share of snaps + league percentile. */
data class NFLPropDefenseDim(val rate: Double, val pctile: Double)

data class NFLPropDefense(
    /** Served identity string, e.g. "zone-heavy, two-high". */
    val identity: String?,
    /** man / two_high / pressure / blitz / heavy_box / light_box. */
    val dims: Map<String, NFLPropDefenseDim>,
)

/**
 * One flexible split shape covering the web's three layers (receiving YPT,
 * QB EPA/dropback, RB box) — all fields optional, read by compare mode.
 */
data class NFLPropSchemeSplit(
    val ypt: Double? = null,
    val epaDb: Double? = null,
    val ypa: Double? = null,
    val compPct: Double? = null,
    val sackRate: Double? = null,
    val ypc: Double? = null,
    val epaRush: Double? = null,
    val tdRate: Double? = null,
    val targets: Int? = null,
    val dropbacks: Int? = null,
    val carries: Int? = null,
    val deltaYpt: Double? = null,
    val deltaEpaDb: Double? = null,
    val deltaEpaRush: Double? = null,
    val pctile: Double? = null,
    /** "ok" | "thin". */
    val sample: String? = null,
    val insufficient: Boolean = false,
)

/** `{h, n, pct}` hit-rate record (look hit-rates + H2H matchup markets). */
data class NFLPropHitRate(val h: Int, val n: Int, val pct: Double?)

data class NFLPropScheme(
    val opponent: String?,
    /** "receiving" | "qb" | "rb". */
    val kind: String?,
    val defense: NFLPropDefense?,
    val playerOverall: NFLPropSchemeSplit?,
    /** Keyed by look: zone / man / two_high / one_high / pressure / blitz. */
    val playerSplits: Map<String, NFLPropSchemeSplit>,
    val lookFocus: List<String>,
    val rushOverall: NFLPropSchemeSplit?,
    /** Keyed by box look: heavy_box / neutral / light_box. */
    val rushSplits: Map<String, NFLPropSchemeSplit>,
    val rushLookFocus: List<String>,
    /** bucket → marketKey → record. */
    val lookHitRates: Map<String, Map<String, NFLPropHitRate>>,
)

/**
 * One entry of `scheme_game_splits` — per-game averages, either overall or
 * against one defense-type bucket.
 */
data class NFLPropGameSplitEntry(
    val n: Int?,
    val insufficient: Boolean,
    /** receptions / rec_yds / targets / rush_att / rush_yds / pass_att / pass_yds. */
    val stats: Map<String, Double>,
    val delta: Map<String, Double>,
)

data class NFLPropGameSplits(
    val overall: NFLPropGameSplitEntry?,
    val splits: Map<String, NFLPropGameSplitEntry>,
    val applicable: List<String>,
    val window: String?,
)

/** Client model — one row of `nfl_prop_player_pages`, defensively mapped. */
data class NFLPropPlayerPage(
    val playerId: String,
    val season: Int,
    val week: Int,
    val playerName: String,
    val position: String? = null,
    val team: String? = null,
    val opponent: String? = null,
    val isHome: Boolean? = null,
    val gameLabel: String? = null,
    val kickoff: String? = null,
    val headshotUrl: String? = null,
    val rookie: Boolean = false,
    val markets: List<NFLPropPageMarket> = emptyList(),
    val projection: Map<String, NFLPropProjection> = emptyMap(),
    val scheme: NFLPropScheme? = null,
    val schemeGameSplits: NFLPropGameSplits? = null,
) {
    companion object {
        // MARK: JSONB mapping (exposed for decode-fixture tests)

        /** Non-array `markets` (the historical dict drift) degrades to empty. */
        fun mapMarkets(json: JsonElement?): List<NFLPropPageMarket> {
            val items = json.asArr ?: return emptyList()
            return items.mapNotNull { item ->
                val o = item.asObj ?: return@mapNotNull null
                val key = o["key"].asString ?: return@mapNotNull null
                NFLPropPageMarket(
                    key = key,
                    label = o["label"].asString ?: NFLPlayerProps.marketLabel(key),
                    line = o["line"].asDouble,
                    overPrice = o["over_price"].asInt,
                    underPrice = o["under_price"].asInt,
                    status = o["status"].asString ?: "pending",
                )
            }
        }

        fun mapProjection(json: JsonElement?): Map<String, NFLPropProjection> {
            val byMarket = json.asObj ?: return emptyMap()
            val out = mutableMapOf<String, NFLPropProjection>()
            for ((market, raw) in byMarket) {
                val o = raw.asObj ?: continue
                val status = o["status"].asString ?: ""
                val source = o["source"].asString ?: ""
                when (o["kind"].asString) {
                    "point" -> {
                        val value = o["value"].asDouble ?: continue
                        out[market] = NFLPropProjection.Point(value, status, source)
                    }
                    "rate" -> {
                        val rate = o["score_rate"].asDouble ?: continue
                        out[market] = NFLPropProjection.Rate(rate, status, source)
                    }
                }
            }
            return out
        }

        fun mapScheme(json: JsonElement?): NFLPropScheme? {
            val o = json.asObj ?: return null

            val defense = o["defense"].asObj?.let { d ->
                val dims = mutableMapOf<String, NFLPropDefenseDim>()
                for ((key, raw) in d) {
                    val dim = raw.asObj ?: continue
                    val rate = dim["rate"].asDouble ?: continue
                    val pctile = dim["pctile"].asDouble ?: continue
                    dims[key] = NFLPropDefenseDim(rate = rate, pctile = pctile)
                }
                NFLPropDefense(identity = d["identity"].asString, dims = dims)
            }

            return NFLPropScheme(
                opponent = o["opponent"].asString,
                kind = o["kind"].asString,
                defense = defense,
                playerOverall = mapSplit(o["player_overall"]),
                playerSplits = mapSplitDict(o["player_splits"]),
                lookFocus = mapStringList(o["look_focus"]),
                rushOverall = mapSplit(o["rush_overall"]),
                rushSplits = mapSplitDict(o["rush_splits"]),
                rushLookFocus = mapStringList(o["rush_look_focus"]),
                lookHitRates = mapLookHitRates(o["look_hit_rates"]),
            )
        }

        fun mapGameSplits(json: JsonElement?): NFLPropGameSplits? {
            val o = json.asObj ?: return null
            val splits = mutableMapOf<String, NFLPropGameSplitEntry>()
            o["splits"].asObj?.forEach { (bucket, entry) ->
                mapGameSplitEntry(entry)?.let { splits[bucket] = it }
            }
            return NFLPropGameSplits(
                overall = mapGameSplitEntry(o["overall"]),
                splits = splits,
                applicable = mapStringList(o["applicable"]),
                window = o["window"].asString,
            )
        }

        private fun mapGameSplitEntry(json: JsonElement?): NFLPropGameSplitEntry? {
            val o = json.asObj ?: return null
            val stats = mutableMapOf<String, Double>()
            for ((key, value) in o) {
                if (key == "n" || key == "insufficient" || key == "delta") continue
                value.asDouble?.let { stats[key] = it }
            }
            val delta = mutableMapOf<String, Double>()
            o["delta"].asObj?.forEach { (key, value) ->
                value.asDouble?.let { delta[key] = it }
            }
            return NFLPropGameSplitEntry(
                n = o["n"].asInt,
                insufficient = o["insufficient"].asBool ?: false,
                stats = stats,
                delta = delta,
            )
        }

        private fun mapSplit(json: JsonElement?): NFLPropSchemeSplit? {
            val o = json.asObj ?: return null
            return NFLPropSchemeSplit(
                ypt = o["ypt"].asDouble,
                epaDb = o["epa_db"].asDouble,
                ypa = o["ypa"].asDouble,
                compPct = o["comp_pct"].asDouble,
                sackRate = o["sack_rate"].asDouble,
                ypc = o["ypc"].asDouble,
                epaRush = o["epa_rush"].asDouble,
                tdRate = o["td_rate"].asDouble,
                targets = o["targets"].asInt,
                dropbacks = o["dropbacks"].asInt,
                carries = o["carries"].asInt,
                deltaYpt = o["delta_ypt"].asDouble,
                deltaEpaDb = o["delta_epa_db"].asDouble,
                deltaEpaRush = o["delta_epa_rush"].asDouble,
                pctile = o["pctile"].asDouble,
                sample = o["sample"].asString,
                insufficient = o["insufficient"].asBool ?: false,
            )
        }

        private fun mapSplitDict(json: JsonElement?): Map<String, NFLPropSchemeSplit> {
            val o = json.asObj ?: return emptyMap()
            return o.mapNotNull { (key, value) -> mapSplit(value)?.let { key to it } }.toMap()
        }

        private fun mapStringList(json: JsonElement?): List<String> =
            json.asArr?.mapNotNull { it.asString } ?: emptyList()

        internal fun mapLookHitRates(json: JsonElement?): Map<String, Map<String, NFLPropHitRate>> {
            val byBucket = json.asObj ?: return emptyMap()
            val out = mutableMapOf<String, Map<String, NFLPropHitRate>>()
            for ((bucket, raw) in byBucket) {
                val byMarket = raw.asObj ?: continue
                val records = byMarket.mapNotNull { (market, rec) ->
                    mapHitRate(rec)?.let { market to it }
                }.toMap()
                if (records.isNotEmpty()) out[bucket] = records
            }
            return out
        }

        internal fun mapHitRate(json: JsonElement?): NFLPropHitRate? {
            val o = json.asObj ?: return null
            val h = o["h"].asInt ?: return null
            val n = o["n"].asInt ?: return null
            return NFLPropHitRate(h = h, n = n, pct = o["pct"].asDouble)
        }
    }
}

/** Wire row — jsonb columns land as raw `JsonElement` and map via [toPage]. */
@Serializable
data class NFLPropPlayerPageRow(
    @SerialName("player_id") val playerId: String,
    val season: Int,
    val week: Int,
    @SerialName("player_name") val playerName: String,
    val position: String? = null,
    val team: String? = null,
    val opponent: String? = null,
    @SerialName("is_home") val isHome: Boolean? = null,
    @SerialName("game_label") val gameLabel: String? = null,
    val kickoff: String? = null,
    @SerialName("headshot_url") val headshotUrl: String? = null,
    val rookie: Boolean? = null,
    val markets: JsonElement? = null,
    val baseline: JsonElement? = null,
    val ngs: JsonElement? = null,
    val scheme: JsonElement? = null,
    @SerialName("scheme_game_splits") val schemeGameSplits: JsonElement? = null,
    val projection: JsonElement? = null,
    val highlights: JsonElement? = null,
) {
    fun toPage(): NFLPropPlayerPage = NFLPropPlayerPage(
        playerId = playerId,
        season = season,
        week = week,
        playerName = playerName,
        position = position,
        team = team,
        opponent = opponent,
        isHome = isHome,
        gameLabel = gameLabel,
        kickoff = kickoff,
        headshotUrl = headshotUrl,
        rookie = rookie ?: false,
        markets = NFLPropPlayerPage.mapMarkets(markets),
        projection = NFLPropPlayerPage.mapProjection(projection),
        scheme = NFLPropPlayerPage.mapScheme(scheme),
        schemeGameSplits = NFLPropPlayerPage.mapGameSplits(schemeGameSplits),
    )
}
