package com.wagerproof.core.models

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.put
import java.util.UUID

/**
 * V2 chat rich components (wagerbot-agent only). Each component mirrors a real
 * app surface — a game card, a prop row, an agent card, a mini widget — and
 * carries a `nav` descriptor so tapping it lands the user where the rest of
 * the app would. Emitted as `wagerbot.app_components`; additive to the legacy
 * gameCards/chatWidgets path.
 */

/**
 * Where tapping a component should take the user. `kind` maps onto the app's
 * existing navigation (sport game sheets, props, agent routes, tool router).
 */
@Serializable
data class WagerBotChatNav(
    /** "game" | "prop" | "agent" | "agent_pick" | "editor_picks" | "tool" | "none" */
    val kind: String,
    val sport: String? = null,
    @SerialName("game_id") val gameId: String? = null,
    @SerialName("agent_id") val agentId: String? = null,
    @SerialName("prop_id") val propId: String? = null,
    /** ToolRouter category id (e.g. "nbaAccuracy", "mlbRegression"). */
    @SerialName("tool_category") val toolCategory: String? = null,
)

/**
 * A single rich chat component. The renderer dispatches on `type`; `fields`
 * carries the per-type display payload as opaque JSON (adding/altering a
 * component's fields never requires a model change). `rawGame` carries the
 * original game object for game-linked components. iOS stored these as
 * re-encoded Data envelopes; here they stay plain [JsonObject]-ish elements.
 */
@Serializable(with = WagerBotAppComponentSerializer::class)
data class WagerBotAppComponent(
    /**
     * One of: game, prop, agent, agent_pick, editor_pick, value, tool,
     * model_projection, polymarket, betting_trends, model_accuracy, injury,
     * weather, public_betting.
     */
    val type: String,
    val componentId: String,
    val nav: WagerBotChatNav? = null,
    val fields: kotlinx.serialization.json.JsonElement? = null,
    val rawGame: kotlinx.serialization.json.JsonElement? = null,
) {
    val id: String get() = componentId

    private val fieldsObject: JsonObject get() = fields as? JsonObject ?: JsonObject(emptyMap())

    // Typed convenience accessors over `fields`, coercing number-or-string the
    // way the Swift NSNumber-based accessors did (bools are numbers there too).
    fun string(key: String): String? {
        val prim = fieldsObject[key] as? JsonPrimitive ?: return null
        if (prim is JsonNull) return null
        if (prim.isString) return prim.content
        // NSNumber(bool).stringValue is "1"/"0" via JSONSerialization on iOS.
        prim.booleanOrNull?.let { return if (it) "1" else "0" }
        return prim.content
    }

    fun double(key: String): Double? {
        val prim = fieldsObject[key] as? JsonPrimitive ?: return null
        if (prim is JsonNull) return null
        if (prim.isString) return prim.content.toDoubleOrNull()
        prim.booleanOrNull?.let { return if (it) 1.0 else 0.0 }
        return prim.doubleOrNull
    }

    fun int(key: String): Int? {
        val prim = fieldsObject[key] as? JsonPrimitive ?: return null
        if (prim is JsonNull) return null
        if (prim.isString) return prim.content.toIntOrNull()
        prim.booleanOrNull?.let { return if (it) 1 else 0 }
        return prim.intOrNull ?: prim.doubleOrNull?.toInt()
    }

    fun bool(key: String): Boolean? {
        val prim = fieldsObject[key] as? JsonPrimitive ?: return null
        if (prim is JsonNull || prim.isString) return null
        prim.booleanOrNull?.let { return it }
        // NSNumber.boolValue: any nonzero number is true.
        return prim.doubleOrNull?.let { it != 0.0 }
    }

    /** All-or-nothing like Swift's `as? [[String: Any]]` — any non-object element voids the list. */
    fun rows(key: String): List<JsonObject> {
        val array = fieldsObject[key] as? JsonArray ?: return emptyList()
        val objects = array.map { it as? JsonObject ?: return emptyList() }
        return objects
    }

    /** All-or-nothing like Swift's `as? [String]` — any non-string element voids the list. */
    fun strings(key: String): List<String> {
        val array = fieldsObject[key] as? JsonArray ?: return emptyList()
        return array.map {
            (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content ?: return emptyList()
        }
    }
}

/**
 * Custom serializer: `componentId` decodes from wire key `id` with a random
 * fallback (server may omit it), `nav` decode failures degrade to null, and
 * `fields`/`raw_game` are kept as opaque JSON.
 */
object WagerBotAppComponentSerializer : KSerializer<WagerBotAppComponent> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("WagerBotAppComponent")

    override fun deserialize(decoder: Decoder): WagerBotAppComponent {
        val input = decoder as? JsonDecoder
            ?: throw SerializationException("WagerBotAppComponent supports JSON only")
        val obj = input.decodeJsonElement() as? JsonObject
            ?: throw SerializationException("WagerBotAppComponent must be a JSON object")

        val type = (obj["type"] as? JsonPrimitive)?.takeIf { it.isString }?.content
            ?: throw SerializationException("WagerBotAppComponent missing required 'type'")
        val componentId = (obj["id"] as? JsonPrimitive)?.takeIf { it.isString }?.content
            ?: "c_${UUID.randomUUID().toString().uppercase()}"
        val nav = obj["nav"]?.takeUnless { it is JsonNull }?.let { el ->
            runCatching { input.json.decodeFromJsonElement(WagerBotChatNav.serializer(), el) }.getOrNull()
        }
        return WagerBotAppComponent(
            type = type,
            componentId = componentId,
            nav = nav,
            fields = obj["fields"]?.takeUnless { it is JsonNull },
            rawGame = obj["raw_game"]?.takeUnless { it is JsonNull },
        )
    }

    override fun serialize(encoder: Encoder, value: WagerBotAppComponent) {
        val output = encoder as? JsonEncoder
            ?: throw SerializationException("WagerBotAppComponent supports JSON only")
        val obj = buildJsonObject {
            put("type", value.type)
            put("id", value.componentId)
            value.nav?.let {
                put("nav", output.json.encodeToJsonElement(WagerBotChatNav.serializer(), it))
            }
            value.fields?.let { put("fields", it) }
            value.rawGame?.let { put("raw_game", it) }
        }
        output.encodeJsonElement(obj)
    }
}
