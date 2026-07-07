package com.wagerproof.core.services

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * Date-key helpers. Semantics deliberately differ per service and must NOT be
 * unified (parity doc gotcha #5):
 * - agents use **device-local** yyyy-MM-dd
 * - outliers / MLB use **America/New_York**
 * - LiveScores' NFL run filter uses **UTC**
 */
object ServiceDates {
    val ET: ZoneId = ZoneId.of("America/New_York")

    /** Device-local yyyy-MM-dd (agents' `localDateString`). */
    fun todayLocal(): String = LocalDate.now().toString()

    /** America/New_York yyyy-MM-dd (outliers / MLB report dates). */
    fun todayET(): String = LocalDate.now(ET).toString()

    /** UTC yyyy-MM-dd (LiveScores NFL latest-run filter). */
    fun todayUTC(): String = LocalDate.now(ZoneOffset.UTC).toString()

    fun localDate(daysFromToday: Long): String = LocalDate.now().plusDays(daysFromToday).toString()

    fun etDate(daysFromToday: Long): String = LocalDate.now(ET).plusDays(daysFromToday).toString()

    /** yyyy-MM-dd of an instant in ET (outliers' `formatETDate` output shape). */
    fun etDateString(instant: Instant): String = instant.atZone(ET).toLocalDate().toString()
}
