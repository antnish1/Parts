import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '@/services/notifications';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { AppIcon } from '@/components/AppIcon';
import { SwitchAccountModal } from '@/components/SwitchAccountModal';

export function HomeBrandHeader() {
  const [switchOpen, setSwitchOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const notifications=useQuery({queryKey:['notifications'],queryFn:getNotifications,refetchInterval:45_000});
  const unread=(notifications.data??[]).filter(item=>!item.read_at).length;
  return (
    <View style={[styles.shell, { paddingTop: insets.top }]}> 
    <View style={styles.bar}>
      <View style={styles.brand}>
        <View style={styles.logoWrap}>
          <Image source={require('../../assets/branding/PCLOGO.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <View>
          <Text style={styles.name}>Parts Connect Portal</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="View activity and alerts" onPress={() => router.push('/(tabs)/activity')} style={styles.bell}>
          <AppIcon name="bell" size={19} color="#FFFFFF" />
          {unread>0?<View style={styles.unreadPill}><Text style={styles.unreadText}>{unread>99?'99+':unread}</Text></View>:null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Switch account" onPress={() => setSwitchOpen(true)} style={styles.profile}>
          <ProfileAvatar size={35} />
        </Pressable>
      </View>
    </View>
    <SwitchAccountModal visible={switchOpen} onClose={() => setSwitchOpen(false)} />
    </View>
  );
}
const styles = StyleSheet.create({
  shell: { marginHorizontal: -12, backgroundColor: '#082B5B' },
  bar: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: '#082B5B', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  logoWrap: { width: 42, height: 38, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,.85)' },
  logo: { width: 34, height: 30 },
  name: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  subtitle: { color: '#C1D3EB', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bell: { minWidth: 34, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  unreadPill:{position:'absolute',right:-4,top:1,minWidth:16,height:16,paddingHorizontal:3,borderRadius:9,backgroundColor:'#DC3545',alignItems:'center',justifyContent:'center'},
  unreadText:{color:'#fff',fontWeight:'900',fontSize:9},
  profile: { width: 35, height: 35, borderRadius: 18, borderWidth: 1.5, borderColor: '#FFFFFF', backgroundColor: '#315786', alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
