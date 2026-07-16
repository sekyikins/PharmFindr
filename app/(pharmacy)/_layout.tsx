import { Stack } from 'expo-router';

export default function PharmacyLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add-medicine" />
      <Stack.Screen name="upload-inventory" />
      <Stack.Screen name="pharmacy-reservation/[id]" />
    </Stack>
  );
}
