import { COLORS } from '@/styles/theme';
import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/hooks/useThemeContext';

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'clinical';

export interface ToastConfig {
  id?: string;
  type?: ToastType;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastProps {
  toast: ToastConfig;
  onDismiss: () => void;
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  const { theme, primaryColor } = useThemeContext();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  const duration = toast.duration ?? 4500;

  useEffect(() => {
    // Slide & fade in
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss timer
    const timer = setTimeout(() => {
      dismissToast();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const dismissToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -80,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const type = toast.type || 'info';

  const getTypeStyles = () => {
    switch (type) {
      case 'clinical':
        return {
          icon: 'shield-checkmark',
          accent: primaryColor,
          bg: COLORS.surfaceDark,
          textColor: COLORS.white,
          subColor: COLORS.borderSlate,
          border: primaryColor,
        };
      case 'success':
        return {
          icon: 'checkmark-circle',
          accent: COLORS.pharmacyPrimary,
          bg: '#064e3b',
          textColor: COLORS.white,
          subColor: COLORS.successBorder,
          border: COLORS.pharmacyPrimary,
        };
      case 'warning':
        return {
          icon: 'alert-circle',
          accent: COLORS.warning,
          bg: COLORS.pendingText,
          textColor: COLORS.white,
          subColor: COLORS.pendingBorder,
          border: COLORS.warning,
        };
      case 'error':
        return {
          icon: 'warning',
          accent: COLORS.error,
          bg: COLORS.errorDarkBg,
          textColor: COLORS.white,
          subColor: COLORS.errorBorder,
          border: COLORS.error,
        };
      case 'info':
      default:
        return {
          icon: 'information-circle',
          accent: COLORS.info,
          bg: COLORS.textPrimary,
          textColor: COLORS.white,
          subColor: COLORS.textDim,
          border: COLORS.info,
        };
    }
  };

  const styleConfig = getTypeStyles();

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          top: Math.max(insets.top, 12) + 6,
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: styleConfig.bg,
            borderColor: styleConfig.border,
          },
        ]}
      >
        {/* Type Icon Circle */}
        <View style={[styles.iconCircle, { backgroundColor: styleConfig.accent + '25' }]}>
          <Ionicons name={styleConfig.icon as any} size={20} color={styleConfig.accent} />
        </View>

        {/* Content */}
        <View style={styles.textContainer}>
          {toast.title ? (
            <Text style={[styles.title, { color: styleConfig.textColor }]}>
              {toast.title}
            </Text>
          ) : null}
          <Text style={[styles.message, { color: styleConfig.subColor }]}>
            {toast.message}
          </Text>
        </View>

        {/* Optional Action Button */}
        {toast.actionLabel ? (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: styleConfig.accent },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => {
              if (toast.onAction) toast.onAction();
              dismissToast();
            }}
          >
            <Text style={styles.actionText}>{toast.actionLabel}</Text>
          </Pressable>
        ) : null}

        {/* Dismiss X */}
        <Pressable
          onPress={dismissToast}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.5 }]}
          hitSlop={8}
        >
          <Ionicons name="close" size={16} color={styleConfig.subColor} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6
  },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center'
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center'
  },
  title: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    marginBottom: 2
  },
  message: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    lineHeight: 16
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  actionText: {
    color: COLORS.white,
    fontSize: 11,
    fontFamily: 'Inter-Bold'
  },
  closeBtn: {
    padding: 4
  },

});
