import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '@/services/notifications';
import { isManagerApprovalOutcomeNotification } from '@/services/activityRelevance';
import { getActivityReadKeys, getImmutableActivityFeed } from '@/services/orderActivity';
import { useAuth } from '@/auth/AuthProvider';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { AppIcon } from '@/components/AppIcon';
import { SwitchAccountModal } from '@/components/SwitchAccountModal';

export function HomeBrandHeader() {
  const [switchOpen, setSwitchOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const {role}=useAuth();
  const activity=useQuery({queryKey:['immutable-activity-feed'],queryFn:()=>getImmutableActivityFeed(120),staleTime:15_000,refetchInterval:45_000});
  const notifications=useQuery({queryKey:['notifications'],queryFn:getNotifications,staleTime:15_000,refetchInterval:45_000});
  const reads=useQuery({queryKey:['activity-read-keys'],queryFn:getActivityReadKeys,staleTime:15_000,refetchInterval:45_000});
  const readKeys=new Set(reads.data??[]);
  const alerts=(notifications.data??[]).filter(n=>!(role==='manager'&&isManagerApprovalOutcomeNotification(n.category,n.title)));
  const eventIds=new Set<string>();
  let unread=0;
  for(const event of activity.data??[]){
    if(event.event_type==='ORDER_CREATED'&&role!=='manager'&&role!=='super')continue;
    if(role==='manager'&&/APPROV|REJECT/i.test(event.event_type))continue;
    const matching=alerts.find(n=>n.event_key===`event:${event.id}`);
    if(matching)eventIds.add(matching.id);
    if(!readKeys.has(`event:${event.id}`)&&!matching?.read_at)unread++;
  }
  for(const alert of alerts){
    if(eventIds.has(alert.id))continue;
    if(!readKeys.has(`notice:${alert.id}`)&&!alert.read_at)unread++;
  }
  return (
    <View style={[styles.shell, { paddingTop: insets.top }]}> 
    <View style={styles.bar}>
      <View style={styles.brand}>
        <View style={styles.logoWrap}>
          <Image source={require('../../assets/branding/PCLOGO.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={styles.divider} />
        <View style={styles.brandNameRow}>
          <Text style={styles.name}>Parts Connect</Text>
          <Text style={styles.portal}>Portal</Text>
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
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  logoWrap: { width: 46, height: 46, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,.95)' },
  logo: { width: 36, height: 36 },
  divider: { width: 1, height: 34, backgroundColor: 'rgba(190,220,255,.65)' },
  brandNameRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0, flexShrink: 1 },
  name: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: -.25 },
  portal: { color: '#7FC2FF', fontSize: 18, fontWeight: '900', letterSpacing: -.25, marginLeft: 5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bell: { minWidth: 34, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  unreadPill:{position:'absolute',right:-4,top:1,minWidth:16,height:16,paddingHorizontal:3,borderRadius:9,backgroundColor:'#DC3545',alignItems:'center',justifyContent:'center'},
  unreadText:{color:'#fff',fontWeight:'900',fontSize:9},
  profile: { width: 35, height: 35, borderRadius: 18, borderWidth: 1.5, borderColor: '#FFFFFF', backgroundColor: '#315786', alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
