package com.wagerproof.app.features.gamecards

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import java.util.Locale

private val TOP_BOOKS = listOf("draftkings", "fanduel", "betmgm", "caesars", "pointsbetus")
private val ADDITIONAL_BOOKS = listOf("bovada", "betrivers", "wynnbet", "unibet", "foxbet", "hardrockbet")

/**
 * "Place Bet" CTA — port of iOS `SportsbookButtons.swift`. Hidden when
 * [betslipLinks] is empty. Opens a bottom sheet listing books (top → additional
 * → unknown). Row tap opens the betslip URL.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SportsbookButtons(
    betslipLinks: Map<String, String>,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    if (betslipLinks.isEmpty()) return
    var sheetVisible by remember { mutableStateOf(false) }
    val uriHandler = LocalUriHandler.current

    Row(
        modifier
            .fillMaxWidth()
            .height(if (compact) 32.dp else 44.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(AppColors.appPrimary)
            .clickable { sheetVisible = true },
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(AppIcon.TICKET_FILL.imageVector, null, tint = Color.White, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text("Place Bet", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
    }

    if (sheetVisible) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
        val ordered = orderedKeys(betslipLinks.keys)
        ModalBottomSheet(
            onDismissRequest = { sheetVisible = false },
            sheetState = sheetState,
            containerColor = AppColors.appSurfaceElevated,
        ) {
            Text(
                "Choose a Sportsbook",
                color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(16.dp),
            )
            LazyColumn {
                items(ordered) { key ->
                    Row(
                        Modifier.fillMaxWidth().clickable {
                            betslipLinks[key]?.let { uriHandler.openUri(it) }
                            sheetVisible = false
                        }.padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        SportsbookLogoView(key, null, SportsbookLogoStyle.COMPACT)
                        Spacer(Modifier.width(12.dp))
                        Text(displayName(key), color = AppColors.appTextPrimary, fontSize = 15.sp)
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

private fun orderedKeys(keys: Set<String>): List<String> {
    val lower = keys.associateBy { it.lowercase(Locale.US) }
    val result = mutableListOf<String>()
    (TOP_BOOKS + ADDITIONAL_BOOKS).forEach { b -> lower[b]?.let { result.add(it) } }
    keys.filter { it !in result }.forEach { result.add(it) }
    return result
}

private fun displayName(key: String): String =
    key.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.US) else it.toString() }
