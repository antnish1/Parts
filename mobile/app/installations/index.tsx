import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { canManageInstallations, canViewInstallations, equipmentTypeLabel, installationStatusLabel, listInstallationEntries, listInstallationInvoices, type InstallationEntry } from '@/services/installations';
import { colors, radius, spacing } from '@/theme/tokens';

type Filter = 'ALL' | 'PENDING' | 'ACCEPTANCE_PENDING' | 'ACCEPTED';

export default function InstallationsScreen() {
  const { profile } = useAuth();
  const allowed = canViewInstallations(profile);
  const canManage = canManageInstallations(profile);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'register' | 'invoice'>('register');
  const entries = useQuery({ queryKey: ['installation-entries'], queryFn: listInstallationEntries, enabled: allowed });
  const invoices = useQuery({ queryKey: ['installation-invoices'], queryFn: listInstallationInvoices, enabled: allowed && canManage });
  const data = entries.data ?? [];
  const counts = useMemo(() => ({ ALL: data.length, PENDING: data.filter((r) => r.status === 'PENDING').length, ACCEPTANCE_PENDING: data.filter((r) => r.status === 'ACCEPTANCE_PENDING').length, ACCEPTED: data.filter((r) => r.status === 'ACCEPTED').length }), [data]);
  const visible = useMemo(() => { const needle = search.trim().toLowerCase(); return data.filter((r) => filter === 'ALL' || r.status === filter).filter((r) => !needle || [r.entry_no, r.branch, r.customer_name, r.invoice_no, r.jcb_invoice_no, r.equipment_no, r.dbms_no, r.dbms_invoice_no, r.svr_no, r.equipment_registration_no].some((v) => String(v ?? '').toLowerCase().includes(needle))); }, [data, filter, search]);

  if (!allowed) return <View style={styles.center}><Text style={styles.error}>Engine & Breaker is not available for this role.</Text></View>;

  return <Screen title="Engine & Breaker" subtitle="Invoice intake, registration, completion and acceptance" scroll={false}>
    <View style={styles.segment}><Pressable onPress={() => setMode('register')} style={[styles.segmentButton, mode === 'register' && styles.segmentActive]}><Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>Register</Text></Pressable>{canManage ? <Pressable onPress={() => setMode('invoice')} style={[styles.segmentButton, mode === 'invoice' && styles.segmentActive]}><Text style={[styles.segmentText, mode === 'invoice' && styles.segmentTextActive]}>Invoice</Text></Pressable> : null}</View>
    {mode === 'invoice' && canManage ? <FlatList
      data={invoices.data ?? []}
      keyExtractor={(item) => item.id}
      refreshing={invoices.isRefetching}
      onRefresh={() => void invoices.refetch()}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<View style={styles.invoiceHeader}><Pressable onPress={() => router.push('/installations/invoice')} style={styles.primary}><Text style={styles.primaryText}>+ Add Invoice</Text></Pressable><Text style={styles.helper}>{invoices.data?.length ?? 0} invoice record(s)</Text></View>}
      renderItem={({ item }) => <View style={styles.card}><View style={styles.top}><View style={styles.copy}><Text style={styles.no}>{item.jcb_invoice_no}</Text><Text style={styles.customer}>{item.part_no} · {equipmentTypeLabel(item.equipment_type)}</Text></View><View style={[styles.badge, item.installation_id ? styles.badgeDone : styles.badgeOpen]}><Text style={[styles.badgeText, item.installation_id ? styles.badgeDoneText : styles.badgeOpenText]}>{item.installation_id ? 'Registered' : 'Pending'}</Text></View></View><View style={styles.grid}><Mini label="Serial" value={item.serial_no} /><Mini label="DBMS No." value={item.dbms_no || '—'} /><Mini label="Date" value={item.invoice_date} /><Mini label="File" value={item.document_name} /></View>{item.installation_id ? <Pressable onPress={() => router.push(`/installations/${item.installation_id}`)} style={styles.secondary}><Text style={styles.secondaryText}>Open Registration</Text></Pressable> : <Pressable onPress={() => router.push({ pathname: '/installations/register', params: { invoiceId: item.id } })} style={styles.primary}><Text style={styles.primaryText}>Register</Text></Pressable>}</View>}
      ListEmptyComponent={!invoices.isLoading ? <Text style={styles.empty}>No installation invoices found.</Text> : null}
    /> : <FlatList
      data={visible}
      keyExtractor={(item) => item.id}
      refreshing={entries.isRefetching}
      onRefresh={() => void entries.refetch()}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<View style={styles.header}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metrics}><MetricCard label="Pending" value={counts.PENDING} active={filter === 'PENDING'} onPress={() => setFilter(filter === 'PENDING' ? 'ALL' : 'PENDING')} /><MetricCard label="Acceptance Pending" value={counts.ACCEPTANCE_PENDING} active={filter === 'ACCEPTANCE_PENDING'} onPress={() => setFilter(filter === 'ACCEPTANCE_PENDING' ? 'ALL' : 'ACCEPTANCE_PENDING')} /><MetricCard label="Accepted" value={counts.ACCEPTED} active={filter === 'ACCEPTED'} onPress={() => setFilter(filter === 'ACCEPTED' ? 'ALL' : 'ACCEPTED')} /><MetricCard label="All" value={counts.ALL} active={filter === 'ALL'} onPress={() => setFilter('ALL')} /></ScrollView><TextInput value={search} onChangeText={setSearch} placeholder="Entry, invoice, serial, branch, customer…" placeholderTextColor={colors.textMuted} style={styles.input} /></View>}
      renderItem={({ item }) => <EntryCard item={item} />}
      ListEmptyComponent={!entries.isLoading ? <Text style={styles.empty}>{entries.isError ? 'Could not load Engine & Breaker entries.' : 'No entries match this filter.'}</Text> : null}
    />}
  </Screen>;
}

function EntryCard({ item }: { item: InstallationEntry }) { return <Pressable onPress={() => router.push(`/installations/${item.id}`)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.top}><View style={styles.copy}><Text style={styles.no}>{item.entry_no}</Text><Text style={styles.customer}>{item.customer_name} · {item.branch}</Text></View><View style={[styles.badge, item.status === 'ACCEPTED' ? styles.badgeDone : styles.badgeOpen]}><Text style={[styles.badgeText, item.status === 'ACCEPTED' ? styles.badgeDoneText : styles.badgeOpenText]}>{installationStatusLabel(item.status)}</Text></View></View><View style={styles.grid}><Mini label="Type" value={equipmentTypeLabel(item.equipment_type)} /><Mini label="JCB Invoice" value={item.jcb_invoice_no || item.invoice_no} /><Mini label="Equipment" value={item.equipment_no || 'Pending'} /><Mini label="Registration" value={item.equipment_registration_no || 'Pending'} /></View></Pressable>; }
function Mini({ label, value }: { label: string; value: string }) { return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text numberOfLines={1} style={styles.miniValue}>{value}</Text></View>; }
const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, error: { color: colors.danger }, segment: { flexDirection: 'row', gap: spacing.xs, padding: 4, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }, segmentButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm }, segmentActive: { backgroundColor: colors.navy }, segmentText: { color: colors.textMuted, fontSize: 12, fontWeight: '900' }, segmentTextActive: { color: '#fff' }, list: { gap: spacing.sm, paddingBottom: spacing.xxl }, header: { gap: spacing.md, marginBottom: spacing.md }, invoiceHeader: { gap: spacing.sm, marginBottom: spacing.md }, metrics: { gap: spacing.sm, paddingRight: spacing.lg }, input: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 14 }, card: { gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, pressed: { opacity: 0.8 }, top: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, copy: { flex: 1 }, no: { color: colors.blue, fontSize: 14, fontWeight: '900' }, customer: { color: colors.textMuted, fontSize: 11, marginTop: 2 }, badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm }, badgeOpen: { backgroundColor: colors.warningSoft }, badgeDone: { backgroundColor: colors.successSoft }, badgeText: { fontSize: 9, fontWeight: '900' }, badgeOpenText: { color: colors.warning }, badgeDoneText: { color: colors.success }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, mini: { width: '47%' }, miniLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700' }, miniValue: { color: colors.text, fontSize: 11, fontWeight: '800', marginTop: 2 }, primary: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.navy }, primaryText: { color: '#fff', fontSize: 12, fontWeight: '900' }, secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.navy, backgroundColor: '#fff' }, secondaryText: { color: colors.navy, fontSize: 11, fontWeight: '900' }, helper: { color: colors.textMuted, fontSize: 10 }, empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xxl } });