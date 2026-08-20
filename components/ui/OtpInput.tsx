import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
/**
 * components/ui/OtpInput.tsx
 *
 * Production-ready 6-digit OTP input component.
 *
 * Features:
 *  - Paste support (strips spaces/hyphens, distributes digits)
 *  - Auto-advance to next box after each digit
 *  - Backspace on empty box → move to previous
 *  - Numeric-only; numeric keyboard
 *  - iOS/Android SMS autofill (textContentType="oneTimeCode")
 *  - Auto-submits when all 6 digits are filled
 *  - Shake animation + clear on wrong code
 *  - Brief success glow on correct code
 *  - Resend countdown timer (30 s)
 */
import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OtpInputHandle {
  /** Clear all boxes and focus the first one (call on wrong OTP) */
  shake(): void;
  /** Show the success state briefly (call on correct OTP) */
  showSuccess(): void;
  /** Manually reset to empty */
  reset(): void;
}

interface OtpInputProps {
  /** Accent color for filled boxes and the resend button */
  accentColor?: string;
  /** Called once all 6 digits are present — auto-submit hook */
  onComplete?: (code: string) => void;
  /** Called whenever the current digits change */
  onChange?: (code: string) => void;
  /** Called when Resend is tapped (timer has expired) */
  onResend?: () => void;
  /** Resend countdown in seconds (default 30) */
  resendSeconds?: number;
  /** Extra label shown above the boxes (e.g. "Enter the code sent to +233...") */
  subtitle?: React.ReactNode;
  /** Disable all inputs while loading */
  disabled?: boolean;
}

const OTP_LENGTH = 6;
const EMPTY = Array(OTP_LENGTH).fill('');

// ── Component ────────────────────────────────────────────────────────────────

const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>((props, ref) => {
  const {
    accentColor = COLORS.pharmacyPrimary,
    onComplete,
    onChange,
    onResend,
    resendSeconds = 30,
    subtitle,
    disabled = false,
  } = props;

  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [successState, setSuccessState] = useState(false);
  const [resendTimer, setResendTimer] = useState(resendSeconds);
  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start resend countdown on mount
  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setResendTimer(resendSeconds);
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Imperative handle ──────────────────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    shake() {
      // Clear boxes first
      setDigits(EMPTY);
      setSuccessState(false);
      onChange?.('');
      // Shake animation
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start(() => {
        // Refocus first box
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      });
    },
    showSuccess() {
      setSuccessState(true);
    },
    reset() {
      setDigits(EMPTY);
      setSuccessState(false);
      onChange?.('');
    },
  }));

  // ── Input handlers ─────────────────────────────────────────────────────────

  const focusNext = (index: number) => {
    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const focusPrev = (index: number) => {
    if (index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  /** Fires when ANY character is typed or autofilled into a box */
  const handleChangeText = useCallback((text: string, index: number) => {
    const clean = text.replace(/[^0-9]/g, '');

    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      onChange?.(next.join(''));
      return;
    }

    // Handle paste or SMS autofill (multi-digit string)
    if (clean.length > 1) {
      const filled = Array(OTP_LENGTH).fill('');
      const charArray = clean.slice(0, OTP_LENGTH).split('');
      charArray.forEach((d, i) => { filled[i] = d; });
      setDigits(filled);
      onChange?.(charArray.join(''));

      const lastIdx = Math.min(charArray.length - 1, OTP_LENGTH - 1);
      inputRefs.current[lastIdx]?.focus();

      if (charArray.length === OTP_LENGTH) {
        onComplete?.(charArray.join(''));
      }
      return;
    }

    // Single digit
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    onChange?.(next.join(''));

    focusNext(index);

    if (next.every((d) => d !== '')) {
      onComplete?.(next.join(''));
    }
  }, [digits, onComplete, onChange]);

  /** Fires on backspace */
  const handleKeyPress = useCallback((e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (digits[index] === '') {
        // Box already empty → move to previous and clear it
        const next = [...digits];
        if (index > 0) {
          next[index - 1] = '';
          setDigits(next);
          onChange?.(next.join(''));
          focusPrev(index);
        }
      } else {
        // Clear current box
        const next = [...digits];
        next[index] = '';
        setDigits(next);
        onChange?.(next.join(''));
      }
    }
  }, [digits, onChange]);

  // ── Resend ─────────────────────────────────────────────────────────────────

  const handleResend = () => {
    if (resendTimer > 0) return;
    onResend?.();
    startTimer();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      {subtitle ? <View style={styles.subtitleRow}>{subtitle}</View> : null}

      {/* OTP Boxes */}
      <Animated.View
        style={[styles.boxRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {digits.map((digit, i) => {
          const isFilled = digit !== '';
          const isFocused = focusedIndex === i;
          const isSuccess = successState;

          return (
            <TextInput
              key={i}
              ref={(r) => {
                inputRefs.current[i] = r;
              }}
              style={[
                styles.box,
                isFilled && !isSuccess && { borderColor: accentColor, backgroundColor: accentColor + '10' },
                isFocused && !isSuccess && { borderColor: accentColor, backgroundColor: accentColor + '08', borderWidth: 2 },
                isSuccess && { borderColor: COLORS.pharmacyPrimary, backgroundColor: '#10b98115' },
              ]}
              value={digit}
              onChangeText={(text) => handleChangeText(text, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              onFocus={() => setFocusedIndex(i)}
              onBlur={() => setFocusedIndex(null)}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              textContentType="oneTimeCode"
              autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
              editable={!disabled}
              selectTextOnFocus
            />
          );
        })}
      </Animated.View>

      {/* Success indicator */}
      {successState && (
        <View style={styles.successRow}>
          <Ionicons name="checkmark-circle" size={18} color={COLORS.pharmacyPrimary} />
          <Text style={styles.successText}>Code Verified!</Text>
        </View>
      )}

      {/* Resend row */}
      <View style={styles.resendRow}>
        <Pressable
          onPress={handleResend}
          disabled={resendTimer > 0 || disabled}
          style={({ pressed }) => [styles.resendBtn, pressed && { opacity: 0.5 }]}
        >
          <Ionicons
            name="time-outline"
            size={14}
            color={resendTimer > 0 ? COLORS.textDim : accentColor}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.resendText,
              { color: resendTimer > 0 ? COLORS.textDim : accentColor },
            ]}
          >
            {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend Code'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

OtpInput.displayName = 'OtpInput';
export default OtpInput;

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.xs,
  },
  subtitleRow: {
    marginBottom: SPACING.md,
  },
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginVertical: SPACING.sm,
  },
  box: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderSlate,
    backgroundColor: COLORS.white,
    fontSize: FONT_SIZE.hero,
    fontFamily: 'Inter-Bold',
    color: COLORS.surfaceDark,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  successText: {
    color: COLORS.pharmacyPrimary,
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  resendText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-SemiBold',
  },
});
