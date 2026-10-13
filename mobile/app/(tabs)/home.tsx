import { useMemo } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { ManagerHomeDashboard } from '@/components/ManagerHomeDashboard';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { roleWorkActions } from '@/auth/roleNavigation';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { formatDate, getVisibleOrders } from '@/services/orders';
import { colors, radius, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const { profile, role } = useAuth();
  const orders = useQuery({ queryKey: ['orders', 'home'], queryFn: () => getVisibleOrders(120), enabled: role !== 'accounts' });

  const metrics = useMemo(() => {
    const rows = orders.data ?? [];
    const pending = rows.filter((row) => (row.approval_status ?? '').toLowerCase().includes('pending')).length;
    const pendingManager = rows.filter((row) => (row.approval_status ?? '').toLowerCase().includes('manager')).length;
    const pendingIssue = rows.filter((row) => !['received', 'issued', 'rejected'].includes((row.status ?? '').toLowerCase())).length;
    return { visible: rows.length, pending, pendingManager, pendingIssue };
  }, [orders.data]);

  if (role === 'manager') return <ManagerHomeDashboard />;

  if (role === 'accounts') {
    return (
      <Screen brandHeader title={`Hello${profile?.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}`} subtitle={`${profile?.branch ?? 'Accounts'} · accounts`}>
        <Text style={styles.sectionTitle}>Accounts work</Text>
        <Pressable style={styles.primaryAction} onPress={() => router.push('/ta-da')}>
          <Text style={styles.primaryActionTitle}>TA/DA Receipts</Text>
          <Text style={styles.primaryActionText}>Receive eligible SVRs at Accounts and review custody history.</Text>
        </Pressable>
        <Pressable style={styles.accountAction} onPress={() => router.push('/credit-dispatch')}>
          <Text style={styles.accountActionTitle}>Credit Dispatch</Text>
          <Text style={styles.accountActionText}>Review Accounts-stage credit requests and monitor recovery status.</Text>
        </Pressable>
        <View style={styles.accountNote}>
          <Text style={styles.accountNoteText}>Accounts access is intentionally limited to TA/DA and Credit Dispatch workflows.</Text>
        </View>
      </Screen>
    );
  }

  const allowed = role ? roleWorkActions[role] : [];
  const quickActions: Array<{ key: string; label: string; icon: AppIconName }> = [
    { key: 'new-order', label: 'New Order', icon: 'package' },
    { key: 'approval-queue', label: 'Approvals', icon: 'check' },
    { key: 'credit', label: 'Credit Dispatch', icon: 'wallet' },
    { key: 'part-location', label: 'Find Parts', icon: 'search' },
  ];
  const shortcuts = quickActions.flatMap((item) => {
    const action = allowed.find((candidate) => candidate.key === item.key && candidate.href);
    return action?.href ? [{ ...item, href: action.href }] : [];
  }).slice(0, 4);
  const firstName = profile?.fullName?.split(' ')[0] || 'there';

  return (
    <Screen brandHeader contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.greetingLabel}>Welcome back</Text>
        <Text style={styles.greeting}>Hello, {firstName}</Text>
        <Text numberOfLines={1} style={styles.heroMeta}>{profile?.branch ?? 'Unassigned'} · {profile?.role ?? 'user'}</Text>
        <View style={styles.summaryBox}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryLabel}>Operations overview</Text>
            <AppIcon name="chart" color="#BBD3EF" size={17} />
          </View>
          <View style={styles.metricRow}>
            <Pressable onPress={() => router.push('/orders')} style={styles.metric}>
              <Text style={styles.metricValue}>{orders.isLoading ? '—' : metrics.visible}</Text>
              <Text style={styles.metricLabel}>Visible orders</Text>
            </Pressable>
            <View style={styles.metricDivider} />
            <Pressable onPress={() => router.push('/approvals')} disabled={!allowed.some((item) => item.key === 'approval-queue')} style={styles.metric}>
              <Text style={styles.metricValue}>{orders.isLoading ? '—' : metrics.pending}</Text>
              <Text style={styles.metricLabel}>Approvals</Text>
            </Pressable>
            <View style={styles.metricDivider} />
            <Pressable onPress={() => router.push('/orders')} style={styles.metric}>
              <Text style={styles.metricValue}>{orders.isLoading ? '—' : metrics.pendingIssue}</Text>
              <Text style={styles.metricLabel}>Open workflow</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Track Orders, search and filter all visible orders" onPress={() => router.push('/orders')} style={({ pressed }) => [styles.trackCard, pressed && styles.pressed]}>
        <View style={styles.trackIcon}><AppIcon name="search" size={23} color="#FFFFFF" /></View>
        <View style={styles.trackCopy}>
          <Text style={styles.trackTitle}>Track Orders</Text>
          <Text style={styles.trackSubtitle}>Search orders, filter status and view details</Text>
          <View style={styles.trackSearch}><AppIcon name="search" size={14} color="#8DA8C6" /><Text style={styles.trackPlaceholder}>Search by order number</Text></View>
        </View>
        <AppIcon name="chevronRight" size={18} color="#A8C9F0" />
      </Pressable>

      {shortcuts.length ? (
        <>
          <View style={styles.headingRow}><Text style={styles.sectionTitle}>Quick actions</Text><Pressable onPress={() => router.push('/(tabs)/work')}><Text style={styles.link}>All tools ›</Text></Pressable></View>
          <View style={styles.shortcuts}>
            {shortcuts.map((item) => (
              <Pressable key={item.key} style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]} onPress={() => router.push(item.href)}>
                <View style={styles.shortcutIcon}><AppIcon name={item.icon} size={20} color={colors.navySoft} /></View>
                <Text numberOfLines={2} style={styles.shortcutLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.headingRow}><Text style={styles.sectionTitle}>Recent orders</Text><Pressable onPress={() => router.push('/orders')}><Text style={styles.link}>View all ›</Text></Pressable></View>
      <View style={styles.orderList}>
        {(orders.data ?? []).slice(0, 5).map((order, index) => (
          <Pressable key={order.id} style={({ pressed }) => [styles.orderRow, index === Math.min((orders.data ?? []).length, 5) - 1 && styles.lastRow, pressed && styles.pressed]} onPress={() => router.push(`/orders/${order.id}`)}>
            <View style={styles.orderCopy}>
              <Text numberOfLines={1} style={styles.orderNo}>{order.final_order_no || order.order_no}</Text>
              <Text numberOfLines={1} style={styles.customer}>{order.customer_name || order.machine_no || 'No customer/machine'}</Text>
              <Text numberOfLines={1} style={styles.meta}>{order.branch || '—'} · {formatDate(order.created_at)}</Text>
            </View>
            <View style={styles.orderRight}><StatusChip status={order.approval_status || order.status} /><AppIcon name="chevronRight" size={14} color="#95A5B8" /></View>
          </Pressable>
        ))}
        {orders.isLoading ? <Text style={styles.empty}>Loading recent orders…</Text> : null}
        {!orders.isLoading && !orders.isError && !orders.data?.length ? <Text style={styles.empty}>No recent orders found.</Text> : null}
        {orders.isError ? <Pressable onPress={() => void orders.refetch()}><Text style={styles.error}>Could not load orders. Tap to retry.</Text></Pressable> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: 9, paddingTop: 0, paddingBottom: 16 },
  hero: { backgroundColor: colors.navy, borderRadius: 14, padding: 12, gap: 3 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 9 },
  brandMark: { width: 35, height: 35, backgroundColor: '#FFFFFF', borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  brandText: { flex: 1 },
  brandTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  brandCaption: { color: '#AFC7E4', fontWeight: '800', fontSize: 8, letterSpacing: 1 },
  avatar: { backgroundColor: '#315476', borderRadius: 18, width: 35, height: 35, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  greetingLabel: { color: '#B7CBE4', fontSize: 11 },
  greeting: { color: '#FFFFFF', fontWeight: '900', fontSize: 22, letterSpacing: -0.4 },
  heroMeta: { color: '#B7CBE4', fontSize: 10, marginBottom: 6 },
  summaryBox: { backgroundColor: '#233F60', borderRadius: 14, padding: 11 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryLabel: { color: '#D6E5F7', fontSize: 11, fontWeight: '800' },
  metricRow: { flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, gap: 4, minWidth: 0 },
  metricValue: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  metricLabel: { color: '#C6D7EA', fontSize: 9, fontWeight: '700' },
  metricDivider: { width: 1, height: 29, backgroundColor: '#54708D', marginHorizontal: 8 },
  trackCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#102C4F', borderRadius: 17, padding: 11 },
  trackIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#2A527E', alignItems: 'center', justifyContent: 'center' },
  trackCopy: { flex: 1, gap: 5 },
  trackTitle: { fontSize: 17, color: '#FFFFFF', fontWeight: '900' },
  trackSubtitle: { fontSize: 10, color: '#D0E0F2', lineHeight: 15 },
  trackSearch: { marginTop: 4, borderRadius: 9, backgroundColor: '#1F4068', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, minHeight: 33 },
  trackPlaceholder: { color: '#BFD2E8', fontSize: 10 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: colors.text },
  link: { color: colors.blue, fontSize: 11, fontWeight: '800' },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  shortcut: { flexGrow: 1, flexBasis: '22%', alignItems: 'center', minWidth: 70, paddingVertical: 10, paddingHorizontal: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 13, gap: 6 },
  shortcutIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.blueSoft, justifyContent: 'center', alignItems: 'center' },
  shortcutLabel: { color: colors.text, fontWeight: '800', fontSize: 9, textAlign: 'center' },
  orderList: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  orderRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  lastRow: { borderBottomWidth: 0 },
  orderCopy: { flex: 1, gap: 4 },
  orderNo: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  customer: { color: colors.text, fontSize: 10, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 9 },
  orderRight: { alignItems: 'flex-end', justifyContent: 'space-between', maxWidth: '45%' },
  empty: { padding: 16, color: colors.textMuted, fontSize: 11 },
  error: { padding: 16, color: colors.danger, fontSize: 11 },
  primaryAction: { minHeight: 96, justifyContent: 'flex-end', padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.navy },
  primaryActionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  primaryActionText: { color: '#D6E7FF', fontSize: 11, marginTop: 4 },
  accountAction: { minHeight: 96, justifyContent: 'flex-end', padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.navy, backgroundColor: colors.surface },
  accountActionTitle: { color: colors.navy, fontSize: 16, fontWeight: '900' },
  accountActionText: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  accountNote: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.blueSoft },
  accountNoteText: { color: colors.navySoft, fontSize: 10, lineHeight: 16, fontWeight: '700' },
  pressed: { opacity: 0.83 },
});
