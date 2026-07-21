import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE, SPACING, RADIUS } from '@/styles/theme';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightElement?: React.ReactNode;
}

export function Header({ title, showBack = false, rightElement }: HeaderProps) {
  const { theme, primaryColor } = useThemeContext();
  const router = useRouter();

  return (
    <View
      style={[
        styles.container,
        { borderBottomColor: theme.border, backgroundColor: theme.card },
      ]}
    >
      <View style={styles.side}>
        {showBack && (
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
          </Pressable>
        )}
      </View>
      <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>
      <View style={styles.side}>{rightElement ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
  },
  side: {
    width: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: FONT_SIZE.title,
    fontWeight: '700',
    textAlign: 'center',
  },
});
