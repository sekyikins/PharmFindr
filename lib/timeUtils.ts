import type { WeeklyScheduleDay } from '@/types/map';

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function formatTimeHHMM(timeStr?: string | null): string {
  if (!timeStr) return '';
  const clean = timeStr.trim();
  if (clean.includes('-') || clean.includes('–') || clean.includes('—')) {
    const parts = clean.split(/[-–—]/).map((s) => formatTimeHHMM(s.trim()));
    return parts.join(' - ');
  }
  const match = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?\s*(AM|PM)?$/i);
  if (match) {
    const [, h, m, ampm] = match;
    const hNum = parseInt(h, 10);
    if (ampm) {
      return `${hNum}:${m} ${ampm.toUpperCase()}`;
    }
    const hStr = String(hNum).padStart(2, '0');
    return `${hStr}:${m}`;
  }
  return clean;
}

export function parseTimeMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const clean = timeStr.trim().toLowerCase();

  if (clean === '24:00' || clean === '24:00:00') return 1440;
  if (clean === '23:59' || clean === '23:59:00') return 1439;

  const match = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (match) {
    let [, hStr, mStr, ampm] = match;
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10) || 0;
    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && h < 12) h += 12;
      if (ampm.toLowerCase() === 'am' && h === 12) h = 0;
    }
    return h * 60 + m;
  }

  const [h, m] = clean.split(':').map(Number);
  return !isNaN(h) ? h * 60 + (m || 0) : null;
}

export function isTimeWithinRange(openMin: number, closeMin: number, currentMin: number): boolean {
  if (openMin === 0 && (closeMin === 1440 || closeMin === 1439 || closeMin === 0)) {
    return true; // 24-hour open
  }
  if (closeMin > openMin) {
    // Normal same-day schedule
    return currentMin >= openMin && currentMin < closeMin;
  }
  if (closeMin < openMin) {
    // Overnight schedule (e.g. 20:00 -> 02:00)
    return currentMin >= openMin || currentMin < closeMin;
  }
  return true;
}

export function getPharmacyTimeInfo(utcOffsetMinutes?: number): {
  dayIndex: number;
  hours: number;
  minutes: number;
  currentMinutes: number;
  year: number;
  month: number;
  date: number;
} {
  const nowUtcMs = Date.now();
  const offsetMs = (utcOffsetMinutes !== undefined && !isNaN(utcOffsetMinutes))
    ? utcOffsetMinutes * 60000
    : -new Date().getTimezoneOffset() * 60000;
  const localDate = new Date(nowUtcMs + offsetMs);
  const hours = localDate.getUTCHours();
  const minutes = localDate.getUTCMinutes();
  return {
    dayIndex: localDate.getUTCDay(),
    hours,
    minutes,
    currentMinutes: hours * 60 + minutes,
    year: localDate.getUTCFullYear(),
    month: localDate.getUTCMonth(),
    date: localDate.getUTCDate(),
  };
}

export function formatTimeFromIso(isoStr?: string | null, utcOffsetMinutes?: number): string | null {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;

    const offsetMs = (utcOffsetMinutes !== undefined && !isNaN(utcOffsetMinutes))
      ? utcOffsetMinutes * 60000
      : -new Date().getTimezoneOffset() * 60000;

    const targetDate = new Date(d.getTime() + offsetMs);
    let hours = targetDate.getUTCHours();
    const minutes = targetDate.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const minutesStr = minutes < 10 ? '0' + minutes : String(minutes);

    return `${hours}:${minutesStr} ${ampm}`;
  } catch {
    return null;
  }
}

export function formatRelativeDateTime(isoStr?: string | null, utcOffsetMinutes?: number): string | null {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;

    const offsetMs = (utcOffsetMinutes !== undefined && !isNaN(utcOffsetMinutes))
      ? utcOffsetMinutes * 60000
      : -new Date().getTimezoneOffset() * 60000;

    const eventDate = new Date(d.getTime() + offsetMs);
    const nowInfo = getPharmacyTimeInfo(utcOffsetMinutes);

    const nowDayMs = Date.UTC(nowInfo.year, nowInfo.month, nowInfo.date);
    const eventDayMs = Date.UTC(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate());
    const dayDiff = Math.round((eventDayMs - nowDayMs) / (1000 * 60 * 60 * 24));

    const timeStr = formatTimeFromIso(isoStr, utcOffsetMinutes);
    if (!timeStr) return null;

    if (dayDiff === 0) {
      return timeStr;
    } else if (dayDiff === 1) {
      return `Tomorrow ${timeStr}`;
    } else {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${dayNames[eventDate.getUTCDay()]} ${timeStr}`;
    }
  } catch {
    return null;
  }
}

export function buildPharmacyStatusText(params: {
  isOpen?: boolean;
  hours?: string;
  nextCloseTime?: string;
  nextOpenTime?: string;
  utcOffsetMinutes?: number;
}): { statusText: string; isClosingSoon: boolean } {
  const { isOpen, hours, nextCloseTime, utcOffsetMinutes } = params;

  if (isOpen === false) {
    return { statusText: 'Closed', isClosingSoon: false };
  }

  if (hours && /24\s*hours|24\/7/i.test(hours)) {
    return { statusText: 'Open 24 Hours', isClosingSoon: false };
  }

  if (isOpen === true) {
    if (nextCloseTime) {
      const closeTime = new Date(nextCloseTime);
      const now = new Date();
      const diffMinutes = Math.round((closeTime.getTime() - now.getTime()) / 60000);
      const formattedClose = formatTimeFromIso(nextCloseTime, utcOffsetMinutes);

      if (diffMinutes > 0 && diffMinutes <= 60 && formattedClose) {
        return { statusText: `Closes soon · ${formattedClose}`, isClosingSoon: true };
      }
      if (formattedClose) {
        return { statusText: `Open · Closes ${formattedClose}`, isClosingSoon: false };
      }
    }
    const cleanHours = hours ? formatTimeHHMM(hours) : null;
    return {
      statusText: cleanHours && cleanHours !== 'Closed today' ? `Open (${cleanHours})` : 'Open',
      isClosingSoon: false,
    };
  }

  return { statusText: hours ? formatTimeHHMM(hours) : 'Public Map Location', isClosingSoon: false };
}

export function parseWeekdayDescriptions(
  weekdayDescriptions?: string[]
): WeeklyScheduleDay[] {
  if (!weekdayDescriptions || weekdayDescriptions.length === 0) return [];

  const dayMap = new Map<string, { isOpen: boolean | null; opens: string; closes: string; isUnknown?: boolean }>();

  for (const line of weekdayDescriptions) {
    const cleanLine = line.replace(/[\u200B-\u200D\uFEFF\u202F\u00A0]/g, ' ').trim();
    const colonIdx = cleanLine.indexOf(':');
    if (colonIdx === -1) continue;

    const dayName = cleanLine.slice(0, colonIdx).trim();
    const hoursStr = cleanLine.slice(colonIdx + 1).trim();

    if (/closed/i.test(hoursStr)) {
      dayMap.set(dayName.toLowerCase(), { isOpen: false, opens: '', closes: '', isUnknown: false });
    } else if (/24\s*hours|24\/7/i.test(hoursStr)) {
      dayMap.set(dayName.toLowerCase(), { isOpen: true, opens: '00:00', closes: '24:00', isUnknown: false });
    } else {
      const parts = hoursStr.split(/[–—\-]/).map((s) => s.trim());
      if (parts.length >= 2) {
        dayMap.set(dayName.toLowerCase(), {
          isOpen: true,
          opens: formatTimeHHMM(parts[0]),
          closes: formatTimeHHMM(parts[1]),
          isUnknown: false,
        });
      } else {
        dayMap.set(dayName.toLowerCase(), { isOpen: true, opens: formatTimeHHMM(hoursStr), closes: '', isUnknown: false });
      }
    }
  }

  return DAYS_ORDER.map((d) => {
    const entry = dayMap.get(d.toLowerCase());
    if (!entry) {
      return {
        day: d,
        isOpen: null,
        opens: '',
        closes: '',
        isUnknown: true,
      };
    }
    return {
      day: d,
      isOpen: entry.isOpen,
      opens: entry.opens,
      closes: entry.closes,
      isUnknown: entry.isUnknown,
    };
  });
}

export function formatGoogleTodayHours(
  currentOpeningHours?: any,
  regularOpeningHours?: any,
  utcOffsetMinutes?: number
): {
  hours?: string;
  isOpen?: boolean;
  statusText?: string;
  isClosingSoon?: boolean;
  nextCloseTime?: string;
  nextOpenTime?: string;
  weekdayDescriptions?: string[];
  weeklySchedule?: WeeklyScheduleDay[];
} {
  const hoursObj = currentOpeningHours || regularOpeningHours;
  if (!hoursObj) return {};

  const weekdayDescriptions: string[] =
    currentOpeningHours?.weekdayDescriptions || regularOpeningHours?.weekdayDescriptions || [];
  const weeklySchedule = parseWeekdayDescriptions(weekdayDescriptions);

  const isOpen = hoursObj.openNow !== undefined ? Boolean(hoursObj.openNow) : undefined;
  const nextCloseTime = currentOpeningHours?.nextCloseTime || regularOpeningHours?.nextCloseTime;
  const nextOpenTime = currentOpeningHours?.nextOpenTime || regularOpeningHours?.nextOpenTime;

  const nowInfo = getPharmacyTimeInfo(utcOffsetMinutes);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[nowInfo.dayIndex];

  let todayHoursStr: string | undefined;

  if (weekdayDescriptions.length > 0) {
    const matchLine = weekdayDescriptions.find((line) =>
      line.toLowerCase().startsWith(currentDayName.toLowerCase())
    );
    if (matchLine) {
      const cleanLine = matchLine.replace(/[\u200B-\u200D\uFEFF\u202F\u00A0]/g, ' ').trim();
      const colonIdx = cleanLine.indexOf(':');
      if (colonIdx !== -1) {
        todayHoursStr = cleanLine.slice(colonIdx + 1).trim();
      }
    }
  }

  if (!todayHoursStr && hoursObj.periods && Array.isArray(hoursObj.periods)) {
    const todayPeriod = hoursObj.periods.find((p: any) => p.open?.day === nowInfo.dayIndex);
    if (todayPeriod) {
      if (todayPeriod.open?.hour === 0 && (todayPeriod.close?.hour === 23 || todayPeriod.close?.hour === 24 || !todayPeriod.close)) {
        todayHoursStr = 'Open 24 hours';
      } else {
        const oH = String(todayPeriod.open?.hour || 8).padStart(2, '0');
        const oM = String(todayPeriod.open?.minute || 0).padStart(2, '0');
        const cH = String(todayPeriod.close?.hour || 20).padStart(2, '0');
        const cM = String(todayPeriod.close?.minute || 0).padStart(2, '0');
        todayHoursStr = `${oH}:${oM} - ${cH}:${cM}`;
      }
    }
  }

  const cleanTodayHours = todayHoursStr ? formatTimeHHMM(todayHoursStr) : undefined;

  const statusInfo = buildPharmacyStatusText({
    isOpen,
    hours: cleanTodayHours,
    nextCloseTime,
    nextOpenTime,
    utcOffsetMinutes,
  });

  return {
    hours: cleanTodayHours,
    isOpen,
    statusText: statusInfo.statusText,
    isClosingSoon: statusInfo.isClosingSoon,
    nextCloseTime,
    nextOpenTime,
    weekdayDescriptions,
    weeklySchedule,
  };
}

export function checkIsOpen(
  openingTime?: string | null,
  closingTime?: string | null,
  rawHours?: string | null,
  operatingHours?: any[] | null,
  utcOffsetMinutes?: number
): boolean | undefined {
  try {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let currentDayName: string;
    let currentMin: number;

    if (utcOffsetMinutes !== undefined && !isNaN(utcOffsetMinutes)) {
      const targetDate = new Date(Date.now() + utcOffsetMinutes * 60000);
      currentDayName = dayNames[targetDate.getUTCDay()];
      currentMin = targetDate.getUTCHours() * 60 + targetDate.getUTCMinutes();
    } else {
      const now = new Date();
      currentDayName = dayNames[now.getDay()];
      currentMin = now.getHours() * 60 + now.getMinutes();
    }

    // 1. Check raw hours string for explicit 24h / closed keywords
    if (rawHours) {
      if (/24\s*hours|24\/7|open 24/i.test(rawHours)) return true;
      if (/off|closed/i.test(rawHours)) return false;
      const match = rawHours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (match) {
        const oMin = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        const cMin = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
        return isTimeWithinRange(oMin, cMin, currentMin);
      }
    }

    // 2. Check detailed weekly schedule array
    if (operatingHours && Array.isArray(operatingHours) && operatingHours.length > 0) {
      const todaySchedule = operatingHours.find(
        (item: any) =>
          (item.day || item.day_of_week)?.toLowerCase() === currentDayName.toLowerCase()
      );
      if (todaySchedule) {
        const isOpenFlag = todaySchedule.isOpen !== undefined ? todaySchedule.isOpen : todaySchedule.is_open;
        if (isOpenFlag === false) return false;
        const openMin = parseTimeMinutes(todaySchedule.opens || todaySchedule.opening_time);
        const closeMin = parseTimeMinutes(todaySchedule.closes || todaySchedule.closing_time);
        if (openMin !== null && closeMin !== null) {
          return isTimeWithinRange(openMin, closeMin, currentMin);
        }
        return isOpenFlag !== undefined ? Boolean(isOpenFlag) : true;
      }
      return false;
    }

    // 3. Check default opening_time & closing_time
    if (openingTime || closingTime) {
      const openMin = parseTimeMinutes(openingTime || '08:00');
      const closeMin = parseTimeMinutes(closingTime || '20:00');
      if (openMin !== null && closeMin !== null) {
        return isTimeWithinRange(openMin, closeMin, currentMin);
      }
    }
  } catch {
    // fallback
  }

  return undefined;
}
