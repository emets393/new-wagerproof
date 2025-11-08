import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompletionRequest {
  game_id: string;
  sport_type: 'nfl' | 'cfb';
  widget_type: string;
  game_data_payload: any;
  custom_system_prompt?: string; // Optional override for testing
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { game_id, sport_type, widget_type, game_data_payload, custom_system_prompt }: CompletionRequest = await req.json();

    console.log(`Generating completion for ${sport_type} ${widget_type} - Game: ${game_id}`);
    if (custom_system_prompt) {
      console.log('Using custom system prompt for testing');
    }

    // Check if completion already exists (skip if using custom prompt for testing)
    if (!custom_system_prompt) {
      const { data: existing } = await supabaseClient
        .from('ai_completions')
        .select('id, completion_text')
        .eq('game_id', game_id)
        .eq('sport_type', sport_type)
        .eq('widget_type', widget_type)
        .maybeSingle();

      if (existing) {
        console.log('Completion already exists, returning cached version');
        return new Response(
          JSON.stringify({ 
            success: true, 
            completion: existing.completion_text,
            cached: true 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Use custom prompt if provided, otherwise fetch from config
    let systemPrompt: string;
    
    if (custom_system_prompt) {
      systemPrompt = custom_system_prompt;
    } else {
      const { data: config, error: configError } = await supabaseClient
        .from('ai_completion_configs')
        .select('system_prompt, enabled')
        .eq('widget_type', widget_type)
        .eq('sport_type', sport_type)
        .single();

      if (configError || !config) {
        throw new Error(`No config found for ${widget_type} - ${sport_type}`);
      }

      if (!config.enabled) {
        console.log(`Widget type ${widget_type} is disabled, skipping`);
        return new Response(
          JSON.stringify({ success: false, message: 'Widget type disabled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      systemPrompt = config.system_prompt;
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Prepare user prompt with game data
    const userPrompt = JSON.stringify(game_data_payload, null, 2);

    console.log('Calling OpenAI API...');
    
    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const completionContent = openaiData.choices[0].message.content;
    
    console.log('OpenAI response received:', completionContent);

    // Parse the JSON response
    const parsedResponse = JSON.parse(completionContent);
    const completionText = parsedResponse.explanation || completionContent;

    // Store completion in database
    const { error: insertError } = await supabaseClient
      .from('ai_completions')
      .upsert({
        game_id,
        sport_type,
        widget_type,
        completion_text: completionText,
        data_payload: game_data_payload,
        model_used: 'gpt-4o-mini',
        generated_at: new Date().toISOString(),
      }, {
        onConflict: 'game_id,sport_type,widget_type'
      });

    if (insertError) {
      console.error('Error storing completion:', insertError);
      throw insertError;
    }

    console.log('Completion stored successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        completion: completionText,
        cached: false,
        tokens_used: openaiData.usage?.total_tokens || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating completion:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

