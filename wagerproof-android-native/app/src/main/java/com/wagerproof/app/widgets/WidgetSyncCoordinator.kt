package com.wagerproof.app.widgets

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.SystemClock
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.wagerproof.core.services.OutliersWidgetService
import com.wagerproof.core.services.SupabaseClients
import com.wagerproof.core.services.TopAgentsWidgetService
import com.wagerproof.core.services.runCatchingCancellable
import com.wagerproof.widgets.AgentMonitorWidgetReceiver
import com.wagerproof.widgets.TopOutliersWidgetReceiver
import com.wagerproof.widgets.WagerproofWidgets
import io.github.jan.supabase.auth.auth
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Main-process widget bridge. Network work happens here while the authenticated
 * app is foregrounded; Glance widgets remain lightweight cache readers.
 */
object WidgetSyncCoordinator {
    private const val PERIODIC_WORK_NAME = "wagerproof-widget-sync"
    private const val FOREGROUND_COALESCE_MS = 60_000L
    private val syncMutex = Mutex()
    private val identityLock = Any()
    private var lastSyncElapsedMs = 0L
    private var lastSyncedUserId: String? = null
    private var lastSyncedDomains = InstalledDomains(agents = false, outliers = false)
    private var activeUserId: String? = null
    private var identityGeneration = 0L
    private var activeSyncJob: Job? = null

    internal data class InstalledDomains(
        val agents: Boolean,
        val outliers: Boolean,
    ) {
        val any: Boolean get() = agents || outliers

        fun covers(required: InstalledDomains): Boolean =
            (!required.agents || agents) && (!required.outliers || outliers)

        operator fun plus(other: InstalledDomains): InstalledDomains = InstalledDomains(
            agents = agents || other.agents,
            outliers = outliers || other.outliers,
        )
    }

    fun schedule(context: Context) {
        val workManager = WorkManager.getInstance(context)
        if (!installedDomains(context).any) {
            workManager.cancelUniqueWork(PERIODIC_WORK_NAME)
            return
        }
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val request = PeriodicWorkRequestBuilder<WidgetSyncWorker>(1, TimeUnit.HOURS)
            .setConstraints(constraints)
            .build()
        workManager.enqueueUniquePeriodicWork(
            PERIODIC_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }

    /**
     * Refresh both widget domains. The fetches run concurrently, but both write
     * into the SAME `widgetPayload` blob, so their read-modify-writes are
     * serialized by `WidgetPayloadStore`'s mutex — otherwise an interleave
     * reverts one domain's slice to the previous hour's data (iOS solves the same
     * hazard by merging into one write in `App/WidgetSyncCoordinator.swift`).
     */
    suspend fun syncAll(
        context: Context,
        userId: String,
        allowInitialIdentity: Boolean = false,
    ) {
        val requestedGeneration = authorizeSync(userId, allowInitialIdentity) ?: return
        syncMutex.withLock {
            if (!isAuthorized(userId, requestedGeneration)) return@withLock
            val syncJob = currentCoroutineContext()[Job]
            synchronized(identityLock) { activeSyncJob = syncJob }
            try {
                performSync(context, userId)
            } finally {
                synchronized(identityLock) {
                    if (activeSyncJob === syncJob) activeSyncJob = null
                }
            }
        }
    }

    private suspend fun performSync(context: Context, userId: String) {
        val domains = installedDomains(context)
        if (!domains.any) return

        val now = SystemClock.elapsedRealtime()
        if (lastSyncedUserId == userId && lastSyncElapsedMs > 0L &&
            now - lastSyncElapsedMs < FOREGROUND_COALESCE_MS &&
            lastSyncedDomains.covers(domains)
        ) {
            WagerproofWidgets.updateAll(context)
            return
        }

        val succeeded = supervisorScope {
            val agents = if (domains.agents) {
                async { runCatchingCancellable { TopAgentsWidgetService.sync(userId) } }
            } else {
                null
            }
            val outliers = if (domains.outliers) {
                async { runCatchingCancellable { OutliersWidgetService.sync() } }
            } else {
                null
            }
            InstalledDomains(
                agents = agents?.await()?.isSuccess == true,
                outliers = outliers?.await()?.isSuccess == true,
            )
        }

        if (succeeded.any) {
            val canMerge = lastSyncedUserId == userId && lastSyncElapsedMs > 0L &&
                now - lastSyncElapsedMs < FOREGROUND_COALESCE_MS
            lastSyncedDomains = if (canMerge) lastSyncedDomains + succeeded else succeeded
            lastSyncedUserId = userId
            lastSyncElapsedMs = SystemClock.elapsedRealtime()
        }

        // Always ask Glance to re-read the shared payload. A failed domain sync
        // intentionally leaves its last successful cached slice intact.
        WagerproofWidgets.updateAll(context)
    }

    internal fun hasInstalledWidgets(context: Context): Boolean = installedDomains(context).any

    /**
     * Clear account-scoped payload data and re-render without starting fetches.
     * Used before account attach and after sign-out so RemoteViews never bridge
     * identities while auth/RevenueCat network work is pending.
     */
    suspend fun clearUserScopedWidgets(context: Context, nextUserId: String?) {
        val jobToCancel = synchronized(identityLock) {
            activeUserId = nextUserId
            identityGeneration += 1
            activeSyncJob
        }
        jobToCancel?.cancel(CancellationException("Widget identity changed"))
        syncMutex.withLock {
            lastSyncedUserId = null
            lastSyncElapsedMs = 0L
            lastSyncedDomains = InstalledDomains(agents = false, outliers = false)
            TopAgentsWidgetService.clearCached()
            if (installedDomains(context).any) WagerproofWidgets.updateAll(context)
        }
    }

    /** Re-render existing caches after an entitlement-only state change. */
    suspend fun refreshCachedWidgets(context: Context) = syncMutex.withLock {
        if (installedDomains(context).any) WagerproofWidgets.updateAll(context)
    }

    private fun authorizeSync(userId: String, allowInitialIdentity: Boolean): Long? =
        synchronized(identityLock) {
            if (allowInitialIdentity && identityGeneration == 0L && activeUserId == null) {
                activeUserId = userId
            }
            identityGeneration.takeIf { activeUserId == userId }
        }

    private fun isAuthorized(userId: String, generation: Long): Boolean =
        synchronized(identityLock) {
            activeUserId == userId && identityGeneration == generation
        }

    private fun installedDomains(context: Context): InstalledDomains {
        val manager = AppWidgetManager.getInstance(context)
        fun has(receiver: Class<*>): Boolean = manager.getAppWidgetIds(
            ComponentName(context, receiver),
        ).isNotEmpty()
        return InstalledDomains(
            agents = has(AgentMonitorWidgetReceiver::class.java),
            outliers = has(TopOutliersWidgetReceiver::class.java),
        )
    }
}

/** Hourly authenticated refresh; no session simply defers to the next run. */
class WidgetSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        if (!WidgetSyncCoordinator.hasInstalledWidgets(applicationContext)) {
            return Result.success()
        }
        val auth = SupabaseClients.main.auth
        runCatchingCancellable { auth.awaitInitialization() }
        val userId = auth.currentSessionOrNull()?.user?.id ?: return Result.success()
        return runCatchingCancellable {
            WidgetSyncCoordinator.syncAll(
                applicationContext,
                userId,
                allowInitialIdentity = true,
            )
            Result.success()
        }.getOrElse { Result.retry() }
    }
}
