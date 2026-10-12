import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { colors } from '@/theme/tokens';

function TabIcon({ name, color, focused }: { name: AppIconName; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <AppIcon name={name} size={20} color={color} strokeWidth={focused ? 2.2 : 1.8} />
    </View>
  );
}

export default function TabsLayout() {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: '#8290A3',
        tabBarLabelStyle: { fontSize: 9, fontWeight: '800', marginTop: 0 },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarStyle: {
          minHeight: 58,
          paddingTop: 2,
          paddingBottom: 4,
          borderTopColor: '#E2E8F0',
          backgroundColor: '#FFFFFF',
          elevation: 12,
          shadowColor: '#0F172A',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={String(color)} focused={focused} /> }} />
      <Tabs.Screen name="work" options={{ title: 'Work', tabBarIcon: ({ color, focused }) => <TabIcon name="work" color={String(color)} focused={focused} /> }} />
      <Tabs.Screen name="search" options={{ title: 'Search', href: role === 'accounts' ? null : undefined, tabBarIcon: ({ color, focused }) => <TabIcon name="search" color={String(color)} focused={focused} /> }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', href: role === 'accounts' ? null : undefined, tabBarIcon: ({ color, focused }) => <TabIcon name="activity" color={String(color)} focused={focused} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, focused }) => <TabIcon name="more" color={String(color)} focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  iconWrap: { width: 30, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  iconWrapActive: { backgroundColor: colors.blueSoft },
});
