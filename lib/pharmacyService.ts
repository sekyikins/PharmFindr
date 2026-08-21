import { supabase } from './supabase';

export interface PharmacyRecord {
  id: string;
  name: string;
  phone: string | null;
  email?: string | null;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  opening_time?: string | null;
  closing_time?: string | null;
  is_verified?: boolean | null;
  isVerified?: boolean;
  created_at?: string;
  license_number?: string | null;
  ghana_card_number?: string | null;
}

/**
 * Single source of truth for resolving a pharmacy owned by a user.
 * 1. Checks `owner_id = user.id`.
 * 2. Falls back to matching phone or email if unlinked, and backfills `owner_id`.
 */
export async function getPharmacyForUser(user: {
  id: string;
  phone?: string | null;
  email?: string | null;
}): Promise<PharmacyRecord | null> {
  if (!user?.id) return null;

  // 1. Direct owner match
  const { data: pharm } = await supabase
    .from('pharmacies')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle();

  const normalizeRecord = (p: any): PharmacyRecord => ({
    ...p,
    is_verified: p.is_verified ?? true,
    isVerified: p.is_verified ?? true,
  });

  if (pharm) return normalizeRecord(pharm);

  // 2. Fallback by phone or email
  let query = supabase.from('pharmacies').select('*');
  if (user.phone) {
    query = query.eq('phone', user.phone);
  } else if (user.email) {
    query = query.eq('email', user.email);
  } else {
    return null;
  }

  const { data: fallback } = await query.maybeSingle();
  if (fallback?.id) {
    await supabase.from('pharmacies').update({ owner_id: user.id }).eq('id', fallback.id);
    return normalizeRecord(fallback);
  }

  return null;
}

/**
 * Format 24-hour time strings (e.g. "08:00", "20:00") into 12-hour AM/PM schedule.
 */
export function formatPharmacyHours(
  openingTime?: string | null,
  closingTime?: string | null
): string {
  if (!openingTime || !closingTime) return 'Hours not set';
  const formatTime = (t: string) => {
    const [h, m] = t.split(':');
    const hr = parseInt(h, 10);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const displayHr = hr % 12 || 12;
    return `${displayHr}:${m || '00'} ${ampm}`;
  };
  return `Open ${formatTime(openingTime)} – ${formatTime(closingTime)}`;
}
