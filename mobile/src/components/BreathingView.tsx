import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

export function BreathingView({children,style,delay=0,minScale=.985,maxScale=1.012}:{children:React.ReactNode;style?:StyleProp<ViewStyle>;delay?:number;minScale?:number;maxScale?:number}) {
  const scale=useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    const loop=Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(scale,{toValue:minScale,duration:760,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      Animated.timing(scale,{toValue:maxScale,duration:760,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      Animated.timing(scale,{toValue:1,duration:560,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
    ]));
    loop.start();
    return ()=>loop.stop();
  },[delay,maxScale,minScale,scale]);
  return <Animated.View style={[style,{transform:[{scale}]}]}>{children}</Animated.View>;
}
