import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useStore } from '../stores/useStore';
import { LoginScreen } from '../screens/LoginScreen';
import { PDVScreen } from '../screens/PDVScreen';
import { getDatabase } from '../db/localDatabase';

export default function AppEntry() {
  const token = useStore((s) => s.token);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Initialize local database
    getDatabase().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!token) {
    return <LoginScreen />;
  }

  return <PDVScreen />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
});
