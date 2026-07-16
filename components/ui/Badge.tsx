import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { useThemeContext } from '@/hooks/useThemeContext';

interface BadgeProps {
  label: string;
  status?: 'success' | 'warning' | 'error' | 'info' | 'default';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Badge({ 
  label, 
  status = 'default', 
  style, 
  textStyle 
}: BadgeProps) {
  const { theme } = useThemeContext();

  const getColors = () => {
    switch (status) {
      case 'success':
        return {
          bg: theme.success + '15',
          text: theme.success,
          border: theme.success + '30',
        };
      case 'warning':
        return {
          bg: theme.warning + '15',
          text: theme.warning,
          border: theme.warning + '30',
        };
      case 'error':
        return {
          bg: theme.error + '15',
          text: theme.error,
          border: theme.error + '30',
        };
      case 'info':
        return {
          bg: theme.patient.secondary,
          text: theme.patient.primary,
          border: theme.patient.primary + '15',
        };
      case 'default':
      default:
        return {
          bg: theme.surfaceSecondary,
          text: theme.text.secondary,
          border: theme.border,
        };
    }
  };

  const currentColors = getColors();

  return (
    <View style={[
      styles.badge, 
      { 
        backgroundColor: currentColors.bg, 
        borderColor: currentColors.border 
      }, 
      style
    ]}>
      <Text style={[
        styles.text, 
        { color: currentColors.text }, 
        textStyle
      ]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
