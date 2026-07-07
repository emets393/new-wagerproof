package com.wagerproof.core.services

import android.content.pm.ApplicationInfo
import com.wagerproof.core.shared.AppGroup

/**
 * Replacement for iOS `#if DEBUG` gates. Library modules don't get a useful
 * BuildConfig.DEBUG (it tracks the library's own build type, not the app's),
 * so debug-only features key off the installed app's debuggable flag instead.
 */
object BuildFlags {
    val isDebugBuild: Boolean
        get() = runCatching {
            (AppGroup.context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        }.getOrDefault(false)
}
