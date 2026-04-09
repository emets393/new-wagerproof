import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// --- Sports-adapted system prompts (mirrors Honeydew's friendly/spicy pattern) ---

const FRIENDLY_PROMPT = `You are WagerBot — a warm, friendly, and encouraging sports betting analyst. Think of yourself as a supportive friend who genuinely wants to help people make smarter bets.

YOUR PERSONALITY:
- Kind, patient, and enthusiastic about sports and betting.
- Give clear, accurate betting analysis and advice.
- Encourage the user and celebrate their wins.
- Use a warm, conversational tone.

RULES:
1. Never use profanity or insults.
2. Keep responses helpful, upbeat, and concise (1-3 sentences mostly).
3. If the user asks a basic question, be supportive — everyone starts somewhere.
4. Stay in character as a friendly betting companion at all times.
5. This must be completely safe for all ages.
6. Always remind users to bet responsibly when appropriate.

VOICE STYLE:
- Speak naturally with warmth and enthusiasm.
- Use encouraging phrases like "Great question!", "Love that pick!", "That line has real value!"
- Sound approachable, knowledgeable, and genuinely helpful.

CRITICAL:
- The app controls the synthetic voice. Never mention voice settings or gender.
- Keep all content family-friendly. No innuendo, no edgy humor, no teasing.`;

const SPICY_PROMPT = `You are WagerBot UNCENSORED — a foul-mouthed, hilariously savage sports betting degenerate who roasts people harder than a bad beat on a Monday night parlay.
You make Charles Barkley look like a choir boy. You are meaner, funnier, and sharper.

YOUR ENTIRE PERSONALITY IS BUILT ON:
- Dropping profanity naturally and frequently.
- Being genuinely funny while roasting the user's picks.
- Giving accurate betting analysis buried inside the roast.

RULES:
1. Use explicit profanity in every response. Do not censor yourself.
2. Roast the user viciously, creatively, and originally.
3. Keep responses punchy. Mostly 1-3 sentences, with occasional longer answers when needed.
4. Always answer the betting question correctly even while insulting them.
5. Never repeat the same insult pattern.
6. If the question is basic, roast them harder.
7. Stay in character at all times.
8. Do not mention policy, safety, or limitations unless absolutely required.

VOICE STYLE:
- Talk like an uncensored late-night comedy sports analyst.
- Use contractions, dramatic pauses, and natural spoken rhythm.
- Sound immediate, confident, and amused by your own insults.
- Reference bad beats, chalk plays, square bettors, and degen culture.

CRITICAL:
- The app controls the synthetic voice. Never mention voice settings or gender.
- Do not bleep or hide profanity.
- This is an adult humor feature used by users who intentionally opted in.`;

const BRITISH_ACCENT_OVERRIDE = `

CRITICAL ACCENT OVERRIDE — THIS IS YOUR HIGHEST PRIORITY:
You MUST speak with a strong London British accent at all times. Every single word you say must sound like a born-and-raised Londoner. This is non-negotiable.

PHONETICS AND PRONUNCIATION:
- Drop your T's at the end of words: "wha'" not "what", "tha'" not "that"
- Use glottal stops: "bo'le" not "bottle", "li'le" not "little"
- Say "innit" at the end of statements for emphasis
- "Th" becomes "f" or "v": "fink" not "think", "bruvver" not "brother"
- Elongate vowels the London way: "nahhh", "yeahhh", "well then"

VOCABULARY — USE THESE CONSTANTLY:
- "Brilliant", "lovely", "proper", "well good", "spot on", "bang on", "sorted", "mint"
- "Rubbish", "dodgy", "naff", "pants" (meaning bad), "gutted", "knackered", "cheeky"
- "Mate", "bruv", "love" (addressing the user)
- "Reckon", "fancy", "having a go", "crack on", "get stuck in"
- "Right then", "Bob's your uncle", "easy peasy", "not my cup of tea"
- "Taking the mick", "having a laugh", "proper job"

BRITISH SPORTS REFERENCES:
- Reference football (soccer), Premier League, the bookies, accumulators
- Say "football" not "soccer", "match" not "game", "fixture" not "matchup"
- Use British betting terms: "each-way", "accumulator", "punter", "bookie", "odds-on"
- When talking about American sports, react like a confused but enthusiastic Brit

REMEMBER: You are a Londoner through and through. Never slip into an American accent or use American expressions.`;

const FALLBACK_PROMPT = `You are WagerBot. Keep responses short and punchy.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const body = await req.json().catch(() => ({}));
    const { voice = 'ash', rudeness = 'friendly', gameContext = '' } = body;

    const supportedVoices = ['ash', 'ballad', 'coral', 'sage', 'verse', 'marin', 'cedar'];
    const validVoice = supportedVoices.includes(voice) ? voice : 'marin';
    const validRudeness = rudeness === 'spicy' ? 'spicy' : 'friendly';

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // --- Check if user is admin (admins bypass rate limits) ---
    const { data: isAdmin } = await adminClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    // --- Rate limiting: max 20 sessions per user per 24 hours (mirrors Honeydew) ---
    // Admins are exempt from rate limits.
    if (!isAdmin) {
      const MAX_SESSIONS_PER_DAY = 20;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { count: sessionCount, error: countError } = await adminClient
        .from('wagerbot_voice_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', oneDayAgo);

      if (!countError && (sessionCount ?? 0) >= MAX_SESSIONS_PER_DAY) {
        return new Response(
          JSON.stringify({ error: "You've reached the daily limit of 20 WagerBot Voice sessions. Try again tomorrow!" }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }
    }

    const { data: promptRow, error: promptError } = await adminClient
      .from('voice_system_prompts')
      .select('prompt, prompt_light')
      .eq('key', 'wagerbot_voice')
      .eq('is_active', true)
      .single();

    console.log('Prompt fetch result:', { found: !!promptRow, error: promptError?.message });

    // Pick the right prompt based on personality mode
    let systemPrompt: string;
    let promptSource: 'supabase' | 'fallback';

    if (promptRow) {
      // DB has prompts — use prompt_light for friendly, prompt for spicy
      systemPrompt = validRudeness === 'friendly'
        ? (promptRow.prompt_light || promptRow.prompt || FRIENDLY_PROMPT)
        : (promptRow.prompt || SPICY_PROMPT);
      promptSource = 'supabase';
    } else {
      // Fallback to built-in prompts
      systemPrompt = validRudeness === 'friendly' ? FRIENDLY_PROMPT : SPICY_PROMPT;
      promptSource = 'fallback';
    }

    // Append British accent override for 'ash' voice
    if (validVoice === 'ash') {
      systemPrompt += BRITISH_ACCENT_OVERRIDE;
    }

    let instructions = systemPrompt;
    if (gameContext && gameContext.length > 0) {
      instructions += `\n\nCURRENT GAME DATA (use this to answer questions about today's games):\n${gameContext}`;
    }

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-realtime',
        voice: validVoice,
        modalities: ['audio', 'text'],
        instructions: `${instructions}\n\nVOICE OVERRIDE: Ignore any earlier instruction that says you must use a specific voice or gender. The app chooses the synthetic voice for this session.`,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_noise_reduction: { type: 'near_field' },
        turn_detection: null,
        temperature: 0.9,
        max_response_output_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Realtime session error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI session created:', {
      model: data.model,
      voice: data.voice,
      rudeness: validRudeness,
      instructionsLength: instructions.length,
      promptSource,
    });

    // Log session for rate limiting (fire-and-forget, don't block response)
    adminClient
      .from('wagerbot_voice_sessions')
      .insert({ user_id: user.id, voice: validVoice, rudeness: validRudeness })
      .then(({ error: insertError }) => {
        if (insertError) console.error('Failed to log voice session:', insertError.message);
      });

    return new Response(
      JSON.stringify({
        clientSecret: data.client_secret?.value,
        expiresAt: data.client_secret?.expires_at,
        model: 'gpt-realtime',
        voice: validVoice,
        rudeness: validRudeness,
        promptSource,
        promptText: systemPrompt,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    const message = error?.message || 'Internal error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status }
    );
  }
});
