import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Animated, type StyleProp, type ViewStyle } from 'react-native';

type Props = PropsWithChildren<{
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  trigger?: unknown;
}>;

export function MotionView({ children, delay = 0, distance = 8, duration = 220, style, trigger }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    opacity.stopAnimation();
    translateY.stopAnimation();

    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(distance);
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, delay, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, distance, duration, opacity, reduceMotion, translateY, trigger]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
