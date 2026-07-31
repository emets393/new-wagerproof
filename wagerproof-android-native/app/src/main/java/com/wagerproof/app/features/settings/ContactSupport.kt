package com.wagerproof.app.features.settings

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast

/** Support inbox — same address iOS mails from Settings and the side menu. */
internal const val CONTACT_EMAIL = "admin@wagerproof.bet"

/**
 * Open the user's mail client on our support address.
 *
 * Deliberately NOT `LocalUriHandler.openUri("mailto:…")`: AndroidUriHandler
 * converts the `ActivityNotFoundException` a mail-app-less device throws into an
 * uncaught `IllegalArgumentException`, so tapping "Contact Us" crashes the app.
 * iOS's `openURL` silently no-ops in the same situation, so we fire the explicit
 * `ACTION_SENDTO` intent ourselves and, when nothing handles it, surface the
 * address instead of dying.
 *
 * [subject] differs per entry point (Settings vs. side menu) on iOS too — pass
 * the caller's own string rather than sharing one.
 */
internal fun openContactEmail(context: Context, subject: String) {
    val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$CONTACT_EMAIL"))
        .putExtra(Intent.EXTRA_SUBJECT, subject)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    if (runCatching { context.startActivity(intent) }.isSuccess) return

    // No mail client. Put the address somewhere the user can act on it.
    runCatching {
        context.getSystemService(ClipboardManager::class.java)
            ?.setPrimaryClip(ClipData.newPlainText("WagerProof support", CONTACT_EMAIL))
    }
    Toast.makeText(
        context,
        "No email app found. Copied $CONTACT_EMAIL to your clipboard.",
        Toast.LENGTH_LONG,
    ).show()
}
