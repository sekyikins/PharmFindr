import { useSegments } from 'expo-router';
import { LIGHT_COLORS } from '@/styles/theme';

type TextObject = {
  primary:   string;
  secondary: string;
  muted:     string;
  white:     string;
};

type FullTheme = typeof LIGHT_COLORS & {
  text: TextObject;
};

function buildTheme(): FullTheme {
  const base = LIGHT_COLORS;
  return {
    ...base,
    text: {
      primary:   base.text,   // flat string on the palette
      secondary: base.textMuted,
      muted:     base.textDim,
      white:     '#ffffff',
    },
  } as FullTheme;
}

export function useThemeContext() {
  const segments = useSegments();
  const theme = buildTheme();

  const isPharmacy = (segments as string[]).includes('(pharmacy)');

  return {
    theme,
    isPharmacy,
    primaryColor:     isPharmacy ? theme.pharmacy.primary     : theme.patient.primary,
    primaryDarkColor: isPharmacy ? theme.pharmacy.primaryDark : theme.patient.primaryDark,
    secondaryColor:   isPharmacy ? theme.pharmacy.secondary   : theme.patient.secondary,
    /** Plain string, for use in StyleSheet color props. */
    textColor:        theme.text.primary,
  };
}

export type ThemeContext = ReturnType<typeof useThemeContext>;
