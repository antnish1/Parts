import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { CreditDispatchForm } from '@/components/CreditDispatchForm';
import { Screen } from '@/components/Screen';
import { getCreditDispatchDetail, resubmitCorrectedCreditDispatch, type CreditDispatchFormInput } from '@/services/creditDispatch';
import { colors, spacing } from '@/theme/tokens';

export default function EditCreditDispatchScreen(){
 const params=useLocalSearchParams<{dispatchId:string}>(); const dispatchId=Array.isArray(params.dispatchId)?params.dispatchId[0]:params.dispatchId; const {profile,role}=useAuth(); const queryClient=useQueryClient();
 const detail=useQuery({queryKey:['credit-dispatch-detail',dispatchId],queryFn:()=>getCreditDispatchDetail(dispatchId),enabled:Boolean(dispatchId)});
 const mutation=useMutation({mutationFn:(input:CreditDispatchFormInput)=>resubmitCorrectedCreditDispatch(dispatchId,input,profile?.branch??''),onSuccess:async()=>{await queryClient.invalidateQueries({queryKey:['credit-dispatch-detail',dispatchId]});await queryClient.invalidateQueries({queryKey:['credit-dispatches']});router.replace(`/credit-dispatch/${dispatchId}`);}});
 if(detail.isLoading) return <View style={styles.center}><ActivityIndicator color={colors.navy}/></View>;
 const row=detail.data?.dispatch; const allowed=(role==='branch'||role==='developer')&&Boolean(row)&&['Correction Requested by Accounts','Correction Requested by Manager'].includes(row!.approval_status);
 if(!allowed||!row) return <View style={styles.center}><Text style={styles.error}>This request is not available for Branch correction/resubmission.</Text><Pressable onPress={()=>router.back()}><Text style={styles.back}>Go back</Text></Pressable></View>;
 return <Screen title="Correct Credit Dispatch" subtitle="Fresh customer and issuer signatures are required before resubmission"><Pressable onPress={()=>router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><View style={styles.note}><Text style={styles.noteTitle}>Correction requested</Text><Text style={styles.noteText}>{row.correction_note||'Update the request and submit it back to Accounts.'}</Text></View><CreditDispatchForm branch={row.branch} initial={{customerName:row.customer_name,customerType:row.customer_type,mobileNo:row.mobile_no,documentType:row.document_type,documentNo:row.document_no??'',documentDate:row.document_date,creditAmount:row.credit_amount,tentativeClosureDays:row.tentative_closure_days,remarks:row.remarks??'',salesEmployeeName:row.sales_employee_name??''}} busy={mutation.isPending} submitLabel="Resubmit to Accounts" onSubmit={async(input)=>{await mutation.mutateAsync(input)}}/></Screen>
}
const styles=StyleSheet.create({center:{flex:1,alignItems:'center',justifyContent:'center',gap:spacing.md,padding:spacing.xl,backgroundColor:colors.background},error:{color:colors.danger,textAlign:'center'},back:{color:colors.blue,fontSize:13,fontWeight:'900'},note:{padding:spacing.lg,backgroundColor:colors.warningSoft,borderRadius:12},noteTitle:{color:colors.warning,fontWeight:'900',fontSize:12},noteText:{color:colors.text,fontSize:11,lineHeight:17,marginTop:3}});
