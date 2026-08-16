import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Animated,
  Easing,
  PanResponder,
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

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const timerRef = useRef<any>(null);

  const duration = toast.duration ?? 4500;

  const dismissToast = (direction: 'up' | 'left' | 'right' = 'up') => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const anims: Animated.CompositeAnimation[] = [
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ];

    if (direction === 'up') {
      anims.push(
        Animated.timing(translateY, {
          toValue: -120,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        })
      );
    } else if (direction === 'left') {
      anims.push(
        Animated.timing(translateX, {
          toValue: -400,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        })
      );
    } else if (direction === 'right') {
      anims.push(
        Animated.timing(translateX, {
          toValue: 400,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        })
      );
    }

    Animated.parallel(anims).start(() => {
      onDismiss();
    });
  };

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
    timerRef.current = setTimeout(() => {
      dismissToast('up');
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isHorizontal = Math.abs(gestureState.dx) > 8;
        const isUpward = gestureState.dy < -6;
        return isHorizontal || isUpward;
      },
      onPanResponderGrant: () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        } else {
          translateY.setValue(gestureState.dy * 0.2);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // 1. Swipe UP
        if (gestureState.dy < -35 || gestureState.vy < -0.4) {
          dismissToast('up');
          return;
        }

        // 2. Swipe LEFT
        if (gestureState.dx < -50 || gestureState.vx < -0.4) {
          dismissToast('left');
          return;
        }

        // 3. Swipe RIGHT
        if (gestureState.dx > 50 || gestureState.vx > 0.4) {
          dismissToast('right');
          return;
        }

        // Reset back if threshold not met
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }),
        ]).start();

        // Resume auto-dismiss timer
        timerRef.current = setTimeout(() => {
          dismissToast('up');
        }, 2500);
      },
    })
  ).current;

  const type = toast.type || 'info';

  const getTypeStyles = () => {
    switch (type) {
      case 'clinical':
        return {
          icon: 'shield-checkmark',
          accent: primaryColor,
          bg: 'rgba(15, 23, 42, 0.88)',
          textColor: COLORS.white,
          subColor: COLORS.borderSubtle,
          border: primaryColor,
        };
      case 'success':
        return {
          icon: 'checkmark-circle',
          accent: COLORS.pharmacyPrimary,
          bg: 'rgba(6, 78, 59, 0.88)',
          textColor: COLORS.white,
          subColor: COLORS.successBorder,
          border: COLORS.pharmacyPrimary,
        };
      case 'warning':
        return {
          icon: 'alert-circle',
          accent: COLORS.warning,
          bg: 'rgba(120, 53, 15, 0.88)',
          textColor: COLORS.white,
          subColor: COLORS.pendingBorder,
          border: COLORS.warning,
        };
      case 'error':
        return {
          icon: 'warning',
          accent: COLORS.error,
          bg: 'rgba(127, 29, 29, 0.88)',
          textColor: COLORS.white,
          subColor: COLORS.errorBorder,
          border: COLORS.error,
        };
      case 'info':
      default:
        return {
          icon: 'information-circle',
          accent: COLORS.info,
          bg: 'rgba(15, 23, 42, 0.88)',
          textColor: COLORS.white,
          subColor: COLORS.borderSlate,
          border: COLORS.info,
        };
    }
  };

  const styleConfig = getTypeStyles();

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.toastWrapper,
        {
          top: Math.max(insets.top, 12) + 6,
          transform: [{ translateY }, { translateX }, { scale }],
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
              dismissToast('up');
            }}
          >
            <Text style={styles.actionText}>{toast.actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    gap: SPACING.md,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
    marginBottom: SPACING.xs,
  },
  message: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Regular',
    lineHeight: 16,
  },
  actionBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
  },
});
