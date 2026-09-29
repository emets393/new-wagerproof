// Parlay and odds math shared by the static guide renderer (Node), the
// verifier, and the browser calculator. build-guides.mjs inlines this file
// into /guides/guides-v1.js, so keep it dependency-free, side-effect-free and
// limited to top-level `export function` / `export const` declarations.

export const MIN_LEGS = 2
export const MAX_LEGS = 12

export const PARLAY_DEFAULTS = {
  stake: '10',
  format: 'auto',
  legs: [
    { odds: '-110', opposite: '', void: false },
    { odds: '-110', opposite: '', void: false },
    { odds: '+150', opposite: '', void: false },
  ],
}

// Swift/engine.ts parity: round half away from zero.
export function roundHalfAwayFromZero(value) {
  return Math.sign(value) * Math.round(Math.abs(value))
}

export function roundCents(value) {
  return roundHalfAwayFromZero(value * 100 + Math.sign(value) * 1e-9) / 100
}

function parsePlainNumber(text) {
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

function fromAmerican(value) {
  if (!Number.isFinite(value)) return { error: 'Enter American odds like -110 or +150.' }
  if (value > -100 && value < 100) {
    return { error: 'American odds must be +100 or higher, or -100 or lower.' }
  }
  return { decimal: value > 0 ? 1 + value / 100 : 1 + 100 / -value }
}

function fromDecimal(value) {
  if (!Number.isFinite(value) || value <= 1) return { error: 'Decimal odds must be greater than 1.00.' }
  return { decimal: value }
}

function fromFractional(text) {
  const match = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(text)
  if (!match) return { error: 'Enter fractional odds like 5/2 or 10/11.' }
  const numerator = Number(match[1])
  const denominator = Number(match[2])
  if (!(numerator > 0) || !(denominator > 0)) return { error: 'Both parts of fractional odds must be above zero.' }
  return { decimal: 1 + numerator / denominator }
}

/**
 * Parse one price. `format` is 'auto' | 'american' | 'decimal' | 'fractional'.
 * Auto rules: a slash is fractional; a leading + or - is American; an unsigned
 * number of 100 or more is American; any other unsigned number is decimal.
 * Returns { ok, decimal, format } or { ok: false, empty, error }.
 */
export function parseOdds(input, format = 'auto') {
  const text = String(input ?? '').trim().replace(/\s+/g, ' ').replace(/[−–]/g, '-')
  if (!text) return { ok: false, empty: true, error: 'Enter odds for this leg.' }
  const lower = text.toLowerCase()
  if (['even', 'evens', 'ev', 'evs'].includes(lower)) return { ok: true, decimal: 2, format: format === 'auto' ? 'fractional' : format }

  let detected = format
  if (format === 'auto') {
    if (text.includes('/')) detected = 'fractional'
    else if (/^[+-]/.test(text)) detected = 'american'
    else {
      const value = parsePlainNumber(text)
      if (value === null) return { ok: false, empty: false, error: 'Use American (-110), decimal (2.50) or fractional (5/2) odds.' }
      detected = value >= 100 ? 'american' : 'decimal'
    }
  }

  let result
  if (detected === 'fractional') result = fromFractional(text)
  else {
    const value = parsePlainNumber(text)
    if (value === null) {
      const hint = detected === 'american' ? 'like -110 or +150' : 'like 1.91 or 2.50'
      return { ok: false, empty: false, error: `Enter ${detected} odds ${hint}.` }
    }
    result = detected === 'american' ? fromAmerican(value) : fromDecimal(value)
  }
  if (result.error) return { ok: false, empty: false, error: result.error }
  return { ok: true, decimal: result.decimal, format: detected }
}

export function impliedProbability(decimal) {
  return 1 / decimal
}

/** American odds as a whole number, or null for decimal odds of 1.00 or less. */
export function decimalToAmerican(decimal) {
  if (!(decimal > 1)) return null
  const value = decimal >= 2 ? roundHalfAwayFromZero((decimal - 1) * 100) : roundHalfAwayFromZero(-100 / (decimal - 1))
  return Object.is(value, -0) ? 0 : value
}

export function formatAmerican(decimal) {
  const value = decimalToAmerican(decimal)
  if (value === null) return 'n/a'
  return value > 0 ? `+${value}` : `${value}`
}

export function formatDecimal(decimal) {
  return decimal.toFixed(decimal >= 1000 ? 0 : decimal >= 100 ? 2 : 4)
}

export function formatPercent(probability) {
  const percent = probability * 100
  if (percent > 0 && percent < 0.01) return '<0.01%'
  return `${percent.toFixed(2)}%`
}

export function formatMoney(amount) {
  const cents = roundCents(amount)
  const sign = cents < 0 ? '-' : ''
  const [whole, fraction] = Math.abs(cents).toFixed(2).split('.')
  return `${sign}$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`
}

export function formatSignedMoney(amount) {
  const cents = roundCents(amount)
  if (cents === 0) return '$0.00'
  return cents > 0 ? `+${formatMoney(cents)}` : formatMoney(cents)
}

/** Proportional no-vig probability for one side of a two-way market. */
export function noVigProbability(decimal, oppositeDecimal) {
  const side = 1 / decimal
  const other = 1 / oppositeDecimal
  return side / (side + other)
}

export function parseStake(input) {
  const text = String(input ?? '').trim().replace(/^\$/, '').replace(/,/g, '')
  if (!text) return { ok: false, error: 'Enter a stake.' }
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(text)) return { ok: false, error: 'Enter a stake in dollars, like 10 or 25.50.' }
  const value = Number(text)
  if (!(value > 0)) return { ok: false, error: 'The stake must be more than $0.' }
  if (value > 1e9) return { ok: false, error: 'Enter a stake under $1,000,000,000.' }
  return { ok: true, value }
}

/**
 * Full calculator state. `legs` items: { odds, opposite, void }.
 * Invalid legs block the parlay totals; void legs are dropped from the math.
 */
export function calculateParlay({ legs, stake, format = 'auto' }) {
  const stakeResult = parseStake(stake)
  const legResults = legs.map((leg) => {
    const odds = parseOdds(leg.odds, format)
    const oppositeText = String(leg.opposite ?? '').trim()
    const opposite = oppositeText ? parseOdds(oppositeText, format) : null
    const result = { void: Boolean(leg.void), odds, opposite: opposite && opposite.ok ? opposite : null, oppositeError: opposite && !opposite.ok ? opposite.error : null }
    if (odds.ok) {
      result.decimal = odds.decimal
      result.american = formatAmerican(odds.decimal)
      result.implied = impliedProbability(odds.decimal)
      if (opposite?.ok) {
        result.fairProbability = noVigProbability(odds.decimal, opposite.decimal)
        result.margin = 1 / odds.decimal + 1 / opposite.decimal - 1
      }
    }
    return result
  })

  const active = legResults.filter((leg) => !leg.void)
  const invalid = active.filter((leg) => !leg.odds.ok)
  const oppositeErrors = active.filter((leg) => leg.oppositeError)
  const output = {
    legs: legResults,
    stake: stakeResult.ok ? stakeResult.value : null,
    stakeError: stakeResult.ok ? null : stakeResult.error,
    activeCount: active.length,
    voidCount: legResults.length - active.length,
    ready: false,
  }
  if (active.length === 0) {
    output.status = 'all-void'
    return output
  }
  if (invalid.length || !stakeResult.ok) {
    output.status = 'invalid'
    return output
  }

  const decimal = active.reduce((product, leg) => product * leg.decimal, 1)
  const implied = 1 / decimal
  Object.assign(output, {
    ready: true,
    status: active.length === 1 ? 'single' : 'parlay',
    decimal,
    american: formatAmerican(decimal),
    implied,
    payout: stakeResult.value * decimal,
    profit: stakeResult.value * (decimal - 1),
  })

  const withFair = active.filter((leg) => leg.fairProbability !== undefined)
  output.fairLegCount = withFair.length
  if (withFair.length === active.length && oppositeErrors.length === 0) {
    const fairProbability = active.reduce((product, leg) => product * leg.fairProbability, 1)
    const fairDecimal = 1 / fairProbability
    output.fair = {
      probability: fairProbability,
      decimal: fairDecimal,
      american: formatAmerican(fairDecimal),
      fairPayout: stakeResult.value * fairDecimal,
      expectedValue: stakeResult.value * (fairProbability * decimal - 1),
      houseEdge: 1 - fairProbability * decimal,
    }
  }
  return output
}

export const EMPTY_VALUE = '–'
export const FAIR_PROMPT = 'Optional: add the other side’s odds to every active leg to see the no-vig price, expected value and the vig you pay.'

export function legStatsText(leg) {
  if (leg.void) return 'Push / void: removed from the parlay.'
  if (!leg.odds.ok) return ''
  const parts = [`${formatDecimal(leg.decimal)} decimal`, `${leg.american} American`, `${formatPercent(leg.implied)} implied`]
  if (leg.fairProbability !== undefined) parts.push(`${formatPercent(leg.fairProbability)} no-vig`)
  return parts.join(' · ')
}

/** Display strings for every output, shared by the static render and the browser. */
export function parlayDisplay(result) {
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`
  const display = {
    payout: EMPTY_VALUE,
    profit: EMPTY_VALUE,
    american: EMPTY_VALUE,
    decimal: EMPTY_VALUE,
    implied: EMPTY_VALUE,
    impliedSentence: '',
    status: '',
    fair: null,
    fairMessage: '',
  }
  if (result.status === 'all-void') {
    display.status = result.stake === null
      ? 'Every leg is marked push or void. Most sportsbooks refund the stake.'
      : `Every leg is marked push or void. Most sportsbooks refund the ${formatMoney(result.stake)} stake.`
    if (result.stake !== null) {
      display.payout = formatMoney(result.stake)
      display.profit = formatMoney(0)
    }
    return display
  }
  if (!result.ready) {
    display.fairMessage = FAIR_PROMPT
    const badLegs = result.legs.filter((leg) => !leg.void && !leg.odds.ok)
    if (!badLegs.length) display.status = 'Fix the stake to see the payout.'
    else if (badLegs.every((leg) => leg.odds.empty)) display.status = 'Enter odds for every leg, or remove the empty one, to see the payout.'
    else display.status = 'Fix the highlighted odds to see the payout.'
    return display
  }
  display.payout = formatMoney(result.payout)
  display.profit = formatMoney(result.profit)
  display.american = result.american
  display.decimal = formatDecimal(result.decimal)
  display.implied = formatPercent(result.implied)
  const oneIn = result.decimal >= 100 ? Math.round(result.decimal).toLocaleString('en-US') : result.decimal.toFixed(1)
  display.impliedSentence = result.status === 'single'
    ? `The book's price implies this leg wins ${formatPercent(result.implied)} of the time, about 1 in ${oneIn}.`
    : `The book's price implies this parlay hits ${formatPercent(result.implied)} of the time, about 1 in ${oneIn}.`
  if (result.status === 'single') {
    display.status = 'Only one active leg. Most sportsbooks settle this as a straight bet at that leg’s odds.'
  } else if (result.voidCount) {
    display.status = `${plural(result.voidCount, 'leg')} removed as push or void. Priced on the remaining ${plural(result.activeCount, 'leg')}.`
  }
  if (result.fair) {
    display.fair = {
      probability: formatPercent(result.fair.probability),
      american: result.fair.american,
      decimal: formatDecimal(result.fair.decimal),
      fairPayout: formatMoney(result.fair.fairPayout),
      expectedValue: formatSignedMoney(result.fair.expectedValue),
      houseEdge: result.fair.houseEdge >= 0 ? formatPercent(result.fair.houseEdge) : `None (${formatPercent(-result.fair.houseEdge)} better than fair)`,
    }
  } else if (result.fairLegCount) {
    display.fairMessage = `Other-side odds entered for ${result.fairLegCount} of ${plural(result.activeCount, 'active leg')}. Add the rest to see the fair parlay.`
  } else {
    display.fairMessage = FAIR_PROMPT
  }
  return display
}
