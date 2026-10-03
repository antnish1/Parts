import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme/tokens';

function toneFor(status: string | null | undefined) {
  const value = (status ?? '').toLowerCase();
  if (value.includes('reject') || value.includes('not despatch')) return { bg: colors.dangerSoft, fg: colors.danger };
  if (value.includes('pending') || value.includes('partial') || value.includes('correction')) return { bg: colors.warningSoft, fg: colors.warning };
  if (value.includes('approved') || value.includes('received') || value.includes('issued')) return { bg: colors.successSoft, fg: colors.success };
  return { bg: colors.infoSoft, fg: colors.info };
}

export function StatusChip({ status }: { status: string | null | undefined }) {
  const tone = toneFor(status);
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      <Text numberOfLines={1} style={[styles.text, { color: tone.fg }]}>{status || 'Unknown'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', maxWidth: 180, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 5 },
  text: { fontSize: 11, fontWeight: '800' },
});
