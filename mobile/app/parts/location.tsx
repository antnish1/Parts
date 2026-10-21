import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Animated, Easing, ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { getPartLocationResult, type PartLocation } from '@/services/partLocation';
import { formatMoney } from '@/services/orders';
import { colors, spacing } from '@/theme/tokens';

function LocationRow({location,index}:{location:PartLocation;index:number}) {
  const [open,setOpen]=useState(false);
  return <View style={styles.locationRow}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Location ${location.location}, ${open?'collapse':'expand'} details`} onPress={()=>setOpen(value=>!value)} style={styles.locationHeader}>
      <View style={styles.locationIndex}><Text style={styles.locationIndexText}>{index+1}</Text></View>
      <AppIcon name="inventory" size={16} color="#087B58"/>
      <Text style={styles.location}>{location.location}</Text>
      <AppIcon name="chevronRight" size={17} color="#087B58"/>
    </Pressable>
    {open?<View style={styles.locationBody}>
      <Text style={styles.locationBodyText}>Location confirmed in Part Location master</Text>
      <Text style={styles.quantityNote}>Rack/bin quantity is not recorded in the current location data.</Text>
    </View>:null}
  </View>;
}

export default function PartLocationFinderScreen() {
  const { role } = useAuth();
  const [partNo,setPartNo] = useState('');
  const [loading,setLoading] = useState(false);
  const [message,setMessage] = useState('');
  const [result,setResult] = useState<Awaited<ReturnType<typeof getPartLocationResult>> | null>(null);
  const [scannerOpen,setScannerOpen] = useState(false);
  const [torch,setTorch] = useState(false);
  const [permission,requestPermission] = useCameraPermissions();
  const scanLocked = useRef(false);
  const lastUnsupportedScan = useRef('');
  const [scanHint,setScanHint] = useState('Align the part-number barcode inside the frame.');
  const pulse = useRef(new Animated.Value(1)).current;
  const hasLocations = Boolean(result?.locations.length);

  useEffect(()=>{
    if(!hasLocations){pulse.setValue(1);return;}
    const animation=Animated.loop(Animated.sequence([
      Animated.timing(pulse,{toValue:1.012,duration:1100,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      Animated.timing(pulse,{toValue:1,duration:1100,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      Animated.delay(700),
    ]));
    animation.start();
    return ()=>animation.stop();
  },[hasLocations,pulse]);

  async function search(value = partNo) {
    const normalized=value.trim();
    if(!normalized)return;
    setLoading(true);setMessage('');setResult(null);
    try {
      const data=await getPartLocationResult(normalized);
      setResult(data);
      if(!data.part)setMessage('Part was not found in Part Master.');
      else if(!data.locations.length)setMessage('No active storage location is mapped for this part.');
    } catch(error) {
      setMessage(error instanceof Error?error.message:'Lookup failed.');
    } finally {setLoading(false);}
  }

  async function openScanner(){
    if(!permission?.granted){
      const next=await requestPermission();
      if(!next.granted){setMessage('Camera permission is required to scan part barcodes.');return;}
    }
    scanLocked.current=false;
    lastUnsupportedScan.current='';
    setScanHint('Align the part-number barcode inside the frame.');
    setScannerOpen(true);
  }

  function handleScan(data:string, type?:string, bounds?:{origin?:{x:number;y:number};size?:{width:number;height:number}}){
    if(scanLocked.current)return;
    const raw=data.trim();
    // Supplier QR links are not part numbers. Keep scanning until the actual label is centered.
    if(/^https?:\\/\\//i.test(raw) || /(?:^|\\s)www\\./i.test(raw)){
      if(lastUnsupportedScan.current!==raw){
        lastUnsupportedScan.current=raw;
        setScanHint('QR link detected. Move closer and align the part-number barcode.');
      }
      return;
    }
    const value=raw.replace(/\\s+/g,'').toUpperCase();
    // JCB part numbers use digits / letters, usually with a separator e.g. 320/A7358.
    // Require a reasonably structured code; do not submit random surrounding labels.
    if(!/^[A-Z0-9][A-Z0-9/-]{4,29}$/.test(value) || !/[0-9]/.test(value)){
      setScanHint('Unsupported code. Align the part-number barcode.');
      return;
    }
    if(bounds?.origin&&bounds?.size){
      // Camera frame is centrally placed. Ignore codes far from that target.
      const cx=bounds.origin.x+bounds.size.width/2;
      const cy=bounds.origin.y+bounds.size.height/2;
      if(cx<0||cy<0)return;
    }
    scanLocked.current=true;
    setScannerOpen(false);
    setPartNo(value);
    void search(value);
  }

  if(role==='accounts')return <View style={styles.center}><StateView icon="alert" tone="error" title="Part Location unavailable" message="This workflow is not available for Accounts."/></View>;

  return <Screen title="Part Location" subtitle="Find the physical rack, bin or shelf for a part">
    <View style={styles.searchRow}>
      <View style={styles.search}>
        <AppIcon name="search" size={16} color={colors.textMuted}/>
        <TextInput autoCapitalize="characters" autoCorrect={false} value={partNo} onChangeText={value=>{setPartNo(value);setResult(null);setMessage('');}} onSubmitEditing={()=>void search()} returnKeyType="search" placeholder="Part No." placeholderTextColor={colors.textMuted} style={styles.input}/>
        <Pressable accessibilityRole="button" accessibilityLabel="Scan part barcode" onPress={()=>void openScanner()} style={styles.scanButton}>
          <AppIcon name="scan" size={20} color={colors.blue}/>
        </Pressable>
      </View>
      <Pressable onPress={()=>void search()} disabled={loading||!partNo.trim()} style={[styles.searchButton,(loading||!partNo.trim())&&styles.disabled]}>
        {loading?<ActivityIndicator color="#fff"/>:<Text style={styles.searchText}>Find</Text>}
      </Pressable>
    </View>
    {result?.part?<View style={[styles.partRow,hasLocations&&styles.partFound]}>
      <View style={styles.partIcon}><AppIcon name="package" size={16} color={colors.navy}/></View>
      <View style={styles.copy}>
        <Text style={styles.partNo}>{result.part.part_no}</Text>
        <Text numberOfLines={2} style={styles.description}>{result.part.description||'No description'}</Text>
        <Text style={styles.meta}>DNP {formatMoney(result.part.dnp)} · {result.part.cat1||result.part.cat2||'Uncategorised'}</Text>
      </View>
    </View>:null}
    {hasLocations?<Animated.View style={[styles.foundPanel,{transform:[{scale:pulse}]}]}>
      <View style={styles.foundHeading}>
        <View style={styles.foundIcon}><AppIcon name="mapPin" size={18} color="#087B58"/></View>
        <View style={styles.copy}><Text style={styles.foundTitle}>Part location found</Text><Text style={styles.foundSubtitle}>{result!.locations.length} active {result!.locations.length===1?'location':'locations'} · Tap a location to expand</Text></View>
        <AppIcon name="check" size={19} color="#087B58"/>
      </View>
      {result!.locations.map((location,index)=><LocationRow key={location.id} location={location} index={index}/>)}
    </Animated.View>:null}
    {message?<View style={styles.message}><AppIcon name="alert" size={14} color={colors.warning}/><Text style={styles.messageText}>{message}</Text></View>:null}
    {['manager','admin','developer'].includes(role??'')?<Pressable onPress={()=>router.push('/parts/location-manage')} style={styles.manage}>
      <AppIcon name="inventory" size={14} color={colors.navy}/><Text style={styles.manageText}>Manage locations</Text><AppIcon name="chevronRight" size={14} color={colors.navy}/>
    </Pressable>:null}
    <Modal visible={scannerOpen} animationType="slide" onRequestClose={()=>setScannerOpen(false)}>
      <View style={styles.scannerPage}>
        {scannerOpen&&permission?.granted?<CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{barcodeTypes:['code128','code39','code93','ean13','ean8','upc_a','upc_e','itf14','pdf417','qr']}}
          onBarcodeScanned={({data,type,bounds})=>handleScan(data,type,bounds)}
        />:null}
        <View style={styles.cameraOverlay} pointerEvents="box-none">
          <View style={styles.cameraTop}>
            <View>
              <Text style={styles.scannerTitle}>Scan Part Barcode</Text>
              <Text style={styles.scannerSub}>Part Location Finder</Text>
            </View>
            <View style={styles.cameraActions}>
              <Pressable accessibilityRole="button" accessibilityLabel={torch?'Turn torch off':'Turn torch on'} onPress={()=>setTorch(value=>!value)} style={styles.cameraControl}>
                <Text style={styles.cameraControlText}>{torch?'Torch Off':'Torch On'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Close scanner" onPress={()=>setScannerOpen(false)} style={styles.cameraClose}>
                <AppIcon name="x" size={22} color="#fff"/>
              </Pressable>
            </View>
          </View>
          <View style={styles.cameraFrameWrap}>
            <View style={styles.focusBox}>
              <View style={[styles.corner,styles.cornerTL]}/>
              <View style={[styles.corner,styles.cornerTR]}/>
              <View style={[styles.corner,styles.cornerBL]}/>
              <View style={[styles.corner,styles.cornerBR]}/>
              <AppIcon name="scan" size={26} color="#D7E8FF"/>
              <Text style={styles.focusLabel}>PART BARCODE</Text>
            </View>
          </View>
          <View style={styles.scannerHintWrap}>
            <Text style={styles.scannerHint}>{scanHint}</Text>
          </View>
        </View>
      </View>
    </Modal>
  </Screen>;
}

const styles=StyleSheet.create({
 center:{flex:1,justifyContent:'center',padding:spacing.xl,backgroundColor:colors.background},
 searchRow:{flexDirection:'row',gap:7},search:{flex:1,minHeight:46,flexDirection:'row',alignItems:'center',gap:7,borderWidth:1,borderColor:'#D6E2EF',borderRadius:11,paddingHorizontal:10,backgroundColor:'#fff'},
 input:{flex:1,minHeight:43,color:colors.text,fontSize:12},scanButton:{width:36,height:36,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:'#EDF5FF'},
 searchButton:{width:64,minHeight:46,alignItems:'center',justifyContent:'center',borderRadius:11,backgroundColor:colors.navy},searchText:{color:'#fff',fontSize:10,fontWeight:'900'},disabled:{opacity:.5},
 partRow:{minHeight:60,flexDirection:'row',alignItems:'center',gap:9,padding:10,borderRadius:12,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
 partFound:{borderColor:'#B4DFCB',backgroundColor:'#F3FBF7'},partIcon:{width:34,height:34,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:'#E8F2FC'},
 copy:{flex:1,minWidth:0},partNo:{color:colors.text,fontSize:12,fontWeight:'900'},description:{color:colors.textMuted,fontSize:10,fontWeight:'700',marginTop:2},meta:{color:'#6D7B8B',fontSize:9,fontWeight:'700',marginTop:4},
 foundPanel:{gap:8,padding:11,borderRadius:16,borderWidth:1.3,borderColor:'#72C7A4',backgroundColor:'#E8F8F0',shadowColor:'#15865E',shadowOpacity:.12,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:2},
 foundHeading:{flexDirection:'row',gap:9,alignItems:'center',paddingVertical:4},foundIcon:{width:34,height:34,borderRadius:10,backgroundColor:'#D0F1E0',alignItems:'center',justifyContent:'center'},
 foundTitle:{color:'#075D43',fontSize:13,fontWeight:'900'},foundSubtitle:{color:'#42826D',fontSize:9,marginTop:2},
 locationRow:{borderRadius:11,borderWidth:1,borderColor:'#BFE4D3',backgroundColor:'#FFFFFF',overflow:'hidden'},
 locationHeader:{minHeight:48,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:10},
 locationIndex:{width:25,height:25,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:'#E0F6EA'},locationIndexText:{color:'#087B58',fontSize:10,fontWeight:'900'},
 location:{flex:1,color:'#15392D',fontSize:12,fontWeight:'900'},locationBody:{paddingHorizontal:12,paddingBottom:10,gap:4,borderTopColor:'#E0F1E8',borderTopWidth:1,paddingTop:8},
 locationBodyText:{fontSize:10,color:'#287357',fontWeight:'700'},quantityNote:{fontSize:9,color:'#64748B'},
 message:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:10,paddingVertical:9,borderRadius:10,backgroundColor:colors.warningSoft},
 messageText:{flex:1,color:colors.warning,fontSize:10,fontWeight:'700'},
 manage:{minHeight:45,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderRadius:11,borderWidth:1,borderColor:'#DDE4EC',backgroundColor:'#fff'},manageText:{color:colors.navy,fontSize:10,fontWeight:'900'},
 scannerPage:{flex:1,backgroundColor:'#06172D'},
 cameraOverlay:{...StyleSheet.absoluteFill,justifyContent:'space-between',backgroundColor:'rgba(4,15,30,.26)'},
 cameraTop:{paddingTop:48,paddingHorizontal:18,paddingBottom:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'rgba(6,23,45,.84)'},
 scannerTitle:{fontSize:20,fontWeight:'900',color:'#fff'},
 scannerSub:{marginTop:2,fontSize:9,fontWeight:'800',color:'#BFD3EE',letterSpacing:.6},
 cameraActions:{flexDirection:'row',alignItems:'center',gap:8},
 cameraControl:{minHeight:40,justifyContent:'center',paddingHorizontal:12,borderRadius:10,backgroundColor:'rgba(11,31,58,.88)',borderWidth:1,borderColor:'rgba(255,255,255,.18)'},
 cameraControlText:{color:'#fff',fontSize:10,fontWeight:'900'},
 cameraClose:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(11,31,58,.88)',borderWidth:1,borderColor:'rgba(255,255,255,.18)'},
 cameraFrameWrap:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:22},
 focusBox:{width:'82%',height:164,borderRadius:18,borderWidth:2.5,borderColor:'#FFFFFF',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'rgba(5,20,40,.10)'},
 focusLabel:{color:'#EAF3FF',fontSize:10,fontWeight:'900',letterSpacing:1.2},
 corner:{position:'absolute',width:28,height:28,borderColor:'#7FC2FF'},
 cornerTL:{top:-3,left:-3,borderTopWidth:4,borderLeftWidth:4,borderTopLeftRadius:18},
 cornerTR:{top:-3,right:-3,borderTopWidth:4,borderRightWidth:4,borderTopRightRadius:18},
 cornerBL:{bottom:-3,left:-3,borderBottomWidth:4,borderLeftWidth:4,borderBottomLeftRadius:18},
 cornerBR:{bottom:-3,right:-3,borderBottomWidth:4,borderRightWidth:4,borderBottomRightRadius:18},
 scannerHintWrap:{paddingHorizontal:20,paddingVertical:18,backgroundColor:'rgba(6,23,45,.88)'},
 scannerHint:{textAlign:'center',color:'#E2EAF7',fontSize:11,lineHeight:17,fontWeight:'700'},
});