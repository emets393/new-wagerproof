package com.wagerproof.app.features.gamecards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.wagerproof.core.design.components.LiquidGlassCapsule
import com.wagerproof.core.design.tokens.AppColors
import kotlinx.coroutines.launch

/**
 * Shared full-bleed paging detail engine — port of iOS `GameDetailCarousel.swift`.
 *
 * A [HorizontalPager] over the sport's sorted slate, starting at the tapped
 * game. `beyondViewportPageCount = games.size` pre-builds every page (mirrors
 * the iOS "build all pages" anti-jank decision). A floating matchup chip strip
 * pins to the bottom when the slate has more than one game.
 */
@Composable
fun <G> GameDetailCarousel(
    games: List<G>,
    initialIndex: Int,
    background: @Composable (G) -> Unit,
    chip: @Composable (game: G, selected: Boolean, onTap: () -> Unit) -> Unit,
    page: @Composable (game: G, topInset: Dp, bottomInset: Dp) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (games.isEmpty()) return
    val density = LocalDensity.current
    val safeInsets = WindowInsets.safeDrawing
    val safeTop = with(density) { safeInsets.getTop(density).toDp() }
    val safeBottom = with(density) { safeInsets.getBottom(density).toDp() }
    val pagerState = rememberPagerState(
        initialPage = initialIndex.coerceIn(0, games.lastIndex),
        pageCount = { games.size },
    )
    val scope = rememberCoroutineScope()
    val stripHeight = if (games.size > 1) 44.dp else 0.dp
    // Android draws this route edge-to-edge and supplies its own 44dp floating
    // back control. Unlike SwiftUI's NavigationStack inset, safeTop here is
    // only the status bar, so subtracting 36dp put the date underneath both
    // the clock and back button. Start the hero immediately below that control.
    val heroTopInset = safeTop + 44.dp
    val stripBottomInset = if (safeBottom > 0.dp) safeBottom else 12.dp

    Box(modifier.fillMaxSize()) {
        HorizontalPager(
            state = pagerState,
            beyondViewportPageCount = games.size,
            modifier = Modifier.fillMaxSize(),
        ) { index ->
            page(games[index], heroTopInset, safeBottom + stripHeight + 24.dp)
        }

        // One stationary additive glow sits above the pager. Page-local hero
        // masks are neutral, so only content translates during a swipe while
        // this layer smoothly re-tints when currentPage changes. This mirrors
        // iOS GameDetailCarousel's fixed `.plusLighter` TeamAuraBackground.
        Box(
            Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.36f)
                .graphicsLayer {
                    alpha = 0.9f
                    blendMode = BlendMode.Plus
                    compositingStrategy = CompositingStrategy.Offscreen
                }
                .drawWithContent {
                    drawContent()
                    drawRect(
                        brush = Brush.verticalGradient(
                            0f to Color.White,
                            0.62f to Color.White,
                            1f to Color.Transparent,
                        ),
                        blendMode = BlendMode.DstIn,
                    )
                },
        ) {
            background(games[pagerState.currentPage])
        }

        if (games.size > 1) {
            MatchupChipStrip(
                games = games,
                currentIndex = pagerState.currentPage,
                chip = chip,
                onSelect = { idx -> scope.launch { pagerState.animateScrollToPage(idx) } },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(PaddingValues(start = 14.dp, end = 14.dp, bottom = stripBottomInset)),
            )
        }
    }
}

@Composable
private fun <G> MatchupChipStrip(
    games: List<G>,
    currentIndex: Int,
    chip: @Composable (game: G, selected: Boolean, onTap: () -> Unit) -> Unit,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val listState = rememberLazyListState()
    LaunchedEffect(currentIndex) {
        listState.animateScrollToItem(currentIndex.coerceIn(0, games.lastIndex))
    }
    LiquidGlassCapsule(modifier.height(44.dp)) {
        LazyRow(
            state = listState,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            itemsIndexed(games) { idx, game ->
                chip(game, idx == currentIndex) { onSelect(idx) }
            }
        }
    }
}

/**
 * Matchup chip: awayLogo + "AWY @ HOM" + homeLogo. Current game = appPrimary
 * 20% fill capsule + 0.55 stroke; others clear at 0.7 opacity.
 */
@Composable
fun CarouselMatchupChip(
    awayLogoURL: String?,
    homeLogoURL: String?,
    awayAbbr: String,
    homeAbbr: String,
    selected: Boolean,
    sport: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val bg = if (selected) AppColors.appPrimary.copy(alpha = 0.20f) else androidx.compose.ui.graphics.Color.Transparent
    Row(
        modifier
            .clip(CircleShape)
            .background(bg)
            .then(if (selected) Modifier.border(1.dp, AppColors.appPrimary.copy(alpha = 0.55f), CircleShape) else Modifier)
            .semantics {
                this.selected = selected
                role = Role.Button
            }
            .clickable(onClick = onTap)
            .alpha(if (selected) 1f else 0.7f)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        GameCardTeamAvatar(sport = sport, team = awayAbbr, diameter = 18.dp, logoURL = awayLogoURL)
        Spacer(Modifier.width(5.dp))
        Text("$awayAbbr @ $homeAbbr", color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.width(5.dp))
        GameCardTeamAvatar(sport = sport, team = homeAbbr, diameter = 18.dp, logoURL = homeLogoURL)
    }
}
