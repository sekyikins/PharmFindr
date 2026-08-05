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
    accentColor = '#10b981',
    onComplete,
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
      return;
    }

    // Handle paste or SMS autofill (multi-digit string)
    if (clean.length > 1) {
      const filled = Array(OTP_LENGTH).fill('');
      const charArray = clean.slice(0, OTP_LENGTH).split('');
      charArray.forEach((d, i) => { filled[i] = d; });
      setDigits(filled);

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

    focusNext(index);

    if (next.every((d) => d !== '')) {
      onComplete?.(next.join(''));
    }
  }, [digits, onComplete]);

  /** Fires on backspace */
  const handleKeyPress = useCallback((e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (digits[index] === '') {
        // Box already empty → move to previous and clear it
        const next = [...digits];
        if (index > 0) {
          next[index - 1] = '';
          setDigits(next);
          focusPrev(index);
        }
      } else {
        // Clear current box
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      }
    }
  }, [digits]);

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
                isSuccess && { borderColor: '#10b981', backgroundColor: '#10b98115' },
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
          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
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
            color={resendTimer > 0 ? '#94a3b8' : accentColor}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.resendText,
              { color: resendTimer > 0 ? '#94a3b8' : accentColor },
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
    marginVertical: 4,
  },
  subtitleRow: {
    marginBottom: 12,
  },
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 10,
  },
  box: {
    width: 44,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  successText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '700',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 8,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
