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
//   node client/meta.mjs bootstrap --platform ios [--budget <usd>] [--name "<adset>"] [--active]
//   node client/meta.mjs build <dir> --platform ios [--adset <id>] [--budget <usd>] [--active]
//   node client/meta.mjs list [ads]
//   node client/meta.mjs report [days]
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

// ---- platform resolution ---------------------------------------------------
function platform() { return argFlag('--platform') || CFG.defaults.platform; }
function profile() {
  const p = platform();
  if (!p) die('no platform: pass --platform ios|android or set defaults.platform in config.json');
  const prof = CFG.app?.[p];
  if (!prof) die(`config.app.${p} is missing`);
  for (const k of ['metaAppId', 'storeUrl']) {
    if (!prof[k] || String(prof[k]).includes('TODO')) die(`config.app.${p}.${k} is not set yet (still a TODO) — fill config.json first`);
  }
  return { key: p, label: p === 'ios' ? 'iOS' : 'AND', ...prof };
}

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
function cta(P) { return { type: CFG.defaults.cta, value: { link: P.storeUrl, application: P.metaAppId } }; }
function storySpec(P, media) {
  const base = { page_id: CFG.pageId };
  if (CFG.instagramActorId) base.instagram_actor_id = CFG.instagramActorId;
  if (media.kind === 'video') {
    base.video_data = { video_id: media.videoId, image_url: media.thumbUrl, message: CFG.defaults.message, title: CFG.defaults.headline, call_to_action: cta(P) };
  } else {
    base.link_data = { link: P.storeUrl, image_hash: media.hash, message: CFG.defaults.message, name: CFG.defaults.headline, call_to_action: cta(P) };
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
  return {
    geo_locations: { countries: d.countries },
    age_min: d.ageMin, age_max: d.ageMax,
    user_os: P.userOs,
    device_platforms: d.devicePlatforms,
    publisher_platforms: d.publisherPlatforms,
  };
}
async function bootstrap(P, budgetCents, adSetName, status) {
  const campaign = {
    name: (CFG.naming.campaign || '{PLAT} | Scale | AppPromo | Main').replace('{PLAT}', P.label),
    objective: CFG.defaults.objective, buying_type: 'AUCTION', special_ad_categories: [], status,
    is_adset_budget_sharing_enabled: false,
    promoted_object: { application_id: P.metaAppId, object_store_url: P.storeUrl },
  };
  // iOS 14+/SKAN campaigns must declare SKAN at the campaign level (immutable after creation).
  if (P.skadnetwork) campaign.is_skadnetwork_attribution = true;
  const camp = await graph('POST', `${ACCT}/campaigns`, campaign);
  const adset = await graph('POST', `${ACCT}/adsets`, {
    name: adSetName, campaign_id: camp.id,
    optimization_goal: CFG.defaults.optimizationGoal, billing_event: CFG.defaults.billingEvent,
    bid_strategy: CFG.defaults.bidStrategy, daily_budget: budgetCents,
    promoted_object: { application_id: P.metaAppId, object_store_url: P.storeUrl },
    targeting: targeting(P), status,
  });
  return { campaignId: camp.id, adSetId: adset.id };
}

// ---- helpers ---------------------------------------------------------------
function argFlag(name) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; }
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
  const P = profile();
  const budget = Math.round(Number(argFlag('--budget') || CFG.defaults.dailyBudgetCents / 100) * 100);
  const name = argFlag('--name') || `${P.label} | Broad | Installs ${mmdd()}`;
  const status = hasFlag('--active') ? 'ACTIVE' : CFG.defaults.status;
  const { campaignId, adSetId } = await bootstrap(P, budget, name, status);
  console.log(`campaign ${campaignId}\nADSET_ID ${adSetId}  (${P.label}, $${(budget / 100).toFixed(2)}/day, ${status})`);
}
async function cmdBuild(dir) {
  if (!dir || !existsSync(dir)) die('usage: build <dir> --platform ios|android [--adset <id>] [--active] [--budget <usd>]');
  const P = profile();
  const status = hasFlag('--active') ? 'ACTIVE' : CFG.defaults.status;
  const files = readdirSync(dir).filter((f) => { const e = extname(f).toLowerCase(); return IMG_EXT.has(e) || VID_EXT.has(e); }).sort();
  if (!files.length) die(`no media in ${dir}`);
  let adSetId = argFlag('--adset');
  if (!adSetId) {
    const budget = Math.round(Number(argFlag('--budget') || CFG.defaults.dailyBudgetCents / 100) * 100);
    const b = await bootstrap(P, budget, `${P.label} | Broad | Installs ${mmdd()}`, status);
    adSetId = b.adSetId;
    console.log(`Created campaign ${b.campaignId} + ad set ${adSetId} (${P.label}, $${(budget / 100).toFixed(2)}/day, ${status})`);
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
  const j = await graph('GET', `${ACCT}/insights`, { level: 'ad', time_range: JSON.stringify({ since, until }), fields: 'ad_name,spend,impressions,inline_link_clicks,actions', limit: '500' });
  const rows = (j.data || []).filter((r) => Number(r.spend) > 0).sort((a, b) => b.spend - a.spend);
  const inst = (r) => { const a = (r.actions || []).find((x) => ['mobile_app_install', 'omni_app_install', 'app_install'].includes(x.action_type)); return a ? Number(a.value) : 0; };
  let s = 0, i = 0;
  console.log(`WagerProof — last ${n}d (${since}..${until})`);
  rows.forEach((r) => { s += Number(r.spend); i += inst(r); const cpi = inst(r) ? (r.spend / inst(r)).toFixed(2) : '—'; console.log(`  $${Number(r.spend).toFixed(2).padStart(8)}  inst ${String(inst(r)).padStart(4)}  CPI ${String(cpi).padStart(6)}  ${r.ad_name}`); });
  console.log(`  TOTAL  $${s.toFixed(2)}  installs ${i}  CPI ${i ? (s / i).toFixed(2) : '—'}`);
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
  activate: () => cmdStatus('ACTIVE', rest.filter((r) => /^\d+$/.test(r))),
  pause: () => cmdStatus('PAUSED', rest.filter((r) => /^\d+$/.test(r))),
  rename: () => cmdRename(rest[0], rest.slice(1).join(' ')),
};
if (!run[cmd]) die(`unknown command "${cmd || ''}". Commands: check, upload, bootstrap, build, list, report, activate, pause, rename`);
run[cmd]();
