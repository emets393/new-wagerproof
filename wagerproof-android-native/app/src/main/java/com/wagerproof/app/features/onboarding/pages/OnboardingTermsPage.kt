package com.wagerproof.app.features.onboarding.pages

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.onboarding.components.onboardingIcon
import com.wagerproof.app.features.onboarding.onboardingPressable
import com.wagerproof.app.features.onboarding.pageEntrance
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors

/**
 * Page 1 — Terms acceptance. Port of iOS `OnboardingTermsPage.swift`. User must
 * scroll the terms to the bottom before the checkbox arms; ticking it enables
 * the shared chrome CTA. Scroll/checkbox state lives on the store (not local
 * state) so the pager's windowed unmounting can't force a re-scroll.
 *
 * Does NOT use OnboardingPageScaffold — the inner terms ScrollView needs a
 * dedicated (weighted) region rather than living inside the scaffold's scroll.
 */
@Composable
fun OnboardingTermsPage(modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val scrollState = rememberScrollState()

    // Reaching the bottom (or non-scrollable short content) arms the checkbox.
    LaunchedEffect(scrollState) {
        snapshotFlow { scrollState.value to scrollState.maxValue }
            .collect { (value, max) ->
                if (max == 0 || value >= max - 4) store.setTermsScrolledToBottom()
            }
    }

    Column(
        modifier = modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Terms and Conditions",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            modifier = Modifier.padding(top = 12.dp, bottom = 12.dp).pageEntrance(0),
        )
        Text(
            text = "Please read through our terms and conditions before continuing",
            fontSize = 16.sp,
            color = Color.White.copy(alpha = 0.8f),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 24.dp).pageEntrance(1),
        )

        AnimatedVisibility(visible = !store.hasScrolledTermsToBottom) {
            Row(
                modifier = Modifier.padding(vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(onboardingIcon("chevron.down"), null, tint = AppColors.appPrimary, modifier = Modifier.size(16.dp))
                Text("Scroll down to continue", fontSize = 14.sp, color = AppColors.appPrimary)
                Icon(onboardingIcon("chevron.down"), null, tint = AppColors.appPrimary, modifier = Modifier.size(16.dp))
            }
        }

        // Scrollable terms body, weighted to fill the space above the checkbox.
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 16.dp)
                .liquidGlassBackground(shape = RoundedCornerShape(12.dp), tint = Color.White.copy(alpha = 0.05f))
                .verticalScroll(scrollState)
                .padding(16.dp)
                .pageEntrance(2),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "Last Updated: October 15, 2025",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.7f),
            )
            termsSections.forEach { section ->
                Text(
                    text = section.title,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.appPrimary,
                    modifier = Modifier.padding(top = 4.dp),
                )
                section.paragraphs.forEach { para ->
                    Text(
                        text = para,
                        fontSize = 14.sp,
                        color = Color.White.copy(alpha = 0.9f),
                        lineHeight = 20.sp,
                    )
                }
            }
        }

        // Checkbox row (folds in the 18+ attestation).
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 8.dp)
                .onboardingPressable { store.setTermsChecked(!store.hasCheckedTerms) }
                .pageEntrance(3),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = onboardingIcon(if (store.hasCheckedTerms) "checkmark.square.fill" else "square"),
                contentDescription = null,
                tint = if (store.hasScrolledTermsToBottom) AppColors.appPrimary else Color.Gray,
                modifier = Modifier.size(24.dp),
            )
            Text(
                text = "I have read and agree to the Terms and Conditions, and confirm I am 18 or older",
                fontSize = 14.sp,
                color = Color.White.copy(alpha = if (store.hasScrolledTermsToBottom) 0.9f else 0.7f),
            )
        }
    }
}

private class TermsSection(val title: String, val paragraphs: List<String>)

// Verbatim legal copy (matches the shipped RN/iOS terms). Bold markdown is
// flattened to plain text — Compose Text has no cheap inline-markdown parse.
private val termsSections: List<TermsSection> = listOf(
    TermsSection(
        "1. Acceptance of the Terms of Service",
        listOf(
            "These terms and conditions of service are entered into by and between you and WagerProof LLC, a Texas limited liability company (\"WagerProof,\" \"Company,\" \"we,\" or \"us\"). The following terms and conditions of service, together with any documents they expressly incorporate by reference (collectively, \"Terms of Service\"), govern your access to and use of https://wagerproof.bet (the \"Website\"), including any content, functionality, and services offered on or through the Website, whether as a guest or a registered user, (collectively, the \"Services\").",
            "Please read the Terms of Service carefully before you start to use the Services. By clicking \"I Accept,\" creating an account, accessing, or using the Services in any manner, you acknowledge that you have read, understood, and agree to be bound and abide by these Terms of Service, including our Privacy Policy.",
        ),
    ),
    TermsSection(
        "2. Nature of Service & Disclaimers",
        listOf(
            "Sports Data Analytics Only: WagerProof provides data-driven sports insights, statistical analysis, and educational tools through proprietary machine learning models and algorithms.",
            "NOT Financial or Betting Advice: WagerProof DOES NOT provide financial advice, investment advice, or direct betting recommendations.",
            "NO GUARANTEES OF ACCURACY OR OUTCOMES: We make no guarantees regarding the accuracy, reliability, or completeness of our data, analytics, predictions, or models.",
            "USER RESPONSIBILITY AND ASSUMPTION OF RISK: You are solely responsible for your own decisions, actions, and any financial gains or losses incurred.",
            "NOT A GAMBLING OPERATOR: WagerProof is not a bookmaker, casino, gambling operator, sportsbook, or a platform for placing bets.",
        ),
    ),
    TermsSection(
        "3. Accessing Services and Account Security",
        listOf("The Services are offered and available only to users who are 18 years of age or older, and reside in the United States or any of its territories or possessions."),
    ),
    TermsSection(
        "4. Subscriptions and Payments",
        listOf(
            "Subscription Plans: We offer various subscription plans with different features and pricing.",
            "Billing: Subscriptions are billed on a recurring basis through our third-party payment processor.",
            "Cancellations and Refunds: You may cancel your subscription at any time.",
        ),
    ),
    TermsSection(
        "5. Prohibited Uses",
        listOf("You may use the Services only for lawful purposes and in accordance with these Terms of Service."),
    ),
    TermsSection(
        "6. Monitoring and Enforcement; Termination",
        listOf("We have the right to terminate or suspend your access to all or part of the Services for any or no reason."),
    ),
    TermsSection(
        "9. Use of Artificial Intelligence",
        listOf("The Services use analytical tools that use artificial intelligence and/or machine learning models. AI may generate incomplete, inaccurate, biased, outdated, or misleading information."),
    ),
    TermsSection(
        "10. Limitation of Liability",
        listOf("To the fullest extent permitted by applicable law, in no event shall WagerProof be liable for damages of any kind."),
    ),
    TermsSection(
        "12. Governing Law and Jurisdiction",
        listOf("All matters relating to the Services shall be governed and construed in accordance with the laws of Texas."),
    ),
    TermsSection(
        "18. Contact Us",
        listOf("Any notices or questions concerning these Terms of Service should be directed to: admin@wagerproof.bet"),
    ),
)
