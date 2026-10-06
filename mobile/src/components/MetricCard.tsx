import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = {
  label: string;
  value: number | string;
  active?: boolean;
  onPress?: () => void;
};

export function MetricCard({ label, value, active = false, onPress }: Props) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.card, active && styles.active, pressed && onPress && styles.pressed]}>
      <View>
        <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
        <Text style={[styles.value, active && styles.activeValue]}>{value}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minWidth: 118, minHeight: 72, justifyContent: 'center', padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  active: { backgroundColor: colors.navy, borderColor: colors.navy },
  pressed: { opacity: 0.82 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  value: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  activeLabel: { color: '#D6E7FF' },
  activeValue: { color: '#FFFFFF' },
});
