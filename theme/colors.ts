/**
 * theme/colors.ts — Re-exports from styles/theme.tsx
 *
 * This file is the import target for all screens and components.
 * All token values live in styles/theme.tsx — never add raw hex here.
 */
import { LIGHT_COLORS } from '@/styles/theme';

export { LIGHT_COLORS };

const lightThemeColors = {
  ...LIGHT_COLORS,
  text: {
    primary:   LIGHT_COLORS.text,
    secondary: LIGHT_COLORS.textMuted,
    muted:     LIGHT_COLORS.textDim,
    white:     '#ffffff',
  },
};

export const colors = {
  light: lightThemeColors,
  dark: lightThemeColors,
};

// Named convenience exports so screens can do: import { BLUE } from '@/theme/colors'
export const BLUE       = LIGHT_COLORS.patientPrimary;
export const GREEN      = LIGHT_COLORS.pharmacyPrimary;
export const BLUE_DARK  = LIGHT_COLORS.patient.primaryDark;
export const GREEN_DARK = LIGHT_COLORS.pharmacy.primaryDark;

export type ThemeColors = typeof colors.light;
