package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID

/**
 * WagerBot chat domain model. ContentBlock-based message shape — mirrors the
 * RN chatTypes.ts contract byte-for-byte so the edge-function contract is
 * unchanged.
 *
 * The edge function streams two flavors of SSE event:
 *   1. Raw OpenAI deltas (parsed as ContentDelta)
 *   2. Custom `wagerbot.*` events (tool_start / tool_end / thread / etc.)
 *
 * The view consumes a typed stream of [WagerBotStreamEvent]; the chat store
 * translates each event into block mutations on the current assistant message.
 */

// MARK: tool status ------------------------------------------------------------

sealed class WagerBotToolStatus {
    data object Running : WagerBotToolStatus()
    data class Done(val ms: Int, val ok: Boolean, val summary: String) : WagerBotToolStatus()
}

// MARK: inline chat game cards / widgets (server-side payloads) -----------------

/**
 * Inline chat game card (`wagerbot.game_cards` block). The original game
 * object rides under `raw_game` as an opaque [JsonElement] so the sport
 * detail sheet can re-decode it into its own model — every sport has a
 * different shape.
 */
@Serializable
data class WagerBotChatGameCard(
    val sport: String,
    @SerialName("game_id") val gameId: String,
    @SerialName("away_team") val awayTeam: String,
    @SerialName("home_team") val homeTeam: String,
    @SerialName("away_abbr") val awayAbbr: String,
    @SerialName("home_abbr") val homeAbbr: String,
    @SerialName("game_date") val gameDate: String,
    @SerialName("game_time") val gameTime: String,
    @SerialName("home_spread") val homeSpread: Double? = null,
    @SerialName("away_spread") val awaySpread: Double? = null,
    @SerialName("home_ml") val homeMl: Int? = null,
    @SerialName("away_ml") val awayMl: Int? = null,
    @SerialName("over_under") val overUnder: Double? = null,
    @SerialName("spread_pick") val spreadPick: String? = null,
    @SerialName("spread_confidence") val spreadConfidence: Double? = null,
    @SerialName("spread_edge") val spreadEdge: Double? = null,
    @SerialName("ou_pick") val ouPick: String? = null,
    @SerialName("ou_edge") val ouEdge: Double? = null,
    @SerialName("ml_pick_team") val mlPickTeam: String? = null,
    @SerialName("ml_prob") val mlProb: Double? = null,
    val analysis: String? = null,
    @SerialName("raw_game") val rawGame: JsonElement? = null,
)

/**
 * Inline chat widget block (`wagerbot.chat_widgets`). Widget kinds: matchup,
 * model_projection, polymarket, public_betting, injuries, betting_trends,
 * weather. The payload is sport- and widget-specific; the JSON subtrees are
 * preserved for downstream renderers.
 */
@Serializable
data class WagerBotChatWidget(
    @SerialName("widget_type") val widgetType: String,
    val sport: String,
    @SerialName("game_id") val gameId: String,
    val title: String? = null,
    val analysis: String? = null,
    @SerialName("data") val dataJson: JsonElement? = null,
    @SerialName("raw_game") val rawGame: JsonElement? = null,
)

// MARK: content blocks ----------------------------------------------------------

/**
 * Block-based message body. Mirrors RN `ContentBlock` — the shapes here MUST
 * match the persisted JSON in `chat_messages.blocks` and the SSE payloads.
 * NOT @Serializable on purpose: the store layer owns block (de)serialization,
 * same as iOS.
 */
sealed class WagerBotContentBlock {
    abstract val id: String

    data class Text(override val id: String, val text: String) : WagerBotContentBlock()
    data class Thinking(override val id: String, val text: String) : WagerBotContentBlock()
    data class ToolUse(
        override val id: String,
        val name: String,
        val argumentsJson: String,
        val status: WagerBotToolStatus,
    ) : WagerBotContentBlock()

    data class FollowUps(override val id: String, val questions: List<String>) : WagerBotContentBlock()
    data class GameCards(override val id: String, val cards: List<WagerBotChatGameCard>) : WagerBotContentBlock()
    data class ChatWidgets(override val id: String, val widgets: List<WagerBotChatWidget>) : WagerBotContentBlock()

    /**
     * V2 chat ONLY (wagerbot-agent): rich, tappable components mirroring real
     * app surfaces. Emitted as `wagerbot.app_components`; the legacy
     * gameCards/chatWidgets path is untouched for V1.
     */
    data class AppComponents(
        override val id: String,
        val summary: String?,
        val components: List<WagerBotAppComponent>,
    ) : WagerBotContentBlock()
}

// MARK: message -----------------------------------------------------------------

data class WagerBotMessage(
    val id: String,
    val role: Role,
    var blocks: List<WagerBotContentBlock>,
    val timestamp: String,
) {
    enum class Role(val raw: String) {
        USER("user"),
        ASSISTANT("assistant"),
    }

    companion object {
        fun user(text: String, timestamp: String = nowISO()): WagerBotMessage = WagerBotMessage(
            id = "user_${UUID.randomUUID().toString().uppercase()}",
            role = Role.USER,
            blocks = listOf(
                WagerBotContentBlock.Text(id = "u_${UUID.randomUUID().toString().uppercase()}", text = text),
            ),
            timestamp = timestamp,
        )

        fun assistantPlaceholder(timestamp: String = nowISO()): WagerBotMessage = WagerBotMessage(
            id = "assistant_${UUID.randomUUID().toString().uppercase()}",
            role = Role.ASSISTANT,
            blocks = emptyList(),
            timestamp = timestamp,
        )

        // Swift's ISO8601DateFormatter(.withFractionalSeconds) always emits
        // exactly 3 fraction digits — Instant.toString() would drop them at 0 ms.
        private val ISO_MILLIS: DateTimeFormatter =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)

        fun nowISO(): String = ISO_MILLIS.format(Instant.now())
    }
}

// MARK: thread summary (history list) --------------------------------------------

@Serializable
data class WagerBotThreadSummary(
    val id: String,
    val title: String? = null,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String? = null,
    @SerialName("message_count") val messageCount: Int? = null,
)

// MARK: SSE event stream ----------------------------------------------------------

/**
 * Typed event emitted by the SSE parser. The store applies each event to the
 * in-flight assistant message. Names mirror the RN `WagerBotSSEEvent` union.
 */
sealed class WagerBotStreamEvent {
    data class Thread(val id: String, val created: Boolean) : WagerBotStreamEvent()
    data class ContentDelta(val text: String) : WagerBotStreamEvent()
    data class ThinkingDelta(val text: String) : WagerBotStreamEvent()
    data class ThinkingDone(val summary: String) : WagerBotStreamEvent()
    data class ToolStart(val id: String, val name: String, val argumentsJson: String) : WagerBotStreamEvent()
    data class ToolEnd(
        val id: String,
        val name: String,
        val ms: Int,
        val ok: Boolean,
        val summary: String,
    ) : WagerBotStreamEvent()

    data class GameCards(val cards: List<WagerBotChatGameCard>) : WagerBotStreamEvent()
    data class ChatWidgets(val widgets: List<WagerBotChatWidget>) : WagerBotStreamEvent()
    data class AppComponents(
        val summary: String?,
        val components: List<WagerBotAppComponent>,
    ) : WagerBotStreamEvent()

    data class FollowUps(val questions: List<String>) : WagerBotStreamEvent()
    data class ThreadTitled(val id: String, val title: String) : WagerBotStreamEvent()
    data class MessagePersisted(val role: String) : WagerBotStreamEvent()
    data class Error(val code: String, val message: String) : WagerBotStreamEvent()
    data object Done : WagerBotStreamEvent()
}

// MARK: tool catalog metadata -------------------------------------------------------

/**
 * Display names + icons for each WagerBot tool. Falls back to a title-cased
 * version of the raw tool name so new server-side tools render reasonably
 * without an app update. `icon(for:)` returns the iOS SF Symbol names for
 * cross-platform parity — Android maps them to its own drawables later.
 */
object WagerBotToolCatalog {
    fun label(toolName: String): String = when (toolName) {
        "get_nba_predictions" -> "NBA Predictions"
        "get_nfl_predictions" -> "NFL Predictions"
        "get_cfb_predictions" -> "CFB Predictions"
        "get_ncaab_predictions" -> "NCAAB Predictions"
        "get_mlb_predictions" -> "MLB Predictions"
        "get_polymarket_odds" -> "Polymarket Odds"
        "get_game_detail" -> "Game Detail"
        "search_games" -> "Searching Games"
        "get_editor_picks" -> "Editor Picks"
        "suggest_follow_ups" -> "Follow-ups"
        "present_analysis" -> "Analysis"
        "web_search", "google_search" -> "Searching the web"
        else -> toolName
            .replace('_', ' ')
            .split(' ')
            // Swift `.capitalized` lowercases the rest of each word too.
            .joinToString(" ") { word -> word.lowercase().replaceFirstChar { it.titlecase() } }
    }

    fun icon(toolName: String): String = when (toolName) {
        "get_nba_predictions", "get_ncaab_predictions" -> "basketball.fill"
        "get_nfl_predictions", "get_cfb_predictions" -> "football.fill"
        "get_mlb_predictions" -> "baseball.fill"
        "get_polymarket_odds" -> "chart.line.uptrend.xyaxis"
        "get_game_detail" -> "doc.text.magnifyingglass"
        "search_games" -> "magnifyingglass"
        "get_editor_picks" -> "star.fill"
        "suggest_follow_ups" -> "questionmark.bubble.fill"
        "present_analysis" -> "chart.bar.doc.horizontal.fill"
        "web_search", "google_search" -> "globe"
        else -> "wrench.and.screwdriver.fill"
    }
}
