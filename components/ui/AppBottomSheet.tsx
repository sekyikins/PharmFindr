import React, { forwardRef, useCallback, useRef } from 'react';
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

export interface AppBottomSheetProps {
  name?: string;
  snapPoints?: (string | number)[];
  enableDynamicSizing?: boolean;
  maxDynamicContentSize?: number;
  maxHeight?: number;
  scrollable?: boolean;
  rightBtn?: React.ReactNode;
  leftBtn?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
}

const AppBottomSheet = forwardRef<any, AppBottomSheetProps>(
  (
    {
      name,
      snapPoints,
      enableDynamicSizing,
      maxDynamicContentSize,
      maxHeight,
      scrollable = false,
      leftBtn,
      rightBtn,
      title,
      children,
      onClose,
    },
    ref
  ) => {
    const { theme } = useThemeContext();
    const isDismissingRef = useRef(false);

    const effectiveMaxSize = maxHeight ?? maxDynamicContentSize;

    // For scrollable lists, use explicit snapPoints to ensure reliable height calculation on Android.
    // For non-scrollable sheets, use dynamic sizing to fit the exact content.
    const resolvedSnapPoints = scrollable
      ? snapPoints || (effectiveMaxSize ? [effectiveMaxSize] : ['50%'])
      : snapPoints;

    const isDynamic = enableDynamicSizing !== undefined
      ? enableDynamicSizing
      : !scrollable && !snapPoints;

    const handleDismiss = useCallback(() => {
      if (!isDismissingRef.current) {
        isDismissingRef.current = true;
        onClose?.();
        setTimeout(() => {
          isDismissingRef.current = false;
        }, 150);
      }
    }, [onClose]);

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

    const renderTitleRow = () => (
      <View style={[styles.titleRow, { borderBottomColor: theme.border }]}>
        <View style={styles.side}>{leftBtn}</View>

        {title && (
          <View style={styles.titleContainer} pointerEvents="none">
            <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>
          </View>
        )}

        <View style={[styles.side, { alignItems: 'flex-end' }]}>{rightBtn}</View>
      </View>
    );

    return (
      <BottomSheetModal
        ref={ref}
        name={name || undefined}
        snapPoints={resolvedSnapPoints}
        enableDynamicSizing={isDynamic}
        maxDynamicContentSize={isDynamic ? effectiveMaxSize : undefined}
        enablePanDownToClose
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: theme.card }}
        handleIndicatorStyle={{ backgroundColor: theme.textDim, width: 40 }}
        onDismiss={handleDismiss}
        onChange={(index) => {
          if (index === -1) handleDismiss();
        }}
      >
        {scrollable ? (
          <View style={styles.scrollableWrapper}>
            {renderTitleRow()}
            <BottomSheetScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </BottomSheetScrollView>
          </View>
        ) : (
          <BottomSheetView style={styles.viewContent}>
            {renderTitleRow()}
            {children}
          </BottomSheetView>
        )}
      </BottomSheetModal>
    );
  }
);

AppBottomSheet.displayName = 'AppBottomSheet';
export default AppBottomSheet;

const styles = StyleSheet.create({
  scrollableWrapper: {
    flex: 1,
  },
  titleRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    borderBottomWidth: 1,
    position: 'relative',
    marginBottom: SPACING.xs,
  },
  side: {
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
    textAlignVertical: 'center',
  },
  viewContent: {
    paddingBottom: SPACING.xl,
  },
});
