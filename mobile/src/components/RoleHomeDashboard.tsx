import { useMemo } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { roleWorkActions, type WorkAction } from '@/auth/roleNavigation';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { MetricsTicker, type TickerMetric } from '@/components/MetricsTicker';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { BreathingView } from '@/components/BreathingView';
import { getVisibleOrders, formatDate } from '@/services/orders';
import { colors } from '@/theme/tokens';

const ICONS: Record<string, AppIconName> = {
  'new-order':'package','track-orders':'search','approval-queue':'check','admin-queue':'check',
  'pending-issue':'inbox','delayed-vor':'clock','part-location':'search',
  'credit':'wallet','tada':'work','reports':'chart','manager-dashboard':'inventory',
  'uploads':'inbox','developer':'work','installations':'work','docket':'search'
};
const CLOSED=new Set(['received','issued','rejected']);
function iconFor(action:WorkAction):AppIconName{return ICONS[action.key]||'work';}
function go(href:string){router.push(href as Parameters<typeof router.push>[0]);}

export function RoleHomeDashboard(){
 const {profile,role}=useAuth();
 // Render only permitted shortcuts; never fetch an order list for Accounts users.
 const allowed=role?roleWorkActions[role].filter(action=>Boolean(action.href)):[];
 const canTrack=allowed.some(action=>action.key==='track-orders');
 const orders=useQuery({queryKey:['home','role-orders',profile?.id],queryFn:()=>getVisibleOrders(120),enabled:canTrack,staleTime:30_000});
 const rows=orders.data??[];
 const active=useMemo(()=>rows.filter(order=>!CLOSED.has(String(order.status??'').toLowerCase())).length,[rows]);
 const greeting=profile?.fullName?.split(' ')[0]||'there';
 const day=new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short'}).format(new Date());
 const ticker:TickerMetric[]=[];
 if(canTrack){
   ticker.push({key:'visible',icon:'package',label:'Visible orders',value:orders.isLoading?'—':rows.length,tone:'blue',onPress:()=>go('/orders')});
   ticker.push({key:'open',icon:'clock',label:'Open workflow',value:orders.isLoading?'—':active,tone:'amber',onPress:()=>go('/orders')});
 }
 // A count of authorized tools, not a count derived from any privileged dataset.
 ticker.push({key:'tools',icon:'work',label:'My tools',value:allowed.length,tone:'green',onPress:()=>go('/(tabs)/work')});
 const featured=allowed.find(action=>action.key==='track-orders')||allowed[0];
 const grid=allowed.filter(action=>action.key!==featured?.key).slice(0,6);
 return <Screen brandHeader contentContainerStyle={styles.screen}>
   <View style={styles.greetingRow}>
     <View style={styles.greetingCopy}>
       <Text style={styles.greetingName}>Good morning, {greeting}</Text>
       <Text style={styles.greetingMeta}>{profile?.branch||'Unassigned'} · {role||'User'} · {day}</Text>
     </View>
     {canTrack?<BreathingView minScale={0.965} maxScale={1.015}><View style={styles.activePill}><Text style={styles.activeCount}>{orders.isLoading?'—':active}</Text><Text style={styles.activeLabel}> active</Text></View></BreathingView>:null}
   </View>
   <MetricsTicker loading={canTrack&&orders.isLoading} items={ticker}/>
   {featured?<Pressable accessibilityRole="button" onPress={()=>go(featured.href!)} style={({pressed})=>[styles.primaryTrack,pressed&&styles.pressed]}>
      <View style={styles.trackIcon}><AppIcon name={iconFor(featured)} size={21} color="#fff"/></View>
      <View style={styles.trackCopy}><Text style={styles.trackTitle}>{featured.label}</Text><Text style={styles.trackCaption}>{featured.description}</Text></View>
      <AppIcon name="chevronRight" size={18} color="#C5D9ED"/>
   </Pressable>:null}
   <View style={styles.sectionHead}><Text style={styles.sectionTitle}>My work</Text><Pressable onPress={()=>go('/(tabs)/work')}><Text style={styles.sectionLink}>All tools</Text></Pressable></View>
   <View style={styles.workGrid}>
     {grid.map(action=><Pressable key={action.key} accessibilityRole="button" onPress={()=>go(action.href!)} style={({pressed})=>[styles.workCell,pressed&&styles.pressed]}>
       <View style={styles.workIcon}><AppIcon name={iconFor(action)} size={18} color="#fff" strokeWidth={2.7}/></View>
       <Text numberOfLines={1} style={styles.workTitle}>{action.label}</Text>
       <AppIcon name="chevronRight" size={14} color="#9BA7B5"/>
     </Pressable>)}
   </View>
   <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Needs attention</Text>{canTrack?<Pressable onPress={()=>go('/orders')}><Text style={styles.sectionLink}>View orders</Text></Pressable>:null}</View>
   <View style={styles.attentionList}>
     {canTrack ? <>
       {orders.isError?<StateView icon="alert" tone="error" title="Orders unavailable" actionLabel="Retry" onAction={()=>void orders.refetch()}/>:null}
       {(orders.data??[]).slice(0,6).map((order,index,array)=><Pressable key={order.id} onPress={()=>go(`/orders/${order.id}`)} style={({pressed})=>[styles.attentionRow,index===array.length-1&&styles.lastRow,pressed&&styles.pressed]}>
         <View style={styles.rowAccent}/>
         <View style={styles.rowCopy}>
           <View style={styles.rowTop}><Text numberOfLines={1} style={styles.rowTitle}>{order.final_order_no||order.order_no}</Text><Text style={styles.rowMeta}>{formatDate(order.created_at)}</Text></View>
           <View style={styles.rowBottom}><Text numberOfLines={1} style={styles.rowSubtitle}>{order.customer_name||order.machine_no||order.branch||'Order'}</Text><StatusChip status={order.approval_status||order.status||'Open'}/></View>
         </View>
       </Pressable>)}
       {!orders.isLoading&&!orders.isError&&!rows.length?<StateView icon="check" title="Nothing urgent right now"/>:null}
       {orders.isLoading?<Text style={styles.loading}>Loading visible orders…</Text>:null}
     </>:<Text style={styles.loading}>Use My work to open your authorized workflows.</Text>}
   </View>
 </Screen>;
}
const styles=StyleSheet.create({
 screen:{paddingTop:0,paddingBottom:12,gap:8},
 greetingRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:47,gap:8},
 greetingCopy:{flex:1},greetingName:{fontSize:17,color:'#10233E',fontWeight:'900'},
 greetingMeta:{marginTop:2,color:'#667085',fontSize:9,fontWeight:'700'},
 activePill:{flexDirection:'row',alignItems:'baseline',paddingHorizontal:10,paddingVertical:6,borderRadius:999,backgroundColor:'#EAF7F1',borderWidth:1,borderColor:'#CEEBDC'},
 activeCount:{color:'#16724F',fontSize:12,fontWeight:'900'},activeLabel:{color:'#2F7D60',fontSize:8,fontWeight:'800'},
 primaryTrack:{flexDirection:'row',alignItems:'center',backgroundColor:colors.navy,padding:10,borderRadius:14,gap:9},
 trackIcon:{backgroundColor:'#2A527E',borderRadius:10,width:38,height:38,alignItems:'center',justifyContent:'center'},
 trackCopy:{flex:1},trackTitle:{color:'#FFFFFF',fontSize:15,fontWeight:'900'},trackCaption:{color:'#CCDAEC',fontSize:10,marginTop:3},
 sectionHead:{minHeight:26,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:2},
 sectionTitle:{color:colors.text,fontSize:13,fontWeight:'900'},sectionLink:{color:colors.blue,fontSize:9,fontWeight:'900'},
 workGrid:{flexDirection:'row',flexWrap:'wrap',gap:7},
 workCell:{width:'49%',minHeight:44,flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:9,borderRadius:12,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
 workIcon:{width:30,height:30,borderRadius:9,backgroundColor:'#225AB0',alignItems:'center',justifyContent:'center'},
 workTitle:{flex:1,color:colors.text,fontSize:9,fontWeight:'900'},
 attentionList:{overflow:'hidden',borderRadius:12,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
 attentionRow:{minHeight:53,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:9,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E7ECF2'},
 lastRow:{borderBottomWidth:0},rowAccent:{width:3,height:32,borderRadius:999,backgroundColor:colors.blue},
 rowCopy:{flex:1},rowTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
 rowTitle:{flex:1,color:colors.text,fontSize:10,fontWeight:'900'},rowMeta:{color:colors.textMuted,fontSize:7.5,fontWeight:'700'},
 rowBottom:{minHeight:24,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
 rowSubtitle:{flex:1,color:colors.textMuted,fontSize:8.5,fontWeight:'700'},loading:{padding:15,color:colors.textMuted,fontSize:11},
 pressed:{opacity:.78}
});
