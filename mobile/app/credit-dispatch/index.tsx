import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { formatCreditMoney, getCreditDispatches, type CreditDispatch } from '@/services/creditDispatch';
import { colors, spacing } from '@/theme/tokens';

type Filter='pending'|'overdue'|'payment'|'rejected'|'closed'|'correction'|'all';

function matches(row:CreditDispatch,filter:Filter){
  if(filter==='pending')return row.approval_status==='Pending Accounts Approval'||row.approval_status==='Pending Manager Approval';
  if(filter==='overdue')return row.recovery_status==='Payment Overdue'||row.recovery_status==='Partial Payment - Overdue';
  if(filter==='payment')return row.approval_status==='Approved'&&['Pending Payment','Partial Payment','Partial Payment - Overdue','Payment Overdue'].includes(row.recovery_status);
  if(filter==='rejected')return row.approval_status.startsWith('Rejected');
  if(filter==='closed')return row.recovery_status==='Closed';
  if(filter==='correction')return row.approval_status.startsWith('Correction Requested');
  return true;
}

export default function CreditDispatchListScreen(){
  const {role}=useAuth();
  const allowed=['branch','accounts','manager','admin','super','developer'].includes(role??'');
  const canCreate=role==='branch'||role==='developer';
  const [filter,setFilter]=useState<Filter>('pending');
  const [search,setSearch]=useState('');
  const query=useQuery({queryKey:['credit-dispatches'],queryFn:()=>getCreditDispatches(),enabled:allowed});
  const data=query.data??[];

  const counts=useMemo(()=>({
    pending:data.filter((r)=>matches(r,'pending')).length,
    overdue:data.filter((r)=>matches(r,'overdue')).length,
    payment:data.filter((r)=>matches(r,'payment')).length,
    rejected:data.filter((r)=>matches(r,'rejected')).length,
    closed:data.filter((r)=>matches(r,'closed')).length,
    correction:data.filter((r)=>matches(r,'correction')).length,
    all:data.length,
  }),[data]);

  const rows=useMemo(()=>{
    const needle=search.trim().toLowerCase();
    return data
      .filter((r)=>matches(r,filter))
      .filter((r)=>!needle||[r.dispatch_no,r.customer_name,r.mobile_no,r.document_no,r.branch,r.sales_employee_name].some((v)=>String(v??'').toLowerCase().includes(needle)));
  },[data,filter,search]);

  if(!allowed)return <View style={styles.center}><StateView icon="alert" tone="error" title="Credit Dispatch unavailable" message="This workflow is not available for your role." /></View>;

  function toggle(next:Filter){setFilter((current)=>current===next&&next!=='all'?'all':next)}

  return (
    <Screen title="Credit Dispatch" subtitle={`${rows.length} shown · ${role} view`} scroll={false}>
      <FlatList
        data={rows}
        keyExtractor={(item)=>item.id}
        contentContainerStyle={styles.list}
        refreshing={query.isRefetching}
        onRefresh={()=>void query.refetch()}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.actions}>
              {canCreate?<Pressable onPress={()=>router.push('/credit-dispatch/new')} style={styles.primary}><AppIcon name="package" size={14} color="#fff"/><Text style={styles.primaryText}>New Request</Text></Pressable>:null}
              <Pressable onPress={()=>router.push('/credit-dispatch/customers')} style={styles.secondary}><AppIcon name="wallet" size={14} color={colors.navy}/><Text style={styles.secondaryText}>Customers / Aging</Text></Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <FilterChip label="Pending" value={counts.pending} active={filter==='pending'} onPress={()=>toggle('pending')}/>
              <FilterChip label="Overdue" value={counts.overdue} active={filter==='overdue'} danger onPress={()=>toggle('overdue')}/>
              <FilterChip label="Payment" value={counts.payment} active={filter==='payment'} onPress={()=>toggle('payment')}/>
              <FilterChip label="Rejected" value={counts.rejected} active={filter==='rejected'} danger onPress={()=>toggle('rejected')}/>
              <FilterChip label="Correction" value={counts.correction} active={filter==='correction'} onPress={()=>toggle('correction')}/>
              <FilterChip label="Closed" value={counts.closed} active={filter==='closed'} onPress={()=>toggle('closed')}/>
              <FilterChip label="All" value={counts.all} active={filter==='all'} onPress={()=>toggle('all')}/>
            </ScrollView>

            <View style={styles.search}>
              <AppIcon name="search" size={16} color={colors.textMuted}/>
              <TextInput autoCorrect={false} placeholder="Customer, request, document, branch…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} style={styles.searchInput}/>
            </View>
          </View>
        }
        renderItem={({item})=>
          <Pressable style={({pressed})=>[styles.row,pressed&&styles.pressed]} onPress={()=>router.push(`/credit-dispatch/${item.id}`)}>
            <View style={styles.rowIcon}><AppIcon name="wallet" size={15} color={colors.navy}/></View>
            <View style={styles.copy}>
              <View style={styles.topLine}>
                <Text numberOfLines={1} style={styles.no}>{item.dispatch_no||'Credit Request'}</Text>
                <Text style={styles.amount}>{formatCreditMoney(item.credit_amount)}</Text>
              </View>
              <Text numberOfLines={1} style={styles.customer}>{item.customer_name} · {item.branch}</Text>
              <View style={styles.metaLine}>
                <Text numberOfLines={1} style={styles.meta}>Bal {formatCreditMoney(item.balance_amount)} · Due {item.due_date||'—'}</Text>
                <StatusChip status={item.approval_status}/>
              </View>
            </View>
            <AppIcon name="chevronRight" size={15} color="#94A3B8"/>
          </Pressable>
        }
        ListEmptyComponent={!query.isLoading?(query.isError
          ?<StateView icon="alert" tone="error" title="Credit Dispatch could not be loaded" message="Check your connection and retry." actionLabel="Retry" onAction={()=>void query.refetch()}/>
          :<StateView icon="truck" title="No requests in this view" message="No Credit Dispatch requests match the selected status and search."/>
        ):null}
      />
    </Screen>
  );
}

function FilterChip({label,value,active,danger=false,onPress}:{label:string;value:number;active:boolean;danger?:boolean;onPress:()=>void}){
  return <Pressable onPress={onPress} style={[styles.filterChip,active&&styles.filterChipActive,danger&&active&&styles.filterChipDanger]}><Text style={[styles.filterValue,active&&styles.filterValueActive]}>{value}</Text><Text style={[styles.filterLabel,active&&styles.filterLabelActive]}>{label}</Text></Pressable>
}

const styles=StyleSheet.create({
  center:{flex:1,justifyContent:'center',padding:spacing.xl,backgroundColor:colors.background},
  list:{gap:7,paddingBottom:spacing.xxl},
  header:{gap:8,marginBottom:8},
  actions:{flexDirection:'row',gap:7},
  primary:{flex:1,minHeight:38,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,borderRadius:10,backgroundColor:colors.navy},
  primaryText:{color:'#fff',fontSize:9,fontWeight:'900'},
  secondary:{flex:1,minHeight:38,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,borderRadius:10,borderWidth:1,borderColor:'#DDE4EC',backgroundColor:'#fff'},
  secondaryText:{color:colors.navy,fontSize:9,fontWeight:'900'},
  filters:{gap:6,paddingRight:10},
  filterChip:{minHeight:34,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:9,borderRadius:999,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  filterChipActive:{backgroundColor:colors.navy,borderColor:colors.navy},
  filterChipDanger:{backgroundColor:colors.danger,borderColor:colors.danger},
  filterValue:{color:colors.navy,fontSize:9.5,fontWeight:'900'},
  filterLabel:{color:colors.textMuted,fontSize:8,fontWeight:'800'},
  filterValueActive:{color:'#fff'},
  filterLabelActive:{color:'#fff'},
  search:{minHeight:42,flexDirection:'row',alignItems:'center',gap:7,borderRadius:11,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff',paddingHorizontal:10},
  searchInput:{flex:1,minHeight:40,color:colors.text,fontSize:11},
  row:{minHeight:64,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:9,paddingVertical:8,borderRadius:12,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  pressed:{opacity:.8},
  rowIcon:{width:30,height:30,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:'#EEF3F8'},
  copy:{flex:1},
  topLine:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  no:{flex:1,color:colors.text,fontSize:9.5,fontWeight:'900'},
  amount:{color:colors.navy,fontSize:9.5,fontWeight:'900'},
  customer:{color:colors.textMuted,fontSize:8.5,fontWeight:'700',marginTop:2},
  metaLine:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6,marginTop:4},
  meta:{flex:1,color:'#7C8796',fontSize:7.5,fontWeight:'700'},
});
