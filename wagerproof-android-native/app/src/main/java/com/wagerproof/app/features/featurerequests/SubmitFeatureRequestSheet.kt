package com.wagerproof.app.features.featurerequests

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.stores.FeatureRequestsStore
import kotlinx.coroutines.launch

/**
 * Port of iOS `SubmitFeatureRequestSheet.swift`. Title + multiline Description
 * fields, inline [FeatureRequestsStore.lastError], Cancel / Submit (spinner,
 * disabled until both fields trimmed-non-empty). Dismisses on success.
 */
@Composable
fun SubmitFeatureRequestSheet(
    store: FeatureRequestsStore,
    userId: String,
    displayName: String?,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    val canSubmit = title.isNotBlank() && description.isNotBlank() && !store.isSubmitting

    fun submit() {
        scope.launch {
            val ok = store.submit(title = title, description = description, userId = userId, displayName = displayName)
            if (ok) onDismiss()
        }
    }

    Column(
        modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(Spacing.lg),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        // Toolbar row: Cancel / title / Submit.
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onDismiss) { Text("Cancel", color = AppColors.appTextPrimary) }
            Spacer(Modifier.weight(1f))
            Text("Submit Feature Request", style = AppTypography.headline, color = AppColors.appTextPrimary)
            Spacer(Modifier.weight(1f))
            TextButton(onClick = { submit() }, enabled = canSubmit) {
                if (store.isSubmitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = AppColors.appPrimary,
                    )
                } else {
                    Text("Submit", fontWeight = FontWeight.SemiBold, color = if (canSubmit) AppColors.appPrimary else AppColors.appTextMuted)
                }
            }
        }

        Text("Title", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary)
        OutlinedTextField(
            value = title,
            onValueChange = { title = it },
            placeholder = { Text("Brief description of your feature idea") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
            modifier = Modifier.fillMaxWidth(),
            colors = fieldColors(),
        )

        Text("Description", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary)
        OutlinedTextField(
            value = description,
            onValueChange = { description = it },
            placeholder = { Text("Provide more details about your feature request…") },
            minLines = 4,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Default),
            modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
            colors = fieldColors(),
        )
        Text(
            "Share your ideas to help us improve WagerProof. Our team will review pending submissions.",
            style = AppTypography.caption,
            color = AppColors.appTextMuted,
        )

        store.lastError?.let { err ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = AppIcon.fromSystemName("exclamationmark.triangle.fill")!!.imageVector,
                    contentDescription = null,
                    tint = AppColors.appAccentAmber,
                    modifier = Modifier.size(14.dp),
                )
                Text(err, style = AppTypography.caption, color = AppColors.appAccentAmber)
            }
        }
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = AppColors.appPrimary,
    unfocusedBorderColor = AppColors.appBorder,
    focusedTextColor = AppColors.appTextPrimary,
    unfocusedTextColor = AppColors.appTextPrimary,
    cursorColor = AppColors.appPrimary,
)
