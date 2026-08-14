/**
 * types/map.ts
 *
 * Shared data structures and types for map components and location pickers.
 */

export interface MarkerData {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  isVerified?: boolean;
  isOpen?: boolean;
  hours?: string;
}

export interface KnownPharmacy {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}

export interface RegisteredPharmacy {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}
