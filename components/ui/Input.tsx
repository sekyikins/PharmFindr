import React from 'react';
import { StyleSheet, Text, View, TextInput, TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { useThemeContext } from '@/hooks/useThemeContext';
import { RADIUS, SPACING, FONT_SIZE } from '@/styles/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({ label, error, containerStyle, style, ...props }: InputProps) {
  const { theme } = useThemeContext();

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: theme.text.secondary }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.surfaceSecondary,
            borderColor: error ? theme.error : theme.border,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: theme.text.primary }, style]}
          placeholderTextColor={theme.text.muted}
          {...props}
        />
      </View>
      {error && (
        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginVertical: SPACING.sm,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  inputContainer: {
    height: 52,
    borderRadius: RADIUS.lg,
    borderWidth: 1.2,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  input: {
    fontSize: FONT_SIZE.lg,
    width: '100%',
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
    fontWeight: '500',
  },
});
