import { Stack } from 'expo-router';

export default function PatientLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="medicines" />
      <Stack.Screen name="scan" options={{ presentation: 'card' }} />
      <Stack.Screen name="ocr-result" />
      <Stack.Screen name="medicine/[id]" />
      <Stack.Screen name="pharmacy/[id]" />
      <Stack.Screen name="reservation/[id]" />
    </Stack>
  );
}
