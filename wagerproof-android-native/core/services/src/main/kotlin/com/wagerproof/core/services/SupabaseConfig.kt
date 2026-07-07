package com.wagerproof.core.services

/**
 * Anon keys and URLs are public client-side constants (mirrors the RN code in
 * wagerproof-mobile/services/supabase.ts and services/collegeFootballClient.ts,
 * and iOS SupabaseConfig.swift). Row-level security on Supabase gates
 * everything; the key alone grants no authority. Deliberately NOT moved into a
 * secrets mechanism — keep them visible so this client matches the RN and iOS
 * clients byte-for-byte.
 */
object SupabaseConfig {
    /** Main project — auth, user data, chat threads, agents, Polymarket cache. */
    object Main {
        const val URL = "https://gnjrklxotmbvnxbnnqgq.supabase.co"
        const val ANON_KEY =
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ"
    }

    /** CFB / research project — all predictions & sports data. No auth ever (anon RLS). */
    object CFB {
        const val URL = "https://jpxnjuwglavsjbgbasnl.supabase.co"
        const val ANON_KEY =
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo"
    }
}
