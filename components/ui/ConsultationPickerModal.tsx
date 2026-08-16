import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import React from 'react';
import { StyleSheet, Text, View, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/hooks/useThemeContext';
import type { Consultation } from '@/store/chatStore';

interface ConsultationPickerModalProps {
  visible: boolean;
  medicineName: string;
  consultations: Consultation[];
  onSelectConsultation: (consultationId: string | null) => void;
  onClose: () => void;
}

export function ConsultationPickerModal({
  visible,
  medicineName,
  consultations,
  onSelectConsultation,
  onClose,
}: ConsultationPickerModalProps) {
  const { theme, primaryColor } = useThemeContext();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={[styles.iconBadge, { backgroundColor: theme.patientSecondary }]}>
              <Ionicons name="sparkles" size={20} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>
                Ask AI about {medicineName}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                This medicine is included in existing prescription consultation(s). Which conversation would you like to continue?
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </Pressable>
          </View>

          {/* Options List */}
          <ScrollView style={{ maxHeight: 280, marginVertical: SPACING.sm }} showsVerticalScrollIndicator={false}>
            {/* General AI Assistant Option */}
            <Pressable
              style={({ pressed }) => [
                styles.optionCard,
                { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => onSelectConsultation(null)}
            >
              <View style={[styles.optIcon, { backgroundColor: COLORS.patientSecondary }]}>
                <Ionicons name="chatbubbles-outline" size={18} color={COLORS.patientPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optTitle, { color: theme.text }]}>General AI Assistant</Text>
                <Text style={[styles.optSub, { color: theme.textMuted }]}>Start/continue general health conversation</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>

            {/* Matching Prescription Threads */}
            {consultations.map((c) => (
              <Pressable
                key={c.id}
                style={({ pressed }) => [
                  styles.optionCard,
                  { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => onSelectConsultation(c.id)}
              >
                <View style={[styles.optIcon, { backgroundColor: COLORS.pharmacyBgLight }]}>
                  <Ionicons name="document-text-outline" size={18} color={COLORS.pharmacyPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optTitle, { color: theme.text }]}>{c.title}</Text>
                  <Text style={[styles.optSub, { color: theme.textMuted }]}>
                    Prescription Thread · {new Date(c.updated_at || c.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </Pressable>
            ))}
          </ScrollView>

          {/* Cancel Button */}
          <Pressable
            style={({ pressed }) => [styles.cancelBtn, { borderColor: theme.border }, pressed && { opacity: 0.7 }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelText, { color: theme.text }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * Utility function to match a medicine item against user consultations
 */
export function findMatchingConsultations(
  item: { name: string; genericName?: string },
  consultations: Consultation[]
): Consultation[] {
  const medName = (item.name || '').toLowerCase().trim();
  const genericName = (item.genericName || '').toLowerCase().trim();

  return (consultations || []).filter((c) => {
    if (!c.medicines || !Array.isArray(c.medicines) || c.medicines.length === 0) {
      return false;
    }
    return c.medicines.some((m: any) => {
      const mName = (m.name || '').toLowerCase().trim();
      const mGeneric = (m.genericName || '').toLowerCase().trim();
      if (!mName && !mGeneric) return false;

      return (
        (medName && (mName.includes(medName) || mGeneric.includes(medName) || medName.includes(mName))) ||
        (genericName && (mName.includes(genericName) || mGeneric.includes(genericName) || genericName.includes(mName)))
      );
    });
  });
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.modalBackdrop,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    elevation: 5,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold',
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
    lineHeight: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  optIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optTitle: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-SemiBold',
  },
  optSub: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Regular',
    marginTop: 1,
  },
  cancelBtn: {
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xs,
  },
  cancelText: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-SemiBold',
  },
});
