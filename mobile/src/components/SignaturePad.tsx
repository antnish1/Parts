import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { colors, radius, spacing } from '@/theme/tokens';

export type SignaturePadHandle = { capture: () => Promise<string>; clear: () => void; hasSignature: () => boolean };
type Point = { x:number; y:number };

export const SignaturePad = forwardRef<SignaturePadHandle,{label:string}>(({label},ref)=>{
  const captureView=useRef<View>(null);
  const [strokes,setStrokes]=useState<Point[][]>([]);
  const [current,setCurrent]=useState<Point[]>([]);
  const hasSignature=strokes.length>0 || current.length>1;
  const responder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderGrant:(event)=>{ const {locationX:x,locationY:y}=event.nativeEvent; setCurrent([{x,y}]); },
    onPanResponderMove:(event)=>{ const {locationX:x,locationY:y}=event.nativeEvent; setCurrent((points)=>[...points,{x,y}]); },
    onPanResponderRelease:()=>setCurrent((points)=>{ if(points.length>1) setStrokes((prev)=>[...prev,points]); return []; }),
    onPanResponderTerminate:()=>setCurrent((points)=>{ if(points.length>1) setStrokes((prev)=>[...prev,points]); return []; }),
  }),[]);
  function path(points:Point[]){ if(points.length<2) return ''; return points.map((p,i)=>`${i===0?'M':'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '); }
  function clear(){ setStrokes([]); setCurrent([]); }
  async function capture(){ if(!hasSignature) throw new Error(`${label} is required.`); if(!captureView.current) throw new Error('Signature canvas is not ready.'); return captureRef(captureView,{format:'png',quality:1,result:'tmpfile'}); }
  useImperativeHandle(ref,()=>({capture,clear,hasSignature:()=>hasSignature}),[hasSignature,label]);
  return <View style={styles.wrap}>
    <View style={styles.header}><Text style={styles.label}>{label}</Text><Pressable onPress={clear} hitSlop={8}><Text style={styles.clear}>Clear</Text></Pressable></View>
    <View ref={captureView} collapsable={false} style={styles.canvas} {...responder.panHandlers}>
      <Svg width="100%" height="100%">{strokes.map((stroke,index)=><Path key={index} d={path(stroke)} stroke={colors.text} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round"/>)}{current.length>1?<Path d={path(current)} stroke={colors.text} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round"/>:null}</Svg>
      {!hasSignature?<View pointerEvents="none" style={styles.hintWrap}><Text style={styles.hint}>Sign inside this box</Text></View>:null}
    </View>
  </View>;
});
SignaturePad.displayName='SignaturePad';
const styles=StyleSheet.create({wrap:{gap:spacing.sm},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},label:{color:colors.text,fontSize:12,fontWeight:'900'},clear:{color:colors.blue,fontSize:11,fontWeight:'900'},canvas:{height:170,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,backgroundColor:'#fff',overflow:'hidden'},hintWrap:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center'},hint:{color:colors.textMuted,fontSize:12,fontWeight:'700'}});
