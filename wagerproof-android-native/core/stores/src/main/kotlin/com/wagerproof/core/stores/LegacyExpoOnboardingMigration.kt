package com.wagerproof.core.stores

import android.database.sqlite.SQLiteDatabase
import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.shared.AppGroupKey
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

/**
 * One-way bridge from the retired Expo Android app's AsyncStorage database.
 *
 * The Expo and native release apps both use `com.wagerproof.mobile`, so a Play
 * upgrade preserves Expo's `RKStorage` SQLite database. AsyncStorage 2.2.0
 * stores values in `catalystLocalStorage(key TEXT PRIMARY KEY, value TEXT NOT
 * NULL)`. We read that database directly instead of depending on React Native
 * in the native app.
 *
 * Native SharedPreferences always win when the per-user key exists. In
 * particular, `false` is an intentional reset tombstone and must never be
 * resurrected by an old Expo `true`. Legacy state is consulted only when the
 * native key is absent, and only an explicit completion signal is imported.
 * Missing databases, missing keys, malformed queue JSON, and read failures all
 * remain incomplete so genuinely new users still enter onboarding.
 */
internal object LegacyExpoOnboardingMigration {
    private const val DATABASE_NAME = "RKStorage"
    private const val TABLE_NAME = "catalystLocalStorage"
    private const val KEY_COLUMN = "key"
    private const val VALUE_COLUMN = "value"
    private const val COMPLETION_KEY_PREFIX = "@wagerproof/onboarding-completed/"
    private const val OFFLINE_QUEUE_KEY = "@wagerproof/offline-queue"

    internal data class Decision(
        val isComplete: Boolean,
        val shouldPersistNativeCompletion: Boolean,
    )

    private data class LegacySnapshot(
        val completionRaw: String? = null,
        val offlineQueueRaw: String? = null,
    )

    /**
     * Resolve completion synchronously before RootRouter chooses its phase.
     * The query is one indexed lookup against an existing app-private database;
     * the database is opened read-only and is never created or modified here.
     */
    fun resolve(userId: String): Boolean {
        val nativeKey = AppGroupKey.onboardingComplete(userId)
        val prefs = StorePrefs.appGroup
        val nativeValue = if (prefs.contains(nativeKey)) {
            prefs.getBoolean(nativeKey, false)
        } else {
            null
        }

        // Avoid touching SQLite for every native launch and, critically, make
        // an explicit false reset authoritative over stale Expo state.
        if (nativeValue != null) return nativeValue

        val legacy = readLegacySnapshot(userId)
        val decision = decide(
            nativeValue = null,
            legacyCompletionRaw = legacy.completionRaw,
            legacyOfflineQueueRaw = legacy.offlineQueueRaw,
            userId = userId,
        )
        if (decision.shouldPersistNativeCompletion) {
            prefs.edit().putBoolean(nativeKey, true).apply()
        }
        return decision.isComplete
    }

    /** Pure policy seam used by focused upgrade/reset/new-user tests. */
    internal fun decide(
        nativeValue: Boolean?,
        legacyCompletionRaw: String?,
        legacyOfflineQueueRaw: String?,
        userId: String,
    ): Decision {
        if (nativeValue != null) {
            return Decision(
                isComplete = nativeValue,
                shouldPersistNativeCompletion = false,
            )
        }

        val legacyCompleted = legacyCompletionRaw == "true" ||
            queueContainsOnboardingCompletion(legacyOfflineQueueRaw, userId)
        return Decision(
            isComplete = legacyCompleted,
            shouldPersistNativeCompletion = legacyCompleted,
        )
    }

    private fun readLegacySnapshot(userId: String): LegacySnapshot {
        val databaseFile = AppGroup.context.getDatabasePath(DATABASE_NAME)
        if (!databaseFile.isFile) return LegacySnapshot()

        val completionKey = "$COMPLETION_KEY_PREFIX$userId"
        return try {
            val openParams = SQLiteDatabase.OpenParams.Builder()
                .setOpenFlags(SQLiteDatabase.OPEN_READONLY)
                .build()
            SQLiteDatabase.openDatabase(databaseFile, openParams).use { database ->
                val completionRaw = readValue(database, completionKey)
                // The completion value is tiny and is the normal path. Do not
                // load the potentially much larger offline-queue JSON into a
                // CursorWindow when the direct signal already settles the gate.
                if (completionRaw == "true") {
                    LegacySnapshot(completionRaw = completionRaw)
                } else {
                    LegacySnapshot(
                        completionRaw = completionRaw,
                        offlineQueueRaw = readValue(database, OFFLINE_QUEUE_KEY),
                    )
                }
            }
        } catch (_: Exception) {
            // Never create, delete, repair, or rewrite the retired database.
            // Supabase validation remains the online recovery path.
            LegacySnapshot()
        }
    }

    private fun readValue(database: SQLiteDatabase, key: String): String? = database.query(
        TABLE_NAME,
        arrayOf(VALUE_COLUMN),
        "$KEY_COLUMN = ?",
        arrayOf(key),
        null,
        null,
        null,
        "1",
    ).use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else null
    }

    private fun queueContainsOnboardingCompletion(raw: String?, userId: String): Boolean {
        if (raw.isNullOrBlank()) return false
        return try {
            val queue = Json.parseToJsonElement(raw) as? JsonArray ?: return false
            queue.any { element ->
                val item = element as? JsonObject ?: return@any false
                item["type"]?.jsonPrimitive?.contentOrNull == "onboarding_completion" &&
                    item["userId"]?.jsonPrimitive?.contentOrNull.equals(userId, ignoreCase = true)
            }
        } catch (_: Exception) {
            false
        }
    }
}
