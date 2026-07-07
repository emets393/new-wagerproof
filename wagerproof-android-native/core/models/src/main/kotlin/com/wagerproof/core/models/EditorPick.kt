package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FallbackEnumSerializer
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.put

/**
 * `editors_picks` row (main Supabase). Field names match the RN table
 * byte-for-byte. Decode is synthesized/non-tolerant on iOS — required fields
 * here are non-null with no default so a missing column fails the same way.
 */
@Serializable
data class EditorPick(
    val id: String,
    @SerialName("game_id") val gameId: String,
    @SerialName("game_type") val gameType: GameType,
    @SerialName("editor_id") val editorId: String,
    @SerialName("selected_bet_type") val selectedBetType: String,
    @SerialName("editors_notes") val editorsNotes: String? = null,
    @SerialName("is_published") val isPublished: Boolean,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("betslip_links") val betslipLinks: Map<String, String>? = null,
    @SerialName("pick_value") val pickValue: String? = null,
    @SerialName("best_price") val bestPrice: String? = null,
    val sportsbook: String? = null,
    val units: Double? = null,
    @SerialName("is_free_pick") val isFreePick: Boolean? = null,
    @SerialName("archived_game_data") val archivedGameData: ArchivedGameData? = null,
    @SerialName("bet_type") val betType: String? = null,
    val result: PickResult? = null,
)

/**
 * Sport keys used by `editors_picks.game_type`. Input is lowercased before
 * matching and unknown values decode to [UNKNOWN] so a stray row doesn't
 * blow up the whole feed (mirrors the Swift custom init).
 */
@Serializable(with = GameTypeSerializer::class)
enum class GameType(val raw: String) {
    NFL("nfl"),
    CFB("cfb"),
    NBA("nba"),
    NCAAB("ncaab"),
    MLB("mlb"),
    UNKNOWN("unknown");

    val displayLabel: String
        get() = when (this) {
            NFL -> "NFL"
            CFB -> "CFB"
            NBA -> "NBA"
            NCAAB -> "NCAAB"
            MLB -> "MLB"
            UNKNOWN -> "—"
        }
}

object GameTypeSerializer : FallbackEnumSerializer<GameType>(
    "GameType",
    GameType.entries.associateBy { it.raw },
    { it.raw },
    GameType.UNKNOWN,
    candidates = { listOf(it.lowercase()) },
)

/** `result` column on `editors_picks`. No fallback — unknown values throw, like Swift. */
@Serializable
enum class PickResult(val raw: String) {
    @SerialName("won") WON("won"),
    @SerialName("lost") LOST("lost"),
    @SerialName("push") PUSH("push"),
    @SerialName("pending") PENDING("pending"),
}

/**
 * Sub-doc inside `editors_picks.archived_game_data`. RN's persistence is
 * inconsistent — some keys are camelCased (`awayTeam`), others snake_cased
 * (`away_team`) — so the decoder accepts both (camelCase checked first).
 * Encoding always uses camelCase (RN's newer format).
 */
@Serializable(with = ArchivedGameDataSerializer::class)
data class ArchivedGameData(
    val awayTeam: String? = null,
    val homeTeam: String? = null,
    val awayLogo: String? = null,
    val homeLogo: String? = null,
    val gameDate: String? = null,
    val gameTime: String? = null,
    val rawGameDate: String? = null,
    val awaySpread: Double? = null,
    val homeSpread: Double? = null,
    val overLine: Double? = null,
    val awayMl: Int? = null,
    val homeMl: Int? = null,
    val awayTeamColors: TeamColors? = null,
    val homeTeamColors: TeamColors? = null,
)

object ArchivedGameDataSerializer : KSerializer<ArchivedGameData> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("ArchivedGameData")

    override fun deserialize(decoder: Decoder): ArchivedGameData {
        val input = decoder as? JsonDecoder
            ?: throw SerializationException("ArchivedGameData supports JSON only")
        val obj = input.decodeJsonElement() as? JsonObject ?: JsonObject(emptyMap())

        // Mirrors Swift's firstString/firstDouble/... — a wrong-typed or null
        // value under the camelCase key falls through to the snake_case key.
        fun firstString(vararg keys: String): String? = keys.firstNotNullOfOrNull { k ->
            (obj[k] as? JsonPrimitive)?.takeIf { it.isString }?.content
        }
        fun firstDouble(vararg keys: String): Double? = keys.firstNotNullOfOrNull { k ->
            (obj[k] as? JsonPrimitive)?.takeUnless { it.isString }?.doubleOrNull
        }
        fun firstInt(vararg keys: String): Int? = keys.firstNotNullOfOrNull { k ->
            (obj[k] as? JsonPrimitive)?.takeUnless { it.isString }?.intOrNull
        }
        fun firstColors(vararg keys: String): TeamColors? = keys.firstNotNullOfOrNull { k ->
            obj[k]?.let { el ->
                runCatching { input.json.decodeFromJsonElement(TeamColors.serializer(), el) }.getOrNull()
            }
        }

        return ArchivedGameData(
            awayTeam = firstString("awayTeam", "away_team"),
            homeTeam = firstString("homeTeam", "home_team"),
            awayLogo = firstString("awayLogo", "away_logo"),
            homeLogo = firstString("homeLogo", "home_logo"),
            gameDate = firstString("gameDate", "game_date"),
            gameTime = firstString("gameTime", "game_time"),
            rawGameDate = firstString("rawGameDate", "raw_game_date"),
            awaySpread = firstDouble("awaySpread", "away_spread"),
            homeSpread = firstDouble("homeSpread", "home_spread"),
            overLine = firstDouble("overLine", "over_line"),
            awayMl = firstInt("awayMl", "away_ml"),
            homeMl = firstInt("homeMl", "home_ml"),
            awayTeamColors = firstColors("awayTeamColors", "away_team_colors"),
            homeTeamColors = firstColors("homeTeamColors", "home_team_colors"),
        )
    }

    override fun serialize(encoder: Encoder, value: ArchivedGameData) {
        val output = encoder as? JsonEncoder
            ?: throw SerializationException("ArchivedGameData supports JSON only")
        val obj = buildJsonObject {
            value.awayTeam?.let { put("awayTeam", it) }
            value.homeTeam?.let { put("homeTeam", it) }
            value.awayLogo?.let { put("awayLogo", it) }
            value.homeLogo?.let { put("homeLogo", it) }
            value.gameDate?.let { put("gameDate", it) }
            value.gameTime?.let { put("gameTime", it) }
            value.rawGameDate?.let { put("rawGameDate", it) }
            value.awaySpread?.let { put("awaySpread", it) }
            value.homeSpread?.let { put("homeSpread", it) }
            value.overLine?.let { put("overLine", it) }
            value.awayMl?.let { put("awayMl", it) }
            value.homeMl?.let { put("homeMl", it) }
            value.awayTeamColors?.let {
                put("awayTeamColors", output.json.encodeToJsonElement(TeamColors.serializer(), it))
            }
            value.homeTeamColors?.let {
                put("homeTeamColors", output.json.encodeToJsonElement(TeamColors.serializer(), it))
            }
        }
        output.encodeJsonElement(obj)
    }
}

@Serializable
data class TeamColors(
    val primary: String,
    val secondary: String,
) {
    companion object {
        val DEFAULT = TeamColors(primary = "#6B7280", secondary = "#9CA3AF")
    }
}

/**
 * Per-pick game context joined from the relevant sport's input/lines table.
 * Client-assembled — not serialized.
 */
data class EditorPickGameData(
    var awayTeam: String,
    var homeTeam: String,
    var awayLogo: String? = null,
    var homeLogo: String? = null,
    var gameDate: String? = null,
    var gameTime: String? = null,
    /** ISO-ish raw date string used for sorting/filtering; `YYYY-MM-DD` or full ISO 8601. */
    var rawGameDate: String? = null,
    var awaySpread: Double? = null,
    var homeSpread: Double? = null,
    var overLine: Double? = null,
    var awayMl: Int? = null,
    var homeMl: Int? = null,
    var openingSpread: Double? = null,
    var awayTeamColors: TeamColors = TeamColors.DEFAULT,
    var homeTeamColors: TeamColors = TeamColors.DEFAULT,
)
