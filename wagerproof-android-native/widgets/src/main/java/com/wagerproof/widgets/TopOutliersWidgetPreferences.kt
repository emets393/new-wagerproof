package com.wagerproof.widgets

import android.content.Context

/** Per-instance market selection for the configurable Top Outliers widget. */
internal object TopOutliersWidgetPreferences {
    private const val PREFS_NAME = "top_outliers_widget_preferences"
    private const val MARKET_PREFIX = "market_"

    fun selectedMarketId(context: Context, appWidgetId: Int): String? =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString("$MARKET_PREFIX$appWidgetId", null)

    fun selectMarket(context: Context, appWidgetId: Int, marketId: String?) {
        val editor = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
        if (marketId == null) {
            editor.remove("$MARKET_PREFIX$appWidgetId")
        } else {
            editor.putString("$MARKET_PREFIX$appWidgetId", marketId)
        }
        editor.apply()
    }

    fun clear(context: Context, appWidgetId: Int) {
        selectMarket(context, appWidgetId, null)
    }
}
