// This default (tabs) route is unused — our app uses (patient)/(tabs) and (pharmacy)/(tabs).
// Redirect to root so the router doesn't error on it.
import { Redirect } from 'expo-router';

export default function TabsIndex() {
  return <Redirect href="/" />;
}
