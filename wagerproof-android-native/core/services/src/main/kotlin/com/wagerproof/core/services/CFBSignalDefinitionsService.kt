package com.wagerproof.core.services

import com.wagerproof.core.models.CFBSignalDefinition
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull

/**
 * Signal glossary for CFB betting signals — whole-table `cfb_signal_defs`
 * fetch, cached once per process. Each row is indexed under MANY normalized
 * aliases (source / signal_key / signal_name / slug / id / display_name +
 * hardcoded legacy display strings) because callers hold whichever raw label
 * their table happened to store.
 */
class CFBSignalDefinitionsService {

    private val mutex = Mutex()
    private var cached: Map<String, CFBSignalDefinition>? = null

    suspend fun definitionsBySource(): Map<String, CFBSignalDefinition> {
        mutex.withLock {
            cached?.let { return it }
            // Errors cache an empty map — a flaky glossary must not retry-storm.
            val rows = runCatching {
                SupabaseClients.cfb
                    .from("cfb_signal_defs")
                    .select()
                    .decodeList<JsonObject>()
            }.getOrNull() ?: run {
                cached = emptyMap()
                return emptyMap()
            }

            val out = mutableMapOf<String, CFBSignalDefinition>()
            for (raw in rows) {
                val row = SignalDefRow(raw)
                val definition = row.model
                for (key in row.matchKeys) {
                    for (candidate in normalizedCandidates(key)) {
                        out[candidate] = definition
                    }
                }
            }
            cached = out
            return out
        }
    }

    /**
     * Column types in `cfb_signal_defs` are inconsistent (string|int|double|
     * bool), so every field goes through a flexible string coercion — the
     * Kotlin analog of Swift's `FlexibleText` wrapper.
     */
    private class SignalDefRow(obj: JsonObject) {
        val id: String? = flexText(obj, "id")
        val source: String? = flexText(obj, "source")
        val signalKey: String? = flexText(obj, "signal_key")
        val signalName: String? = flexText(obj, "signal_name")
        val slug: String? = flexText(obj, "slug")
        val displayName: String =
            flexText(obj, "display_name") ?: source ?: signalKey ?: signalName ?: "Signal"
        val oneLiner: String? = flexText(obj, "one_liner")
        val definition: String? = flexText(obj, "definition")
        val whyItWorks: String? = flexText(obj, "why_it_works")
        val betDirection: String? = flexText(obj, "bet_direction")
        val typicalHit: String? = flexText(obj, "typical_hit")

        val matchKeys: List<String>
            get() {
                val baseKeys = listOfNotNull(source, signalKey, signalName, slug, id, displayName)
                    .filter { it.isNotEmpty() }
                return baseKeys + legacyAliases(signalKey)
            }

        // Legacy tables stored full display strings; map them back to the key.
        private fun legacyAliases(signalKey: String?): List<String> = when (signalKey) {
            "key_dog" -> listOf("KEY dog +2.5/3/3.5 (HOME dog)", "KEY dog +2.5/3/3.5")
            "key_lay_fav" -> listOf("KEY lay-fav -6.5", "KEY favorite -6.5")
            "backup_qb_under" -> listOf("T2 under: backup QB (open>=50)", "backup QB under")
            "h1_total" -> listOf("1H total (pruned tempo model)", "1H total")
            "h1_ml" -> listOf("1H ML (dog-conversion, track-live)", "1H ML")
            "h1_spread" -> listOf("1H spread (model)", "1H spread")
            "team_total" -> listOf("team total (model)", "team total")
            "conf_bigten_road_fav" -> listOf("CONF BigTen away-fav cover", "BigTen away-fav cover")
            "premium_lay_fav" -> listOf("PREMIUM lay-fav", "premium lay fav")
            "soft_book_gap" -> listOf("soft-book gap", "soft book gap")
            "rvr_home" -> listOf("RvR home-dog", "ranked vs ranked home dog")
            else -> emptyList()
        }

        val model: CFBSignalDefinition
            get() {
                val key = source ?: signalKey ?: signalName ?: slug ?: id ?: displayName
                return CFBSignalDefinition(
                    signalKey = signalKey,
                    sourceKey = key,
                    displayName = displayName,
                    oneLiner = oneLiner,
                    definition = definition,
                    whyItWorks = whyItWorks,
                    betDirection = betDirection,
                    typicalHit = typicalHit,
                )
            }
    }

    companion object {
        val shared = CFBSignalDefinitionsService()

        private val nonAlphanumeric = Regex("[^a-z0-9]+")

        fun normalize(value: String): String {
            val lower = value.trim().lowercase()
                .replace("_", " ")
                .replace("-", " ")
            return lower.replace(nonAlphanumeric, " ")
                .split(" ")
                .filter { it.isNotEmpty() }
                .joinToString(" ")
        }

        fun definition(
            rawKey: String,
            definitions: Map<String, CFBSignalDefinition>,
        ): CFBSignalDefinition? {
            val candidates = normalizedCandidates(rawKey)
            for (candidate in candidates) {
                definitions[candidate]?.let { return it }
            }
            legacySignalKey(rawKey)?.let { legacyKey ->
                definitions[normalize(legacyKey)]?.let { return it }
            }

            // Last resort: fuzzy contains scan (long candidates only, so short
            // tokens like "over" can't grab an unrelated definition).
            return definitions.entries.firstOrNull { (key, definition) ->
                candidates.contains(normalize(definition.sourceKey)) ||
                    candidates.contains(normalize(definition.displayName)) ||
                    candidates.any { candidate ->
                        candidate.length > 6 && (key.contains(candidate) || candidate.contains(key))
                    }
            }?.value
        }

        /** Match variants: full string, before "(", before/after ":", split on "/". */
        fun normalizedCandidates(value: String): List<String> {
            val trimmed = value.trim()
            val candidates = mutableListOf(normalize(trimmed))

            val open = trimmed.indexOf('(')
            if (open >= 0) candidates.add(normalize(trimmed.substring(0, open)))

            val colon = trimmed.indexOf(':')
            if (colon >= 0) {
                candidates.add(normalize(trimmed.substring(0, colon)))
                candidates.add(normalize(trimmed.substring(colon + 1)))
            }

            candidates.addAll(trimmed.split("/").filter { it.isNotEmpty() }.map { normalize(it) })

            val seen = mutableSetOf<String>()
            return candidates.filter { it.isNotEmpty() && seen.add(it) }
        }

        /** ~30-entry fuzzy mapping of legacy display strings to signal keys — port verbatim. */
        fun legacySignalKey(rawKey: String): String? {
            val key = normalize(rawKey)
            if (key.startsWith("team total")) return "team_total"
            if (key.contains("t2 high edge dog")) return "model_highedge_dog"
            if (key.contains("t3 away") && key.contains("p5 edge")) return "model_road_value"
            if (key.contains("t3 fade home backup qb")) return "fade_home_backup_qb"
            if (key.contains("sos fade padded road")) return "padded_road_fade"
            if (key.contains("g5 fade top2 post loss")) return "g5_fade_after_loss"
            if (key.contains("stack model gap")) return "stack"
            if (key.contains("sb volume gap")) return "soft_book_gap"
            if (key.contains("premium lay fav")) return "premium_lay_fav"
            if (key.contains("key dog")) return "key_dog"
            if (key.contains("key lay")) return "key_lay_fav"
            if (key.contains("rvr ranked vs ranked")) return "rvr_home"
            if (key.contains("conf bigten away fav")) return "conf_bigten_road_fav"
            if (key.contains("conf sunbelt fade")) return "conf_sunbelt_fade"
            if (key.contains("conf aac total")) return "conf_aac_over"
            if (key.contains("conf sunbelt total")) return "conf_sunbelt_under"
            if (key.contains("form over hot fade")) return "form_over_hot_under"
            if (key.contains("total fade high")) return "fade_high_total"
            if (key.contains("total fade low")) return "fade_low_total"
            if (key.contains("total model over edge") && key.contains("g5")) return "model_total_over_pace"
            if (key.contains("total model over edge")) return "model_total_over"
            if (key.contains("t1 under model high total weakd")) return "model_total_under"
            if (key.contains("ranked upset")) return "ranked_upset_letdown_under"
            if (key.contains("pt rr letdown")) return "primetime_rivalry_letdown_under"
            if (key.contains("backup qb") && key.contains("under")) return "backup_qb_under"
            if (key.contains("1h spread")) return "h1_spread"
            if (key.contains("1h total")) return "h1_total"
            if (key.contains("1h ml")) return "h1_ml"
            return null
        }

        /**
         * string|int|double|bool → string; absent/null → null; whole doubles
         * drop the ".0" (Swift `d.rounded() == d ? String(Int(d)) : String(d)`);
         * non-primitives → "" (matches Swift FlexibleText's else branch).
         */
        private fun flexText(obj: JsonObject, key: String): String? {
            val el = obj[key] ?: return null
            if (el is JsonNull) return null
            val prim = el as? JsonPrimitive ?: return ""
            if (prim.isString) return prim.content
            prim.intOrNull?.let { return it.toString() }
            prim.doubleOrNull?.let { d ->
                return if (d == Math.rint(d) && d.isFinite()) d.toInt().toString() else d.toString()
            }
            prim.booleanOrNull?.let { return if (it) "true" else "false" }
            return ""
        }
    }
}
