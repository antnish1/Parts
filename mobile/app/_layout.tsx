import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { PushRegistration } from '@/components/PushRegistration';

function AppStatusBar() {
  const { isAuthenticated } = useAuth();
  return <StatusBar barStyle={isAuthenticated ? 'light-content' : 'dark-content'} backgroundColor={isAuthenticated ? '#082B5B' : '#F4F7FB'} translucent={false} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PushRegistration />
          <AppStatusBar />
          <View style={{ flex: 1, backgroundColor: '#082B5B' }}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#082B5B' } }} />
          </View>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
