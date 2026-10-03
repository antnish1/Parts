import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { formatDate, formatMoney, getVisibleOrders, type OrderSummary } from '@/services/orders';
import { colors, radius, spacing } from '@/theme/tokens';

type Filter = 'all' | 'pending' | 'approved' | 'open' | 'closed';

function matchesFilter(order: OrderSummary, filter: Filter) {
  const status = `${order.status ?? ''} ${order.approval_status ?? ''}`.toLowerCase();
  if (filter === 'pending') return status.includes('pending');
  if (filter === 'approved') return status.includes('approved');
  if (filter === 'closed') return status.includes('received') || status.includes('issued') || status.includes('rejected');
  if (filter === 'open') return !matchesFilter(order, 'closed');
  return true;
}

export default function OrdersScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const orders = useQuery({ queryKey: ['orders', 'list'], queryFn: () => getVisibleOrders(500) });

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (orders.data ?? []).filter((order) => {
      if (!matchesFilter(order, filter)) return false;
      if (!needle) return true;
      return [order.order_no, order.machine_no, order.customer_name, order.branch, order.order_type, order.final_order_no, order.dbms_invoice_no]
        .some((value) => (value ?? '').toLowerCase().includes(needle));
    });
  }, [filter, orders.data, search]);

  const counts = useMemo(() => {
    const data = orders.data ?? [];
    return {
      all: data.length,
      pending: data.filter((row) => matchesFilter(row, 'pending')).length,
      open: data.filter((row) => matchesFilter(row, 'open')).length,
      closed: data.filter((row) => matchesFilter(row, 'closed')).length,
    };
  }, [orders.data]);

  function toggle(next: Filter) {
    setFilter((current) => current === next && next !== 'all' ? 'all' : next);
  }

  return (
    <Screen title="Track Orders" subtitle={`${rows.length} shown · tap any card for details`} scroll={false}>
      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={orders.isRefetching}
        onRefresh={() => void orders.refetch()}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metrics}>
              <MetricCard label="All" value={counts.all} active={filter === 'all'} onPress={() => toggle('all')} />
              <MetricCard label="Pending" value={counts.pending} active={filter === 'pending'} onPress={() => toggle('pending')} />
              <MetricCard label="Open" value={counts.open} active={filter === 'open'} onPress={() => toggle('open')} />
              <MetricCard label="Closed" value={counts.closed} active={filter === 'closed'} onPress={() => toggle('closed')} />
            </ScrollView>
            <TextInput
              autoCorrect={false}
              placeholder="Order, machine, customer, branch…"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={styles.input}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push(`/orders/${item.id}`)}>
            <View style={styles.topRow}>
              <View style={styles.copy}>
                <Text style={styles.orderNo}>{item.order_no}</Text>
                <Text numberOfLines={1} style={styles.customer}>{item.customer_name || item.machine_no || 'No customer/machine'}</Text>
              </View>
              <StatusChip status={item.status || item.approval_status} />
            </View>
            <View style={styles.grid}>
              <Meta label="Branch" value={item.branch || '—'} />
              <Meta label="Machine" value={item.machine_no || '—'} />
              <Meta label="Qty" value={item.total_qty == null ? '—' : String(item.total_qty)} />
              <Meta label="Value" value={formatMoney(item.total_value)} />
            </View>
            <View style={styles.footer}><Text style={styles.footerText}>{item.order_type || item.order_for || 'Order'}</Text><Text style={styles.footerText}>{formatDate(item.created_at)}</Text></View>
          </Pressable>
        )}
        ListEmptyComponent={!orders.isLoading ? <Text style={styles.empty}>{orders.isError ? 'Could not load visible orders.' : 'No orders match the selected filters.'}</Text> : null}
      />
    </Screen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <View style={styles.metaBox}><Text style={styles.metaLabel}>{label}</Text><Text numberOfLines={1} style={styles.metaValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { gap: spacing.sm, paddingBottom: spacing.xxl },
  headerContent: { gap: spacing.md, marginBottom: spacing.md },
  metrics: { gap: spacing.sm, paddingRight: spacing.lg },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, fontSize: 14 },
  card: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pressed: { opacity: 0.8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  copy: { flex: 1 },
  orderNo: { color: colors.text, fontSize: 15, fontWeight: '900' },
  customer: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  metaBox: { width: '47%' },
  metaLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  metaValue: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.md },
  footerText: { color: colors.textMuted, fontSize: 10 },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: spacing.xxl },
});
