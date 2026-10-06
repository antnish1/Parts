import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { canManageInstallations, canViewInstallations, developerDeleteInstallationEntry, equipmentTypeLabel, installationStatusLabel, listInstallationEntries, listInstallationInvoices, type InstallationEntry } from '@/services/installations';
import { colors, spacing } from '@/theme/tokens';

type Filter = 'ALL' | 'PENDING' | 'ACCEPTANCE_PENDING' | 'ACCEPTED';

export default function InstallationsScreen() {
  const { profile } = useAuth();
  const allowed = canViewInstallations(profile);
  const canManage = canManageInstallations(profile);
  const isDeveloper = profile?.role === 'developer';
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'register' | 'invoice'>('register');
  const [deleteEntry, setDeleteEntry] = useState<InstallationEntry | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteMessage, setDeleteMessage] = useState('');

  const entries = useQuery({ queryKey: ['installation-entries'], queryFn: listInstallationEntries, enabled: allowed });
  const invoices = useQuery({ queryKey: ['installation-invoices'], queryFn: listInstallationInvoices, enabled: allowed && canManage });
  const data = entries.data ?? [];

  const counts = useMemo(() => ({
    ALL: data.length,
    PENDING: data.filter((r) => r.status === 'PENDING').length,
    ACCEPTANCE_PENDING: data.filter((r) => r.status === 'ACCEPTANCE_PENDING').length,
    ACCEPTED: data.filter((r) => r.status === 'ACCEPTED').length,
  }), [data]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data
      .filter((r) => filter === 'ALL' || r.status === filter)
      .filter((r) => !needle || [r.entry_no, r.branch, r.customer_name, r.invoice_no, r.jcb_invoice_no, r.equipment_no, r.dbms_no, r.dbms_invoice_no, r.svr_no, r.equipment_registration_no].some((v) => String(v ?? '').toLowerCase().includes(needle)));
  }, [data, filter, search]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteEntry) return;
      await developerDeleteInstallationEntry(deleteEntry.id, deleteReason);
    },
    onSuccess: async () => {
      const label = deleteEntry?.entry_no ?? 'Entry';
      setDeleteEntry(null);
      setDeleteReason('');
      setDeleteMessage(`${label} deleted. Permanent developer audit retained.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['installation-entries'] }),
        queryClient.invalidateQueries({ queryKey: ['installation-pending-count'] }),
      ]);
    },
    onError: (error) => setDeleteMessage(error instanceof Error ? error.message : 'Could not delete installation entry.'),
  });

  if (!allowed) return <View style={styles.center}><StateView icon="alert" tone="error" title="Engine & Breaker unavailable" message="This workflow is not available for your role." /></View>;

  return (
    <Screen title="Engine & Breaker" subtitle="Invoice, registration, completion and acceptance" scroll={false}>
      <View style={styles.segment}>
        <Pressable onPress={() => setMode('register')} style={[styles.segmentButton, mode === 'register' && styles.segmentActive]}><Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>Register</Text></Pressable>
        {canManage ? <Pressable onPress={() => setMode('invoice')} style={[styles.segmentButton, mode === 'invoice' && styles.segmentActive]}><Text style={[styles.segmentText, mode === 'invoice' && styles.segmentTextActive]}>Invoice</Text></Pressable> : null}
      </View>

      {mode === 'invoice' && canManage ? (
        <FlatList
          data={invoices.data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={invoices.isRefetching}
          onRefresh={() => void invoices.refetch()}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.invoiceHeader}>
              <Pressable onPress={() => router.push('/installations/invoice')} style={styles.addButton}><AppIcon name="package" size={14} color="#fff"/><Text style={styles.addText}>Add Invoice</Text></Pressable>
              <Text style={styles.countText}>{invoices.data?.length ?? 0} invoices</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowIcon}><AppIcon name="package" size={15} color={colors.navy}/></View>
              <View style={styles.copy}>
                <View style={styles.topLine}><Text numberOfLines={1} style={styles.no}>{item.jcb_invoice_no}</Text><Text style={styles.date}>{item.invoice_date}</Text></View>
                <Text numberOfLines={1} style={styles.meta}>{item.part_no} · {equipmentTypeLabel(item.equipment_type)} · Serial {item.serial_no}</Text>
                <View style={styles.bottomLine}>
                  <Text numberOfLines={1} style={styles.subMeta}>DBMS {item.dbms_no || '—'}</Text>
                  <StatusChip status={item.installation_id ? 'Registered' : 'Pending'} />
                </View>
              </View>
              <Pressable onPress={() => item.installation_id ? router.push(`/installations/${item.installation_id}`) : router.push({ pathname: '/installations/register', params: { invoiceId: item.id } })} style={styles.rowAction}><AppIcon name="chevronRight" size={15} color={colors.blue}/></Pressable>
            </View>
          )}
          ListEmptyComponent={!invoices.isLoading ? <StateView icon="inbox" title="No installation invoices" message="Invoice intake records will appear here." /> : null}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          refreshing={entries.isRefetching}
          onRefresh={() => void entries.refetch()}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              {isDeveloper?<View style={styles.developerNote}><AppIcon name="alert" size={14} color={colors.danger}/><Text style={styles.developerNoteText}><Text style={styles.developerNoteStrong}>Developer override.</Text> Delete requires an audited reason.</Text></View>:null}
              {deleteMessage?<Text style={styles.message}>{deleteMessage}</Text>:null}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                <StageChip label="Pending" value={counts.PENDING} active={filter === 'PENDING'} onPress={() => setFilter(filter === 'PENDING' ? 'ALL' : 'PENDING')} />
                <StageChip label="Acceptance" value={counts.ACCEPTANCE_PENDING} active={filter === 'ACCEPTANCE_PENDING'} onPress={() => setFilter(filter === 'ACCEPTANCE_PENDING' ? 'ALL' : 'ACCEPTANCE_PENDING')} />
                <StageChip label="Accepted" value={counts.ACCEPTED} active={filter === 'ACCEPTED'} onPress={() => setFilter(filter === 'ACCEPTED' ? 'ALL' : 'ACCEPTED')} />
                <StageChip label="All" value={counts.ALL} active={filter === 'ALL'} onPress={() => setFilter('ALL')} />
              </ScrollView>

              <View style={styles.search}>
                <AppIcon name="search" size={16} color={colors.textMuted}/>
                <TextInput value={search} onChangeText={setSearch} placeholder="Entry, invoice, serial, branch, customer…" placeholderTextColor={colors.textMuted} style={styles.searchInput}/>
              </View>
            </View>
          }
          renderItem={({ item }) => <EntryRow item={item} onDelete={isDeveloper ? () => { setDeleteReason(''); setDeleteMessage(''); setDeleteEntry(item); } : undefined} />}
          ListEmptyComponent={!entries.isLoading ? (
            entries.isError
              ? <StateView icon="alert" tone="error" title="Engine & Breaker could not be loaded" actionLabel="Retry" onAction={()=>void entries.refetch()}/>
              : <StateView icon="inbox" title="No installation entries" message="No entries match the selected status and search."/>
          ) : null}
        />
      )}

      <Modal visible={Boolean(deleteEntry)} transparent animationType="fade" onRequestClose={()=>!deleteMutation.isPending&&setDeleteEntry(null)}>
        <View style={styles.modalBackdrop}><View style={styles.dialog}>
          <Text style={styles.dialogTitle}>Delete {deleteEntry?.entry_no}?</Text>
          <Text style={styles.dialogText}>The live record will be removed only after the permanent developer audit snapshot is written.</Text>
          <TextInput value={deleteReason} onChangeText={setDeleteReason} multiline placeholder="Deletion reason required" placeholderTextColor={colors.textMuted} style={styles.reasonInput}/>
          <View style={styles.dialogActions}>
            <Pressable disabled={deleteMutation.isPending} onPress={()=>setDeleteEntry(null)}><Text style={styles.cancel}>Cancel</Text></Pressable>
            <Pressable disabled={deleteMutation.isPending||deleteReason.trim().length<3} onPress={()=>deleteMutation.mutate()} style={[styles.deleteButton,(deleteMutation.isPending||deleteReason.trim().length<3)&&styles.disabled]}>{deleteMutation.isPending?<ActivityIndicator color="#fff"/>:<Text style={styles.deleteButtonText}>Delete</Text>}</Pressable>
          </View>
        </View></View>
      </Modal>
    </Screen>
  );
}

function EntryRow({ item, onDelete }: { item: InstallationEntry; onDelete?: () => void }) {
  return (
    <Pressable onPress={() => router.push(`/installations/${item.id}`)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowIcon}><AppIcon name="package" size={15} color={colors.navy}/></View>
      <View style={styles.copy}>
        <View style={styles.topLine}><Text numberOfLines={1} style={styles.no}>{item.entry_no}</Text><StatusChip status={installationStatusLabel(item.status)}/></View>
        <Text numberOfLines={1} style={styles.meta}>{item.customer_name} · {item.branch}</Text>
        <Text numberOfLines={1} style={styles.subMeta}>{equipmentTypeLabel(item.equipment_type)} · JCB {item.jcb_invoice_no || item.invoice_no} · {item.equipment_no || 'Equipment pending'}</Text>
      </View>
      {onDelete?<Pressable onPress={onDelete} style={styles.deleteInline}><AppIcon name="x" size={14} color={colors.danger}/></Pressable>:<AppIcon name="chevronRight" size={15} color="#94A3B8"/>}
    </Pressable>
  );
}

function StageChip({ label, value, active, onPress }: { label: string; value: number; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.stageChip, active && styles.stageChipActive]}><Text style={[styles.stageValue, active && styles.stageValueActive]}>{value}</Text><Text style={[styles.stageLabel, active && styles.stageLabelActive]}>{label}</Text></Pressable>;
}

const styles=StyleSheet.create({
  center:{flex:1,justifyContent:'center',padding:spacing.xl,backgroundColor:colors.background},
  segment:{flexDirection:'row',gap:3,padding:3,borderRadius:11,backgroundColor:'#EAEFF5'},
  segmentButton:{flex:1,minHeight:34,alignItems:'center',justifyContent:'center',borderRadius:8},
  segmentActive:{backgroundColor:colors.navy},
  segmentText:{color:colors.textMuted,fontSize:9,fontWeight:'900'},
  segmentTextActive:{color:'#fff'},
  list:{gap:7,paddingBottom:spacing.xxl},
  header:{gap:8,marginBottom:8},
  invoiceHeader:{minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:8},
  addButton:{minHeight:36,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:12,borderRadius:10,backgroundColor:colors.navy},
  addText:{color:'#fff',fontSize:9,fontWeight:'900'},
  countText:{color:colors.textMuted,fontSize:8.5,fontWeight:'800'},
  filters:{gap:6,paddingRight:10},
  stageChip:{minHeight:34,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:9,borderRadius:999,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  stageChipActive:{backgroundColor:colors.navy,borderColor:colors.navy},
  stageValue:{color:colors.navy,fontSize:9.5,fontWeight:'900'},
  stageValueActive:{color:'#fff'},
  stageLabel:{color:colors.textMuted,fontSize:8,fontWeight:'800'},
  stageLabelActive:{color:'#fff'},
  search:{minHeight:42,flexDirection:'row',alignItems:'center',gap:7,borderRadius:11,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff',paddingHorizontal:10},
  searchInput:{flex:1,minHeight:40,color:colors.text,fontSize:11},
  developerNote:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:9,paddingVertical:7,borderRadius:10,borderWidth:1,borderColor:'#F3C4C4',backgroundColor:colors.dangerSoft},
  developerNoteText:{flex:1,color:colors.textMuted,fontSize:8,lineHeight:12},
  developerNoteStrong:{color:colors.danger,fontWeight:'900'},
  message:{color:colors.navy,fontSize:8.5,fontWeight:'700',paddingHorizontal:4},
  row:{minHeight:62,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:9,paddingVertical:8,borderRadius:12,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:'#fff'},
  pressed:{opacity:.8},
  rowIcon:{width:30,height:30,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:'#EEF3F8'},
  copy:{flex:1},
  topLine:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6},
  no:{flex:1,color:colors.text,fontSize:9.5,fontWeight:'900'},
  date:{color:colors.textMuted,fontSize:7.5,fontWeight:'700'},
  meta:{color:colors.textMuted,fontSize:8.5,fontWeight:'700',marginTop:2},
  subMeta:{color:'#7C8796',fontSize:7.5,fontWeight:'700',marginTop:3},
  bottomLine:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6,marginTop:3},
  rowAction:{width:28,height:34,alignItems:'center',justifyContent:'center'},
  deleteInline:{width:30,height:30,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:colors.dangerSoft},
  modalBackdrop:{flex:1,justifyContent:'center',padding:spacing.xl,backgroundColor:'rgba(2,6,23,.62)'},
  dialog:{gap:spacing.md,padding:spacing.lg,borderRadius:16,backgroundColor:'#fff'},
  dialogTitle:{color:colors.text,fontSize:15,fontWeight:'900'},
  dialogText:{color:colors.textMuted,fontSize:9,lineHeight:14},
  reasonInput:{minHeight:70,padding:10,borderRadius:11,borderWidth:1,borderColor:'#F1B7B7',backgroundColor:'#fff',color:colors.text,textAlignVertical:'top',fontSize:10},
  dialogActions:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:spacing.lg},
  cancel:{color:colors.textMuted,fontSize:9,fontWeight:'800'},
  deleteButton:{minWidth:84,minHeight:38,alignItems:'center',justifyContent:'center',borderRadius:10,backgroundColor:colors.danger},
  deleteButtonText:{color:'#fff',fontSize:9,fontWeight:'900'},
  disabled:{opacity:.45},
});
