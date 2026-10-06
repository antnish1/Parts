import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { getApprovalQueue } from '@/services/approvals';
import { formatDate, formatMoney } from '@/services/orders';
import { colors, radius, spacing } from '@/theme/tokens';

function normalize(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export default function ApprovalQueueScreen() {
  const { role } = useAuth();
  const allowed = role === 'super' || role === 'manager' || role === 'developer';
  const [search, setSearch] = useState('');
  const queue = useQuery({ queryKey: ['mobile-approval-queue', role], queryFn: () => getApprovalQueue(), enabled: allowed });
  const rows = queue.data ?? [];

  const counts = useMemo(() => ({
    total: rows.length,
    manager: rows.filter((item) => normalize(item.approval_status).includes('pendingmanagerapproval')).length,
    approver: rows.filter((item) => normalize(item.approval_status).includes('pendingapproval') && !normalize(item.approval_status).includes('manager')).length,
  }), [rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((item) => [item.order_no, item.final_order_no, item.branch, item.customer_name, item.machine_no, item.order_type, item.approval_status]
      .some((value) => String(value ?? '').toLowerCase().includes(term)));
  }, [rows, search]);

  if (!allowed) return <View style={styles.center}><StateView icon="alert" tone="error" title="Approval Queue unavailable" message="This workspace is available only to Super, Manager and Developer roles." /></View>;

  return (
    <Screen title={role === 'manager' ? 'Manager Approvals' : 'Approval Queue'} subtitle="Review the same protected approval workflow used by the web portal" scroll={false}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshing={queue.isRefetching}
        onRefresh={() => void queue.refetch()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metrics}>
              <MetricCard label="Queue" value={counts.total} />
              <MetricCard label="Approver Stage" value={counts.approver} />
              <MetricCard label="Manager Stage" value={counts.manager} />
            </ScrollView>
            <View style={styles.search}>
              <AppIcon name="search" size={18} color={colors.textMuted} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Order, branch, customer, machine or type…" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push(`/approvals/${item.id}`)}>
            <View style={styles.top}>
              <View style={styles.copy}>
                <Text style={styles.orderNo}>{item.final_order_no || item.order_no}</Text>
                {item.final_order_no ? <Text style={styles.temp}>Temp {item.order_no}</Text> : null}
                <Text numberOfLines={1} style={styles.customer}>{item.customer_name || item.machine_no || 'No customer/machine'}</Text>
              </View>
              <StatusChip status={item.approval_status || item.status} />
            </View>
            <View style={styles.meta}>
              <Text style={styles.metaText}>{item.branch || '—'}</Text>
              <Text style={styles.metaText}>{item.order_type || '—'}</Text>
              <Text style={styles.metaText}>{formatMoney(item.total_value)}</Text>
              <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewText}>Open quantity review</Text>
              <AppIcon name="chevronRight" size={17} color={colors.blue} />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={!queue.isLoading ? (queue.isError
          ? <StateView icon="alert" tone="error" title="Approval Queue could not be loaded" message="Check your connection and retry." actionLabel="Retry" onAction={() => void queue.refetch()} />
          : <StateView icon="check" title={search ? 'No matching approvals' : 'Approval queue is clear'} message={search ? 'Try a different order, branch, customer or machine.' : 'Nothing is awaiting your approval stage.'} />) : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  header: { gap: spacing.md, marginBottom: spacing.md },
  metrics: { gap: spacing.sm, paddingRight: spacing.lg },
  search: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  searchInput: { flex: 1, minHeight: 46, color: colors.text },
  card: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pressed: { opacity: 0.8 },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  copy: { flex: 1 },
  orderNo: { color: colors.text, fontSize: 15, fontWeight: '900' },
  temp: { color: colors.textMuted, fontSize: 9, fontWeight: '700', marginTop: 2 },
  customer: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  metaText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  reviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  reviewText: { color: colors.blue, fontSize: 10, fontWeight: '900' },
});
