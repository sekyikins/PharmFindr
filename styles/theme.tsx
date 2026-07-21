/**
 * styles/theme.tsx — Single Source of Truth
 *
 * All design tokens, palette, typography, and common styles live here.
 * Screens get these via `useTheme()` — never import hex strings directly.
 */
import React, { createContext, useContext } from 'react';

// ─── AsyncStorage (lazy, graceful fallback) ───────────────────────────────────
let _AsyncStorage: {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
} | null = null;
try {
  _AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch { /* not installed — theme resets on launch */ }

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
} as const;

// ─── Font Size ────────────────────────────────────────────────────────────────
export const FONT_SIZE = {
  xs: 10,
  sm: 11,
  md: 12,
  body: 13,
  lg: 14,
  xl: 15,
  xxl: 17,
  title: 20,
  hero: 24,
} as const;

// ─── Palette ──────────────────────────────────────────────────────────────────
// Each palette is a flat object. Nested aliases (`patient`, `pharmacy`, `text`)
// exist solely for backward-compatibility with older component references.

const _makePalette = () => {
  return {
    // Surfaces
    background:       '#f8fafc',
    backgroundAlt:    '#f1f5f9',
    card:             '#ffffff',
    surface:          '#f8fafc',
    surfaceSecondary: '#f1f5f9',
    border:           '#e2e8f0',
    borderLight:      '#f1f5f9',
    borderMuted:      '#f1f5f9',

    // Patient portal (blue)
    patientPrimary:   '#2563eb',
    patientSecondary: '#eff6ff',

    // Pharmacy portal (green)
    pharmacyPrimary:   '#10b981',
    pharmacySecondary: '#e6f7f2',

    // Text
    text:      '#1e293b',
    textMuted: '#64748b',
    textDim:   '#94a3b8',
    textDark:  '#475569',

    // Semantics
    warning: '#f59e0b',
    success: '#10b981',
    error:   '#ef4444',

    successBg:    '#d1fae5',
    successBorder:'#a7f3d0',
    successText:  '#065f46',

    pendingBg:    '#fef3c7',
    pendingBorder:'#fde68a',
    pendingText:  '#78350f',

    errorBg:    '#fef2f2',
    errorBorder:'#fca5a5',
    errorText:  '#991b1b',

    // Nested compat aliases
    patient: { primary: '#2563eb', primaryDark: '#1d4ed8', secondary: '#eff6ff', text: '#1e40af' },
    pharmacy:{ primary: '#10b981', primaryDark: '#059669', secondary: '#e6f7f2', text: '#065f46' },
  } as const;
};

export type ThemeColors = ReturnType<typeof _makePalette>;

export const LIGHT_COLORS = _makePalette();

// ─── Typography builder ───────────────────────────────────────────────────────
export function buildTypography(c: ThemeColors) {
  return {
    hero:        { fontSize: FONT_SIZE.hero,  fontWeight: '700' as const, color: c.text, letterSpacing: -0.5 },
    title:       { fontSize: FONT_SIZE.title, fontWeight: '700' as const, color: c.text },
    sectionLabel:{ fontSize: FONT_SIZE.xs,    fontWeight: '700' as const, color: c.textDim, letterSpacing: 0.8, textTransform: 'uppercase' as const },
    subtitle:    { fontSize: FONT_SIZE.body,  color: c.textDim, lineHeight: 20 },
    body:        { fontSize: FONT_SIZE.xl,    color: c.text },
    bodySmall:   { fontSize: FONT_SIZE.lg,    color: c.text },
    caption:     { fontSize: FONT_SIZE.md,    color: c.textDim },
    meta:        { fontSize: FONT_SIZE.sm,    color: c.textDim },
    fieldLabel:  { fontSize: FONT_SIZE.xs,    fontWeight: '700' as const, color: c.textDim, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
    inputLabel:  { fontSize: FONT_SIZE.xl,    fontWeight: '600' as const, color: c.text },
    menuTitle:   { fontSize: FONT_SIZE.xl,    fontWeight: '600' as const, color: c.text },
    menuSub:     { fontSize: FONT_SIZE.md,    color: c.textDim, lineHeight: 16 },
    link:        { fontSize: FONT_SIZE.md,    fontWeight: '500' as const, color: c.patientPrimary },
    mono:        { fontSize: FONT_SIZE.md,    color: c.textDim, fontFamily: 'monospace' as const },
  };
}

// ─── Common style builder ─────────────────────────────────────────────────────
export function buildCommonStyles(c: ThemeColors) {
  return {
    // Layout
    screen:   { flex: 1 as const, backgroundColor: c.background },
    center:   { flex: 1 as const, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: c.background },
    content:  { padding: SPACING.xl, paddingBottom: 36 },
    scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: 36 },

    // Cards
    card: {
      backgroundColor: c.card,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardPadded: {
      backgroundColor: c.card,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: c.border,
      padding: SPACING.lg,
    },

    // Header bar
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },

    // Inputs
    input: {
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.lg,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      color: c.text,
      fontSize: FONT_SIZE.xl,
    },

    // Buttons
    btn: { borderRadius: RADIUS.pill, height: 52, justifyContent: 'center' as const, alignItems: 'center' as const },
    btnText: { color: '#ffffff', fontSize: FONT_SIZE.xl, fontWeight: '600' as const },
    btnOutline: {
      borderRadius: RADIUS.pill, height: 52,
      justifyContent: 'center' as const, alignItems: 'center' as const,
      borderWidth: 1.5, backgroundColor: 'transparent',
    },
    btnOutlineText: { fontSize: FONT_SIZE.xl, fontWeight: '600' as const },

    // List helpers
    divider: { height: 1, backgroundColor: c.border },
    row:     { flexDirection: 'row' as const, alignItems: 'center' as const },
    rowBetween: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },

    // Icon circles
    iconCircle: {
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      borderRadius: RADIUS.pill,
    },

    // Badges
    badge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderRadius: RADIUS.pill,
    },
    badgeText: { fontSize: FONT_SIZE.sm, fontWeight: '600' as const },

    // Empty state
    emptyContainer: { flex: 1 as const, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 40 },
    emptyText: { fontSize: FONT_SIZE.lg, color: c.textDim, marginTop: SPACING.md, textAlign: 'center' as const },
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface ThemeContextValue {
  colors: ThemeColors;
  typography: ReturnType<typeof buildTypography>;
  commonStyles: ReturnType<typeof buildCommonStyles>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const colors = _makePalette();
  const typography = buildTypography(colors);
  const commonStyles = buildCommonStyles(colors);

  return (
    <ThemeContext.Provider value={{ colors, typography, commonStyles }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
