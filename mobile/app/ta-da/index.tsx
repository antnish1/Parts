import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
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
    <Screen title="TA/DA" subtitle={`${visible.length} dispatches · physical SVR custody`} scroll={false}>
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
              {canCreate?<Pressable onPress={()=>router.push('/ta-da/new')} style={styles.newButton}><AppIcon name="package" size={14} color="#fff"/><Text style={styles.newButtonText}>New</Text></Pressable>:null}
            </View>

            {role==='developer'?<View style={styles.developerNote}><AppIcon name="alert" size={14} color={colors.danger}/><Text style={styles.developerNoteText}><Text style={styles.developerNoteStrong}>Developer controls active.</Text> Open a dispatch for audited edit/delete.</Text></View>:null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {order.map((status) => <StageChip key={status} label={tadaStatusLabel(status)} value={counts[status] ?? 0} active={filter === status} onPress={() => toggle(status)} />)}
              <StageChip label="All" value={data.length} active={filter === 'ALL'} onPress={() => setFilter('ALL')} />
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => <TadaRow item={item} />}
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
      <View style={styles.rowIcon}><AppIcon name="work" size={15} color={colors.navy}/></View>
      <View style={styles.copy}>
        <View style={styles.topLine}>
          <Text numberOfLines={1} style={styles.no}>{item.dispatch_no}</Text>
          <StatusChip status={item.status}/>
        </View>
        <Text numberOfLines={1} style={styles.office}>{item.branch_name_snapshot} · {item.dispatch_mode}</Text>
        <Text numberOfLines={1} style={styles.meta}>{item.total_svr_count} SVR · {item.dispatch_date} · {item.reference_no || 'No ref.'} · {item.dispatched_by}</Text>
      </View>
      <AppIcon name="chevronRight" size={15} color="#94A3B8"/>
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
  center:{flex:1,justifyContent:'center',padding:spacing.xl,backgroundColor:colors.background},
  list:{gap:7,paddingBottom:spacing.xxl},
  header:{gap:8,marginBottom:8},
  topActions:{flexDirection:'row',gap:7},
  search:{flex:1,minHeight:42,flexDirection:'row',alignItems:'center',gap:7,borderRadius:11,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff',paddingHorizontal:10},
  searchInput:{flex:1,minHeight:40,color:colors.text,fontSize:11},
  newButton:{minWidth:66,minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:9,borderRadius:11,backgroundColor:colors.navy},
  newButtonText:{color:'#fff',fontSize:9,fontWeight:'900'},
  developerNote:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:9,paddingVertical:7,borderRadius:10,borderWidth:1,borderColor:'#F3C4C4',backgroundColor:colors.dangerSoft},
  developerNoteText:{flex:1,color:colors.textMuted,fontSize:8,lineHeight:12},
  developerNoteStrong:{color:colors.danger,fontWeight:'900'},
  filters:{gap:6,paddingRight:10},
  stageChip:{maxWidth:150,minHeight:34,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:9,borderRadius:999,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  stageChipActive:{backgroundColor:colors.navy,borderColor:colors.navy},
  stageValue:{color:colors.navy,fontSize:9.5,fontWeight:'900'},
  stageValueActive:{color:'#fff'},
  stageLabel:{maxWidth:115,color:colors.textMuted,fontSize:8,fontWeight:'800'},
  stageLabelActive:{color:'#fff'},
  row:{minHeight:62,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:9,paddingVertical:8,borderRadius:12,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  pressed:{opacity:.8},
  rowIcon:{width:30,height:30,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:'#EEF3F8'},
  copy:{flex:1},
  topLine:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6},
  no:{flex:1,color:colors.text,fontSize:9.5,fontWeight:'900'},
  office:{color:colors.textMuted,fontSize:8.5,fontWeight:'700',marginTop:2},
  meta:{color:'#7C8796',fontSize:7.5,fontWeight:'700',marginTop:3},
});
