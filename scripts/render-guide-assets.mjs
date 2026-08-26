import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import puppeteer from 'puppeteer'

const ROOT = process.cwd()
const CONTENT_DIR = path.join(ROOT, 'content', 'guides')
const PUBLIC_DIR = path.join(ROOT, 'public')

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

async function dataUrl(relativePath, mime = 'image/png') {
  const bytes = await fs.readFile(path.join(PUBLIC_DIR, relativePath.replace(/^\//, '')))
  return `data:${mime};base64,${bytes.toString('base64')}`
}

function motifFor(slug) {
  const motifs = {
    'implied-probability-vs-true-probability': '<div class="probability-ring"><span>p</span></div><div class="calibration-line"></div>',
    'closing-line-value-sports-betting': '<div class="price-marker marker-a">ENTRY</div><div class="price-axis"></div><div class="price-marker marker-b">CLOSE</div>',
    'how-to-read-line-movement': '<div class="movement-line"><i></i><i></i><i></i></div>',
    'player-prop-research-guide': '<div class="distribution"><i></i></div><div class="player-disc"></div>',
    'how-wagerproof-analysis-works': '<div class="method-flow"><i>MARKET</i><b></b><i>MODEL</i><b></b><i>GRADE</i></div>',
    'accurate-betting-performance-tracking-checklist': '<div class="ledger"><i></i><i></i><i></i><i></i></div>',
    'prediction-markets-vs-sportsbook-odds': '<div class="split-lane"><i>CONTRACT</i><b></b><i>ODDS</i></div>',
    'responsible-sports-betting-research': '<div class="limits"><i>TIME</i><i>LIMIT</i><i>STOP</i></div>',
  }
  return motifs[slug] || '<div class="probability-ring"><span>p</span></div>'
}

function sharedStyles(width, height, background) {
  const scale = width / 1672
  return `
    * { box-sizing: border-box; }
    html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
    body { font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #f7f5ed; }
    .canvas { position: relative; width: 100%; height: 100%; overflow: hidden; background: #07100b; }
    .canvas::before { content: ""; position: absolute; inset: 0; background: linear-gradient(100deg, rgba(4,12,8,.92) 0%, rgba(7,27,16,.8) 46%, rgba(244,237,221,.16) 100%), url('${background}') center/cover; }
    .canvas::after { content: ""; position: absolute; inset: 0; border: ${Math.max(1, 2 * scale)}px solid rgba(227,244,233,.16); pointer-events: none; }
    .grain { position:absolute; inset:0; opacity:.16; background-image: radial-gradient(rgba(255,255,255,.45) .55px, transparent .55px); background-size:${Math.max(3, 5 * scale)}px ${Math.max(3, 5 * scale)}px; mix-blend-mode:soft-light; }
    .topline { position:absolute; left:${96 * scale}px; top:${76 * scale}px; display:flex; gap:${18 * scale}px; align-items:center; font-weight:750; letter-spacing:.12em; font-size:${20 * scale}px; text-transform:uppercase; color:#bdeccc; }
    .topline::before { content:""; width:${54 * scale}px; height:${4 * scale}px; border-radius:99px; background:#4ade80; box-shadow:0 0 ${28 * scale}px rgba(74,222,128,.6); }
    .copy { position:absolute; z-index:2; left:${96 * scale}px; bottom:${82 * scale}px; width:${890 * scale}px; }
    h1 { margin:0; font-family: Georgia, "Times New Roman", serif; font-weight:700; letter-spacing:-.044em; line-height:.94; font-size:${76 * scale}px; text-wrap:balance; text-shadow:0 ${4 * scale}px ${28 * scale}px rgba(0,0,0,.28); }
    .rule { margin-top:${34 * scale}px; width:${190 * scale}px; height:${5 * scale}px; border-radius:99px; background:linear-gradient(90deg,#4ade80,#d9b56d); }
    .mark { position:absolute; z-index:3; right:${84 * scale}px; top:${68 * scale}px; width:${82 * scale}px; height:${82 * scale}px; padding:${5 * scale}px; border-radius:${22 * scale}px; background:rgba(248,245,235,.88); box-shadow:0 ${20 * scale}px ${50 * scale}px rgba(0,0,0,.28); }
    .mark img { width:100%; height:100%; object-fit:cover; border-radius:${17 * scale}px; }
    .motif { position:absolute; z-index:2; right:${112 * scale}px; bottom:${110 * scale}px; width:${490 * scale}px; height:${400 * scale}px; color:#dff8e7; }
    .probability-ring { position:absolute; right:${20 * scale}px; top:${12 * scale}px; width:${300 * scale}px; height:${300 * scale}px; border:${24 * scale}px solid rgba(74,222,128,.22); border-top-color:#80e8a2; border-right-color:#d9b56d; border-radius:50%; transform:rotate(-26deg); box-shadow:inset 0 0 ${60 * scale}px rgba(74,222,128,.08), 0 0 ${80 * scale}px rgba(74,222,128,.08); }
    .probability-ring span { position:absolute; inset:0; display:grid; place-items:center; transform:rotate(26deg); font:italic 700 ${92 * scale}px Georgia,serif; color:#f6f1e5; }
    .calibration-line { position:absolute; left:0; right:0; bottom:${42 * scale}px; height:${2 * scale}px; background:rgba(226,245,232,.35); }
    .calibration-line::before,.calibration-line::after { content:""; position:absolute; bottom:${-9 * scale}px; width:${20 * scale}px; height:${20 * scale}px; border-radius:50%; background:#4ade80; }
    .calibration-line::before { left:18%; } .calibration-line::after { right:18%; background:#d9b56d; }
    .price-axis { position:absolute; left:4%; right:4%; top:52%; height:${3 * scale}px; background:linear-gradient(90deg,#4ade80,#d9b56d); }
    .price-marker { position:absolute; top:35%; padding:${15 * scale}px ${20 * scale}px; border:1px solid rgba(255,255,255,.28); border-radius:${13 * scale}px; background:rgba(5,20,11,.72); font-size:${18 * scale}px; letter-spacing:.12em; }
    .price-marker::after { content:""; position:absolute; left:50%; top:100%; width:${2 * scale}px; height:${105 * scale}px; background:currentColor; opacity:.6; }
    .marker-a { left:5%; color:#86efac; } .marker-b { right:6%; color:#e8c986; }
    .movement-line { position:absolute; left:0; right:0; top:10%; bottom:10%; border-left:${2 * scale}px solid rgba(255,255,255,.24); border-bottom:${2 * scale}px solid rgba(255,255,255,.24); }
    .movement-line::before { content:""; position:absolute; left:5%; top:62%; width:90%; height:36%; border-top:${6 * scale}px solid #69e494; border-radius:50%; transform:rotate(-13deg); }
    .movement-line i { position:absolute; width:${22 * scale}px; height:${22 * scale}px; border-radius:50%; background:#f4e8cf; box-shadow:0 0 ${30 * scale}px rgba(244,232,207,.4); }
    .movement-line i:nth-child(1){left:10%;top:68%}.movement-line i:nth-child(2){left:50%;top:44%}.movement-line i:nth-child(3){right:5%;top:12%;background:#d9b56d}
    .distribution { position:absolute; left:5%; right:5%; bottom:12%; height:55%; border-bottom:${2 * scale}px solid rgba(255,255,255,.28); }
    .distribution::before { content:""; position:absolute; inset:8% 0 0; border-top:${7 * scale}px solid #6ee7a0; border-radius:50%; }
    .distribution i { position:absolute; left:62%; bottom:${-11 * scale}px; width:${22 * scale}px; height:${22 * scale}px; border-radius:50%; background:#d9b56d; }
    .player-disc { position:absolute; left:5%; top:8%; width:${110 * scale}px; height:${110 * scale}px; border-radius:50%; background:linear-gradient(145deg,#f4e8cf,#69e494); box-shadow:0 0 0 ${18 * scale}px rgba(74,222,128,.12); }
    .method-flow { position:absolute; inset:16% 0; display:flex; align-items:center; justify-content:center; gap:${12 * scale}px; }
    .method-flow i { width:${130 * scale}px; height:${112 * scale}px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.3); border-radius:${18 * scale}px; background:rgba(6,24,13,.68); font-style:normal; font-weight:800; font-size:${16 * scale}px; letter-spacing:.08em; }
    .method-flow b { width:${40 * scale}px; height:${3 * scale}px; background:#69e494; position:relative; }
    .method-flow b::after { content:""; position:absolute; right:0; top:${-5 * scale}px; border-left:${12 * scale}px solid #69e494; border-top:${6 * scale}px solid transparent; border-bottom:${6 * scale}px solid transparent; }
    .ledger { position:absolute; inset:8%; display:grid; grid-template-rows:repeat(4,1fr); border:${2 * scale}px solid rgba(255,255,255,.26); border-radius:${18 * scale}px; overflow:hidden; transform:rotate(-3deg); background:rgba(6,24,13,.58); }
    .ledger i { border-bottom:${2 * scale}px solid rgba(255,255,255,.18); background:linear-gradient(90deg,rgba(74,222,128,.18) 0 24%,transparent 24% 50%,rgba(217,181,109,.14) 50% 70%,transparent 70%); }
    .split-lane { position:absolute; inset:12% 0; display:grid; grid-template-columns:1fr ${75 * scale}px 1fr; align-items:center; gap:${10 * scale}px; }
    .split-lane i { height:${170 * scale}px; display:grid; place-items:center; border-radius:${26 * scale}px; border:1px solid rgba(255,255,255,.28); font-style:normal; font-weight:850; letter-spacing:.1em; background:rgba(8,27,15,.66); }
    .split-lane b { height:${6 * scale}px; background:linear-gradient(90deg,#4ade80,#d9b56d); }
    .limits { position:absolute; inset:13% 2%; display:grid; grid-template-columns:repeat(3,1fr); gap:${16 * scale}px; align-items:center; }
    .limits i { aspect-ratio:1; display:grid; place-items:center; border-radius:50%; border:${5 * scale}px solid rgba(126,236,161,.65); background:rgba(6,24,13,.65); font-style:normal; font-weight:850; font-size:${17 * scale}px; letter-spacing:.09em; }
    .limits i:nth-child(2){border-color:rgba(232,201,134,.75)}
    @media (max-width: 1300px) {
      .copy { width:${710 * scale}px; }
      h1 { font-size:${68 * scale}px; }
      .motif { opacity:.72; right:${40 * scale}px; }
    }
  `
}

function standardHtml(meta, assets, width, height) {
  const background = assets.background
  return `<!doctype html><html><head><style>${sharedStyles(width, height, background)}</style></head><body>
    <main class="canvas">
      <div class="grain"></div>
      <div class="topline">WagerProof Guides · ${escapeHtml(meta.category)}</div>
      <div class="mark"><img src="${assets.brand}" alt="" /></div>
      <section class="copy"><h1>${escapeHtml(meta.shortTitle)}</h1><div class="rule"></div></section>
      <div class="motif">${motifFor(meta.slug)}</div>
    </main>
  </body></html>`
}

function featureHtml(meta, assets, width, height) {
  const scale = width / 1672
  const cards = assets.icons.slice(1).map((src, index) => {
    const offset = index - 3
    const left = 350 + offset * 72
    const top = 70 + Math.abs(offset) * 42
    return `<img src="${src}" style="left:${left * scale}px;top:${top * scale}px;transform:translateX(-50%) rotate(${offset * 8}deg)" alt="" />`
  }).join('')
  return `<!doctype html><html><head><style>
    ${sharedStyles(width, height, assets.background)}
    .copy { width:${700 * scale}px; bottom:${88 * scale}px; }
    h1 { font-size:${70 * scale}px; }
    .icon-fan { position:absolute; z-index:2; right:${78 * scale}px; top:${140 * scale}px; width:${700 * scale}px; height:${610 * scale}px; }
    .icon-fan img { position:absolute; width:${180 * scale}px; height:${180 * scale}px; object-fit:cover; border-radius:${42 * scale}px; border:${5 * scale}px solid rgba(244,240,225,.85); box-shadow:0 ${22 * scale}px ${45 * scale}px rgba(0,0,0,.34); }
    .icon-fan .hero-icon { width:${300 * scale}px; height:${300 * scale}px; left:50%; top:${230 * scale}px; z-index:10; border-radius:${70 * scale}px; transform:translateX(-50%); }
    .mark { display:none; }
  </style></head><body><main class="canvas"><div class="grain"></div><div class="topline">WagerProof Guides · 2026 comparison</div><section class="copy"><h1>Best sports betting research apps</h1><div class="rule"></div></section><div class="icon-fan">${cards}<img class="hero-icon" src="${assets.icons[0]}" alt="" /></div></main></body></html>`
}

function releaseHtml(meta, assets, width, height) {
  const scale = width / 1672
  const screens = assets.screens.map((src, index) => {
    const right = 120 + index * 125
    const top = index * 30
    const rotate = (index - 1) * -7
    return `<img src="${src}" style="right:${right * scale}px;top:${top * scale}px;transform:rotate(${rotate}deg)" alt="" />`
  }).join('')
  return `<!doctype html><html><head><style>
    ${sharedStyles(width, height, assets.background)}
    .copy { width:${660 * scale}px; }
    .version { font:800 ${138 * scale}px/1 Inter,sans-serif; letter-spacing:-.06em; color:#f5f1e6; }
    .release-icon { position:absolute; z-index:4; left:${90 * scale}px; top:${170 * scale}px; width:${220 * scale}px; height:${220 * scale}px; border-radius:${52 * scale}px; box-shadow:0 ${28 * scale}px ${60 * scale}px rgba(0,0,0,.38); }
    .screens { position:absolute; z-index:2; right:${40 * scale}px; top:${78 * scale}px; width:${720 * scale}px; height:${790 * scale}px; }
    .screens img { position:absolute; height:${650 * scale}px; width:auto; border-radius:${35 * scale}px; border:${5 * scale}px solid rgba(244,240,225,.78); box-shadow:0 ${26 * scale}px ${60 * scale}px rgba(0,0,0,.45); }
    .mark { display:none; }
  </style></head><body><main class="canvas"><div class="grain"></div><div class="topline">WagerProof · iOS release</div><img class="release-icon" src="${assets.brand}" alt="" /><section class="copy"><div class="version">3.5.9</div><h1>Football, Systems, and agent consensus</h1><div class="rule"></div></section><div class="screens">${screens}</div></main></body></html>`
}

async function render(page, meta, assets, width, height, outputPath) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  const html = meta.layout === 'feature'
    ? featureHtml(meta, assets, width, height)
    : meta.layout === 'release'
      ? releaseHtml(meta, assets, width, height)
      : standardHtml(meta, assets, width, height)
  await page.setContent(html, { waitUntil: 'load' })
  await page.screenshot({ path: outputPath, type: 'webp', quality: 92 })
}

async function main() {
  const registry = JSON.parse(await fs.readFile(path.join(CONTENT_DIR, 'registry.json'), 'utf8'))
  const background = await dataUrl('/guides/art/probability-field-ai-v1.png')
  const brand = await dataUrl('/guides/brand/wagerproof-app-icon-v1.png')
  const iconSlugs = ['wagerproof', 'juice', 'oddsjam', 'outlier', 'props-cash', 'pikkit', 'action-network', 'rithmm']
  const icons = await Promise.all(iconSlugs.map((slug) => dataUrl(`/guides/icons/${slug}-app-icon-v1.jpg`, 'image/jpeg')))
  const screens = await Promise.all(['games', 'outliers', 'agents-hq'].map((slug) => dataUrl(`/guides/screenshots/${slug}-v3-5-9.jpg`, 'image/jpeg')))

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  try {
    for (const entry of registry.entries) {
      const guidePath = path.join(CONTENT_DIR, entry.slug, 'guide.json')
      const meta = JSON.parse(await fs.readFile(guidePath, 'utf8'))
      const outDir = path.join(PUBLIC_DIR, 'guides', entry.slug)
      await fs.mkdir(outDir, { recursive: true })
      const master = path.join(outDir, `${entry.slug}-title-card-v1.webp`)
      const social = path.join(outDir, `${entry.slug}-social-v1.webp`)
      const assets = { background, brand, icons, screens }
      await render(page, meta, assets, 1672, 941, master)
      await render(page, meta, assets, 1200, 630, social)
      console.log(`Rendered ${entry.slug}`)
    }
  } finally {
    await page.close()
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
