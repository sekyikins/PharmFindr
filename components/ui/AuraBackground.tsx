import React from 'react';
import { StyleSheet, View, Platform, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg';

interface AuraBackgroundProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Optional override for the backdrop color (default: #100e0b) */
  backgroundColor?: string;
}

/**
 * "Phantom Arc" Aura Gradient Background
 * A dark atmospheric gradient background with layered radial glow arcs
 * tuned for the patient (blue) side of the app.
 */
export function AuraBackground({
  children,
  style,
  contentStyle,
  backgroundColor = '#100e0b',
}: AuraBackgroundProps) {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor }, style]}>
        {/* Layer 1 - screen */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 120% 145% at 50% -50%, rgba(0,0,0,0) 60%, rgb(12,24,210) 78%, rgba(0,0,0,0) 85%)',
            mixBlendMode: 'screen',
            filter: 'blur(50px)',
            pointerEvents: 'none',
            transform: 'translateZ(0)',
          }}
          aria-hidden="true"
        />
        {/* Layer 2 - screen */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 120% 145% at 50% -50%, rgba(0,0,0,0) 55%, rgba(12,24,210,0.4) 80%, rgba(0,0,0,0) 100%)',
            mixBlendMode: 'screen',
            filter: 'blur(175px)',
            opacity: 0.9,
            pointerEvents: 'none',
            transform: 'translateZ(0)',
          }}
          aria-hidden="true"
        />
        {/* Layer 3 - lighten */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 120% 145% at 50% -50%, rgba(0,0,0,0) 83.5%, #c8a8a6 84.5%, rgba(0,0,0,0) 85.5%)',
            mixBlendMode: 'lighten',
            filter: 'blur(50px)',
            opacity: 0.8,
            pointerEvents: 'none',
            transform: 'translateZ(0)',
          }}
          aria-hidden="true"
        />
        {/* Content sits above decorative layers */}
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      {/* Native SVG Aura Gradient Layer Stack */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            {/* Layer 1: Core Cobalt Arc */}
            <SvgRadialGradient
              id="phantomArcCore"
              cx="50%"
              cy="0%"
              rx="90%"
              ry="75%"
              fx="50%"
              fy="0%"
            >
              <Stop offset="0%" stopColor="#0c18d2" stopOpacity="0.85" />
              <Stop offset="45%" stopColor="#0c18d2" stopOpacity="0.5" />
              <Stop offset="75%" stopColor="#0c18d2" stopOpacity="0.15" />
              <Stop offset="100%" stopColor="#100e0b" stopOpacity="0" />
            </SvgRadialGradient>

            {/* Layer 2: Diffused Blue Atmosphere */}
            <SvgRadialGradient
              id="phantomArcDiffuse"
              cx="50%"
              cy="-10%"
              rx="120%"
              ry="110%"
              fx="50%"
              fy="-10%"
            >
              <Stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.6" />
              <Stop offset="55%" stopColor="#0c18d2" stopOpacity="0.35" />
              <Stop offset="85%" stopColor="#0c18d2" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#100e0b" stopOpacity="0" />
            </SvgRadialGradient>

            {/* Layer 3: Champagne Rose Rim Glow */}
            <SvgRadialGradient
              id="phantomArcRim"
              cx="50%"
              cy="5%"
              rx="70%"
              ry="50%"
              fx="50%"
              fy="5%"
            >
              <Stop offset="0%" stopColor="#c8a8a6" stopOpacity="0.45" />
              <Stop offset="30%" stopColor="#c8a8a6" stopOpacity="0.2" />
              <Stop offset="65%" stopColor="#0c18d2" stopOpacity="0.1" />
              <Stop offset="100%" stopColor="#100e0b" stopOpacity="0" />
            </SvgRadialGradient>
          </Defs>

          {/* Layer 2 (Atmosphere) */}
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#phantomArcDiffuse)" />

          {/* Layer 1 (Core Arc) */}
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#phantomArcCore)" />

          {/* Layer 3 (Rim Highlight) */}
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#phantomArcRim)" />
        </Svg>
      </View>

      {/* Content sits above decorative layers */}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});

export default AuraBackground;
