import { useSegments } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { colors } from '@/theme/colors';

export function useThemeContext() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const isDark = colorScheme === 'dark';
  const theme = colors[isDark ? 'dark' : 'light'];

  // Determine portal from path segment
  const isPharmacy = (segments as string[]).includes('(pharmacy)');

  return {
    theme,
    isDark,
    isPharmacy,
    primaryColor: isPharmacy ? theme.pharmacy.primary : theme.patient.primary,
    primaryDarkColor: isPharmacy ? theme.pharmacy.primaryDark : theme.patient.primaryDark,
    secondaryColor: isPharmacy ? theme.pharmacy.secondary : theme.patient.secondary,
    textColor: isPharmacy ? theme.pharmacy.text : theme.patient.text,
  };
}
export type ThemeContext = ReturnType<typeof useThemeContext>;
