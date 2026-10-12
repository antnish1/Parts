import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { formatMoney } from '@/services/orders';
import { getPendingIssueOrders, getPendingIssueParts, markOrderIssued, type PendingIssueOrder } from '@/services/operations';
import { colors, spacing } from '@/theme/tokens';

type AgeFilter='all'|'0-2'|'3-7'|'over-7';
const DOC_TYPES=['DC','Tax Invoice','PI','Manual','Warranty Claim'];

export default function PendingIssueScreen(){
 const {role}=useAuth();
 const allowed=['branch','admin','manager','developer','hq'].includes(role??'');
 const qc=useQueryClient();
 const query=useQuery({queryKey:['pending-issue-orders'],queryFn:getPendingIssueOrders,enabled:allowed,staleTime:30_000});

 const [age,setAge]=useState<AgeFilter>('all');
 const [type,setType]=useState('all');
 const [search,setSearch]=useState('');
 const [selected,setSelected]=useState<PendingIssueOrder|null>(null);
 const [docType,setDocType]=useState('DC');
 const [docNo,setDocNo]=useState('');
 const [message,setMessage]=useState('');

 const rows=query.data??[];
 const counts=useMemo(()=>({
   all:rows.length,
   '0-2':rows.filter(r=>r.age_days<=2).length,
   '3-7':rows.filter(r=>r.age_days>=3&&r.age_days<=7).length,
   'over-7':rows.filter(r=>r.age_days>7).length,
   vor:rows.filter(r=>r.order_type.toUpperCase()==='VOR').length,
   sop:rows.filter(r=>r.order_type.toUpperCase()==='SOP').length,
 }),[rows]);

 const visible=useMemo(()=>{
   const n=search.trim().toLowerCase();
   return rows
    .filter(r=>age==='all'||(age==='0-2'&&r.age_days<=2)||(age==='3-7'&&r.age_days>=3&&r.age_days<=7)||(age==='over-7'&&r.age_days>7))
    .filter(r=>type==='all'||r.order_type.toLowerCase()===type)
    .filter(r=>!n||[r.order_no,r.final_order_no,r.branch,r.customer_name,r.contact_no,r.machine_no,r.call_id].some(v=>String(v??'').toLowerCase().includes(n)));
 },[rows,age,type,search]);

 const parts=useQuery({queryKey:['pending-issue-parts',selected?.id],queryFn:()=>getPendingIssueParts(selected!.id),enabled:Boolean(selected)});
 const issue=useMutation({
   mutationFn:()=>markOrderIssued(selected!.id,docType,docNo),
   onSuccess:async()=>{
     setMessage(`${selected?.order_no} marked as Issued.`);
     setSelected(null);
     setDocNo('');
     await query.refetch();
     await qc.invalidateQueries({queryKey:['orders']});
   },
   onError:e=>setMessage(e instanceof Error?e.message:'Could not mark order as issued.'),
 });

 if(!allowed)return <View style={styles.center}><StateView icon="alert" tone="error" title="Pending Issue unavailable" message="This workflow is not available for your role."/></View>;

 return <Screen title="Pending Issue" subtitle="Fully received customer orders waiting for final issue" scroll={false}>
   <FlatList
    data={visible}
    keyExtractor={i=>i.id}
    refreshing={query.isRefetching}
    onRefresh={()=>void query.refetch()}
    contentContainerStyle={styles.list}
    ListHeaderComponent={
      <View style={styles.header}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><AppIcon name="inbox" size={21} color="#A95D10"/></View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Ready to issue</Text>
            <Text style={styles.heroText}>These customer orders are fully received. Complete final issue with the correct document reference.</Text>
          </View>
          <Text style={styles.heroTotal}>{rows.length}</Text>
        </View>

        <View style={styles.summary}>
          <Filter label="All" value={counts.all} active={age==='all'&&type==='all'} onPress={()=>{setAge('all');setType('all')}}/>
          <Filter label="0–2d" value={counts['0-2']} active={age==='0-2'} onPress={()=>setAge(age==='0-2'?'all':'0-2')}/>
          <Filter label="3–7d" value={counts['3-7']} active={age==='3-7'} warning onPress={()=>setAge(age==='3-7'?'all':'3-7')}/>
          <Filter label="7+d" value={counts['over-7']} active={age==='over-7'} danger onPress={()=>setAge(age==='over-7'?'all':'over-7')}/>
        </View>

        <View style={styles.typeRow}>
          <Pressable onPress={()=>setType('all')} style={[styles.typeChip,type==='all'&&styles.typeChipActive]}><Text style={[styles.typeText,type==='all'&&styles.typeTextActive]}>All types</Text></Pressable>
          <Pressable onPress={()=>setType(type==='vor'?'all':'vor')} style={[styles.typeChip,type==='vor'&&styles.typeChipActive]}><Text style={[styles.typeText,type==='vor'&&styles.typeTextActive]}>VOR {counts.vor}</Text></Pressable>
          <Pressable onPress={()=>setType(type==='sop'?'all':'sop')} style={[styles.typeChip,type==='sop'&&styles.typeChipActive]}><Text style={[styles.typeText,type==='sop'&&styles.typeTextActive]}>SOP {counts.sop}</Text></Pressable>
        </View>

        <View style={styles.search}>
          <AppIcon name="search" size={18} color={colors.textMuted}/>
          <TextInput value={search} onChangeText={setSearch} placeholder="Order, customer, mobile, machine, call ID…" placeholderTextColor={colors.textMuted} style={styles.searchInput}/>
        </View>
        {message?<View style={styles.message}><AppIcon name="check" size={15} color={colors.success}/><Text style={styles.messageText}>{message}</Text></View>:null}
      </View>
    }
    renderItem={({item})=>
      <Pressable onPress={()=>setSelected(item)} style={({pressed})=>[styles.card,pressed&&styles.pressed]}>
        <View style={styles.top}>
          <View style={styles.orderIcon}><AppIcon name="inbox" size={18} color={item.age_days>7?colors.danger:colors.warning}/></View>
          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.no}>{item.final_order_no||item.order_no}</Text>
            <Text numberOfLines={1} style={styles.customer}>{item.customer_name||'Customer'} · {item.branch}</Text>
          </View>
          <View style={[styles.age,item.age_days>7&&styles.ageDanger]}><Text style={[styles.ageText,item.age_days>7&&styles.ageDangerText]}>{item.age_days===0?'Today':`${item.age_days}d`}</Text></View>
        </View>

        <View style={styles.valueStrip}>
          <Mini label="Type" value={item.order_type}/>
          <Divider/>
          <Mini label="Qty" value={String(item.total_qty)}/>
          <Divider/>
          <Mini label="Value" value={formatMoney(item.total_value)}/>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.received}>Received {item.received_date?new Date(item.received_date).toLocaleDateString('en-IN'):'—'}</Text>
          <View style={styles.open}><Text style={styles.openText}>Issue order</Text><AppIcon name="chevronRight" size={16} color={colors.blue}/></View>
        </View>
      </Pressable>
    }
    ListEmptyComponent={!query.isLoading?(query.isError
      ?<StateView icon="alert" tone="error" title="Pending Issue could not be loaded" message="The data request failed. Check your connection and retry." actionLabel="Retry" onAction={()=>void query.refetch()}/>
      :<StateView icon="inbox" title="Nothing pending here" message="No received customer orders match the selected filters."/>
    ):null}
   />

   <Modal visible={Boolean(selected)} animationType="slide" onRequestClose={()=>setSelected(null)}>
     <Screen title={selected?.final_order_no||selected?.order_no||'Issue Order'} subtitle="Review received parts and complete final issue.">
       <Pressable onPress={()=>setSelected(null)} style={styles.back}><Text style={styles.backText}>‹ Back to Pending Issue</Text></Pressable>

       {selected?<View style={styles.issueHero}>
         <View style={styles.issueHeroIcon}><AppIcon name="check" size={20} color={colors.success}/></View>
         <View style={styles.issueHeroCopy}>
           <Text style={styles.issueHeroTitle}>{selected.customer_name||'Customer order'}</Text>
           <Text style={styles.issueHeroText}>{selected.branch} · {selected.order_type} · Qty {selected.total_qty}</Text>
         </View>
         <StatusChip status="Received"/>
       </View>:null}

       {parts.isLoading?<View style={styles.loading}><ActivityIndicator color={colors.navy}/><Text style={styles.loadingText}>Loading received parts…</Text></View>:null}
       {parts.isError?<StateView icon="alert" tone="error" title="Parts could not be loaded" actionLabel="Retry" onAction={()=>void parts.refetch()}/>:null}

       {parts.data?.map(part=>
         <View key={part.id} style={styles.part}>
           <View style={styles.partTop}><View style={styles.partIcon}><AppIcon name="package" size={16} color={colors.navy}/></View><View style={styles.partCopy}><Text style={styles.partNo}>{part.part_no}</Text><Text numberOfLines={2} style={styles.partDesc}>{part.description||'No description'}</Text></View><StatusChip status={part.item_status}/></View>
           <View style={styles.partGrid}><Mini label="Required" value={String(part.effective_qty)}/><Mini label="Billed" value={String(part.billed_qty)}/><Mini label="Received" value={String(part.received_qty)}/></View>
         </View>
       )}

       <View style={styles.issueForm}>
         <Text style={styles.formTitle}>Issue document</Text>
         <Text style={styles.label}>Document type</Text>
         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
           {DOC_TYPES.map(v=><Pressable key={v} onPress={()=>setDocType(v)} style={[styles.chip,docType===v&&styles.chipActive]}><Text style={[styles.chipText,docType===v&&styles.chipTextActive]}>{v}</Text></Pressable>)}
         </ScrollView>
         <Text style={styles.label}>Document No.</Text>
         <TextInput autoCapitalize="characters" value={docNo} onChangeText={setDocNo} placeholder="Enter issued document number" placeholderTextColor={colors.textMuted} style={styles.input}/>
         <Pressable disabled={!docNo.trim()||issue.isPending} onPress={()=>issue.mutate()} style={[styles.issue,(!docNo.trim()||issue.isPending)&&styles.disabled]}>
           {issue.isPending?<ActivityIndicator color="#fff"/>:<><AppIcon name="check" size={17} color="#fff"/><Text style={styles.issueText}>Mark Order Issued</Text></>}
         </Pressable>
       </View>
     </Screen>
   </Modal>
 </Screen>;
}

function Filter({label,value,active,warning=false,danger=false,onPress}:{label:string;value:number;active:boolean;warning?:boolean;danger?:boolean;onPress:()=>void}){
 const accent=danger?colors.danger:warning?colors.warning:colors.navy;
 return <Pressable onPress={onPress} style={[styles.filter,active&&{backgroundColor:accent}]}><Text style={[styles.filterValue,active&&styles.filterValueActive]}>{value}</Text><Text style={[styles.filterLabel,active&&styles.filterLabelActive]}>{label}</Text></Pressable>;
}
function Mini({label,value}:{label:string;value:string}){return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text numberOfLines={1} style={styles.miniValue}>{value}</Text></View>}
function Divider(){return <View style={styles.divider}/>}

const styles=StyleSheet.create({
 center:{flex:1,justifyContent:'center',padding:spacing.xl,backgroundColor:colors.background},
 list:{gap:spacing.sm,paddingBottom:spacing.xxl},
 header:{gap:spacing.md,marginBottom:spacing.md},
 hero:{minHeight:88,flexDirection:'row',alignItems:'center',gap:spacing.md,padding:spacing.md,borderRadius:20,backgroundColor:'#FFF6E8',borderWidth:1,borderColor:'#F6E1BC'},
 heroIcon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},
 heroCopy:{flex:1},
 heroTitle:{color:'#815015',fontSize:12,fontWeight:'900'},
 heroText:{color:'#866C4C',fontSize:9,lineHeight:14,marginTop:3},
 heroTotal:{color:'#815015',fontSize:22,fontWeight:'900'},
 summary:{flexDirection:'row',gap:5,padding:4,borderRadius:18,backgroundColor:'#EAEFF5'},
 filter:{flex:1,minHeight:58,alignItems:'center',justifyContent:'center',borderRadius:14},
 filterValue:{color:colors.text,fontSize:16,fontWeight:'900'},
 filterValueActive:{color:'#fff'},
 filterLabel:{color:colors.textMuted,fontSize:8,fontWeight:'900',marginTop:2},
 filterLabelActive:{color:'#EAF0F7'},
 typeRow:{flexDirection:'row',gap:spacing.sm},
 typeChip:{minHeight:36,justifyContent:'center',paddingHorizontal:12,borderRadius:999,borderWidth:1,borderColor:'#DFE6EE',backgroundColor:'#fff'},
 typeChipActive:{backgroundColor:colors.navy,borderColor:colors.navy},
 typeText:{color:colors.textMuted,fontSize:9,fontWeight:'900'},
 typeTextActive:{color:'#fff'},
 search:{minHeight:50,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderWidth:1,borderColor:'#DFE6EE',borderRadius:16,paddingHorizontal:spacing.md,backgroundColor:'#fff'},
 searchInput:{flex:1,minHeight:48,color:colors.text,fontSize:13,fontWeight:'700'},
 message:{flexDirection:'row',alignItems:'center',gap:spacing.sm,padding:spacing.sm,borderRadius:14,backgroundColor:colors.successSoft},
 messageText:{flex:1,color:colors.success,fontSize:9,fontWeight:'800'},
 card:{padding:spacing.md,borderWidth:1,borderColor:'#E1E7EE',borderRadius:20,backgroundColor:colors.surface},
 pressed:{opacity:.8},
 top:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},
 orderIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#FFF7EB'},
 copy:{flex:1},
 no:{color:colors.text,fontSize:12,fontWeight:'900'},
 customer:{color:colors.textMuted,fontSize:9,marginTop:3,fontWeight:'700'},
 age:{paddingHorizontal:9,paddingVertical:6,borderRadius:999,backgroundColor:colors.warningSoft},
 ageText:{color:colors.warning,fontSize:9,fontWeight:'900'},
 ageDanger:{backgroundColor:colors.dangerSoft},
 ageDangerText:{color:colors.danger},
 valueStrip:{minHeight:54,flexDirection:'row',alignItems:'center',marginTop:spacing.md,paddingHorizontal:spacing.sm,borderRadius:14,backgroundColor:'#F6F8FB'},
 mini:{flex:1,minWidth:0},
 miniLabel:{color:colors.textMuted,fontSize:8,fontWeight:'800'},
 miniValue:{color:colors.text,fontSize:10,fontWeight:'900',marginTop:2},
 divider:{width:StyleSheet.hairlineWidth,height:28,backgroundColor:'#DDE4EC'},
 bottom:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:spacing.sm,paddingTop:spacing.sm,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#E8EDF3'},
 received:{color:colors.textMuted,fontSize:8,fontWeight:'700'},
 open:{flexDirection:'row',alignItems:'center',gap:3},
 openText:{color:colors.blue,fontSize:9,fontWeight:'900'},
 back:{alignSelf:'flex-start',minHeight:38,justifyContent:'center'},
 backText:{color:colors.blue,fontSize:11,fontWeight:'900'},
 issueHero:{minHeight:78,flexDirection:'row',alignItems:'center',gap:spacing.md,padding:spacing.md,borderRadius:20,backgroundColor:colors.successSoft},
 issueHeroIcon:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},
 issueHeroCopy:{flex:1},
 issueHeroTitle:{color:colors.text,fontSize:12,fontWeight:'900'},
 issueHeroText:{color:colors.textMuted,fontSize:9,marginTop:3},
 loading:{flexDirection:'row',alignItems:'center',gap:spacing.sm},
 loadingText:{color:colors.textMuted,fontSize:10,fontWeight:'700'},
 part:{padding:spacing.md,borderWidth:1,borderColor:'#E1E7EE',borderRadius:18,backgroundColor:colors.surface},
 partTop:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},
 partIcon:{width:34,height:34,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'#EDF3FA'},
 partCopy:{flex:1},
 partNo:{color:colors.text,fontSize:12,fontWeight:'900'},
 partDesc:{color:colors.textMuted,fontSize:9,marginTop:2,lineHeight:14},
 partGrid:{flexDirection:'row',gap:spacing.sm,marginTop:spacing.md,paddingTop:spacing.sm,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#E8EDF3'},
 issueForm:{gap:spacing.sm,padding:spacing.md,borderRadius:20,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
 formTitle:{color:colors.text,fontSize:13,fontWeight:'900'},
 label:{color:colors.textMuted,fontSize:9,fontWeight:'900',textTransform:'uppercase'},
 chips:{gap:spacing.sm,paddingRight:spacing.md},
 chip:{minHeight:38,justifyContent:'center',paddingHorizontal:spacing.md,borderWidth:1,borderColor:'#DFE6EE',borderRadius:999,backgroundColor:colors.surface},
 chipActive:{backgroundColor:colors.navy,borderColor:colors.navy},
 chipText:{color:colors.text,fontSize:10,fontWeight:'800'},
 chipTextActive:{color:'#fff'},
 input:{minHeight:48,borderWidth:1,borderColor:'#DFE6EE',borderRadius:14,paddingHorizontal:spacing.md,backgroundColor:'#fff',color:colors.text},
 issue:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderRadius:14,backgroundColor:colors.success},
 issueText:{color:'#fff',fontSize:12,fontWeight:'900'},
 disabled:{opacity:.45},
});
