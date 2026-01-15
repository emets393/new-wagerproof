import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 200,
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      throw new Error('Missing authorization header');
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Create a client with user auth to verify the requesting user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError);
      throw new Error('Unauthorized: Invalid or missing user');
    }

    const userId = user.id;
    console.log('Deleting account for user:', userId);

    // Create a service role client for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Step 1: Delete from profiles table (cascades to related data)
    console.log('Deleting profile data...');
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', userId);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
      // Continue anyway - profile might not exist or have cascade issues
    } else {
      console.log('Profile deleted successfully');
    }

    // Step 2: Delete from auth.users using admin API
    console.log('Deleting auth user...');
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error('Error deleting auth user:', deleteUserError);
      throw new Error(`Failed to delete user account: ${deleteUserError.message}`);
    }

    console.log('User account deleted successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account deleted successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error deleting account:', error);
    const errorMessage = error?.message || 'Failed to delete account';
    const statusCode = errorMessage?.includes('Unauthorized') ? 401 : 400;

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode,
      }
    );
  }
});
