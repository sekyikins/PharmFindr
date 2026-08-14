import React from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  ActivityIndicator,
  PressableProps,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  RADIUS, FONT_SIZE  } from '@/styles/theme';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  title,
  variant = 'primary',
  loading = false,
  style,
  textStyle,
  disabled,
  ...props
}: ButtonProps) {
  const { primaryColor, secondaryColor } = useThemeContext();

  const variantConfigs: Record<string, { bg: string; text: string; border?: string }> = {
    primary:   { bg: primaryColor, text: COLORS.white },
    secondary: { bg: secondaryColor, text: primaryColor },
    outline:   { bg: 'transparent', text: primaryColor, border: primaryColor },
    ghost:     { bg: 'transparent', text: primaryColor },
  };

  const cfg = variantConfigs[variant] || variantConfigs.primary;
  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    { backgroundColor: cfg.bg, ...(cfg.border ? { borderWidth: 1.5, borderColor: cfg.border } : {}) },
    style,
  ];
  const labelStyle: StyleProp<TextStyle> = [styles.text, { color: cfg.text }, textStyle];

  return (
    <Pressable
      style={({ pressed }) => [
        containerStyle,
        (pressed || disabled || loading) && styles.pressed,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? COLORS.white : primaryColor} size="small" />
      ) : (
        <Text style={labelStyle}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  text: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-SemiBold'
  },
  pressed: {
    opacity: 0.5
  },

});
