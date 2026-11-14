package com.wagerproof.core.models

/**
 * ROI pulled out of a free-text record, in percentage points.
 *
 * `typical_hit` and `season_record_text` are prose. Real values include
 * `+52.7% ROI`, `+11-16% ROI`, and `3-1 (75.0%) in 2026-27, +43.2% ROI`.
 * A range averages. A hit-rate percent that is not labeled ROI is ignored.
 */
object SignalRoi {
    private val clause = Regex(
        """([+\u2212\-−])?\s*([0-9]+(?:\.[0-9]+)?)(?:\s*[-–—]\s*([0-9]+(?:\.[0-9]+)?))?\s*%\s*ROI\b""",
        RegexOption.IGNORE_CASE,
    )

    fun percent(raw: String?): Double? {
        if (raw.isNullOrEmpty()) return null
        val match = clause.find(raw) ?: return null
        val first = match.groupValues[2].toDoubleOrNull() ?: return null
        val second = match.groupValues.getOrNull(3)?.toDoubleOrNull()
        var value = if (second != null) (first + second) / 2 else first
        val sign = match.groupValues.getOrNull(1)
        if (!sign.isNullOrEmpty() && sign != "+") value = -value
        return value.takeIf { it.isFinite() }
    }
}
