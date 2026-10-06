import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/theme/tokens';

export default function MoreScreen() {
  const { profile, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <Screen title="More" subtitle="Profile, app information and session controls.">
      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(profile?.fullName || 'U').trim().charAt(0).toUpperCase()}</Text></View>
        <View style={styles.profileCopy}>
          <Text style={styles.name}>{profile?.fullName || 'Authenticated user'}</Text>
          <Text style={styles.role}>{profile?.role || 'User'} · {profile?.branch || 'Unassigned'}</Text>
        </View>
        <View style={styles.secure}><AppIcon name="shield" size={16} color={colors.success} /></View>
      </View>

      <View style={styles.infoCard}>
        <Info icon="work" label="Role" value={profile?.role || '—'} />
        <Info icon="inventory" label="Branch" value={profile?.branch || '—'} />
        <Info icon="package" label="App" value="Parts Connect Android" />
        <Info icon="refresh" label="Runtime" value="0.2.0 · OTA enabled" last />
      </View>

      <View style={styles.otaCard}>
        <View style={styles.otaIcon}><AppIcon name="refresh" size={18} color={colors.navy} /></View>
        <View style={styles.otaCopy}>
          <Text style={styles.otaTitle}>OTA-first updates</Text>
          <Text style={styles.otaText}>Most UI and workflow improvements now arrive automatically without reinstalling the app.</Text>
        </View>
      </View>

      <Pressable onPress={() => void handleSignOut()} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
        <AppIcon name="x" size={16} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out securely</Text>
      </Pressable>
    </Screen>
  );
}

function Info({ icon, label, value, last = false }: { icon: 'work' | 'inventory' | 'package' | 'refresh'; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <View style={styles.infoIcon}><AppIcon name={icon} size={16} color={colors.navy} /></View>
      <Text style={styles.label}>{label}</Text>
      <Text numberOfLines={1} style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: 22, backgroundColor: colors.navy },
  avatar: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  avatarText: { color: colors.navy, fontSize: 20, fontWeight: '900' },
  profileCopy: { flex: 1 },
  name: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  role: { color: '#BDD0E5', fontSize: 10, fontWeight: '700', marginTop: 4, textTransform: 'capitalize' },
  secure: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7F7F0' },
  infoCard: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: '#E1E7EE', backgroundColor: colors.surface },
  infoRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EDF3' },
  infoRowLast: { borderBottomWidth: 0 },
  infoIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF3FA' },
  label: { width: 58, color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  value: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 10, fontWeight: '900' },
  otaCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg, borderRadius: 20, backgroundColor: colors.blueSoft },
  otaIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  otaCopy: { flex: 1 },
  otaTitle: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  otaText: { color: colors.navySoft, fontSize: 10, lineHeight: 16, marginTop: 3 },
  signOut: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: '#F0B8B8', backgroundColor: colors.surface },
  pressed: { opacity: 0.8 },
  signOutText: { color: colors.danger, fontSize: 12, fontWeight: '900' },
});
