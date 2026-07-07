package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FlexibleDoubleOrZeroSerializer
import com.wagerproof.core.models.serialization.FlexibleIntOrZeroSerializer
import com.wagerproof.core.models.serialization.FlexibleIntSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.Locale
import kotlin.math.abs
import kotlin.math.floor

/**
 * Aggregated season-to-date record for one signal (`signal_performance` table).
 * `sport` + `signal_key` required; all numerics tolerate Int|String|Double.
 */
@Serializable
data class SignalPerformance(
    val sport: String,
    @SerialName("signal_key") val signalKey: String,
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val season: Int = 0,
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val n: Int = 0,
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val wins: Int = 0,
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val losses: Int = 0,
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val pushes: Int = 0,
    /** Fraction 0–1 (excludes pushes). */
    @SerialName("hit_rate")
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    val hitRate: Double = 0.0,
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    val units: Double = 0.0,
    /** Fraction (0.064 = +6.4% ROI). */
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    val roi: Double = 0.0,
    @SerialName("last_week")
    @Serializable(with = FlexibleIntSerializer::class)
    val lastWeek: Int? = null,
    @SerialName("updated_at")
    val updatedAt: String? = null,
)

/** Client-side formatting for the "This season" line on signal cards. */
class SignalSeasonRecordDisplay(performance: SignalPerformance?) {
    enum class Tone { EMPTY, NEUTRAL, POSITIVE, NEGATIVE }

    val detail: String
    val tone: Tone
    val isSmallSample: Boolean

    init {
        val p = performance
        if (p == null || p.n <= 0) {
            detail = "— (no graded picks yet)"
            tone = Tone.EMPTY
            isSmallSample = false
        } else {
            isSmallSample = p.n < 10
            val record = if (p.pushes > 0) {
                "${p.wins}-${p.losses}-${p.pushes}"
            } else {
                "${p.wins}-${p.losses}"
            }
            val hitStr = String.format(Locale.US, "%.1f%%", p.hitRate * 100)
            val unitsStr = signedUnits(p.units)
            detail = "$record  •  $hitStr  •  $unitsStr"

            tone = when {
                p.units > 0 -> Tone.POSITIVE
                p.units < 0 -> Tone.NEGATIVE
                else -> Tone.NEUTRAL
            }
        }
    }

    private companion object {
        // Swift `.rounded()` = ties away from zero, so ±X.X5 rounds outward.
        fun signedUnits(value: Double): String {
            val scaled = value * 10
            val rounded = (if (scaled >= 0) floor(scaled + 0.5) else -floor(abs(scaled) + 0.5)) / 10
            return when {
                rounded > 0 -> String.format(Locale.US, "+%.1fu", rounded)
                rounded < 0 -> String.format(Locale.US, "-%.1fu", abs(rounded))
                else -> "0.0u"
            }
        }
    }
}
