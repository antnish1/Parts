import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export function SkeletonLoader({ rows = 4, compact = false }: { rows?: number; compact?: boolean }) {
 const opacity = useRef(new Animated.Value(0.48)).current;
 useEffect(() => {
  const pulse = Animated.loop(Animated.sequence([
   Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
   Animated.timing(opacity, { toValue: 0.48, duration: 700, useNativeDriver: true }),
  ]));
  pulse.start();
  return () => pulse.stop();
 }, [opacity]);
 return <View accessibilityLabel="Loading content" style={styles.wrap}>
  {!compact ? <Animated.View style={[styles.heading, { opacity }]} /> : null}
  {Array.from({ length: rows }, (_, index) => <View key={index} style={[styles.card, compact && styles.compactCard]}>
   <Animated.View style={[styles.lineMain, { opacity }]} />
   <Animated.View style={[styles.lineSub, { opacity }]} />
   {!compact ? <Animated.View style={[styles.strip, { opacity }]} /> : null}
  </View>)}
 </View>;
}
const styles=StyleSheet.create({
 wrap:{width:'100%',gap:10,paddingVertical:8},
 heading:{width:'42%',height:16,borderRadius:7,backgroundColor:'#DEE6F0',marginBottom:5},
 card:{height:96,borderRadius:13,borderWidth:1,borderColor:'#E4EAF1',backgroundColor:'#FFFFFF',padding:12,gap:9},
 compactCard:{height:56,paddingVertical:10,justifyContent:'center'},
 lineMain:{width:'65%',height:11,borderRadius:5,backgroundColor:'#DEE6F0'},
 lineSub:{width:'45%',height:9,borderRadius:5,backgroundColor:'#E8EDF5'},
 strip:{flex:1,borderRadius:8,backgroundColor:'#EDF3F9'},
});