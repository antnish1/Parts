import { useEffect, useMemo, useState } from 'react';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { StateView } from '@/components/StateView';
import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { formatMoney } from '@/services/orders';
import { getInventoryBranches, getLatestInventoryReportDate, getManagerInventoryLookup, getManagerInventoryTransactions } from '@/services/managerInventory';
import { colors, radius, spacing } from '@/theme/tokens';

function dateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

async function shareCsv(filename: string, header: string[], rows: unknown[][]) {
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Sharing is not available on this device.');
  const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
  const file = new File(Paths.cache, `${Date.now()}-${filename}`);
  file.create();
  file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Share inventory export' });
}

function parseDate(value: string) {
  const parsed = value ? new Date(`${value}T12:00:00`) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default function ManagerDashboardScreen() {
  const { role } = useAuth();
  const allowed = role === 'manager' || role === 'developer';
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('all');
  const [reportDate, setReportDate] = useState('');
  const [showDate, setShowDate] = useState(false);

  const latest = useQuery({ queryKey: ['manager-inventory-latest-date'], queryFn: getLatestInventoryReportDate, enabled: allowed });

  useEffect(() => {
    if (!reportDate && latest.data) setReportDate(latest.data);
  }, [latest.data, reportDate]);

  const branches = useQuery({
    queryKey: ['manager-inventory-branches', reportDate],
    queryFn: () => getInventoryBranches(reportDate),
    enabled: allowed && Boolean(reportDate),
  });
  const hasSearch = search.trim().length > 0;
  const inventory = useQuery({
    queryKey: ['manager-inventory', search, branch, reportDate],
    queryFn: () => getManagerInventoryLookup(search, branch, reportDate),
    enabled: allowed && hasSearch && Boolean(reportDate),
  });
  const txns = useQuery({
    queryKey: ['manager-inventory-txn', search, branch, reportDate],
    queryFn: () => getManagerInventoryTransactions(search, branch, reportDate),
    enabled: allowed && hasSearch && Boolean(reportDate),
  });

  const totals = useMemo(() => ({
    qty: (inventory.data ?? []).reduce((sum, row) => sum + Number(row.qty ?? 0), 0),
    value: (inventory.data ?? []).reduce((sum, row) => sum + Number(row.inv_value ?? 0), 0),
    received: (txns.data ?? []).reduce((sum, row) => sum + Number(row.received ?? 0), 0),
    issued: (txns.data ?? []).reduce((sum, row) => sum + Number(row.issued ?? 0), 0),
  }), [inventory.data, txns.data]);

  if (!allowed) return <View style={styles.center}><StateView icon="alert" tone="error" title="Manager Dashboard unavailable" message="This workspace is available only to Manager and Developer roles." /></View>;

  function onDateChange(event: DateTimePickerEvent, value?: Date) {
    setShowDate(false);
    if (event.type === 'dismissed' || !value) return;
    setReportDate(dateInput(value));
    setBranch('all');
  }

  const failed = inventory.isError || txns.isError;

  async function exportInventory() {
    await shareCsv(
      `manager-inventory-${reportDate || 'latest'}.csv`,
      ['Report Date','Branch Key','Branch Code','Branch Name','Part No','Item Name','Group','UOM','Qty','DNP','Value'],
      (inventory.data ?? []).map((row) => [row.report_date,row.branch_key,row.branch_code,row.branch_name,row.item_code,row.item_name,row.item_group,row.uom,row.qty,row.dnp,row.inv_value]),
    );
  }

  async function exportTransactions() {
    await shareCsv(
      `manager-inventory-transactions-${reportDate || 'latest'}.csv`,
      ['Report Date','Branch Key','Branch Code','Branch Name','Part No','Item Name','Group','Received','Issued','Closing Balance','Value'],
      (txns.data ?? []).map((row) => [row.report_date,row.branch_key,row.branch_code,row.branch_name,row.item_code,row.item_name,row.item_group,row.received,row.issued,row.closing_balance,row.closing_value]),
    );
  }

  return (
    <Screen title="Manager Dashboard" subtitle={`Inventory position and movement${reportDate ? ` • ${reportDate}` : ''}`}>
      <View style={styles.toolbar}>
        <View style={styles.search}>
          <AppIcon name="search" size={18} color={colors.textMuted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Enter part number" autoCapitalize="characters" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
        </View>
        <Pressable onPress={() => setShowDate(true)} style={styles.dateButton}>
          <AppIcon name="clock" size={17} color={colors.navy} />
          <Text style={styles.dateText}>{reportDate || 'Select date'}</Text>
        </Pressable>
      </View>

      {showDate ? <DateTimePicker value={parseDate(reportDate || latest.data || '')} mode="date" display="default" onChange={onDateChange} /> : null}

      {hasSearch ? <View style={styles.exportRow}>
        <Pressable disabled={!(inventory.data ?? []).length} onPress={() => void exportInventory()} style={[styles.exportButton, !(inventory.data ?? []).length && styles.disabled]}><AppIcon name="package" size={16} color={colors.navy}/><Text style={styles.exportText}>Export Inventory</Text></Pressable>
        <Pressable disabled={!(txns.data ?? []).length} onPress={() => void exportTransactions()} style={[styles.exportButton, !(txns.data ?? []).length && styles.disabled]}><AppIcon name="truck" size={16} color={colors.navy}/><Text style={styles.exportText}>Export Movement</Text></Pressable>
      </View> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable onPress={() => setBranch('all')} style={[styles.chip, branch === 'all' && styles.chipActive]}><Text style={[styles.chipText, branch === 'all' && styles.chipTextActive]}>All Branches</Text></Pressable>
        {(branches.data ?? []).map((item) => <Pressable key={item.key} onPress={() => setBranch(item.key)} style={[styles.chip, branch === item.key && styles.chipActive]}><Text style={[styles.chipText, branch === item.key && styles.chipTextActive]}>{item.label}</Text></Pressable>)}
      </ScrollView>

      {!hasSearch ? <StateView icon="package" title="Search inventory" message="Enter a part number to see stock, value and received/issued movement across branches." /> : null}

      {hasSearch ? <View style={styles.metrics}><Metric label="Closing Qty" value={String(totals.qty)} /><Metric label="Inventory Value" value={formatMoney(totals.value)} /><Metric label="Received" value={String(totals.received)} /><Metric label="Issued" value={String(totals.issued)} /></View> : null}

      {(inventory.isLoading || txns.isLoading) && hasSearch ? <View style={styles.loading}><ActivityIndicator color={colors.navy} /><Text style={styles.loadingText}>Loading inventory position…</Text></View> : null}

      {failed && hasSearch ? <StateView icon="alert" tone="error" title="Inventory could not be loaded" message="The inventory or movement request failed." actionLabel="Retry" onAction={() => { void inventory.refetch(); void txns.refetch(); }} /> : null}

      {!failed && (inventory.data ?? []).map((row) => <View key={row.id} style={styles.card}><View style={styles.top}><View style={styles.copy}><Text style={styles.part}>{row.item_code}</Text><Text style={styles.desc}>{row.item_name || 'No description'}</Text></View><Text style={styles.qty}>{Number(row.qty ?? 0)}</Text></View><View style={styles.grid}><Mini label="Branch" value={row.branch_name || row.branch_key || row.branch_code} /><Mini label="Group" value={row.item_group || '—'} /><Mini label="DNP" value={formatMoney(Number(row.dnp ?? 0))} /><Mini label="Value" value={formatMoney(Number(row.inv_value ?? 0))} /></View></View>)}

      {hasSearch && !inventory.isLoading && !failed && (inventory.data ?? []).length === 0 ? <StateView icon="inbox" title="No inventory rows" message="No inventory position matches this part, date and branch selection." /> : null}

      {hasSearch && !failed && (txns.data ?? []).length ? <><Text style={styles.section}>Movement</Text>{(txns.data ?? []).map((row) => <View key={`txn-${row.id}`} style={styles.card}><View style={styles.movementTitle}><AppIcon name="truck" size={17} color={colors.blue} /><Text style={styles.part}>{row.item_code} • {row.branch_name || row.branch_code}</Text></View><View style={styles.grid}><Mini label="Received" value={String(Number(row.received ?? 0))} /><Mini label="Issued" value={String(Number(row.issued ?? 0))} /><Mini label="Closing" value={String(Number(row.closing_balance ?? 0))} /><Mini label="Value" value={formatMoney(Number(row.closing_value ?? 0))} /></View></View>)}</> : null}
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function Mini({ label, value }: { label: string; value: string }) { return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text numberOfLines={1} style={styles.miniValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  toolbar: { gap: spacing.sm },
  search: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, minHeight: 46, color: colors.text, fontSize: 14, fontWeight: '700' },
  dateButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  dateText: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  exportRow:{flexDirection:'row',gap:spacing.sm},exportButton:{flex:1,minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:spacing.sm,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},exportText:{color:colors.navy,fontSize:10,fontWeight:'900'},disabled:{opacity:.4},
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: '#fff' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { width: '48%', padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  metricLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  metricValue: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  loadingText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  card: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  copy: { flex: 1 },
  part: { color: colors.text, fontWeight: '900', fontSize: 13 },
  desc: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  qty: { color: colors.blue, fontWeight: '900', fontSize: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mini: { width: '47%' },
  miniLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  miniValue: { color: colors.text, fontSize: 11, fontWeight: '800', marginTop: 2 },
  section: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: spacing.xs },
  movementTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
});
