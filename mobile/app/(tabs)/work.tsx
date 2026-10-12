import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { roleWorkActions, type WorkAction } from '@/auth/roleNavigation';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/theme/tokens';

function iconFor(action: WorkAction): AppIconName {
  if (action.key.includes('approval')) return 'check';
  if (action.key.includes('track')) return 'search';
  if (action.key.includes('pending')) return 'inbox';
  if (action.key.includes('vor')) return 'clock';
  if (action.key.includes('docket')) return 'truck';
  if (action.key.includes('part-location')) return 'inventory';
  if (action.key.includes('credit')) return 'wallet';
  if (action.key.includes('tada')) return 'work';
  if (action.key.includes('installations')) return 'package';
  if (action.key.includes('reports')) return 'chart';
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
    <Screen title={role === 'manager' ? 'Manager Workbench' : 'Work'} subtitle={role === 'manager' ? 'Operational tools arranged around the decisions you make most often.' : 'Your operational tasks, arranged for mobile.'}>
      <View style={styles.grid}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            disabled={!action.href}
            onPress={() => action.href && router.push(action.href)}
            style={({ pressed }) => [styles.card, action.href ? styles.cardActive : styles.cardPlanned, pressed && action.href && styles.pressed]}
          >
            <View style={styles.iconWrap}><AppIcon name={iconFor(action)} size={19} color={colors.navy} /></View>
            <View style={styles.copy}>
              <Text style={styles.title}>{action.label}</Text>
              <Text numberOfLines={2} style={styles.description}>{action.description}</Text>
            </View>
            <AppIcon name="chevronRight" size={16} color={action.href ? '#8290A3' : '#C0C8D2'} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  card: { width: '49%', minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 12, borderWidth: 1, backgroundColor: colors.surface },
  cardActive: { borderColor: '#E0E7EF' },
  cardPlanned: { borderColor: '#E7EBF0', opacity: 0.65 },
  pressed: { opacity: 0.8 },
  iconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF3FA' },
  copy: { flex: 1 },
  title: { color: colors.text, fontSize: 9.5, fontWeight: '900' },
  description: { color: colors.textMuted, fontSize: 8, lineHeight: 11, marginTop: 1 },
});
