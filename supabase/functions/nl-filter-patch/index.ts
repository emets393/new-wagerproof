// nl-filter-patch — turn a bettor's sentence into a validated filter PATCH for the NFL Historical
// Analysis page. The model only *proposes* ops; the client re-validates every op with the shared
// applyFilterPatch reducer before applying, so a bad model output cannot produce a wrong query.
//
// The system prompt + output schema are GENERATED from src/features/analysis/filterSchema.ts into
// ./schema.json (a parity test fails the build on drift) — this function never hand-maintains a copy.
//
// Request  { sentence: string, currentFilter?: object, coaches?: string[], referees?: string[] }
// Response { ops: PatchOp[], couldnt_map: string[], ambiguous: string[] }
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Import (not file-read) so the deploy bundler includes schema.json in the function bundle.
import artifact from './schema.json' with { type: 'json' };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Generated from src/features/analysis/filterSchema.ts (parity-tested). Static ⇒ prompt-cacheable.
const SYSTEM_PROMPT: string = artifact.systemPrompt;
const OUTPUT_SCHEMA = artifact.outputSchema;

const SENTENCE_MAX = 500;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    // Require an authenticated user — this spends OpenAI credits, so it is not open to anonymous abuse.
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => null);
    const sentence = typeof body?.sentence === 'string' ? body.sentence.trim() : '';
    if (!sentence) return json({ error: 'sentence is required' }, 400);
    if (sentence.length > SENTENCE_MAX) return json({ error: `sentence exceeds ${SENTENCE_MAX} chars` }, 400);

    const currentFilter = body?.currentFilter && typeof body.currentFilter === 'object' ? body.currentFilter : {};
    const coaches: string[] = Array.isArray(body?.coaches) ? body.coaches.filter((c: unknown) => typeof c === 'string').slice(0, 200) : [];
    const referees: string[] = Array.isArray(body?.referees) ? body.referees.filter((r: unknown) => typeof r === 'string').slice(0, 200) : [];

    // Dedicated key for the trends/systems features (isolated usage + limits from the shared OPENAI_API_KEY).
    const openaiApiKey = Deno.env.get('TRENDS_OPENAI_API_KEY');
    if (!openaiApiKey) return json({ error: 'TRENDS_OPENAI_API_KEY not configured' }, 500);

    const userMessage = [
      `CURRENT FILTER (patch relative to this): ${JSON.stringify(currentFilter)}`,
      coaches.length ? `AVAILABLE COACHES (use exact spelling for a coach filter): ${coaches.join(', ')}` : '',
      referees.length ? `AVAILABLE REFEREES (use exact spelling for a referee filter): ${referees.join(', ')}` : '',
      `USER REQUEST: ${sentence}`,
    ].filter(Boolean).join('\n\n');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0, // deterministic extraction
        max_tokens: 900,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'filter_patch', strict: true, schema: OUTPUT_SCHEMA },
        },
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error('OpenAI error:', errText);
      return json({ error: 'model request failed' }, 502);
    }

    const data = await openaiResponse.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return json({ error: 'empty model response' }, 502);

    // Structured Outputs guarantees valid JSON matching OUTPUT_SCHEMA.
    const parsed = JSON.parse(content);
    // Normalize the model's nullable fields into the reducer's op shape.
    const ops = Array.isArray(parsed.ops) ? parsed.ops.map((o: Record<string, unknown>) => {
      const op: Record<string, unknown> = { op: o.op, dimension: o.dimension };
      if (o.value !== null && o.value !== undefined) op.value = o.value;
      if (Array.isArray(o.items)) op.items = o.items;
      return op;
    }) : [];

    return json({
      ops,
      couldnt_map: Array.isArray(parsed.couldnt_map) ? parsed.couldnt_map : [],
      ambiguous: Array.isArray(parsed.ambiguous) ? parsed.ambiguous : [],
    });
  } catch (e) {
    console.error('nl-filter-patch error:', e);
    return json({ error: 'internal error' }, 500);
  }
});
