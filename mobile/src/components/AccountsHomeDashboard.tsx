import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { getCreditDispatches } from '@/services/creditDispatch';
import { getTadaDispatches } from '@/services/tada';
import { colors } from '@/theme/tokens';

const accountsTadaStatuses = new Set(['AWAITING_ACCOUNTS_RECEIPT', 'PARTIALLY_RECEIVED_ACCOUNTS']);
const go = (path: '/credit-dispatch' | '/ta-da') => router.push(path);

export function AccountsHomeDashboard() {
  const { profile } = useAuth();
  // Queries use the authenticated session and the same RLS-protected services as the work pages.
  const credit = useQuery({ queryKey: ['accounts-home', 'credit'], queryFn: () => getCreditDispatches(1000), staleTime: 30_000 });
  const tada = useQuery({ queryKey: ['accounts-home', 'tada'], queryFn: getTadaDispatches, staleTime: 30_000 });
  const pendingCredits = (credit.data ?? []).filter(row => row.approval_status === 'Pending Accounts Approval');
  const pendingReceipts = (tada.data ?? []).filter(row => accountsTadaStatuses.has(row.status));
  const loading = credit.isLoading || tada.isLoading;
  const failed = credit.isError || tada.isError;
  const day = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date());
  const greeting = profile?.fullName?.split(' ')[0] || 'there';

  return <Screen brandHeader contentContainerStyle={styles.screen}>
    <View style={styles.greeting}>
      <Text style={styles.greetingName}>Good morning, {greeting}</Text>
      <Text style={styles.greetingMeta}>{profile?.branch || 'Unassigned'} · Accounts · {day}</Text>
    </View>

    <Text style={styles.sectionLabel}>MY OPERATIONS</Text>
    <Pressable accessibilityRole="button" onPress={() => go('/ta-da')} style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
      <View style={styles.heroIcon}><AppIcon name="work" size={23} color="#FFFFFF" /></View>
      <View style={styles.heroText}><Text style={styles.heroTitle}>TA/DA Receipts</Text><Text style={styles.heroSubtitle}>Receive eligible SVRs at Accounts</Text></View>
      <AppIcon name="chevronRight" size={19} color="#C4D9F0" />
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => go('/credit-dispatch')} style={({ pressed }) => [styles.creditCard, pressed && styles.pressed]}>
      <View style={styles.creditIcon}><AppIcon name="wallet" size={22} color="#FFFFFF" /></View>
      <View style={styles.creditText}><Text style={styles.creditTitle}>Credit Dispatch</Text><Text style={styles.creditSubtitle}>Review credit requests and payments</Text></View>
      <AppIcon name="chevronRight" size={19} color="#8192A9" />
    </Pressable>

    <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Needs attention</Text><Text style={styles.sectionHint}>ACCOUNTS WORK QUEUE</Text></View>
    <View style={styles.attentionCard}>
      {loading ? <Text style={styles.state}>Checking your pending work…</Text> : null}
      {failed ? <Pressable accessibilityRole="button" onPress={() => { void credit.refetch(); void tada.refetch(); }} style={styles.retry}><AppIcon name="refresh" size={18} color="#215DA2" /><Text style={styles.retryText}>Unable to load all notifications. Tap to retry.</Text></Pressable> : null}
      {!loading && !failed ? <>
        <Pressable accessibilityRole="button" onPress={() => go('/credit-dispatch')} style={styles.attentionRow}>
          <View style={[styles.attentionIcon, styles.creditAttentionIcon]}><AppIcon name="wallet" size={20} color="#1B745C" /></View>
          <View style={styles.attentionCopy}><Text style={styles.attentionTitle}>Credit approvals</Text><Text style={styles.attentionSubtitle}>{pendingCredits.length ? 'Awaiting your Accounts review' : 'No pending Accounts approvals'}</Text></View>
          <Text style={styles.count}>{pendingCredits.length}</Text><AppIcon name="chevronRight" size={17} color="#94A3B8" />
        </Pressable>
        <View style={styles.divider} />
        <Pressable accessibilityRole="button" onPress={() => go('/ta-da')} style={styles.attentionRow}>
          <View style={[styles.attentionIcon, styles.tadaAttentionIcon]}><AppIcon name="inbox" size={20} color="#1D5EB1" /></View>
          <View style={styles.attentionCopy}><Text style={styles.attentionTitle}>TA/DA receipts</Text><Text style={styles.attentionSubtitle}>{pendingReceipts.length ? 'Dispatches awaiting Accounts receipt' : 'No receipts awaiting Accounts'}</Text></View>
          <Text style={styles.count}>{pendingReceipts.length}</Text><AppIcon name="chevronRight" size={17} color="#94A3B8" />
        </Pressable>
      </> : null}
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { paddingTop: 4, paddingBottom: 16, gap: 12 },
  greeting: { paddingVertical: 8 },
  greetingName: { fontSize: 19, color: '#10233E', fontWeight: '900' },
  greetingMeta: { marginTop: 4, color: '#667085', fontSize: 10, fontWeight: '700' },
  sectionLabel: { color: '#65758B', fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginTop: 6 },
  hero: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy, padding: 14, minHeight: 76, borderRadius: 16, gap: 13 },
  heroIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2B5685' },
  heroText: { flex: 1 }, heroTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' }, heroSubtitle: { marginTop: 4, color: '#CBDDF0', fontSize: 11 },
  creditCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DCE5EE', borderWidth: 1, padding: 14, minHeight: 76, borderRadius: 16, gap: 13 },
  creditIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#168761' },
  creditText: { flex: 1 }, creditTitle: { color: '#14253E', fontSize: 16, fontWeight: '900' }, creditSubtitle: { color: '#6B788E', marginTop: 4, fontSize: 11 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  sectionTitle: { color: '#13233A', fontSize: 15, fontWeight: '900' },
  sectionHint: { color: '#8492A5', fontSize: 9, fontWeight: '800' },
  attentionCard: { borderWidth: 1, borderColor: '#E0E7EF', backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', minHeight: 80 },
  attentionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 15, minHeight: 79, gap: 11 },
  attentionIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  creditAttentionIcon: { backgroundColor: '#E8F6EF' }, tadaAttentionIcon: { backgroundColor: '#ECF3FE' },
  attentionCopy: { flex: 1 }, attentionTitle: { fontSize: 13, fontWeight: '900', color: '#1A2B41' },
  attentionSubtitle: { color: '#738298', fontSize: 10, marginTop: 3 },
  count: { fontSize: 17, color: '#173F7A', fontWeight: '900', marginRight: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E0E7EF', marginLeft: 66 },
  state: { padding: 20, color: '#65758B', fontSize: 12 },
  retry: { padding: 17, flexDirection: 'row', alignItems: 'center', gap: 8 },
  retryText: { color: '#215DA2', fontSize: 11, fontWeight: '800', flex: 1 },
  pressed: { opacity: 0.8 },
});
