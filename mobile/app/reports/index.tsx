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
import { colors, radius, spacing } from '@/theme/tokens';

function escapeCsv(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

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
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Orders');
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

 return <Screen title="Reports" subtitle="Operational order summaries with complete branch and status data">
   {query.isLoading?<View style={styles.loading}><ActivityIndicator color={colors.navy}/><Text style={styles.loadingText}>Loading complete order report…</Text></View>:null}
   <Text style={styles.label}>Branch</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip label="All" active={branch==='all'} onPress={()=>setBranch('all')}/>{branches.map((value)=><Chip key={value} label={value} active={branch===value} onPress={()=>setBranch(value)}/>)}</ScrollView>
   <Text style={styles.label}>Status</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip label="All" active={status==='all'} onPress={()=>setStatus('all')}/>{statuses.map((value)=><Chip key={value} label={value} active={status===value} onPress={()=>setStatus(value)}/>)}</ScrollView>
   <View style={styles.exportRow}>
     <Pressable disabled={!filtered.length||Boolean(exporting)} onPress={()=>void runExport('csv')} style={[styles.exportButton,(!filtered.length||Boolean(exporting))&&styles.disabled]}><AppIcon name="package" size={16} color={colors.navy}/><Text style={styles.exportText}>{exporting==='csv'?'Preparing…':'CSV'}</Text></Pressable>
     <Pressable disabled={!filtered.length||Boolean(exporting)} onPress={()=>void runExport('xlsx')} style={[styles.exportButton,(!filtered.length||Boolean(exporting))&&styles.disabled]}><AppIcon name="package" size={16} color={colors.navy}/><Text style={styles.exportText}>{exporting==='xlsx'?'Preparing…':'Excel'}</Text></Pressable>
   </View>
   {message?<Text style={styles.message}>{message}</Text>:null}
   <View style={styles.metrics}><Metric label="Filtered" value={String(filtered.length)}/><Metric label="Qty" value={String(totalQty)}/><Metric label="Value" value={formatMoney(totalValue)}/><Metric label="Branches" value={String(branchSummary.length)}/></View>
   <View style={styles.summary}><Text style={styles.section}>Branch Summary</Text>{branchSummary.map(([label,count])=><View key={label} style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{count}</Text></View>)}</View>
   <View style={styles.summary}><Text style={styles.section}>Status Summary</Text>{statusSummary.map(([label,count])=><View key={label} style={styles.row}><StatusChip status={label}/><Text style={styles.rowValue}>{count}</Text></View>)}</View>
   <Text style={styles.section}>Orders</Text>{filtered.slice(0,100).map((order)=><Pressable key={order.id} onPress={()=>router.push(`/orders/${order.id}`)} style={({pressed})=>[styles.card,pressed&&styles.pressed]}><View style={styles.top}><View style={styles.copy}><Text style={styles.orderNo}>{order.final_order_no||order.order_no}</Text><Text style={styles.muted}>{order.customer_name||order.order_for||'—'} • {order.branch||'—'}</Text></View><StatusChip status={order.status||order.approval_status}/></View><View style={styles.cardMeta}><Text style={styles.muted}>Qty {Number(order.total_qty??0)}</Text><Text style={styles.muted}>{formatMoney(order.total_value)}</Text></View></Pressable>)}
   {!query.isLoading&&filtered.length===0?<StateView icon="inbox" title="No orders match these filters" message="Change the branch or status filter to view another report slice."/>:null}
   {filtered.length>100?<Text style={styles.previewNote}>Showing the first 100 orders on screen. Exports include all {filtered.length.toLocaleString('en-IN')} filtered orders.</Text>:null}
 </Screen>
}
function Chip({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable onPress={onPress} style={[styles.chip,active&&styles.chipActive]}><Text style={[styles.chipText,active&&styles.chipTextActive]}>{label}</Text></Pressable>}
function Metric({label,value}:{label:string;value:string}){return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text numberOfLines={1} style={styles.metricValue}>{value}</Text></View>}
const styles=StyleSheet.create({loading:{flexDirection:'row',alignItems:'center',gap:spacing.sm},loadingText:{color:colors.textMuted,fontSize:11,fontWeight:'700'},label:{color:colors.textMuted,fontSize:10,fontWeight:'800',textTransform:'uppercase'},chips:{gap:spacing.sm,paddingRight:spacing.lg},chip:{paddingHorizontal:12,paddingVertical:9,borderRadius:999,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},chipActive:{backgroundColor:colors.navy,borderColor:colors.navy},chipText:{color:colors.textMuted,fontSize:11,fontWeight:'800'},chipTextActive:{color:'#fff'},exportRow:{flexDirection:'row',gap:spacing.sm},exportButton:{flex:1,minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},exportText:{color:colors.navy,fontSize:11,fontWeight:'900'},disabled:{opacity:.45},message:{color:colors.danger,fontSize:10,fontWeight:'700'},metrics:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},metric:{width:'48%',padding:spacing.md,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},metricLabel:{color:colors.textMuted,fontSize:10,fontWeight:'700'},metricValue:{color:colors.text,fontSize:17,fontWeight:'900',marginTop:2},summary:{padding:spacing.md,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},section:{color:colors.text,fontSize:14,fontWeight:'900'},row:{minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:spacing.md,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border,marginTop:spacing.sm,paddingTop:spacing.sm},rowLabel:{flex:1,color:colors.text,fontSize:11,fontWeight:'700'},rowValue:{color:colors.navy,fontSize:13,fontWeight:'900'},card:{padding:spacing.md,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,gap:spacing.sm},pressed:{opacity:.8},top:{flexDirection:'row',justifyContent:'space-between',gap:spacing.sm},copy:{flex:1},orderNo:{color:colors.text,fontSize:13,fontWeight:'900'},muted:{color:colors.textMuted,fontSize:10,fontWeight:'700'},cardMeta:{flexDirection:'row',justifyContent:'space-between'},previewNote:{color:colors.textMuted,fontSize:9,textAlign:'center',paddingVertical:spacing.sm}});
