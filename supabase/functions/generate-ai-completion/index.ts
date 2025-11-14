import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompletionRequest {
  game_id: string;
  sport_type: 'nfl' | 'cfb' | 'nba' | 'ncaab';
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

    console.log('Calling OpenAI Responses API with web search enabled...');
    
    // Combine system prompt and user prompt into a single input for Responses API
    const fullInput = `${systemPrompt}\n\n---\n\nGame Data:\n${userPrompt}`;
    
    // Call OpenAI Responses API with web search
    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        tools: [
          {
            type: 'web_search_preview',
            user_location: {
              type: 'approximate',
              country: 'US',
              city: 'New York',
              region: 'New York'
            }
          }
        ],
        input: fullInput,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    
    console.log('OpenAI response status:', openaiData.status);
    console.log('OpenAI response has output:', !!openaiData.output);
    
    // Responses API returns: { output: [ { type: "message", content: [ { type: "output_text", text: "..." } ] } ] }
    if (!openaiData.output || !Array.isArray(openaiData.output)) {
      throw new Error('Invalid response structure from OpenAI - no output array');
    }
    
    // Find the message object in the output array
    const messageObj = openaiData.output.find((item: any) => item.type === 'message');
    if (!messageObj) {
      throw new Error('No message object found in OpenAI response');
    }
    
    console.log('Message object status:', messageObj.status);
    console.log('Message has content:', !!messageObj.content);
    
    // Extract the text from the content array
    if (!messageObj.content || !Array.isArray(messageObj.content)) {
      throw new Error('Message object has no content array');
    }
    
    const textContent = messageObj.content.find((c: any) => c.type === 'output_text');
    if (!textContent || !textContent.text) {
      throw new Error('No output_text found in message content');
    }
    
    let completionContent = textContent.text;
    console.log('Extracted text length:', completionContent.length);
    console.log('First 100 chars:', completionContent.substring(0, 100));

    // Parse the JSON response - strip markdown code blocks if present
    let completionText: string;
    try {
      // Remove markdown code blocks (```json ... ```) if present
      let cleanedContent = completionContent.trim();
      if (cleanedContent.startsWith('```')) {
        console.log('Stripping markdown code blocks...');
        // Remove opening ```json or ``` and closing ```
        cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
        console.log('After stripping, first 100 chars:', cleanedContent.substring(0, 100));
      }
      
      // Try to find and parse JSON in the response
      const jsonMatch = cleanedContent.match(/\{[\s\S]*"explanation"[\s\S]*\}/);
      
      if (jsonMatch) {
        console.log('Found JSON in response, parsing...');
        const parsedResponse = JSON.parse(jsonMatch[0]);
        completionText = parsedResponse.explanation;
        console.log('Successfully extracted explanation length:', completionText.length);
      } else {
        // Try parsing the whole content as JSON
        console.log('No JSON match found, trying to parse entire content...');
        const parsedResponse = JSON.parse(cleanedContent);
        completionText = parsedResponse.explanation || JSON.stringify(parsedResponse);
      }
    } catch (parseError) {
      // If response isn't JSON, use it directly
      console.log('Response is not valid JSON, using content directly');
      completionText = completionContent;
    }
    
    // Final safety check - ensure it's a string
    if (typeof completionText !== 'string') {
      console.warn('Completion text is not a string, converting:', typeof completionText);
      completionText = String(completionText);
    }
    
    console.log('Final completion text type:', typeof completionText);
    console.log('Final completion text length:', completionText.length);

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
    console.log('Returning completion text:', completionText);
    console.log('Completion text type:', typeof completionText);

    return new Response(
      JSON.stringify({ 
        success: true, 
        completion: completionText,
        cached: false,
        tokens_used: 0 // Web search doesn't return usage tokens
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

