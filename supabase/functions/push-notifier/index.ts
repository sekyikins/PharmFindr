// @ts-nocheck
// ============================================================
// PharmaFindr — Supabase Edge Function: Push Notifier
// Dispatches push notifications to Expo Push API.
// ============================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  try {
    const payload = await req.json();
    const { record } = payload; // Database webhook payload or direct call

    if (!record || !record.user_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id in payload' }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch active push tokens for user
    const { data: tokenRows, error: tokenErr } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', record.user_id);

    if (tokenErr || !tokenRows || tokenRows.length === 0) {
      return new Response(JSON.stringify({ message: 'No push tokens found for user' }), { status: 200 });
    }

    // 2. Prepare Expo Push Messages
    const pushMessages = tokenRows.map((t) => ({
      to: t.token,
      sound: 'default',
      title: record.title || 'PharmaFindr Notification',
      body: record.message || '',
      data: {
        id: record.id,
        type: record.type,
        metadata: record.metadata,
      },
    }));

    // 3. Send payload to Expo Push API
    const pushRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pushMessages),
    });

    const pushResult = await pushRes.json();

    return new Response(JSON.stringify({ success: true, pushResult }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
