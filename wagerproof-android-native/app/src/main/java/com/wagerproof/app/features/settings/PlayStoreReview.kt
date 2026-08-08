package com.wagerproof.app.features.settings

import android.content.Context
import android.content.Intent
import android.net.Uri

/** Production application id; debug builds use a suffix that has no listing. */
internal const val PLAY_STORE_APP_ID = "com.wagerproof.mobile"

/** Opens the native Play listing when available, then falls back to the web. */
internal fun openPlayStoreListing(context: Context) {
    val marketIntent = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("market://details?id=$PLAY_STORE_APP_ID"),
    )
        .setPackage("com.android.vending")
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    if (runCatching { context.startActivity(marketIntent) }.isSuccess) return

    val webIntent = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("https://play.google.com/store/apps/details?id=$PLAY_STORE_APP_ID"),
    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { context.startActivity(webIntent) }
}
