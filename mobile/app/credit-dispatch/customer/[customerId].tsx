import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { formatCreditMoney } from '@/services/creditDispatch';
import { getCreditCustomerLedger } from '@/services/creditCustomers';
import { colors, radius, spacing } from '@/theme/tokens';

export default function CreditCustomerLedgerScreen(){
 const params=useLocalSearchParams<{customerId:string}>(); const customerId=Array.isArray(params.customerId)?params.customerId[0]:params.customerId; const query=useQuery({queryKey:['credit-customer-ledger',customerId],queryFn:()=>getCreditCustomerLedger(customerId),enabled:Boolean(customerId)});
 if(query.isLoading) return <View style={styles.center}><ActivityIndicator color={colors.navy}/></View>; if(query.isError||!query.data) return <View style={styles.center}><Text style={styles.error}>Unable to load customer ledger.</Text><Pressable onPress={()=>router.back()}><Text style={styles.back}>Go back</Text></Pressable></View>;
 const {summary,ledger}=query.data;
 return <Screen title={summary.customer_name} subtitle={`${summary.mobile_no} • ${summary.default_branch||'No branch'}`}>
   <Pressable onPress={()=>router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
   <View style={styles.metrics}><Metric label="Total Credit" value={formatCreditMoney(summary.total_credit)}/><Metric label="Received" value={formatCreditMoney(summary.total_received)}/><Metric label="Outstanding" value={formatCreditMoney(summary.outstanding)}/><Metric label="Overdue" value={formatCreditMoney(summary.overdue)}/></View>
   <Text style={styles.section}>Ledger</Text>
   {ledger.map((row,index)=><View key={`${row.dispatch_id}-${row.sort_at}-${index}`} style={styles.card}><View style={styles.top}><View style={styles.copy}><Text style={styles.type}>{row.entry_type}</Text><Text style={styles.meta}>{row.transaction_date} • {row.branch}</Text></View><Text style={[styles.amount,row.debit>0?styles.debit:styles.credit]}>{row.debit>0?`+ ${formatCreditMoney(row.debit)}`:`- ${formatCreditMoney(row.credit)}`}</Text></View><Text style={styles.particulars}>{row.particulars}</Text><View style={styles.footer}><Text style={styles.meta}>{row.document_type} • {row.document_no||'—'}</Text><Text style={styles.balance}>Balance {formatCreditMoney(row.balance)}</Text></View></View>)}
   {!ledger.length?<Text style={styles.empty}>No ledger entries.</Text>:null}
 </Screen>
}
function Metric({label,value}:{label:string;value:string}){return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text numberOfLines={1} style={styles.metricValue}>{value}</Text></View>}
const styles=StyleSheet.create({center:{flex:1,alignItems:'center',justifyContent:'center',gap:spacing.md,backgroundColor:colors.background},error:{color:colors.danger},back:{color:colors.blue,fontSize:13,fontWeight:'900'},metrics:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},metric:{width:'48%',padding:spacing.md,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},metricLabel:{color:colors.textMuted,fontSize:9,fontWeight:'700'},metricValue:{color:colors.text,fontSize:15,fontWeight:'900',marginTop:2},section:{color:colors.text,fontSize:14,fontWeight:'900'},card:{padding:spacing.md,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,gap:spacing.sm},top:{flexDirection:'row',justifyContent:'space-between',gap:spacing.sm},copy:{flex:1},type:{color:colors.text,fontSize:12,fontWeight:'900'},meta:{color:colors.textMuted,fontSize:9,fontWeight:'700',marginTop:2},amount:{fontSize:12,fontWeight:'900'},debit:{color:colors.danger},credit:{color:colors.success},particulars:{color:colors.text,fontSize:11,lineHeight:16},footer:{flexDirection:'row',justifyContent:'space-between',gap:spacing.md,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border,paddingTop:spacing.sm},balance:{color:colors.navy,fontSize:10,fontWeight:'900'},empty:{color:colors.textMuted,textAlign:'center',padding:spacing.xl}});
