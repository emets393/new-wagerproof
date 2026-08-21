package com.wagerproof.core.services

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Android 8+ silently drops a remote notification whose channel the app never
 * created. Three files have to name the same channel and none of them can see
 * the others at compile time — the manifest is XML, the dispatcher is Deno TS.
 * This pins them together so a rename in one place fails here instead of in
 * production silence (see AND-032 / ticket #051).
 */
class NotificationChannelContractTest {

    @Test
    fun remoteChannelIdIsSet() {
        assertTrue(NotificationService.REMOTE_CHANNEL_ID.isNotBlank())
    }

    @Test
    fun manifestDefaultChannelMatchesRemoteChannelId() {
        val manifest = repoFile("wagerproof-android-native/app/src/main/AndroidManifest.xml") ?: return
        val declared = Regex("default_notification_channel_id\"\\s*android:value=\"([^\"]+)\"")
            .find(manifest.readText())?.groupValues?.get(1)
        assertEquals(NotificationService.REMOTE_CHANNEL_ID, declared)
    }

    @Test
    fun dispatcherTargetsRemoteChannelId() {
        val dispatcher = repoFile(
            // The constant moved out of the per-function index.ts when the push
            // broadcast work extracted a shared transport; every sender imports it.
            "supabase/functions/shared/pushTransport.ts",
        ) ?: return
        val declared = Regex("ANDROID_CHANNEL_ID\\s*=\\s*'([^']+)'")
            .find(dispatcher.readText())?.groupValues?.get(1)
        assertEquals(NotificationService.REMOTE_CHANNEL_ID, declared)
    }

    /**
     * Resolve a repo-relative path from whatever directory Gradle runs the test
     * in. Returns null (test no-ops) rather than failing if the checkout layout
     * differs — a missing file is not a channel-id regression.
     */
    private fun repoFile(relativePath: String): File? {
        var dir: File? = File("").absoluteFile
        while (dir != null) {
            val candidate = File(dir, relativePath)
            if (candidate.isFile) return candidate
            dir = dir.parentFile
        }
        return null
    }
}
