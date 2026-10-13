import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { useAuth } from '@/auth/AuthProvider';

export function HomeBrandHeader() {
  const { profile } = useAuth();
  const initial = (profile?.fullName || 'U').trim().charAt(0).toUpperCase();
  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <Image source={require('../../assets/native/icon.png')} style={styles.logo} resizeMode="contain" />
        <View>
          <Text style={styles.name}>Parts Connect</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="View activity and alerts" onPress={() => router.push('/(tabs)/activity')} style={styles.bell}>
          <AppIcon name="bell" size={19} color="#FFFFFF" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open my profile" onPress={() => router.push('/(tabs)/more')} style={styles.profile}>
          <Text style={styles.initial}>{initial}</Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  bar: { minHeight: 56, marginHorizontal: -12, marginTop: -8, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: '#082B5B', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  logo: { width: 34, height: 34, borderRadius: 8 },
  name: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  subtitle: { color: '#C1D3EB', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bell: { minWidth: 34, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  profile: { width: 35, height: 35, borderRadius: 18, borderWidth: 1.5, borderColor: '#FFFFFF', backgroundColor: '#315786', alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
