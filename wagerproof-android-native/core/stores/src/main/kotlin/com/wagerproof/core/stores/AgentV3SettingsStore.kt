package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * Port of iOS `AgentV3SettingsStore.swift` (doc §8.8). Local DEBUG tuning for
 * the V3 agentic generation engine (Secret Settings). Persists to
 * [StorePrefs.standard]; no network. `AgentDetailStore.generatePicks`
 * constructs a fresh instance to read the persisted values — cheap because
 * init is just two defaults reads.
 */
@Stable
class AgentV3SettingsStore {
    private object Key {
        const val DRY_RUN = "agent_v3.dry_run"
        const val MODEL = "agent_v3.model"
    }

    /** Dry run: server runs the full loop + records the trace but writes NO picks. */
    private var _dryRun by mutableStateOf(false)
    val dryRun: Boolean get() = _dryRun
    private var _model by mutableStateOf(models[0])
    val model: String get() = _model

    init {
        val d = StorePrefs.standard
        _dryRun = d.getBoolean(Key.DRY_RUN, false)
        // Stored value may be a retired id — snap back to the current default
        // rather than sending a dead model name.
        val stored = d.getString(Key.MODEL, null)
        _model = stored?.takeIf { models.contains(it) } ?: models[0]
    }

    fun setDryRun(value: Boolean) {
        _dryRun = value
        StorePrefs.standard.edit().putBoolean(Key.DRY_RUN, value).apply()
    }

    fun setModel(value: String) {
        _model = value
        StorePrefs.standard.edit().putString(Key.MODEL, value).apply()
    }

    val snapshot: Map<String, String>
        get() = mapOf("dry_run" to if (dryRun) "true" else "false", "model" to model)

    companion object {
        /**
         * Model ids the V3 worker understands (resolveProvider keys off the
         * `deepseek` prefix). Order = picker order. Old deepseek-reasoner/-chat
         * aliases are retired.
         */
        val models = listOf("deepseek-v4-flash", "deepseek-v4-pro")
    }
}
