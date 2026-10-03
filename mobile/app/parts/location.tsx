import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { getPartLocationResult } from '@/services/partLocation';
import { formatMoney } from '@/services/orders';
import { colors, radius, spacing } from '@/theme/tokens';

export default function PartLocationFinderScreen() {
  const { role } = useAuth();
  const [partNo,setPartNo] = useState(''); const [loading,setLoading] = useState(false); const [message,setMessage] = useState('');
  const [result,setResult] = useState<Awaited<ReturnType<typeof getPartLocationResult>> | null>(null);
  if (role === 'accounts') return <View style={styles.center}><Text style={styles.error}>Part Location Finder is not available for Accounts.</Text></View>;
  async function search() { const value = partNo.trim(); if (!value) return; setLoading(true); setMessage(''); try { const data = await getPartLocationResult(value); setResult(data); if (!data.part) setMessage('Part was not found in Part Master.'); else if (!data.locations.length) setMessage('No active storage location is mapped for this part.'); } catch (error) { setResult(null); setMessage(error instanceof Error ? error.message : 'Lookup failed.'); } finally { setLoading(false); } }
  return <Screen title="Part Location Finder" subtitle="Find the physical storage location of a part instantly.">
    <View style={styles.searchRow}><TextInput autoCapitalize="characters" autoCorrect={false} value={partNo} onChangeText={setPartNo} onSubmitEditing={() => void search()} returnKeyType="search" placeholder="Enter Part No." placeholderTextColor={colors.textMuted} style={styles.input} /><Pressable onPress={() => void search()} disabled={loading} style={styles.searchButton}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchText}>Find</Text>}</Pressable></View>
    {result?.part ? <View style={styles.partCard}><Text style={styles.partNo}>{result.part.part_no}</Text><Text style={styles.description}>{result.part.description || 'No description'}</Text><View style={styles.metaRow}><Text style={styles.meta}>DNP {formatMoney(result.part.dnp)}</Text><Text style={styles.meta}>{result.part.cat1 || result.part.cat2 || 'Uncategorised'}</Text></View></View> : null}
    {result?.locations.map((location,index) => <View key={location.id} style={styles.locationCard}><Text style={styles.locationIndex}>LOCATION {index + 1}</Text><Text style={styles.location}>{location.location}</Text></View>)}
    {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
    {['manager','admin','developer'].includes(role ?? '') ? <Pressable onPress={() => router.push('/parts/location-manage')} style={styles.manage}><Text style={styles.manageText}>Manage Part Locations</Text></Pressable> : null}
  </Screen>;
}
const styles=StyleSheet.create({ center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background}, error:{color:colors.danger}, searchRow:{flexDirection:'row',gap:spacing.sm}, input:{flex:1,minHeight:50,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:spacing.md,backgroundColor:'#fff',color:colors.text,fontSize:15}, searchButton:{width:82,minHeight:50,alignItems:'center',justifyContent:'center',borderRadius:radius.md,backgroundColor:colors.navy}, searchText:{color:'#fff',fontWeight:'900'}, partCard:{padding:spacing.lg,borderRadius:radius.lg,backgroundColor:colors.navy}, partNo:{color:'#fff',fontSize:20,fontWeight:'900'}, description:{color:'#D6E7FF',fontSize:12,lineHeight:18,marginTop:4}, metaRow:{flexDirection:'row',justifyContent:'space-between',gap:spacing.md,marginTop:spacing.md}, meta:{color:'#B7D8FF',fontSize:10,fontWeight:'800'}, locationCard:{minHeight:96,justifyContent:'center',padding:spacing.lg,borderRadius:radius.lg,borderWidth:1,borderColor:'#B8D3F8',backgroundColor:'#F8FBFF'}, locationIndex:{color:colors.blue,fontSize:9,fontWeight:'900',letterSpacing:1}, location:{color:colors.text,fontSize:22,fontWeight:'900',marginTop:4}, message:{padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.warningSoft}, messageText:{color:colors.warning,fontSize:11,lineHeight:17}, manage:{minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:radius.md,borderWidth:1,borderColor:colors.navy,backgroundColor:'#fff'}, manageText:{color:colors.navy,fontWeight:'900'} });
