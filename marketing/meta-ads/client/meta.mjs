#!/usr/bin/env node
// WagerProof — Meta (Facebook/Instagram) ads client. Zero dependencies
// (Node 18+ global fetch/FormData/Blob). Ships app-install ads for the WagerProof
// iOS/Android apps and manages them (list / report / activate / pause / rename).
//
// Platform-aware: pass --platform ios|android (or set defaults.platform in
// config.json). Each platform's app id / store url / OS / SKAN flag come from
// config.app[platform].
//
// SAFETY: hard-locked to the ad account in config.json. The signed-in Meta user
// also has access to Honeydew, Orbital Focus and other accounts — this client
// refuses to touch any account other than config.adAccountId.
//
// Auth: put a Meta access token with `ads_management` scope in
// marketing/meta-ads/.env  as  META_ACCESS_TOKEN=...   (that file is gitignored).
//
// Usage (run from marketing/meta-ads/):
//   node client/meta.mjs check
//   node client/meta.mjs upload <file>
//   node client/meta.mjs bootstrap --platform ios [--optimize purchase] [--cbo] [--budget <usd>] [--name "<adset>"] [--active]
//   node client/meta.mjs build <dir> --platform ios [--optimize purchase] [--adset <id>] [--budget <usd>] [--active]
//   node client/meta.mjs clone <adId> [more...] --to <adsetId> [--active]
//   node client/meta.mjs list [ads]
//   node client/meta.mjs report [days]
//   node client/meta.mjs view [funnel|creative|money|all] [days] [--level ad|adset|campaign] [--campaign <id>]
//   node client/meta.mjs activate <adId> [more...]
//   node client/meta.mjs pause <adId> [more...]
//   node client/meta.mjs rename <id> "<new name>"
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, extname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CFG = JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf8'));
const API = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}`;
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const VID_EXT = new Set(['.mp4', '.mov', '.m4v']);

function die(msg) { console.error(`✖ ${msg}`); process.exit(1); }

function loadToken() {
  if (process.env.META_ACCESS_TOKEN) return process.env.META_ACCESS_TOKEN;
  const envPath = join(ROOT, '.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*META_ACCESS_TOKEN\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  die('No token. Put META_ACCESS_TOKEN=... in marketing/meta-ads/.env (ads_management scope).');
}
const TOKEN = loadToken();
const ACCT = CFG.adAccountId; // act_...
if (!/^act_\d+$/.test(ACCT)) die(`config.adAccountId looks wrong: ${ACCT}`);

// ---- platform + optimization resolution ------------------------------------
function platform() { return argFlag('--platform') || CFG.defaults.platform; }

// Which event Meta optimizes delivery toward. App-event optimization (AEO) sends
// optimization_goal=OFFSITE_CONVERSIONS plus a custom_event_type on the promoted
// object; plain install campaigns send APP_INSTALLS and no event.
function optimization(P) {
  const key = argFlag('--optimize') || CFG.defaults.optimize || 'installs';
  const o = CFG.optimization?.[key];
  if (!o) die(`unknown --optimize "${key}". Options: ${Object.keys(CFG.optimization || {}).join(', ')}`);
  // `disabledForApps` guards events that exist on the web pixel but were never logged as
  // app events — SUBSCRIBE is the case that burned $9.5k. Web is a legitimate destination
  // for exactly those events, so the block must not apply there.
  if (o.disabledForApps && P && !isWeb(P) && !hasFlag('--force')) {
    die(`--optimize ${key} is not available for --platform ${P.key}: ${o.disabledForApps}\n  (pass --force to override)`);
  }
  return { key, ...o };
}
function profile() {
  const p = platform();
  if (!p) die('no platform: pass --platform ios|android|web or set defaults.platform in config.json');
  const prof = CFG.app?.[p];
  if (!prof) die(`config.app.${p} is missing`);
  // Web drives to the site and converts on the pixel; the app platforms drive to a store.
  const required = prof.kind === 'web' ? ['pixelId', 'landingUrl'] : ['metaAppId', 'storeUrl'];
  for (const k of required) {
    if (!prof[k] || String(prof[k]).includes('TODO')) die(`config.app.${p}.${k} is not set yet (still a TODO) — fill config.json first`);
  }
  return { key: p, label: { ios: 'iOS', android: 'AND', web: 'WEB' }[p] || p.toUpperCase(), ...prof };
}
const isWeb = (P) => P.kind === 'web';

async function graph(method, path, body, isForm = false) {
  const url = `${API}/${path}`;
  const opts = { method };
  if (isForm) { body.append('access_token', TOKEN); opts.body = body; }
  else if (method === 'GET') {
    const qs = new URLSearchParams({ ...(body || {}), access_token: TOKEN });
    return finish(await fetch(`${url}?${qs}`), path);
  } else {
    opts.headers = { 'content-type': 'application/json' };
    opts.body = JSON.stringify({ ...(body || {}), access_token: TOKEN });
  }
  return finish(await fetch(url, opts), path);
}
async function finish(res, path) {
  const j = await res.json().catch(() => ({}));
  if (!res.ok) die(`${path}: ${j.error?.error_user_msg || j.error?.message || res.status}`);
  return j;
}

// ---- media upload ----------------------------------------------------------
async function uploadImage(file) {
  const form = new FormData();
  form.append('filename', new Blob([readFileSync(file)], { type: 'image/png' }), basename(file));
  const j = await graph('POST', `${ACCT}/adimages`, form, true);
  const hash = j.images ? Object.values(j.images)[0]?.hash : undefined;
  if (!hash) die(`no image hash for ${file}`);
  return { kind: 'image', hash };
}
async function uploadVideo(file) {
  const form = new FormData();
  form.append('source', new Blob([readFileSync(file)], { type: 'video/mp4' }), basename(file));
  form.append('name', basename(file));
  const j = await graph('POST', `${ACCT}/advideos`, form, true);
  if (!j.id) die(`no video id for ${file}`);
  // Meta requires an explicit thumbnail on video creatives; it exposes generated
  // candidates only after transcoding, so poll until they appear.
  const thumb = await videoThumbnail(j.id, basename(file));
  return { kind: 'video', videoId: j.id, thumbUrl: thumb };
}
async function videoThumbnail(videoId, label) {
  for (let i = 0; i < 30; i++) {
    const v = await graph('GET', videoId, { fields: 'status,thumbnails' });
    const list = v.thumbnails?.data || [];
    if (list.length) return (list.find((t) => t.is_preferred) || list[0]).uri;
    if (v.status?.video_status === 'error') die(`video processing failed for ${label}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  die(`timed out waiting for a thumbnail for ${label} (video still processing)`);
}
async function uploadMedia(file) {
  const ext = extname(file).toLowerCase();
  if (IMG_EXT.has(ext)) return uploadImage(file);
  if (VID_EXT.has(ext)) return uploadVideo(file);
  die(`unsupported media type: ${file}`);
}

// ---- creative + ad ---------------------------------------------------------
function destination(P) { return isWeb(P) ? P.landingUrl : P.storeUrl; }
function cta(P) {
  const value = { link: destination(P) };
  if (!isWeb(P)) value.application = P.metaAppId;
  return { type: P.cta || CFG.defaults.cta, value };
}
function storySpec(P, media) {
  const base = { page_id: CFG.pageId };
  // `instagram_actor_id` is the old spelling and is now rejected outright — the current
  // API wants `instagram_user_id`. Existing creatives in the account use the new one.
  if (CFG.instagramActorId) base.instagram_user_id = CFG.instagramActorId;
  if (media.kind === 'video') {
    const vd = { video_id: media.videoId, message: CFG.defaults.message, title: CFG.defaults.headline, call_to_action: cta(P) };
    // Reused creatives carry an image_hash; freshly uploaded ones only have a URL.
    if (media.thumbHash) vd.image_hash = media.thumbHash; else vd.image_url = media.thumbUrl;
    if (isWeb(P)) vd.link_description = CFG.defaults.headline;
    base.video_data = vd;
  } else {
    base.link_data = { link: destination(P), image_hash: media.hash, message: CFG.defaults.message, name: CFG.defaults.headline, call_to_action: cta(P) };
  }
  return base;
}
async function createAd(P, adSetId, name, media, status) {
  const creative = await graph('POST', `${ACCT}/adcreatives`, { name: `${name} creative`, object_story_spec: storySpec(P, media) });
  const ad = await graph('POST', `${ACCT}/ads`, { name, adset_id: adSetId, creative: { creative_id: creative.id }, status });
  return { adId: ad.id, creativeId: creative.id };
}

// ---- campaign + ad set bootstrap -------------------------------------------
function targeting(P) {
  const d = CFG.defaults;
  const t = {
    geo_locations: { countries: d.countries },
    age_min: d.ageMin, age_max: d.ageMax,
    user_os: P.userOs,
    device_platforms: d.devicePlatforms,
    publisher_platforms: d.publisherPlatforms,
  };
  // Never pay to reach people who already have the app — they can't install and
  // (for AEO) they subscribe through the app, not the ad.
  // Only meaningful for app campaigns — a web conversion ad set has no install state.
  if (d.excludeInstallers && !isWeb(P)) t.app_install_state = 'not_installed';
  // Advantage audience: let Meta widen past the demo box. The account's best
  // performing ad set ran with this on.
  if (d.advantageAudience) t.targeting_automation = { advantage_audience: 1 };
  return t;
}
async function bootstrap(P, O, budgetCents, adSetName, status, cbo) {
  const campaign = {
    name: (CFG.naming.campaign || '{PLAT} | Scale | {TYPE} | {OPT}')
      .replace('{PLAT}', P.label).replace('{TYPE}', isWeb(P) ? 'WebConv' : 'AppPromo').replace('{OPT}', O.label),
    objective: P.objective || CFG.defaults.objective, buying_type: 'AUCTION', special_ad_categories: [], status,
  };
  // Web sales campaigns declare the pixel on the ad set only; app campaigns carry the
  // promoted app at both levels.
  if (!isWeb(P)) campaign.promoted_object = { application_id: P.metaAppId, object_store_url: P.storeUrl };
  // CBO (budget on the campaign) is what the account's profitable purchase-optimized
  // campaign used; ABO keeps budget on the ad set.
  if (cbo) { campaign.daily_budget = budgetCents; campaign.bid_strategy = CFG.defaults.bidStrategy; }
  else campaign.is_adset_budget_sharing_enabled = false;
  // iOS 14+/SKAN campaigns must declare SKAN at the campaign level (immutable after creation).
  if (P.skadnetwork) campaign.is_skadnetwork_attribution = true;
  const camp = await graph('POST', `${ACCT}/campaigns`, campaign);

  const promoted = isWeb(P) ? { pixel_id: P.pixelId } : { application_id: P.metaAppId, object_store_url: P.storeUrl };
  if (O.customEventType) promoted.custom_event_type = O.customEventType;
  const adsetBody = {
    name: adSetName, campaign_id: camp.id,
    optimization_goal: O.goal, billing_event: CFG.defaults.billingEvent,
    promoted_object: promoted, targeting: targeting(P), status,
  };
  if (cbo) adsetBody.daily_budget = undefined;
  else { adsetBody.daily_budget = budgetCents; adsetBody.bid_strategy = CFG.defaults.bidStrategy; }
  // Downfunnel events land days after the click, so a 1-day window starves the
  // model. SKAN campaigns reject view-through, hence click-only.
  if (O.customEventType && CFG.defaults.clickAttributionDays) {
    adsetBody.attribution_spec = [{ event_type: 'CLICK_THROUGH', window_days: CFG.defaults.clickAttributionDays }];
    // SKAN app campaigns reject view-through; web has no such restriction and the extra
    // signal matters when conversion volume is this thin.
    if (isWeb(P)) adsetBody.attribution_spec.push({ event_type: 'VIEW_THROUGH', window_days: 1 });
  }
  if (isWeb(P)) adsetBody.destination_type = 'WEBSITE';
  const adset = await graph('POST', `${ACCT}/adsets`, adsetBody);
  return { campaignId: camp.id, adSetId: adset.id };
}

// ---- helpers ---------------------------------------------------------------
function argFlag(name) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; }
// Numeric positional args only. A bare `.filter(isNumeric)` also swallows flag VALUES
// (`--adset 123` would be treated as an ad id), so stop at the first flag.
function idArgs(rest) {
  const stop = rest.findIndex((a) => a.startsWith('--'));
  return (stop === -1 ? rest : rest.slice(0, stop)).filter((r) => /^\d+$/.test(r));
}
function hasFlag(name) { return process.argv.includes(name); }
function mmdd() { const d = new Date(); return String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
function concept(file) { return basename(file, extname(file)).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }

// ---- commands --------------------------------------------------------------
async function cmdCheck() {
  const acct = await graph('GET', ACCT, { fields: 'name,account_status,currency,funding_source' });
  const page = await graph('GET', CFG.pageId, { fields: 'name,id' });
  console.log(`Account : ${acct.name} (${ACCT}) status=${acct.account_status} ${acct.currency}`);
  console.log(`Page    : ${page.name} (${page.id})`);
  for (const k of ['ios', 'android']) {
    const p = CFG.app?.[k];
    if (p && p.storeUrl && !String(p.storeUrl).includes('TODO')) console.log(`App ${k.padEnd(7)}: metaAppId=${p.metaAppId}  store=${p.storeUrl}`);
    else console.log(`App ${k.padEnd(7)}: (not configured)`);
  }
  console.log('Token OK. Ready to ship.');
}
async function cmdUpload(file) { if (!file) die('usage: upload <file>'); console.log(JSON.stringify(await uploadMedia(file))); }
async function cmdBootstrap() {
  const P = profile(), O = optimization(P);
  const budget = Math.round(Number(argFlag('--budget') || CFG.defaults.dailyBudgetCents / 100) * 100);
  const name = argFlag('--name') || `${P.label} | Broad | ${O.label} ${mmdd()}`;
  const status = hasFlag('--active') ? 'ACTIVE' : CFG.defaults.status;
  const { campaignId, adSetId } = await bootstrap(P, O, budget, name, status, hasFlag('--cbo'));
  console.log(`campaign ${campaignId}\nADSET_ID ${adSetId}  (${P.label}, ${O.label}, $${(budget / 100).toFixed(2)}/day${hasFlag('--cbo') ? ' CBO' : ''}, ${status})`);
}
async function cmdBuild(dir) {
  if (!dir || !existsSync(dir)) die('usage: build <dir> --platform ios|android [--adset <id>] [--active] [--budget <usd>]');
  const P = profile(), O = optimization(P);
  const status = hasFlag('--active') ? 'ACTIVE' : CFG.defaults.status;
  const files = readdirSync(dir).filter((f) => { const e = extname(f).toLowerCase(); return IMG_EXT.has(e) || VID_EXT.has(e); }).sort();
  if (!files.length) die(`no media in ${dir}`);
  let adSetId = argFlag('--adset');
  if (!adSetId) {
    const budget = Math.round(Number(argFlag('--budget') || CFG.defaults.dailyBudgetCents / 100) * 100);
    const b = await bootstrap(P, O, budget, `${P.label} | Broad | ${O.label} ${mmdd()}`, status, hasFlag('--cbo'));
    adSetId = b.adSetId;
    console.log(`Created campaign ${b.campaignId} + ad set ${adSetId} (${P.label}, ${O.label}, $${(budget / 100).toFixed(2)}/day, ${status})`);
  }
  const results = [];
  const tag = mmdd();
  for (const f of files) {
    try {
      const media = await uploadMedia(join(dir, f));
      const name = `${concept(f)}_${P.label}_${tag}`;
      const { adId, creativeId } = await createAd(P, adSetId, name, media, status);
      console.log(`✓ ${name}  ad ${adId}`);
      results.push({ file: f, name, adId, creativeId, ...media, status });
    } catch (e) {
      console.error(`✖ ${f}: ${e.message}`);
      results.push({ file: f, error: e.message });
    }
  }
  writeFileSync(join(ROOT, `build-${P.key}-${tag}.json`), JSON.stringify(results, null, 2));
  const ok = results.filter((r) => r.adId).length;
  console.log(`\nDone. ${ok}/${files.length} ads created (${status}) in ad set ${adSetId}. Results -> marketing/meta-ads/build-${P.key}-${tag}.json`);
}
// Re-run a creative that already won somewhere else. Reuses the existing creative
// object rather than re-uploading the video, so the new ad inherits the original
// post's accumulated likes/comments/shares instead of starting cold.
async function cmdClone(ids) {
  const adSetId = argFlag('--to');
  if (!adSetId || !ids.length) die('usage: clone <adId> [more...] --to <adsetId> [--name "<name>"] [--active]');
  const status = hasFlag('--active') ? 'ACTIVE' : CFG.defaults.status;
  for (const id of ids) {
    const src = await graph('GET', id, { fields: 'name,creative{id}' });
    const name = argFlag('--name') || `${concept(src.name)}_${profile().label}_${mmdd()}`;
    const ad = await graph('POST', `${ACCT}/ads`, { name, adset_id: adSetId, creative: { creative_id: src.creative.id }, status });
    console.log(`✓ ${name}  ad ${ad.id}  (creative ${src.creative.id} reused from ${id})`);
  }
}

// Reuse a proven ad's VIDEO in a new campaign whose destination differs (e.g. an
// app-install winner re-pointed at the web paywall). Unlike `clone`, this builds a
// fresh creative — the source creative's CTA and link belong to the wrong funnel.
// Social proof is not inherited; that's the unavoidable cost of changing destination.
async function cmdRemix(ids) {
  if (!ids.length) die('usage: remix <adId> [more...] --platform web [--adset <id>] [--budget <usd>] [--optimize subscribe] [--active]');
  const P = profile(), O = optimization(P);
  const status = hasFlag('--active') ? 'ACTIVE' : CFG.defaults.status;
  let adSetId = argFlag('--adset');
  if (!adSetId) {
    const budget = Math.round(Number(argFlag('--budget') || CFG.defaults.dailyBudgetCents / 100) * 100);
    const b = await bootstrap(P, O, budget, argFlag('--name') || `${P.label} | Broad | ${O.label} ${mmdd()}`, status, hasFlag('--cbo'));
    adSetId = b.adSetId;
    console.log(`Created campaign ${b.campaignId} + ad set ${adSetId} (${P.label}, ${O.label}, $${(budget / 100).toFixed(2)}/day${hasFlag('--cbo') ? ' CBO' : ''}, ${status})`);
  }
  for (const id of ids) {
    const src = await graph('GET', id, { fields: 'name,creative{object_story_spec}' });
    const vd = src.creative?.object_story_spec?.video_data;
    if (!vd?.video_id) { console.error(`✖ ${id}: not a video ad, skipping`); continue; }
    const name = `${concept(src.name)}_${P.label}_${mmdd()}`;
    const { adId } = await createAd(P, adSetId, name, { kind: 'video', videoId: vd.video_id, thumbHash: vd.image_hash, thumbUrl: vd.image_url }, status);
    console.log(`✓ ${name}  ad ${adId}  (video ${vd.video_id} reused from ${id})`);
  }
}

async function cmdList(what) {
  if (what === 'ads') {
    const j = await graph('GET', `${ACCT}/ads`, { fields: 'name,effective_status', limit: '200' });
    (j.data || []).forEach((a) => console.log(`${a.effective_status.padEnd(16)} ${a.name}`));
    return;
  }
  const c = await graph('GET', `${ACCT}/campaigns`, { fields: 'name,status,objective,daily_budget', limit: '100' });
  (c.data || []).forEach((x) => console.log(`${x.status.padEnd(9)} ${x.name}  [${x.objective}]${x.daily_budget ? ` $${(x.daily_budget / 100).toFixed(0)}/day` : ''}`));
}
async function cmdReport(days) {
  const n = Number(days || 7);
  const since = new Date(Date.now() - (n - 1) * 864e5).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  const j = await graph('GET', `${ACCT}/insights`, { level: 'ad', time_range: JSON.stringify({ since, until }), fields: 'ad_name,spend,impressions,inline_link_clicks,actions,action_values', limit: '500' });
  const rows = (j.data || []).filter((r) => Number(r.spend) > 0).sort((a, b) => b.spend - a.spend);
  const act = (r, types) => { const a = (r.actions || []).find((x) => types.includes(x.action_type)); return a ? Number(a.value) : 0; };
  const inst = (r) => act(r, ['mobile_app_install', 'omni_app_install', 'app_install']);
  const pur = (r) => act(r, ['omni_purchase', 'purchase', 'app_custom_event.fb_mobile_purchase']);
  const rev = (r) => { const a = (r.action_values || []).find((x) => x.action_type === 'omni_purchase'); return a ? Number(a.value) : 0; };
  let s = 0, i = 0, p = 0, v = 0;
  console.log(`WagerProof — last ${n}d (${since}..${until})`);
  rows.forEach((r) => {
    s += Number(r.spend); i += inst(r); p += pur(r); v += rev(r);
    const cpi = inst(r) ? (r.spend / inst(r)).toFixed(2) : '—';
    const cpa = pur(r) ? (r.spend / pur(r)).toFixed(0) : '—';
    const roas = Number(r.spend) ? (rev(r) / r.spend).toFixed(2) : '—';
    console.log(`  $${Number(r.spend).toFixed(2).padStart(8)}  inst ${String(inst(r)).padStart(4)} CPI ${String(cpi).padStart(6)}  pur ${String(pur(r)).padStart(3)} CPA ${String(cpa).padStart(5)}  roas ${String(roas).padStart(5)}  ${r.ad_name}`);
  });
  console.log(`  TOTAL  $${s.toFixed(2)}  installs ${i} (CPI ${i ? (s / i).toFixed(2) : '—'})  purchases ${p} (CPA ${p ? (s / p).toFixed(0) : '—'})  rev $${v.toFixed(0)}  ROAS ${s ? (v / s).toFixed(2) : '—'}`);
}
// ---- custom metric views ---------------------------------------------------
// `report` reads only `actions`, which is why subscribes have always shown as zero:
// app subscriptions land in the SEPARATE `conversions` field as `subscribe_mobile_app`.
// Reading the wrong field is what made the 2026-04 SUBSCRIBE campaign look like it
// produced 5 purchases when it actually produced 107 subscribes at $89 CPA.
//
// Each metric declares the raw insight fields it needs and how to derive itself, so a
// view pulls exactly the columns it prints instead of one fat request per command.
const num = (v) => (v == null || Number.isNaN(Number(v)) ? 0 : Number(v));
const pick = (arr, types) => { const a = (arr || []).find((x) => types.includes(x.action_type)); return a ? num(a.value) : 0; };
const sum = (arr) => (arr || []).reduce((a, x) => a + num(x.value), 0);
const ratio = (n, d, suffix = '%') => (d ? (n / d * 100).toFixed(2) + suffix : '—');
const per = (spend, n) => (n ? '$' + (spend / n).toFixed(2) : '—');

const METRIC = {
  spend:  { h: 'spend',   w: 9,  need: ['spend'],                          get: (r) => '$' + num(r.spend).toFixed(2) },
  imp:    { h: 'imp',     w: 8,  need: ['impressions'],                    get: (r) => String(num(r.impressions)) },
  cpm:    { h: 'CPM',     w: 7,  need: ['spend', 'impressions'],           get: (r) => per(num(r.spend) * 1000, num(r.impressions)) },
  clicks: { h: 'clicks',  w: 7,  need: ['inline_link_clicks'],             get: (r) => String(num(r.inline_link_clicks)) },
  ctr:    { h: 'CTR',     w: 7,  need: ['inline_link_clicks', 'impressions'], get: (r) => ratio(num(r.inline_link_clicks), num(r.impressions)) },
  cpc:    { h: 'CPC',     w: 7,  need: ['spend', 'inline_link_clicks'],    get: (r) => per(num(r.spend), num(r.inline_link_clicks)) },
  // Meta retired `video_3_sec_watched_actions`, so "plays" is video_play_actions (starts,
  // excluding replays) and hold% is thruplay/plays. Labelled as plays, not 3s, on purpose.
  plays:  { h: 'plays',   w: 8,  need: ['video_play_actions'],             get: (r) => String(sum(r.video_play_actions)) },
  hold:   { h: 'hold',    w: 7,  need: ['video_play_actions', 'video_thruplay_watched_actions'], get: (r) => ratio(sum(r.video_thruplay_watched_actions), sum(r.video_play_actions)) },
  done:   { h: 'p100',    w: 7,  need: ['video_play_actions', 'video_p100_watched_actions'],     get: (r) => ratio(sum(r.video_p100_watched_actions), sum(r.video_play_actions)) },
  visits: { h: 'visits',  w: 7,  need: ['actions'],                        get: (r) => String(pick(r.actions, ['app_store_visit'])) },
  v2i:    { h: 'vis→ins', w: 8,  need: ['actions'],                        get: (r) => ratio(pick(r.actions, INSTALL), pick(r.actions, ['app_store_visit'])) },
  inst:   { h: 'inst',    w: 6,  need: ['actions'],                        get: (r) => String(pick(r.actions, INSTALL)) },
  cpi:    { h: 'CPI',     w: 9,  need: ['spend', 'actions'],               get: (r) => per(num(r.spend), pick(r.actions, INSTALL)) },
  reg:    { h: 'reg',     w: 6,  need: ['actions'],                        get: (r) => String(pick(r.actions, REG)) },
  cpr:    { h: 'CPR',     w: 9,  need: ['spend', 'actions'],               get: (r) => per(num(r.spend), pick(r.actions, REG)) },
  sub:    { h: 'sub',     w: 5,  need: ['conversions'],                    get: (r) => String(pick(r.conversions, SUB)) },
  cps:    { h: 'CPS',     w: 9,  need: ['spend', 'conversions'],           get: (r) => per(num(r.spend), pick(r.conversions, SUB)) },
  i2s:    { h: 'ins→sub', w: 8,  need: ['actions', 'conversions'],         get: (r) => ratio(pick(r.conversions, SUB), pick(r.actions, INSTALL)) },
  // `pur` stays separate from `sub` rather than being summed: on this account
  // fb_mobile_purchase is the pre-2026-04 RevenueCat event and subscribe_mobile_app the
  // current one, so adding them would double-count any window that spans the cutover.
  pur:    { h: 'pur',     w: 5,  need: ['actions'],                        get: (r) => String(pick(r.actions, PUR)) },
  rev:    { h: 'rev',     w: 8,  need: ['action_values'],                  get: (r) => '$' + pick(r.action_values, ['omni_purchase']).toFixed(0) },
  roas:   { h: 'ROAS',    w: 6,  need: ['spend', 'action_values'],         get: (r) => (num(r.spend) ? (pick(r.action_values, ['omni_purchase']) / num(r.spend)).toFixed(2) : '—') },
};
// Insight fields that come back as [{action_type, value}] rather than a scalar.
const ARRAY_FIELDS = new Set(['actions', 'action_values', 'conversions', 'cost_per_conversion',
  'video_play_actions', 'video_thruplay_watched_actions', 'video_p100_watched_actions']);
const INSTALL = ['mobile_app_install', 'omni_app_install', 'app_install'];
const REG = ['app_custom_event.fb_mobile_complete_registration', 'complete_registration', 'omni_complete_registration'];
const SUB = ['subscribe_mobile_app', 'subscribe_total'];
const PUR = ['app_custom_event.fb_mobile_purchase', 'omni_purchase', 'purchase'];

// Named column sets. `funnel` is the default because with three campaigns on three
// different optimization goals, the step-by-step drop-off is the only fair comparison.
const VIEWS = {
  funnel:   ['spend', 'imp', 'cpm', 'ctr', 'visits', 'v2i', 'inst', 'cpi', 'reg', 'sub', 'cps', 'i2s'],
  creative: ['spend', 'imp', 'cpm', 'clicks', 'ctr', 'cpc', 'plays', 'hold', 'done', 'inst', 'cpi'],
  money:    ['spend', 'inst', 'cpi', 'reg', 'cpr', 'sub', 'cps', 'pur', 'rev', 'roas'],
  all:      Object.keys(METRIC),
};

async function cmdView(preset, days) {
  const cols = VIEWS[preset || 'funnel'];
  if (!cols) die(`unknown view "${preset}". Views: ${Object.keys(VIEWS).join(', ')}`);
  const level = argFlag('--level') || 'ad';
  if (!['ad', 'adset', 'campaign'].includes(level)) die(`--level must be ad, adset or campaign`);
  const n = Number(days || argFlag('--days') || 7);
  const since = argFlag('--since') || new Date(Date.now() - (n - 1) * 864e5).toISOString().slice(0, 10);
  const until = argFlag('--until') || new Date().toISOString().slice(0, 10);

  const need = new Set([`${level}_name`]);
  cols.forEach((c) => METRIC[c].need.forEach((f) => need.add(f)));
  const params = { level, time_range: JSON.stringify({ since, until }), fields: [...need].join(','), limit: '500' };
  // Filtering server-side keeps a single-campaign drilldown from paging the whole account.
  const only = argFlag('--campaign');
  if (only) params.filtering = JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: [only] }]);

  const j = await graph('GET', `${ACCT}/insights`, params);
  const rows = (j.data || []).filter((r) => num(r.spend) > 0).sort((a, b) => num(b.spend) - num(a.spend));
  if (!rows.length) return console.log(`No delivery in ${since}..${until}.`);

  const label = (r) => r[`${level}_name`] || '(unnamed)';
  const nameW = Math.min(46, Math.max(...rows.map((r) => label(r).length), 4));
  const head = 'NAME'.padEnd(nameW) + cols.map((c) => METRIC[c].h.padStart(METRIC[c].w)).join('');
  console.log(`WagerProof — "${preset || 'funnel'}" by ${level}, ${since}..${until}${only ? ` (campaign ${only})` : ''}`);
  console.log(head);
  console.log('─'.repeat(head.length));
  for (const r of rows) console.log(label(r).slice(0, nameW).padEnd(nameW) + cols.map((c) => METRIC[c].get(r).padStart(METRIC[c].w)).join(''));

  // Totals are recomputed from summed raw fields, never averaged from the printed rows —
  // averaging a ratio column across rows silently weights a $2 ad the same as a $200 one.
  const T = {};
  for (const r of rows) for (const f of need) {
    if (f.endsWith('_name')) continue;
    // Array-ness comes from the field name, not from this row's value: a row missing
    // `conversions` entirely would otherwise coerce the running total to a number and
    // wipe out every subscribe counted so far.
    if (ARRAY_FIELDS.has(f)) (T[f] ||= []).push(...(r[f] || []));
    else T[f] = num(T[f]) + num(r[f]);
  }
  // Collapse the concatenated action arrays back down so pick() sees one entry per type.
  for (const f of Object.keys(T)) if (Array.isArray(T[f])) {
    const m = {};
    for (const a of T[f]) m[a.action_type] = (m[a.action_type] || 0) + num(a.value);
    T[f] = Object.entries(m).map(([action_type, value]) => ({ action_type, value }));
  }
  console.log('─'.repeat(head.length));
  console.log('TOTAL'.padEnd(nameW) + cols.map((c) => METRIC[c].get(T).padStart(METRIC[c].w)).join(''));
}

async function cmdStatus(status, ids) {
  if (!ids.length) die(`usage: ${status === 'ACTIVE' ? 'activate' : 'pause'} <adId> [more...]`);
  for (const id of ids) { await graph('POST', id, { status }); console.log(`${status} ${id}`); }
}
async function cmdRename(id, name) { if (!id || !name) die('usage: rename <id> "<new name>"'); await graph('POST', id, { name }); console.log(`renamed ${id} -> ${name}`); }

// ---- dispatch --------------------------------------------------------------
const [cmd, ...rest] = process.argv.slice(2);
const run = {
  check: () => cmdCheck(),
  upload: () => cmdUpload(rest[0]),
  bootstrap: () => cmdBootstrap(),
  build: () => cmdBuild(rest[0]),
  list: () => cmdList(rest[0]),
  report: () => cmdReport(rest[0]),
  view: () => cmdView(rest[0], rest[1]),
  activate: () => cmdStatus('ACTIVE', idArgs(rest)),
  pause: () => cmdStatus('PAUSED', idArgs(rest)),
  rename: () => cmdRename(rest[0], rest.slice(1).join(' ')),
  clone: () => cmdClone(idArgs(rest)),
  remix: () => cmdRemix(idArgs(rest)),
};
if (!run[cmd]) die(`unknown command "${cmd || ''}". Commands: check, upload, bootstrap, build, clone, remix, list, report, view, activate, pause, rename`);
run[cmd]();
