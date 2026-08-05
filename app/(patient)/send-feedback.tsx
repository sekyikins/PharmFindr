import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { Header } from '@/components/ui/Header';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

type FeedbackType = 'General' | 'Bug Report' | 'Feature Request' | 'Pharmacy Data';

const CATEGORIES: { type: FeedbackType; label: string; icon: any; desc: string }[] = [
  { type: 'Bug Report', label: 'Bug Report', icon: 'bug-outline', desc: 'App glitch or unexpected error' },
  { type: 'Feature Request', label: 'Feature Request', icon: 'bulb-outline', desc: 'New idea to improve PharmFindr' },
  { type: 'General', label: 'General Feedback', icon: 'chatbubbles-outline', desc: 'Your experience or general thoughts' },
  { type: 'Pharmacy Data', label: 'Pharmacy Info', icon: 'business-outline', desc: 'Inaccurate pharmacy details or stock' },
];

export default function SendFeedbackScreen() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const { user, profile } = useAuthStore();

  const [category, setCategory] = useState<FeedbackType>('General');
  const [rating, setRating] = useState<number>(5);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successSent, setSuccessSent] = useState(false);

  const messageInputRef = useRef<TextInput>(null);

  const handlePickScreenshot = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Photo library permission is required to attach a screenshot.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setScreenshotUri(result.assets[0].uri);
      }
    } catch (e: any) {
      console.warn('Screenshot picker error:', e.message);
    }
  };

  const base64ToUint8Array = (base64Str: string): Uint8Array => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    const cleanStr = base64Str.replace(/[^A-Za-z0-9+/=]/g, '');
    const len = cleanStr.length;
    const array: number[] = [];

    for (let i = 0; i < len; i += 4) {
      const enc1 = chars.indexOf(cleanStr.charAt(i));
      const enc2 = chars.indexOf(cleanStr.charAt(i + 1));
      const enc3 = chars.indexOf(cleanStr.charAt(i + 2));
      const enc4 = chars.indexOf(cleanStr.charAt(i + 3));

      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;

      array.push(chr1);
      if (enc3 !== 64 && enc3 !== -1) array.push(chr2);
      if (enc4 !== 64 && enc4 !== -1) array.push(chr3);
    }

    return new Uint8Array(array);
  };

  const handleSubmitFeedback = async () => {
    if (!message.trim()) {
      Alert.alert('Required Field', 'Please enter a message describing your feedback.');
      return;
    }

    setSubmitting(true);

    try {
      let attachmentUrl: string | null = null;

      if (screenshotUri) {
        try {
          const fileExt = screenshotUri.split('.').pop()?.split('?')[0] || 'jpg';
          const fileName = `feedback_${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
          const filePath = `feedback-attachments/${fileName}`;
          const mimeType = `image/${fileExt === 'png' ? 'png' : 'jpeg'}`;

          const base64 = await FileSystem.readAsStringAsync(screenshotUri, {
            encoding: 'base64',
          });
          const byteArray = base64ToUint8Array(base64);

          const uploadPromise = supabase.storage
            .from('prescriptions')
            .upload(filePath, byteArray, {
              contentType: mimeType,
              upsert: true,
            });

          const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: new Error('Upload timeout') }), 3500)
          );

          const uploadRes = await Promise.race([uploadPromise, timeoutPromise]);

          if (uploadRes.data) {
            const { data: publicUrlData } = supabase.storage
              .from('prescriptions')
              .getPublicUrl(uploadRes.data.path);
            attachmentUrl = publicUrlData.publicUrl;
          }
        } catch (uploadErr: any) {
          console.warn('Screenshot upload exception:', uploadErr.message);
        }
      }

      await supabase.from('feedback').insert([
        {
          user_id: user?.id ?? null,
          category,
          rating,
          subject: subject.trim() || 'General Feedback',
          message: message.trim(),
          attachment_url: attachmentUrl,
        },
      ]);

      await supabase.from('audit_logs').insert([
        {
          user_id: user?.id ?? null,
          action: 'SUBMIT_FEEDBACK',
          resource_name: category,
          ip_address: 'mobile_app',
          details: {
            category,
            rating,
            subject: subject.trim() || 'General Feedback',
            message: message.trim(),
            attachment_url: attachmentUrl,
            user_email: user?.email || profile?.phone,
          },
        },
      ]);

      setSubmitting(false);
      setSuccessSent(true);
    } catch (e: any) {
      console.warn('Feedback submit error:', e.message);
      setSubmitting(false);
      setSuccessSent(true);
    }
  };

  if (successSent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.successContainer}>
          <View style={[styles.successIconCircle, { backgroundColor: theme.patientSecondary }]}>
            <Ionicons name="checkmark-circle" size={64} color={primaryColor} />
          </View>
          <Text style={[styles.successTitle, { color: theme.text.primary }]}>Thank You for Your Feedback!</Text>
          <Text style={[styles.successSub, { color: theme.textMuted }]}>
            Your insights help us improve PharmFindr for patients and healthcare providers across Ghana. Our team has received your submission.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.doneBtn, { backgroundColor: primaryColor }, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.doneBtnText}>Back to Help Center</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title="Send Feedback" showBack onBack={() => router.back()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* ── Subtitle Banner ── */}
        <View style={[styles.bannerCard, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
          <Ionicons name="heart-outline" size={24} color={primaryColor} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: theme.text.primary }]}>Help Us Improve PharmFindr</Text>
            <Text style={[styles.bannerSub, { color: theme.textMuted }]}>
              Have a feature request, bug report, or idea? We read every submission to make your experience better.
            </Text>
          </View>
        </View>

        {/* ── Category Selection ── */}
        <Text style={[styles.sectionHeading, { color: theme.textDim }]}>SELECT CATEGORY</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat.type;
            return (
              <Pressable
                key={cat.type}
                style={({ pressed }) => [
                  styles.categoryCard,
                  {
                    backgroundColor: isSelected ? theme.patientSecondary : theme.card,
                    borderColor: isSelected ? primaryColor : theme.border,
                  },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setCategory(cat.type)}
              >
                <View style={[styles.catIconCircle, { backgroundColor: isSelected ? primaryColor : theme.surfaceSecondary }]}>
                  <Ionicons name={cat.icon} size={20} color={isSelected ? '#ffffff' : primaryColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.catTitle, { color: theme.text.primary }]}>{cat.label}</Text>
                  <Text style={[styles.catDesc, { color: theme.textMuted }]} numberOfLines={1}>
                    {cat.desc}
                  </Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={18} color={primaryColor} />}
              </Pressable>
            );
          })}
        </View>

        {/* ── Rating Selector ── */}
        <Text style={[styles.sectionHeading, { color: theme.textDim, marginTop: 20 }]}>RATE YOUR EXPERIENCE</Text>
        <View style={[styles.ratingCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.ratingLabel, { color: theme.textMuted }]}>Overall satisfaction with the app:</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(star)} style={{ padding: 4 }}>
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={32}
                  color={star <= rating ? '#f59e0b' : theme.textDim}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Feedback Message Details ── */}
        <Text style={[styles.sectionHeading, { color: theme.textDim, marginTop: 20 }]}>YOUR MESSAGE</Text>

        <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.fieldLabel, { color: theme.textDim }]}>SUBJECT (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, { color: theme.text.primary, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
            placeholder="e.g., Map location error or new feature idea"
            placeholderTextColor={theme.textDim}
            value={subject}
            onChangeText={setSubject}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => messageInputRef.current?.focus()}
          />

          <Text style={[styles.fieldLabel, { color: theme.textDim, marginTop: 14 }]}>FEEDBACK DETAILS *</Text>
          <TextInput
            ref={messageInputRef}
            style={[
              styles.textArea,
              { color: theme.text.primary, backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
            ]}
            placeholder="Please explain your feedback, issue, or feature request in detail..."
            placeholderTextColor={theme.textDim}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          {/* Screenshot Attachment */}
          <Text style={[styles.fieldLabel, { color: theme.textDim, marginTop: 14 }]}>ATTACH SCREENSHOT (OPTIONAL)</Text>
          {screenshotUri ? (
            <View style={styles.screenshotPreviewRow}>
              <Image source={{ uri: screenshotUri }} style={styles.screenshotImage} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.screenshotName, { color: theme.text.primary }]}>Screenshot attached</Text>
                <Pressable onPress={() => setScreenshotUri(null)}>
                  <Text style={[styles.removeScreenshotText, { color: '#ff4d4f' }]}>Remove attachment</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.attachBtn,
                { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                pressed && { opacity: 0.7 },
              ]}
              onPress={handlePickScreenshot}
            >
              <Ionicons name="image-outline" size={20} color={primaryColor} />
              <Text style={[styles.attachBtnText, { color: primaryColor }]}>Upload Image or Screenshot</Text>
            </Pressable>
          )}
        </View>

        {/* ── Submit Button ── */}
        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: primaryColor },
            pressed && { opacity: 0.7 },
            submitting && { opacity: 0.6 },
          ]}
          onPress={handleSubmitFeedback}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="paper-plane" size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>Submit Feedback</Text>
            </>
          )}
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: SPACING.xl, paddingBottom: 160 },

  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: 20,
  },
  bannerTitle: { fontSize: 14, fontWeight: '700' },
  bannerSub: { fontSize: 12, marginTop: 2, lineHeight: 17 },

  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  categoryGrid: { gap: 10 },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  catIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catTitle: { fontSize: 14, fontWeight: '700' },
  catDesc: { fontSize: 12, marginTop: 1 },

  ratingCard: {
    borderRadius: RADIUS.xl,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  ratingLabel: { fontSize: 13, marginBottom: 10, fontWeight: '500' },
  starsRow: { flexDirection: 'row', gap: 8 },

  formCard: {
    borderRadius: RADIUS.xl,
    padding: 16,
    borderWidth: 1,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    borderRadius: RADIUS.md,
    height: 46,
    paddingHorizontal: 14,
    borderWidth: 1,
    fontSize: FONT_SIZE.md,
  },
  textArea: {
    borderRadius: RADIUS.md,
    height: 110,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    fontSize: FONT_SIZE.md,
  },

  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  attachBtnText: { fontSize: 13, fontWeight: '600' },

  screenshotPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  screenshotImage: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.sm,
  },
  screenshotName: { fontSize: 13, fontWeight: '600' },
  removeScreenshotText: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  submitBtn: {
    height: 52,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },

  // Success view
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  successSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 30 },
  doneBtn: {
    paddingHorizontal: 28,
    height: 48,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
