import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { MotionView } from '@/components/MotionView';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { getTadaDispatches, TADA_STATUSES, tadaStatusLabel, type TadaDispatch } from '@/services/tada';
import { colors, spacing } from '@/theme/tokens';

type Filter = 'ALL' | typeof TADA_STATUSES[number];

export default function TadaTrackingScreen() {
  const { role } = useAuth();
  const allowed = ['branch', 'manager', 'hq', 'developer', 'accounts'].includes(role ?? '');
  const query = useQuery({ queryKey: ['tada-dispatches'], queryFn: getTadaDispatches, enabled: allowed });
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const data = query.data ?? [];
  const canCreate = ['branch', 'manager', 'hq', 'developer'].includes(role ?? '');

  const order = useMemo(
    () => role === 'accounts'
      ? ['AWAITING_ACCOUNTS_RECEIPT', 'PARTIALLY_RECEIVED_ACCOUNTS', 'COMPLETED', 'AWAITING_HQ_RECEIPT', 'PARTIALLY_RECEIVED_HQ'] as const
      : role === 'manager'
        ? ['AWAITING_HQ_RECEIPT', 'PARTIALLY_RECEIVED_HQ', 'AWAITING_ACCOUNTS_RECEIPT', 'PARTIALLY_RECEIVED_ACCOUNTS', 'COMPLETED'] as const
        : TADA_STATUSES,
    [role],
  );

  const counts = useMemo(
    () => Object.fromEntries(TADA_STATUSES.map((status) => [status, data.filter((item) => item.status === status).length])) as Record<string, number>,
    [data],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data
      .filter((item) => filter === 'ALL' || item.status === filter)
      .filter((item) => !needle || [item.dispatch_no, item.branch_name_snapshot, item.dispatched_by, item.reference_no, item.dispatch_mode].some((value) => String(value ?? '').toLowerCase().includes(needle)));
  }, [data, filter, search]);

  if (!allowed) return <View style={styles.center}><StateView icon="alert" tone="error" title="TA/DA unavailable" message="This workflow is not available for your role." /></View>;
  function toggle(status: Filter) { setFilter((current) => current === status ? 'ALL' : status); }

  return (
    <Screen title="TA/DA" scroll={false} right={canCreate ? <Pressable onPress={()=>router.push('/ta-da/new')} style={styles.titleNew}><Text style={styles.titleNewPlus}>+</Text><Text style={styles.titleNewText}>New</Text></Pressable> : undefined}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topActions}>
              <View style={styles.search}>
                <AppIcon name="search" size={16} color={colors.textMuted}/>
                <TextInput value={search} onChangeText={setSearch} placeholder="Dispatch, office, ref. or person…" placeholderTextColor={colors.textMuted} style={styles.searchInput}/>
              </View>
            </View>

            {role==='developer'?<View style={styles.developerNote}><AppIcon name="alert" size={14} color={colors.danger}/><Text style={styles.developerNoteText}><Text style={styles.developerNoteStrong}>Developer controls active.</Text> Open a dispatch for audited edit/delete.</Text></View>:null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {order.map((status) => <StageChip key={status} label={tadaStatusLabel(status)} value={counts[status] ?? 0} active={filter === status} onPress={() => toggle(status)} />)}
              <StageChip label="All" value={data.length} active={filter === 'ALL'} onPress={() => setFilter('ALL')} />
            </ScrollView>
          </View>
        }
        renderItem={({ item, index }) => <MotionView delay={Math.min(index * 26, 180)} trigger={filter}><TadaRow item={item} /></MotionView>}
        ListEmptyComponent={!query.isLoading ? (
          query.isError
            ? <StateView icon="alert" tone="error" title="TA/DA tracking could not be loaded" message="Check your connection and retry." actionLabel="Retry" onAction={()=>void query.refetch()}/>
            : <StateView icon="inbox" title="No TA/DA dispatches" message="No dispatches match the selected stage and search."/>
        ) : null}
      />
    </Screen>
  );
}

function TadaRow({ item }: { item: TadaDispatch }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={() => router.push(`/ta-da/${item.id}`)}>
      <View style={styles.topLine}>
        <View style={styles.copy}>
          <Text numberOfLines={1} ellipsizeMode="middle" style={styles.no}>{item.dispatch_no}</Text>
          <Text numberOfLines={1} style={styles.office}>{item.dispatched_by || 'Dispatcher unavailable'}</Text>
        </View>
        <View style={styles.statusSide}>
          <StatusChip status={item.status}/>
          <Text style={styles.date}>{item.dispatch_date}</Text>
        </View>
      </View>
      <View style={styles.details}>
        <View style={styles.detailCol}><Text style={styles.detailTitle}>Branch</Text><Text numberOfLines={1} style={styles.detailValue}>{item.branch_name_snapshot || '—'}</Text></View>
        <View style={[styles.detailCol, styles.detailDivider]}><Text style={styles.detailTitle}>Dispatch mode</Text><Text numberOfLines={1} style={styles.detailValue}>{item.dispatch_mode || '—'}</Text></View>
        <View style={[styles.detailCol, styles.detailDivider]}><Text style={styles.detailTitle}>SVRs</Text><Text style={styles.detailValue}>{item.total_svr_count}</Text></View>
      </View>
      <Text numberOfLines={1} style={styles.meta}>Ref: {item.reference_no || 'No ref.'}</Text>
    </Pressable>
  );
}

function StageChip({ label, value, active, onPress }: { label: string; value: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.stageChip, active && styles.stageChipActive]}>
      <Text style={[styles.stageValue, active && styles.stageValueActive]}>{value}</Text>
      <Text numberOfLines={1} style={[styles.stageLabel, active && styles.stageLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  list: { gap: 8, paddingBottom: spacing.xxl },
  header: { gap: 10, marginBottom: 5 },
  topActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  search: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12 },
  searchInput: { flex: 1, minHeight: 44, color: colors.text, fontSize: 12 },
  titleNew:{minHeight:32,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:4},titleNewPlus:{color:colors.success,fontSize:17,fontWeight:'900'},titleNewText:{color:colors.success,fontSize:11,fontWeight:'900'},
  developerNote: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#F3C4C4', backgroundColor: colors.dangerSoft },
  developerNoteText: { flex: 1, color: colors.textMuted, fontSize: 8, lineHeight: 12 },
  developerNoteStrong: { color: colors.danger, fontWeight: '900' },
  filters: { gap: 7, paddingRight: 10 },
  stageChip: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  stageChipActive: { backgroundColor: '#EAF2FF', borderColor: '#2756A4', borderBottomWidth: 3 },
  stageValue: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  stageValueActive: { color: '#173B78' },
  stageLabel: { color: '#677589', fontSize: 10, fontWeight: '800' },
  stageLabelActive: { color: '#173B78' },
  row: { padding: 12, gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pressed: { opacity: .8 },
  copy: { flex: 1, minWidth: 0, gap: 6 },
  topLine: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 7 },
  no: { color: colors.text, fontSize: 12, fontWeight: '900' },
  office: { color: colors.textMuted, fontSize: 10 },
  statusSide: { maxWidth: '49%', alignItems: 'flex-end', gap: 5 },
  date: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  details: { backgroundColor: '#EEF5FC', borderRadius: 9, paddingVertical: 10, flexDirection: 'row' },
  detailCol: { flex: 1, minWidth: 0, paddingHorizontal: 9, gap: 4 },
  detailDivider: { borderLeftWidth: 1, borderLeftColor: '#CFDDED' },
  detailTitle: { color: '#748297', fontSize: 9, fontWeight: '700' },
  detailValue: { color: '#152740', fontSize: 10, fontWeight: '900' },
  meta: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
});
