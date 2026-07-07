package com.wagerproof.app.features.chat

import com.wagerproof.core.models.WagerBotChatWidget

/**
 * Port of iOS `WagerBotPendingActionAdapter.swift`. Adapter seam that maps a
 * chat widget to a display decision. Today every widget is "open the game
 * sheet"; kept as a single dispatch point for future saved-pick / share flows.
 */
object WagerBotPendingActionAdapter {
    data class Decision(val widget: WagerBotChatWidget, val openSheet: Boolean)

    fun build(widget: WagerBotChatWidget): Decision = Decision(widget = widget, openSheet = true)
}
