import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, TextInput, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { colors } from '@/theme/tokens';

type Props = { value: string; onChangeText: (text: string) => void; hints: string[] };
export function RotatingOrderSearch({ value, onChangeText, hints }: Props) {
  const [index, setIndex] = useState(0);
  const motion = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (value || !hints.length) { motion.stopAnimation(); motion.setValue(0); return; }
    const timer = setInterval(() => {
      Animated.timing(motion, { toValue: -18, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        setIndex(i => (i + 1) % hints.length);
        motion.setValue(18);
        Animated.timing(motion, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
      });
    }, 2800);
    return () => { clearInterval(timer); motion.stopAnimation(); };
  }, [value, hints, motion]);
  return <View style={styles.box}>
    <AppIcon name="search" size={18} color={colors.textMuted}/>
    <View style={styles.area}>
      {!value ? <Animated.Text pointerEvents="none" style={[styles.hint, { transform: [{ translateY: motion }] }]}>{hints[index % hints.length]}</Animated.Text> : null}
      <TextInput autoCorrect={false} value={value} onChangeText={onChangeText} placeholder="" accessibilityLabel="Search list by order, customer, branch, machine or reference" style={styles.input}/>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  box:{height:46,flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:'#DEE6F0',borderRadius:12,paddingHorizontal:12,backgroundColor:'#FFFFFF'},
  area:{flex:1,height:42,justifyContent:'center',overflow:'hidden'},
  hint:{position:'absolute',fontSize:12,color:colors.textMuted},
  input:{height:42,fontSize:12,color:colors.text},
});
