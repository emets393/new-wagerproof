package com.wagerproof.app.di

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.compositionLocalOf
import com.wagerproof.app.AppGraph

/**
 * Compose access to the app's DI graph — the Android analog of iOS's
 * `@Environment(SomeStore.self)` reads. iOS injects ~20 stores individually;
 * here a single [LocalAppGraph] carries the whole graph and callers pull the
 * store they need via [appGraph] (or the convenience accessors below).
 *
 * All graph stores are `@Stable` and expose Compose state via `by
 * mutableStateOf`, so reading `appGraph().games.someState` inside a composable
 * subscribes to recomposition directly — no StateFlow/collectAsState wrapping.
 */
val LocalAppGraph = compositionLocalOf<AppGraph> {
    error("LocalAppGraph not provided — wrap content in ProvideAppGraph { }")
}

/** Convenience accessor mirroring how iOS feature code reaches for a store. */
@Composable
@ReadOnlyComposable
fun appGraph(): AppGraph = LocalAppGraph.current
