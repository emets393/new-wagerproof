// Shared runtime helpers for the Trigger.dev tasks (generateV3Picks +
// dailyAutoGenV3): the service-role Supabase client for the agent_generation_runs
// ledger, and the daily $-spend guard that replaces v3_circuit_state.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getTodayInET } from "./shared/dateUtils";

export function ledgerClient(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

// Trigger.dev has no native cost cap, so we keep the spend guard as a check
// against the agent_generation_runs ledger (engine_version='v3_trigger', today ET).
export const DAILY_SPEND_CAP_USD = Number(process.env.V3_DAILY_SPEND_CAP_USD ?? "25");
const ASSUMED_COST_PER_INFLIGHT_USD = 0.05;

export async function isOverDailySpendCap(main: SupabaseClient): Promise<boolean> {
  const today = getTodayInET();
  const { data, error } = await main
    .from("agent_generation_runs")
    .select("estimated_cost_usd, status")
    .eq("engine_version", "v3_trigger")
    .eq("target_date", today);
  if (error || !data) return false; // fail-open: never block runs on a guard query error
  let committed = 0;
  let inflight = 0;
  for (const row of data as { estimated_cost_usd: number | null; status: string }[]) {
    committed += Number(row.estimated_cost_usd ?? 0);
    if (row.status === "processing" || row.status === "queued" || row.status === "leased") inflight += 1;
  }
  return committed + inflight * ASSUMED_COST_PER_INFLIGHT_USD >= DAILY_SPEND_CAP_USD;
}
