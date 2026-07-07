package com.wagerproof.core.design.tokens

import androidx.compose.ui.unit.dp

/**
 * Corner-radius scale — 1:1 with iOS `CornerRadius` in Spacing.swift.
 * Component-specific radii outside the scale (ticket 22, option card 23,
 * office clip 20, folder 18/26, skeleton card 16) stay local to those
 * components, matching iOS.
 */
object CornerRadius {
    val sm = 6.dp
    val md = 10.dp
    val lg = 14.dp
    val xl = 20.dp
    val pill = 999.dp
}
