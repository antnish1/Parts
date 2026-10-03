import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { formatDate, getVisibleOrders } from '@/services/orders';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ActivityScreen() {
  const orders = useQuery({ queryKey: ['orders', 'activity'], queryFn: () => getVisibleOrders(80) });

  return (
    <Screen title="Activity" subtitle="Recent operational order activity visible to your account.">
      {(orders.data ?? []).slice(0, 20).map((order) => (
        <Pressable key={order.id} style={styles.row} onPress={() => router.push(`/orders/${order.id}`)}>
          <View style={styles.timelineDot} />
          <View style={styles.copy}>
            <Text style={styles.orderNo}>{order.order_no}</Text>
            <Text style={styles.meta}>{order.customer_name || order.machine_no || order.branch || 'Order updated'}</Text>
            <Text style={styles.date}>{formatDate(order.created_at)}</Text>
          </View>
          <StatusChip status={order.status || order.approval_status} />
        </Pressable>
      ))}
      {!orders.isLoading && !(orders.data ?? []).length ? <Text style={styles.empty}>No recent order activity is visible.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  timelineDot: { height: 9, width: 9, borderRadius: 5, backgroundColor: colors.blue },
  copy: { flex: 1 },
  orderNo: { color: colors.text, fontSize: 13, fontWeight: '900' },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  date: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: spacing.xl },
});
