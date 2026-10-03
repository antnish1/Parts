import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { roleWorkActions } from '@/auth/roleNavigation';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/theme/tokens';

export default function WorkScreen() {
  const { role } = useAuth();
  const actions = role ? roleWorkActions[role] : [];

  return (
    <Screen title="Work" subtitle="Your operational tasks, arranged for mobile.">
      {actions.map((action) => (
        <Pressable
          key={action.key}
          disabled={!action.href}
          onPress={() => action.href && router.push(action.href)}
          style={({ pressed }) => [styles.card, action.href ? styles.cardActive : styles.cardPlanned, pressed && action.href && styles.pressed]}
        >
          <View style={styles.copy}>
            <Text style={styles.title}>{action.label}</Text>
            <Text style={styles.description}>{action.description}</Text>
          </View>
          <Text style={[styles.trailing, !action.href && styles.plannedText]}>{action.href ? 'Open' : 'Next'}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, backgroundColor: colors.surface },
  cardActive: { borderColor: colors.border },
  cardPlanned: { borderColor: '#E7EBF0', opacity: 0.7 },
  pressed: { opacity: 0.8 },
  copy: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800' },
  description: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  trailing: { color: colors.blue, fontSize: 12, fontWeight: '800' },
  plannedText: { color: colors.textMuted },
});
