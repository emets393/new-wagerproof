// Optional guide.json blocks that render outside content.md:
//   "tool":  an interactive, server-rendered tool (currently "parlay-calculator")
//   "video": a click-to-load YouTube facade plus VideoObject JSON-LD
// Both render useful static HTML with JavaScript off; /guides/guides-v1.js
// enhances them through data attributes only.
import {
  MAX_LEGS,
  MIN_LEGS,
  PARLAY_DEFAULTS,
  calculateParlay,
  legStatsText,
  parlayDisplay,
} from '../../src/lib/parlay-math.js'

export const SUPPORTED_TOOLS = ['parlay-calculator']
export const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
export const ISO_DURATION_PATTERN = /^P(?!$)(?:\d+D)?(?:T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function absolute(siteUrl, value) {
  return /^https?:\/\//.test(value) ? value : `${siteUrl}${value}`
}

export function validateTool(meta, context) {
  if (meta.tool === undefined) return
  if (!SUPPORTED_TOOLS.includes(meta.tool)) {
    throw new Error(`${context}: unsupported tool ${meta.tool}; supported: ${SUPPORTED_TOOLS.join(', ')}`)
  }
}

export function validateVideo(meta, context) {
  if (meta.video === undefined) return
  const video = meta.video
  if (!video || typeof video !== 'object' || Array.isArray(video)) throw new Error(`${context}: video must be an object`)
  for (const key of ['title', 'description', 'uploadDate', 'duration', 'thumbnail']) {
    if (typeof video[key] !== 'string' || !video[key].trim()) throw new Error(`${context}.video: missing non-empty ${key}`)
  }
  if (video.youtubeId !== undefined && video.youtubeId !== '' && !YOUTUBE_ID_PATTERN.test(video.youtubeId)) {
    throw new Error(`${context}.video: youtubeId must be an 11-character YouTube ID`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(video.uploadDate) || Number.isNaN(Date.parse(`${video.uploadDate}T00:00:00Z`))) {
    throw new Error(`${context}.video: uploadDate must be YYYY-MM-DD`)
  }
  if (!ISO_DURATION_PATTERN.test(video.duration)) throw new Error(`${context}.video: duration must be ISO 8601, like PT4M12S`)
  if (!/^\/guides\/[a-z0-9\-/]+\.webp$/.test(video.thumbnail)) {
    throw new Error(`${context}.video: thumbnail must be a local /guides/ .webp file`)
  }
}

export function hasPublishedVideo(guide) {
  return Boolean(guide.video?.youtubeId)
}

export function formatIsoDuration(duration) {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(duration)
  if (!match) return ''
  const [, days = 0, hours = 0, minutes = 0, seconds = 0] = match.map((value) => Number(value || 0))
  const totalHours = Number(days) * 24 + Number(hours)
  const pad = (value) => String(value).padStart(2, '0')
  return totalHours ? `${totalHours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

export function videoSchema(guide, siteUrl) {
  if (!hasPublishedVideo(guide)) return null
  const { video } = guide
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.description,
    thumbnailUrl: [absolute(siteUrl, video.thumbnail)],
    uploadDate: video.uploadDate,
    duration: video.duration,
    contentUrl: `https://www.youtube.com/watch?v=${video.youtubeId}`,
    embedUrl: `https://www.youtube.com/embed/${video.youtubeId}`,
  }
}

export function renderVideo(guide) {
  if (!hasPublishedVideo(guide)) return ''
  const { video } = guide
  const watchUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`
  const length = formatIsoDuration(video.duration)
  return `<figure class="guide-video" id="video"><div class="guide-video__frame" data-youtube-embed data-youtube-id="${escapeHtml(video.youtubeId)}" data-youtube-title="${escapeHtml(video.title)}"><a class="guide-video__link" href="${escapeHtml(watchUrl)}" rel="noopener noreferrer"><img src="${escapeHtml(video.thumbnail)}" width="1280" height="720" alt="" loading="lazy" decoding="async" /><span class="guide-video__play" aria-hidden="true"><svg viewBox="0 0 68 48"><path d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.3.3 34 .3 34 .3s-21.3 0-26.5 1.4a8.5 8.5 0 0 0-6 6C.1 12.9.1 24 .1 24s0 11.1 1.4 16.3a8.5 8.5 0 0 0 6 6C12.7 47.7 34 47.7 34 47.7s21.3 0 26.5-1.4a8.5 8.5 0 0 0 6-6C67.9 35.1 67.9 24 67.9 24s0-11.1-1.4-16.3Z" /><path class="guide-video__triangle" d="m27 34 18-10-18-10z" /></svg></span><span class="sr-only">Play video: ${escapeHtml(video.title)}</span></a></div><figcaption><strong>${escapeHtml(video.title)}</strong>${length ? ` <span>${escapeHtml(length)}</span>` : ''} ${escapeHtml(video.description)} The video loads from YouTube when you press play.</figcaption></figure>`
}

function legMarkup(leg, result, index, legCount) {
  const n = index + 1
  const oddsMsg = result.odds.ok || result.void ? '' : result.odds.error
  return `<li class="pc-leg${result.void ? ' is-void' : ''}" data-pc-leg>
<div class="pc-leg__top"><span class="pc-leg__label" data-pc-leg-label>Leg ${n}</span><label class="pc-leg__void"><input type="checkbox" name="void" data-pc-void${leg.void ? ' checked' : ''} /> <span>Push / void</span></label><button class="pc-leg__remove" type="button" data-pc-remove aria-label="Remove leg ${n}" hidden${legCount <= MIN_LEGS ? ' disabled' : ''}>Remove</button></div>
<div class="pc-leg__fields">
<div class="pc-field"><label for="pc-odds-${n}" data-pc-for="odds">Odds</label><input id="pc-odds-${n}" name="odds" type="text" inputmode="text" autocomplete="off" spellcheck="false" value="${escapeHtml(leg.odds)}" data-pc-odds aria-describedby="pc-odds-${n}-msg"${oddsMsg ? ' aria-invalid="true"' : ''} /><p class="pc-msg" id="pc-odds-${n}-msg" data-pc-odds-msg>${escapeHtml(oddsMsg)}</p></div>
<div class="pc-field pc-field--opposite"><label for="pc-opposite-${n}" data-pc-for="opposite">Other side <span>optional</span></label><input id="pc-opposite-${n}" name="opposite" type="text" inputmode="text" autocomplete="off" spellcheck="false" value="${escapeHtml(leg.opposite)}" placeholder="e.g. -110" data-pc-opposite aria-describedby="pc-opposite-${n}-msg" /><p class="pc-msg" id="pc-opposite-${n}-msg" data-pc-opposite-msg>${escapeHtml(result.oppositeError || '')}</p></div>
</div>
<p class="pc-leg__stats" data-pc-leg-stats>${escapeHtml(legStatsText(result))}</p>
</li>`
}

export function renderParlayCalculator(state = PARLAY_DEFAULTS) {
  const result = calculateParlay(state)
  const display = parlayDisplay(result)
  const fair = display.fair
  const formatOptions = [
    ['auto', 'Auto-detect'],
    ['american', 'American (-110)'],
    ['decimal', 'Decimal (2.50)'],
    ['fractional', 'Fractional (5/2)'],
  ].map(([value, label]) => `<option value="${value}"${state.format === value ? ' selected' : ''}>${label}</option>`).join('')
  return `<section class="guide-tool section-shell" id="calculator" aria-labelledby="parlay-calc-title">
<form class="parlay-calc" data-parlay-calculator data-max-legs="${MAX_LEGS}" data-min-legs="${MIN_LEGS}" novalidate>
<div class="parlay-calc__head"><div><p class="eyebrow">Free tool</p><h2 id="parlay-calc-title">Parlay calculator</h2></div><div class="pc-field pc-field--format"><label for="pc-format">Odds format</label><select id="pc-format" name="format" data-pc-format>${formatOptions}</select></div></div>
<p class="parlay-calc__hint" id="pc-hint">Type American (-110, +150), decimal (2.50) or fractional (5/2) odds. The format is detected for each price. Add the other side of a leg to remove the vig.</p>
<div class="parlay-calc__grid">
<div class="parlay-calc__inputs">
<ol class="pc-legs" data-pc-legs>${state.legs.map((leg, index) => legMarkup(leg, result.legs[index], index, state.legs.length)).join('')}</ol>
<div class="pc-actions"><button class="pc-button" type="button" data-pc-add hidden${state.legs.length >= MAX_LEGS ? ' disabled' : ''}><span aria-hidden="true">+</span> Add leg</button><button class="pc-button pc-button--quiet" type="button" data-pc-reset hidden>Reset example</button><p class="pc-count" data-pc-count hidden>${state.legs.length} of ${MAX_LEGS} legs</p></div>
<noscript><p class="pc-noscript">JavaScript is off, so this shows the worked example. Turn it on to enter your own legs.</p></noscript>
</div>
<div class="parlay-calc__results">
<div class="pc-field pc-field--stake"><label for="pc-stake">Stake</label><div class="pc-money"><span aria-hidden="true">$</span><input id="pc-stake" name="stake" type="text" inputmode="decimal" autocomplete="off" value="${escapeHtml(state.stake)}" data-pc-stake aria-describedby="pc-stake-msg" /></div><p class="pc-msg" id="pc-stake-msg" data-pc-stake-msg>${escapeHtml(result.stakeError || '')}</p></div>
<dl class="pc-results">
<div class="pc-result pc-result--primary"><dt>Total payout</dt><dd data-pc-out="payout">${escapeHtml(display.payout)}</dd></div>
<div class="pc-result"><dt>Profit</dt><dd data-pc-out="profit">${escapeHtml(display.profit)}</dd></div>
<div class="pc-result"><dt>Parlay odds</dt><dd data-pc-out="american">${escapeHtml(display.american)}</dd></div>
<div class="pc-result"><dt>Decimal odds</dt><dd data-pc-out="decimal">${escapeHtml(display.decimal)}</dd></div>
</dl>
<p class="pc-implied" data-pc-out="impliedSentence" aria-live="polite">${escapeHtml(display.impliedSentence)}</p>
<p class="pc-status" data-pc-out="status" aria-live="polite"${display.status ? '' : ' hidden'}>${escapeHtml(display.status)}</p>
<div class="pc-fair" data-pc-fair>
<h3>Remove the vig <span>optional</span></h3>
<p class="pc-fair__empty" data-pc-out="fairMessage"${fair ? ' hidden' : ''}>${escapeHtml(display.fairMessage)}</p>
<dl class="pc-fair__results" data-pc-fair-results${fair ? '' : ' hidden'}>
<div><dt>Fair chance all legs hit</dt><dd data-pc-fair-out="probability">${escapeHtml(fair?.probability || '')}</dd></div>
<div><dt>Fair parlay odds</dt><dd><span data-pc-fair-out="american">${escapeHtml(fair?.american || '')}</span> <small>(<span data-pc-fair-out="decimal">${escapeHtml(fair?.decimal || '')}</span>)</small></dd></div>
<div><dt>Fair payout</dt><dd data-pc-fair-out="fairPayout">${escapeHtml(fair?.fairPayout || '')}</dd></div>
<div><dt>Expected value at this stake</dt><dd data-pc-fair-out="expectedValue">${escapeHtml(fair?.expectedValue || '')}</dd></div>
<div><dt>Vig you’re paying</dt><dd data-pc-fair-out="houseEdge">${escapeHtml(fair?.houseEdge || '')}</dd></div>
</dl>
</div>
</div>
</div>
<div class="pc-notes">
<p><strong>Push or void:</strong> tick the box on that leg. Most sportsbooks drop a pushed or voided leg and pay the parlay at the remaining legs’ odds, but house rules vary, so check yours.</p>
<p><strong>Same-game parlays:</strong> legs from one game are often correlated, so this independent-leg math is only an approximation. Books price same-game parlays with their own correlation adjustments.</p>
<p><strong>No-vig numbers are estimates.</strong> They use proportional margin removal on the two prices you enter. They are not true probabilities or a prediction.</p>
</div>
</form>
</section>`
}

export function renderGuideTool(guide) {
  if (guide.tool === 'parlay-calculator') return renderParlayCalculator()
  return ''
}
