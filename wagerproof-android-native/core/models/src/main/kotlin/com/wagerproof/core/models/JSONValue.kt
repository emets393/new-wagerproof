package com.wagerproof.core.models

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull

/**
 * JsonElement accessor helpers matching Swift's JSONValue extensions.
 * We do NOT port the Swift JSONValue enum — kotlinx's JsonElement already
 * models arbitrary JSON subtrees (rawGame envelopes, `ai_decision_trace`,
 * `ai_audit_payload`, ...). These keep call-site ergonomics identical.
 */

/** Object key lookup; null for non-objects. */
operator fun JsonElement?.get(key: String): JsonElement? = (this as? JsonObject)?.get(key)

val JsonElement?.stringValue: String?
    get() = (this as? JsonPrimitive)?.takeIf { it.isString }?.content

val JsonElement?.arrayValue: List<JsonElement>?
    get() = this as? JsonArray

val JsonElement?.objectValue: Map<String, JsonElement>?
    get() = this as? JsonObject

/** Int or truncated double (Swift `.int(i)` / `Int(d)`). Quoted numbers stay strings → null. */
val JsonElement?.intValue: Int?
    get() {
        val prim = (this as? JsonPrimitive)?.takeUnless { it.isString } ?: return null
        return prim.intOrNull ?: prim.doubleOrNull?.toInt()
    }

val JsonElement?.boolValue: Boolean?
    get() = (this as? JsonPrimitive)?.takeUnless { it.isString }?.booleanOrNull

// Only used for copy/paste display; kotlinx doesn't sort keys like the Swift
// encoder did — acceptable per the parity doc.
private val PrettyJson = Json { prettyPrint = true }

val JsonElement?.prettyPrinted: String
    get() {
        val el = this ?: return "{}"
        return runCatching { PrettyJson.encodeToString(JsonElement.serializer(), el) }.getOrDefault("{}")
    }
