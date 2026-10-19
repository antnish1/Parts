import { useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import * as SplashScreen from 'expo-splash-screen';

// Keep the cached app usable when offline. Never block sign-in indefinitely.
const MAX_STARTUP_WAIT_MS = 4500;

export function StartupUpdateGate({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(__DEV__ || !Updates.isEnabled);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) {
      void SplashScreen.hideAsync();
      return;
    }
    let active = true;
    let released = false;
    const release = () => {
      if (!active || released) return;
      released = true;
      setReady(true);
      void SplashScreen.hideAsync().catch(() => undefined);
    };
    // Short hard deadline: do not let network checks delay the app indefinitely.
    const timer = setTimeout(release, MAX_STARTUP_WAIT_MS);
    async function checkBeforeDisplay() {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!active || released || !check.isAvailable) return;
        const download = await Updates.fetchUpdateAsync();
        if (!active || released || !download.isNew) return;
        // Reload only while the splash is held. If the deadline elapsed,
        // keep the current session and apply the downloaded update on next launch.
        await Updates.reloadAsync();
      } catch {
        // Offline, update server failure, or unsupported runtime: use cached app.
      } finally {
        release();
      }
    }
    void checkBeforeDisplay();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.wait}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.text}>Checking Parts Connect updates…</Text>
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  wait: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#082B5B' },
  text: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
