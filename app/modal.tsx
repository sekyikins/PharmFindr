import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Modal Screen</Text>
      <View style={styles.separator} />
      <Text style={styles.infoText}>This modal screen is currently empty.</Text>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: '80%',
    backgroundColor: '#e2e8f0',
  },
  infoText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
