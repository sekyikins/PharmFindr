import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import AppBottomSheet from './AppBottomSheet';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';

interface AvatarPickerSheetProps {
  /** Whether the user currently has a profile photo (shows Remove option) */
  hasPhoto: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onRemove?: () => void;
}

const AvatarPickerSheet = forwardRef<BottomSheetModal, AvatarPickerSheetProps>(
  ({ hasPhoto, onCamera, onGallery, onRemove }, ref) => {
    const { theme, primaryColor } = useThemeContext();

    const close = () => (ref as React.RefObject<BottomSheetModal>).current?.dismiss();

    const action = (cb: () => void) => {
      close();
      // Small delay so the sheet animates out before launching picker
      setTimeout(cb, 200);
    };

    const rows: {
      icon: keyof typeof Ionicons.glyphMap;
      label: string;
      color?: string;
      onPress: () => void;
      destructive?: boolean;
    }[] = [
      {
        icon: 'camera-outline',
        label: 'Take Photo',
        color: primaryColor,
        onPress: () => action(onCamera),
      },
      {
        icon: 'image-outline',
        label: 'Choose from Gallery',
        color: primaryColor,
        onPress: () => action(onGallery),
      },
    ];

    if (hasPhoto && onRemove) {
      rows.push({
        icon: 'trash-outline',
        label: 'Remove Photo',
        color: theme.error,
        destructive: true,
        onPress: () => action(onRemove!),
      });
    }

    return (
      <AppBottomSheet
        ref={ref}
        title="Profile Picture"
      >
        <View style={styles.rows}>
          {rows.map((row) => (
            <Pressable
              key={row.label}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: theme.border },
                pressed && { backgroundColor: theme.surfaceSecondary },
              ]}
              onPress={row.onPress}
            >
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: row.destructive
                      ? theme.errorBg
                      : theme.patientSecondary,
                  },
                ]}
              >
                <Ionicons name={row.icon} size={20} color={row.color ?? primaryColor} />
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: row.destructive ? theme.error : theme.text.primary,
                  },
                ]}
              >
                {row.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
            </Pressable>
          ))}
        </View>
      </AppBottomSheet>
    );
  }
);

AvatarPickerSheet.displayName = 'AvatarPickerSheet';
export default AvatarPickerSheet;

const styles = StyleSheet.create({
  rows: {
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    gap: SPACING.md,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    flex: 1,
    fontSize: FONT_SIZE.body,
    fontWeight: '500',
  },
});
