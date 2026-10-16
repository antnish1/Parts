import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { MotionView } from '@/components/MotionView';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { formatDate, formatMoney, getAllVisibleOrders, type OrderSummary } from '@/services/orders';
import { colors, spacing } from '@/theme/tokens';

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
      return [order.order_no, order.machine_no, order.customer_name, order.order_for, order.branch, order.order_type, order.final_order_no, order.dbms_invoice_no]
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
    <Screen scroll={false}>
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

            <View style={styles.tabs}>
              {([{ key: 'all', label: 'All', value: counts.all }, { key: 'pending', label: 'Pending', value: counts.pending }, { key: 'open', label: 'Open', value: counts.open }, { key: 'closed', label: 'Closed', value: counts.closed }] as const).map(tab => (
                <Pressable key={tab.key} onPress={() => setFilter(tab.key)} style={[styles.tab, filter === tab.key && styles.tabActive]}>
                  <Text style={[styles.tabLabel, filter === tab.key && styles.tabLabelActive]}>{tab.label} ({tab.value})</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <MotionView delay={Math.min(index * 24, 180)} trigger={filter}>
          <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push(`/orders/${item.id}`)}>
            <View style={styles.top}>
              <View style={styles.copy}>
                <Text numberOfLines={1} ellipsizeMode="middle" style={styles.orderNo}>{item.final_order_no || item.order_no}</Text>
                <Text numberOfLines={1} style={styles.customer}>{item.customer_name || item.machine_no || item.order_for || 'No customer/machine'}</Text>
              </View>
              <View style={styles.statusSide}><StatusChip status={item.approval_status || item.status} /><Text style={styles.date}>{formatDate(item.created_at)}</Text></View>
            </View>
            <View style={styles.details}>
              <View style={styles.detailColWide}><Text style={styles.detailTitle}>Branch</Text><Text numberOfLines={1} style={styles.detailValue}>{item.branch || '—'}</Text></View>
              <View style={[styles.detailCol, styles.detailDivider]}><Text style={styles.detailTitle}>Qty</Text><Text numberOfLines={1} style={styles.detailValue}>{item.total_qty == null ? '—' : String(item.total_qty)}</Text></View>
              <View style={[styles.detailCol, styles.detailDivider]}><Text style={styles.detailTitle}>Type</Text><Text numberOfLines={1} style={styles.detailValue}>{item.order_type || '—'}</Text></View>
              <View style={[styles.detailColWide, styles.detailDivider]}><Text style={styles.detailTitle}>Value</Text><Text numberOfLines={1} style={styles.detailValue}>{formatMoney(item.total_value)}</Text></View>
            </View>
          </Pressable>
          </MotionView>
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

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { gap: 8, paddingBottom: spacing.xxl },
  headerContent: { gap: 10, marginBottom: 5 },
  search: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, backgroundColor: colors.surface },
  searchInput: { flex: 1, height: 42, color: colors.text, fontSize: 12 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
  tab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#EAF2FF', borderBottomWidth: 3, borderBottomColor: '#2756A4' },
  tabLabel: { fontSize: 10, color: '#677589', fontWeight: '800' },
  tabLabelActive: { color: '#173B78' },
  card: { padding: 12, gap: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pressed: { opacity: 0.8 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 7 },
  copy: { flex: 1, minWidth: 0, gap: 6 },
  orderNo: { color: colors.text, fontSize: 10.5, fontWeight: '900' },
  customer: { color: colors.textMuted, fontSize: 10 },
  statusSide: { maxWidth: '49%', alignItems: 'flex-end', gap: 5 },
  date: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  details: { backgroundColor: '#EEF5FC', borderRadius: 9, paddingVertical: 10, flexDirection: 'row' },
  detailCol: { flex: 0.8, minWidth: 0, paddingHorizontal: 7, gap: 4 },
  detailColWide: { flex: 1.25, minWidth: 0, paddingHorizontal: 7, gap: 4 },
  detailDivider: { borderLeftWidth: 1, borderLeftColor: '#CFDDED' },
  detailTitle: { color: '#748297', fontSize: 8.5, fontWeight: '700' },
  detailValue: { color: '#152740', fontSize: 9.5, fontWeight: '900' },
});
