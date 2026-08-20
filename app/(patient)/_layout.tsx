import { COLORS } from '@/styles/theme';
import { Stack } from 'expo-router';

export default function PatientLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 220,
        gestureEnabled: true,
        contentStyle: { backgroundColor: COLORS.white },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="medicines" />
      <Stack.Screen name="medicine/[id]" />
      <Stack.Screen name="scan" options={{ presentation: 'card' }} />
      <Stack.Screen name="ocr-result" />
      <Stack.Screen name="prescription-pharmacies" />
      <Stack.Screen name="reservation/[id]" />
      <Stack.Screen name="pharmacies" />
      <Stack.Screen name="pharmacy/[id]" />
      <Stack.Screen name="pharmacy/[id]/navigate" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="prescription-history" />
      <Stack.Screen name="health-profile" />
      <Stack.Screen name="biometric-metrics" />
      <Stack.Screen name="edit-account" />
      <Stack.Screen name="help-feedback" />
      <Stack.Screen name="send-feedback" />
      <Stack.Screen name="active-devices" />
      <Stack.Screen name="reservations-history" />
    </Stack>
  );
}
