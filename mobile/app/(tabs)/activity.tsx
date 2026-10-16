import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { getNotifications, markNotificationRead } from '@/services/notifications';
import { colors } from '@/theme/tokens';

export default function ActivityScreen(){
 const qc=useQueryClient();
 const notifications=useQuery({queryKey:['notifications'],queryFn:getNotifications,refetchInterval:45_000});
 async function open(id:string,orderId:string|null){
   try{await markNotificationRead(id);}catch{/* still allow navigation */}
   await qc.invalidateQueries({queryKey:['notifications']});
   if(orderId)router.push(`/orders/${orderId}`);
 }
 return <Screen brandHeader title="Notifications" subtitle="Orders, comments, approvals and dispatch updates">
   {notifications.isError?<StateView icon="alert" tone="error" title="Could not load notifications" message="Please try again." actionLabel="Retry" onAction={()=>void notifications.refetch()}/>:null}
   {notifications.isLoading?<StateView icon="activity" title="Loading notifications"/>:null}
   {(notifications.data??[]).map(n=><Pressable accessibilityRole="button" key={n.id} onPress={()=>void open(n.id,n.order_id)} style={[styles.card,!n.read_at&&styles.unread]}>
     <View style={styles.top}><Text style={styles.title}>{n.title}</Text>{!n.read_at?<View style={styles.dot}/>:null}</View>
     <Text style={styles.body}>{n.body}</Text>
     <Text style={styles.date}>{new Date(n.created_at).toLocaleString('en-IN')}</Text>
   </Pressable>)}
   {!notifications.isLoading&&!notifications.isError&&!notifications.data?.length?<StateView icon="inbox" title="No notifications yet" message="New order activity will appear here."/>:null}
 </Screen>;
}
const styles=StyleSheet.create({
 card:{padding:13,gap:6,borderRadius:13,borderWidth:1,borderColor:'#E1E8F1',backgroundColor:'#fff'},
 unread:{borderColor:'#A8C9F1',backgroundColor:'#EFF6FF'},
 top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
 title:{color:colors.text,fontSize:12,fontWeight:'900',flex:1},
 body:{color:colors.textMuted,fontSize:11,lineHeight:17},
 date:{color:'#697B90',fontSize:9,fontWeight:'700'},
 dot:{width:8,height:8,backgroundColor:'#2574D6',borderRadius:4}
});