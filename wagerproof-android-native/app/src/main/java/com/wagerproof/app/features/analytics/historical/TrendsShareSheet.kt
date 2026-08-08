package com.wagerproof.app.features.analytics.historical

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.IosShare
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.graphics.rememberGraphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.HistoricalAnalysisResponse
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.services.runCatchingCancellable
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Share sheet for the current Historical Trends search — port of iOS
 * `HistoricalTrendsShareView`. Users pick what the card is ABOUT (overall, one
 * split side, or one team), swipe between five card designs, and export the
 * visible one through the Android share sheet.
 *
 * Export captures the card that is already composed on screen via a
 * [GraphicsLayer] recording, rather than re-rendering it off-screen the way iOS
 * has to with ImageRenderer. That is deliberate: the on-screen card has its
 * async team logo already loaded, so WYSIWYG holds and no image pre-fetch is
 * needed. The trade-off is that the export resolution is the device's own
 * density (≈935 px wide on a 2.75x phone, comparable to iOS's 3x of 340 pt).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun TrendsShareSheet(
    sport: HistoricalAnalysisSport,
    snapshot: HistoricalAnalysisUISnapshot,
    analysis: HistoricalAnalysisResponse?,
    cfbLogos: Map<String, String>,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = AppColors.appSurface,
    ) {
        if (analysis == null || analysis.overall.n == 0) {
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 40.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Nothing to share yet", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                Text(
                    "No games match this search — widen the filters first.",
                    color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center,
                )
            }
            return@ModalBottomSheet
        }
        TrendsShareSheetContent(sport, snapshot, analysis, cfbLogos)
    }
}

@Composable
private fun TrendsShareSheetContent(
    sport: HistoricalAnalysisSport,
    snapshot: HistoricalAnalysisUISnapshot,
    analysis: HistoricalAnalysisResponse,
    cfbLogos: Map<String, String>,
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val scope = rememberCoroutineScope()
    val styles = remember { TrendsShareStyle.entries.toList() }
    val pagerState = rememberPagerState { styles.size }
    var focus by remember { mutableStateOf<InfographicFocus>(InfographicFocus.Overall) }
    var exporting by remember { mutableStateOf(false) }
    var exportError by remember { mutableStateOf<String?>(null) }

    // One recording layer per visible page; the pager keeps ±1 page composed, so
    // the entry for the current page is always live when Share is tapped.
    val layers = remember { mutableStateMapOf<TrendsShareStyle, GraphicsLayer>() }
    val cardHeights = remember { mutableStateMapOf<TrendsShareStyle, Dp>() }

    val ctx = TrendsShareContext(sport, snapshot, analysis, focus)
    // Team art follows the focus, or a single-team filter when nothing is focused
    // (that search is "about" that team even with the overall number showing).
    val artTeam = (focus as? InfographicFocus.Team)?.team ?: snapshot.teams.singleOrNull()
    val teamArt = remember(artTeam, sport, cfbLogos) { artTeam?.let { trendsTeamArt(sport, it, cfbLogos) } }

    val style = styles[pagerState.currentPage.coerceIn(styles.indices)]
    val pagerHeight by animateDpAsState(cardHeights[style] ?: 620.dp, label = "trendsShareCardHeight")

    Column(Modifier.fillMaxWidth().navigationBarsPadding()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Share Search", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            FocusPicker(ctx, focus) { focus = it }
        }

        Column(
            Modifier.fillMaxWidth().weight(1f, fill = false).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                // Cards are laid out at iOS's 340 pt when there's room, and shrink
                // to fit narrow screens rather than clipping.
                val cardWidth = minOf(340.dp, maxWidth - 32.dp)
                HorizontalPager(
                    state = pagerState,
                    modifier = Modifier.fillMaxWidth().height(pagerHeight + 8.dp),
                    pageSpacing = 8.dp,
                    contentPadding = PaddingValues(horizontal = (maxWidth - cardWidth) / 2),
                ) { page ->
                    val pageStyle = styles[page]
                    val layer = rememberGraphicsLayer()
                    DisposableEffect(pageStyle, layer) {
                        layers[pageStyle] = layer
                        onDispose { if (layers[pageStyle] === layer) layers.remove(pageStyle) }
                    }
                    Box(Modifier.fillMaxWidth().wrapContentHeight(Alignment.Top, unbounded = true)) {
                        TrendsShareCard(
                            style = pageStyle,
                            ctx = ctx,
                            teamArt = teamArt,
                            modifier = Modifier
                                .width(cardWidth)
                                .onSizeChanged { cardHeights[pageStyle] = with(density) { it.height.toDp() } }
                                // Record while drawing so the export is byte-identical
                                // to what the user is looking at.
                                .drawWithContent {
                                    layer.record { this@drawWithContent.drawContent() }
                                    drawLayer(layer)
                                },
                        )
                    }
                }
            }

            Spacer(Modifier.height(10.dp))
            StyleDots(styles, style) { target -> scope.launch { pagerState.animateScrollToPage(styles.indexOf(target)) } }
            Spacer(Modifier.height(4.dp))
            Text(style.displayName, color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            exportError?.let {
                Spacer(Modifier.height(6.dp))
                Text(it, color = AppColors.appAccentAmber, fontSize = 12.sp, textAlign = TextAlign.Center)
            }
            Spacer(Modifier.height(12.dp))
        }

        HorizontalDivider(color = AppColors.appBorder)
        Button(
            onClick = {
                val layer = layers[style] ?: return@Button
                exporting = true
                exportError = null
                scope.launch {
                    val bitmap = runCatchingCancellable { layer.toImageBitmap().asAndroidBitmap() }.getOrNull()
                    val uri = bitmap?.let {
                        withContext(Dispatchers.IO) {
                            runCatchingCancellable { writeShareablePng(context, it, sport, style) }.getOrNull()
                        }
                    }
                    exporting = false
                    if (uri == null) {
                        exportError = "Couldn't build the image — try again."
                        return@launch
                    }
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = "image/png"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        clipData = ClipData.newRawUri("WagerProof trend", uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    // ACTION_SEND only confirms that the chooser launched; it
                    // cannot prove the target completed a share. Do not promote
                    // this into ReviewPromptCoordinator.recordContentShared().
                    runCatching { context.startActivity(Intent.createChooser(send, "Share trend")) }
                        .onFailure { exportError = "No app available to share this." }
                }
            },
            enabled = !exporting && layers.containsKey(style),
            colors = ButtonDefaults.buttonColors(containerColor = AppColors.appPrimary, contentColor = AppColors.appTextInverse),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        ) {
            if (exporting) {
                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = AppColors.appTextInverse)
                Spacer(Modifier.width(8.dp))
            } else {
                Icon(Icons.Rounded.IosShare, null, Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
            }
            Text("Share ${style.displayName}", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

/** Overall / one split side / one team — what the card's headline number describes. */
@Composable
private fun FocusPicker(ctx: TrendsShareContext, focus: InfographicFocus, onSelect: (InfographicFocus) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        Row(
            Modifier
                .clip(RoundedCornerShape(8.dp))
                .clickable { expanded = true }
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                "Showing: ${TrendsShareContext.focusLabel(focus)}",
                color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
            )
            Icon(Icons.Rounded.ExpandMore, null, Modifier.size(16.dp), tint = AppColors.appTextSecondary)
        }
        DropdownMenu(expanded, { expanded = false }) {
            DropdownMenuItem(
                text = { Text("Overall") },
                onClick = { expanded = false; onSelect(InfographicFocus.Overall) },
            )
            ctx.sideChoices().forEach { side ->
                DropdownMenuItem(
                    text = { Text(TrendsShareContext.focusSideLabel(side)) },
                    onClick = { expanded = false; onSelect(InfographicFocus.Side(side)) },
                )
            }
            val teams = ctx.teamChoices()
            if (teams.isNotEmpty()) {
                HorizontalDivider(color = AppColors.appBorder)
                Text(
                    "FOCUS ON A TEAM",
                    color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                )
                teams.forEach { team ->
                    DropdownMenuItem(
                        text = { Text(team) },
                        onClick = { expanded = false; onSelect(InfographicFocus.Team(team)) },
                    )
                }
            }
        }
    }
}

@Composable
private fun StyleDots(styles: List<TrendsShareStyle>, current: TrendsShareStyle, onSelect: (TrendsShareStyle) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
        styles.forEach { style ->
            val selected = style == current
            Box(
                Modifier
                    .width(if (selected) 18.dp else 6.dp)
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(if (selected) AppColors.appPrimary else AppColors.appTextMuted.copy(alpha = .45f))
                    .clickable { onSelect(style) },
            )
        }
    }
}

/**
 * Writes the card to a PNG in the app's cache and hands back a FileProvider uri.
 * Each export overwrites the sport+style file instead of accumulating: a share
 * cache that only grows is a slow storage leak on a feature people use often.
 */
private fun writeShareablePng(
    context: Context,
    bitmap: Bitmap,
    sport: HistoricalAnalysisSport,
    style: TrendsShareStyle,
): android.net.Uri {
    val dir = File(context.cacheDir, "shared-trends").apply { mkdirs() }
    val file = File(dir, "wagerproof-${sport.raw}-${style.name.lowercase()}.png")
    file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}
