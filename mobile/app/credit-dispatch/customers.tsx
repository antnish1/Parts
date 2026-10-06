import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { formatCreditMoney } from '@/services/creditDispatch';
import { getCreditCustomerAging, getCreditCustomerOutstanding, type CreditCustomerAging } from '@/services/creditCustomers';
import { colors, radius, spacing } from '@/theme/tokens';

type Mode='outstanding'|'aging';
type OutstandingFilter='Outstanding'|'Overdue'|'All';
type AgingFilter='Overdue'|'30+'|'All';

function reminder(row:CreditCustomerAging){
  const amount=row.overdue>0?row.overdue:row.outstanding;
  return `Dear ${row.customer_name}, this is a reminder that ${formatCreditMoney(amount)} is pending against your Frontier credit account. Please arrange payment at the earliest. Thank you.`;
}

export default function CreditCustomersScreen(){
 const [mode,setMode]=useState<Mode>('outstanding');
 const [search,setSearch]=useState('');
 const [outstandingFilter,setOutstandingFilter]=useState<OutstandingFilter>('Outstanding');
 const [agingFilter,setAgingFilter]=useState<AgingFilter>('Overdue');
 const outstanding=useQuery({queryKey:['credit-customers-outstanding'],queryFn:getCreditCustomerOutstanding});
 const aging=useQuery({queryKey:['credit-customers-aging'],queryFn:getCreditCustomerAging});
 const needle=search.trim().toLowerCase();
 const outstandingRows=useMemo(()=>(outstanding.data??[]).filter((r)=>{
   if(outstandingFilter==='Overdue'&&Number(r.overdue||0)<=0)return false;
   if(outstandingFilter==='Outstanding'&&Number(r.outstanding||0)<=0)return false;
   return !needle||[r.customer_name,r.mobile_no,r.default_branch,r.customer_type,r.risk_category].some(v=>String(v??'').toLowerCase().includes(needle));
 }),[outstanding.data,needle,outstandingFilter]);
 const agingRows=useMemo(()=>(aging.data??[]).filter((r)=>{
   if(agingFilter==='Overdue'&&Number(r.overdue||0)<=0)return false;
   if(agingFilter==='30+'&&Number(r.bucket_30_plus||0)<=0)return false;
   return !needle||[r.customer_name,r.mobile_no,r.default_branch,r.customer_type,r.risk_category].some(v=>String(v??'').toLowerCase().includes(needle));
 }),[aging.data,needle,agingFilter]);
 const activeRows=mode==='outstanding'?outstandingRows:agingRows;
 const summary=useMemo(()=>({customers:activeRows.length,outstanding:activeRows.reduce((s,r)=>s+Number(r.outstanding||0),0),overdue:activeRows.reduce((s,r)=>s+Number(r.overdue||0),0)}),[activeRows]);
 const query=mode==='outstanding'?outstanding:aging;
 return <Screen title="Credit Customers" subtitle="Outstanding, aging and customer ledger">
   <Pressable onPress={()=>router.back()} style={styles.backRow}><Text style={styles.back}>‹ Back</Text></Pressable>
   <View style={styles.metrics}><Metric label="Customers" value={String(summary.customers)}/><Metric label="Outstanding" value={formatCreditMoney(summary.outstanding)}/><Metric label="Overdue" value={formatCreditMoney(summary.overdue)}/></View>
   <View style={styles.segment}><Pressable onPress={()=>setMode('outstanding')} style={[styles.segmentButton,mode==='outstanding'&&styles.segmentActive]}><Text style={[styles.segmentText,mode==='outstanding'&&styles.segmentTextActive]}>Outstanding</Text></Pressable><Pressable onPress={()=>setMode('aging')} style={[styles.segmentButton,mode==='aging'&&styles.segmentActive]}><Text style={[styles.segmentText,mode==='aging'&&styles.segmentTextActive]}>Aging</Text></Pressable></View>
   <View style={styles.search}><AppIcon name="search" size={18} color={colors.textMuted}/><TextInput value={search} onChangeText={setSearch} placeholder="Customer, mobile, branch or risk" placeholderTextColor={colors.textMuted} style={styles.searchInput}/></View>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
    {(mode==='outstanding'?(['Outstanding','Overdue','All'] as OutstandingFilter[]):(['Overdue','30+','All'] as AgingFilter[])).map((item)=>{
      const active=mode==='outstanding'?outstandingFilter===item:agingFilter===item;
      return <Pressable key={item} onPress={()=>mode==='outstanding'?setOutstandingFilter(item as OutstandingFilter):setAgingFilter(item as AgingFilter)} style={[styles.filter,active&&styles.filterActive]}><Text style={[styles.filterText,active&&styles.filterTextActive]}>{item}</Text></Pressable>
    })}
   </ScrollView>
   {query.isError?<StateView icon="alert" tone="error" title="Customer credit data could not be loaded" message="Check your connection and retry." actionLabel="Retry" onAction={()=>void query.refetch()}/>:null}
   {!query.isLoading&&!query.isError&&mode==='outstanding'?outstandingRows.map((row)=><Pressable key={row.customer_id} onPress={()=>router.push(`/credit-dispatch/customer/${row.customer_id}`)} style={({pressed})=>[styles.card,pressed&&styles.pressed]}><View style={styles.top}><View style={styles.copy}><Text style={styles.name}>{row.customer_name}</Text><Text style={styles.meta}>{row.mobile_no} • {row.default_branch||'—'} • {row.customer_type}</Text></View><Risk risk={row.risk_category}/></View><View style={styles.grid}><Mini label="Credit" value={formatCreditMoney(row.total_credit)}/><Mini label="Received" value={formatCreditMoney(row.total_received)}/><Mini label="Outstanding" value={formatCreditMoney(row.outstanding)}/><Mini label="Overdue" value={formatCreditMoney(row.overdue)}/></View><View style={styles.openRow}><Text style={styles.openText}>Open customer ledger</Text><AppIcon name="chevronRight" size={17} color={colors.blue}/></View></Pressable>):null}
   {!query.isLoading&&!query.isError&&mode==='aging'?agingRows.map((row)=><View key={row.customer_id} style={styles.card}><Pressable onPress={()=>router.push(`/credit-dispatch/customer/${row.customer_id}`)}><View style={styles.top}><View style={styles.copy}><Text style={styles.name}>{row.customer_name}</Text><Text style={styles.meta}>{row.mobile_no} • {row.default_branch||'—'} • {row.customer_type}</Text></View><Risk risk={row.risk_category}/></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aging}><Age label="0–7" value={row.bucket_0_7}/><Age label="8–15" value={row.bucket_8_15}/><Age label="16–30" value={row.bucket_16_30}/><Age label="30+" value={row.bucket_30_plus}/><Age label="Overdue" value={row.overdue}/></ScrollView></Pressable><View style={styles.actionRow}><Pressable onPress={()=>router.push(`/credit-dispatch/customer/${row.customer_id}`)} style={styles.outlineAction}><AppIcon name="package" size={15} color={colors.navy}/><Text style={styles.outlineText}>Ledger</Text></Pressable><Pressable onPress={()=>void Share.share({message:reminder(row)})} style={styles.reminderAction}><AppIcon name="alert" size={15} color={colors.blue}/><Text style={styles.reminderText}>Share Reminder</Text></Pressable></View></View>):null}
   {!query.isLoading&&!query.isError&&!activeRows.length?<StateView icon="inbox" title={search?'No matching customers':'No customer credit records'} message={search?'Try another customer, mobile, branch or risk filter.':'There are no records in the selected credit view.'}/>:null}
 </Screen>
}
function Metric({label,value}:{label:string;value:string}){return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text numberOfLines={1} style={styles.metricValue}>{value}</Text></View>}
function Risk({risk}:{risk:string}){const tone=risk==='Red'?{bg:colors.dangerSoft,fg:colors.danger}:risk==='Amber'?{bg:colors.warningSoft,fg:colors.warning}:{bg:colors.successSoft,fg:colors.success};return <View style={[styles.risk,{backgroundColor:tone.bg}]}><Text style={[styles.riskText,{color:tone.fg}]}>{risk}</Text></View>}
function Mini({label,value}:{label:string;value:string}){return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text numberOfLines={1} style={styles.miniValue}>{value}</Text></View>}
function Age({label,value}:{label:string;value:number}){return <View style={styles.age}><Text style={styles.ageLabel}>{label}</Text><Text style={[styles.ageValue,label==='30+'&&value>0&&{color:colors.danger}]}>{formatCreditMoney(value)}</Text></View>}
const styles=StyleSheet.create({backRow:{alignSelf:'flex-start',minHeight:36,justifyContent:'center'},back:{color:colors.blue,fontSize:13,fontWeight:'900'},metrics:{flexDirection:'row',gap:spacing.sm},metric:{flex:1,padding:spacing.md,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},metricLabel:{color:colors.textMuted,fontSize:9,fontWeight:'700'},metricValue:{color:colors.text,fontSize:14,fontWeight:'900',marginTop:2},segment:{flexDirection:'row',gap:4,padding:4,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},segmentButton:{flex:1,minHeight:40,alignItems:'center',justifyContent:'center',borderRadius:radius.sm},segmentActive:{backgroundColor:colors.navy},segmentText:{color:colors.textMuted,fontSize:11,fontWeight:'900'},segmentTextActive:{color:'#fff'},search:{minHeight:48,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:spacing.md},searchInput:{flex:1,minHeight:46,color:colors.text,fontSize:13},filters:{gap:spacing.sm,paddingRight:spacing.md},filter:{minHeight:38,justifyContent:'center',paddingHorizontal:14,borderRadius:999,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},filterActive:{backgroundColor:colors.navy,borderColor:colors.navy},filterText:{color:colors.textMuted,fontSize:10,fontWeight:'900'},filterTextActive:{color:'#fff'},card:{padding:spacing.md,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,gap:spacing.md},pressed:{opacity:.8},top:{flexDirection:'row',justifyContent:'space-between',gap:spacing.sm},copy:{flex:1},name:{color:colors.text,fontSize:13,fontWeight:'900'},meta:{color:colors.textMuted,fontSize:10,marginTop:2},risk:{paddingHorizontal:8,paddingVertical:5,borderRadius:radius.sm},riskText:{fontSize:9,fontWeight:'900'},grid:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},mini:{width:'47%'},miniLabel:{color:colors.textMuted,fontSize:9,fontWeight:'700'},miniValue:{color:colors.text,fontSize:11,fontWeight:'900',marginTop:2},aging:{gap:spacing.sm},age:{minWidth:92,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},ageLabel:{color:colors.textMuted,fontSize:9,fontWeight:'700'},ageValue:{color:colors.text,fontSize:11,fontWeight:'900',marginTop:2},openRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:spacing.sm,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border},openText:{color:colors.blue,fontSize:10,fontWeight:'900'},actionRow:{flexDirection:'row',gap:spacing.sm},outlineAction:{flex:1,minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderRadius:radius.md,borderWidth:1,borderColor:colors.border},outlineText:{color:colors.navy,fontSize:10,fontWeight:'900'},reminderAction:{flex:1,minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderRadius:radius.md,backgroundColor:colors.blueSoft},reminderText:{color:colors.blue,fontSize:10,fontWeight:'900'}});
