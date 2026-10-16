import { router, useSegments } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon, type AppIconName } from '@/components/AppIcon';

type NavKey = 'home' | 'work' | 'search' | 'activity' | 'more';

type NavItem = {
  key: NavKey;
  label: string;
  icon: AppIconName;
  href: '/(tabs)/home' | '/(tabs)/work' | '/(tabs)/search' | '/(tabs)/activity' | '/(tabs)/more';
};

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: 'home', href: '/(tabs)/home' },
  { key: 'work', label: 'Work', icon: 'work', href: '/(tabs)/work' },
  { key: 'search', label: 'Search', icon: 'search', href: '/(tabs)/search' },
  { key: 'activity', label: 'Activity', icon: 'activity', href: '/(tabs)/activity' },
  { key: 'more', label: 'More', icon: 'more', href: '/(tabs)/more' },
];

function getActiveKey(firstSegment: string | undefined): NavKey {
  if (!firstSegment || firstSegment === 'index') return 'home';
  if (firstSegment === 'notifications' || firstSegment === 'activity') return 'activity';
  if (firstSegment === 'profile' || firstSegment === 'settings') return 'more';
  return 'work';
}

export function PersistentBottomNav() {
  const { role } = useAuth();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const activeKey = getActiveKey(segments[0]);

  const visibleItems = role === 'accounts'
    ? NAV_ITEMS.filter((item) => item.key !== 'search' && item.key !== 'activity')
    : NAV_ITEMS;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 4) }]}>
      {visibleItems.map((item) => {
        const active = activeKey === item.key;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => router.replace(item.href)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <AppIcon
                name={item.icon}
                size={20}
                color={active ? '#FFFFFF' : '#AEC2DC'}
                strokeWidth={active ? 2.2 : 1.8}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 58,
    paddingTop: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#082B5B',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#082B5B',
    elevation: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
  },
  item: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingTop: 2,
  },
  pressed: { opacity: 0.72 },
  iconWrap: {
    width: 30,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  iconWrapActive: { backgroundColor: '#315786' },
  label: { color: '#AEC2DC', fontSize: 9, fontWeight: '800' },
  labelActive: { color: '#FFFFFF' },
});
