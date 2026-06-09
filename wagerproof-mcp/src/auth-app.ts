import { Hono } from "hono";
import type { Env } from "./types";
import { storeGrantRefreshToken, verifyAccessToken } from "./supabase";
import { ICON_PNG_BASE64 } from "./icon";

/**
 * Default (non-API) handler: the OAuth `/authorize` consent page, the OAuth
 * provider redirect-return (`/oauth-return`), the `/callback` that mints the
 * grant, public docs/privacy/terms, the icon, and RFC 9728 metadata. The OAuth
 * provider itself serves /token, /register, and the authorization-server
 * metadata; everything here is the branded "Connect WagerProof" surface.
 *
 * Adapted from the Honeydew connector: Firebase Web SDK → Supabase Web SDK,
 * Firebase ID-token verification → Supabase /auth/v1/user verification.
 */
export const authApp = new Hono<{ Bindings: Env }>();

const AUTHREQ_TTL_SECONDS = 600;
const authReqKey = (ls: string) => `authreq:${ls}`;

// --- /authorize : render the consent + sign-in page ------------------------

authApp.get("/authorize", async (c) => {
  const env = c.env;
  const oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const client = await env.OAUTH_PROVIDER.lookupClient(oauthReq.clientId).catch(() => null);

  // Carry login state in the URL (an opaque `ls` id in KV), not a cookie —
  // cross-site OAuth redirects drop cookies.
  const ls = crypto.randomUUID();
  await env.OAUTH_KV.put(authReqKey(ls), JSON.stringify(oauthReq), {
    expirationTtl: AUTHREQ_TTL_SECONDS,
  });

  const clientName = (client && (client.clientName || client.clientId)) || "an application";

  return c.html(
    renderConsent({
      ls,
      clientName,
      baseUrl: env.MCP_BASE_URL,
      supabaseUrl: env.MAIN_URL,
      supabaseAnonKey: env.MAIN_ANON_KEY,
      enableGoogle: env.GOOGLE_ENABLED === "true",
      enableApple: env.APPLE_ENABLED === "true",
      enableEmail: env.EMAIL_ENABLED !== "false", // email on by default
    }),
  );
});

// --- /oauth-return : land here after a Supabase OAuth (Google/Apple) redirect
// The Supabase Web SDK exchanges the `?code=` for a session client-side (it has
// the PKCE verifier in localStorage from /authorize), then we POST to /callback.

authApp.get("/oauth-return", (c) => {
  return c.html(
    renderOAuthReturn({
      supabaseUrl: c.env.MAIN_URL,
      supabaseAnonKey: c.env.MAIN_ANON_KEY,
    }),
  );
});

// --- /callback : verify the posted Supabase session, complete authorization -

interface CallbackBody {
  ls?: string;
  access_token?: string;
  refresh_token?: string;
}

authApp.post("/callback", async (c) => {
  const env = c.env;
  const body = (await c.req.json().catch(() => ({}))) as CallbackBody;
  const { ls, access_token, refresh_token } = body;

  if (!ls || !access_token || !refresh_token) {
    return c.json({ error: "missing_fields" }, 400);
  }

  const stored = await env.OAUTH_KV.get(authReqKey(ls));
  if (!stored) return c.json({ error: "expired_or_unknown_request" }, 400);
  const oauthReq = JSON.parse(stored);

  // Never trust a client-posted token: verify it against Supabase first.
  let verified;
  try {
    verified = await verifyAccessToken(access_token, env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: "invalid_token", detail: message }, 401);
  }

  // Bind the Supabase refresh token to an opaque grantId in KV; the MCP token
  // only ever carries the grantId.
  const grantId = crypto.randomUUID();
  await storeGrantRefreshToken(grantId, refresh_token, env);

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReq,
    userId: verified.userId,
    metadata: { label: verified.email ?? verified.userId },
    scope: oauthReq.scope,
    props: { userId: verified.userId, grantId, email: verified.email },
  });

  await env.OAUTH_KV.delete(authReqKey(ls));
  return c.json({ redirectTo });
});

// --- favicon + icon --------------------------------------------------------

const ICON_BYTES = (() => {
  const bin = atob(ICON_PNG_BASE64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
})();

authApp.get("/icon.png", (c) =>
  c.body(ICON_BYTES, 200, { "content-type": "image/png", "cache-control": "public, max-age=86400" }),
);
authApp.get("/favicon.ico", (c) =>
  c.body(ICON_BYTES, 200, { "content-type": "image/png", "cache-control": "public, max-age=86400" }),
);

// --- RFC 9728 Protected Resource Metadata (first step of MCP OAuth discovery) -

authApp.get("/.well-known/oauth-protected-resource", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json({
    resource: origin,
    authorization_servers: [origin],
    scopes_supported: ["wagerproof:read", "offline_access"],
    bearer_methods_supported: ["header"],
  });
});

// --- public pages ----------------------------------------------------------

function page(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title><link rel="icon" href="/icon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;800&display=swap" rel="stylesheet" />
<style>
  :root { color-scheme: dark; }
  body { font-family:'Inter',-apple-system,system-ui,sans-serif; color:#E5E7EB; line-height:1.55;
         max-width:44rem; margin:0 auto; padding:3rem 1.25rem 5rem;
         background: radial-gradient(1200px 480px at 50% -10%, #1f2a44 0, #0b0f17 60%) no-repeat, #0b0f17; }
  img.logo { width:64px; height:64px; border-radius:16px; box-shadow:0 4px 20px rgba(99,102,241,.4); }
  h1 { font-weight:800; font-size:1.7rem; margin:1rem 0 .25rem; color:#fff; }
  h2 { font-weight:800; font-size:1.15rem; margin:2rem 0 .5rem; color:#fff; }
  p, li { color:#C7CBD3; }
  a { color:#818cf8; }
  code { background:#111827; border:1px solid #1f2937; border-radius:6px; padding:.1rem .35rem; font-size:.9em; color:#A5B4FC; }
  nav a { margin-right:1rem; font-weight:600; }
  .muted { color:#7B8290; font-size:.85rem; }
  ul { padding-left:1.2rem; }
</style></head><body>${bodyHtml}
<p class="muted" style="margin-top:3rem">WagerProof · <a href="/">Home</a> · <a href="/docs">Docs</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
</body></html>`;
}

authApp.get("/", (c) =>
  c.html(
    page(
      "WagerProof connector",
      `<img class="logo" src="/icon.png" alt="WagerProof" />
       <h1>WagerProof connector</h1>
       <p>Connect your <strong>WagerProof</strong> account to Claude (or another MCP client) and ask about your own AI prediction agents and their track record, plus WagerProof's model estimates and prediction-market odds across NFL, NBA, CFB, NCAAB, and MLB. It is <strong>read-only</strong> and informational — it does not place bets or give betting advice.</p>
       <nav style="margin-top:1.5rem"><a href="/docs">Setup &amp; examples →</a><a href="/privacy">Privacy policy →</a></nav>
       <p class="muted" style="margin-top:1.5rem">MCP endpoint: <code>${c.env.MCP_BASE_URL}/mcp</code></p>`,
    ),
  ),
);

authApp.get("/docs", (c) =>
  c.html(
    page(
      "WagerProof connector — Setup & usage",
      `<img class="logo" src="/icon.png" alt="WagerProof" />
       <h1>WagerProof connector</h1>
       <p>The WagerProof connector lets an AI assistant read your own WagerProof data — your AI prediction agents, their picks and records, the agents you follow, your community activity — and WagerProof's public model estimates and prediction-market odds. It is <strong>read-only</strong> and <strong>informational</strong>: it reports model probabilities and historical results for analysis, and never places bets or gives betting advice.</p>

       <h2>Connect it</h2>
       <ol>
         <li>In Claude, open <strong>Settings → Connectors → Add custom connector</strong>.</li>
         <li>Enter the URL <code>${c.env.MCP_BASE_URL}/mcp</code> and add it.</li>
         <li>Click <strong>Connect</strong>, then sign in with the same account you use in the WagerProof app.</li>
         <li>Approve the read-only access. The WagerProof tools are now available in your chat.</li>
       </ol>

       <h2>Example prompts</h2>
       <ul>
         <li>“How are <strong>my agents</strong> doing this month — win rate and net units?”</li>
         <li>“Show my <strong>contrarian agent's</strong> last 10 picks and how they graded.”</li>
         <li>“What does the <strong>model</strong> estimate for tonight's NBA games — where's the biggest edge vs. the line?”</li>
         <li>“Compare the model's take on <strong>Chiefs vs. Bills</strong> to the prediction-market odds.”</li>
         <li>“Which agents do I <strong>follow</strong>, and what's their record?”</li>
       </ul>

       <h2>Tools</h2>
       <ul>
         <li><code>list_my_agents</code>, <code>get_agent_performance</code>, <code>list_my_agent_picks</code>, <code>list_my_follows</code> — your agents and their results.</li>
         <li><code>get_my_community_activity</code>, <code>get_my_record</code> — your community picks and tracked record.</li>
         <li><code>get_sport_predictions</code>, <code>get_game_detail</code>, <code>search_games</code> — model estimates per game.</li>
         <li><code>get_market_odds</code> — Polymarket prediction-market prices.</li>
         <li><code>get_editor_picks</code> — published editor analyses.</li>
       </ul>

       <h2>Troubleshooting</h2>
       <ul>
         <li><strong>No data returned?</strong> Sign in with the same account you use in the WagerProof app, and confirm you've created agents or logged picks there.</li>
         <li><strong>Wrong account?</strong> Remove the connector in your AI client's settings and re-add it, then sign in with the right account.</li>
         <li><strong>Permissions or expired-session error?</strong> Disconnect and reconnect WagerProof to refresh authorization.</li>
       </ul>

       <h2>Access &amp; privacy</h2>
       <p>Your own data is scoped to your account only. You can disconnect at any time in your AI client's connector settings. See the <a href="/privacy">privacy policy</a>.</p>`,
    ),
  ),
);

authApp.get("/privacy", (c) =>
  c.html(
    page(
      "WagerProof connector — Privacy policy",
      `<h1>Privacy policy — WagerProof connector</h1>
       <p class="muted">Last updated: 2026. Operated by WagerProof.</p>
       <p>This policy covers the <strong>WagerProof connector</strong> (the remote MCP server at <code>${c.env.MCP_BASE_URL}</code>) that lets an AI assistant read your WagerProof data. It is read-only.</p>

       <h2>What we access</h2>
       <p>After you sign in and grant access, the connector reads — on your request — your own WagerProof data (your AI agents, their picks and records, your follows and community activity) and WagerProof's public model estimates and odds. It cannot create, modify, or delete anything, and it cannot read another user's private data.</p>

       <h2>What we store</h2>
       <ul>
         <li>An authentication token (a Supabase refresh token) tied to your account, stored encrypted in Cloudflare Workers KV, so the connector can fetch your data when you ask. Short-lived access tokens are cached for up to ~1 hour.</li>
         <li>We do <strong>not</strong> store the contents of your data. It is fetched live and returned to the AI assistant you connected; it is not retained by the connector.</li>
       </ul>

       <h2>How your data is shared</h2>
       <p>When you ask a question, the requested data is returned to the AI assistant you explicitly connected (e.g. Claude or ChatGPT), subject to that provider's own privacy policy. We do not sell your data. Service providers used to operate the connector: Supabase (your WagerProof account &amp; data) and Cloudflare (hosting and encrypted token storage).</p>

       <h2>Retention &amp; your control</h2>
       <p>Stored tokens are retained until you disconnect the connector (in your AI client's connector settings) or revoke access, after which they are deleted and can no longer be used. You may also contact us to request deletion.</p>

       <h2>Responsible use</h2>
       <p>WagerProof is an analytics product. Information from this connector is for research and entertainment; it is not betting advice and does not guarantee outcomes. If you choose to gamble, do so responsibly and only where legal. Problem-gambling help (US): call or text 1-800-GAMBLER.</p>

       <h2>Contact</h2>
       <p>Questions or requests: <a href="mailto:support@wagerproof.bet">support@wagerproof.bet</a>.</p>`,
    ),
  ),
);

authApp.get("/terms", (c) =>
  c.html(
    page(
      "WagerProof connector — Terms of Service",
      `<h1>Terms of Service — WagerProof connector</h1>
       <p class="muted">Last updated: 2026. Operated by WagerProof ("we").</p>
       <p>These terms govern your use of the <strong>WagerProof connector</strong> (the remote MCP server at <code>${c.env.MCP_BASE_URL}</code>), which lets an AI assistant read your WagerProof data on your behalf. By connecting it, you agree to these terms.</p>

       <h2>What it does</h2>
       <p>The connector provides <strong>read-only</strong> access to your own WagerProof data and to WagerProof's public model estimates and odds. It does not create, modify, or delete your data, place bets, or facilitate any gambling transaction.</p>

       <h2>Informational only</h2>
       <p>All model estimates, historical records, and odds are provided for analysis and entertainment. They are <strong>not betting advice</strong> and do not guarantee outcomes. You are solely responsible for any decisions you make. Gamble responsibly and only where lawful; you must meet your jurisdiction's minimum age.</p>

       <h2>Eligibility &amp; accounts</h2>
       <p>You must have a WagerProof account and sign in with your own credentials. You're responsible for activity under your connection. Use of the underlying app remains subject to WagerProof's own terms.</p>

       <h2>Acceptable use</h2>
       <p>Don't use the connector to access data you don't own, to disrupt or overload the service, to reverse-engineer or circumvent its security, or for any unlawful purpose.</p>

       <h2>Availability &amp; liability</h2>
       <p>The connector is provided "as is" and "as available," without warranties of any kind. We may modify, suspend, or discontinue it at any time. To the maximum extent permitted by law, WagerProof is not liable for any indirect, incidental, or consequential damages arising from your use of the connector.</p>

       <h2>Privacy</h2>
       <p>Your data is handled as described in our <a href="/privacy">privacy policy</a>.</p>

       <h2>Contact</h2>
       <p><a href="mailto:support@wagerproof.bet">support@wagerproof.bet</a></p>`,
    ),
  ),
);

// --- consent page template -------------------------------------------------

interface ConsentConfig {
  ls: string;
  clientName: string;
  baseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  enableGoogle: boolean;
  enableApple: boolean;
  enableEmail: boolean;
}

const APPLE_SVG = `<svg viewBox="0 0 384 512" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>`;
const GOOGLE_SVG = `<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
const EMAIL_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`;

function consentStyles(): string {
  return `<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { font-family:'Inter',-apple-system,system-ui,sans-serif; margin:0; color:#E5E7EB;
         min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;
         background: radial-gradient(1000px 460px at 50% -10%, #1f2a44 0, #0b0f17 60%) no-repeat, #0b0f17; }
  .card { width:100%; max-width:26rem; background:#111827; border:1px solid #1f2937; border-radius:24px;
          padding:2rem 1.75rem; box-shadow:0 20px 60px rgba(0,0,0,.5); text-align:center; }
  .logo { width:64px; height:64px; border-radius:16px; box-shadow:0 4px 20px rgba(99,102,241,.45); }
  h1 { font-size:1.4rem; font-weight:800; margin:.75rem 0 0; color:#fff; }
  .sub { color:#9CA3AF; margin:.5rem 0 1.5rem; font-size:.95rem; line-height:1.45; font-weight:500; }
  .btn { width:100%; height:50px; border-radius:999px; border:1px solid transparent; cursor:pointer;
         font-family:'Inter',sans-serif; font-weight:600; font-size:16px; margin-bottom:10px;
         display:flex; align-items:center; justify-content:center; gap:10px;
         transition: transform .12s ease, opacity .12s ease; }
  .btn:active { transform: scale(.98); opacity:.9; }
  .btn:disabled { opacity:.5; cursor:default; }
  .btn.primary { background:#6366f1; color:#fff; }
  .btn.dark { background:#fff; color:#0b0f17; }
  .btn.light { background:#0b0f17; color:#E5E7EB; border-color:#374151; }
  .btn svg { flex:none; }
  .field { width:100%; height:50px; padding:0 1rem; border-radius:999px; border:1px solid #374151;
           background:#0b0f17; color:#E5E7EB; font-family:'Inter',sans-serif; font-size:16px; margin-bottom:10px; }
  .msg { font-size:.9rem; margin-top:.75rem; min-height:1.2rem; font-weight:500; }
  .msg.err { color:#F87171; }
  .msg.ok { color:#34D399; }
  .foot { font-size:.72rem; color:#7B8290; margin-top:1.25rem; font-weight:500; line-height:1.4; }
  .divider { display:flex; align-items:center; gap:.6rem; color:#6B7280; font-size:.78rem; margin:.5rem 0; }
  .divider::before, .divider::after { content:""; flex:1; height:1px; background:#1f2937; }
</style>`;
}

function renderConsent(cfg: ConsentConfig): string {
  const json = JSON.stringify(cfg);
  const googleBtn = cfg.enableGoogle
    ? `<button class="btn dark" id="google">${GOOGLE_SVG}<span>Continue with Google</span></button>`
    : "";
  const appleBtn = cfg.enableApple
    ? `<button class="btn dark" id="apple">${APPLE_SVG}<span>Continue with Apple</span></button>`
    : "";
  const oauthDivider =
    (cfg.enableGoogle || cfg.enableApple) && cfg.enableEmail
      ? `<div class="divider">or</div>`
      : "";
  const emailBlock = cfg.enableEmail
    ? `<input class="field" id="email" type="email" placeholder="you@example.com" autocomplete="email" />
       <input class="field" id="password" type="password" placeholder="Password" autocomplete="current-password" />
       <button class="btn primary" id="emailSignIn">${EMAIL_SVG}<span>Sign in</span></button>`
    : "";

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Connect WagerProof</title><link rel="icon" href="/icon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;800&display=swap" rel="stylesheet" />
${consentStyles()}
</head><body>
  <div class="card">
    <img class="logo" src="/icon.png" alt="WagerProof" />
    <h1>Connect WagerProof</h1>
    <p class="sub">Sign in to let <strong id="client"></strong> read your WagerProof agents, picks, and model analytics. This connection is <strong>read-only</strong>.</p>
    ${googleBtn}
    ${appleBtn}
    ${oauthDivider}
    ${emailBlock}
    <div class="msg" id="msg"></div>
    <div class="foot">Use the same account you use in the WagerProof app. We never see your password.</div>
  </div>

<script id="wp-config" type="application/json">${json}</script>
<script type="module">
  import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
  var CFG = JSON.parse(document.getElementById("wp-config").textContent);
  document.getElementById("client").textContent = CFG.clientName;

  var supabase = createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: false }
  });
  var msg = document.getElementById("msg");
  function setMsg(t, k){ msg.textContent = t; msg.className = "msg " + (k||""); }
  function disableAll(v){ ["google","apple","emailSignIn"].forEach(function(id){ var el=document.getElementById(id); if(el) el.disabled=v; }); }

  // Hand a verified Supabase session to the worker; it mints the MCP grant and
  // returns where to send the OAuth client next.
  async function complete(session){
    setMsg("Connecting…","ok");
    var res = await fetch("/callback", {
      method:"POST", headers:{ "content-type":"application/json" },
      body: JSON.stringify({ ls: CFG.ls, access_token: session.access_token, refresh_token: session.refresh_token })
    });
    if(!res.ok){
      var e = await res.json().catch(function(){return {};});
      setMsg("Could not complete sign-in: " + (e.error||res.status), "err"); disableAll(false); return;
    }
    var data = await res.json();
    window.location.href = data.redirectTo;
  }

  // Google/Apple → full-page redirect to provider, returns to /oauth-return.
  async function oauth(provider){
    disableAll(true); setMsg("");
    var { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: CFG.baseUrl + "/oauth-return?ls=" + encodeURIComponent(CFG.ls) }
    });
    if(error){ setMsg(error.message||"Sign-in failed","err"); disableAll(false); }
  }
  var g = document.getElementById("google"); if(g) g.onclick = function(){ oauth("google"); };
  var a = document.getElementById("apple"); if(a) a.onclick = function(){ oauth("apple"); };

  var emailBtn = document.getElementById("emailSignIn");
  if(emailBtn){
    emailBtn.onclick = async function(){
      var email = document.getElementById("email").value.trim();
      var password = document.getElementById("password").value;
      if(!email||!password){ setMsg("Enter your email and password.","err"); return; }
      disableAll(true); setMsg("");
      var { data, error } = await supabase.auth.signInWithPassword({ email: email, password: password });
      if(error || !data.session){ setMsg((error&&error.message)||"Sign-in failed","err"); disableAll(false); return; }
      await complete(data.session);
    };
  }
</script>
</body></html>`;
}

function renderOAuthReturn(cfg: { supabaseUrl: string; supabaseAnonKey: string }): string {
  const json = JSON.stringify(cfg);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Connecting WagerProof…</title><link rel="icon" href="/icon.png" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600&display=swap" rel="stylesheet" />
${consentStyles()}
</head><body>
  <div class="card">
    <img class="logo" src="/icon.png" alt="WagerProof" />
    <h1>Connecting…</h1>
    <div class="msg ok" id="msg">Finishing sign-in…</div>
  </div>
<script id="wp-config" type="application/json">${json}</script>
<script type="module">
  import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
  var CFG = JSON.parse(document.getElementById("wp-config").textContent);
  var supabase = createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: false }
  });
  var msg = document.getElementById("msg");
  function fail(t){ msg.textContent = t; msg.className = "msg err"; }

  (async function(){
    var url = new URL(window.location.href);
    var ls = url.searchParams.get("ls");
    var code = url.searchParams.get("code");
    var errDesc = url.searchParams.get("error_description");
    if(errDesc){ fail(errDesc); return; }
    if(!ls){ fail("Missing session reference."); return; }
    var session = null;
    try {
      if(code){
        var { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if(error) throw error;
        session = data.session;
      } else {
        var got = await supabase.auth.getSession();
        session = got.data.session;
      }
    } catch(e){ fail((e&&e.message)||"Could not complete sign-in."); return; }
    if(!session){ fail("No session returned. Please try again."); return; }
    var res = await fetch("/callback", {
      method:"POST", headers:{ "content-type":"application/json" },
      body: JSON.stringify({ ls: ls, access_token: session.access_token, refresh_token: session.refresh_token })
    });
    if(!res.ok){ var e = await res.json().catch(function(){return {};}); fail("Could not complete sign-in: " + (e.error||res.status)); return; }
    var out = await res.json();
    window.location.href = out.redirectTo;
  })();
</script>
</body></html>`;
}
