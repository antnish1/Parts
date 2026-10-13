import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { formatDate, getVisibleOrders } from '@/services/orders';
import { colors } from '@/theme/tokens';

function accentFor(status: string | null | undefined) {
  const value = (status ?? '').toLowerCase();
  if (value.includes('reject') || value.includes('delayed') || value.includes('not despatch')) return '#BE4248';
  if (value.includes('pending') || value.includes('partial') || value.includes('correction')) return '#B77621';
  if (value.includes('approved') || value.includes('received') || value.includes('issued') || value.includes('closed')) return '#208565';
  return '#2A68B7';
}

export default function ActivityScreen() {
  const orders = useQuery({ queryKey: ['orders', 'activity'], queryFn: () => getVisibleOrders(120) });
  const visible = (orders.data ?? []).slice(0, 24);

  return (
    <Screen brandHeader title="Activity" subtitle="Recent operational orders.">
      {orders.isError ? <StateView icon="alert" tone="error" title="Activity could not be loaded" actionLabel="Retry" onAction={() => void orders.refetch()} /> : null}
      {orders.isLoading ? <StateView icon="activity" title="Loading activity" message="Fetching recent operational orders…" /> : null}

      {visible.length > 0 ? (
        <View style={styles.register}>
          {visible.map((order, index) => {
            const status = order.approval_status || order.status;
            return (
              <Pressable
                key={order.id}
                accessibilityRole="button"
                accessibilityLabel={`Open order ${order.final_order_no || order.order_no}`}
                onPress={() => router.push(`/orders/${order.id}`)}
                style={({ pressed }) => [styles.row, index === visible.length - 1 && styles.lastRow, pressed && styles.pressed]}
              >
                <View style={[styles.accent, { backgroundColor: accentFor(status) }]} />
                <View style={styles.left}>
                  <Text numberOfLines={1} ellipsizeMode="middle" style={styles.orderNo}>{order.final_order_no || order.order_no}</Text>
                  <Text numberOfLines={1} style={styles.customer}>{order.customer_name || order.machine_no || 'Customer / machine unavailable'}</Text>
                </View>
                <View style={styles.right}>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={styles.meta}>{order.branch || order.order_type || '—'} · {formatDate(order.created_at)}</Text>
                  <StatusChip status={status} />
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {!orders.isLoading && !orders.isError && !visible.length ? <StateView icon="activity" title="No recent activity" message="Operational orders will appear here." /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  register: { borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E7EF', backgroundColor: '#FFFFFF' },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderBottomColor: '#E8EDF3', borderBottomWidth: StyleSheet.hairlineWidth },
  lastRow: { borderBottomWidth: 0 },
  pressed: { backgroundColor: '#EDF4FC' },
  accent: { width: 4, height: 41, borderRadius: 3 },
  left: { flex: 1, minWidth: 0, gap: 8 },
  right: { maxWidth: '51%', minWidth: 112, alignItems: 'flex-end', gap: 6 },
  orderNo: { color: colors.text, fontSize: 11, fontWeight: '900' },
  customer: { color: colors.textMuted, fontSize: 9.5, fontWeight: '700' },
  meta: { color: '#677589', fontSize: 8, fontWeight: '800', textAlign: 'right' },
});
