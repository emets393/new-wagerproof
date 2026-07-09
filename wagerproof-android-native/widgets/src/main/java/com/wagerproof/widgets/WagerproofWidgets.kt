package com.wagerproof.widgets

import android.content.Context
import androidx.glance.appwidget.updateAll

/** Public refresh facade so the app module need not depend on Glance directly. */
object WagerproofWidgets {
    suspend fun updateAll(context: Context) {
        AgentMonitorGlanceWidget().updateAll(context)
        TopOutliersGlanceWidget().updateAll(context)
    }
}
