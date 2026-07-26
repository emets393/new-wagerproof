// Writer -> deterministic gate -> LLM judge, for one widget headline.
//
// The two-stage check is deliberate. Deterministic code catches the failures that
// are cheap and certain to detect (a number that appears nowhere in the payload, a
// team that isn't playing in this game, a sentence that runs long). The judge
// catches the one thing code cannot: a sentence whose every number is real but
// whose CLAIM is wrong — "Pittsburgh is favored" when the data says otherwise.
//
// Running the cheap gate first also means obviously-broken drafts never reach the
// judge, which is the expensive call.
//
// This is the repo's first LLM-as-judge; every other validator (submitPicks.ts,
// the zod schemas, loopGuards) is deterministic.

import type { WidgetPayload } from "./widgetPayloads";

export interface HeadlineResult {
  headline: string;
  qcStatus: "pass" | "corrected" | "fail";
  qcNotes: string | null;
  writerModel: string;
  judgeModel: string;
  usage: { inTok: number; outTok: number };
}

interface ProviderOpts {
  url: string;
  apiKey: string;
  model: string;
}

const MAX_WORDS = 24;

/**
 * Chat-completions call returning parsed JSON.
 *
 * Retries once on an empty or unparseable body: reasoning-style models
 * occasionally spend the whole completion budget before emitting content, which
 * shows up as `content: ""` rather than an error status.
 */
async function callJson(
  opts: ProviderOpts,
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<{ parsed: Record<string, unknown>; inTok: number; outTok: number }> {
  let inTok = 0;
  let outTok = 0;
  let lastErr = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(opts.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        // One sentence, or a small judge object — but leave headroom so a model
        // that thinks before answering still has budget left to answer.
        max_tokens: 1200,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`LLM ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    }
    const body = (await res.json()) as Record<string, any>;
    inTok += Number(body?.usage?.prompt_tokens ?? 0);
    outTok += Number(body?.usage?.completion_tokens ?? 0);

    const text = body?.choices?.[0]?.message?.content;
    if (typeof text === "string" && text.trim()) {
      // Some providers still fence JSON despite response_format.
      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      try {
        return { parsed: JSON.parse(cleaned) as Record<string, unknown>, inTok, outTok };
      } catch {
        lastErr = `non-JSON: ${cleaned.slice(0, 120)}`;
      }
    } else {
      lastErr = "empty message content";
    }
  }
  throw new Error(`LLM returned ${lastErr}`);
}

/** Every number mentioned anywhere in the payload, as strings, for citation checking. */
function numbersIn(value: unknown, acc = new Set<string>()): Set<string> {
  if (value === null || value === undefined) return acc;
  if (typeof value === "number") {
    acc.add(String(value));
    acc.add(String(Math.round(value)));
    acc.add(Math.abs(value).toFixed(1));
    acc.add(String(Math.abs(Math.round(value))));
  } else if (typeof value === "string") {
    for (const m of value.matchAll(/-?\d+(?:\.\d+)?/g)) {
      acc.add(m[0]);
      acc.add(m[0].replace("-", ""));
    }
  } else if (Array.isArray(value)) {
    value.forEach((v) => numbersIn(v, acc));
  } else if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((v) => numbersIn(v, acc));
  }
  return acc;
}

/**
 * Cheap structural checks. Returns a list of problems; empty means "worth judging".
 * Deliberately conservative — it should only reject things that are definitely
 * wrong, because a false reject costs a headline the user would have liked.
 */
export function deterministicIssues(headline: string, payload: WidgetPayload): string[] {
  const issues: string[] = [];
  const text = headline.trim();

  if (!text) return ["empty headline"];
  if (text.split(/\s+/).length > MAX_WORDS) {
    issues.push(`too long (${text.split(/\s+/).length} words, max ${MAX_WORDS})`);
  }
  if (/\bhttps?:\/\//i.test(text)) issues.push("contains a URL");
  if (/[*_`#]|\n/.test(text)) issues.push("contains markdown or a line break");

  // Any number in the sentence must trace back to the payload. Percentages are
  // allowed to be the rounded form of a payload probability, so check both.
  const known = numbersIn(payload.data);
  for (const m of text.matchAll(/-?\d+(?:\.\d+)?/g)) {
    const raw = m[0];
    const bare = raw.replace("-", "");
    const rounded = String(Math.round(Number(bare)));
    if (!known.has(raw) && !known.has(bare) && !known.has(rounded)) {
      issues.push(`cites ${raw}, which does not appear in the data`);
    }
  }

  // A team named in the sentence must be one of the two playing. Accept EVERY word
  // of either club's name — a headline may say "Washington", "Nationals", or
  // "Washington Nationals", and matching only the nickname rejected all the city
  // forms as unknown teams.
  const teams = [payload.away_team, payload.home_team]
    .flatMap((t) => t.trim().split(/\s+/))
    .map((w) => w.toLowerCase())
    .filter(Boolean);
  const capitalized = text.match(/\b[A-Z][a-z]{3,}\b/g) ?? [];
  for (const word of capitalized) {
    const w = word.toLowerCase();
    // Only flag words that look like a team reference we don't recognise; ordinary
    // sentence-initial words are common, so require it to not be the first word.
    if (text.trim().startsWith(word)) continue;
    if (/^(over|under|vegas|model|both|this|that|prediction|market|there|their|they|when|while|with|from|these|those)$/.test(w)) continue;
    if (teams.length > 0 && !teams.includes(w) && /^[A-Z]/.test(word)) {
      // Not conclusive on its own — proper nouns like "Statcast" are legitimate.
      // Left to the judge; recorded only when it is clearly a team-shaped claim.
      if (/\b(win|cover|beat|favored|favou?rite)\b/i.test(text)) {
        issues.push(`names "${word}", which is not a team in this game`);
      }
    }
  }
  return issues;
}

const JUDGE_SYSTEM = `You are a fact-checker for one-sentence sports-betting summaries.

You receive DATA (JSON) and a HEADLINE written from it. Decide whether the headline
is an accurate, non-misleading summary of that data.

Reject the headline if ANY of these are true:
- It states a conclusion the data does not support (e.g. calls a side favored when
  the probabilities say otherwise, or claims a disagreement that is not there).
- It cites a number that is absent from the data, or misattributes one (a Vegas
  number described as the model's, or vice versa).
- It names the wrong team for the claim it makes.
- It gives betting advice or tells the reader what to bet.
- It reads as confident when the underlying numbers are near a coin flip.

Do NOT reject for style, tone, brevity, or for leaving out data you would have
mentioned. Omission is fine; being WRONG is not.

If the headline is nearly right and you can fix it by changing only the wrong part,
return the fix in "corrected". Do not rewrite a correct headline.

Respond with JSON:
{"verdict":"pass"|"corrected"|"fail","reason":"<one short sentence>","corrected":"<only when verdict is corrected>"}`;

/**
 * Write one headline and quality-check it.
 * Returns qcStatus 'fail' with the draft intact when the headline should be
 * withheld — the caller persists the row either way so failures stay auditable.
 */
export async function generateHeadline(
  payload: WidgetPayload,
  systemPrompt: string,
  provider: ProviderOpts,
  signal?: AbortSignal,
): Promise<HeadlineResult> {
  const dataJson = JSON.stringify(payload.data, null, 2);
  const userPrompt = `Game: ${payload.matchup}\nAway team: ${payload.away_team}\nHome team: ${payload.home_team}\n\nData:\n${dataJson}`;

  const draft = await callJson(provider, systemPrompt, userPrompt, signal);
  const headline = String(draft.parsed.headline ?? "").trim();
  let inTok = draft.inTok;
  let outTok = draft.outTok;

  if (!headline) {
    return {
      headline: "",
      qcStatus: "fail",
      qcNotes: "writer returned no headline",
      writerModel: provider.model,
      judgeModel: provider.model,
      usage: { inTok, outTok },
    };
  }

  // Cheap gate first — a draft that fails this never reaches the judge.
  const structural = deterministicIssues(headline, payload);
  if (structural.length > 0) {
    return {
      headline,
      qcStatus: "fail",
      qcNotes: `deterministic: ${structural.join("; ")}`,
      writerModel: provider.model,
      judgeModel: provider.model,
      usage: { inTok, outTok },
    };
  }

  // The judge must see the SAME context as the writer. Passing only `data` made
  // it reject every correct headline that named a team, because the team names
  // live on the payload envelope rather than inside `data`.
  const judged = await callJson(
    provider,
    JUDGE_SYSTEM,
    `${userPrompt}\n\nHEADLINE:\n${headline}`,
    signal,
  );
  inTok += judged.inTok;
  outTok += judged.outTok;

  const verdict = String(judged.parsed.verdict ?? "fail");
  const reason = judged.parsed.reason ? String(judged.parsed.reason) : null;
  const corrected = String(judged.parsed.corrected ?? "").trim();

  if (verdict === "pass") {
    return {
      headline,
      qcStatus: "pass",
      qcNotes: reason,
      writerModel: provider.model,
      judgeModel: provider.model,
      usage: { inTok, outTok },
    };
  }

  if (verdict === "corrected" && corrected) {
    // A correction still has to clear the structural gate — the judge is not
    // exempt from the rule that every number must exist in the payload.
    const reIssues = deterministicIssues(corrected, payload);
    if (reIssues.length === 0) {
      return {
        headline: corrected,
        qcStatus: "corrected",
        qcNotes: reason,
        writerModel: provider.model,
        judgeModel: provider.model,
        usage: { inTok, outTok },
      };
    }
    return {
      headline,
      qcStatus: "fail",
      qcNotes: `correction rejected: ${reIssues.join("; ")}`,
      writerModel: provider.model,
      judgeModel: provider.model,
      usage: { inTok, outTok },
    };
  }

  return {
    headline,
    qcStatus: "fail",
    qcNotes: reason ?? "judge rejected",
    writerModel: provider.model,
    judgeModel: provider.model,
    usage: { inTok, outTok },
  };
}
