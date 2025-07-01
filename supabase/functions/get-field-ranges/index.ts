
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    });
  }

  console.log('Fetching field ranges for betting lines...');
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const bettingFields = [
    'o_u_line', 'opponent_ml', 'primary_ml', 'primary_rl', 'primary_ml_handle',
    'primary_ml_bets', 'primary_rl_handle', 'primary_rl_bets', 'opponent_rl',
    'opponent_ml_handle', 'opponent_ml_bets', 'opponent_rl_handle', 
    'opponent_rl_bets', 'ou_handle_over', 'ou_bets_over'
  ];

  try {
    const ranges: Record<string, { min: number; max: number }> = {};
    
    for (const field of bettingFields) {
      console.log(`Fetching range for field: ${field}`);
      
      const { data, error } = await supabase
        .from('training_data_team_view_enhanced')
        .select(`${field}`)
        .not(field, 'is', null)
        .order(field, { ascending: true })
        .limit(1);

      const { data: maxData, error: maxError } = await supabase
        .from('training_data_team_view_enhanced')
        .select(`${field}`)
        .not(field, 'is', null)
        .order(field, { ascending: false })
        .limit(1);

      if (error || maxError) {
        console.error(`Error fetching range for ${field}:`, error || maxError);
        continue;
      }

      if (data && data.length > 0 && maxData && maxData.length > 0) {
        const minVal = Number(data[0][field]);
        const maxVal = Number(maxData[0][field]);
        
        if (!isNaN(minVal) && !isNaN(maxVal)) {
          ranges[field] = { min: minVal, max: maxVal };
          console.log(`Range for ${field}: ${minVal} - ${maxVal}`);
        }
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
    };

    console.log(`Successfully fetched ranges for ${Object.keys(ranges).length} fields`);
    return new Response(JSON.stringify(ranges), { status: 200, headers });

  } catch (error) {
    console.error('Error in get-field-ranges function:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch field ranges' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});
