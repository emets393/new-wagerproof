package com.wagerproof.core.services

import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.shared.AppGroupKey

/**
 * Which LLM the WagerBot chat runs on, selectable from a DEBUG picker in the
 * chat's "more options" menu (iOS WagerBotModelSelection.swift).
 *
 * The "default" option routes to the production `wagerbot-chat` edge function
 * (OpenAI Responses API) — unchanged behavior. Every other option routes to
 * the parallel `wagerbot-agent` function (Chat Completions, multi-provider)
 * with the chosen `model`.
 */
data class WagerBotModelOption(
    val id: String,
    /** Human label for the picker. */
    val label: String,
    /** Model id sent to the edge function; null = let the default function decide. */
    val model: String?,
    /** Edge function to call for this option. */
    val functionName: String,
)

object WagerBotModelSelection {
    /** The default routes to the existing production chat untouched. */
    val defaultOption = WagerBotModelOption(
        id = "default",
        label = "Default · GPT-4o (Responses)",
        model = null,
        functionName = "wagerbot-chat",
    )

    // deepseek-chat/-reasoner aliases are retired by DeepSeek after 2026-07-24;
    // a stale stored id falls back to defaultOption via `current`.
    val options: List<WagerBotModelOption> = listOf(
        defaultOption,
        WagerBotModelOption(id = "gpt-4o", label = "GPT-4o (Chat)", model = "gpt-4o", functionName = "wagerbot-agent"),
        WagerBotModelOption(id = "deepseek-v4-flash", label = "DeepSeek V4 Flash", model = "deepseek-v4-flash", functionName = "wagerbot-agent"),
        WagerBotModelOption(id = "deepseek-v4-pro", label = "DeepSeek V4 Pro", model = "deepseek-v4-pro", functionName = "wagerbot-agent"),
    )

    /** Persisted selection id (App Group prefs). Defaults to the production option. */
    var currentId: String
        get() = AppGroup.prefs.getString(AppGroupKey.WAGERBOT_CHAT_MODEL, null) ?: defaultOption.id
        set(value) {
            AppGroup.prefs.edit().putString(AppGroupKey.WAGERBOT_CHAT_MODEL, value).apply()
        }

    /**
     * The resolved option to use for a chat run. iOS gates the override read
     * at the call site with `#if DEBUG`; Kotlin has no compile-time strip, so
     * the gate lives here — release builds always get the production default.
     */
    val current: WagerBotModelOption
        get() {
            if (!BuildFlags.isDebugBuild) return defaultOption
            return options.firstOrNull { it.id == currentId } ?: defaultOption
        }
}
