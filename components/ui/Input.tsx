import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TextInputProps, 
  StyleProp, 
  ViewStyle 
} from 'react-native';
import { useThemeContext } from '@/hooks/useThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({ 
  label, 
  error, 
  containerStyle, 
  style, 
  ...props 
}: InputProps) {
  const { theme } = useThemeContext();

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: theme.text.secondary }]}>
          {label}
        </Text>
      )}
      <View style={[
        styles.inputContainer, 
        { backgroundColor: theme.surface, borderColor: error ? theme.error : 'transparent' }
      ]}>
        <TextInput
          style={[styles.input, { color: theme.text.primary }, style]}
          placeholderTextColor={theme.text.muted}
          {...props}
        />
      </View>
      {error && (
        <Text style={[styles.errorText, { color: theme.error }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginVertical: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputContainer: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.2,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  input: {
    fontSize: 14,
    width: '100%',
  },
  errorText: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
});
