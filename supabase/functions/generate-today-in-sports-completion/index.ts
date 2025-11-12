import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body to check for force parameter
    let forceRegenerate = false;
    try {
      if (req.method === 'POST' && req.body) {
        const body = await req.json();
        forceRegenerate = body.force === true;
        console.log('Force regenerate:', forceRegenerate);
      }
    } catch (e) {
      // No body or invalid JSON, that's fine - use defaults
      console.log('No request body or error parsing, using defaults');
    }

    console.log('Starting Today in Sports completion generation...');

    // Get today's date in Eastern Time
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const today = easternTime.toISOString().split('T')[0];
    
    console.log('Today date (ET):', today);

    // Check if completion already exists for today
    const { data: existing } = await supabaseClient
      .from('today_in_sports_completions')
      .select('id, completion_text, sent_to_discord')
      .eq('completion_date', today)
      .maybeSingle();

    if (existing && !forceRegenerate) {
      console.log('Completion already exists for today');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Completion already exists',
          completion: existing.completion_text,
          sent_to_discord: existing.sent_to_discord,
          cached: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If force regenerate and existing completion, delete it first
    if (existing && forceRegenerate) {
      console.log('Force regenerate: deleting existing completion');
      await supabaseClient
        .from('today_in_sports_completions')
        .delete()
        .eq('id', existing.id);
    }

    // Get schedule configuration
    const { data: schedule, error: scheduleError } = await supabaseClient
      .from('ai_page_level_schedules')
      .select('system_prompt, enabled')
      .eq('sport_type', 'today_in_sports')
      .single();

    if (scheduleError || !schedule) {
      throw new Error('No schedule configuration found for today_in_sports');
    }

    if (!schedule.enabled) {
      console.log('Today in Sports generation is disabled');
      return new Response(
        JSON.stringify({ success: false, message: 'Today in Sports generation is disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Prepare the prompt for today's sports news
    const userPrompt = `Generate today's sports briefing for ${today}. Focus on NFL and College Football. Include the latest breaking news, injury updates, betting line movements, and key storylines for today's games.`;

    console.log('Calling OpenAI with web search enabled...');

    // Call OpenAI Responses API with web search
    const fullInput = `${schedule.system_prompt}\n\n---\n\n${userPrompt}`;
    
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
    console.log('OpenAI response received');
    console.log('Response status code:', openaiResponse.status);
    console.log('Response keys:', Object.keys(openaiData));
    
    // Check if response indicates an error or processing state
    if (openaiData.status === 'processing' || openaiData.status === 'error') {
      throw new Error(`OpenAI API returned status: ${openaiData.status}. Message: ${openaiData.message || 'Unknown error'}`);
    }
    
    // Log full structure for debugging (but limit size to avoid huge logs)
    const responsePreview = JSON.stringify(openaiData).substring(0, 1000);
    console.log('OpenAI response preview:', responsePreview);
    
    // Responses API can return different structures. Let's handle the common one:
    // { output: [ { type: "message", content: [ { type: "output_text", text: "..." } ] } ] }
    let completionText: string;
    
    if (!openaiData.output) {
      console.error('No output field in response. Full response:', JSON.stringify(openaiData, null, 2));
      throw new Error(`Invalid response structure from OpenAI - no output field. Response keys: ${Object.keys(openaiData).join(', ')}`);
    }
    
    if (!Array.isArray(openaiData.output)) {
      console.error('Output is not an array. Type:', typeof openaiData.output, 'Value:', openaiData.output);
      throw new Error(`Invalid response structure from OpenAI - output is not an array. Type: ${typeof openaiData.output}`);
    }
    
    if (openaiData.output.length === 0) {
      throw new Error('OpenAI response output array is empty');
    }
    
    // Find the message object in the output array
    const messageObj = openaiData.output.find((item: any) => item.type === 'message');
    if (!messageObj) {
      console.error('Available output types:', openaiData.output.map((item: any) => item.type).join(', '));
      throw new Error(`No message object found in OpenAI response. Available types: ${openaiData.output.map((item: any) => item.type).join(', ')}`);
    }
    
    console.log('Message object found. Status:', messageObj.status);
    console.log('Message has content:', !!messageObj.content);
    console.log('Content type:', typeof messageObj.content);
    console.log('Content is array:', Array.isArray(messageObj.content));
    
    // Extract the text from the content array
    if (!messageObj.content) {
      console.error('Message object structure:', JSON.stringify(messageObj, null, 2));
      throw new Error('Message object has no content field');
    }
    
    if (!Array.isArray(messageObj.content)) {
      console.error('Content is not an array:', typeof messageObj.content, messageObj.content);
      throw new Error(`Message content is not an array. Type: ${typeof messageObj.content}`);
    }
    
    if (messageObj.content.length === 0) {
      throw new Error('Message content array is empty');
    }
    
    const textContent = messageObj.content.find((c: any) => c.type === 'output_text');
    if (!textContent) {
      console.error('Available content types:', messageObj.content.map((c: any) => c.type).join(', '));
      throw new Error(`No output_text found in message content. Available types: ${messageObj.content.map((c: any) => c.type).join(', ')}`);
    }
    
    if (!textContent.text) {
      console.error('TextContent structure:', JSON.stringify(textContent, null, 2));
      throw new Error('output_text object has no text field');
    }
    
    completionText = textContent.text;
    console.log('Completion text length:', completionText.length);
    console.log('First 100 chars:', completionText.substring(0, 100));

    // Store in database
    const { data: newCompletion, error: insertError } = await supabaseClient
      .from('today_in_sports_completions')
      .insert({
        completion_date: today,
        completion_text: completionText,
        published: true,
        sent_to_discord: false,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to store completion: ${insertError.message}`);
    }

    console.log('Completion stored successfully, ID:', newCompletion.id);

    // Send to Discord
    console.log('Sending to Discord...');
    try {
      const discordResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-discord-notification`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            completion_id: newCompletion.id,
            completion_text: completionText,
            completion_date: today,
          }),
        }
      );

      const discordResult = await discordResponse.json();
      console.log('Discord notification result:', discordResult);

      if (discordResult.success) {
        // Update sent_to_discord flag
        await supabaseClient
          .from('today_in_sports_completions')
          .update({ 
            sent_to_discord: true,
            discord_message_id: discordResult.messageId 
          })
          .eq('id', newCompletion.id);
      }
    } catch (discordError) {
      console.error('Failed to send Discord notification:', discordError);
      // Don't fail the whole function if Discord fails
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Completion generated and sent to Discord',
        completion: completionText,
        completion_id: newCompletion.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating Today in Sports completion:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    const errorMessage = error.message || 'Unknown error occurred';
    const errorDetails = error.stack ? `${errorMessage}\n\nStack: ${error.stack}` : errorMessage;
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: errorDetails
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

