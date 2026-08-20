import { COLORS, FONT_SIZE, SPACING } from '@/styles/theme';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.white,
  },
  title: {
    fontSize: FONT_SIZE.hero,
    fontFamily: 'Inter-Bold',
    color: COLORS.textPrimary,
  },
  link: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  linkText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.patientPrimary,
    fontFamily: 'Inter-SemiBold',
  },
});
