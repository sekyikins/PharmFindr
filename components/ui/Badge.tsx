import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { useThemeContext } from '@/hooks/useThemeContext';
import { RADIUS, SPACING, FONT_SIZE } from '@/styles/theme';

interface BadgeProps {
  label: string;
  status?: 'success' | 'warning' | 'error' | 'info' | 'default';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Badge({ label, status = 'default', style, textStyle }: BadgeProps) {
  const { theme } = useThemeContext();

  const getColors = () => {
    switch (status) {
      case 'success':
        return { bg: theme.successBg, text: theme.successText, border: theme.successBorder };
      case 'warning':
        return { bg: theme.pendingBg, text: theme.pendingText, border: theme.pendingBorder };
      case 'error':
        return { bg: theme.errorBg, text: theme.errorText, border: theme.errorBorder };
      case 'info':
        return { bg: theme.patientSecondary, text: theme.patientPrimary, border: theme.patientPrimary + '40' };
      default:
        return { bg: theme.surfaceSecondary, text: theme.textMuted, border: theme.border };
    }
  };

  const c = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }, style]}>
      <Text style={[styles.text, { color: c.text }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
