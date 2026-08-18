import { supabase } from './supabase';
import { haversineKm, isValidCoordinate } from './geoUtils';
import { checkIsOpen, formatTimeHHMM } from './timeUtils';
import type { Coords } from './location';
import type { DiscoveredPharmacy, MapBounds, WeeklyScheduleDay } from '@/types/map';

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export async function getRegisteredPharmacies(
  bounds?: MapBounds | null,
  userCoords?: Coords | null,
  signal?: AbortSignal
): Promise<DiscoveredPharmacy[]> {
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[now.getDay()];

  try {
    let query = supabase
      .from('pharmacies')
      .select('id, name, address, phone, email, latitude, longitude, opening_time, closing_time, is_verified, pharmacy_operating_hours(day_of_week, is_open, opening_time, closing_time)');

    if (bounds) {
      query = query
        .gte('latitude', bounds.south)
        .lte('latitude', bounds.north)
        .gte('longitude', bounds.west)
        .lte('longitude', bounds.east);
    }

    if (signal?.aborted) return [];

    const { data, error } = await query;

    if (error) {
      console.warn('Error fetching registered pharmacies from Supabase:', error.message);
      return [];
    }

    if (!data) return [];

    return data
      .filter((p) => p.latitude != null && p.longitude != null && isValidCoordinate(p.latitude, p.longitude))
      .map((p: any) => {
        const coords: Coords = { latitude: p.latitude, longitude: p.longitude };
        const distKm = userCoords ? haversineKm(userCoords, coords) : undefined;
        const rawHoursList = (p.pharmacy_operating_hours && Array.isArray(p.pharmacy_operating_hours) && p.pharmacy_operating_hours.length > 0)
          ? p.pharmacy_operating_hours
          : null;

        const open = checkIsOpen(p.opening_time, p.closing_time, null, rawHoursList);

        // Build structured weekly schedule & weekday descriptions
        const weeklySchedule: WeeklyScheduleDay[] = DAYS_ORDER.map((d) => {
          const row = (rawHoursList || []).find(
            (h: any) => h.day_of_week?.toLowerCase() === d.toLowerCase()
          );
          if (!row) {
            return { day: d, isOpen: null, opens: '', closes: '', isUnknown: true };
          }
          const o = row.opening_time ? formatTimeHHMM(row.opening_time) : '';
          const c = row.closing_time ? formatTimeHHMM(row.closing_time) : '';
          return {
            day: d,
            isOpen: row.is_open ?? (o && c ? true : false),
            opens: o,
            closes: c,
          };
        });

        const weeklyHours: string[] = weeklySchedule.map((s) => {
          if (s.isUnknown || s.isOpen === null) return `${s.day}: Hours unavailable`;
          if (s.isOpen === false) return `${s.day}: Closed`;
          if (s.opens && s.closes) return `${s.day}: ${s.opens} – ${s.closes}`;
          return `${s.day}: Open`;
        });

        const oTime = formatTimeHHMM(p.opening_time);
        const cTime = formatTimeHHMM(p.closing_time);
        let todayHoursStr = oTime && cTime ? `${oTime} - ${cTime}` : undefined;
        if (rawHoursList) {
          const todayRow = rawHoursList.find(
            (h: any) => (h.day || h.day_of_week)?.toLowerCase() === currentDayName.toLowerCase()
          );
          if (todayRow) {
            const isOpenToday = todayRow.isOpen !== undefined ? todayRow.isOpen : todayRow.is_open;
            if (isOpenToday === false) {
              todayHoursStr = 'Closed today';
            } else {
              const o = formatTimeHHMM(todayRow.opens || todayRow.opening_time || p.opening_time || '08:00');
              const c = formatTimeHHMM(todayRow.closes || todayRow.closing_time || p.closing_time || '20:00');
              todayHoursStr = `${o} - ${c}`;
            }
          }
        }

        let statusText = 'Open';
        if (open === false) {
          statusText = todayHoursStr === 'Closed today' ? 'Closed today' : 'Closed';
        } else if (open === true) {
          statusText = todayHoursStr && /24\s*hours/i.test(todayHoursStr) ? 'Open 24 Hours' : 'Open';
        } else {
          statusText = todayHoursStr ? 'Open' : 'Public Map Location';
        }

        return {
          id: p.id,
          name: p.name,
          address: p.address || 'Address registered in database',
          latitude: p.latitude,
          longitude: p.longitude,
          phone: p.phone || undefined,
          email: p.email || undefined,
          hours: todayHoursStr,
          weeklyHours,
          weeklySchedule,
          statusText,
          distanceKm: distKm !== undefined ? Math.round(distKm * 1000) / 1000 : undefined,
          walkMinutes: distKm !== undefined ? Math.max(1, Math.round((distKm / 5) * 60)) : undefined,
          isVerified: (p.is_verified ?? p.verified) ?? true,
          isOpen: open,
          source: 'supabase' as const,
        };
      });
  } catch (e) {
    console.warn('Error fetching registered pharmacies from Supabase:', e);
    return [];
  }
}
