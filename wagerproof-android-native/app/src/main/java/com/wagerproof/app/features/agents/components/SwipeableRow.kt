package com.wagerproof.app.features.agents.components

import androidx.compose.ui.graphics.Color

/**
 * One action revealed by a row's swipe gesture — port of iOS `SwipeableRow.swift`.
 * A small data carrier so the Agents list can build its leading/trailing action
 * sets once and map them to swipe buttons.
 */
data class RowSwipeAction(
    val id: String,
    val title: String,
    val systemImage: String,
    val tint: Color,
    val action: () -> Unit,
)
