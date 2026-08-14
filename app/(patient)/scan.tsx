import React, { useState, useRef, useEffect } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { toast } from '@/context/ToastContext';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { parsePrescriptionImage } from '@/lib/gemini';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { logAuditEvent } from '@/lib/auditLogger';
import { useHardwareBack } from '@/hooks/useHardwareBack';

const { width } = Dimensions.get('window');

export default function Scan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [flash, setFlash] = useState<boolean>(false);
  const { theme, primaryColor } = useThemeContext();
  const scanAnimation = useRef(new Animated.Value(0)).current;

  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/(tabs)/home');
    }
    return true;
  });
  
  const cameraRef = useRef<any>(null);

  useEffect(() => {
  Animated.loop(
    Animated.sequence([
      Animated.timing(scanAnimation, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      }),
      Animated.timing(scanAnimation, {
        toValue: 0,
        duration: 1800,
        useNativeDriver: true,
      }),
    ])
  ).start();
}, []);

  if (!permission) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  const scanTranslateY = scanAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [15, width * 0.95 - 20],
  });

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.permissionContainer, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={[styles.permissionIconCircle, { backgroundColor: theme.patientSecondary }]}>
          <Ionicons name="camera-outline" size={40} color={primaryColor} />
        </View>
        <Text style={[styles.permissionText, { color: theme.textMuted }]}>
          We need camera permissions to scan your prescriptions and extract medicine details automatically.
        </Text>
        <Pressable style={({pressed})=>[styles.permissionBtn, pressed && { opacity: 0.5 }, { backgroundColor: primaryColor }]} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Camera Permission</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const processImage = async (uri: string) => {
    setProcessing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Call Gemini multimodal OCR (never throws — returns [] on failure)
      const medicines = await parsePrescriptionImage(base64, 'image/jpeg');

      await logAuditEvent({
        action: 'SCAN_PRESCRIPTION',
        resourceType: 'prescription',
        metadata: { medicine_count: medicines.length },
      });

      // Always navigate to results — ocr-result handles empty state
      router.push({
        pathname: '/(patient)/ocr-result',
        params: { 
          medicines: JSON.stringify(medicines),
          imageUri: uri
        }
      });
    } catch (error: any) {
      console.error('Error processing image:', error);
      toast.error('Processing Error', 'Could not read the image. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
        });
        if (photo?.uri) {
          await processImage(photo.uri);
        }
      } catch (e) {
        console.error('Capture error:', e);
      }
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        await processImage(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Gallery pick error:', e);
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, styles.permissionContainer]} edges={['top', 'bottom']}>
        <Ionicons name="camera-outline" size={64} color={theme.textMuted} />
        <Text style={[styles.permissionText, { color: theme.text.primary }]}>
          We need your permission to use the camera to scan prescriptions.
        </Text>
        <Pressable style={({pressed})=>[styles.permissionBtn, pressed && { opacity: 0.5 }, { backgroundColor: primaryColor }]} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {processing ? (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={COLORS.white} />
          <Text style={styles.processingText}>Extracting prescription text...</Text>
          <Text style={styles.processingSub}>Analyzing your prescriptions</Text>
        </View>
      ) : (
        <>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            ref={cameraRef}
            enableTorch={flash}
          />

          {/* Absolute Overlay on top of CameraView */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            {/* Grid Background Mock overlays */}
            <View style={styles.gridOverlay} pointerEvents="none">
              <View style={styles.gridLineHorizontal} />
              <View style={styles.gridLineHorizontal2} />
              <View style={styles.gridLineVertical} />
              <View style={styles.gridLineVertical2} />
            </View>

            {/* Header Controls */}
            <SafeAreaView style={styles.cameraHeader} edges={['top']}>
              <Pressable
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.navigate('/(patient)/(tabs)/home');
                  }
                }}
                style={({pressed})=>[styles.circleIconBtn, pressed && { opacity: 0.5 }]}
              >
                <Ionicons name="arrow-back" size={20} color={COLORS.white} />
              </Pressable>

              <Pressable onPress={() => setFlash(!flash)} style={({pressed})=>[styles.circleIconBtn, pressed && { opacity: 0.5 }]}>
                <Ionicons name={flash ? 'flash' : 'flash-outline'} size={20} color={flash ? '#fbbf24' : COLORS.white} />
              </Pressable>
            </SafeAreaView>

            {/* Viewfinder Guideline Box with futuristic corner brackets */}
            <View style={styles.viewfinderContainer}>
              <View style={styles.viewfinder}>
                {/* Corner brackets */}
                <View style={[styles.corner, styles.topLeft, { borderColor: primaryColor }]} />
                <View style={[styles.corner, styles.topRight, { borderColor: primaryColor }]} />
                <View style={[styles.corner, styles.bottomLeft, { borderColor: primaryColor }]} />
                <View style={[styles.corner, styles.bottomRight, { borderColor: primaryColor }]} />

                {/* Horizontal scanning light simulation */}
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      backgroundColor: primaryColor,
                      transform: [{ translateY: scanTranslateY }],
                    },
                  ]}
                />
              </View>
              <Text style={styles.viewfinderText}>Position prescription within frame</Text>
              <Text style={styles.viewfinderSubText}>Hold steady for best results</Text>
            </View>

            {/* Action Footer */}
            <View style={styles.cameraFooter}>
              <Pressable onPress={handlePickImage} style={({pressed})=>[styles.footerIconBtn, pressed && { opacity: 0.5 }]}>
                <Ionicons name="image-outline" size={24} color={COLORS.white} />
                <Text style={styles.footerIconLabel}>Gallery</Text>
              </Pressable>

              <Pressable onPress={handleCapture} style={({pressed})=>[styles.captureOuter, pressed && { opacity: 0.5 }]}>
                <View style={styles.captureInner} />
              </Pressable>

              <Pressable onPress={() => {}} style={({pressed})=>[styles.footerIconBtn, pressed && { opacity: 0.5 }]}>
                <Ionicons name="bulb-outline" size={24} color={COLORS.white} />
                <Text style={styles.footerIconLabel}>Tips</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black
  },
  loadingCenter: {
    flex: 1,
    backgroundColor: COLORS.black,
    justifyContent: 'center',
    alignItems: 'center'
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl
  },
  permissionIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xxl
  },
  permissionText: {
    fontFamily: 'Inter-Regular',
    
    fontSize: FONT_SIZE.xl,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32
  },
  permissionBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: RADIUS.pill,
    width: '100%',
    alignItems: 'center'
  },
  permissionBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold'
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1
  },
  gridLineHorizontal: {
    position: 'absolute', top: '33%', left: 0, right: 0, height: 1, backgroundColor: COLORS.white
  },
  gridLineHorizontal2: {
    position: 'absolute', top: '66%', left: 0, right: 0, height: 1, backgroundColor: COLORS.white
  },
  gridLineVertical: {
    position: 'absolute', left: '33%', top: 0, bottom: 0, width: 1, backgroundColor: COLORS.white
  },
  gridLineVertical2: {
    position: 'absolute', left: '66%', top: 0, bottom: 0, width: 1, backgroundColor: COLORS.white
  },

  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md
  },
  circleIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },

  viewfinderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  viewfinder: {
    width: width * 0.75,
    height: width * 0.95,
    position: 'relative'
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: RADIUS.md
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: RADIUS.md
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: RADIUS.md
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: RADIUS.md
  },
  scanLine: {
    position: 'absolute',
    left: '5%',
    right: '5%',
    height: 2
  },
  viewfinderText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
    marginTop: 20,
    textAlign: 'center'
  },
  viewfinderSubText: {
    fontFamily: 'Inter-Regular',
    
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: FONT_SIZE.md,
    marginTop: 6,
    textAlign: 'center'
  },

  cameraFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 48,
    paddingHorizontal: 40
  },
  footerIconBtn: {
    alignItems: 'center',
    width: 60
  },
  footerIconLabel: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    marginTop: 6,
    fontFamily: 'Inter-SemiBold'
  },
  captureOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center'
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.white
  },

  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center'
  },
  processingText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xxl,
    fontFamily: 'Inter-Bold',
    marginTop: 20
  },
  processingSub: {
    fontFamily: 'Inter-Regular',
    
    color: COLORS.textDim,
    fontSize: FONT_SIZE.lg,
    marginTop: 8
  },

});
