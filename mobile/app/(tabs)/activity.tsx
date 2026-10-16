import { useState } from 'react';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { getNotifications, markNotificationRead } from '@/services/notifications';
import { getVisibleOrders } from '@/services/orders';
import { StatusChip } from '@/components/StatusChip';
import { colors } from '@/theme/tokens';

export default function ActivityScreen(){
 const qc=useQueryClient();
 const [tab,setTab]=useState<'notifications'|'orders'>('notifications');
 const orders=useQuery({queryKey:['orders','activity'],queryFn:()=>getVisibleOrders(50),enabled:tab==='orders'});
 const notifications=useQuery({queryKey:['notifications'],queryFn:getNotifications,refetchInterval:45_000});
 async function open(id:string,orderId:string|null){
   try{await markNotificationRead(id);}catch{/* still allow navigation */}
   await qc.invalidateQueries({queryKey:['notifications']});
   if(orderId)router.push(`/orders/${orderId}`);
 }
 return <Screen brandHeader title="Activity & Notifications" subtitle="Orders, comments, approvals and dispatch updates">
   <View style={styles.tabs}>
     <Pressable accessibilityRole="button" onPress={()=>setTab('notifications')} style={[styles.tab,tab==='notifications'&&styles.tabSelected]}><Text style={[styles.tabText,tab==='notifications'&&styles.tabTextSelected]}>Notifications</Text></Pressable>
     <Pressable accessibilityRole="button" onPress={()=>setTab('orders')} style={[styles.tab,tab==='orders'&&styles.tabSelected]}><Text style={[styles.tabText,tab==='orders'&&styles.tabTextSelected]}>Recent Orders</Text></Pressable>
   </View>
   {tab==='orders'?<>
     {orders.isError?<StateView icon="alert" tone="error" title="Could not load recent orders" actionLabel="Retry" onAction={()=>void orders.refetch()}/>:null}
     {(orders.data??[]).slice(0,30).map(order=><Pressable key={order.id} style={styles.card} onPress={()=>router.push(`/orders/${order.id}`)}>
       <Text style={styles.title}>{order.final_order_no||order.order_no}</Text>
       <Text style={styles.body}>{order.customer_name||order.machine_no||order.branch||'Order'}</Text>
       <StatusChip status={order.approval_status||order.status} />
     </Pressable>)}
     {orders.isLoading?<StateView icon="activity" title="Loading orders"/>:null}
   </>:<>
   {notifications.isError?<StateView icon="alert" tone="error" title="Could not load notifications" message="Please try again." actionLabel="Retry" onAction={()=>void notifications.refetch()}/>:null}
   {notifications.isLoading?<StateView icon="activity" title="Loading notifications"/>:null}
   {(notifications.data??[]).map(n=><Pressable accessibilityRole="button" key={n.id} onPress={()=>void open(n.id,n.order_id)} style={[styles.card,!n.read_at&&styles.unread]}>
     <View style={styles.top}><Text style={styles.title}>{n.title}</Text>{!n.read_at?<View style={styles.dot}/>:null}</View>
     <Text style={styles.body}>{n.body}</Text>
     <Text style={styles.date}>{new Date(n.created_at).toLocaleString('en-IN')}</Text>
   </Pressable>)}
   {!notifications.isLoading&&!notifications.isError&&!notifications.data?.length?<StateView icon="inbox" title="No notifications yet" message="New order activity will appear here."/>:null}
   </>}
 </Screen>;
}
const styles=StyleSheet.create({
 tabs:{flexDirection:'row',padding:3,gap:3,backgroundColor:'#EAF2FC',borderRadius:11},
 tab:{flex:1,minHeight:38,alignItems:'center',justifyContent:'center',borderRadius:8},
 tabSelected:{backgroundColor:'#245D9B'},
 tabText:{color:'#4F6783',fontSize:11,fontWeight:'800'},
 tabTextSelected:{color:'#fff'},
 card:{padding:13,gap:6,borderRadius:13,borderWidth:1,borderColor:'#E1E8F1',backgroundColor:'#fff'},
 unread:{borderColor:'#A8C9F1',backgroundColor:'#EFF6FF'},
 top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
 title:{color:colors.text,fontSize:12,fontWeight:'900',flex:1},
 body:{color:colors.textMuted,fontSize:11,lineHeight:17},
 date:{color:'#697B90',fontSize:9,fontWeight:'700'},
 dot:{width:8,height:8,backgroundColor:'#2574D6',borderRadius:4}
});