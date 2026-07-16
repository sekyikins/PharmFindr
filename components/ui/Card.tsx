import React from 'react';
import { StyleSheet, View, ViewProps, StyleProp, ViewStyle } from 'react-native';
import { useThemeContext } from '@/hooks/useThemeContext';

interface CardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
}

export function Card({ children, style, elevated = true, ...props }: CardProps) {
  const { theme, isDark } = useThemeContext();

  return (
    <View 
      style={[
        styles.card, 
        { 
          backgroundColor: theme.surface, 
          borderColor: theme.border,
        },
        elevated && !isDark && styles.shadow,
        style
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginVertical: 8,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
});
