/**
 * styles/theme.tsx — Single Source of Truth
 *
 * All design tokens, palette, typography, and common styles live here.
 * Screens get these via `useTheme()` — never import hex strings directly.
 */

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
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 18,
  title: 20,
  hero: 22,
} as const;

// ─── Master Palette & Color Tokens (Single Source of Truth) ───────────────────
export const COLORS = {
  // Surfaces & Backgrounds
  background:       '#f8fafc',
  backgroundAlt:    '#f1f5f9',
  card:             '#ffffff',
  surface:          '#f8fafc',
  surfaceSecondary: '#f1f5f9',
  surfaceDark:      '#0f172a',
  surfaceOverlay:   'rgba(15, 23, 42, 0.6)',
  modalBackdrop:    'rgba(0, 0, 0, 0.5)',

  // Borders & Dividers
  border:           '#c6c7c9ff',
  borderLight:      '#d8dbdeff',
  borderMuted:      '#c4c5c7ff',
  borderSubtle:     '#e2e8f0',
  borderSlate:      '#cbd5e1',
  borderBlue:       '#bfdbfe',

  // Patient Portal (Blue Palette & Variants)
  patientPrimary:     '#2563eb',
  patientPrimaryDark: '#1d4ed8',
  patientSecondary:   '#eff6ff',
  patientText:        '#1e40af',
  patientTextDark:    '#1e3a8a',
  patientBorder:      '#bfdbfe',
  patientBlueAlt:     '#3b82f6',

  // Pharmacy Portal (Emerald Green Palette & Variants)
  pharmacyPrimary:     '#10b981',
  pharmacyPrimaryDark: '#059669',
  pharmacySecondary:   '#e6f7f2',
  pharmacyText:        '#065f46',
  pharmacyTextDark:    '#047857',
  pharmacyBgLight:     '#d1fae5',
  pharmacyBorderLight: '#a7f3d0',

  // Neutral Text Colors
  textPrimary:   '#1e293b',
  textSecondary: '#475569',
  textMuted:     '#64748b',
  textDim:       '#94a3b8',
  textDark:      '#0f172a',
  textDarkAlt:   '#1d293d',
  textWhite:     '#ffffff',
  textWhite70:   'rgba(255, 255, 255, 0.7)',
  textWhite85:   'rgba(255, 255, 255, 0.85)',

  // Semantics: Success (Green)
  success:       '#10b981',
  successDark:   '#059669',
  successBg:     '#d1fae5',
  successBorder: '#a7f3d0',
  successText:   '#065f46',
  successDarkBg: '#064e3b',

  // Semantics: Warning & Pending (Amber / Yellow)
  warning:       '#f59e0b',
  pendingBg:     '#fef3c7',
  pendingBorder: '#fde68a',
  pendingText:   '#78350f',
  warningDark:   '#d97706',
  warningDarkBg: '#78350f',

  // Semantics: Error & Destructive (Red)
  error:       '#ef4444',
  errorBg:     '#fef2f2',
  errorBorder: '#fca5a5',
  errorText:   '#991b1b',
  errorDarkBg: '#7f1d1d',

  // Semantics: Categories & Accents
  info:       '#3b82f6',
  infoBg:     '#dbeafe',
  infoText:   '#1e3a8a',
  infoBorder: '#93c5fd',

  pink:   '#ec4899',
  purple: '#8b5cf6',
  cyan:   '#06b6d4',
  indigo: '#6366f1',
  lime:   '#84cc16',

  // System
  white:       '#ffffff',
  black:       '#000000',
  transparent: 'transparent',
} as const;

// ─── Map Pin Color Tokens & Status Resolver (Single Source of Truth) ─────────
export const MAP_PIN_COLORS = {
  verified: '#10b981', // GREEN: PharmFindr verified partner pharmacy
  public:   '#0284c7', // BLUE: Public directory / Google Maps pharmacy
  closed:   '#64748b', // GREY: Closed pharmacy (verified or public)
  selected: '#f59e0b', // YELLOW/GOLD: Currently selected pharmacy or dropped pin
} as const;

export type PharmacyPinStatus = 'verified' | 'public' | 'closed';

export interface GetPharmacyPinColorOptions {
  isVerified?: boolean;
  isOpen?: boolean;
  isSelected?: boolean;
  showClosed?: boolean; // true for patient side; false for pharmacy side
}

/**
 * Resolves the displayed map pin color following the priority rules:
 *   selected > closed (if showClosed) > verified > public
 */
export function getPharmacyPinColor({
  isVerified = false,
  isOpen,
  isSelected = false,
  showClosed = true,
}: GetPharmacyPinColorOptions): string {
  if (isSelected) {
    return MAP_PIN_COLORS.selected;
  }
  if (showClosed && isOpen === false) {
    return MAP_PIN_COLORS.closed;
  }
  if (isVerified) {
    return MAP_PIN_COLORS.verified;
  }
  return MAP_PIN_COLORS.public;
}

const _makePalette = () => {
  return {
    ...COLORS,
    text: COLORS.textPrimary,
    textDark: COLORS.textSecondary,
    patient: {
      primary:     COLORS.patientPrimary,
      primaryDark: COLORS.patientPrimaryDark,
      secondary:   COLORS.patientSecondary,
      text:        COLORS.patientText,
    },
    pharmacy: {
      primary:     COLORS.pharmacyPrimary,
      primaryDark: COLORS.pharmacyPrimaryDark,
      secondary:   COLORS.pharmacySecondary,
      text:        COLORS.pharmacyText,
    },
  } as const;
};

export type ThemeColors = ReturnType<typeof _makePalette>;

export const LIGHT_COLORS = _makePalette();

// ─── Typography builder ───────────────────────────────────────────────────────
export function buildTypography(c: ThemeColors) {
  return {
    hero:        { fontSize: FONT_SIZE.hero,  fontFamily: 'Inter-Bold' as const, color: c.text, letterSpacing: -0.5 },
    title:       { fontSize: FONT_SIZE.title, fontFamily: 'Inter-Bold' as const, color: c.text },
    sectionLabel:{ fontSize: FONT_SIZE.xs,    fontFamily: 'Inter-Bold' as const, color: c.textDim, letterSpacing: 0.8, textTransform: 'uppercase' as const },
    subtitle:    { fontSize: FONT_SIZE.lg,  color: c.textDim, lineHeight: 20 },
    body:        { fontSize: FONT_SIZE.xl,    color: c.text },
    bodySmall:   { fontSize: FONT_SIZE.lg,    color: c.text },
    caption:     { fontSize: FONT_SIZE.md,    color: c.textDim },
    meta:        { fontSize: FONT_SIZE.sm,    color: c.textDim },
    fieldLabel:  { fontSize: FONT_SIZE.xs,    fontFamily: 'Inter-Bold' as const, color: c.textDim, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
    inputLabel:  { fontSize: FONT_SIZE.xl,    fontFamily: 'Inter-SemiBold' as const, color: c.text },
    menuTitle:   { fontSize: FONT_SIZE.xl,    fontFamily: 'Inter-SemiBold' as const, color: c.text },
    menuSub:     { fontSize: FONT_SIZE.md,    color: c.textDim, lineHeight: 16 },
    link:        { fontSize: FONT_SIZE.md,    fontFamily: 'Inter-Medium' as const, color: c.patientPrimary },
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
    btnText: { color: '#ffffff', fontSize: FONT_SIZE.xl, fontFamily: 'Inter-SemiBold' as const },
    btnOutline: {
      borderRadius: RADIUS.pill, height: 52,
      justifyContent: 'center' as const, alignItems: 'center' as const,
      borderWidth: 1.5, backgroundColor: 'transparent',
    },
    btnOutlineText: { fontSize: FONT_SIZE.xl, fontFamily: 'Inter-SemiBold' as const },

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
    badgeText: { fontSize: FONT_SIZE.sm, fontFamily: 'Inter-SemiBold' as const },

    // Empty state
    emptyContainer: { flex: 1 as const, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 40 },
    emptyText: { fontSize: FONT_SIZE.lg, color: c.textDim, marginTop: SPACING.md, textAlign: 'center' as const },
  };
}

