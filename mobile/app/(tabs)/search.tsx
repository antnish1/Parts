import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { getVisibleOrders } from '@/services/orders';
import { colors, radius, spacing } from '@/theme/tokens';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const orders = useQuery({ queryKey: ['orders', 'search'], queryFn: () => getVisibleOrders(500) });

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return (orders.data ?? []).filter((order) => [order.order_no, order.machine_no, order.customer_name, order.branch, order.final_order_no, order.dbms_invoice_no]
      .some((value) => (value ?? '').toLowerCase().includes(needle)))
      .slice(0, 40);
  }, [orders.data, query]);

  return (
    <Screen title="Search" subtitle="Find an order by number, machine, customer, branch or invoice.">
      <View style={styles.searchBox}>
        <AppIcon name="search" size={19} color={colors.textMuted} />
        <TextInput autoCorrect={false} placeholder="Search orders…" placeholderTextColor={colors.textMuted} returnKeyType="search" style={styles.input} value={query} onChangeText={setQuery} />
      </View>

      {orders.isError ? <StateView icon="alert" tone="error" title="Search data could not be loaded" actionLabel="Retry" onAction={() => void orders.refetch()} /> : null}
      {!query.trim() && !orders.isError ? <StateView icon="search" title="Search operational orders" message="Use an order number, machine, customer, branch or invoice reference." /> : null}
      {query.trim() && !matches.length && !orders.isLoading && !orders.isError ? <StateView icon="inbox" title="No matching orders" message="Try another order number, customer, machine, branch or invoice." /> : null}

      {matches.map((order) => (
        <Pressable key={order.id} style={({ pressed }) => [styles.result, pressed && styles.pressed]} onPress={() => router.push(`/orders/${order.id}`)}>
          <View style={styles.resultIcon}><AppIcon name="package" size={17} color={colors.navy} /></View>
          <View style={styles.copy}>
            <Text style={styles.orderNo}>{order.final_order_no || order.order_no}</Text>
            <Text numberOfLines={1} style={styles.meta}>{order.customer_name || order.machine_no || 'No customer/machine'} · {order.branch || '—'}</Text>
          </View>
          <View style={styles.right}><StatusChip status={order.status || order.approval_status} /><AppIcon name="chevronRight" size={15} color="#8B98A8" /></View>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 16, borderWidth: 1, borderColor: '#DFE6EE', backgroundColor: '#FFFFFF', paddingHorizontal: spacing.md },
  input: { flex: 1, minHeight: 50, color: colors.text, fontSize: 14, fontWeight: '700' },
  result: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: '#E1E7EE', backgroundColor: colors.surface },
  pressed: { opacity: .8 },
  resultIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF3FA' },
  copy: { flex: 1 },
  orderNo: { color: colors.text, fontSize: 12, fontWeight: '900' },
  meta: { color: colors.textMuted, fontSize: 9, marginTop: 4 },
  right: { maxWidth: 125, alignItems: 'flex-end', gap: 7 },
});
