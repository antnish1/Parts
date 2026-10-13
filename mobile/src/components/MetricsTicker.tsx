import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon, type AppIconName } from '@/components/AppIcon';

export type TickerMetric = { key: string; label: string; value: number; icon: AppIconName; tone: 'blue' | 'red' | 'amber' | 'green'; onPress: () => void };

const palette = {
  blue: { bg: '#EFF5FF', fg: '#2457A7', border: '#D8E5F7' },
  red: { bg: '#FFF3F3', fg: '#B43B3B', border: '#F2D4D4' },
  amber: { bg: '#FFF8EA', fg: '#98611E', border: '#F1E0B8' },
  green: { bg: '#EEF8F3', fg: '#16724F', border: '#D5EBDD' },
};

export function MetricsTicker({ items }: { items: TickerMetric[] }) {
  const x = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReduceMotion(enabled); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    x.stopAnimation();
    x.setValue(0);
    if (!width || paused || reduceMotion || !items.length) return;
    const animation = Animated.loop(Animated.timing(x, {
      toValue: -width,
      duration: Math.max(12000, width * 32),
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [x, width, paused, reduceMotion, items.length]);

  const chips = (copy: string) => items.map((item) => {
    const tone = palette[item.tone];
    return (
      <Pressable key={copy + item.key} accessibilityRole="button" accessibilityLabel={item.value + ' ' + item.label}
        onPress={item.onPress} style={[styles.chip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
        <AppIcon name={item.icon} size={14} color={tone.fg} />
        <Text style={[styles.number, { color: tone.fg }]}>{item.value}</Text>
        <Text style={styles.label}>{item.label}</Text>
      </Pressable>
    );
  });
  return (
    <View style={styles.clip} onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}
      onTouchCancel={() => setPaused(false)}>
      {reduceMotion ? <View style={styles.line}>{chips('static')}</View> : (
        <Animated.View style={[styles.line, { transform: [{ translateX: x }] }]}>
          <View style={styles.line} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>{chips('first')}</View>
          <View style={styles.line}>{chips('second')}</View>
        </Animated.View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  clip: { overflow: 'hidden', minHeight: 36 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  chip: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 0, borderRadius: 11, borderWidth: 1, paddingHorizontal: 10 },
  number: { fontSize: 12, fontWeight: '900' },
  label: { color: '#46566B', fontSize: 9, fontWeight: '800' },
});
