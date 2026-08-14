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

  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    success: { bg: theme.successBg, text: theme.successText, border: theme.successBorder },
    warning: { bg: theme.pendingBg, text: theme.pendingText, border: theme.pendingBorder },
    error: { bg: theme.errorBg, text: theme.errorText, border: theme.errorBorder },
    info: { bg: theme.patientSecondary, text: theme.patientPrimary, border: theme.patientPrimary + '40' },
    default: { bg: theme.surfaceSecondary, text: theme.textMuted, border: theme.border },
  };

  const c = colorMap[status] || colorMap.default;

  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }, style]}>
      <Text style={[styles.text, { color: c.text }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center'
  },
  text: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-SemiBold',
    textTransform: 'uppercase'
  },

});
