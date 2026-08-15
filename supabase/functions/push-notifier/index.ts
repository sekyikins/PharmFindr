// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, key);
}

/** Fetch all Expo push tokens for a given user. */
async function getTokensForUser(supabase: any, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (error || !data || data.length === 0) return [];
  return data.map((r: any) => r.token).filter(Boolean);
}

/** Send push messages via Expo Push API. */
async function sendExpoPush(messages: object[]): Promise<void> {
  if (messages.length === 0) return;
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });
}

/** Build Expo push message objects for a user. */
function buildMessages(tokens: string[], title: string, body: string, data?: object) {
  return tokens.map((token) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: data ?? {},
  }));
}

/** Look up a pharmacy's owner_id from pharmacy_id. */
async function getPharmacyOwnerId(supabase: any, pharmacyId: string): Promise<string | null> {
  if (!pharmacyId) return null;
  const { data } = await supabase
    .from('pharmacies')
    .select('owner_id')
    .eq('id', pharmacyId)
    .single();
  return data?.owner_id ?? null;
}

// ── Notification builders ─────────────────────────────────────────────────────

async function handleReservationInsert(supabase: any, record: any) {
  const pharmacyOwnerId = await getPharmacyOwnerId(supabase, record.pharmacy_id);
  if (!pharmacyOwnerId) return;

  const tokens = await getTokensForUser(supabase, pharmacyOwnerId);
  const medSummary = record.medicine_name || 'a medicine';

  await sendExpoPush(buildMessages(
    tokens,
    '📦 New Reservation Request',
    `A patient has requested ${medSummary}. Tap to review.`,
    { type: 'reservation', reservation_id: record.id, status: 'pending' }
  ));
}

async function handleReservationUpdate(supabase: any, record: any, oldRecord: any) {
  if (record.status === oldRecord?.status) return;

  // ── Patient push ──────────────────────────────────────────────────────────
  const patientTokens = await getTokensForUser(supabase, record.user_id);
  const pharmName = record.pharmacy_name || 'the pharmacy';

  const patientMessages: Record<string, { title: string; body: string }> = {
    accepted:  { title: '🎉 Reservation Accepted!',   body: `Your reservation at ${pharmName} has been accepted. Please collect within 24 hours.` },
    declined:  { title: 'Reservation Declined',       body: `Your reservation at ${pharmName} was declined. Try searching for another pharmacy.` },
    collected: { title: '✅ Pickup Confirmed',         body: `Thank you for picking up your reservation at ${pharmName}.` },
    expired:   { title: '⏰ Reservation Expired',      body: `Your reservation at ${pharmName} has expired.` },
    cancelled: { title: 'Reservation Cancelled',      body: 'Your reservation has been cancelled.' },
  };

  const patientMsg = patientMessages[record.status];
  if (patientMsg) {
    await sendExpoPush(buildMessages(
      patientTokens,
      patientMsg.title,
      patientMsg.body,
      { type: 'reservation', reservation_id: record.id, status: record.status }
    ));
  }

  // ── Pharmacy push (patient cancelled) ─────────────────────────────────────
  if (record.status === 'cancelled' && record.pharmacy_id) {
    const ownerId = await getPharmacyOwnerId(supabase, record.pharmacy_id);
    if (ownerId) {
      const pharmTokens = await getTokensForUser(supabase, ownerId);
      await sendExpoPush(buildMessages(
        pharmTokens,
        '❌ Reservation Cancelled',
        `A patient cancelled their reservation for ${record.medicine_name || 'a medicine'}.`,
        { type: 'reservation', reservation_id: record.id, status: 'cancelled' }
      ));
    }
  }
}

async function handlePrescriptionInsert(supabase: any, record: any) {
  if (record.status !== 'completed') return;

  const tokens = await getTokensForUser(supabase, record.user_id);
  await sendExpoPush(buildMessages(
    tokens,
    '📷 Prescription Analysed',
    'Your prescription has been processed. Tap to view the extracted medicines.',
    { type: 'prescription', prescription_id: record.id }
  ));
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const payload = await req.json();
    const supabase = await getSupabase();

    // ── Direct invoke from app (inventory upload, etc.) ──────────────────────
    if (payload.direct === true) {
      const { user_id, title, body, notif_type, data } = payload;
      if (!user_id || !title || !body) {
        return new Response(JSON.stringify({ error: 'Missing required fields for direct push' }), { status: 400 });
      }

      // Write in-app notification row
      await supabase.from('notifications').insert({
        user_id,
        title,
        message: body,
        type: notif_type || 'system',
        metadata: data || {},
      });

      // Send push
      const tokens = await getTokensForUser(supabase, user_id);
      await sendExpoPush(buildMessages(tokens, title, body, { type: notif_type, ...data }));

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Webhook from Supabase Database ────────────────────────────────────────
    const { type: eventType, table, record, old_record } = payload;

    if (!record) {
      return new Response(JSON.stringify({ error: 'Missing record in webhook payload' }), { status: 400 });
    }

    if (table === 'reservations') {
      if (eventType === 'INSERT') {
        await handleReservationInsert(supabase, record);
      } else if (eventType === 'UPDATE') {
        await handleReservationUpdate(supabase, record, old_record);
      }
    } else if (table === 'prescriptions' && eventType === 'INSERT') {
      await handlePrescriptionInsert(supabase, record);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
