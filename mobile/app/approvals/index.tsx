import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Animated, Easing, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
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
  const [stage, setStage] = useState<'all' | 'approver' | 'manager'>('all');
  const [hintIndex, setHintIndex] = useState(0);
  const hintMotion = useRef(new Animated.Value(0)).current;
  const hints = ['Search order number...', 'Search customer name...', 'Search branch or machine...', 'Search order type...'];
  useEffect(() => {
    if (search) { hintMotion.stopAnimation(); hintMotion.setValue(0); return; }
    const tick = setInterval(() => {
      Animated.timing(hintMotion, { toValue: -18, duration: 250, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(() => {
        setHintIndex(v => (v + 1) % hints.length);
        hintMotion.setValue(18);
        Animated.timing(hintMotion, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      });
    }, 2800);
    return () => { clearInterval(tick); hintMotion.stopAnimation(); };
  }, [hintMotion, search]);
  const queue = useQuery({ queryKey: ['mobile-approval-queue', role], queryFn: () => getApprovalQueue(), enabled: allowed });
  const rows = queue.data ?? [];

  const counts = useMemo(() => ({
    total: rows.length,
    manager: rows.filter((item) => normalize(item.approval_status).includes('pendingmanagerapproval')).length,
    approver: rows.filter((item) => normalize(item.approval_status).includes('pendingapproval') && !normalize(item.approval_status).includes('manager')).length,
  }), [rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const stageRows = rows.filter(item => stage === 'all' || (stage === 'manager'
      ? normalize(item.approval_status).includes('pendingmanagerapproval')
      : normalize(item.approval_status).includes('pendingapproval') && !normalize(item.approval_status).includes('manager')));
    if (!term) return stageRows;
    return stageRows.filter((item) => [item.order_no, item.final_order_no, item.branch, item.customer_name, item.machine_no, item.order_type, item.approval_status]
      .some((value) => String(value ?? '').toLowerCase().includes(term)));
  }, [rows, search, stage]);

  if (!allowed) return <View style={styles.center}><StateView icon="alert" tone="error" title="Approval Queue unavailable" message="This workspace is available only to Super, Manager and Developer roles." /></View>;

  return (
    <Screen title={role === 'manager' ? 'Manager Approvals' : 'Approval Queue'} scroll={false}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshing={queue.isRefetching}
        onRefresh={() => void queue.refetch()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.search}>
              <AppIcon name="search" size={18} color={colors.textMuted} />
              <View style={styles.searchArea}>
                {!search ? <Animated.Text pointerEvents="none" style={[styles.hint, { transform: [{ translateY: hintMotion }] }]}>{hints[hintIndex]}</Animated.Text> : null}
                <TextInput value={search} onChangeText={setSearch} placeholder="" accessibilityLabel="Search approvals by order, branch, customer, machine or type" style={styles.searchInput} />
              </View>
            </View>
            <View style={styles.tabs}>
              {([{ key: 'all', label: 'All', value: counts.total }, { key: 'approver', label: 'Approver', value: counts.approver }, { key: 'manager', label: 'Manager', value: counts.manager }] as const).map(tab => (
                <Pressable key={tab.key} onPress={() => setStage(tab.key)} style={[styles.tab, stage === tab.key && styles.tabActive]}>
                  <Text style={[styles.tabLabel, stage === tab.key && styles.tabLabelActive]}>{tab.label} ({tab.value})</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={`Open approval ${item.final_order_no || item.order_no}`} style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push(`/approvals/${item.id}`)}>
            <View style={styles.top}>
              <View style={styles.copy}>
                <Text numberOfLines={1} ellipsizeMode="middle" style={styles.orderNo}>{item.final_order_no || item.order_no}</Text>
                <Text numberOfLines={1} style={styles.customer}>{item.customer_name || item.machine_no || 'No customer/machine'}</Text>
              </View>
              <View style={styles.statusSide}><StatusChip status={item.approval_status || item.status} /><Text style={styles.date}>{formatDate(item.created_at)}</Text></View>
            </View>
            <View style={styles.details}>
              <View style={styles.detailCol}><Text style={styles.detailTitle}>Branch</Text><Text numberOfLines={1} style={styles.detailValue}>{item.branch || '—'}</Text></View>
              <View style={[styles.detailCol, styles.detailDivider]}><Text style={styles.detailTitle}>Order type</Text><Text style={styles.detailValue}>{item.order_type || '—'}</Text></View>
              <View style={[styles.detailCol, styles.detailDivider]}><Text style={styles.detailTitle}>Value</Text><Text numberOfLines={1} style={styles.detailValue}>{formatMoney(item.total_value)}</Text></View>
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
  list: { gap: 8, paddingBottom: spacing.xxl },
  header: { gap: 10, marginBottom: 5 },
  search: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, backgroundColor: colors.surface },
  searchArea: { flex: 1, justifyContent: 'center', overflow: 'hidden', height: 42 },
  searchInput: { height: 42, color: colors.text, fontSize: 12 },
  hint: { position: 'absolute', color: colors.textMuted, fontSize: 12 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
  tab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#EAF2FF', borderBottomWidth: 3, borderBottomColor: '#2756A4' },
  tabLabel: { fontSize: 10, color: '#677589', fontWeight: '800' },
  tabLabelActive: { color: '#173B78' },
  card: { padding: 12, gap: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pressed: { opacity: .8 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 7 },
  copy: { flex: 1, minWidth: 0, gap: 6 },
  orderNo: { color: colors.text, fontSize: 12, fontWeight: '900' },
  customer: { color: colors.textMuted, fontSize: 10 },
  statusSide: { maxWidth: '49%', alignItems: 'flex-end', gap: 5 },
  date: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  details: { backgroundColor: '#EEF5FC', borderRadius: 9, paddingVertical: 10, flexDirection: 'row' },
  detailCol: { flex: 1, minWidth: 0, paddingHorizontal: 9, gap: 4 },
  detailDivider: { borderLeftWidth: 1, borderLeftColor: '#CFDDED' },
  detailTitle: { color: '#748297', fontSize: 9, fontWeight: '700' },
  detailValue: { color: '#152740', fontSize: 10, fontWeight: '900' },
});
