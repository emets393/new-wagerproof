// Smoke-test the daily widget-headline pipeline against the REAL database.
//
// Runs the full writer -> deterministic gate -> judge chain on a few games and
// prints each headline with its QC verdict. dryRun: true, so nothing is written
// to ai_completions.
//
// Prompts are inlined here (mirroring the migration's seeds) so this works before
// 20260726120000_widget_headline_summaries.sql has been applied.
//
//   npx tsx scripts/smoke-widget-summaries.mjs
//   SUMMARY_MODEL=deepseek-v4-flash npx tsx scripts/smoke-widget-summaries.mjs
//
// See .claude/docs/17_widget_headlines.md

import fs from 'fs';
for (const line of fs.readFileSync(new URL('../.env', import.meta.url),'utf8').split('\n')) {
  if (!line.includes('=') || line.trim().startsWith('#')) continue;
  const i = line.indexOf('='); const k = line.slice(0,i).trim();
  if (!process.env[k]) process.env[k] = line.slice(i+1).trim().replace(/^["']|["']$/g,'');
}
const VOICE = `

WRITING RULES:
- Output ONE sentence, max 20 words. It is rendered large and bold at the top of the widget.
- Plain English a casual bettor understands. No jargon like "EV", "vig", "CLV".
- Lead with the conclusion, not the setup.
- Use ONLY numbers present in the supplied data. Never invent or round-trip a figure.
- If the data is genuinely inconclusive, say so plainly - that is a useful answer.
- Never give betting advice or tell the user what to bet. Describe what the data shows.
- No emojis, no markdown, no quotes around the sentence.
Respond with JSON: {"headline": "<your sentence>"}`;

const prompts = {
  'market_odds:mlb': `You summarize a prediction-market (Polymarket) widget for a single game. You are given the market's implied win probabilities for the moneyline, the spread and the total, alongside the sportsbook lines. Say what the prediction market believes.\n\nTREAT EACH MARKET SEPARATELY. The side favored on the moneyline is frequently NOT the side favored on the spread, and the total is a separate question again. Never carry a conclusion from one market over to another.\nOnly mention a disagreement with the sportsbook when the two genuinely differ by a wide margin. If they broadly agree, just say what the market believes - do not manufacture a gap. You are given sportsbook PRICES, not sportsbook probabilities, so do not claim a numeric gap between the two unless it is obvious.\nIf a market is missing from the data, do not mention it. Prefer describing ONE market clearly over cramming all three in.` + VOICE,
  'ou_prediction:mlb': `You summarize the model's total (over/under) projection for one MLB game. You are given the model's projected run total, the Vegas total, the resulting edge, and the first-5-innings equivalents where available. State which side the model leans and by how many runs.` + VOICE,
  'moneyline_prediction:mlb': `You summarize the model's moneyline projection for one MLB game. You are given the model's win probability for each side, the Vegas moneyline prices, the edge percentage, and the first-5-innings equivalents. Name the side the model favors and how strongly. If the model and the market agree, say that plainly.` + VOICE,
};

const { runDailySummaries } = await import('../src/summaries/runDailySummaries.ts');
const res = await runDailySummaries({
  targetDate: '2026-07-25', sports: ['mlb'], maxGames: 3, dryRun: true,
  promptOverrides: prompts,
  onResult: r => {
    console.log(`\n[${r.qcStatus.toUpperCase()}] ${r.matchup} — ${r.widget}`);
    console.log(`   "${r.headline}"`);
    if (r.qcNotes) console.log(`   qc: ${r.qcNotes}`);
  },
});
console.log('\n--- summary ---'); console.log(JSON.stringify(res, null, 2));
