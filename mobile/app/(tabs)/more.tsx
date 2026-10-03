import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/theme/tokens';

export default function MoreScreen() {
  const { profile, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <Screen title="More" subtitle="Account and app information.">
      <View style={styles.card}>
        <Text style={styles.name}>{profile?.fullName || 'Authenticated user'}</Text>
        <View style={styles.line}><Text style={styles.label}>Role</Text><Text style={styles.value}>{profile?.role || '—'}</Text></View>
        <View style={styles.line}><Text style={styles.label}>Branch</Text><Text style={styles.value}>{profile?.branch || '—'}</Text></View>
        <View style={styles.line}><Text style={styles.label}>App</Text><Text style={styles.value}>Parts Connect Android · 0.1.0</Text></View>
      </View>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>Parallel mobile migration</Text>
        <Text style={styles.noteText}>This Android client uses the same Supabase authentication and operational data as the web portal. Web remains available during migration.</Text>
      </View>

      <Pressable onPress={() => void handleSignOut()} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  name: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: spacing.xs },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  value: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 12, fontWeight: '700' },
  note: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.blueSoft },
  noteTitle: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  noteText: { color: colors.navySoft, fontSize: 12, lineHeight: 18, marginTop: 4 },
  signOut: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surface },
  pressed: { opacity: 0.8 },
  signOutText: { color: colors.danger, fontSize: 14, fontWeight: '800' },
});
