import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';

interface SkeletonProps {
  width?: number | `${number}%` | 'auto';
  height?: number | `${number}%`;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height: height as any,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#cbd5e1',
  },
});
