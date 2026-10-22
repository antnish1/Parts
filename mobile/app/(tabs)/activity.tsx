import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { MotionView } from '@/components/MotionView';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { AppIcon } from '@/components/AppIcon';
import { getActivityReadKeys, getImmutableActivityFeed, markActivityRead } from '@/services/orderActivity';
import { getNotifications, markNotificationRead } from '@/services/notifications';
import { colors } from '@/theme/tokens';
import { useAuth } from '@/auth/AuthProvider';
import { isManagerApprovalOutcomeNotification } from '@/services/activityRelevance';

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
 if(status.includes('dispatch')||status.includes('approved')||status.includes('received'))return '#168063';
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

type ActivityFilter='unread'|'read'|'all';

export default function ActivityScreen(){
 const qc=useQueryClient();
 const {role}=useAuth();
 const [filter,setFilter]=useState<ActivityFilter>('unread');
 const [search,setSearch]=useState('');
 const activity=useQuery({queryKey:['immutable-activity-feed'],queryFn:()=>getImmutableActivityFeed(120),staleTime:15_000,refetchInterval:45_000});
 const notifications=useQuery({queryKey:['notifications'],queryFn:getNotifications,staleTime:15_000,refetchInterval:45_000});
 const readState=useQuery({queryKey:['activity-read-keys'],queryFn:getActivityReadKeys,staleTime:15_000});

 const feed=useMemo(()=>{
   const combined:FeedEntry[]=[];
   const events=activity.data??[];
   const alerts=(notifications.data??[]).filter(n=>!(role==='manager'&&isManagerApprovalOutcomeNotification(n.category,n.title)));
   const readKeys=new Set(readState.data??[]);
   const alertsByEvent=new Map(alerts.filter(n=>n.event_key?.startsWith('event:')).map(n=>[n.event_key.slice(6),n]));
   const pairedIds=new Set<string>();
   for(const event of events){
     const alert=alertsByEvent.get(event.id);
     if(alert)pairedIds.add(alert.id);
     const key=`event:${event.id}`;
     combined.push({
       key,orderId:event.order_id,orderNo:event.order_no,
       title:alert?.title||titleForEvent(event.event_type),
       body:alert?.body||eventMessage(event.notes,event.old_status,event.new_status),
       timestamp:event.created_at,status:event.new_status,notificationId:alert?.id??null,
       unread:!(readKeys.has(key)||Boolean(alert?.read_at))
     });
   }
   for(const alert of alerts){
     if(pairedIds.has(alert.id))continue;
     const key=`notice:${alert.id}`;
     combined.push({
       key,orderId:alert.order_id,orderNo:'',title:alert.title,body:alert.body,
       timestamp:alert.created_at,status:null,notificationId:alert.id,
       unread:!(readKeys.has(key)||Boolean(alert.read_at))
     });
   }
   return combined.sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()).slice(0,120);
 },[activity.data,notifications.data,readState.data,role]);

 const counts=useMemo(()=>({
   unread:feed.filter(entry=>entry.unread).length,
   read:feed.filter(entry=>!entry.unread).length,
   all:feed.length,
 }),[feed]);

 const visible=useMemo(()=>{
   const needle=search.trim().toLowerCase();
   return feed.filter(entry=>{
     if(filter==='unread'&&!entry.unread)return false;
     if(filter==='read'&&entry.unread)return false;
     if(!needle)return true;
     return [entry.title,entry.orderNo,entry.body,entry.status]
       .some(value=>String(value??'').toLowerCase().includes(needle));
   });
 },[feed,filter,search]);

 async function openEntry(entry:FeedEntry){
   if(!entry.unread){
     if(entry.orderId)router.push(`/orders/${entry.orderId}`);
     return;
   }
   const readKey=['activity-read-keys'] as const;
   const notificationKey=['notifications'] as const;
   await qc.cancelQueries({queryKey:readKey});
   await qc.cancelQueries({queryKey:notificationKey});
   const previousReads=qc.getQueryData<string[]>(readKey);
   const previousNotifications=qc.getQueryData<typeof notifications.data>(notificationKey);
   // Optimistic update: the Activity counter and shared header badge move together.
   qc.setQueryData<string[]>(readKey,old=>[...new Set([...(old??[]),entry.key])]);
   if(entry.notificationId){
     qc.setQueryData<typeof notifications.data>(notificationKey,old=>old?.map(n=>
       n.id===entry.notificationId?{...n,read_at:n.read_at??new Date().toISOString()}:n));
   }
   try{
     await markActivityRead(entry.key);
     if(entry.notificationId)await markNotificationRead(entry.notificationId);
     if(entry.orderId)router.push(`/orders/${entry.orderId}`);
   }catch{
     qc.setQueryData(readKey,previousReads);
     qc.setQueryData(notificationKey,previousNotifications);
     Alert.alert('Could not mark as read','Please check your connection and try again.');
   }finally{
     void qc.invalidateQueries({queryKey:readKey});
     void qc.invalidateQueries({queryKey:notificationKey});
   }
 }

 return <Screen brandHeader title="Activity">
   <MotionView distance={14} duration={230}>
     <View style={styles.searchBox}>
       <AppIcon name="search" size={20} color="#66768A"/>
       <TextInput
         value={search}
         onChangeText={setSearch}
         placeholder="Search all activity..."
         placeholderTextColor="#8491A2"
         style={styles.searchInput}
         autoCorrect={false}
       />
     </View>
   </MotionView>

   <MotionView delay={55} distance={14} duration={230}>
     <View style={styles.segmented}>
       <FilterTab label="Unread" count={counts.unread} active={filter==='unread'} onPress={()=>setFilter('unread')}/>
       <FilterTab label="Read" count={counts.read} active={filter==='read'} onPress={()=>setFilter('read')}/>
       <FilterTab label="All" count={counts.all} active={filter==='all'} onPress={()=>setFilter('all')}/>
     </View>
   </MotionView>

   {activity.isError?<StateView icon="alert" tone="error" title="Activity could not be loaded" actionLabel="Retry" onAction={()=>void activity.refetch()}/>:null}
   {notifications.isError?<Text style={styles.notice}>Notification updates are temporarily unavailable. Permanent activity remains accessible.</Text>:null}

   {visible.map((entry,index)=>{
     const date=new Date(entry.timestamp);
     return <MotionView key={entry.key} delay={Math.min(90+index*22,260)} distance={14} duration={230} trigger={filter+'|'+search}>
       <Pressable accessibilityRole="button" accessibilityLabel={`Open ${entry.title}`} onPress={()=>void openEntry(entry)} style={({pressed})=>[styles.row,entry.unread&&styles.unread,pressed&&styles.pressed]}>
         <View style={[styles.accent,{backgroundColor:accentFor(entry.title+' '+(entry.status??''))}]}/>
         <View style={styles.copy}>
           <View style={styles.heading}>
             <Text numberOfLines={1} style={styles.title}>{entry.title}</Text>
             <View style={styles.statusTop}>
               {entry.status?<StatusChip status={entry.status} align="right"/>:null}
               <Text style={styles.date}>{date.toLocaleDateString('en-IN')} · {date.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</Text>
             </View>
           </View>
           {entry.orderNo?<Text numberOfLines={1} style={styles.orderNo}>{entry.orderNo}</Text>:null}
           <Text numberOfLines={3} style={styles.body}>{entry.body}</Text>
         </View>
       </Pressable>
     </MotionView>;
   })}

   {(activity.isLoading||readState.isLoading)&&!feed.length?<StateView icon="activity" title="Loading activity" message="Fetching operational history…"/>:null}
   {!activity.isLoading&&!readState.isLoading&&!activity.isError&&!visible.length?
     <StateView icon="activity" title={search?'No matching activity':filter==='unread'?'No unread activity':filter==='read'?'No read activity':'No activity recorded yet'} message={search?'Try a different search.':filter==='unread'?'New operational activity will appear here.':filter==='read'?'Open an activity to mark it as read.':'Order updates and alerts will appear here.'}/>:null}
 </Screen>;
}

function FilterTab({label,count,active,onPress}:{label:string;count:number;active:boolean;onPress:()=>void}){
 return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.filterTab,active&&styles.filterTabActive]}>
   <Text style={[styles.filterText,active&&styles.filterTextActive]}>{label} ({count})</Text>
 </Pressable>;
}

const styles=StyleSheet.create({
 searchBox:{minHeight:40,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,borderRadius:10,borderWidth:1,borderColor:'#D8E0E9',backgroundColor:'#fff'},
 searchInput:{flex:1,minHeight:38,color:colors.text,fontSize:12,fontWeight:'600'},
 segmented:{minHeight:36,flexDirection:'row',overflow:'hidden',borderRadius:10,borderWidth:1,borderColor:'#D8E0E9',backgroundColor:'#fff'},
 filterTab:{flex:1,alignItems:'center',justifyContent:'center',borderBottomWidth:3,borderBottomColor:'transparent'},
 filterTabActive:{backgroundColor:'#EAF3FF',borderBottomColor:'#2E69B7'},
 filterText:{color:'#6D798A',fontSize:10,fontWeight:'800'},
 filterTextActive:{color:'#173F78',fontWeight:'900'},
 row:{minHeight:70,flexDirection:'row',alignItems:'stretch',gap:8,padding:10,borderRadius:13,borderWidth:1,borderColor:'#E1E7EF',backgroundColor:'#fff'},
 unread:{backgroundColor:'#EFF6FF',borderColor:'#AACDF4'},pressed:{opacity:.82},
 accent:{width:4,alignSelf:'stretch',borderRadius:3},copy:{flex:1,minWidth:0,gap:4},
 heading:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:7},
 statusTop:{alignSelf:'flex-start',maxWidth:'62%',alignItems:'flex-end',marginLeft:'auto',gap:4},
 title:{color:colors.navy,fontSize:11,fontWeight:'900',flex:1},
 orderNo:{color:colors.text,fontSize:10,fontWeight:'900'},
 body:{color:colors.textMuted,fontSize:10,lineHeight:14},
 date:{color:'#718095',fontSize:8,fontWeight:'700',textAlign:'right'},
 notice:{fontSize:10,color:'#956B2B',backgroundColor:'#FFF7E9',borderRadius:8,padding:9}
});
