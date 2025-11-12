import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  completion_id: string;
  completion_text: string;
  completion_date: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { completion_text, completion_date }: NotificationRequest = await req.json();

    console.log('Sending Today in Sports notification to Discord...');
    console.log('Date:', completion_date);

    // Format date for display
    const dateObj = new Date(completion_date);
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Truncate completion text if too long (Discord limit is 4096 chars for description)
    const maxLength = 3500;
    let displayText = completion_text;
    if (displayText.length > maxLength) {
      displayText = displayText.substring(0, maxLength) + '...\n\n[Read full briefing on WagerProof]';
    }

    // Build Discord embed payload (same format as editor picks)
    const embed = {
      title: "🏈 Today in Sports",
      description: displayText,
      color: 1096577, // Green color #10b981
      fields: [
        { 
          name: "📅 Date", 
          value: formattedDate, 
          inline: false 
        },
        {
          name: "🔗 Full Analysis",
          value: "[View on WagerProof →](https://wagerproof.com/today-in-sports)",
          inline: false
        }
      ],
      footer: {
        text: "WagerBot • Today in Sports • Powered by WagerProof",
        icon_url: "https://wagerproof.com/wagerproof-logo.png"
      },
      timestamp: new Date().toISOString()
    };

    // Use the same BuildShip endpoint as editor picks (same WagerBot)
    // Channel ID for #🗣️︳general channel
    const channelId = '1428416705171951821'; // General channel ID
    
    // Build payload matching the BuildShip endpoint structure
    // The endpoint expects pickData, gameData, and channelId
    // For "Today in Sports", we'll use minimal placeholder data and include our embed
    const discordPayload = {
      pickData: {
        id: 'today-in-sports-' + Date.now(),
        gameId: null,
        gameType: 'general',
        selectedBetTypes: [],
        editorNotes: displayText, // Use completion text as notes
      },
      gameData: {
        // Minimal game data - endpoint might need these fields
        awayTeam: 'Today in Sports',
        homeTeam: 'Daily Briefing',
        awayLogo: 'https://wagerproof.com/wagerproof-logo.png',
        homeLogo: 'https://wagerproof.com/wagerproof-logo.png',
        gameDate: completion_date,
        gameTime: null,
        awaySpread: null,
        homeSpread: null,
        awayMl: null,
        homeMl: null,
        overLine: null,
        homeTeamColors: null,
        awayTeamColors: null,
      },
      channelId: channelId,
      // Include embed directly - BuildShip might use this if present
      embed: embed,
    };

    console.log('Sending to BuildShip Discord endpoint...');
    console.log('Payload structure:', JSON.stringify({
      pickData: { ...discordPayload.pickData, editorNotes: '[truncated]' },
      gameData: discordPayload.gameData,
      channelId: discordPayload.channelId,
      embed: 'present'
    }, null, 2));

    const response = await fetch('https://xna68l.buildship.run/discord-editor-pick-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('BuildShip Discord API error:', errorText);
      throw new Error(`Discord API error (${response.status}): ${errorText}`);
    }

    const messageData = await response.json().catch(() => ({ success: true }));
    console.log('Message sent successfully:', messageData);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification sent to Discord successfully',
        messageId: messageData.id,
        channelId: channelId,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error sending Discord notification:', error);
    const errorMessage = error.message || 'Unknown error occurred';
    const isConfigError = errorMessage.includes('not configured') || errorMessage.includes('missing');
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: isConfigError ? 'Check Supabase Edge Function secrets in the dashboard: https://supabase.com/dashboard/project/gnjrklxotmbvnxbnnqgq/settings/vault' : undefined,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

