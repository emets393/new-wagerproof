package com.wagerproof.app.widgets

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.wagerproof.core.services.OutliersWidgetService
import com.wagerproof.core.services.TopAgentsWidgetService
import com.wagerproof.core.services.SupabaseClients
import com.wagerproof.widgets.WagerproofWidgets
import io.github.jan.supabase.auth.auth
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.async
import kotlinx.coroutines.supervisorScope

/**
 * Main-process widget bridge. Network work happens here while the authenticated
 * app is foregrounded; Glance widgets remain lightweight cache readers.
 */
object WidgetSyncCoordinator {
    private const val PERIODIC_WORK_NAME = "wagerproof-widget-sync"

    fun schedule(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val request = PeriodicWorkRequestBuilder<WidgetSyncWorker>(1, TimeUnit.HOURS)
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            PERIODIC_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }

    suspend fun syncAll(context: Context, userId: String) = supervisorScope {
        val agents = async { runCatching { TopAgentsWidgetService.sync(userId) } }
        val outliers = async { runCatching { OutliersWidgetService.sync() } }
        agents.await()
        outliers.await()

        // Always ask Glance to re-read the shared payload. A failed domain sync
        // intentionally leaves its last successful cached slice intact.
        WagerproofWidgets.updateAll(context)
    }
}

/** Hourly authenticated refresh; no session simply defers to the next run. */
class WidgetSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val auth = SupabaseClients.main.auth
        runCatching { auth.awaitInitialization() }
        val userId = auth.currentSessionOrNull()?.user?.id ?: return Result.success()
        return runCatching {
            WidgetSyncCoordinator.syncAll(applicationContext, userId)
            Result.success()
        }.getOrElse { Result.retry() }
    }
}
