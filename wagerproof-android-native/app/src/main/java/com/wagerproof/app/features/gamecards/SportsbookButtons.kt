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

/**
 * Book key → the brand's real name. Titlecasing the bare key ships
 * "Draftkings" / "Pointsbetus" / "Wynnbet", which reads as a bug to anyone who
 * has used the app. Copied verbatim from iOS `SportsbookButtons.swift`.
 */
private val TOP_BOOKS = listOf(
    "draftkings" to "DraftKings",
    "fanduel" to "FanDuel",
    "betmgm" to "BetMGM",
    "caesars" to "Caesars",
    "pointsbetus" to "PointsBet",
)
private val ADDITIONAL_BOOKS = listOf(
    "bovada" to "Bovada",
    "betrivers" to "BetRivers",
    "wynnbet" to "WynnBET",
    "unibet" to "Unibet",
    "foxbet" to "FOX Bet",
    "hardrockbet" to "Hard Rock Bet",
)

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
        val ordered = orderedBooks(betslipLinks.keys)
        ModalBottomSheet(
            onDismissRequest = { sheetVisible = false },
            sheetState = sheetState,
            containerColor = AppColors.appSurfaceElevated,
        ) {
            Text(
                "Select Sportsbook",
                color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(16.dp),
            )
            LazyColumn {
                items(ordered, key = { it.first }) { (key, name) ->
                    Row(
                        Modifier.fillMaxWidth().clickable {
                            betslipLinks[key]?.let { uriHandler.openUri(it) }
                            sheetVisible = false
                        }.padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        SportsbookLogoView(key, null, SportsbookLogoStyle.COMPACT)
                        Spacer(Modifier.width(12.dp))
                        Text(name, color = AppColors.appTextPrimary, fontSize = 15.sp)
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

/**
 * Top books → additional books → unknown tail, each paired with its display
 * name. The tail is sorted (iOS sorts the `Set` difference before mapping);
 * without that the order came out of a `Set` and reshuffled between openings.
 */
fun orderedBooks(keys: Set<String>): List<Pair<String, String>> {
    val byLower = keys.associateBy { it.lowercase(Locale.US) }
    val result = mutableListOf<Pair<String, String>>()
    (TOP_BOOKS + ADDITIONAL_BOOKS).forEach { (bookKey, name) ->
        byLower[bookKey]?.let { result.add(it to name) }
    }
    val taken = result.mapTo(HashSet()) { it.first }
    keys.filterNot { it in taken }.sorted().forEach { result.add(it to titlecaseKey(it)) }
    return result
}

/** Fallback for a book we have no brand name for — iOS uppercases the first letter only. */
private fun titlecaseKey(key: String): String =
    key.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.US) else it.toString() }
