import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { getPartLocationResult } from '@/services/partLocation';
import { formatMoney } from '@/services/orders';
import { colors, spacing } from '@/theme/tokens';

export default function PartLocationFinderScreen() {
  const { role } = useAuth();
  const [partNo,setPartNo] = useState('');
  const [loading,setLoading] = useState(false);
  const [message,setMessage] = useState('');
  const [result,setResult] = useState<Awaited<ReturnType<typeof getPartLocationResult>> | null>(null);

  if (role === 'accounts') return <View style={styles.center}><StateView icon="alert" tone="error" title="Part Location unavailable" message="This workflow is not available for Accounts." /></View>;

  async function search() {
    const value = partNo.trim();
    if (!value) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await getPartLocationResult(value);
      setResult(data);
      if (!data.part) setMessage('Part was not found in Part Master.');
      else if (!data.locations.length) setMessage('No active storage location is mapped for this part.');
    } catch (error) {
      setResult(null);
      setMessage(error instanceof Error ? error.message : 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen title="Part Location" subtitle="Find the physical rack, bin or shelf for a part">
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <AppIcon name="search" size={16} color={colors.textMuted}/>
          <TextInput autoCapitalize="characters" autoCorrect={false} value={partNo} onChangeText={setPartNo} onSubmitEditing={() => void search()} returnKeyType="search" placeholder="Part No." placeholderTextColor={colors.textMuted} style={styles.input}/>
        </View>
        <Pressable onPress={() => void search()} disabled={loading} style={styles.searchButton}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchText}>Find</Text>}</Pressable>
      </View>

      {result?.part ? (
        <View style={styles.partRow}>
          <View style={styles.partIcon}><AppIcon name="package" size={16} color={colors.navy}/></View>
          <View style={styles.copy}>
            <Text style={styles.partNo}>{result.part.part_no}</Text>
            <Text numberOfLines={1} style={styles.description}>{result.part.description || 'No description'}</Text>
            <Text style={styles.meta}>DNP {formatMoney(result.part.dnp)} · {result.part.cat1 || result.part.cat2 || 'Uncategorised'}</Text>
          </View>
        </View>
      ) : null}

      {result?.locations.length ? <Text style={styles.section}>Locations</Text> : null}
      {result?.locations.map((location,index) => (
        <View key={location.id} style={styles.locationRow}>
          <View style={styles.locationIndex}><Text style={styles.locationIndexText}>{index+1}</Text></View>
          <AppIcon name="inventory" size={15} color={colors.blue}/>
          <Text style={styles.location}>{location.location}</Text>
        </View>
      ))}

      {message ? <View style={styles.message}><AppIcon name="alert" size={14} color={colors.warning}/><Text style={styles.messageText}>{message}</Text></View> : null}

      {['manager','admin','developer'].includes(role ?? '') ? (
        <Pressable onPress={() => router.push('/parts/location-manage')} style={styles.manage}>
          <AppIcon name="inventory" size={14} color={colors.navy}/>
          <Text style={styles.manageText}>Manage locations</Text>
          <AppIcon name="chevronRight" size={14} color={colors.navy}/>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles=StyleSheet.create({
  center:{flex:1,justifyContent:'center',padding:spacing.xl,backgroundColor:colors.background},
  searchRow:{flexDirection:'row',gap:7},
  search:{flex:1,minHeight:42,flexDirection:'row',alignItems:'center',gap:7,borderWidth:1,borderColor:'#E1E7EE',borderRadius:11,paddingHorizontal:10,backgroundColor:'#fff'},
  input:{flex:1,minHeight:40,color:colors.text,fontSize:11},
  searchButton:{width:64,minHeight:42,alignItems:'center',justifyContent:'center',borderRadius:11,backgroundColor:colors.navy},
  searchText:{color:'#fff',fontSize:9,fontWeight:'900'},
  partRow:{minHeight:60,flexDirection:'row',alignItems:'center',gap:8,padding:9,borderRadius:12,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  partIcon:{width:32,height:32,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:'#EEF3F8'},
  copy:{flex:1},
  partNo:{color:colors.text,fontSize:10,fontWeight:'900'},
  description:{color:colors.textMuted,fontSize:8.5,fontWeight:'700',marginTop:2},
  meta:{color:'#7C8796',fontSize:7.5,fontWeight:'700',marginTop:3},
  section:{color:colors.text,fontSize:10,fontWeight:'900'},
  locationRow:{minHeight:46,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:9,borderRadius:11,borderWidth:1,borderColor:'#DDE6F0',backgroundColor:'#fff'},
  locationIndex:{width:24,height:24,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:colors.blueSoft},
  locationIndexText:{color:colors.blue,fontSize:8,fontWeight:'900'},
  location:{flex:1,color:colors.text,fontSize:11,fontWeight:'900'},
  message:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:9,paddingVertical:7,borderRadius:10,backgroundColor:colors.warningSoft},
  messageText:{flex:1,color:colors.warning,fontSize:8.5,fontWeight:'700'},
  manage:{minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderRadius:11,borderWidth:1,borderColor:'#DDE4EC',backgroundColor:'#fff'},
  manageText:{color:colors.navy,fontSize:9,fontWeight:'900'},
});
