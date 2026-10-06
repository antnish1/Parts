import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { formatDate } from '@/services/orders';
import { getDelayedVorOrders } from '@/services/operations';
import { colors, spacing } from '@/theme/tokens';

type Bucket='today'|'1-2'|'3-5'|'5+';

export default function DelayedVorScreen(){
 const {role}=useAuth();
 const allowed=role!=='accounts';
 const [bucket,setBucket]=useState<Bucket>('today');
 const [search,setSearch]=useState('');
 const query=useQuery({queryKey:['delayed-vor-orders'],queryFn:getDelayedVorOrders,enabled:allowed,staleTime:30_000});
 const rows=query.data??[];

 const counts=useMemo(()=>({
   today:rows.filter(r=>r.age_days===0).length,
   '1-2':rows.filter(r=>r.age_days>=1&&r.age_days<=2).length,
   '3-5':rows.filter(r=>r.age_days>=3&&r.age_days<=5).length,
   '5+':rows.filter(r=>r.age_days>5).length,
 }),[rows]);

 const visible=useMemo(()=>{
   const n=search.trim().toLowerCase();
   return rows
    .filter(r=>bucket==='today'?r.age_days===0:bucket==='1-2'?r.age_days>=1&&r.age_days<=2:bucket==='3-5'?r.age_days>=3&&r.age_days<=5:r.age_days>5)
    .filter(r=>!n||[r.order_no,r.final_order_no,r.branch,r.customer_name,r.machine_no].some(v=>String(v??'').toLowerCase().includes(n)));
 },[rows,bucket,search]);

 if(!allowed)return <View style={styles.center}><StateView icon="alert" tone="error" title="Delayed VOR unavailable" message="This workflow is not available for Accounts."/></View>;

 return <Screen title="Delayed VOR" subtitle="VOR exceptions grouped by processing age" scroll={false}>
   <FlatList
    data={visible}
    keyExtractor={i=>i.id}
    refreshing={query.isRefetching}
    onRefresh={()=>void query.refetch()}
    contentContainerStyle={styles.list}
    ListHeaderComponent={
      <View style={styles.header}>
        <View style={styles.alertCard}>
          <View style={styles.alertIcon}><AppIcon name="clock" size={20} color="#B83B3B"/></View>
          <View style={styles.alertCopy}>
            <Text style={styles.alertTitle}>VOR ageing monitor</Text>
            <Text style={styles.alertText}>Prioritise older processed or partially dispatched VOR orders before they become customer escalations.</Text>
          </View>
          <Text style={styles.alertTotal}>{rows.length}</Text>
        </View>

        <View style={styles.summary}>
          <BucketCard label="Today" value={counts.today} active={bucket==='today'} onPress={()=>setBucket('today')}/>
          <BucketCard label="1–2d" value={counts['1-2']} active={bucket==='1-2'} onPress={()=>setBucket('1-2')}/>
          <BucketCard label="3–5d" value={counts['3-5']} active={bucket==='3-5'} warning onPress={()=>setBucket('3-5')}/>
          <BucketCard label="5+d" value={counts['5+']} active={bucket==='5+'} danger onPress={()=>setBucket('5+')}/>
        </View>

        <View style={styles.search}>
          <AppIcon name="search" size={18} color={colors.textMuted}/>
          <TextInput value={search} onChangeText={setSearch} placeholder="Order, branch, customer or machine…" placeholderTextColor={colors.textMuted} style={styles.searchInput}/>
        </View>

        <View style={styles.resultBar}>
          <Text style={styles.resultCount}>{visible.length} in selected age bucket</Text>
          <Text style={styles.resultHint}>Pull to refresh</Text>
        </View>
      </View>
    }
    renderItem={({item})=>
      <Pressable onPress={()=>router.push(`/orders/${item.id}`)} style={({pressed})=>[styles.card,pressed&&styles.pressed]}>
        <View style={styles.top}>
          <View style={styles.orderIcon}><AppIcon name="clock" size={18} color={item.age_days>5?colors.danger:item.age_days>=3?colors.warning:colors.navy}/></View>
          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.no}>{item.final_order_no||item.order_no}</Text>
            <Text numberOfLines={1} style={styles.customer}>{item.customer_name||'Customer'} · {item.branch}</Text>
          </View>
          <View style={[styles.age,item.age_days>5&&styles.ageDanger,item.age_days>=3&&item.age_days<=5&&styles.ageWarn]}>
            <Text style={[styles.ageText,item.age_days>5&&styles.ageDangerText]}>{item.age_days===0?'Today':`${item.age_days}d`}</Text>
          </View>
        </View>

        <View style={styles.contextRow}>
          <View style={styles.context}><AppIcon name="package" size={13} color="#708096"/><Text style={styles.contextText}>{item.machine_no||'No machine'}</Text></View>
          <View style={styles.context}><AppIcon name="clock" size={13} color="#708096"/><Text style={styles.contextText}>Processed {formatDate(item.processed_date)}</Text></View>
        </View>

        <View style={styles.bottom}>
          <StatusChip status={item.status}/>
          <View style={styles.open}><Text style={styles.openText}>Open order</Text><AppIcon name="chevronRight" size={16} color={colors.blue}/></View>
        </View>
      </Pressable>
    }
    ListEmptyComponent={!query.isLoading?(query.isError
      ?<StateView icon="alert" tone="error" title="Delayed VOR could not be loaded" message="Check your connection and try again." actionLabel="Retry" onAction={()=>void query.refetch()}/>
      :<StateView icon="clock" title="No delayed VOR orders" message="There are no VOR orders in this ageing bucket."/>
    ):null}
   />
 </Screen>;
}

function BucketCard({label,value,active,warning=false,danger=false,onPress}:{label:string;value:number;active:boolean;warning?:boolean;danger?:boolean;onPress:()=>void}){
 const accent=danger?colors.danger:warning?colors.warning:colors.navy;
 return <Pressable onPress={onPress} style={[styles.bucket,active&&{backgroundColor:accent,borderColor:accent}]}><Text style={[styles.bucketValue,active&&styles.bucketValueActive]}>{value}</Text><Text style={[styles.bucketLabel,active&&styles.bucketLabelActive]}>{label}</Text></Pressable>;
}

const styles=StyleSheet.create({
 center:{flex:1,justifyContent:'center',padding:spacing.xl,backgroundColor:colors.background},
 list:{gap:spacing.sm,paddingBottom:spacing.xxl},
 header:{gap:spacing.md,marginBottom:spacing.md},
 alertCard:{minHeight:88,flexDirection:'row',alignItems:'center',gap:spacing.md,padding:spacing.md,borderRadius:20,backgroundColor:'#FFF1F1',borderWidth:1,borderColor:'#F5D4D4'},
 alertIcon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},
 alertCopy:{flex:1},
 alertTitle:{color:'#8C2F2F',fontSize:12,fontWeight:'900'},
 alertText:{color:'#865D5D',fontSize:9,lineHeight:14,marginTop:3},
 alertTotal:{color:'#8C2F2F',fontSize:22,fontWeight:'900'},
 summary:{flexDirection:'row',gap:5,padding:4,borderRadius:18,backgroundColor:'#EAEFF5'},
 bucket:{flex:1,minHeight:58,alignItems:'center',justifyContent:'center',borderRadius:14,borderWidth:1,borderColor:'transparent'},
 bucketValue:{color:colors.text,fontSize:16,fontWeight:'900'},
 bucketValueActive:{color:'#fff'},
 bucketLabel:{color:colors.textMuted,fontSize:8,fontWeight:'900',marginTop:2},
 bucketLabelActive:{color:'#EAF0F7'},
 search:{minHeight:50,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderWidth:1,borderColor:'#DFE6EE',borderRadius:16,paddingHorizontal:spacing.md,backgroundColor:'#fff'},
 searchInput:{flex:1,minHeight:48,color:colors.text,fontSize:13,fontWeight:'700'},
 resultBar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 resultCount:{color:colors.text,fontSize:10,fontWeight:'900'},
 resultHint:{color:colors.textMuted,fontSize:8,fontWeight:'700'},
 card:{gap:spacing.sm,padding:spacing.md,borderWidth:1,borderColor:'#E1E7EE',borderRadius:20,backgroundColor:colors.surface},
 pressed:{opacity:.8},
 top:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},
 orderIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#F0F4F8'},
 copy:{flex:1},
 no:{color:colors.text,fontSize:12,fontWeight:'900'},
 customer:{color:colors.textMuted,fontSize:9,marginTop:3,fontWeight:'700'},
 age:{paddingHorizontal:9,paddingVertical:6,borderRadius:999,backgroundColor:colors.blueSoft},
 ageWarn:{backgroundColor:colors.warningSoft},
 ageDanger:{backgroundColor:colors.dangerSoft},
 ageText:{color:colors.navy,fontSize:9,fontWeight:'900'},
 ageDangerText:{color:colors.danger},
 contextRow:{flexDirection:'row',gap:spacing.md},
 context:{flex:1,flexDirection:'row',alignItems:'center',gap:5},
 contextText:{flex:1,color:colors.textMuted,fontSize:8,fontWeight:'700'},
 bottom:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:spacing.sm,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#E8EDF3'},
 open:{flexDirection:'row',alignItems:'center',gap:3},
 openText:{color:colors.blue,fontSize:9,fontWeight:'900'},
});
