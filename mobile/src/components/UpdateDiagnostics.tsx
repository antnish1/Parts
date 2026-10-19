import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';

function value(input: unknown) { return input === null || input === undefined || input === '' ? 'Unavailable' : String(input); }

export function UpdateDiagnostics() {
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const rows=[
  ['Update enabled',String(Updates.isEnabled)],
  ['Channel',value(Updates.channel)],
  ['Runtime',value(Updates.runtimeVersion)],
  ['Embedded launch',String(Updates.isEmbeddedLaunch)],
  ['Update ID',value(Updates.updateId)],
  ['Created',value(Updates.createdAt?.toISOString())],
  ['Emergency launch',String(Updates.isEmergencyLaunch)],
  ['Emergency reason',value(Updates.emergencyLaunchReason)],
 ];
 async function check(){
   if(busy)return;
   if(!Updates.isEnabled){setMessage('Updates are disabled in this installed build.');return;}
   setBusy(true);setMessage('Checking for a compatible update…');
   try{
     const result=await Updates.checkForUpdateAsync();
     if(!result.isAvailable){setMessage('No compatible newer OTA found for this installation.');return;}
     const downloaded=await Updates.fetchUpdateAsync();
     if(!downloaded.isNew){setMessage('No new bundle downloaded.');return;}
     Alert.alert('Update downloaded','Restart now to load the new Parts Connect update?',[
       {text:'Later',style:'cancel',onPress:()=>setMessage('Update downloaded; it will load on the next launch.')},
       {text:'Restart',onPress:()=>{void Updates.reloadAsync().catch(e=>setMessage(e instanceof Error?e.message:'Reload failed.'));}},
     ]);
   }catch(e){setMessage(e instanceof Error?e.message:'Unable to check for updates.');}
   finally{setBusy(false);}
 }
 return <View style={styles.card}>
   <Text style={styles.title}>App update diagnostics</Text>
   {rows.map(([label,result])=><View style={styles.row} key={label}><Text style={styles.label}>{label}</Text><Text selectable style={styles.value}>{result}</Text></View>)}
   <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void check()} style={[styles.button,busy&&styles.disabled]}><Text style={styles.buttonText}>{busy?'Checking…':'Check for updates'}</Text></Pressable>
   {message?<Text style={styles.message}>{message}</Text>:null}
 </View>;
}
const styles=StyleSheet.create({
 card:{borderRadius:14,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E1E7EE',padding:12,gap:8},
 title:{fontSize:12,fontWeight:'900',color:'#12223A'},
 row:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12},
 label:{fontSize:10,color:'#64748B',fontWeight:'700'},
 value:{flex:1,textAlign:'right',fontSize:10,color:'#12223A',fontWeight:'700'},
 button:{marginTop:8,borderRadius:10,backgroundColor:'#082B5B',padding:12,alignItems:'center'},
 buttonText:{color:'#FFFFFF',fontWeight:'900',fontSize:11},
 disabled:{opacity:.5},
 message:{color:'#35465E',fontSize:10,lineHeight:15},
});
