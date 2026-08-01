package com.wagerproof.widgets

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.GlanceAppWidgetManager
import com.wagerproof.core.models.OutliersWidgetMarketData
import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.shared.AppGroupKey
import com.wagerproof.core.shared.WidgetPayloadStore
import kotlinx.coroutines.launch

/** Android-native per-instance market picker launched by the widget host. */
class TopOutliersWidgetConfigurationActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(Activity.RESULT_CANCELED)

        val appWidgetId = intent?.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID,
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        AppGroup.initialize(applicationContext)
        setContent {
            TopOutliersConfigurationTheme {
                TopOutliersConfigurationScreen(
                    initialMarketId = TopOutliersWidgetPreferences.selectedMarketId(
                        applicationContext,
                        appWidgetId,
                    ),
                    onConfirm = { selectedMarketId ->
                        TopOutliersWidgetPreferences.selectMarket(
                            applicationContext,
                            appWidgetId,
                            selectedMarketId,
                        )
                        val glanceId = GlanceAppWidgetManager(applicationContext)
                            .getGlanceIdBy(appWidgetId)
                        TopOutliersGlanceWidget().update(applicationContext, glanceId)
                        setResult(
                            Activity.RESULT_OK,
                            Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId),
                        )
                        finish()
                    },
                )
            }
        }
    }
}

@Composable
private fun TopOutliersConfigurationTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Color(0xFF7C6BFF),
            background = Color(0xFF090A0E),
            surface = Color(0xFF11131A),
            surfaceVariant = Color(0xFF1A1D27),
            onPrimary = Color.White,
            onBackground = Color(0xFFF4F4F7),
            onSurface = Color(0xFFF4F4F7),
            onSurfaceVariant = Color(0xFFAAADBA),
        ),
        content = content,
    )
}

@Composable
private fun TopOutliersConfigurationScreen(
    initialMarketId: String?,
    onConfirm: suspend (String?) -> Unit,
) {
    var markets by remember { mutableStateOf<List<OutliersWidgetMarketData>?>(null) }
    var selectedMarketId by remember { mutableStateOf(initialMarketId) }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        val isPro = AppGroup.prefs.getBoolean(AppGroupKey.PRO_ENTITLEMENT_GRANTED, false)
        val loaded = WidgetPayloadStore.read().outlierMarkets.filter { market ->
            isPro || market.id != "parlay-god"
        }
        markets = loaded
        selectedMarketId = initialMarketId?.takeIf { id -> loaded.any { it.id == id } }
            ?: loaded.firstOrNull()?.id
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 24.dp),
        ) {
            Text(
                text = "Choose an Outliers market",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = "Each widget can follow a different live market. You can change this later from your launcher.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(20.dp))

            when (val loaded = markets) {
                null -> Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    CircularProgressIndicator()
                }

                else -> if (loaded.isEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text(
                            text = "No markets are cached yet",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = "Open WagerProof to refresh the latest qualifying Outliers markets.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(loaded, key = { it.id }) { market ->
                            MarketChoice(
                                market = market,
                                selected = market.id == selectedMarketId,
                                onSelect = { selectedMarketId = market.id },
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { coroutineScope.launch { onConfirm(selectedMarketId) } },
                enabled = markets != null,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Save widget")
            }
        }
    }
}

@Composable
private fun MarketChoice(
    market: OutliersWidgetMarketData,
    selected: Boolean,
    onSelect: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onSelect),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) {
                MaterialTheme.colorScheme.primary.copy(alpha = 0.18f)
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            },
        ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RadioButton(selected = selected, onClick = onSelect)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = market.title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = "${market.totalCount} live ${if (market.totalCount == 1) "result" else "results"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
