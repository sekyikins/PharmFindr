import React from 'react';
import { StyleSheet, View, ViewProps, StyleProp, ViewStyle } from 'react-native';
import { useThemeContext } from '@/hooks/useThemeContext';
import { RADIUS } from '@/styles/theme';

interface CardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
}

export function Card({ children, style, elevated = true, ...props }: CardProps) {
  const { theme } = useThemeContext();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        elevated && styles.shadow,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: 16,
    marginVertical: 6,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
