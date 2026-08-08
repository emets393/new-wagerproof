package com.wagerproof.core.services

import android.content.Context
import android.content.SharedPreferences
import com.wagerproof.core.shared.AppGroup

/**
 * The services-layer view of iOS's `UserDefaults.standard`.
 *
 * Attribution bookkeeping (Meta's once-per-install registration flag, the fired
 * conversion order ids) is per-app state that widgets must never see, so it does
 * NOT belong in the App Group file. This points at the same `wagerproof_prefs`
 * file `com.wagerproof.core.stores.StorePrefs.standard` uses — :core:services
 * can't depend on :core:stores, hence the duplicated file name. Keep the two in
 * step if either ever moves.
 */
internal object AttributionPrefs {
    private const val STANDARD_FILE = "wagerproof_prefs"

    val standard: SharedPreferences
        get() = AppGroup.context.getSharedPreferences(STANDARD_FILE, Context.MODE_PRIVATE)
}
