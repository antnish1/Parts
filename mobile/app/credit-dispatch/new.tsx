import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { CreditDispatchForm } from '@/components/CreditDispatchForm';
import { Screen } from '@/components/Screen';
import { createCreditDispatch, type CreditDispatchFormInput } from '@/services/creditDispatch';
import { colors, spacing } from '@/theme/tokens';

export default function NewCreditDispatchScreen(){
 const {profile,role}=useAuth(); const queryClient=useQueryClient(); const allowed=role==='branch'||role==='developer'; const branch=profile?.branch??'';
 const mutation=useMutation({mutationFn:(input:CreditDispatchFormInput)=>createCreditDispatch(input),onSuccess:async(row)=>{await queryClient.invalidateQueries({queryKey:['credit-dispatches']});router.replace(`/credit-dispatch/${row.id}`);}});
 if(!allowed) return <View style={styles.center}><Text style={styles.error}>New Credit Dispatch is available to Branch and Developer roles.</Text></View>;
 return <Screen title="New Credit Dispatch" subtitle="Signed request • Accounts → Manager approval"><Pressable onPress={()=>router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><CreditDispatchForm branch={branch} busy={mutation.isPending} onSubmit={async(input)=>{await mutation.mutateAsync(input)}}/></Screen>
}
const styles=StyleSheet.create({center:{flex:1,alignItems:'center',justifyContent:'center',padding:spacing.xl,backgroundColor:colors.background},error:{color:colors.danger,textAlign:'center'},back:{color:colors.blue,fontSize:13,fontWeight:'900'}});
