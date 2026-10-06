import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { formatDate, formatMoney, getAllVisibleOrders, type OrderSummary } from '@/services/orders';
import { colors, radius, spacing } from '@/theme/tokens';

type Filter = 'all' | 'pending' | 'open' | 'closed';

function normalized(order: OrderSummary) {
  return `${order.status ?? ''} ${order.approval_status ?? ''}`.toLowerCase().replace(/[_-]+/g, ' ');
}

function matchesFilter(order: OrderSummary, filter: Filter): boolean {
  const status = normalized(order);
  if (filter === 'pending') return status.includes('pending');
  if (filter === 'closed') return ['received', 'issued', 'rejected'].some((value) => status.includes(value));
  if (filter === 'open') return !matchesFilter(order, 'closed');
  return true;
}

export default function OrdersScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const orders = useQuery({ queryKey: ['orders', 'list', 'all'], queryFn: getAllVisibleOrders, staleTime: 20_000 });

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

  return (
    <Screen title="Track Orders" subtitle="Complete operational order register" scroll={false}>
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
            <View style={styles.summary}>
              <Summary label="All" value={counts.all} active={filter === 'all'} onPress={() => setFilter('all')} />
              <Summary label="Pending" value={counts.pending} active={filter === 'pending'} onPress={() => setFilter(filter === 'pending' ? 'all' : 'pending')} />
              <Summary label="Open" value={counts.open} active={filter === 'open'} onPress={() => setFilter(filter === 'open' ? 'all' : 'open')} />
              <Summary label="Closed" value={counts.closed} active={filter === 'closed'} onPress={() => setFilter(filter === 'closed' ? 'all' : 'closed')} />
            </View>

            <View style={styles.search}>
              <AppIcon name="search" size={18} color={colors.textMuted} />
              <TextInput
                autoCorrect={false}
                placeholder="Order, machine, customer, branch…"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            <View style={styles.resultBar}>
              <Text style={styles.resultCount}>{rows.length.toLocaleString('en-IN')} orders</Text>
              <Text style={styles.resultHint}>Pull down to refresh</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push(`/orders/${item.id}`)}>
            <View style={styles.cardTop}>
              <View style={styles.typeIcon}><AppIcon name={normalized(item).includes('pending') ? 'clock' : 'package'} size={18} color={colors.navy} /></View>
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.orderNo}>{item.final_order_no || item.order_no}</Text>
                {item.final_order_no ? <Text style={styles.tempNo}>Temp {item.order_no}</Text> : null}
              </View>
              <StatusChip status={item.approval_status || item.status} />
            </View>

            <Text numberOfLines={1} style={styles.customer}>{item.customer_name || item.machine_no || 'Customer / machine unavailable'}</Text>

            <View style={styles.contextRow}>
              <View style={styles.context}><AppIcon name="inventory" size={13} color="#708096" /><Text numberOfLines={1} style={styles.contextText}>{item.branch || '—'}</Text></View>
              <View style={styles.context}><AppIcon name="package" size={13} color="#708096" /><Text numberOfLines={1} style={styles.contextText}>{item.machine_no || item.order_type || '—'}</Text></View>
            </View>

            <View style={styles.valueStrip}>
              <Value label="Qty" value={item.total_qty == null ? '—' : String(item.total_qty)} />
              <View style={styles.valueDivider} />
              <Value label="Value" value={formatMoney(item.total_value)} />
              <View style={styles.valueDivider} />
              <Value label="Created" value={formatDate(item.created_at)} />
            </View>

            <View style={styles.openRow}>
              <Text style={styles.openText}>Open order workspace</Text>
              <AppIcon name="chevronRight" size={17} color={colors.blue} />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={!orders.isLoading ? (
          orders.isError
            ? <StateView icon="alert" tone="error" title="Orders could not be loaded" message="The operational register request failed." actionLabel="Retry" onAction={() => void orders.refetch()} />
            : <StateView icon="inbox" title="No orders match this view" message="Change the filter or search term to find another order." />
        ) : null}
      />
    </Screen>
  );
}

function Summary({ label, value, active, onPress }: { label: string; value: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.summaryItem, active && styles.summaryItemActive]}>
      <Text style={[styles.summaryValue, active && styles.summaryValueActive]}>{value}</Text>
      <Text style={[styles.summaryLabel, active && styles.summaryLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return <View style={styles.value}><Text style={styles.valueLabel}>{label}</Text><Text numberOfLines={1} style={styles.valueText}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { gap: spacing.sm, paddingBottom: spacing.xxl },
  headerContent: { gap: spacing.md, marginBottom: spacing.md },
  summary: { flexDirection: 'row', padding: 4, borderRadius: 18, backgroundColor: '#EAEFF5' },
  summaryItem: { flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  summaryItemActive: { backgroundColor: colors.navy },
  summaryValue: { color: colors.text, fontSize: 17, fontWeight: '900' },
  summaryValueActive: { color: '#FFFFFF' },
  summaryLabel: { color: colors.textMuted, fontSize: 8, fontWeight: '900', marginTop: 2 },
  summaryLabelActive: { color: '#C9DAEC' },
  search: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 16, borderWidth: 1, borderColor: '#DFE6EE', backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, minHeight: 48, color: colors.text, fontSize: 13, fontWeight: '700' },
  resultBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultCount: { color: colors.text, fontSize: 10, fontWeight: '900' },
  resultHint: { color: colors.textMuted, fontSize: 8, fontWeight: '700' },
  card: { padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: '#E1E7EE', backgroundColor: colors.surface },
  pressed: { opacity: 0.8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  typeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF3FA' },
  copy: { flex: 1 },
  orderNo: { color: colors.text, fontSize: 13, fontWeight: '900' },
  tempNo: { color: colors.textMuted, fontSize: 8, fontWeight: '700', marginTop: 2 },
  customer: { color: '#59687C', fontSize: 11, fontWeight: '700', marginTop: spacing.sm },
  contextRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  context: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  contextText: { flex: 1, color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  valueStrip: { minHeight: 54, flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingHorizontal: spacing.sm, borderRadius: 14, backgroundColor: '#F6F8FB' },
  value: { flex: 1 },
  valueLabel: { color: colors.textMuted, fontSize: 8, fontWeight: '800' },
  valueText: { color: colors.text, fontSize: 10, fontWeight: '900', marginTop: 2 },
  valueDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: '#DDE4EC' },
  openRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8EDF3' },
  openText: { color: colors.blue, fontSize: 9, fontWeight: '900' },
});
