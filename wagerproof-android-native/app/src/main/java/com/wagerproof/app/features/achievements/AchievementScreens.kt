package com.wagerproof.app.features.achievements

import android.animation.ValueAnimator
import android.content.ClipData
import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.FileProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.currentStateAsState
import com.airbnb.lottie.compose.*
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.models.*
import com.wagerproof.core.design.tokens.AppColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID

private val MedalGreen = Color(0xFF20C563)
private fun compactDate(value: String): String = runCatching {
    DateTimeFormatter.ofPattern("M/d/yy").format(Instant.parse(value).atZone(ZoneId.systemDefault()))
}.getOrDefault("")

@Composable
fun AchievementDiscovery(modifier: Modifier = Modifier) {
    val store = appGraph().achievements
    var showLibrary by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) { store.refresh() }
    Column(modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Your Collection", color = AppColors.appTextPrimary, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                Text("${store.unlockedCount} of 35 achievements", color = AppColors.appTextSecondary, fontSize = 12.sp)
            }
            TextButton(onClick = { showLibrary = true }) { Text("See All", color = MedalGreen) }
        }
        val recent = store.achievements.filter { it.earned }.sortedByDescending { it.status.earnedAt }.take(6)
        val shelf = recent.ifEmpty { store.achievements.filter { !it.earned }.distinctBy { it.definition.group } }
        Text(if (recent.isEmpty()) "Up Next" else "Recently Unlocked", color = AppColors.appTextSecondary)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            items(shelf, key = { it.id }) { item -> AchievementTile(item, true) { selected = item.id } }
        }
    }
    if (showLibrary) AchievementLibrary { showLibrary = false }
    selected?.let { id -> store.achievements.firstOrNull { it.id == id }?.let { AchievementDetail(it, onDone = { selected = null }) } }
}

@Composable
private fun AchievementTile(item: Achievement, compact: Boolean = false, onClick: () -> Unit) {
    Column(Modifier.width(if (compact) 88.dp else 108.dp).clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
        AchievementThumbnail(item.id, item.earned, Modifier.size(if (compact) 88.dp else 108.dp))
        Text(item.definition.title, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        item.status.earnedAt?.let { Text(compactDate(it), color = AppColors.appTextSecondary, fontSize = if (compact) 9.sp else 11.sp) }
        if (!item.earned) LinearProgressIndicator(progress = { item.fraction }, color = MedalGreen, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
fun AchievementLibrary(onDismiss: () -> Unit) {
    val store = appGraph().achievements
    var selected by remember { mutableStateOf<String?>(null) }
    var filter by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize(), color = AppColors.appSurface) {
            Column(Modifier.safeDrawingPadding().padding(20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = onDismiss) { Text("Back") }
                    Text("Achievements", color = AppColors.appTextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                }
                Text("${store.unlockedCount} / 35 unlocked", color = AppColors.appTextSecondary)
                Row { listOf("All", "Unlocked", "In Progress").forEachIndexed { index, label ->
                    FilterChip(selected = filter == index, onClick = { filter = index }, label = { Text(label) }, modifier = Modifier.padding(end = 5.dp))
                } }
                store.error?.let { Text(it, color = AppColors.appTextSecondary) }
                TextButton(onClick = { scope.launch { store.refresh() } }, enabled = !store.isLoading) { Text(if (store.error == null) "Refresh" else "Retry") }
                LazyColumn(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    AchievementCatalog.groupTitles.forEach { (group, title) ->
                        val groupItems = store.achievements.filter { it.definition.group == group && (filter == 0 || (filter == 1) == it.earned) }
                        if (groupItems.isNotEmpty()) {
                            item { Text(title, color = AppColors.appTextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold) }
                            items(groupItems.chunked(3)) { row ->
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                                    row.forEach { item -> AchievementTile(item) { selected = item.id } }
                                }
                            }
                        }
                    }
                    if (store.achievements.none { filter == 0 || (filter == 1) == it.earned }) item {
                        Text(if (filter == 1) "Your first medal is waiting" else "You've unlocked the whole collection!", color = AppColors.appTextPrimary)
                    }
                }
            }
        }
    }
    selected?.let { id -> store.achievements.firstOrNull { it.id == id }?.let { AchievementDetail(it, onDone = { selected = null }) } }
}

@Composable
fun AchievementDetail(item: Achievement, celebration: Boolean = false, onDone: () -> Unit) {
    val context = LocalContext.current
    val profile = appGraph().auth.profile
    val scope = rememberCoroutineScope()
    var hint by remember(item.id) { mutableStateOf(true) }
    val fingerOffset = remember(item.id) { androidx.compose.animation.core.Animatable(-24f) }
    LaunchedEffect(item.id, hint) {
        if (hint && ValueAnimator.areAnimatorsEnabled()) repeat(3) {
            fingerOffset.animateTo(24f, androidx.compose.animation.core.tween(900))
            fingerOffset.animateTo(-24f, androidx.compose.animation.core.tween(900))
        }
    }
    var shareError by remember { mutableStateOf(false) }
    val lifecycle by LocalLifecycleOwner.current.lifecycle.currentStateAsState()
    Dialog(onDismissRequest = { if (!celebration) onDone() }, properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnBackPress = !celebration, dismissOnClickOutside = false)) {
        Surface(Modifier.fillMaxSize(), color = AppColors.appSurface) {
            Box(Modifier.fillMaxSize()) {
                Column(Modifier.safeDrawingPadding().padding(24.dp).verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(if (celebration) "ACHIEVEMENT UNLOCKED" else "Achievements", color = AppColors.appTextSecondary, fontWeight = FontWeight.Bold)
                    Box(Modifier.fillMaxWidth().height(360.dp)) {
                        AchievementMedal(item.id, item.earned, recipient = profile?.displayName ?: profile?.username ?: "WagerProof", earnedAt = item.status.earnedAt, active = lifecycle.isAtLeast(Lifecycle.State.RESUMED), modifier = Modifier.fillMaxSize(), onInteraction = { hint = false })
                        if (hint) Column(Modifier.align(Alignment.BottomCenter).background(AppColors.appSurface, RoundedCornerShape(16.dp)).padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("☝", modifier = Modifier.offset(x = if (ValueAnimator.areAnimatorsEnabled()) fingerOffset.value.dp else 0.dp), fontSize = 24.sp)
                            Text("Swipe me to rotate", color = AppColors.appTextPrimary, fontSize = 12.sp)
                        }
                    }
                    Text(item.definition.title, color = AppColors.appTextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                    Text(item.definition.requirement, color = AppColors.appTextSecondary, textAlign = TextAlign.Center)
                    if (item.earned) Text("Unlocked ${compactDate(item.status.earnedAt!!)}", color = MedalGreen)
                    else {
                        Text("Not yet earned", color = AppColors.appTextSecondary)
                        LinearProgressIndicator(progress = { item.fraction }, color = MedalGreen, modifier = Modifier.fillMaxWidth())
                    }
                    if (item.earned) OutlinedButton(onClick = { scope.launch {
                        try {
                            val file = withContext(Dispatchers.IO) {
                                val directory = File(context.cacheDir, "shared-achievements").apply { mkdirs() }
                                File(directory, "${item.id}-${UUID.randomUUID()}.png").also { file ->
                                    context.assets.open("achievements/${item.id}.png").use { input -> file.outputStream().use { input.copyTo(it) } }
                                }
                            }
                            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "image/png"; putExtra(Intent.EXTRA_STREAM, uri)
                                putExtra(Intent.EXTRA_TEXT, "I just earned “${item.definition.title}” on WagerProof! 🏆")
                                clipData = ClipData.newRawUri("Achievement", uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            context.startActivity(Intent.createChooser(intent, "Share with a Friend"))
                        } catch (_: Exception) { shareError = true }
                    } }, modifier = Modifier.fillMaxWidth()) { Text("Share with a Friend", color = MedalGreen) }
                    if (shareError) Text("Couldn’t open sharing. Please try again.", color = AppColors.appTextSecondary)
                    Button(onClick = onDone, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = MedalGreen)) { Text(if (celebration) "Continue" else "Done") }
                }
                if (celebration && ValueAnimator.areAnimatorsEnabled()) {
                    val composition by rememberLottieComposition(LottieCompositionSpec.Asset("achievements/confetti.json"))
                    LottieAnimation(composition, iterations = 1, restartOnPlay = false, isPlaying = lifecycle.isAtLeast(Lifecycle.State.RESUMED), modifier = Modifier.fillMaxSize())
                }
            }
        }
    }
}

@Composable
fun OnboardingAchievementsPage() {
    var selected by remember { mutableStateOf("streak-25") }
    val lifecycle by LocalLifecycleOwner.current.lifecycle.currentStateAsState()
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Track skill with achievements!", color = AppColors.appTextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        AchievementMedal(selected, overlaySurface = true, active = lifecycle.isAtLeast(Lifecycle.State.RESUMED), modifier = Modifier.fillMaxWidth().height(280.dp))
        Text(AchievementCatalog.definitions.first { it.id == selected }.title, color = AppColors.appTextPrimary, fontWeight = FontWeight.Bold, fontSize = 22.sp)
        Text("Swipe to spin. Tap a medal below to explore.", color = AppColors.appTextSecondary, fontSize = 12.sp)
        Text("Explore all 35 achievements", color = AppColors.appTextSecondary)
        val ordered = remember { listOf(AchievementCatalog.definitions.first { it.id == "streak-25" }) + AchievementCatalog.definitions.filter { it.id != "streak-25" } }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) { items(ordered, key = { it.id }) { medal ->
            AchievementThumbnail(medal.id, modifier = Modifier.size(70.dp).border(if (selected == medal.id) 2.dp else 0.dp, MedalGreen, RoundedCornerShape(14.dp)).clickable { selected = medal.id })
        } }
    }
}


/** Debug launch fixture: no account binding, RPC calls or persisted unlocks. */
@Composable
fun AchievementPreview(mode: String) {
    if (!com.wagerproof.app.BuildConfig.DEBUG) return
    Surface(Modifier.fillMaxSize(), color = AppColors.appSurface) {
        if (mode == "onboarding") Column(Modifier.safeDrawingPadding().padding(24.dp)) { OnboardingAchievementsPage() }
        else if (mode == "paywall") AchievementMedal("streak-25", interactive = false, overlaySurface = true, modifier = Modifier.fillMaxSize())
        else {
            val locked = mode.startsWith("locked:")
            val id = mode.removePrefix("locked:").removePrefix("celebration:")
            val definition = AchievementCatalog.definitions.firstOrNull { it.id == id } ?: AchievementCatalog.definitions.first()
            AchievementDetail(Achievement(definition, AchievementStatus(definition.id, earnedAt = if (locked) null else "2026-09-09T12:00:00Z")), celebration = mode.startsWith("celebration:"), onDone = {})
        }
    }
}
