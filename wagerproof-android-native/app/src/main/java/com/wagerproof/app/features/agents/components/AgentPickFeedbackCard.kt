package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.wagerproof.app.features.props.PropHoneydewBanner
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentBetItem
import com.wagerproof.core.services.AgentPickFeedbackNotSignedIn
import com.wagerproof.core.services.AgentPickFeedbackService
import kotlinx.coroutines.launch

/**
 * Android port of Honeydew's recipe-detail "How did we do?" card and the iOS
 * `AgentPickFeedbackCard`. Same coral [PropHoneydewBanner] chrome and
 * Report → Submit → Thanks alerts; writes to `agent_pick_feedback`.
 */
@Composable
fun AgentPickFeedbackCard(
    userId: String?,
    agent: Agent,
    items: List<AgentBetItem>,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
    var showReportDialog by remember { mutableStateOf(false) }
    var showThanksDialog by remember { mutableStateOf(false) }
    var reportDescription by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }

    PropHoneydewBanner(
        title = "How did we do?",
        subtitle = "Tap to report a mistake",
        actionWord = "Report",
        primary = Color(1.00f, 0.25f, 0.30f),
        secondary = Color(1.00f, 0.62f, 0.50f),
        symbols = listOf(
            "exclamationmark.bubble.fill",
            "exclamationmark.triangle.fill",
            "questionmark.circle.fill",
            "bubble.left.and.bubble.right.fill",
            "hand.raised.fill",
            "flag.fill",
            "tray.fill",
            "envelope.fill",
            "checkmark.bubble.fill",
            "ellipsis.bubble.fill",
        ),
        onTap = { showReportDialog = true },
        modifier = modifier,
    )

    if (showReportDialog) {
        AlertDialog(
            onDismissRequest = {
                showReportDialog = false
                reportDescription = ""
            },
            title = { Text("Report an Issue") },
            text = {
                Column {
                    Text("What went wrong with this agent's picks?")
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = reportDescription,
                        onValueChange = { reportDescription = it },
                        placeholder = { Text("Describe the issue (optional)...") },
                        singleLine = false,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                TextButton(
                    enabled = !isSubmitting,
                    onClick = {
                        if (isSubmitting) return@TextButton
                        isSubmitting = true
                        showReportDialog = false
                        val description = reportDescription.trim()
                        reportDescription = ""
                        scope.launch {
                            try {
                                val uid = userId ?: throw AgentPickFeedbackNotSignedIn()
                                AgentPickFeedbackService.submit(
                                    userId = uid,
                                    agent = agent,
                                    items = items,
                                    userDescription = description,
                                )
                                showThanksDialog = true
                            } catch (_: Exception) {
                                // Match Honeydew — no explicit error when the write fails.
                            } finally {
                                isSubmitting = false
                            }
                        }
                    },
                ) { Text("Submit") }
            },
            dismissButton = {
                TextButton(onClick = {
                    showReportDialog = false
                    reportDescription = ""
                }) { Text("Cancel") }
            },
            containerColor = AppColors.appSurfaceElevated,
        )
    }

    if (showThanksDialog) {
        AlertDialog(
            onDismissRequest = { showThanksDialog = false },
            title = { Text("Thanks for the feedback.") },
            text = { Text("We will review this agent's picks ASAP and implement fixes for next time.") },
            confirmButton = {
                TextButton(onClick = { showThanksDialog = false }) { Text("Ok") }
            },
            containerColor = AppColors.appSurfaceElevated,
        )
    }
}
