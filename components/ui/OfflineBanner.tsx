import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStore } from '@/store/networkStore';
import { useThemeContext } from '@/hooks/useThemeContext';

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { theme } = useThemeContext();
  const { isConnected, isPoorConnection, wasOffline, checkConnection } = useNetworkStore();

  const slideAnim = useRef(new Animated.Value(-100)).current;
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);

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
    if (!isConnected || isPoorConnection) {
      setShowRestoredNotice(false);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (isConnected && !isPoorConnection && wasOffline) {
      // Temporarily flash "Back Online" green toast, then auto-slide away
      setShowRestoredNotice(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 350,
          useNativeDriver: true,
        }).start(() => {
          setShowRestoredNotice(false);
          useNetworkStore.setState({ wasOffline: false });
        });
      }, 2500);

      return () => clearTimeout(timer);
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isConnected, isPoorConnection, wasOffline]);

  if (isConnected && !isPoorConnection && !showRestoredNotice) {
    return null;
  }

  const isWarning = !isConnected || isPoorConnection;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 8) + 4,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: showRestoredNotice
              ? '#059669'
              : !isConnected
              ? '#334155'
              : '#d97706',
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
          color="#ffffff"
        />
        <Text style={styles.pillText} numberOfLines={1}>
          {showRestoredNotice
            ? 'Connection Restored · Back online'
            : !isConnected
            ? 'No Internet · Saved items remain accessible'
            : 'Weak Connection · Live searches may be slow'}
        </Text>
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
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  pillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
