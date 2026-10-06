import { useMemo, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { formatMoney, getAllVisibleOrders, type OrderSummary } from '@/services/orders';
import { colors, spacing } from '@/theme/tokens';

function escapeCsv(value: unknown) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }

function exportRows(orders: OrderSummary[]) {
  return orders.map((order) => ({
    'Created At': order.created_at,
    'Order No': order.order_no,
    'Final Order No': order.final_order_no ?? '',
    Branch: order.branch ?? '',
    Type: order.order_type ?? '',
    For: order.order_for ?? '',
    Customer: order.customer_name ?? '',
    Machine: order.machine_no ?? '',
    Status: order.status ?? order.approval_status ?? '',
    Qty: Number(order.total_qty ?? 0),
    Value: Number(order.total_value ?? 0),
    'DBMS Invoice': order.dbms_invoice_no ?? '',
    'DBMS Invoice Date': order.dbms_invoice_date ?? '',
    Docket: order.docket_no ?? '',
    Transport: order.transport_name ?? '',
  }));
}

async function shareReport(orders: OrderSummary[], format: 'csv' | 'xlsx') {
  if (!orders.length) throw new Error('There are no filtered orders to export.');
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
  const rows = exportRows(orders);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    const header = Object.keys(rows[0]);
    const body = [header, ...rows.map((row) => header.map((key) => row[key as keyof typeof row]))]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n');
    const file = new File(Paths.cache, `parts-orders-${stamp}.csv`);
    if (file.exists) file.delete();
    file.create();
    file.write(body);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Share orders CSV' });
    return;
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Orders');
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const file = new File(Paths.cache, `parts-orders-${stamp}.xlsx`);
  if (file.exists) file.delete();
  file.create();
  file.write(new Uint8Array(bytes));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Share orders Excel',
  });
}

export default function ReportsScreen(){
  const [branch,setBranch]=useState('all');
  const [status,setStatus]=useState('all');
  const [exporting,setExporting]=useState<'csv'|'xlsx'|''>('');
  const [message,setMessage]=useState('');
  const query=useQuery({queryKey:['mobile-reports-orders'],queryFn:getAllVisibleOrders});
  const orders=query.data??[];

  const branches=useMemo(()=>[...new Set(orders.map((o)=>o.branch).filter((v):v is string=>Boolean(v)))].sort(),[orders]);
  const statuses=useMemo(()=>[...new Set(orders.map((o)=>o.status||o.approval_status).filter((v):v is string=>Boolean(v)))].sort(),[orders]);
  const filtered=useMemo(()=>orders.filter((o)=>(branch==='all'||o.branch===branch)&&(status==='all'||(o.status||o.approval_status)===status)),[orders,branch,status]);
  const branchSummary=useMemo(()=>Object.entries(filtered.reduce<Record<string,number>>((acc,o)=>{const key=o.branch||'Unassigned';acc[key]=(acc[key]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]),[filtered]);
  const statusSummary=useMemo(()=>Object.entries(filtered.reduce<Record<string,number>>((acc,o)=>{const key=o.status||o.approval_status||'Unknown';acc[key]=(acc[key]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]),[filtered]);
  const totalValue=filtered.reduce((sum,o)=>sum+Number(o.total_value??0),0);
  const totalQty=filtered.reduce((sum,o)=>sum+Number(o.total_qty??0),0);

  async function runExport(format:'csv'|'xlsx'){
    setExporting(format);setMessage('');
    try{await shareReport(filtered,format)}
    catch(error){setMessage(error instanceof Error?error.message:'Report export failed.')}
    finally{setExporting('')}
  }

  if(query.isError)return <Screen title="Reports" subtitle="Operational order summaries"><StateView icon="alert" tone="error" title="Reports could not be loaded" message="The complete order dataset could not be retrieved." actionLabel="Retry" onAction={()=>void query.refetch()}/></Screen>;

  return (
    <Screen title="Reports" subtitle="Operational order register">
      {query.isLoading?<View style={styles.loading}><ActivityIndicator color={colors.navy}/><Text style={styles.loadingText}>Loading report…</Text></View>:null}

      <View style={styles.summaryStrip}>
        <Summary label="Orders" value={String(filtered.length)} />
        <Divider />
        <Summary label="Qty" value={String(totalQty)} />
        <Divider />
        <Summary label="Value" value={formatMoney(totalValue)} />
        <Divider />
        <Summary label="Branches" value={String(branchSummary.length)} />
      </View>

      <View style={styles.filterBlock}>
        <Text style={styles.label}>Branch</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All" active={branch==='all'} onPress={()=>setBranch('all')}/>
          {branches.map((value)=><Chip key={value} label={value} active={branch===value} onPress={()=>setBranch(value)}/>)}
        </ScrollView>
      </View>

      <View style={styles.filterBlock}>
        <Text style={styles.label}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All" active={status==='all'} onPress={()=>setStatus('all')}/>
          {statuses.map((value)=><Chip key={value} label={value} active={status===value} onPress={()=>setStatus(value)}/>)}
        </ScrollView>
      </View>

      <View style={styles.exportRow}>
        <Pressable disabled={!filtered.length||Boolean(exporting)} onPress={()=>void runExport('csv')} style={[styles.exportButton,(!filtered.length||Boolean(exporting))&&styles.disabled]}><AppIcon name="package" size={14} color={colors.navy}/><Text style={styles.exportText}>{exporting==='csv'?'Preparing…':'CSV'}</Text></Pressable>
        <Pressable disabled={!filtered.length||Boolean(exporting)} onPress={()=>void runExport('xlsx')} style={[styles.exportButton,(!filtered.length||Boolean(exporting))&&styles.disabled]}><AppIcon name="package" size={14} color={colors.navy}/><Text style={styles.exportText}>{exporting==='xlsx'?'Preparing…':'Excel'}</Text></Pressable>
      </View>
      {message?<Text style={styles.message}>{message}</Text>:null}

      <View style={styles.split}>
        <View style={styles.summaryBox}>
          <Text style={styles.section}>Top branches</Text>
          {branchSummary.slice(0,5).map(([label,count])=><View key={label} style={styles.summaryRow}><Text numberOfLines={1} style={styles.summaryLabelText}>{label}</Text><Text style={styles.summaryCount}>{count}</Text></View>)}
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.section}>Top statuses</Text>
          {statusSummary.slice(0,5).map(([label,count])=><View key={label} style={styles.summaryRow}><View style={styles.statusCopy}><StatusChip status={label}/></View><Text style={styles.summaryCount}>{count}</Text></View>)}
        </View>
      </View>

      <View style={styles.sectionHead}><Text style={styles.section}>Orders</Text><Text style={styles.previewCount}>{Math.min(filtered.length,100)} shown</Text></View>
      {filtered.slice(0,100).map((order)=>
        <Pressable key={order.id} onPress={()=>router.push(`/orders/${order.id}`)} style={({pressed})=>[styles.row,pressed&&styles.pressed]}>
          <View style={styles.rowIcon}><AppIcon name="package" size={14} color={colors.navy}/></View>
          <View style={styles.copy}>
            <View style={styles.topLine}><Text numberOfLines={1} style={styles.orderNo}>{order.final_order_no||order.order_no}</Text><Text style={styles.value}>{formatMoney(order.total_value)}</Text></View>
            <Text numberOfLines={1} style={styles.meta}>{order.customer_name||order.order_for||'—'} · {order.branch||'—'} · Qty {Number(order.total_qty??0)}</Text>
          </View>
          <StatusChip status={order.status||order.approval_status}/>
        </Pressable>
      )}

      {!query.isLoading&&filtered.length===0?<StateView icon="inbox" title="No orders match these filters" message="Change the branch or status filter to view another report slice."/>:null}
      {filtered.length>100?<Text style={styles.previewNote}>Screen preview shows 100 rows. Exports include all {filtered.length.toLocaleString('en-IN')} filtered orders.</Text>:null}
    </Screen>
  );
}

function Chip({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable onPress={onPress} style={[styles.chip,active&&styles.chipActive]}><Text style={[styles.chipText,active&&styles.chipTextActive]}>{label}</Text></Pressable>}
function Summary({label,value}:{label:string;value:string}){return <View style={styles.summary}><Text style={styles.summaryLabel}>{label}</Text><Text numberOfLines={1} style={styles.summaryValue}>{value}</Text></View>}
function Divider(){return <View style={styles.divider}/>}

const styles=StyleSheet.create({
  loading:{flexDirection:'row',alignItems:'center',gap:7},
  loadingText:{color:colors.textMuted,fontSize:9,fontWeight:'700'},
  summaryStrip:{minHeight:48,flexDirection:'row',alignItems:'center',paddingHorizontal:8,borderRadius:12,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  summary:{flex:1,minWidth:0},
  summaryLabel:{color:colors.textMuted,fontSize:7.5,fontWeight:'800'},
  summaryValue:{color:colors.text,fontSize:10,fontWeight:'900',marginTop:2},
  divider:{width:StyleSheet.hairlineWidth,height:26,backgroundColor:'#DDE4EC'},
  filterBlock:{gap:5},
  label:{color:colors.textMuted,fontSize:8,fontWeight:'900',textTransform:'uppercase'},
  chips:{gap:6,paddingRight:10},
  chip:{paddingHorizontal:9,paddingVertical:6,borderRadius:999,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  chipActive:{backgroundColor:colors.navy,borderColor:colors.navy},
  chipText:{color:colors.textMuted,fontSize:8.5,fontWeight:'800'},
  chipTextActive:{color:'#fff'},
  exportRow:{flexDirection:'row',gap:7},
  exportButton:{flex:1,minHeight:36,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,borderRadius:10,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  exportText:{color:colors.navy,fontSize:8.5,fontWeight:'900'},
  disabled:{opacity:.45},
  message:{color:colors.danger,fontSize:8.5,fontWeight:'700'},
  split:{flexDirection:'row',gap:7},
  summaryBox:{flex:1,padding:9,borderRadius:12,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  section:{color:colors.text,fontSize:10,fontWeight:'900'},
  summaryRow:{minHeight:29,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:5,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#E8EDF3',marginTop:5,paddingTop:5},
  summaryLabelText:{flex:1,color:colors.textMuted,fontSize:7.5,fontWeight:'700'},
  statusCopy:{flex:1},
  summaryCount:{color:colors.navy,fontSize:9,fontWeight:'900'},
  sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  previewCount:{color:colors.textMuted,fontSize:8,fontWeight:'800'},
  row:{minHeight:56,flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:8,paddingVertical:7,borderRadius:11,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  pressed:{opacity:.8},
  rowIcon:{width:28,height:28,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:'#EEF3F8'},
  copy:{flex:1},
  topLine:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6},
  orderNo:{flex:1,color:colors.text,fontSize:9,fontWeight:'900'},
  value:{color:colors.navy,fontSize:8.5,fontWeight:'900'},
  meta:{color:colors.textMuted,fontSize:7.5,fontWeight:'700',marginTop:3},
  previewNote:{color:colors.textMuted,fontSize:8,textAlign:'center',paddingVertical:4},
});
