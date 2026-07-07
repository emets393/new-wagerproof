package com.wagerproof.app.features.games.tools

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.props.PropHoneydewBanner

/**
 * Renders a [SportTool] as the shared gradient promo banner. iOS
 * `Games/Tools/ToolBannerCard` (a `HoneydewOptionCard` wrapper). Reuses the
 * app's existing [PropHoneydewBanner] stand-in. Routing is the caller's concern.
 */
@Composable
fun ToolBannerCard(tool: SportTool, onTap: () -> Unit, modifier: Modifier = Modifier) {
    PropHoneydewBanner(
        title = tool.title,
        subtitle = tool.subtitle,
        actionWord = tool.actionWord,
        primary = tool.primaryColor,
        secondary = tool.secondaryColor,
        symbols = tool.symbols,
        onTap = onTap,
        modifier = modifier,
    )
}
