package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FlexibleDoubleOrZeroSerializer
import com.wagerproof.core.models.serialization.FlexibleIntOrZeroSerializer
import com.wagerproof.core.models.serialization.LossyListSerializer
import com.wagerproof.core.models.serialization.RoundingFlexibleIntSerializer
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import java.util.Locale
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.round

/**
 * MLB player-prop domain model + pure computation utilities. Port of iOS
 * `MLBPlayerProp.swift` (itself a byte-for-byte port of RN
 * `types/mlb-player-props.ts` + `utils/mlbPlayerProps.ts`).
 *
 * The backend RPC `get_mlb_player_props_l10(p_game_pk)` returns the raw
 * materials — the alternate-line ladder (`lines`) and the season game log
 * (`games`) — and the client derives every split (L10, day/night, archetype)
 * at a chosen line. Keeping that math here (JVM-only) means views just render.
 */

// MARK: - Markets

/** Canonical prop market keys. Mirrors RN `MlbPlayerPropMarket`. */
enum class MLBPlayerPropMarket(val raw: String) {
    BATTER_HOME_RUNS("batter_home_runs"),
    BATTER_HITS("batter_hits"),
    BATTER_TOTAL_BASES("batter_total_bases"),
    BATTER_RBIS("batter_rbis"),
    BATTER_HITS_RUNS_RBIS("batter_hits_runs_rbis"),
    BATTER_WALKS("batter_walks"),
    BATTER_STRIKEOUTS("batter_strikeouts"),
    PITCHER_STRIKEOUTS("pitcher_strikeouts"),
    PITCHER_HITS_ALLOWED("pitcher_hits_allowed"),
    PITCHER_WALKS("pitcher_walks"),
    PITCHER_OUTS("pitcher_outs");

    /** Friendly label. Falls back to the raw key for unknown markets. */
    val label: String get() = MLBPlayerProps.marketLabel(raw)

    companion object {
        fun fromRaw(raw: String): MLBPlayerPropMarket? = entries.firstOrNull { it.raw == raw }
    }
}

// MARK: - Field serializers (RPC jsonb quirks)

/** Day flag normalized to exactly 1 or 0 (jsonb may carry 1.0 / junk). */
private object PropDayFlagSerializer : KSerializer<Int> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("MLBPropDayFlag", PrimitiveKind.INT)

    override fun deserialize(decoder: Decoder): Int =
        if (RoundingFlexibleIntSerializer.deserialize(decoder) == 1) 1 else 0

    override fun serialize(encoder: Encoder, value: Int) = encoder.encodeInt(value)
}

// Note: JSON nulls never reach these two serializers — the generated code
// short-circuits null tokens via decodeNullableSerializableElement — so a
// plain (non-nullable) STRING descriptor is deliberate.

/** Archetype string; literal "Insufficient" (and non-strings) → null. */
private object PropArchetypeSerializer : KSerializer<String?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("MLBPropArchetype", PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): String? {
        val el = (decoder as? JsonDecoder)?.decodeJsonElement()
            ?: return runCatching { decoder.decodeString() }.getOrNull()
        val prim = el as? JsonPrimitive ?: return null
        if (prim is JsonNull || !prim.isString) return null
        return prim.content.takeUnless { it == "Insufficient" }
    }

    override fun serialize(encoder: Encoder, value: String?) {
        if (value == null) encoder.encodeNull() else encoder.encodeString(value)
    }
}

/** Game date; empty string (and non-strings) → null. */
private object PropDateSerializer : KSerializer<String?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("MLBPropDate", PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): String? {
        val el = (decoder as? JsonDecoder)?.decodeJsonElement()
            ?: return runCatching { decoder.decodeString() }.getOrNull()
        val prim = el as? JsonPrimitive ?: return null
        if (prim is JsonNull || !prim.isString) return null
        return prim.content.takeUnless { it.isEmpty() }
    }

    override fun serialize(encoder: Encoder, value: String?) {
        if (value == null) encoder.encodeNull() else encoder.encodeString(value)
    }
}

// MARK: - Raw RPC row

/** One alternate line + its over/under odds. Mirrors `MlbPlayerPropLineEntry`. */
@Serializable
data class MLBPlayerPropLineEntry(
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    val line: Double = 0.0,
    @Serializable(with = RoundingFlexibleIntSerializer::class)
    val over: Int? = null,
    @Serializable(with = RoundingFlexibleIntSerializer::class)
    val under: Int? = null,
)

/**
 * One historical game in the season log. Mirrors `MlbPlayerPropGameEntry`:
 *   - `v`  the player's actual stat value that game
 *   - `d`  day flag (1 = day game, 0 = night)
 *   - `a`  opposing starter archetype (null / "Insufficient" → null)
 *   - `dt` ISO `YYYY-MM-DD` for the chart x-axis
 */
@Serializable
data class MLBPlayerPropGameEntry(
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    val v: Double = 0.0,
    @Serializable(with = PropDayFlagSerializer::class)
    val d: Int = 0,
    @Serializable(with = PropArchetypeSerializer::class)
    val a: String? = null,
    @Serializable(with = PropDateSerializer::class)
    val dt: String? = null,
)

private object PropLineLossyListSerializer :
    LossyListSerializer<MLBPlayerPropLineEntry>(MLBPlayerPropLineEntry.serializer())

private object PropGameLossyListSerializer :
    LossyListSerializer<MLBPlayerPropGameEntry>(MLBPlayerPropGameEntry.serializer())

/** Raw RPC result for one `(player, market)` pair. Mirrors `MlbPlayerPropRow`. */
@Serializable
data class MLBPlayerPropRow(
    @SerialName("player_id")
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val playerId: Int = 0,
    @SerialName("player_name")
    val playerName: String = "Player",
    @SerialName("is_pitcher")
    val isPitcher: Boolean = false,
    val market: String = "",
    @SerialName("game_is_day")
    val gameIsDay: Boolean = false,
    @SerialName("opp_archetype_today")
    val oppArchetypeToday: String? = null,
    // Kept private so every consumer reads the sorted `lines` below —
    // parseLines sorts ascending by line and downstream math relies on it.
    @SerialName("lines")
    @Serializable(with = PropLineLossyListSerializer::class)
    private val linesRaw: List<MLBPlayerPropLineEntry> = emptyList(),
    /** Season game log, newest first. */
    @Serializable(with = PropGameLossyListSerializer::class)
    val games: List<MLBPlayerPropGameEntry> = emptyList(),
) {
    /** Alternate-line ladder, always sorted ascending by line (invariant). */
    @Transient
    val lines: List<MLBPlayerPropLineEntry> = linesRaw.sortedBy { it.line }

    /**
     * Stable identity for lists. A player can appear under multiple markets,
     * so the market is part of the key.
     */
    val id: String get() = "$playerId-$market"

    companion object {
        /** Convenience factory taking a public `lines` param (mirrors Swift memberwise init). */
        fun of(
            playerId: Int,
            playerName: String,
            isPitcher: Boolean,
            market: String,
            gameIsDay: Boolean,
            oppArchetypeToday: String?,
            lines: List<MLBPlayerPropLineEntry>,
            games: List<MLBPlayerPropGameEntry>,
        ): MLBPlayerPropRow = MLBPlayerPropRow(
            playerId = playerId,
            playerName = playerName,
            isPitcher = isPitcher,
            market = market,
            gameIsDay = gameIsDay,
            oppArchetypeToday = oppArchetypeToday,
            linesRaw = lines,
            games = games,
        )
    }
}

// MARK: - Computed splits (client-only)

/** Over count / sample size / pct for a subset of games at a line. Mirrors `PropHitSplit`. */
data class MLBPropHitSplit(
    val over: Int,
    val games: Int,
    val pct: Int?,
) {
    /** `games > 0 && games < 5` — too small a sample to trust. */
    val lowConfidence: Boolean get() = games in 1..4

    /** "X/Y" or "-" when empty. */
    val fractionLabel: String get() = if (games <= 0) "-" else "$over/$games"

    /** "Z%" or "-". */
    val pctLabel: String get() = pct?.let { "$it%" } ?: "-"
}

/** One bar in the recent-form chart. */
data class MLBPropChartBar(
    val id: Int,
    val value: Double,
    val cleared: Boolean,
    val isDay: Boolean,
    val archetype: String?,
    val date: String?,
)

/** Everything the detail view needs at a selected line. Mirrors `PropComputedAtLine`. */
data class MLBPropComputedAtLine(
    val line: Double,
    val overOdds: Int?,
    val underOdds: Int?,
    val l10: MLBPropHitSplit,
    val season: MLBPropHitSplit,
    val contextualDayNight: MLBPropHitSplit?,
    val contextualArchetype: MLBPropHitSplit?,
    val chartGames: List<MLBPropChartBar>,
    val miniStrip: List<MiniStripEntry>,
) {
    /** Swift `(cleared, value)` tuple. */
    data class MiniStripEntry(val cleared: Boolean, val value: Double)
}

/** A player's single best prop (highest L10 over-rate at its default line). */
data class MLBHeadlineProp(
    val row: MLBPlayerPropRow,
    val computed: MLBPropComputedAtLine,
)

/** Swift `(playerId, props)` tuple from `groupPropsByPlayer`. */
data class MLBPlayerPropGroup(
    val playerId: Int,
    val props: List<MLBPlayerPropRow>,
)

// MARK: - Pure computation namespace

object MLBPlayerProps {
    const val brandGreenHex: Long = 0x22C55E
    const val missRedHex: Long = 0xEF4444

    internal val marketLabels: Map<String, String> = mapOf(
        "batter_home_runs" to "Home Runs",
        "batter_hits" to "Hits",
        "batter_total_bases" to "Total Bases",
        "batter_rbis" to "RBIs",
        "batter_hits_runs_rbis" to "H+R+RBI",
        "batter_walks" to "Batter Walks",
        "batter_strikeouts" to "Batter K",
        "pitcher_strikeouts" to "Pitcher K",
        "pitcher_hits_allowed" to "Hits Allowed",
        "pitcher_walks" to "Pitcher Walks",
        "pitcher_outs" to "Outs",
    )

    internal val marketEmojis: Map<String, String> = mapOf(
        "batter_home_runs" to "💣",
        "batter_hits" to "🏏",
        "batter_total_bases" to "🚀",
        "batter_rbis" to "🏃",
        "batter_hits_runs_rbis" to "🔥",
        "batter_walks" to "👁️",
        "batter_strikeouts" to "💨",
        "pitcher_strikeouts" to "⚡",
        "pitcher_hits_allowed" to "🎯",
        "pitcher_walks" to "🌪️",
        "pitcher_outs" to "🛡️",
    )

    internal val batterMarketOrder: List<String> = listOf(
        "batter_home_runs", "batter_hits", "batter_total_bases",
        "batter_rbis", "batter_hits_runs_rbis", "batter_walks", "batter_strikeouts",
    )
    internal val pitcherMarketOrder: List<String> = listOf(
        "pitcher_strikeouts", "pitcher_hits_allowed", "pitcher_walks", "pitcher_outs",
    )

    fun marketLabel(market: String): String = marketLabels[market] ?: market

    fun marketEmoji(market: String): String = marketEmojis[market] ?: "🎲"

    internal fun marketSortIndex(market: String, isPitcher: Boolean): Int {
        val order = if (isPitcher) pitcherMarketOrder else batterMarketOrder
        val idx = order.indexOf(market)
        return if (idx >= 0) idx else 999
    }

    /** American-odds string: "+120" / "-110" / "-" for null. */
    fun formatOdds(odds: Int?): String {
        if (odds == null) return "-"
        return if (odds > 0) "+$odds" else "$odds"
    }

    /** Integer or single-decimal line. Mirrors `formatPropLine`. */
    fun formatLine(line: Double?): String {
        if (line == null || !line.isFinite()) return "-"
        return if (line == round(line)) line.toInt().toString()
        else String.format(Locale.US, "%.1f", line)
    }

    /** Bar value formatter — integer or one decimal. Mirrors `formatBarValue`. */
    fun formatBarValue(v: Double): String {
        if (!v.isFinite()) return "0"
        return if (v == round(v)) v.toInt().toString()
        else String.format(Locale.US, "%.1f", v)
    }

    fun cleared(game: MLBPlayerPropGameEntry, line: Double): Boolean = game.v > line

    /**
     * First "fair" line (over odds present and >= -180), else the last line.
     * Mirrors `defaultLine`.
     */
    fun defaultLine(lines: List<MLBPlayerPropLineEntry>): Double? {
        if (lines.isEmpty()) return null
        val fair = lines.firstOrNull { it.over != null && it.over >= -180 }
        return (fair ?: lines.last()).line
    }

    internal fun lineEntry(lines: List<MLBPlayerPropLineEntry>, line: Double): MLBPlayerPropLineEntry? =
        lines.firstOrNull { it.line == line }

    /** Over/games/pct for an optionally-capped subset. Mirrors `hitSplit`. */
    fun hitSplit(games: List<MLBPlayerPropGameEntry>, line: Double, max: Int? = null): MLBPropHitSplit {
        val subset = if (max != null) games.take(max) else games
        val n = subset.size
        val over = subset.count { cleared(it, line) }
        return MLBPropHitSplit(
            over = over,
            games = n,
            pct = if (n > 0) roundAwayFromZero(over.toDouble() / n * 100).toInt() else null,
        )
    }

    /**
     * Full computation at a line — L10, season, day/night + archetype
     * contextual splits, chart bars, mini strip. Mirrors `computePropAtLine`.
     */
    fun computePropAtLine(row: MLBPlayerPropRow, line: Double): MLBPropComputedAtLine? {
        val entry = lineEntry(row.lines, line) ?: return null

        val l10 = hitSplit(row.games, line, max = 10)
        val season = hitSplit(row.games, line)
        val dayFlag = if (row.gameIsDay) 1 else 0
        val contextualGames = row.games.filter { it.d == dayFlag }
        val contextualDayNight =
            if (contextualGames.isEmpty()) null else hitSplit(contextualGames, line)

        var contextualArchetype: MLBPropHitSplit? = null
        val arch = row.oppArchetypeToday
        if (!row.isPitcher && arch != null) {
            val archGames = row.games.filter { it.a == arch }
            if (archGames.size >= 3) contextualArchetype = hitSplit(archGames, line)
        }

        // Newest-on-the-right: take the most recent 12, reverse to oldest→newest.
        val chartGames = row.games.take(12).reversed().mapIndexed { idx, g ->
            MLBPropChartBar(
                id = idx,
                value = g.v,
                cleared = cleared(g, line),
                isDay = g.d == 1,
                archetype = g.a,
                date = g.dt,
            )
        }

        val miniStrip = row.games.take(10).reversed().map {
            MLBPropComputedAtLine.MiniStripEntry(cleared = cleared(it, line), value = it.v)
        }

        return MLBPropComputedAtLine(
            line = line,
            overOdds = entry.over,
            underOdds = entry.under,
            l10 = l10,
            season = season,
            contextualDayNight = contextualDayNight,
            contextualArchetype = contextualArchetype,
            chartGames = chartGames,
            miniStrip = miniStrip,
        )
    }

    /**
     * Player's best prop by L10 over-rate at each market's default line.
     * When [market] is set, returns that market only (for feed filters).
     * Mirrors `pickHeadlineProp`.
     */
    fun pickHeadlineProp(props: List<MLBPlayerPropRow>, market: String? = null): MLBHeadlineProp? {
        if (market != null) {
            val row = props.firstOrNull { it.market == market } ?: return null
            val dl = defaultLine(row.lines) ?: return null
            val computed = computePropAtLine(row, dl) ?: return null
            return MLBHeadlineProp(row = row, computed = computed)
        }
        var best: Triple<MLBPlayerPropRow, MLBPropComputedAtLine, Double>? = null
        for (row in props) {
            val dl = defaultLine(row.lines) ?: continue
            val computed = computePropAtLine(row, dl) ?: continue
            val rate = if (computed.l10.games > 0) {
                computed.l10.over.toDouble() / computed.l10.games
            } else -1.0
            if (best == null || rate > best.third) best = Triple(row, computed, rate)
        }
        val (row, computed, _) = best ?: return null
        return MLBHeadlineProp(row = row, computed = computed)
    }

    /** Narrative one-liner. Mirrors `buildVerdict`. */
    fun buildVerdict(row: MLBPlayerPropRow, computed: MLBPropComputedAtLine): String {
        val l10 = computed.l10
        if (l10.games == 0) return "Not enough recent games to gauge this line."
        val parts = mutableListOf<String>()
        when {
            l10.over >= 7 -> parts.add("Cleared in ${l10.over} of last ${l10.games}")
            l10.over >= 5 -> parts.add("Hit ${l10.over}/${l10.games} over the last ${l10.games}")
            else -> parts.add("${l10.over}/${l10.games} over the last ${l10.games}")
        }
        val dn = computed.contextualDayNight
        if (dn != null && dn.games >= 5) {
            val label = if (row.gameIsDay) "day" else "night"
            parts.add("${dn.over}/${dn.games} in $label games")
        }
        val arch = computed.contextualArchetype
        val archName = row.oppArchetypeToday
        if (arch != null && arch.games >= 3 && archName != null) {
            parts.add("${arch.over}/${arch.games} vs $archName starters")
        }
        val emoji = if (l10.over >= 7) "🔥 " else if (l10.over >= 5) "📈 " else ""
        return emoji + parts.joinToString(" — ") + "."
    }

    /**
     * Group a flat prop list by player, keeping only batters or pitchers,
     * markets sorted by the canonical order. Preserves first-seen player order.
     * Mirrors `groupPropsByPlayer`.
     */
    fun groupPropsByPlayer(rows: List<MLBPlayerPropRow>, isPitcher: Boolean): List<MLBPlayerPropGroup> {
        val order = mutableListOf<Int>()
        val map = mutableMapOf<Int, MutableList<MLBPlayerPropRow>>()
        for (row in rows) {
            if (row.isPitcher != isPitcher) continue
            map.getOrPut(row.playerId) {
                order.add(row.playerId)
                mutableListOf()
            }.add(row)
        }
        return order.map { pid ->
            val sorted = map[pid].orEmpty().sortedBy { marketSortIndex(it.market, isPitcher) }
            MLBPlayerPropGroup(playerId = pid, props = sorted)
        }
    }

    /**
     * MLB headshot CDN url. The legacy `content.mlb.com/images/headshots/...`
     * path 403s for direct (non-browser) requests, so we use the
     * `img.mlbstatic.com` Cloudinary endpoint — 213px headshot with a generic
     * silhouette fallback baked in.
     */
    fun headshotURL(playerId: Int): String =
        "https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/$playerId/headshot/67/current"

    // Swift Double.rounded() is ties-away-from-zero; kotlin.math.round is ties-to-even.
    private fun roundAwayFromZero(v: Double): Double =
        if (v >= 0) floor(v + 0.5) else ceil(v - 0.5)
}

// MARK: - Pitcher archetype display

/**
 * Display metadata for a pitcher archetype. Mirrors RN `ARCHETYPE_META`.
 * Color is a raw hex so the models layer stays UI-toolkit-free.
 */
data class MLBArchetypeMeta(
    val icon: String,
    val colorHex: Long,
    val label: String,
)

object MLBPitcherArchetypes {
    internal val meta: Map<String, MLBArchetypeMeta> = mapOf(
        "Power" to MLBArchetypeMeta(icon = "🔥", colorHex = 0xEF4444, label = "Power Pitcher"),
        "Groundball" to MLBArchetypeMeta(icon = "🪨", colorHex = 0x10B981, label = "Groundball Pitcher"),
        "Flyball" to MLBArchetypeMeta(icon = "🎈", colorHex = 0xF59E0B, label = "Flyball Pitcher"),
        "Control" to MLBArchetypeMeta(icon = "🎯", colorHex = 0x3B82F6, label = "Control Pitcher"),
        "Finesse" to MLBArchetypeMeta(icon = "🧪", colorHex = 0xA855F7, label = "Finesse / Crafty"),
        "Balanced" to MLBArchetypeMeta(icon = "⚖️", colorHex = 0x64748B, label = "Balanced"),
    )

    /** True for archetypes we render a badge for (excludes "Insufficient"). */
    fun isDisplay(archetype: String?): Boolean {
        val a = archetype ?: return false
        if (a == "Insufficient") return false
        return meta.containsKey(a)
    }

    fun displayMeta(archetype: String?): MLBArchetypeMeta? =
        if (isDisplay(archetype)) meta[archetype] else null
}
