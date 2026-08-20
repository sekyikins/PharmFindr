import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  type ViewStyle,
  type StyleProp,
} from 'react-native';

export interface KeyboardAwareContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
}

export default function KeyboardAwareContainer({
  children,
  style,
  keyboardVerticalOffset = 0,
}: KeyboardAwareContainerProps) {
  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, style]}
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  return <View style={[styles.container, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
