import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { colors, radius } from '@/theme/tokens';

function toneFor(status: string | null | undefined) {
  const value = (status ?? '').toLowerCase();
  if (value.includes('reject') || value.includes('not despatch')) return { bg: colors.dangerSoft, fg: colors.danger };
  if (value.includes('pending') || value.includes('partial') || value.includes('correction')) return { bg: colors.warningSoft, fg: colors.warning };
  if (value.includes('approved') || value.includes('received') || value.includes('issued') || value.includes('accepted') || value.includes('closed')) return { bg: colors.successSoft, fg: colors.success };
  return { bg: colors.infoSoft, fg: colors.info };
}

export function formatStatusLabel(status: string | null | undefined) {
  const value = String(status ?? '').trim();
  if (!value) return 'Unknown';
  const normalized = value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized
    .split(' ')
    .map((part) => {
      const upper = part.toUpperCase();
      if (['HQ', 'SVR', 'DBMS', 'VOR', 'TA/DA'].includes(upper)) return upper;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

export function StatusChip({ status, align = 'left' }: { status: string | null | undefined; align?: 'left' | 'right' }) {
  const tone = toneFor(status);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 0.965, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.delay(1000),
    ]));
    animation.start();
    return () => animation.stop();
  }, [scale]);
  return (
    <Animated.View style={[styles.chip, align === 'right' && styles.alignRight, { backgroundColor: tone.bg, shadowColor: tone.fg, transform: [{ scale }] }]}>
      <Text numberOfLines={1} style={[styles.text, { color: tone.fg }]}>{formatStatusLabel(status)}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  alignRight: { alignSelf: 'flex-end' },
  chip: { alignSelf: 'flex-start', maxWidth: 170, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  text: { fontSize: 8.5, fontWeight: '900' },
});
