import { StyleSheet, Text, View } from 'react-native';
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

export function StatusChip({ status }: { status: string | null | undefined }) {
  const tone = toneFor(status);
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      <Text numberOfLines={1} style={[styles.text, { color: tone.fg }]}>{formatStatusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', maxWidth: 190, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  text: { fontSize: 10, fontWeight: '900' },
});
