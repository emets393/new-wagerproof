package com.wagerproof.app.features.analytics.historical

import java.text.Normalizer

/**
 * Diacritic + case folding for the filter pickers, so "Jose" finds "José" and
 * "usc" finds "USC". Port of iOS `folding(options: [.diacriticInsensitive,
 * .caseInsensitive])`.
 *
 * Its own file (no Compose imports) so the pure search logic that depends on it
 * stays loadable from a plain JVM unit test.
 */
internal fun foldForSearch(value: String): String =
    Normalizer.normalize(value, Normalizer.Form.NFD)
        .replace(COMBINING_MARKS, "")
        .lowercase()

private val COMBINING_MARKS = Regex("\\p{Mn}+")
