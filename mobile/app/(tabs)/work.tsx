import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { roleWorkActions, type WorkAction } from '@/auth/roleNavigation';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { MotionView } from '@/components/MotionView';
import { colors, radius, spacing } from '@/theme/tokens';

function iconColor(action: WorkAction): string {
  if (action.key.includes('vor')) return '#B5474C';
  if (action.key.includes('pending')) return '#B98020';
  if (action.key.includes('credit')) return '#188467';
  if (action.key.includes('tada')) return '#7456A7';
  if (action.key.includes('docket')) return '#277C94';
  if (action.key.includes('part-location')) return '#23836F';
  if (action.key.includes('installations')) return '#6177A0';
  return '#245BAD';
}

function iconFor(action: WorkAction): AppIconName {
  if (action.key.includes('approval')) return 'clipboardCheck';
  if (action.key.includes('track')) return 'route';
  if (action.key.includes('pending')) return 'inbox';
  if (action.key.includes('vor')) return 'timer';
  if (action.key.includes('docket')) return 'scan';
  if (action.key.includes('part-location')) return 'mapPin';
  if (action.key.includes('credit')) return 'wallet';
  if (action.key.includes('tada')) return 'work';
  if (action.key.includes('installations')) return 'package';
  if (action.key.includes('reports')) return 'fileChart';
  if (action.key.includes('manager-dashboard')) return 'inventory';
  if (action.key.includes('uploads')) return 'package';
  if (action.key.includes('developer')) return 'shield';
  if (action.key.includes('admin')) return 'shield';
  if (action.key.includes('new-order')) return 'package';
  return 'grid';
}

export default function WorkScreen() {
  const { role } = useAuth();
  const actions = role ? roleWorkActions[role] : [];

  return (
    <Screen brandHeader title={role === 'manager' ? 'Manager Workbench' : 'Work'} subtitle={role === 'manager' ? undefined : 'Your operational tasks, arranged for mobile.'}>
      <View style={styles.grid}>
        {actions.map((action, index) => (
          <MotionView key={action.key} delay={Math.min(index * 38, 260)}>
          <Pressable
            disabled={!action.href}
            onPress={() => action.href && router.push(action.href)}
            style={({ pressed }) => [styles.card, action.href ? styles.cardActive : styles.cardPlanned, pressed && action.href && styles.pressed]}
          >
            <View style={[styles.iconWrap, { backgroundColor: iconColor(action) }]}><AppIcon name={iconFor(action)} size={21} color="#FFFFFF" strokeWidth={2.7} /></View>
            <View style={styles.copy}>
              <Text style={styles.title}>{action.label}</Text>
              <Text numberOfLines={2} style={styles.description}>{action.description}</Text>
            </View>
            <AppIcon name="chevronRight" size={16} color={action.href ? '#8290A3' : '#C0C8D2'} />
          </Pressable>
          </MotionView>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 6 },
  card: { width: '100%', minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: colors.surface },
  cardActive: { borderColor: '#E0E7EF' },
  cardPlanned: { borderColor: '#E7EBF0', opacity: 0.65 },
  pressed: { opacity: 0.8 },
  iconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { color: colors.text, fontSize: 11.5, fontWeight: '800' },
  description: { color: colors.textMuted, fontSize: 9, lineHeight: 12, marginTop: 2 },
});
