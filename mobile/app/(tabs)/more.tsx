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
  profileCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 14, borderWidth:1, borderColor:'#E1E7EE', backgroundColor: '#fff' },
  avatar: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  profileCopy: { flex: 1 },
  name: { color: colors.text, fontSize: 13, fontWeight: '900' },
  role: { color: colors.textMuted, fontSize: 9, fontWeight: '700', marginTop: 2, textTransform: 'capitalize' },
  secure: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7F7F0' },
  infoCard: { overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#E1E7EE', backgroundColor: colors.surface },
  infoRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EDF3' },
  infoRowLast: { borderBottomWidth: 0 },
  infoIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF3FA' },
  label: { width: 52, color: colors.textMuted, fontSize: 9, fontWeight: '800' },
  value: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 9, fontWeight: '900' },
  otaCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 14, backgroundColor: colors.blueSoft },
  otaIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  otaCopy: { flex: 1 },
  otaTitle: { color: colors.navy, fontSize: 10, fontWeight: '900' },
  otaText: { color: colors.navySoft, fontSize: 8.5, lineHeight: 13, marginTop: 1 },
  signOut: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: radius.md, borderWidth: 1, borderColor: '#F0B8B8', backgroundColor: colors.surface },
  pressed: { opacity: 0.8 },
  signOutText: { color: colors.danger, fontSize: 10, fontWeight: '900' },
});
