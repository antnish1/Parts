import { useMemo } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { colors, spacing } from '@/theme/tokens';

const CLOSED = new Set(['received', 'issued', 'rejected']);

function normalize(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
}

type AttentionItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  status: string;
  href: string;
  tone: 'danger' | 'warning' | 'info';
};

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
    return {
      approvals: approvals.data?.length ?? 0,
      delayed: delayed.data?.length ?? 0,
      pendingIssue: pendingIssue.data?.length ?? 0,
      activeOrders: orderRows.filter((row) => !CLOSED.has(normalize(row.status))).length,
      creditPending: (credit.data ?? []).filter((row) => row.approval_status === 'Pending Manager Approval').length,
      tadaAttention: (tada.data ?? []).filter((row) => ['AWAITING_HQ_RECEIPT', 'PARTIALLY_RECEIVED_HQ'].includes(row.status)).length,
    };
  }, [approvals.data, credit.data, delayed.data, orders.data, pendingIssue.data, tada.data]);

  const attention = useMemo<AttentionItem[]>(() => {
    const rows: AttentionItem[] = [];

    for (const order of (approvals.data ?? []).slice(0, 4)) {
      rows.push({
        id: `approval-${order.id}`,
        title: order.final_order_no || order.order_no,
        subtitle: order.customer_name || order.machine_no || 'Customer / machine unavailable',
        meta: `${order.branch || '—'} · ${formatDate(order.created_at)}`,
        status: order.approval_status || order.status || 'Pending Approval',
        href: `/approvals/${order.id}`,
        tone: 'warning',
      });
    }

    for (const order of (delayed.data ?? []).slice(0, 2)) {
      rows.push({
        id: `vor-${order.id}`,
        title: order.final_order_no || order.order_no,
        subtitle: order.customer_name || order.machine_no || 'Delayed VOR',
        meta: `${order.branch || '—'} · ${order.age_days}d old`,
        status: 'Delayed VOR',
        href: `/orders/${order.id}`,
        tone: order.age_days > 5 ? 'danger' : 'warning',
      });
    }

    for (const order of (pendingIssue.data ?? []).slice(0, 2)) {
      rows.push({
        id: `issue-${order.id}`,
        title: order.final_order_no || order.order_no,
        subtitle: order.customer_name || order.machine_no || 'Ready to issue',
        meta: `${order.branch} · Qty ${order.total_qty}`,
        status: 'Pending Issue',
        href: '/orders/pending-issue',
        tone: 'info',
      });
    }

    return rows.slice(0, 6);
  }, [approvals.data, delayed.data, pendingIssue.data]);

  const criticalError = approvals.isError && delayed.isError && pendingIssue.isError && orders.isError;
  const busy = approvals.isLoading || delayed.isLoading || pendingIssue.isLoading || orders.isLoading;
  const today = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date());
  const firstName = profile?.fullName?.split(' ')[0] || 'Manager';

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
      <View style={styles.topbar}>
        <View style={styles.identity}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text></View>
          <View style={styles.identityCopy}>
            <Text style={styles.name}>{firstName}</Text>
            <Text numberOfLines={1} style={styles.role}>{profile?.branch || 'All Branches'} · Manager · {today}</Text>
          </View>
        </View>
        <View style={styles.activePill}><Text style={styles.activePillValue}>{busy ? '—' : stats.activeOrders}</Text><Text style={styles.activePillText}> active</Text></View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attentionStrip}>
        <AttentionChip icon="check" label="Approvals" value={stats.approvals} tone="blue" onPress={() => router.push('/approvals')} />
        <AttentionChip icon="clock" label="Delayed VOR" value={stats.delayed} tone="red" onPress={() => router.push('/orders/delayed-vor')} />
        <AttentionChip icon="inbox" label="Pending Issue" value={stats.pendingIssue} tone="amber" onPress={() => router.push('/orders/pending-issue')} />
        <AttentionChip icon="wallet" label="Credit" value={stats.creditPending} tone="green" onPress={() => router.push('/credit-dispatch')} />
        <AttentionChip icon="work" label="TA/DA" value={stats.tadaAttention} tone="blue" onPress={() => router.push('/ta-da')} />
      </ScrollView>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>My work</Text>
        <Pressable onPress={() => router.push('/(tabs)/work')}><Text style={styles.sectionLink}>All tools</Text></Pressable>
      </View>

      <View style={styles.workGrid}>
        <WorkCell icon="check" title="Approvals" onPress={() => router.push('/approvals')} />
        <WorkCell icon="inventory" title="Inventory" onPress={() => router.push('/manager')} />
        <WorkCell icon="clock" title="Delayed VOR" onPress={() => router.push('/orders/delayed-vor')} />
        <WorkCell icon="inbox" title="Pending Issue" onPress={() => router.push('/orders/pending-issue')} />
        <WorkCell icon="wallet" title="Credit Dispatch" onPress={() => router.push('/credit-dispatch')} />
        <WorkCell icon="chart" title="Reports" onPress={() => router.push('/reports')} />
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Needs attention</Text>
        {busy ? <ActivityIndicator size="small" color={colors.navy} /> : <Pressable onPress={() => router.push('/approvals')}><Text style={styles.sectionLink}>View queue</Text></Pressable>}
      </View>

      <View style={styles.attentionList}>
        {attention.map((item, index) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(item.href)}
            style={({ pressed }) => [styles.attentionRow, index === attention.length - 1 && styles.attentionRowLast, pressed && styles.pressed]}
          >
            <View style={[styles.rowAccent, item.tone === 'danger' ? styles.rowAccentDanger : item.tone === 'warning' ? styles.rowAccentWarning : styles.rowAccentInfo]} />
            <View style={styles.rowCopy}>
              <View style={styles.rowTop}>
                <Text numberOfLines={1} style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>{item.meta}</Text>
              </View>
              <View style={styles.rowBottom}>
                <Text numberOfLines={1} style={styles.rowSubtitle}>{item.subtitle}</Text>
                <StatusChip status={item.status} />
              </View>
            </View>
            <AppIcon name="chevronRight" size={15} color="#94A3B8" />
          </Pressable>
        ))}
        {!busy && attention.length === 0 ? <StateView icon="check" title="Nothing urgent right now" message="Approval and exception items will appear here." /> : null}
      </View>

      <View style={styles.quickBar}>
        <CompactAction icon="search" label="Track Orders" onPress={() => router.push('/orders')} />
        <View style={styles.quickDivider} />
        <CompactAction icon="truck" label="Docket" onPress={() => router.push('/docket')} />
        <View style={styles.quickDivider} />
        <CompactAction icon="package" label="Engine & Breaker" onPress={() => router.push('/installations')} />
      </View>
    </Screen>
  );
}

function AttentionChip({ icon, label, value, tone, onPress }: { icon: AppIconName; label: string; value: number; tone: 'blue' | 'red' | 'amber' | 'green'; onPress: () => void }) {
  const theme = {
    blue: { bg: '#EFF5FF', fg: '#2457A7', border: '#D8E5F7' },
    red: { bg: '#FFF3F3', fg: '#B43B3B', border: '#F2D4D4' },
    amber: { bg: '#FFF8EA', fg: '#98611E', border: '#F1E0B8' },
    green: { bg: '#EEF8F3', fg: '#16724F', border: '#D5EBDD' },
  }[tone];
  return (
    <Pressable onPress={onPress} style={[styles.attentionChip, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      <AppIcon name={icon} size={14} color={theme.fg} />
      <Text style={[styles.attentionValue, { color: theme.fg }]}>{value}</Text>
      <Text style={styles.attentionLabel}>{label}</Text>
    </Pressable>
  );
}

function WorkCell({ icon, title, onPress }: { icon: AppIconName; title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.workCell, pressed && styles.pressed]}>
      <View style={styles.workIcon}><AppIcon name={icon} size={16} color={colors.navy} /></View>
      <Text numberOfLines={1} style={styles.workTitle}>{title}</Text>
      <AppIcon name="chevronRight" size={14} color="#9BA7B5" />
    </Pressable>
  );
}

function CompactAction({ icon, label, onPress }: { icon: AppIconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quickAction}>
      <AppIcon name={icon} size={15} color={colors.navy} />
      <Text numberOfLines={1} style={styles.quickActionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 8, paddingBottom: 16, gap: 10 },
  topbar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  identityCopy: { flex: 1 },
  name: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  role: { color: colors.textMuted, fontSize: 9, fontWeight: '700', marginTop: 2 },
  activePill: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#EEF2F6' },
  activePillValue: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  activePillText: { color: colors.textMuted, fontSize: 8, fontWeight: '800' },

  attentionStrip: { gap: 7, paddingRight: 12 },
  attentionChip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 11, borderWidth: 1 },
  attentionValue: { fontSize: 12, fontWeight: '900' },
  attentionLabel: { color: '#46566B', fontSize: 9, fontWeight: '800' },

  sectionHead: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  sectionLink: { color: colors.blue, fontSize: 9, fontWeight: '900' },

  workGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  workCell: { width: '49%', minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 9, borderRadius: 12, borderWidth: 1, borderColor: '#E1E7EE', backgroundColor: '#fff' },
  workIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF3F8' },
  workTitle: { flex: 1, color: colors.text, fontSize: 9, fontWeight: '900' },

  attentionList: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#E1E7EE', backgroundColor: '#fff' },
  attentionRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7ECF2' },
  attentionRowLast: { borderBottomWidth: 0 },
  rowAccent: { width: 3, height: 32, borderRadius: 999 },
  rowAccentDanger: { backgroundColor: colors.danger },
  rowAccentWarning: { backgroundColor: colors.warning },
  rowAccentInfo: { backgroundColor: colors.blue },
  rowCopy: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { flex: 1, color: colors.text, fontSize: 10, fontWeight: '900' },
  rowMeta: { color: colors.textMuted, fontSize: 7.5, fontWeight: '700' },
  rowBottom: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowSubtitle: { flex: 1, color: colors.textMuted, fontSize: 8.5, fontWeight: '700' },

  quickBar: { minHeight: 46, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#E1E7EE', backgroundColor: '#fff' },
  quickAction: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 6 },
  quickActionText: { color: colors.navy, fontSize: 8.5, fontWeight: '900' },
  quickDivider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: '#DDE4EC' },
  pressed: { opacity: 0.78 },
});
