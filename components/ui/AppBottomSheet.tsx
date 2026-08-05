
import React, { forwardRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, SPACING, RADIUS } from '@/styles/theme';

interface AppBottomSheetProps {
  /** Snap point heights, e.g. ['40%', '70%']. Optional when dynamic sizing is enabled. */
  snapPoints?: (string | number)[];
  /** Enable dynamic height sizing to fit content automatically (defaults to true) */
  enableDynamicSizing?: boolean;
  /** Optional title shown at the top of the sheet content */
  rightBtn?: React.ReactNode;
  leftBtn?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
}

const AppBottomSheet = forwardRef<any, AppBottomSheetProps>(
  ({ snapPoints, enableDynamicSizing = true, leftBtn, rightBtn, title, children, onClose }, ref) => {
    const { theme } = useThemeContext();

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
        />
      ),
      []
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        enableDynamicSizing={enableDynamicSizing}
        enablePanDownToClose
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: theme.card }}
        handleIndicatorStyle={{ backgroundColor: theme.textDim, width: 40 }}
        onDismiss={onClose}
        onChange={(index) => {
          if (index === -1) onClose?.();
        }}
      >
        <BottomSheetView style={styles.content}>
          <View style={[styles.titleRow, { borderBottomColor: theme.border }]}>
            <View style={styles.side}>
              {leftBtn}
            </View>

            {title && (
              <View style={styles.titleContainer} pointerEvents="none">
                <Text style={[styles.title, { color: theme.text.primary }]}>
                  {title}
                </Text>
              </View>
            )}
            
            <View style={[styles.side, { alignItems: "flex-end" }]}>
              {rightBtn}
            </View>
          </View>
          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 50 }}
          >
            {children}
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

AppBottomSheet.displayName = 'AppBottomSheet';
export default AppBottomSheet;

const styles = StyleSheet.create({
  content: {
    paddingBottom: 12
  },
  titleRow: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    position: "relative"
  },
  side: {
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    marginTop: SPACING.xl
  },
  titleContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center"
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
    textAlignVertical: "center"
  },

});
