import { useMemo } from 'react';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { MotionView } from '@/components/MotionView';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { getImmutableActivityFeed } from '@/services/orderActivity';
import { getNotifications, markNotificationRead } from '@/services/notifications';
import { colors } from '@/theme/tokens';

function titleForEvent(value:string){
 return value.replace(/_/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase());
}
function eventMessage(notes:string|null,oldStatus:string|null,newStatus:string|null){
 if(notes?.trim())return notes.trim();
 if(oldStatus&&newStatus)return `${oldStatus} → ${newStatus}`;
 return newStatus||'Order activity recorded';
}
function accentFor(value:string){
 const status=value.toLowerCase();
 if(status.includes('reject')||status.includes('delay'))return '#C0474C';
 if(status.includes('dispatch')||status.includes('approved'))return '#168063';
 if(status.includes('comment'))return '#A77527';
 return '#2669AD';
}

type FeedEntry={
 key:string;
 orderId:string|null;
 orderNo:string;
 title:string;
 body:string;
 timestamp:string;
 status:string|null;
 notificationId:string|null;
 unread:boolean;
};

export default function ActivityScreen(){
 const qc=useQueryClient();
 const activity=useQuery({queryKey:['immutable-activity-feed'],queryFn:()=>getImmutableActivityFeed(120),staleTime:15_000,refetchInterval:45_000});
 const notifications=useQuery({queryKey:['notifications'],queryFn:getNotifications,staleTime:15_000,refetchInterval:45_000});
 const feed=useMemo(()=>{
   const combined:FeedEntry[]=[];
   const events=activity.data??[];
   const alerts=notifications.data??[];
   const alertsByEvent=new Map(alerts.filter(n=>n.event_key?.startsWith('event:')).map(n=>[n.event_key.slice(6),n]));
   const pairedIds=new Set<string>();
   for(const event of events){
     const alert=alertsByEvent.get(event.id);
     if(alert)pairedIds.add(alert.id);
     combined.push({
       key:`event:${event.id}`,orderId:event.order_id,orderNo:event.order_no,
       title:alert?.title||titleForEvent(event.event_type),
       body:alert?.body||eventMessage(event.notes,event.old_status,event.new_status),
       timestamp:event.created_at,status:event.new_status,notificationId:alert?.id??null,unread:Boolean(alert&&!alert.read_at)
     });
   }
   for(const alert of alerts){
     if(pairedIds.has(alert.id))continue;
     combined.push({key:`notice:${alert.id}`,orderId:alert.order_id,orderNo:'',title:alert.title,body:alert.body,timestamp:alert.created_at,status:null,notificationId:alert.id,unread:!alert.read_at});
   }
   return combined.sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()).slice(0,120);
 },[activity.data,notifications.data]);

 async function openEntry(entry:FeedEntry){
   if(entry.notificationId){
     try{await markNotificationRead(entry.notificationId);await qc.invalidateQueries({queryKey:['notifications']});}
     catch{/* Keep audit history accessible when notification backend is unavailable. */}
   }
   if(entry.orderId)router.push(`/orders/${entry.orderId}`);
 }
 return <Screen brandHeader title="Activity" subtitle="Permanent order history and operational alerts">
   {activity.isError?<StateView icon="alert" tone="error" title="Activity could not be loaded" actionLabel="Retry" onAction={()=>void activity.refetch()}/>:null}
   {notifications.isError?<Text style={styles.notice}>Notification updates are temporarily unavailable. Permanent activity remains accessible.</Text>:null}
   {feed.map((entry,index)=>{
     const date=new Date(entry.timestamp);
     return <MotionView key={entry.key} delay={Math.min(index*20,160)}>
       <Pressable accessibilityRole="button" accessibilityLabel={`Open ${entry.title}`} onPress={()=>void openEntry(entry)} style={({pressed})=>[styles.row,entry.unread&&styles.unread,pressed&&styles.pressed]}>
         <View style={[styles.accent,{backgroundColor:accentFor(entry.title+' '+(entry.status??''))}]}/>
         <View style={styles.copy}>
           <View style={styles.heading}><Text numberOfLines={1} style={styles.title}>{entry.title}</Text>{entry.unread?<View style={styles.dot}/>:null}</View>
           {entry.orderNo?<Text numberOfLines={1} style={styles.orderNo}>{entry.orderNo}</Text>:null}
           <Text numberOfLines={3} style={styles.body}>{entry.body}</Text>
           <Text style={styles.date}>{date.toLocaleDateString('en-IN')} · {date.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</Text>
         </View>
         {entry.status?<StatusChip status={entry.status} align="right"/>:null}
       </Pressable>
     </MotionView>;
   })}
   {activity.isLoading&&!feed.length?<StateView icon="activity" title="Loading activity" message="Fetching operational history…"/>:null}
   {!activity.isLoading&&!notifications.isLoading&&!activity.isError&&!feed.length?<StateView icon="activity" title="No activity recorded yet" message="Order updates and alerts will appear here."/>:null}
 </Screen>;
}
const styles=StyleSheet.create({
 row:{minHeight:76,flexDirection:'row',alignItems:'center',gap:10,padding:11,borderRadius:13,borderWidth:1,borderColor:'#E1E7EF',backgroundColor:'#fff'},
 unread:{backgroundColor:'#EFF6FF',borderColor:'#AACDF4'},pressed:{opacity:.82},
 accent:{width:4,alignSelf:'stretch',borderRadius:3},copy:{flex:1,minWidth:0,gap:4},
 heading:{flexDirection:'row',alignItems:'center',gap:7},
 title:{color:colors.navy,fontSize:11,fontWeight:'900',flex:1},
 orderNo:{color:colors.text,fontSize:10,fontWeight:'900'},
 body:{color:colors.textMuted,fontSize:10,lineHeight:14},
 date:{color:'#718095',fontSize:9,fontWeight:'700'},
 dot:{width:7,height:7,borderRadius:4,backgroundColor:'#1E69CB'},
 notice:{fontSize:10,color:'#956B2B',backgroundColor:'#FFF7E9',borderRadius:8,padding:9}
});