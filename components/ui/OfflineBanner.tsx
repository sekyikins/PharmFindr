import { COLORS } from '@/styles/theme';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Animated, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStore } from '@/store/networkStore';
import { useThemeContext } from '@/hooks/useThemeContext';

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { theme } = useThemeContext();
  const { isConnected, isPoorConnection, wasOffline, isBannerDismissed, dismissBanner, checkConnection } =
    useNetworkStore();

  const translateY = useRef(new Animated.Value(-120)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);

  // PanResponder to handle Swipe Up, Left, or Right to clear
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 10 ||
          Math.abs(gestureState.dy) > 10
        );
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipedUp = gestureState.dy < -20;
        const swipedLeft = gestureState.dx < -35;
        const swipedRight = gestureState.dx > 35;

        if (swipedUp || swipedLeft || swipedRight) {
          // Animate out and trigger dismiss in store
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: swipedUp ? -120 : 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(translateX, {
              toValue: swipedLeft ? -400 : swipedRight ? 400 : 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            dismissBanner();
            translateX.setValue(0);
            translateY.setValue(-120);
            opacity.setValue(1);
          });
        } else {
          // Reset position if swipe wasn't far enough
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  // Poll connection state periodically
  useEffect(() => {
    checkConnection();
    const interval = setInterval(() => {
      checkConnection();
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  // Handle connection status changes & auto-dismiss on reconnection
  useEffect(() => {
    if ((!isConnected || isPoorConnection) && !isBannerDismissed) {
      setShowRestoredNotice(false);
      opacity.setValue(1);
      translateX.setValue(0);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (isConnected && !isPoorConnection && wasOffline) {
      setShowRestoredNotice(true);
      opacity.setValue(1);
      translateX.setValue(0);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -120,
          duration: 350,
          useNativeDriver: true,
        }).start(() => {
          setShowRestoredNotice(false);
          useNetworkStore.setState({ wasOffline: false });
        });
      }, 2500);

      return () => clearTimeout(timer);
    } else {
      Animated.timing(translateY, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isConnected, isPoorConnection, wasOffline, isBannerDismissed]);

  if ((isConnected && !isPoorConnection && !showRestoredNotice) || isBannerDismissed) {
    return null;
  }

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 8) + 4,
          opacity: opacity,
          transform: [{ translateY }, { translateX }],
        },
      ]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: showRestoredNotice
              ? COLORS.pharmacyPrimaryDark
              : !isConnected
              ? COLORS.textPrimary
              : COLORS.warningDark,
          },
        ]}
      >
        <Ionicons
          name={
            showRestoredNotice
              ? 'checkmark-circle-outline'
              : !isConnected
              ? 'cloud-offline-outline'
              : 'wifi-outline'
          }
          size={15}
          color={COLORS.white}
        />
        <Text style={styles.pillText} numberOfLines={1}>
          {showRestoredNotice
            ? 'Connection Restored · Back online'
            : !isConnected
            ? 'No Internet · Saved items remain accessible'
            : 'Weak Connection · Live searches may be slow'}
        </Text>
        {!showRestoredNotice && (
          <Ionicons name="close-outline" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 2 }} />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center'
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  pillText: {
    color: COLORS.white,
    fontSize: 12,
    fontFamily: 'Inter-SemiBold'
  },

});
