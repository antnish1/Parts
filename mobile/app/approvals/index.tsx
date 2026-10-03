import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { getApprovalQueue } from '@/services/approvals';
import { formatDate, formatMoney } from '@/services/orders';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ApprovalQueueScreen() {
  const { role } = useAuth();
  const allowed = role === 'super' || role === 'manager' || role === 'developer';
  const queue = useQuery({ queryKey: ['mobile-approval-queue', role], queryFn: () => getApprovalQueue(), enabled: allowed });

  if (!allowed) return <View style={styles.center}><Text style={styles.error}>Approval Queue is not available for this role.</Text><Pressable onPress={() => router.back()}><Text style={styles.link}>Go back</Text></Pressable></View>;

  return (
    <Screen title={role === 'manager' ? 'Manager Approvals' : 'Approval Queue'} subtitle={`${queue.data?.length ?? 0} order(s) awaiting your stage`} scroll={false}>
      <FlatList
        data={queue.data ?? []}
        keyExtractor={(item) => item.id}
        refreshing={queue.isRefetching}
        onRefresh={() => void queue.refetch()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push(`/approvals/${item.id}`)}>
            <View style={styles.top}><View style={styles.copy}><Text style={styles.orderNo}>{item.order_no}</Text><Text numberOfLines={1} style={styles.customer}>{item.customer_name || item.machine_no || 'No customer/machine'}</Text></View><StatusChip status={item.approval_status || item.status} /></View>
            <View style={styles.meta}><Text style={styles.metaText}>{item.branch || '—'}</Text><Text style={styles.metaText}>{formatMoney(item.total_value)}</Text><Text style={styles.metaText}>{formatDate(item.created_at)}</Text></View>
          </Pressable>
        )}
        ListEmptyComponent={!queue.isLoading ? <Text style={styles.empty}>{queue.isError ? 'Could not load the approval queue.' : 'Nothing is awaiting your approval stage.'}</Text> : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background }, list: { gap: spacing.sm, paddingBottom: spacing.xxl }, card: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, pressed: { opacity: 0.8 }, top: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, copy: { flex: 1 }, orderNo: { color: colors.text, fontSize: 15, fontWeight: '900' }, customer: { color: colors.textMuted, fontSize: 12, marginTop: 3 }, meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md }, metaText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' }, empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xxl }, error: { color: colors.danger, fontSize: 13 }, link: { color: colors.blue, fontWeight: '800' },
});
