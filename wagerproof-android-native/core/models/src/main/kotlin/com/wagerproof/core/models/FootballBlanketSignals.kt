package com.wagerproof.core.models

/**
 * Pipeline scaffolding keys that fire on nearly every game.
 * Never render as per-game signal chips / feed badges.
 */
object FootballBlanketSignals {
    val nfl: Set<String> = setOf("sides_model")
    val cfb: Set<String> = setOf("model_lean", "opener_under", "rivalry_week_over")

    fun isBlanket(sport: String, key: String): Boolean {
        val normalized = key.trim()
        if (normalized.isEmpty()) return true
        return when (sport.lowercase()) {
            "nfl" -> normalized in nfl
            "cfb" -> normalized in cfb
            else -> false
        }
    }

    fun displayKeys(sport: String, keys: Iterable<String>): List<String> {
        val seen = linkedSetOf<String>()
        for (key in keys) {
            val trimmed = key.trim()
            if (trimmed.isEmpty() || isBlanket(sport, trimmed)) continue
            seen += trimmed
        }
        return seen.toList()
    }
}
