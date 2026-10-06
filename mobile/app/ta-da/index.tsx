import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { getTadaDispatches, TADA_STATUSES, tadaStatusLabel, type TadaDispatch } from '@/services/tada';
import { colors, radius, spacing } from '@/theme/tokens';

type Filter = 'ALL' | typeof TADA_STATUSES[number];

export default function TadaTrackingScreen() {
  const { role } = useAuth();
  const allowed = ['branch', 'manager', 'hq', 'developer', 'accounts'].includes(role ?? '');
  const query = useQuery({ queryKey: ['tada-dispatches'], queryFn: getTadaDispatches, enabled: allowed });
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const data = query.data ?? [];
  const canCreate = ['branch', 'manager', 'hq', 'developer'].includes(role ?? '');
  const order = useMemo(() => role === 'accounts' ? ['AWAITING_ACCOUNTS_RECEIPT', 'PARTIALLY_RECEIVED_ACCOUNTS', 'COMPLETED', 'AWAITING_HQ_RECEIPT', 'PARTIALLY_RECEIVED_HQ'] as const : role === 'manager' ? ['AWAITING_HQ_RECEIPT', 'PARTIALLY_RECEIVED_HQ', 'AWAITING_ACCOUNTS_RECEIPT', 'PARTIALLY_RECEIVED_ACCOUNTS', 'COMPLETED'] as const : TADA_STATUSES, [role]);
  const counts = useMemo(() => Object.fromEntries(TADA_STATUSES.map((status) => [status, data.filter((item) => item.status === status).length])) as Record<string, number>, [data]);
  const visible = useMemo(() => { const needle = search.trim().toLowerCase(); return data.filter((item) => filter === 'ALL' || item.status === filter).filter((item) => !needle || [item.dispatch_no, item.branch_name_snapshot, item.dispatched_by, item.reference_no, item.dispatch_mode].some((value) => String(value ?? '').toLowerCase().includes(needle))); }, [data, filter, search]);

  if (!allowed) return <View style={styles.center}><Text style={styles.error}>TA/DA is not available for this role.</Text></View>;
  function toggle(status: Filter) { setFilter((current) => current === status ? 'ALL' : status); }

  return <Screen title="TA/DA Bill Tracking" subtitle={`${visible.length} dispatch(es) · physical SVR custody`} scroll={false}>
    <FlatList
      data={visible}
      keyExtractor={(item) => item.id}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<View style={styles.header}><View style={styles.topActions}><View style={styles.search}><AppIcon name="search" size={18} color={colors.textMuted}/><TextInput value={search} onChangeText={setSearch} placeholder="Dispatch, office, ref. or person…" placeholderTextColor={colors.textMuted} style={styles.searchInput}/></View>{canCreate?<Pressable onPress={()=>router.push('/ta-da/new')} style={styles.newButton}><AppIcon name="package" size={16} color="#fff"/><Text style={styles.newButtonText}>New</Text></Pressable>:null}</View>{role==='developer'?<View style={styles.developerNote}><AppIcon name="alert" size={16} color={colors.danger}/><Text style={styles.developerNoteText}><Text style={styles.developerNoteStrong}>Developer controls active.</Text> Open a dispatch to edit or delete with a mandatory audit reason.</Text></View>:null}<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metrics}>{order.map((status) => <MetricCard key={status} label={tadaStatusLabel(status)} value={counts[status] ?? 0} active={filter === status} onPress={() => toggle(status)} />)}<MetricCard label="All" value={data.length} active={filter === 'ALL'} onPress={() => setFilter('ALL')} /></ScrollView></View>}
      renderItem={({ item }) => <TadaCard item={item} />}
      ListEmptyComponent={!query.isLoading ? (query.isError ? <StateView icon="alert" tone="error" title="TA/DA tracking could not be loaded" message="Check your connection and retry." actionLabel="Retry" onAction={()=>void query.refetch()}/> : <StateView icon="inbox" title="No TA/DA dispatches" message="No dispatches match the selected stage and search."/>) : null}
    />
  </Screen>;
}
function TadaCard({ item }: { item: TadaDispatch }) { return <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push(`/ta-da/${item.id}`)}><View style={styles.top}><View style={styles.copy}><Text style={styles.no}>{item.dispatch_no}</Text><Text style={styles.office}>{item.branch_name_snapshot}</Text></View><View style={styles.status}><Text style={styles.statusText}>{tadaStatusLabel(item.status)}</Text></View></View><View style={styles.grid}><Mini label="SVRs" value={String(item.total_svr_count)} /><Mini label="Dispatch" value={item.dispatch_date} /><Mini label="Mode" value={item.dispatch_mode} /><Mini label="Ref." value={item.reference_no || '—'} /></View><Text style={styles.by}>By {item.dispatched_by}</Text></Pressable>; }
function Mini({ label, value }: { label: string; value: string }) { return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text numberOfLines={1} style={styles.miniValue}>{value}</Text></View>; }
const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, error: { color: colors.danger }, list: { gap: spacing.sm, paddingBottom: spacing.xxl }, header:{gap:spacing.md,marginBottom:spacing.md},topActions:{flexDirection:'row',gap:spacing.sm},search:{flex:1,minHeight:48,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:spacing.md},searchInput:{flex:1,minHeight:46,color:colors.text,fontSize:14},newButton:{minWidth:78,minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:spacing.md,borderRadius:radius.md,backgroundColor:colors.navy},newButtonText:{color:'#fff',fontSize:11,fontWeight:'900'},developerNote:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,borderWidth:1,borderColor:'#F3C4C4',backgroundColor:colors.dangerSoft},developerNoteText:{flex:1,color:colors.textMuted,fontSize:9,lineHeight:14},developerNoteStrong:{color:colors.danger,fontWeight:'900'},metrics:{gap:spacing.sm,paddingRight:spacing.lg}, card: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, pressed: { opacity: 0.8 }, top: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, copy: { flex: 1 }, no: { color: colors.blue, fontSize: 14, fontWeight: '900' }, office: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 2 }, status: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.warningSoft }, statusText: { color: colors.warning, fontSize: 9, fontWeight: '900' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }, mini: { width: '47%' }, miniLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700' }, miniValue: { color: colors.text, fontSize: 11, fontWeight: '800', marginTop: 2 }, by: { color: colors.textMuted, fontSize: 10, textAlign: 'right', marginTop: spacing.sm } });
