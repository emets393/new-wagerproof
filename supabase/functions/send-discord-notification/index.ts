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

    // Get Discord credentials from environment
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    const channelId = Deno.env.get('DISCORD_GENERAL_CHANNEL_ID');

    if (!botToken || !channelId) {
      throw new Error('Discord credentials not configured');
    }

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

    // Build Discord embed payload
    const payload = {
      embeds: [{
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
      }]
    };

    console.log('Sending to Discord API...');

    // Send to Discord via Bot API
    const discordApiUrl = `https://discord.com/api/v10/channels/${channelId}/messages`;
    
    const response = await fetch(discordApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Discord API error:', errorData);
      throw new Error(`Discord API error (${response.status}): ${errorData.message || response.statusText}`);
    }

    const messageData = await response.json();
    console.log('Message sent successfully, ID:', messageData.id);

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
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

