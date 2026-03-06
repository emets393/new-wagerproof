import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

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
    const { voice = 'ash', gameContext = '' } = body;

    const supportedVoices = ['ash', 'ballad', 'coral', 'sage', 'verse', 'marin', 'cedar'];
    const validVoice = supportedVoices.includes(voice) ? voice : 'marin';

    // Fetch system prompt from database using service role to bypass RLS
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: promptRow, error: promptError } = await adminClient
      .from('voice_system_prompts')
      .select('prompt')
      .eq('key', 'wagerbot_voice')
      .eq('is_active', true)
      .single();

    console.log('Prompt fetch result:', { found: !!promptRow, error: promptError?.message, promptLength: promptRow?.prompt?.length });

    const systemPrompt = promptRow?.prompt || FALLBACK_PROMPT;

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
    console.log('OpenAI session created:', { model: data.model, voice: data.voice, instructionsLength: instructions.length, promptPreview: instructions.substring(0, 100) });

    return new Response(
      JSON.stringify({
        clientSecret: data.client_secret?.value,
        expiresAt: data.client_secret?.expires_at,
        model: 'gpt-realtime',
        voice: validVoice,
        promptSource: promptRow ? 'supabase' : 'fallback',
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
