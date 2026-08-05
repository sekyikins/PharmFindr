import { COLORS } from '@/styles/theme';
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
    padding: 20,
    backgroundColor: COLORS.white
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: COLORS.textPrimary
  },
  link: {
    marginTop: 15,
    paddingVertical: 15
  },
  linkText: {
    fontSize: 14,
    color: COLORS.patientPrimary,
    fontFamily: 'Inter-SemiBold'
  },

});
