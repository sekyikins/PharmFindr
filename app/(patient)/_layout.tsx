import { Stack } from 'expo-router';

export default function PatientLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 220,
        gestureEnabled: true,
        contentStyle: { backgroundColor: '#ffffff' },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="medicines" />
      <Stack.Screen name="scan" options={{ presentation: 'card' }} />
      <Stack.Screen name="ocr-result" />
      <Stack.Screen name="pharmacy/[id]" />
      <Stack.Screen name="reservation/[id]" />
      <Stack.Screen name="pharmacies" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="prescription-history" />
      <Stack.Screen name="health-profile" />
      <Stack.Screen name="edit-account" />
      <Stack.Screen name="help-feedback" />
      <Stack.Screen name="reservations-history" />
    </Stack>
  );
}
