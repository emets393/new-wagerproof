import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Syncs the WagerProof Member role to profiles.subscription_active for every
// user who linked Discord, every 4h via pg_cron job 53. Add/remove role by
// Discord user id; users who linked but never joined the guild 404 here and
// land in `failed` — they get the role at the first backfill after joining.

const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const DISCORD_GUILD_ID = Deno.env.get("DISCORD_GUILD_ID")!;
const DISCORD_ROLE_ID = Deno.env.get("DISCORD_ROLE_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function roleRequest(method: "PUT" | "DELETE", discordUserId: string): Promise<{ status: number; ok: boolean; body: string }> {
  const url = `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordUserId}/roles/${DISCORD_ROLE_ID}`;
  let res = await fetch(url, { method, headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } });

  if (res.status === 429) {
    const retryAfter = parseFloat(res.headers.get("retry-after") || "2");
    await new Promise(r => setTimeout(r, (retryAfter + 0.5) * 1000));
    res = await fetch(url, { method, headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } });
  }

  const body = res.ok ? "" : (await res.text()).slice(0, 140);
  return { status: res.status, ok: res.ok, body };
}

Deno.serve(async (_req: Request) => {
  // Get ALL users who have linked Discord (both active and inactive)
  const { data: users, error } = await supabase
    .from("profiles")
    .select("display_name, discord_user_id, subscription_active")
    .not("discord_user_id", "is", null);

  if (error) {
    console.error("DB error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let added = 0;
  let removed = 0;
  const failures: Array<{ name: string | null; discord_user_id: string; wanted: string; status: number; body: string }> = [];

  for (const user of users) {
    const wanted = user.subscription_active ? "add" : "remove";
    const result = await roleRequest(user.subscription_active ? "PUT" : "DELETE", user.discord_user_id);

    if (result.ok) {
      if (user.subscription_active) added++;
      else removed++;
    } else {
      failures.push({
        name: user.display_name ?? null,
        discord_user_id: user.discord_user_id,
        wanted,
        status: result.status,
        body: result.body,
      });
    }

    // 1.5s between calls to avoid rate limits
    await new Promise(r => setTimeout(r, 1500));
  }

  const summary = { total: users.length, roles_added: added, roles_removed: removed, failed: failures.length };
  console.log("Discord backfill:", JSON.stringify(summary));
  // Per-user failure detail so "who isn't getting the role and why" is
  // answerable from logs — 404 Unknown Member = linked but not in the guild.
  for (const f of failures) {
    console.warn("Discord backfill failure:", JSON.stringify(f));
  }

  return new Response(JSON.stringify({ ...summary, failures }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
