import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';

export interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  /** Alias for right — use whichever reads more clearly at call sites */
  rightElement?: React.ReactNode;
  left?: React.ReactNode;
  titleAlign?: 'center' | 'left';
}

export function ScreenHeader({
  title,
  showBack = false,
  onBack,
  right,
  rightElement,
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
        <Ionicons name="arrow-back" size={18} color={theme.text} />
      </Pressable>
    ) : null
  );

  const rightSlot = rightElement ?? right ?? null;

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
            { color: theme.text },
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
      <View style={styles.rightSide}>{rightSlot}</View>
    </View>
  );
}

// ── Icon button helper ──────────────────────────────────────────────────────
interface HeaderIconBtnProps {
  name?: React.ComponentProps<typeof Ionicons>['name'];
  /** Alias for name */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  color?: string;
  testID?: string;
  /** Unread count badge displayed on top-right of the button */
  badge?: number;
}

export function HeaderIconBtn({ name, icon, onPress, color, testID, badge }: HeaderIconBtnProps) {
  const { theme } = useThemeContext();
  const iconName = name ?? icon ?? 'notifications-outline';
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
      <Ionicons name={iconName} size={18} color={color ?? theme.text} />
      {badge != null && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
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
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
  },
  titleTextLeft: {
    fontFamily: 'Inter-Regular',
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
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Bold',
  },
});

// ── Back-compat alias ──
export { ScreenHeader as Header };
