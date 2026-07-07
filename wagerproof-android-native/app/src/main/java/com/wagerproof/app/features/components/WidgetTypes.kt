package com.wagerproof.app.features.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Shared widget chrome types — port of the shared declarations in iOS
 * `Components/PinnedWidgetScroll.swift`.
 */

/** Header trailing accessory for [WidgetCollapsingSection]. */
sealed interface WidgetHeaderAccessory {
    data object None : WidgetHeaderAccessory
    /** "Tap"/"Less" + info.circle, driven by an expanded flag. */
    data class TapHint(val expanded: Boolean) : WidgetHeaderAccessory
    /** Chevron that rotates with an expanded flag. */
    data class Chevron(val expanded: Boolean) : WidgetHeaderAccessory
    /** Tinted verdict capsule (e.g. "3 SIGNALS"). */
    data class Verdict(val text: String, val tint: Color) : WidgetHeaderAccessory
}

object WidgetCard {
    val corner = 16.dp
    val hInset = 16.dp
    val gap = 12.dp
}
