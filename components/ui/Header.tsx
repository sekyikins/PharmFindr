import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';

export interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  left?: React.ReactNode;
  titleAlign?: 'center' | 'left';
}

export function ScreenHeader({
  title,
  showBack = false,
  onBack,
  right,
  left,
  titleAlign = 'center',
}: ScreenHeaderProps) {
  const { theme } = useThemeContext();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  // Determine left slot content
  const leftSlot = left ?? (
    showBack ? (
      <Pressable
        onPress={handleBack}
        style={({ pressed }) => [
          styles.iconBtn,
          pressed && { opacity: 0.5 },
          { backgroundColor: theme.surfaceSecondary },
        ]}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
      </Pressable>
    ) : null
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.card, borderBottomColor: theme.border },
      ]}
    >
      {/* Centered Title Layer */}
      <View
        style={[
          styles.titleContainer,
          titleAlign === 'left' && styles.titleContainerLeft,
        ]}
        pointerEvents="none"
      >
        <Text
          style={[
            styles.title,
            { color: theme.text.primary },
            titleAlign === 'left' && styles.titleTextLeft,
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>

      {/* Left Slot */}
      <View style={styles.leftSide}>{leftSlot}</View>

      {/* Right Slot */}
      <View style={styles.rightSide}>{right ?? null}</View>
    </View>
  );
}

// ── Icon button helper ──────────────────────────────────────────────────────
interface HeaderIconBtnProps {
  name: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  color?: string;
  testID?: string;
}

export function HeaderIconBtn({ name, onPress, color, testID }: HeaderIconBtnProps) {
  const { theme } = useThemeContext();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconBtn,
        pressed && { opacity: 0.5 },
        { backgroundColor: theme.surfaceSecondary },
      ]}
      hitSlop={8}
    >
      <Ionicons name={name} size={18} color={color ?? theme.text.primary} />
    </Pressable>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    position: 'relative',
  },
  titleContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 60,
  },
  titleContainerLeft: {
    alignItems: 'flex-start',
    paddingLeft: 60,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    textAlign: 'center',
  },
  titleTextLeft: {
    textAlign: 'left',
  },
  leftSide: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 40,
    zIndex: 1,
  },
  rightSide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 40,
    zIndex: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ── Back-compat alias ──
export { ScreenHeader as Header };
