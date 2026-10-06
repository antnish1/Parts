import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.navy, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: { fontSize: 11, fontWeight: '700' }, tabBarStyle: { minHeight: 62, paddingTop: 7, paddingBottom: 7, borderTopColor: colors.border } }}>
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="work" options={{ title: 'Work' }} />
      <Tabs.Screen name="search" options={{ title: 'Search', href: role === 'accounts' ? null : undefined }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', href: role === 'accounts' ? null : undefined }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } });
