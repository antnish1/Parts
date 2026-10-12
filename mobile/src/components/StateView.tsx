import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = {
  icon?: AppIconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'error';
};

export function StateView({ icon = 'inbox', title, message, actionLabel, onAction, tone = 'neutral' }: Props) {
  const iconColor = tone === 'error' ? colors.danger : colors.navy;
  const iconBg = tone === 'error' ? colors.dangerSoft : colors.blueSoft;
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}><AppIcon name={icon} size={28} color={iconColor} /></View>
      <Text style={[styles.title, tone === 'error' && styles.errorTitle]}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <AppIcon name="refresh" size={16} color="#fff" />
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  iconWrap: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  errorTitle: { color: colors.danger },
  message: { maxWidth: 300, color: colors.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  action: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.navy },
  actionText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  pressed: { opacity: .82 },
});
