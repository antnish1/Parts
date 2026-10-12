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
import { colors, spacing } from '@/theme/tokens';

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

  if (!allowed) return <View style={styles.center}><StateView icon="alert" tone="error" title="Manager Inventory unavailable" message="This workspace is available only to Manager and Developer roles." /></View>;

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
    <Screen title="Inventory" subtitle="Stock position and movement">
      <View style={styles.toolbar}>
        <View style={styles.search}>
          <AppIcon name="search" size={16} color={colors.textMuted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Part number" autoCapitalize="characters" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
        </View>
        <Pressable onPress={() => setShowDate(true)} style={styles.dateButton}>
          <AppIcon name="clock" size={15} color={colors.navy} />
          <Text style={styles.dateText}>{reportDate || 'Date'}</Text>
        </Pressable>
      </View>

      {showDate ? <DateTimePicker value={parseDate(reportDate || latest.data || '')} mode="date" display="default" onChange={onDateChange} /> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable onPress={() => setBranch('all')} style={[styles.chip, branch === 'all' && styles.chipActive]}><Text style={[styles.chipText, branch === 'all' && styles.chipTextActive]}>All</Text></Pressable>
        {(branches.data ?? []).map((item) => <Pressable key={item.key} onPress={() => setBranch(item.key)} style={[styles.chip, branch === item.key && styles.chipActive]}><Text style={[styles.chipText, branch === item.key && styles.chipTextActive]}>{item.label}</Text></Pressable>)}
      </ScrollView>

      {!hasSearch ? <StateView icon="package" title="Search a part" message="Enter a part number to view current stock and movement." /> : null}

      {hasSearch ? (
        <View style={styles.summaryStrip}>
          <Summary label="Qty" value={String(totals.qty)} />
          <Divider />
          <Summary label="Value" value={formatMoney(totals.value)} />
          <Divider />
          <Summary label="In" value={String(totals.received)} />
          <Divider />
          <Summary label="Out" value={String(totals.issued)} />
        </View>
      ) : null}

      {hasSearch ? (
        <View style={styles.exportRow}>
          <Pressable disabled={!(inventory.data ?? []).length} onPress={() => void exportInventory()} style={[styles.exportButton, !(inventory.data ?? []).length && styles.disabled]}><AppIcon name="package" size={14} color={colors.navy}/><Text style={styles.exportText}>Inventory CSV</Text></Pressable>
          <Pressable disabled={!(txns.data ?? []).length} onPress={() => void exportTransactions()} style={[styles.exportButton, !(txns.data ?? []).length && styles.disabled]}><AppIcon name="truck" size={14} color={colors.navy}/><Text style={styles.exportText}>Movement CSV</Text></Pressable>
        </View>
      ) : null}

      {(inventory.isLoading || txns.isLoading) && hasSearch ? <View style={styles.loading}><ActivityIndicator color={colors.navy} /><Text style={styles.loadingText}>Loading inventory…</Text></View> : null}
      {failed && hasSearch ? <StateView icon="alert" tone="error" title="Inventory could not be loaded" actionLabel="Retry" onAction={() => { void inventory.refetch(); void txns.refetch(); }} /> : null}

      {!failed && (inventory.data ?? []).length ? <Text style={styles.section}>Stock</Text> : null}
      {!failed && (inventory.data ?? []).map((row) => (
        <View key={row.id} style={styles.row}>
          <View style={styles.rowIcon}><AppIcon name="inventory" size={15} color={colors.navy}/></View>
          <View style={styles.rowCopy}>
            <View style={styles.rowTop}><Text style={styles.part}>{row.item_code}</Text><Text style={styles.qty}>{Number(row.qty ?? 0)}</Text></View>
            <Text numberOfLines={1} style={styles.desc}>{row.item_name || 'No description'}</Text>
            <Text numberOfLines={1} style={styles.meta}>{row.branch_name || row.branch_key || row.branch_code} · {row.item_group || '—'} · DNP {formatMoney(Number(row.dnp ?? 0))} · {formatMoney(Number(row.inv_value ?? 0))}</Text>
          </View>
        </View>
      ))}

      {hasSearch && !inventory.isLoading && !failed && (inventory.data ?? []).length === 0 ? <StateView icon="inbox" title="No stock rows" message="No inventory position matches this part, date and branch." /> : null}

      {hasSearch && !failed && (txns.data ?? []).length ? <Text style={styles.section}>Movement</Text> : null}
      {hasSearch && !failed && (txns.data ?? []).map((row) => (
        <View key={`txn-${row.id}`} style={styles.row}>
          <View style={styles.rowIcon}><AppIcon name="truck" size={15} color={colors.blue}/></View>
          <View style={styles.rowCopy}>
            <Text numberOfLines={1} style={styles.part}>{row.item_code} · {row.branch_name || row.branch_code}</Text>
            <View style={styles.movementLine}>
              <Text style={styles.moveIn}>In {Number(row.received ?? 0)}</Text>
              <Text style={styles.moveOut}>Out {Number(row.issued ?? 0)}</Text>
              <Text style={styles.moveClose}>Closing {Number(row.closing_balance ?? 0)}</Text>
              <Text style={styles.moveValue}>{formatMoney(Number(row.closing_value ?? 0))}</Text>
            </View>
          </View>
        </View>
      ))}
    </Screen>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <View style={styles.summary}><Text style={styles.summaryLabel}>{label}</Text><Text numberOfLines={1} style={styles.summaryValue}>{value}</Text></View>;
}
function Divider(){ return <View style={styles.divider}/>; }

const styles = StyleSheet.create({
  center:{flex:1,justifyContent:'center',padding:spacing.xl,backgroundColor:colors.background},
  toolbar:{flexDirection:'row',gap:7},
  search:{flex:1,minHeight:42,flexDirection:'row',alignItems:'center',gap:7,borderWidth:1,borderColor:'#E1E7EE',borderRadius:11,backgroundColor:'#fff',paddingHorizontal:10},
  searchInput:{flex:1,minHeight:40,color:colors.text,fontSize:11,fontWeight:'700'},
  dateButton:{minHeight:42,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9,borderRadius:11,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  dateText:{color:colors.navy,fontSize:9,fontWeight:'900'},
  chips:{gap:6,paddingRight:10},
  chip:{paddingHorizontal:10,paddingVertical:6,borderRadius:999,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  chipActive:{backgroundColor:colors.navy,borderColor:colors.navy},
  chipText:{color:colors.textMuted,fontSize:8.5,fontWeight:'800'},
  chipTextActive:{color:'#fff'},
  summaryStrip:{minHeight:48,flexDirection:'row',alignItems:'center',paddingHorizontal:8,borderRadius:12,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  summary:{flex:1,minWidth:0},
  summaryLabel:{color:colors.textMuted,fontSize:7.5,fontWeight:'800'},
  summaryValue:{color:colors.text,fontSize:10,fontWeight:'900',marginTop:2},
  divider:{width:StyleSheet.hairlineWidth,height:26,backgroundColor:'#DDE4EC'},
  exportRow:{flexDirection:'row',gap:7},
  exportButton:{flex:1,minHeight:36,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,borderRadius:10,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  exportText:{color:colors.navy,fontSize:8.5,fontWeight:'900'},
  disabled:{opacity:.4},
  loading:{flexDirection:'row',alignItems:'center',gap:7,paddingVertical:4},
  loadingText:{color:colors.textMuted,fontSize:9,fontWeight:'700'},
  section:{color:colors.text,fontSize:11,fontWeight:'900',marginTop:2},
  row:{minHeight:58,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:9,paddingVertical:8,borderRadius:12,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  rowIcon:{width:30,height:30,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:'#EEF3F8'},
  rowCopy:{flex:1},
  rowTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  part:{flex:1,color:colors.text,fontSize:9.5,fontWeight:'900'},
  qty:{color:colors.blue,fontSize:13,fontWeight:'900'},
  desc:{color:colors.textMuted,fontSize:8.5,marginTop:2},
  meta:{color:'#7B8796',fontSize:7.5,marginTop:3},
  movementLine:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:4},
  moveIn:{color:colors.success,fontSize:8,fontWeight:'900'},
  moveOut:{color:colors.danger,fontSize:8,fontWeight:'900'},
  moveClose:{color:colors.navy,fontSize:8,fontWeight:'900'},
  moveValue:{color:colors.textMuted,fontSize:8,fontWeight:'800'},
});
