package com.wagerproof.app.features.games

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Buckets the games feed into per-day sections so the home list can render a
 * date header above each group. iOS `Games/GameDateGrouping`.
 *
 * Ordering: date sections ascending by `yyyy-MM-dd` (ET); the user's chosen
 * sort mode is preserved as the within-section order (bucketing is stable).
 */
object GameDateGrouping {

    data class Section<Item>(val key: String, val label: String, val items: List<Item>)

    fun <Item> group(
        items: List<Item>,
        key: (Item) -> String,
        label: (Item) -> String,
    ): List<Section<Item>> {
        val buckets = LinkedHashMap<String, Pair<String, MutableList<Item>>>()
        for (item in items) {
            val k = key(item)
            val bucket = buckets.getOrPut(k) { label(item) to mutableListOf() }
            bucket.second.add(item)
        }
        return buckets.keys.sorted().mapNotNull { k ->
            val bucket = buckets[k] ?: return@mapNotNull null
            Section(k, bucket.first, bucket.second)
        }
    }

    private val ET: ZoneId = ZoneId.of("America/New_York")
    private val KEY_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")
    private val DATETIME_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")

    /**
     * Parse ISO8601 (with/without fractional seconds), `yyyy-MM-dd`, or
     * `yyyy-MM-dd HH:mm:ss` into a stable Eastern-Time `yyyy-MM-dd` key.
     */
    fun dateKey(raw: String): String {
        if (raw.isEmpty()) return raw
        // Offset date-time (ISO8601 with zone/offset, fractional tolerated).
        runCatching { OffsetDateTime.parse(raw) }.getOrNull()?.let {
            return it.atZoneSameInstant(ET).format(KEY_FMT)
        }
        // Plain date.
        runCatching { LocalDate.parse(raw) }.getOrNull()?.let { return it.format(KEY_FMT) }
        // "yyyy-MM-dd HH:mm:ss" (treated as ET wall time).
        runCatching { LocalDateTime.parse(raw, DATETIME_FMT) }.getOrNull()?.let {
            return it.atZone(ET).format(KEY_FMT)
        }
        return raw
    }
}
