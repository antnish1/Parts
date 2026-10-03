import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { getVisibleOrders } from '@/services/orders';
import { colors, radius, spacing } from '@/theme/tokens';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const orders = useQuery({ queryKey: ['orders', 'search'], queryFn: () => getVisibleOrders(300) });

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return (orders.data ?? []).filter((order) => [order.order_no, order.machine_no, order.customer_name, order.branch, order.final_order_no, order.dbms_invoice_no]
      .some((value) => (value ?? '').toLowerCase().includes(needle)))
      .slice(0, 30);
  }, [orders.data, query]);

  return (
    <Screen title="Search" subtitle="Find visible orders by order, machine, customer, branch or invoice.">
      <TextInput
        autoCorrect={false}
        placeholder="Search orders…"
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        style={styles.input}
        value={query}
        onChangeText={setQuery}
      />
      {query.trim() && !matches.length && !orders.isLoading ? <Text style={styles.empty}>No visible order matches this search.</Text> : null}
      {matches.map((order) => (
        <Pressable key={order.id} style={styles.result} onPress={() => router.push(`/orders/${order.id}`)}>
          <View style={styles.copy}>
            <Text style={styles.orderNo}>{order.order_no}</Text>
            <Text numberOfLines={1} style={styles.meta}>{order.customer_name || order.machine_no || 'No customer/machine'} · {order.branch || '—'}</Text>
          </View>
          <StatusChip status={order.status || order.approval_status} />
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, fontSize: 15 },
  empty: { color: colors.textMuted, fontSize: 13, paddingVertical: spacing.lg, textAlign: 'center' },
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  copy: { flex: 1 },
  orderNo: { color: colors.text, fontSize: 14, fontWeight: '900' },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
});
