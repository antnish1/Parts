import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { formatDate, getVisibleOrders } from '@/services/orders';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ActivityScreen() {
  const orders = useQuery({ queryKey: ['orders', 'activity'], queryFn: () => getVisibleOrders(120) });

  return (
    <Screen title="Activity" subtitle="Recent operational movement visible to your account.">
      {orders.isError ? <StateView icon="alert" tone="error" title="Activity could not be loaded" actionLabel="Retry" onAction={() => void orders.refetch()} /> : null}

      <View style={styles.timeline}>
        {(orders.data ?? []).slice(0, 24).map((order, index) => (
          <Pressable key={order.id} style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={() => router.push(`/orders/${order.id}`)}>
            <View style={styles.timelineCol}>
              <View style={styles.dot}><AppIcon name="activity" size={12} color={colors.blue} strokeWidth={2.1} /></View>
              {index < Math.min((orders.data ?? []).length, 24) - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.copy}>
              <View style={styles.top}>
                <Text numberOfLines={1} style={styles.orderNo}>{order.final_order_no || order.order_no}</Text>
                <Text style={styles.date}>{formatDate(order.created_at)}</Text>
              </View>
              <Text numberOfLines={1} style={styles.meta}>{order.customer_name || order.machine_no || order.branch || 'Order updated'}</Text>
              <View style={styles.statusRow}><StatusChip status={order.status || order.approval_status} /><AppIcon name="chevronRight" size={15} color="#8996A6" /></View>
            </View>
          </Pressable>
        ))}
      </View>

      {!orders.isLoading && !orders.isError && !(orders.data ?? []).length ? <StateView icon="activity" title="No recent activity" message="Operational changes will appear here as orders move through the workflow." /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  timeline: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: '#E1E7EE', backgroundColor: colors.surface },
  row: { minHeight: 94, flexDirection: 'row', paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  pressed: { opacity: .8 },
  timelineCol: { width: 34, alignItems: 'center' },
  dot: { width: 30, height: 30, marginTop: spacing.md, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft },
  line: { flex: 1, width: 1, backgroundColor: '#E1E7EE' },
  copy: { flex: 1, justifyContent: 'center', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EDF3' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  orderNo: { flex: 1, color: colors.text, fontSize: 11, fontWeight: '900' },
  date: { color: colors.textMuted, fontSize: 8, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 9, marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
});
