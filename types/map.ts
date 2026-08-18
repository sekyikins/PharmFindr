/**
 * types/map.ts
 *
 * Shared data structures and types for map components, viewport discovery,
 * and location pickers.
 */

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type PharmacySource = 'supabase' | 'google' | 'osm';

export interface WeeklyScheduleDay {
  day: string;
  isOpen: boolean | null; // null = unknown schedule
  opens: string;
  closes: string;
  isUnknown?: boolean;
}

export interface PharmacyOperatingHourRow {
  day_of_week: string;
  is_open?: boolean | null;
  opening_time?: string | null;
  closing_time?: string | null;
}

/**
 * Unified pharmacy structure across discovery providers (Supabase, Google Places, OSM).
 */
export interface DiscoveredPharmacy {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string;
  email?: string;
  hours?: string;
  weeklyHours?: string[];
  weeklySchedule?: WeeklyScheduleDay[];
  statusText?: string;
  nextOpenTime?: string;
  nextCloseTime?: string;
  isClosingSoon?: boolean;
  utcOffsetMinutes?: number;
  distanceKm?: number;
  walkMinutes?: number;
  isVerified: boolean;
  isOpen?: boolean;
  googlePlaceId?: string;
  source: PharmacySource;
}

/**
 * Alias for backward compatibility with existing consumers expecting OsmPharmacy.
 */
export type OsmPharmacy = DiscoveredPharmacy;

/**
 * Data needed for rendering interactive map pins.
 */
export interface MarkerData {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  isVerified?: boolean;
  isOpen?: boolean;
  isClosingSoon?: boolean;
  hours?: string;
  statusText?: string;
  distanceKm?: number;
  walkMinutes?: number;
}

/**
 * Public directory pharmacy for registration map selection.
 */
export interface KnownPharmacy {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  phone?: string;
}

/**
 * Registered pharmacy for registration map selection.
 */
export interface RegisteredPharmacy {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}
