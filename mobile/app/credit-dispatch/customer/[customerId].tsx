import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { formatCreditMoney } from '@/services/creditDispatch';
import { getCreditCustomer, getCreditCustomerLedger } from '@/services/creditCustomers';
import { colors, radius, spacing } from '@/theme/tokens';

export default function CreditCustomerLedgerScreen(){
 const params=useLocalSearchParams<{customerId:string}>();
 const customerId=Array.isArray(params.customerId)?params.customerId[0]:params.customerId;
 const ledgerQuery=useQuery({queryKey:['credit-customer-ledger',customerId],queryFn:()=>getCreditCustomerLedger(customerId),enabled:Boolean(customerId)});
 const customerQuery=useQuery({queryKey:['credit-customer-profile',customerId],queryFn:()=>getCreditCustomer(customerId),enabled:Boolean(customerId)});
 if(ledgerQuery.isLoading)return <View style={styles.center}><StateView icon="package" title="Loading customer ledger" message="Retrieving credit history and balances…"/></View>;
 if(ledgerQuery.isError||!ledgerQuery.data)return <View style={styles.center}><StateView icon="alert" tone="error" title="Customer ledger could not be loaded" message="Check your connection and try again." actionLabel="Retry" onAction={()=>void ledgerQuery.refetch()}/></View>;
 const {summary,ledger}=ledgerQuery.data;
 const customer=customerQuery.data;
 return <Screen title="Credit Customer">
   <View style={styles.profile}>
     <View style={styles.profileTop}><View style={styles.profileIcon}><AppIcon name="package" size={20} color="#FFFFFF"/></View><View style={styles.copy}><Text numberOfLines={1} style={styles.profileName}>{summary.customer_name}</Text><Text style={styles.profileMeta}>{summary.customer_type} • {summary.risk_category} Risk</Text></View></View>
     <View style={styles.profileGrid}>
       <Info label="Mobile" value={summary.mobile_no}/>
       <Info label="Branch" value={summary.default_branch||'—'}/>
       <Info label="Credit limit" value={customer?.credit_limit==null?'—':formatCreditMoney(customer.credit_limit)}/>
       <Info label="GST" value={customer?.gst_no||'—'}/>
       <Info label="BP Code" value={customer?.business_partner_code||'—'}/>
       <Info label="Status" value={customer?.is_active===false?'Inactive':'Active'}/>
     </View>
     {customer?.address?<Text style={styles.address}>{customer.address}</Text>:null}
     {customerQuery.isError?<Text style={styles.profileWarning}>Some customer profile details could not be loaded; ledger values are still available.</Text>:null}
   </View>
   <View style={styles.metrics}><Metric label="Total Credit" value={formatCreditMoney(summary.total_credit)}/><MetricDivider/><Metric label="Received" value={formatCreditMoney(summary.total_received)}/><MetricDivider/><Metric label="Outstanding" value={formatCreditMoney(summary.outstanding)}/><MetricDivider/><Metric label="Overdue" value={formatCreditMoney(summary.overdue)}/></View>
   <Text style={styles.section}>Ledger</Text>
   {ledger.map((row,index)=><View key={`${row.dispatch_id}-${row.sort_at}-${index}`} style={styles.card}><View style={styles.top}><View style={styles.copy}><Text style={styles.type}>{row.entry_type}</Text><Text style={styles.meta}>{row.transaction_date} • {row.branch}</Text></View><Text style={[styles.amount,row.debit>0?styles.debit:styles.credit]}>{row.debit>0?`+ ${formatCreditMoney(row.debit)}`:`- ${formatCreditMoney(row.credit)}`}</Text></View><Text style={styles.particulars}>{row.particulars}</Text><View style={styles.footer}><Text style={styles.meta}>{row.document_type} • {row.document_no||'—'}</Text><Text style={styles.balance}>Balance {formatCreditMoney(row.balance)}</Text></View></View>)}
   {!ledger.length?<StateView icon="inbox" title="No approved ledger entries" message="Approved Credit Dispatch and payment entries will appear here."/>:null}
 </Screen>
}
function Metric({label,value}:{label:string;value:string}){return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text numberOfLines={1} style={styles.metricValue}>{value}</Text></View>}
function MetricDivider(){return <View style={styles.metricDivider}/>}
function Info({label,value}:{label:string;value:string}){return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text numberOfLines={1} style={styles.infoValue}>{value}</Text></View>}
const styles=StyleSheet.create({center:{flex:1,justifyContent:'center',padding:spacing.xl,backgroundColor:colors.background},profile:{padding:14,borderRadius:18,backgroundColor:colors.navy,gap:10},profileTop:{flexDirection:'row',alignItems:'center',gap:10},profileIcon:{width:38,height:38,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.12)'},copy:{flex:1,minWidth:0},profileName:{color:'#FFFFFF',fontSize:14.5,fontWeight:'900'},profileMeta:{color:'#C5D7EA',fontSize:9.5,fontWeight:'700',marginTop:2},profileGrid:{flexDirection:'row',flexWrap:'wrap',rowGap:9},info:{width:'33.33%',paddingRight:6},infoLabel:{color:'#91AAC5',fontSize:8,fontWeight:'700'},infoValue:{color:'#FFFFFF',fontSize:10,fontWeight:'800',marginTop:2},address:{color:'#C5D7EA',fontSize:9,lineHeight:14,paddingTop:8,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'rgba(255,255,255,.16)'},profileWarning:{color:'#FFD89B',fontSize:9,fontWeight:'700'},metrics:{minHeight:58,flexDirection:'row',alignItems:'stretch',borderRadius:12,borderWidth:1,borderColor:'#D7E1EC',backgroundColor:'#FFFFFF',overflow:'hidden'},metric:{flex:1,minWidth:0,paddingHorizontal:8,justifyContent:'center'},metricDivider:{width:1,backgroundColor:'#D7E1EC',marginVertical:9},metricLabel:{color:colors.textMuted,fontSize:8,fontWeight:'700'},metricValue:{color:colors.navy,fontSize:11,fontWeight:'900',marginTop:2},section:{color:colors.text,fontSize:13,fontWeight:'900'},card:{padding:11,borderRadius:13,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,gap:7},top:{flexDirection:'row',justifyContent:'space-between',gap:spacing.sm},type:{color:colors.text,fontSize:11,fontWeight:'900'},meta:{color:colors.textMuted,fontSize:9,fontWeight:'700',marginTop:2},amount:{fontSize:12,fontWeight:'900'},debit:{color:colors.danger},credit:{color:colors.success},particulars:{color:colors.text,fontSize:10,lineHeight:14},footer:{flexDirection:'row',justifyContent:'space-between',gap:spacing.md,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border,paddingTop:7},balance:{color:colors.navy,fontSize:10,fontWeight:'900'}});
