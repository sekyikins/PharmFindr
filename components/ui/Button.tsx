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
import { RADIUS, FONT_SIZE } from '@/styles/theme';

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

  const getStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          container: [styles.base, { backgroundColor: secondaryColor }, style],
          text:      [styles.text, { color: primaryColor }, textStyle],
        };
      case 'outline':
        return {
          container: [styles.base, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: primaryColor }, style],
          text:      [styles.text, { color: primaryColor }, textStyle],
        };
      case 'ghost':
        return {
          container: [styles.base, { backgroundColor: 'transparent' }, style],
          text:      [styles.text, { color: primaryColor }, textStyle],
        };
      default: // primary
        return {
          container: [styles.base, { backgroundColor: primaryColor }, style],
          text:      [styles.text, { color: '#ffffff' }, textStyle],
        };
    }
  };

  const s = getStyles();

  return (
    <Pressable
      style={({ pressed }) => [
        s.container,
        (pressed || disabled || loading) && styles.pressed,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? '#ffffff' : primaryColor} size="small" />
        : <Text style={s.text}>{title}</Text>
      }
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
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});
