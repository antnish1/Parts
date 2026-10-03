import { useMemo } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { formatDate, getVisibleOrders } from '@/services/orders';
import { colors, radius, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const { profile } = useAuth();
  const orders = useQuery({ queryKey: ['orders', 'home'], queryFn: () => getVisibleOrders(120) });

  const metrics = useMemo(() => {
    const rows = orders.data ?? [];
    const pending = rows.filter((row) => (row.approval_status ?? '').toLowerCase().includes('pending')).length;
    const pendingManager = rows.filter((row) => (row.approval_status ?? '').toLowerCase().includes('manager')).length;
    const pendingIssue = rows.filter((row) => !['received', 'issued', 'rejected'].includes((row.status ?? '').toLowerCase())).length;
    return { visible: rows.length, pending, pendingManager, pendingIssue };
  }, [orders.data]);

  return (
    <Screen title={`Hello${profile?.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}`} subtitle={`${profile?.branch ?? 'Unassigned'} · ${profile?.role ?? 'user'}`}>
      <Text style={styles.sectionTitle}>Needs attention</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metrics}>
        <MetricCard label="Visible orders" value={metrics.visible} onPress={() => router.push('/orders')} />
        {profile?.role === 'manager' ? <MetricCard label="Manager approval" value={metrics.pendingManager} /> : <MetricCard label="Pending approval" value={metrics.pending} />}
        <MetricCard label="Open workflow" value={metrics.pendingIssue} />
      </ScrollView>

      <View style={styles.quickRow}>
        <Pressable style={styles.primaryAction} onPress={() => router.push('/orders')}>
          <Text style={styles.primaryActionTitle}>Track Orders</Text>
          <Text style={styles.primaryActionText}>Search, filter and open order details</Text>
        </Pressable>
        <Pressable style={styles.secondaryAction} onPress={() => router.push('/(tabs)/work')}>
          <Text style={styles.secondaryTitle}>My work</Text>
          <Text style={styles.secondaryText}>Role-specific tasks</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent orders</Text>
        <Pressable onPress={() => router.push('/orders')}><Text style={styles.link}>View all</Text></Pressable>
      </View>
      {(orders.data ?? []).slice(0, 5).map((order) => (
        <Pressable key={order.id} style={styles.orderCard} onPress={() => router.push(`/orders/${order.id}`)}>
          <View style={styles.orderTop}>
            <View style={styles.orderCopy}>
              <Text style={styles.orderNo}>{order.order_no}</Text>
              <Text numberOfLines={1} style={styles.customer}>{order.customer_name || order.machine_no || 'No customer/machine'}</Text>
            </View>
            <StatusChip status={order.status || order.approval_status} />
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{order.branch || '—'}</Text>
            <Text style={styles.meta}>{formatDate(order.created_at)}</Text>
          </View>
        </Pressable>
      ))}
      {orders.isError ? <Text style={styles.error}>Could not load orders. Pull-to-refresh support is available in Track Orders.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  metrics: { gap: spacing.sm, paddingRight: spacing.lg },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  primaryAction: { flex: 1.4, minHeight: 96, justifyContent: 'flex-end', padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.navy },
  primaryActionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  primaryActionText: { color: '#D6E7FF', fontSize: 11, marginTop: 4 },
  secondaryAction: { flex: 1, minHeight: 96, justifyContent: 'flex-end', padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  secondaryTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  secondaryText: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  link: { color: colors.blue, fontSize: 12, fontWeight: '800' },
  orderCard: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  orderCopy: { flex: 1 },
  orderNo: { color: colors.text, fontSize: 14, fontWeight: '900' },
  customer: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  meta: { color: colors.textMuted, fontSize: 11 },
  error: { color: colors.danger, fontSize: 12 },
});
