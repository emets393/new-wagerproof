package com.wagerproof.core.services

import com.wagerproof.core.models.serialization.WagerproofJson
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.functions.Functions
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.serializer.KotlinXSerializer

/**
 * Two Supabase clients, one per project (iOS SupabaseClients.swift +
 * WagerproofAPI.swift folded together per the parity doc).
 *
 * - [main] is the auth + user data + chat threads + Polymarket cache project.
 * - [cfb] is the predictions / sports data project. **No auth ever** — RLS
 *   policies on that project expose the prediction views to the anon role,
 *   so the Auth plugin is deliberately not installed.
 *
 * Session persistence: supabase-kt's Auth plugin persists sessions via
 * SharedPreferences on Android by default (survives process death) — the iOS
 * DEBUG UserDefaults-storage workaround has no Android equivalent problem.
 */
object SupabaseClients {

    val main: SupabaseClient by lazy {
        createSupabaseClient(
            supabaseUrl = SupabaseConfig.Main.URL,
            supabaseKey = SupabaseConfig.Main.ANON_KEY,
        ) {
            defaultSerializer = KotlinXSerializer(WagerproofJson)
            install(Auth)
            install(Postgrest)
            install(Functions)
            install(Realtime)
        }
    }

    val cfb: SupabaseClient by lazy {
        createSupabaseClient(
            supabaseUrl = SupabaseConfig.CFB.URL,
            supabaseKey = SupabaseConfig.CFB.ANON_KEY,
        ) {
            defaultSerializer = KotlinXSerializer(WagerproofJson)
            install(Postgrest)
        }
    }
}
