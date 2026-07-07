package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * Port of iOS `LearnWagerProofStore.swift` (mirrors RN
 * `contexts/LearnWagerProofContext.tsx`). A single global walkthrough store
 * driving one sheet presented from the tab shell; invoked from many screens
 * (game cards, agents, side menu, analytics tabs).
 *
 * The "seen" flag is stored under the verbatim RN AsyncStorage key so a future
 * migration can read it. Per the rebuild plan, the sheet is NOT auto-presented
 * on first launch (RN's auto-open is commented out).
 */
@Stable
class LearnWagerProofStore {

    /**
     * The six on-screen walkthrough slides, matching the RN `SLIDES` array.
     * [slideIndex] is the carousel start position when a caller opens by topic.
     */
    enum class Topic(val raw: String, val slideIndex: Int) {
        CreateAgent("createAgent", 0),
        GameCards("gameCards", 1),
        GameDetails("gameDetails", 2),
        WagerBot("wagerBot", 3),
        Outliers("outliers", 4),
        MoreFeatures("moreFeatures", 5);

        companion object {
            const val totalSlides: Int = 6
        }
    }

    // MARK: - State

    /** Drives the sheet. null = closed. */
    var activeTopic by mutableStateOf<Topic?>(null)

    /** Current slide index inside the sheet. */
    var currentSlide by mutableStateOf(0)

    // MARK: - Sheet lifecycle

    /** Open the sheet at a specific topic, seeding the slide from [Topic.slideIndex]. */
    fun openSheet(topic: Topic = Topic.CreateAgent) {
        currentSlide = topic.slideIndex
        activeTopic = topic
    }

    fun closeSheet() {
        activeTopic = null
    }

    // MARK: - Slide navigation

    fun nextSlide() {
        currentSlide = minOf(currentSlide + 1, Topic.totalSlides - 1)
    }

    fun prevSlide() {
        currentSlide = maxOf(currentSlide - 1, 0)
    }

    fun goToSlide(index: Int) {
        if (index < 0 || index >= Topic.totalSlides) return
        currentSlide = index
    }

    /** True on the last slide — drives the "Done" vs "Next" trailing button label. */
    val isLastSlide: Boolean get() = currentSlide == Topic.totalSlides - 1

    // MARK: - "Seen" persistence (RN markAsSeen / checkIfSeen)

    fun markAsSeen() {
        StorePrefs.appGroup.edit().putBoolean(SEEN_STORAGE_KEY, true).apply()
    }

    fun hasBeenSeen(): Boolean = StorePrefs.appGroup.getBoolean(SEEN_STORAGE_KEY, false)

    private companion object {
        // RN AsyncStorage key — preserved verbatim.
        const val SEEN_STORAGE_KEY = "@wagerproof_has_seen_learn_sheet"
    }
}
