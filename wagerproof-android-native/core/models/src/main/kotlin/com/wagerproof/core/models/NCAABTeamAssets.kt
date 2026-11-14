package com.wagerproof.core.models

import java.util.Locale

/**
 * Name → ESPN logo and `team_abbrev` for college basketball. The games slate
 * and the agent tickets both write into this cache; a later install fills
 * gaps instead of replacing the map, because slate names and ranking-table
 * names are not always the same string.
 */
object NCAABTeamAssets {
    private data class Mark(val logo: String?, val abbrev: String?)

    private data class Snapshot(val marks: Map<String, Mark>)

    @Volatile
    private var snapshot = Snapshot(emptyMap())

    fun install(logos: Map<String, String> = emptyMap(), abbrevs: Map<String, String> = emptyMap()) {
        if (logos.isEmpty() && abbrevs.isEmpty()) return
        val next = snapshot.marks.toMutableMap()
        for ((raw, logo) in logos) {
            val key = normalize(raw)
            if (key.isEmpty() || logo.isEmpty()) continue
            val current = next[key]
            next[key] = Mark(logo, current?.abbrev)
        }
        for ((raw, abbrev) in abbrevs) {
            val key = normalize(raw)
            val code = abbrev.trim()
            if (key.isEmpty() || code.isEmpty()) continue
            val current = next[key]
            next[key] = Mark(current?.logo, code)
        }
        snapshot = Snapshot(next)
    }

    fun logo(team: String): String? = resolve(team)?.logo

    fun abbrev(team: String): String? = resolve(team)?.abbrev

    private fun resolve(team: String): Mark? {
        val key = normalize(team)
        if (key.isEmpty()) return null
        val marks = snapshot.marks
        marks[key]?.let { return it }
        if (key.length < 6) return null
        var best: Pair<String, Mark>? = null
        for ((candidate, mark) in marks) {
            if (!candidate.contains(key) && !key.contains(candidate)) continue
            if (best == null || candidate.length > best.first.length) best = candidate to mark
        }
        return best?.second
    }

    private fun normalize(value: String): String = value.trim().lowercase(Locale.US)
}
