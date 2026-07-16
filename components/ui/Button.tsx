import React from 'react';
import { 
  StyleSheet, 
  Text, 
  Pressable, 
  ActivityIndicator, 
  PressableProps, 
  StyleProp, 
  ViewStyle, 
  TextStyle 
} from 'react-native';
import { useThemeContext } from '@/hooks/useThemeContext';

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
  const { theme, primaryColor, secondaryColor } = useThemeContext();

  const getStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          container: [styles.container, { backgroundColor: secondaryColor }, style],
          text: [styles.text, { color: primaryColor }, textStyle]
        };
      case 'outline':
        return {
          container: [styles.container, { backgroundColor: 'transparent', borderWidth: 1.2, borderColor: primaryColor }, style],
          text: [styles.text, { color: primaryColor }, textStyle]
        };
      case 'ghost':
        return {
          container: [styles.container, { backgroundColor: 'transparent' }, style],
          text: [styles.text, { color: primaryColor }, textStyle]
        };
      case 'primary':
      default:
        return {
          container: [styles.container, { backgroundColor: primaryColor }, style],
          text: [styles.text, { color: '#ffffff' }, textStyle]
        };
    }
  };

  const activeStyles = getStyles();

  return (
    <Pressable 
      style={({ pressed }) => [
        activeStyles.container,
        (pressed || disabled || loading) && styles.pressed,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#ffffff' : primaryColor} size="small" />
      ) : (
        <Text style={activeStyles.text}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
});
