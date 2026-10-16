import { Stack, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { PersistentBottomNav } from '@/components/PersistentBottomNav';
import { PushRegistration } from '@/components/PushRegistration';

function AppStatusBar() {
  const { isAuthenticated } = useAuth();
  return <StatusBar barStyle={isAuthenticated ? 'light-content' : 'dark-content'} backgroundColor={isAuthenticated ? '#082B5B' : '#F4F7FB'} translucent={false} />;
}

function RootNavigationShell() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const firstSegment = segments[0];
  const insideTabs = firstSegment === '(tabs)';
  const isLogin = firstSegment === 'login';
  const showPersistentNav = !isLoading && isAuthenticated && !insideTabs && !isLogin;

  return (
    <View style={styles.root}>
      <View style={styles.navigator}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      {showPersistentNav ? <PersistentBottomNav /> : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PushRegistration />
          <AppStatusBar />
          <RootNavigationShell />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  navigator: { flex: 1 },
});
