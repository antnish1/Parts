import { useMemo } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { getApprovalQueue } from '@/services/approvals';
import { getCreditDispatches } from '@/services/creditDispatch';
import { getAllVisibleOrders, formatDate } from '@/services/orders';
import { getDelayedVorOrders, getPendingIssueOrders } from '@/services/operations';
import { getTadaDispatches } from '@/services/tada';
import { colors, radius, spacing } from '@/theme/tokens';

const CLOSED = new Set(['received', 'issued', 'rejected']);

function normalize(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
}

export function ManagerHomeDashboard() {
  const { profile } = useAuth();

  const approvals = useQuery({ queryKey: ['manager-home', 'approvals'], queryFn: () => getApprovalQueue(80), staleTime: 30_000 });
  const delayed = useQuery({ queryKey: ['manager-home', 'delayed-vor'], queryFn: getDelayedVorOrders, staleTime: 45_000 });
  const pendingIssue = useQuery({ queryKey: ['manager-home', 'pending-issue'], queryFn: getPendingIssueOrders, staleTime: 45_000 });
  const orders = useQuery({ queryKey: ['manager-home', 'orders'], queryFn: getAllVisibleOrders, staleTime: 30_000 });
  const credit = useQuery({ queryKey: ['manager-home', 'credit'], queryFn: () => getCreditDispatches(500), staleTime: 45_000 });
  const tada = useQuery({ queryKey: ['manager-home', 'tada'], queryFn: getTadaDispatches, staleTime: 45_000 });

  const stats = useMemo(() => {
    const orderRows = orders.data ?? [];
    const activeOrders = orderRows.filter((row) => !CLOSED.has(normalize(row.status))).length;
    const creditPending = (credit.data ?? []).filter((row) => row.approval_status === 'Pending Manager Approval').length;
    const tadaAttention = (tada.data ?? []).filter((row) => ['AWAITING_HQ_RECEIPT', 'PARTIALLY_RECEIVED_HQ'].includes(row.status)).length;
    return {
      approvals: approvals.data?.length ?? 0,
      delayed: delayed.data?.length ?? 0,
      pendingIssue: pendingIssue.data?.length ?? 0,
      activeOrders,
      creditPending,
      tadaAttention,
    };
  }, [approvals.data, credit.data, delayed.data, orders.data, pendingIssue.data, tada.data]);

  const branchPulse = useMemo(() => {
    const counts = new Map<string, number>();
    const add = (branch: string | null | undefined) => {
      const key = String(branch || 'Unassigned').trim() || 'Unassigned';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };
    (approvals.data ?? []).forEach((row) => add(row.branch));
    (delayed.data ?? []).forEach((row) => add(row.branch));
    (pendingIssue.data ?? []).forEach((row) => add(row.branch));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [approvals.data, delayed.data, pendingIssue.data]);

  const isInitialLoading = approvals.isLoading && delayed.isLoading && pendingIssue.isLoading && orders.isLoading;
  const criticalError = approvals.isError && delayed.isError && pendingIssue.isError && orders.isError;
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date());

  if (criticalError) {
    return (
      <Screen>
        <StateView
          icon="alert"
          tone="error"
          title="Manager dashboard could not be loaded"
          message="The operational data requests failed. Check your network and try again."
          actionLabel="Retry"
          onAction={() => {
            void approvals.refetch();
            void delayed.refetch();
            void pendingIssue.refetch();
            void orders.refetch();
            void credit.refetch();
            void tada.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroAccentOne} />
        <View style={styles.heroAccentTwo} />
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <AppIcon name="shield" size={21} color="#FFFFFF" strokeWidth={2.1} />
          </View>
          <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>MANAGER</Text></View>
        </View>
        <Text style={styles.greeting}>Hello, {profile?.fullName?.split(' ')[0]?.toUpperCase() || 'MANAGER'}</Text>
        <Text style={styles.heroSubtitle}>{profile?.branch || 'All Branches'} · {today}</Text>
        <View style={styles.heroDivider} />
        <View style={styles.heroFoot}>
          <View>
            <Text style={styles.heroFootLabel}>ACTIVE ORDERS</Text>
            <Text style={styles.heroFootValue}>{orders.isLoading ? '—' : stats.activeOrders}</Text>
          </View>
          <Pressable onPress={() => router.push('/orders')} style={styles.heroTrack}>
            <Text style={styles.heroTrackText}>Track orders</Text>
            <AppIcon name="chevronRight" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.kicker}>TODAY'S PRIORITIES</Text>
          <Text style={styles.sectionTitle}>What needs your attention</Text>
        </View>
        {isInitialLoading ? <ActivityIndicator color={colors.navy} /> : null}
      </View>

      <View style={styles.priorityGrid}>
        <PriorityCard icon="check" label="Approvals" value={approvals.isLoading ? '—' : stats.approvals} hint="Manager queue" tone="blue" onPress={() => router.push('/approvals')} />
        <PriorityCard icon="clock" label="Delayed VOR" value={delayed.isLoading ? '—' : stats.delayed} hint="Aging orders" tone="red" onPress={() => router.push('/orders/delayed-vor')} />
        <PriorityCard icon="inbox" label="Pending Issue" value={pendingIssue.isLoading ? '—' : stats.pendingIssue} hint="Ready to issue" tone="amber" onPress={() => router.push('/orders/pending-issue')} />
        <PriorityCard icon="wallet" label="Credit Approval" value={credit.isLoading ? '—' : stats.creditPending} hint="Manager stage" tone="green" onPress={() => router.push('/credit-dispatch')} />
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.kicker}>MANAGER WORKBENCH</Text>
          <Text style={styles.sectionTitle}>Quick actions</Text>
        </View>
      </View>

      <View style={styles.quickGrid}>
        <QuickAction icon="check" title="Approvals" subtitle="Review & decide" onPress={() => router.push('/approvals')} />
        <QuickAction icon="inventory" title="Inventory" subtitle="Position & movement" onPress={() => router.push('/manager')} />
        <QuickAction icon="clock" title="Delayed VOR" subtitle="Ageing exceptions" onPress={() => router.push('/orders/delayed-vor')} />
        <QuickAction icon="wallet" title="Credit Dispatch" subtitle="Approvals & recovery" onPress={() => router.push('/credit-dispatch')} />
        <QuickAction icon="work" title="TA/DA" subtitle={tada.isLoading ? 'HQ receipts' : `${stats.tadaAttention} need attention`} onPress={() => router.push('/ta-da')} />
        <QuickAction icon="chart" title="Reports" subtitle="Operational view" onPress={() => router.push('/reports')} />
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.kicker}>BRANCH PULSE</Text>
          <Text style={styles.sectionTitle}>Where attention is concentrated</Text>
        </View>
      </View>

      <View style={styles.pulseCard}>
        {branchPulse.length ? branchPulse.map(([branch, count], index) => {
          const max = branchPulse[0]?.[1] || 1;
          const width = Math.max(14, Math.round((count / max) * 100));
          return (
            <View key={branch} style={[styles.pulseRow, index === branchPulse.length - 1 && styles.pulseRowLast]}>
              <View style={styles.pulseCopy}>
                <Text style={styles.pulseBranch}>{branch}</Text>
                <Text style={styles.pulseCount}>{count} attention item{count === 1 ? '' : 's'}</Text>
              </View>
              <View style={styles.pulseTrack}><View style={[styles.pulseFill, { width: `${width}%` }]} /></View>
            </View>
          );
        }) : <Text style={styles.emptyText}>No branch-level attention items right now.</Text>}
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.kicker}>APPROVAL QUEUE</Text>
          <Text style={styles.sectionTitle}>Waiting for your decision</Text>
        </View>
        <Pressable onPress={() => router.push('/approvals')}><Text style={styles.viewAll}>View all</Text></Pressable>
      </View>

      <View style={styles.approvalList}>
        {(approvals.data ?? []).slice(0, 4).map((order, index) => (
          <Pressable key={order.id} onPress={() => router.push(`/approvals/${order.id}`)} style={[styles.approvalRow, index === Math.min((approvals.data ?? []).length, 4) - 1 && styles.approvalRowLast]}>
            <View style={styles.approvalMarker}><Text style={styles.approvalMarkerText}>{String(index + 1).padStart(2, '0')}</Text></View>
            <View style={styles.approvalCopy}>
              <Text numberOfLines={1} style={styles.approvalNo}>{order.final_order_no || order.order_no}</Text>
              <Text numberOfLines={1} style={styles.approvalCustomer}>{order.customer_name || order.machine_no || 'Customer / machine unavailable'}</Text>
              <Text style={styles.approvalMeta}>{order.branch || '—'} · {formatDate(order.created_at)}</Text>
            </View>
            <View style={styles.approvalRight}>
              <StatusChip status={order.approval_status || order.status} />
              <AppIcon name="chevronRight" size={17} color={colors.textMuted} />
            </View>
          </Pressable>
        ))}
        {!approvals.isLoading && !(approvals.data ?? []).length ? <StateView icon="check" title="Manager queue is clear" message="No orders are currently waiting for your approval." /> : null}
      </View>

      <Pressable onPress={() => router.push('/(tabs)/work')} style={styles.allWork}>
        <View style={styles.allWorkIcon}><AppIcon name="grid" size={19} color={colors.navy} /></View>
        <View style={styles.allWorkCopy}>
          <Text style={styles.allWorkTitle}>Open all manager tools</Text>
          <Text style={styles.allWorkText}>Orders, Docket, Part Location, Engine & Breaker, TA/DA and more</Text>
        </View>
        <AppIcon name="chevronRight" size={18} color={colors.navy} />
      </Pressable>
    </Screen>
  );
}

function PriorityCard({ icon, label, value, hint, tone, onPress }: { icon: AppIconName; label: string; value: number | string; hint: string; tone: 'blue' | 'red' | 'amber' | 'green'; onPress: () => void }) {
  const theme = {
    blue: { bg: '#EFF5FF', icon: '#2457A7', ring: '#D5E4FF' },
    red: { bg: '#FFF1F1', icon: '#B83B3B', ring: '#F8D8D8' },
    amber: { bg: '#FFF6E8', icon: '#A95D10', ring: '#F6E1BC' },
    green: { bg: '#ECF8F2', icon: '#117A53', ring: '#D2EDDF' },
  }[tone];

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.priorityCard, { backgroundColor: theme.bg, borderColor: theme.ring }, pressed && styles.pressed]}>
      <View style={[styles.priorityIcon, { backgroundColor: '#FFFFFF' }]}><AppIcon name={icon} size={19} color={theme.icon} /></View>
      <Text style={styles.priorityValue}>{value}</Text>
      <Text style={styles.priorityLabel}>{label}</Text>
      <Text style={styles.priorityHint}>{hint}</Text>
    </Pressable>
  );
}

function QuickAction({ icon, title, subtitle, onPress }: { icon: AppIconName; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
      <View style={styles.quickIcon}><AppIcon name={icon} size={18} color={colors.navy} /></View>
      <View style={styles.quickCopy}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.quickSubtitle}>{subtitle}</Text>
      </View>
      <AppIcon name="chevronRight" size={15} color="#94A3B8" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.md, paddingBottom: 30, gap: spacing.lg },
  hero: { minHeight: 218, overflow: 'hidden', padding: spacing.xl, borderRadius: 28, backgroundColor: '#0B1F3A' },
  heroAccentOne: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -62, top: -72, backgroundColor: '#123E70' },
  heroAccentTwo: { position: 'absolute', width: 120, height: 120, borderRadius: 60, right: 28, bottom: -72, backgroundColor: '#16385F' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,.18)' },
  heroBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.12)' },
  heroBadgeText: { color: '#DDEBFA', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  greeting: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', letterSpacing: -0.6, marginTop: 24 },
  heroSubtitle: { color: '#B9CCE3', fontSize: 12, fontWeight: '700', marginTop: 5 },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,.18)', marginVertical: 18 },
  heroFoot: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  heroFootLabel: { color: '#8EAAC7', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  heroFootValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 2 },
  heroTrack: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.12)' },
  heroTrackText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },

  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  kicker: { color: '#6B7E95', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: '#102033', fontSize: 16, fontWeight: '900', marginTop: 3 },
  viewAll: { color: colors.blue, fontSize: 11, fontWeight: '900' },

  priorityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  priorityCard: { width: '48%', minHeight: 146, padding: spacing.md, borderRadius: 20, borderWidth: 1 },
  priorityIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  priorityValue: { color: '#102033', fontSize: 28, fontWeight: '900', marginTop: 12 },
  priorityLabel: { color: '#23344A', fontSize: 11, fontWeight: '900', marginTop: 2 },
  priorityHint: { color: '#758397', fontSize: 9, fontWeight: '700', marginTop: 2 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickCard: { width: '48%', minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: '#E1E7EE', backgroundColor: '#FFFFFF' },
  quickIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF3FA' },
  quickCopy: { flex: 1 },
  quickTitle: { color: '#142033', fontSize: 11, fontWeight: '900' },
  quickSubtitle: { color: '#748196', fontSize: 8, fontWeight: '700', marginTop: 2 },

  pulseCard: { paddingHorizontal: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: '#E1E7EE', backgroundColor: '#FFFFFF' },
  pulseRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EDF3' },
  pulseRowLast: { borderBottomWidth: 0 },
  pulseCopy: { width: 112 },
  pulseBranch: { color: '#142033', fontSize: 10, fontWeight: '900' },
  pulseCount: { color: '#7A8798', fontSize: 8, fontWeight: '700', marginTop: 2 },
  pulseTrack: { flex: 1, height: 7, overflow: 'hidden', borderRadius: 999, backgroundColor: '#EEF2F6' },
  pulseFill: { height: '100%', borderRadius: 999, backgroundColor: '#1E5AA8' },
  emptyText: { color: colors.textMuted, fontSize: 10, textAlign: 'center', paddingVertical: spacing.xl },

  approvalList: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: '#E1E7EE', backgroundColor: '#FFFFFF' },
  approvalRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EDF3' },
  approvalRowLast: { borderBottomWidth: 0 },
  approvalMarker: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FB' },
  approvalMarkerText: { color: '#456789', fontSize: 9, fontWeight: '900' },
  approvalCopy: { flex: 1 },
  approvalNo: { color: '#142033', fontSize: 11, fontWeight: '900' },
  approvalCustomer: { color: '#68768A', fontSize: 9, fontWeight: '700', marginTop: 3 },
  approvalMeta: { color: '#8895A6', fontSize: 8, marginTop: 4 },
  approvalRight: { maxWidth: 118, alignItems: 'flex-end', gap: 8 },

  allWork: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 20, backgroundColor: '#EAF2FF' },
  allWorkIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  allWorkCopy: { flex: 1 },
  allWorkTitle: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  allWorkText: { color: '#536A85', fontSize: 8, lineHeight: 13, marginTop: 2 },
  pressed: { opacity: .82 },
});
