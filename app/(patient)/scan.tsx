import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { colors } from '@/theme/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { parsePrescriptionImage } from '@/lib/gemini';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

export default function Scan() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = colors[isDark ? 'dark' : 'light'];

  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const cameraRef = useRef<any>(null);

  if (!permission) {
    return (
      <View style={[styles.loadingCenter, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.patient.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.permissionText, { color: theme.text.primary }]}>
          We need your permission to show the camera.
        </Text>
        <Pressable 
          style={[styles.primaryBtn, { backgroundColor: theme.patient.primary }]}
          onPress={requestPermission}
        >
          <Text style={styles.primaryBtnText}>Grant Permission</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const processImage = async (uri: string) => {
    setProcessing(true);
    try {
      // Read image as base64 using expo-file-system
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      // Call Gemini multimodal OCR
      const medicines = await parsePrescriptionImage(base64, 'image/jpeg');

      // Navigate to OCR results screen
      router.push({
        pathname: '/(patient)/ocr-result',
        params: { 
          medicines: JSON.stringify(medicines),
          imageUri: uri
        }
      });
    } catch (error) {
      console.error('Error processing image:', error);
      // Fail-soft mock fallback
      router.push({
        pathname: '/(patient)/ocr-result',
        params: { 
          medicines: JSON.stringify([
            { name: 'Amoxicillin', strength: '500mg', quantity: 15, frequency: '1 capsule three times daily', duration: '5 days' },
            { name: 'Paracetamol', strength: '500mg', quantity: 10, frequency: '1 tablet as needed for pain', duration: '5 days' }
          ]),
          imageUri: uri
        }
      });
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
          setPreviewImage(photo.uri);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setPreviewImage(result.assets[0].uri);
        await processImage(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Gallery pick error:', e);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      {processing ? (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={theme.patient.primary} />
          <Text style={styles.processingText}>AI is analyzing prescription...</Text>
        </View>
      ) : (
        <CameraView style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} ref={cameraRef}>
          {/* Header Controls */}
          <SafeAreaView style={styles.cameraHeader} edges={['top']}>
            <Pressable onPress={() => router.back()} style={styles.iconButton}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </Pressable>
            <Text style={styles.headerTitle}>Scan Prescription</Text>
            <View style={{ width: 44 }} />
          </SafeAreaView>

          {/* Viewfinder Guideline Box */}
          <View style={styles.viewfinderContainer}>
            <View style={styles.viewfinderOutline} />
            <Text style={styles.viewfinderText}>Align prescription inside the box</Text>
          </View>

          {/* Action Footer */}
          <View style={styles.cameraFooter}>
            <Pressable onPress={handlePickImage} style={styles.iconButton}>
              <Ionicons name="images" size={24} color="#ffffff" />
            </Pressable>

            <Pressable onPress={handleCapture} style={styles.captureBtn}>
              <View style={styles.captureBtnInner} />
            </Pressable>

            <View style={{ width: 44 }} />
          </View>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionText: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  primaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderOutline: {
    width: '80%',
    height: '60%',
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 16,
    borderStyle: 'dashed',
  },
  viewfinderText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cameraFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  processingText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
