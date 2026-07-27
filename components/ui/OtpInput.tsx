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

  /** Fires when ANY character is typed into a box */
  const handleChangeText = useCallback((text: string, index: number) => {
    // Strip non-digits
    const clean = text.replace(/[^0-9]/g, '');

    // Handle paste: if >1 char, distribute across boxes
    if (clean.length > 1) {
      const newDigits = [...EMPTY];
      for (let i = 0; i < OTP_LENGTH && i < clean.length; i++) {
        newDigits[index + i < OTP_LENGTH ? index + i : OTP_LENGTH - 1] = clean[i];
      }
      // Clamp to OTP_LENGTH
      const filled = [...EMPTY];
      clean.slice(0, OTP_LENGTH).split('').forEach((d, i) => { filled[i] = d; });
      setDigits(filled);

      // Focus the last filled box or last box
      const lastIdx = Math.min(clean.length - 1, OTP_LENGTH - 1);
      inputRefs.current[lastIdx]?.focus();

      // Auto-submit if fully filled
      if (clean.length >= OTP_LENGTH) {
        onComplete?.(filled.join(''));
      }
      return;
    }

    // Single digit
    if (clean.length === 1) {
      const next = [...digits];
      next[index] = clean;
      setDigits(next);

      // Auto-advance
      focusNext(index);

      // Auto-submit
      if (next.every(d => d !== '')) {
        onComplete?.(next.join(''));
      }
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

  return (
    <View>
      {subtitle ? <View style={styles.subtitleRow}>{subtitle}</View> : null}

      {/* OTP Boxes */}
      <Animated.View
        style={[styles.boxRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {digits.map((digit, i) => {
          const isFilled = digit !== '';
          const isSuccess = successState;

          return (
            <TextInput
              key={i}
              ref={r => { inputRefs.current[i] = r; }}
              style={[
                styles.box,
                isFilled && !isSuccess && { borderColor: accentColor, backgroundColor: accentColor + '15' },
                isSuccess && { borderColor: '#10b981', backgroundColor: '#10b981' + '25' },
              ]}
              value={digit}
              onChangeText={text => handleChangeText(text, i)}
              onKeyPress={e => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={6} // Allow 6 for paste to work on Android
              textAlign="center"
              textContentType="oneTimeCode" // iOS SMS autofill
              autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'} // Android SMS autofill
              editable={!disabled}
              selectTextOnFocus
            />
          );
        })}
      </Animated.View>

      {/* Success indicator */}
      {successState && (
        <View style={styles.successRow}>
          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          <Text style={styles.successText}>Verified!</Text>
        </View>
      )}

      {/* Resend row */}
      <View style={styles.resendRow}>
        <Pressable
          onPress={handleResend}
          disabled={resendTimer > 0 || disabled}
          style={({ pressed }) => [styles.resendBtn, pressed && { opacity: 0.5 }]}
        >
          <Text
            style={[
              styles.resendText,
              { color: resendTimer > 0 ? '#94a3b8' : accentColor },
            ]}
          >
            {resendTimer > 0
              ? `Resend code in ${resendTimer}s`
              : 'Resend Code'}
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
  subtitleRow: {
    marginBottom: 16,
  },
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 12,
  },
  box: {
    width: 46,
    height: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 2,
  },
  successText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '600',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 12,
  },
  resendBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
