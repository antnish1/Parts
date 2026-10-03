import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { formatCreditMoney, getCreditDispatches, type CreditDispatch } from '@/services/creditDispatch';
import { colors, radius, spacing } from '@/theme/tokens';

type Filter = 'pending' | 'overdue' | 'payment' | 'rejected' | 'closed' | 'correction' | 'all';

function matches(row: CreditDispatch, filter: Filter) {
  if (filter === 'pending') return row.approval_status === 'Pending Accounts Approval' || row.approval_status === 'Pending Manager Approval';
  if (filter === 'overdue') return row.recovery_status === 'Payment Overdue' || row.recovery_status === 'Partial Payment - Overdue';
  if (filter === 'payment') return row.approval_status === 'Approved' && ['Pending Payment', 'Partial Payment', 'Partial Payment - Overdue', 'Payment Overdue'].includes(row.recovery_status);
  if (filter === 'rejected') return row.approval_status.startsWith('Rejected');
  if (filter === 'closed') return row.recovery_status === 'Closed';
  if (filter === 'correction') return row.approval_status.startsWith('Correction Requested');
  return true;
}

export default function CreditDispatchListScreen() {
  const { role } = useAuth();
  const allowed = ['branch', 'accounts', 'manager', 'admin', 'super', 'developer'].includes(role ?? '');
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: ['credit-dispatches'], queryFn: () => getCreditDispatches(), enabled: allowed });
  const data = query.data ?? [];
  const counts = useMemo(() => ({ pending: data.filter((row) => matches(row, 'pending')).length, overdue: data.filter((row) => matches(row, 'overdue')).length, payment: data.filter((row) => matches(row, 'payment')).length, rejected: data.filter((row) => matches(row, 'rejected')).length, closed: data.filter((row) => matches(row, 'closed')).length, correction: data.filter((row) => matches(row, 'correction')).length, all: data.length }), [data]);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.filter((row) => matches(row, filter)).filter((row) => !needle || [row.dispatch_no, row.customer_name, row.mobile_no, row.document_no, row.branch, row.sales_employee_name].some((value) => String(value ?? '').toLowerCase().includes(needle)));
  }, [data, filter, search]);

  if (!allowed) return <View style={styles.center}><Text style={styles.error}>Credit Dispatch is not available for this role.</Text></View>;
  function toggle(next: Filter) { setFilter((current) => current === next && next !== 'all' ? 'all' : next); }

  return (
    <Screen title="Credit Dispatch" subtitle={`${rows.length} shown · ${role} view`} scroll={false}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        ListHeaderComponent={<View style={styles.header}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metrics}><MetricCard label="Pending approval" value={counts.pending} active={filter === 'pending'} onPress={() => toggle('pending')} /><MetricCard label="Overdue" value={counts.overdue} active={filter === 'overdue'} onPress={() => toggle('overdue')} /><MetricCard label="Pending payment" value={counts.payment} active={filter === 'payment'} onPress={() => toggle('payment')} /><MetricCard label="Rejected" value={counts.rejected} active={filter === 'rejected'} onPress={() => toggle('rejected')} /><MetricCard label="Closed" value={counts.closed} active={filter === 'closed'} onPress={() => toggle('closed')} /><MetricCard label="Correction" value={counts.correction} active={filter === 'correction'} onPress={() => toggle('correction')} /><MetricCard label="All" value={counts.all} active={filter === 'all'} onPress={() => toggle('all')} /></ScrollView><TextInput autoCorrect={false} placeholder="Customer, request, document, branch…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} style={styles.input} /></View>}
        renderItem={({ item }) => <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push(`/credit-dispatch/${item.id}`)}><View style={styles.top}><View style={styles.copy}><Text style={styles.no}>{item.dispatch_no || 'Credit Request'}</Text><Text style={styles.customer}>{item.customer_name}</Text></View><StatusChip status={item.approval_status} /></View><View style={styles.grid}><Mini label="Branch" value={item.branch} /><Mini label="Credit" value={formatCreditMoney(item.credit_amount)} /><Mini label="Balance" value={formatCreditMoney(item.balance_amount)} /><Mini label="Due" value={item.due_date || '—'} /></View><View style={styles.footer}><Text style={styles.recovery}>{item.recovery_status}</Text><Text style={styles.doc}>{item.document_type} · {item.document_no || '—'}</Text></View></Pressable>}
        ListEmptyComponent={!query.isLoading ? <Text style={styles.empty}>{query.isError ? 'Could not load Credit Dispatch.' : 'No requests match this filter.'}</Text> : null}
      />
    </Screen>
  );
}
function Mini({ label, value }: { label: string; value: string }) { return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text numberOfLines={1} style={styles.miniValue}>{value}</Text></View>; }
const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, error: { color: colors.danger }, list: { gap: spacing.sm, paddingBottom: spacing.xxl }, header: { gap: spacing.md, marginBottom: spacing.md }, metrics: { gap: spacing.sm, paddingRight: spacing.lg }, input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, fontSize: 14 }, card: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, pressed: { opacity: 0.8 }, top: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, copy: { flex: 1 }, no: { color: colors.text, fontSize: 14, fontWeight: '900' }, customer: { color: colors.textMuted, fontSize: 12, marginTop: 2 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }, mini: { width: '47%' }, miniLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700' }, miniValue: { color: colors.text, fontSize: 11, fontWeight: '800', marginTop: 2 }, footer: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.md }, recovery: { flex: 1, color: colors.navy, fontSize: 10, fontWeight: '800' }, doc: { color: colors.textMuted, fontSize: 10 }, empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xxl } });
