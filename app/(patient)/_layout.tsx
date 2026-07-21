import { Stack } from 'expo-router';

export default function PatientLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="medicines" />
      <Stack.Screen name="scan" options={{ presentation: 'card' }} />
      <Stack.Screen name="ocr-result" />
      <Stack.Screen name="pharmacy/[id]" />
      <Stack.Screen name="reservation/[id]" />
      <Stack.Screen name="pharmacies" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="prescription-history" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="reservations-history" />
    </Stack>
  );
}
