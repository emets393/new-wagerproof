package com.wagerproof.app.features.analytics.historical

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MlbPitcherOption

/**
 * Starter picker used twice in the MLB Pitching sheet (team SP / opposing SP).
 * Selected pitchers stay pinned above the search field; the caller owns the
 * catalog so both instances share one fetch.
 */
@Composable
internal fun MlbPitcherTypeahead(
    label: String,
    selected: List<MlbPitcherOption>,
    catalog: List<MlbPitcherOption>,
    isLoading: Boolean,
    loadFailed: Boolean,
    onChange: (List<MlbPitcherOption>) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val results = remember(query, catalog) { MlbPitcherSearch.filter(catalog, query) }

    SheetSection(label) {
        selected.forEach { pitcher ->
            Row(
                Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(AppColors.appSurfaceMuted)
                    .padding(start = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f).padding(vertical = 8.dp)) {
                    Text(pitcher.name, color = AppColors.appTextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    val subtitle = MlbPitcherSearch.subtitle(pitcher)
                    if (subtitle.isNotEmpty()) {
                        Text(subtitle, color = AppColors.appTextSecondary, fontSize = 12.sp)
                    }
                }
                IconButton(onClick = { onChange(selected.filterNot { it.id == pitcher.id }) }) {
                    Icon(Icons.Rounded.Close, "Remove ${pitcher.name}", Modifier.size(16.dp))
                }
            }
        }

        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            label = { Text("Search pitchers… (accents optional)") },
            leadingIcon = { Icon(Icons.Rounded.Search, null) },
            trailingIcon = {
                when {
                    isLoading -> CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    query.isNotEmpty() -> IconButton(onClick = { query = "" }) {
                        Icon(Icons.Rounded.Close, "Clear search", Modifier.size(16.dp))
                    }
                    else -> Unit
                }
            },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        when {
            loadFailed && catalog.isEmpty() ->
                SheetCaption("Couldn't load pitchers — pull to refresh and reopen this sheet.")
            results.isNotEmpty() -> Column(
                Modifier.fillMaxWidth().heightIn(max = 260.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                results.forEach { pitcher ->
                    val alreadyPicked = selected.any { it.id == pitcher.id }
                    Row(
                        Modifier.fillMaxWidth()
                            .clickable(enabled = !alreadyPicked) {
                                onChange(selected + pitcher)
                                query = ""
                            }
                            .padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            pitcher.name,
                            color = if (alreadyPicked) AppColors.appTextMuted else AppColors.appTextPrimary,
                            fontSize = 15.sp,
                            modifier = Modifier.weight(1f),
                        )
                        Text(MlbPitcherSearch.subtitle(pitcher), color = AppColors.appTextSecondary, fontSize = 12.sp)
                    }
                }
            }
            query.isNotBlank() && !isLoading && catalog.isNotEmpty() -> SheetCaption("No pitchers match")
        }
    }
}
