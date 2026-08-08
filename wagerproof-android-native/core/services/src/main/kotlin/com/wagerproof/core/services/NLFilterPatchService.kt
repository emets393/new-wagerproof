package com.wagerproof.core.services

import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.NLFilterSnapshot
import com.wagerproof.core.models.serialization.WagerproofJson
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

/**
 * Natural-language filter chat for Historical Trends — client for the
 * `nl-filter-patch` edge function on the Main project.
 *
 * The function asks gpt-4o-mini for a filter PATCH, then (because we send
 * `apply: true`) runs the SAME reducer the web app runs client-side and returns
 * the fully validated canonical snapshot. That is why native clients never need
 * a copy of the reducer, and why a bad model output can't produce a wrong query:
 * every op is re-validated server-side before it reaches the snapshot.
 *
 * Port of iOS `HistoricalAnalysisService.submitNLFilterPatch`.
 */
object NLFilterPatchService {

    /** One dimension the reducer actually changed. */
    data class AppliedChange(val dimension: String, val note: String? = null)

    /**
     * Decoded `nl-filter-patch` reply.
     *
     * [snapshot] is the full canonical filter to restore; the four list fields
     * are the user-facing report (what landed, what the reducer refused, what
     * the model couldn't map, what it found ambiguous).
     */
    data class Response(
        val snapshot: JsonObject? = null,
        val applied: List<AppliedChange> = emptyList(),
        val rejected: List<String> = emptyList(),
        val couldntMap: List<String> = emptyList(),
        val ambiguous: List<String> = emptyList(),
        val noChange: Boolean = false,
        val error: String? = null,
    ) {
        companion object {
            /**
             * Lenient decode. Two shapes have to survive here:
             *
             * - `applied` is an array of `{dimension, from, to, note?}` objects,
             *   but `from`/`to` are `unknown` in the reducer (numbers, arrays,
             *   bools…). A strict object decode of those fields used to fail the
             *   whole array, and the UI then reported "didn't catch a filter"
             *   for a perfectly successful patch. Only `dimension` + `note` are
             *   read. A legacy plain `string[]` also decodes.
             * - the error envelope: the function answers `{ error }` with a
             *   non-2xx on auth/validation/model failures.
             */
            fun parse(element: JsonElement?): Response {
                val obj = element as? JsonObject ?: return Response(error = "Unexpected server response")

                val error = (obj["error"] as? JsonPrimitive)?.takeIf { it.isString }?.content
                if (error != null) return Response(error = error)

                return Response(
                    snapshot = obj["snapshot"] as? JsonObject,
                    applied = parseApplied(obj["applied"]),
                    rejected = strings(obj["rejected"]),
                    couldntMap = strings(obj["couldnt_map"]),
                    ambiguous = strings(obj["ambiguous"]),
                    noChange = (obj["noChange"] as? JsonPrimitive)?.booleanOrNull ?: false,
                )
            }

            private fun parseApplied(element: JsonElement?): List<AppliedChange> {
                val array = element as? JsonArray ?: return emptyList()
                return array.mapNotNull { entry ->
                    when (entry) {
                        is JsonObject -> {
                            val dimension = (entry["dimension"] as? JsonPrimitive)
                                ?.takeIf { it.isString }?.content ?: return@mapNotNull null
                            val note = (entry["note"] as? JsonPrimitive)
                                ?.takeIf { it !is JsonNull && it.isString }?.content
                            AppliedChange(dimension, note)
                        }
                        // Backward compatibility with a plain string[] `applied`.
                        is JsonPrimitive -> entry.takeIf { it.isString }?.let { AppliedChange(it.content) }
                        else -> null
                    }
                }
            }

            private fun strings(element: JsonElement?): List<String> =
                (element as? JsonArray)
                    ?.mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content }
                    .orEmpty()
        }
    }

    /**
     * Send one sentence plus the current filter and get back the validated
     * snapshot. [currentFilter] must already be in the canonical web shape —
     * build it with [NLFilterSnapshot.serialize].
     *
     * Throws [EdgeFunctions.NoSessionException] when signed out: the function
     * spends OpenAI credits and rejects anonymous callers with a 401 anyway.
     */
    suspend fun submit(
        sentence: String,
        currentFilter: JsonObject,
        coaches: List<String>,
        referees: List<String>,
        sport: HistoricalAnalysisSport,
    ): Response {
        val token = EdgeFunctions.requireAccessToken()
        val body = buildJsonObject {
            put("sentence", sentence)
            put("currentFilter", currentFilter)
            putJsonArray("coaches") { coaches.forEach { add(JsonPrimitive(it)) } }
            putJsonArray("referees") { referees.forEach { add(JsonPrimitive(it)) } }
            put("sport", sport.raw)
            // apply:true → the function validates + applies server-side and
            // returns the full snapshot, so native clients need no TS reducer.
            put("apply", true)
        }

        val response = EdgeFunctions.post("nl-filter-patch", body.toString(), token)
        val parsed = runCatching { WagerproofJson.parseToJsonElement(response.body) }.getOrNull()
        val decoded = Response.parse(parsed)
        // A non-2xx without a readable `error` field still has to say something
        // — silently reporting "no filters found" for a 500 is the worst outcome.
        if (!response.isSuccess && decoded.error == null) {
            return Response(error = "Filter chat is unavailable right now (${response.status}).")
        }
        return decoded
    }
}
