package com.wagerproof.app.features.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.activity.compose.BackHandler
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.stores.AuthStore
import kotlinx.coroutines.launch

/**
 * Delete Account modal — port of iOS `Features/Settings/DeleteAccountView`.
 *
 * The authenticated `delete-own-account` edge function performs the destructive
 * server operation. Failures keep the session intact and remain retryable.
 */
@Composable
fun DeleteAccountScreen(onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    val graph = appGraph()
    val auth = graph.auth
    val scope = rememberCoroutineScope()
    var confirmVisible by remember { mutableStateOf(false) }
    var isDeleting by remember { mutableStateOf(false) }
    var deletionError by remember { mutableStateOf<String?>(null) }

    BackHandler(onBack = onDismiss)

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .padding(top = Spacing.sm),
    ) {
        SettingsSubScreenBar(title = "Danger Zone", onDismiss = onDismiss)

        Column(
            modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.lg),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.xl),
        ) {
            Spacer(Modifier.size(Spacing.lg))

            Box(
                modifier = Modifier
                    .size(100.dp)
                    .background(AppColors.appAccentRed.copy(alpha = 0.15f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = AppIcon.EXCLAMATION_TRIANGLE_FILL.imageVector,
                    contentDescription = null,
                    tint = AppColors.appAccentRed,
                    modifier = Modifier.size(48.dp),
                )
            }

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Spacing.md),
            ) {
                Text(
                    text = "Delete Your Account",
                    style = AppTypography.display,
                    color = AppColors.appTextPrimary,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = "Permanently delete your account and all associated data including your picks, settings, and subscription. This action cannot be undone.",
                    style = AppTypography.body,
                    color = AppColors.appTextSecondary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = Spacing.lg),
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(AppColors.appAccentRed.copy(alpha = 0.1f), RoundedCornerShape(12.dp))
                    .border(1.dp, AppColors.appAccentRed.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                    .padding(Spacing.lg),
                horizontalArrangement = Arrangement.spacedBy(Spacing.md),
            ) {
                Icon(
                    imageVector = AppIcon.INFO_CIRCLE_FILL.imageVector,
                    contentDescription = null,
                    tint = AppColors.appAccentRed,
                )
                Text(
                    text = "You will be logged out immediately and your data will be permanently erased.",
                    style = AppTypography.caption,
                    color = AppColors.appAccentRed,
                )
            }

            deletionError?.let { message ->
                Text(
                    text = message,
                    style = AppTypography.caption,
                    color = AppColors.appAccentRed,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(AppColors.appAccentRed.copy(alpha = 0.1f), RoundedCornerShape(10.dp))
                        .padding(Spacing.md),
                )
            }

            Spacer(Modifier.weight(1f))

            Button(
                onClick = { confirmVisible = true },
                enabled = !isDeleting,
                colors = ButtonDefaults.buttonColors(containerColor = AppColors.appAccentRed),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.sm),
            ) {
                if (isDeleting) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White)
                } else {
                    Text("Delete Account", style = AppTypography.bodyEmphasized, color = Color.White)
                }
            }

            TextButton(onClick = onDismiss, modifier = Modifier.padding(bottom = Spacing.md)) {
                Text("Cancel", color = AppColors.appTextSecondary)
            }
        }
    }

    if (confirmVisible) {
        AlertDialog(
            onDismissRequest = { confirmVisible = false },
            title = { Text("Delete Account") },
            text = {
                Text("Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.")
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmVisible = false
                    isDeleting = true
                    deletionError = null
                    scope.launch {
                        when (val result = auth.deleteAccount()) {
                            AuthStore.AccountDeletionResult.Success -> {
                                runCatching { graph.revenueCat.detachUser() }
                                graph.adminMode.reset()
                                isDeleting = false
                                onDismiss()
                            }
                            is AuthStore.AccountDeletionResult.Failure -> {
                                isDeleting = false
                                deletionError = result.message
                            }
                        }
                    }
                }) {
                    Text("Delete Account", color = AppColors.appAccentRed)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmVisible = false }) { Text("Cancel") }
            },
            containerColor = AppColors.appSurfaceElevated,
        )
    }
}
