import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { TadaDeveloperControls } from '@/components/TadaDeveloperControls';
import { Screen } from '@/components/Screen';
import { AppIcon } from '@/components/AppIcon';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { StateView } from '@/components/StateView';
import { getTadaDispatch, receiveTadaDispatch, tadaLocationLabel, tadaStatusLabel, type TadaSvrItem } from '@/services/tada';
import { colors, radius, spacing } from '@/theme/tokens';

type Stage = 'HQ' | 'ACCOUNTS';

export default function TadaDetailScreen() {
  const params = useLocalSearchParams<{ dispatchId: string }>();
  const dispatchId = Array.isArray(params.dispatchId) ? params.dispatchId[0] : params.dispatchId;
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['tada-detail', dispatchId], queryFn: () => getTadaDispatch(dispatchId), enabled: Boolean(dispatchId) });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const stage = useMemo<Stage | null>(() => {
    const status = detail.data?.dispatch.status ?? '';
    if ((role === 'manager' || role === 'developer') && status === 'AWAITING_HQ_RECEIPT') return 'HQ';
    if ((role === 'accounts' || role === 'developer') && ['AWAITING_ACCOUNTS_RECEIPT', 'PARTIALLY_RECEIVED_HQ'].includes(status)) return 'ACCOUNTS';
    return null;
  }, [detail.data?.dispatch.status, role]);

  const eligible = useMemo(() => {
    const items = detail.data?.items ?? [];
    if (stage === 'HQ') return items.filter((item) => item.hq_received !== true);
    if (stage === 'ACCOUNTS') return items.filter((item) => item.hq_received === true && item.accounts_received !== true);
    return [];
  }, [detail.data?.items, stage]);

  const eligibilityKey = eligible.map((item) => item.id).join('|');
  useEffect(() => {
    if (!eligible.length) return;
    setSelected(Object.fromEntries(eligible.map((item) => [item.id, true])));
    setReasons({});
    setRemarks({});
  }, [detail.data?.dispatch.id, stage, eligibilityKey]);

  const receipt = useMutation({
    mutationFn: async () => {
      if (!stage) return;
      const results = eligible.map((item) => ({
        svr_item_id: item.id,
        received: selected[item.id] !== false,
        exception_reason: selected[item.id] === false ? (reasons[item.id] ?? '').trim() : '',
        remark: (remarks[item.id] ?? '').trim(),
      }));
      if (results.some((row) => !row.received && !row.exception_reason)) throw new Error('Every not-received SVR requires a reason.');
      await receiveTadaDispatch(dispatchId, stage, results);
    },
    onSuccess: async () => {
      setMessage(`${stage === 'HQ' ? 'HQ' : 'Accounts'} receipt saved.`);
      await detail.refetch();
      await queryClient.invalidateQueries({ queryKey: ['tada-dispatches'] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Receipt failed.'),
  });

  if (detail.isLoading) return <Screen title="TA/DA Dispatch"><SkeletonLoader rows={5}/></Screen>;
  if (!detail.data || detail.isError) return <Screen title="TA/DA Dispatch"><StateView icon="alert" tone="error" title="Unable to load TA/DA dispatch" actionLabel="Retry" onAction={()=>void detail.refetch()}/></Screen>;
  const { dispatch, items, events } = detail.data;

  return (
    <Screen title="TA/DA Dispatch" scroll={false}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroTop}><View style={styles.heroIcon}><AppIcon name="clipboardCheck" size={19} color="#FFFFFF"/></View><View style={styles.heroCopy}><Text numberOfLines={1} style={styles.no}>{dispatch.dispatch_no}</Text><Text style={styles.office}>{dispatch.branch_name_snapshot}</Text></View><View style={styles.status}><Text style={styles.statusText}>{tadaStatusLabel(dispatch.status)}</Text></View></View>
          <View style={styles.heroSummary}><HeroMini label="SVRs" value={String(dispatch.total_svr_count)} /><HeroDivider/><HeroMini label="Date" value={dispatch.dispatch_date} /><HeroDivider/><HeroMini label="Mode" value={dispatch.dispatch_mode} /></View>
        </View>

        <Text style={styles.sectionTitle}>Custody journey</Text>
        <View style={styles.journey}><Step label="Branch" done /><Step label="HQ" done={items.every((item) => item.hq_received === true)} active={dispatch.status.includes('HQ')} /><Step label="Accounts" done={items.every((item) => item.accounts_received === true)} active={dispatch.status.includes('ACCOUNTS')} /></View>

        <View style={styles.metaCard}><MetaMini label="Dispatched by" value={dispatch.dispatched_by}/><View style={styles.metaDivider}/><MetaMini label="Reference" value={dispatch.reference_no || '—'}/></View>

        {role === 'developer' ? <TadaDeveloperControls
          dispatch={dispatch}
          items={items}
          onChanged={async () => {
            await Promise.all([
              detail.refetch(),
              queryClient.invalidateQueries({ queryKey: ['tada-dispatches'] }),
            ]);
          }}
          onDispatchDeleted={() => router.replace('/ta-da')}
        /> : null}

        <Text style={styles.sectionTitle}>SVR packet</Text>
        {items.map((item) => (
          <SvrCard
            key={item.id}
            item={item}
            receiptStage={stage}
            eligible={eligible.some((candidate) => candidate.id === item.id)}
            checked={selected[item.id] !== false}
            reason={reasons[item.id] ?? ''}
            remark={remarks[item.id] ?? ''}
            onToggle={(value) => setSelected((current) => ({ ...current, [item.id]: value }))}
            onReason={(value) => setReasons((current) => ({ ...current, [item.id]: value }))}
            onRemark={(value) => setRemarks((current) => ({ ...current, [item.id]: value }))}
          />
        ))}

        <Pressable onPress={() => setShowHistory((value) => !value)} style={styles.historyToggle}><Text style={styles.historyToggleText}>{showHistory ? 'Hide traceability' : `Show traceability (${events.length})`}</Text></Pressable>
        {showHistory ? events.map((event) => <View key={event.id} style={styles.event}><View style={styles.eventDot} /><View style={styles.eventCopy}><Text style={styles.eventType}>{event.event_type}</Text><Text style={styles.eventMeta}>{event.actor_name_snapshot || 'System'} · {new Date(event.created_at).toLocaleString('en-IN')}</Text></View></View>) : null}
        {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
      </ScrollView>

      {stage && eligible.length ? <View style={styles.actionBar}><View style={styles.actionCopy}><Text style={styles.actionTitle}>{stage === 'HQ' ? 'HQ receipt' : 'Accounts receipt'}</Text><Text style={styles.actionMeta}>{eligible.filter((item) => selected[item.id] !== false).length}/{eligible.length} marked received</Text></View><Pressable disabled={receipt.isPending} onPress={() => receipt.mutate()} style={[styles.submit, receipt.isPending && styles.disabled]}>{receipt.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Receipt</Text>}</Pressable></View> : null}
    </Screen>
  );
}

function SvrCard({ item, receiptStage, eligible, checked, reason, remark, onToggle, onReason, onRemark }: { item: TadaSvrItem; receiptStage: Stage | null; eligible: boolean; checked: boolean; reason: string; remark: string; onToggle: (value: boolean) => void; onReason: (value: string) => void; onRemark: (value: string) => void }) {
  return (
    <View style={[styles.svrCard, eligible && styles.svrActionable]}>
      <View style={styles.svrTop}><View style={styles.svrCopy}><Text style={styles.svrNo}>{item.svr_no}</Text><Text style={styles.engineer}>{item.engineer_name_snapshot}</Text></View><View style={styles.location}><Text style={styles.locationText}>{tadaLocationLabel(item.current_location)}</Text></View></View>
      <View style={styles.svrGrid}><DataMini label="Machine" value={item.machine_no} /><DataMini label="Customer" value={item.customer_name} /><DataMini label="From" value={item.date_from} /><DataMini label="To" value={item.date_to} /></View>
      {eligible && receiptStage ? <View style={styles.receiptBox}><View style={styles.receiptRow}><View style={styles.receiptCopy}><Text style={styles.receiptLabel}>Received at {receiptStage === 'HQ' ? 'HQ' : 'Accounts'}</Text><Text style={styles.receiptHelp}>Uncheck only if this physical SVR is missing.</Text></View><Switch value={checked} onValueChange={onToggle} trackColor={{ false: '#F2C5C5', true: '#BFE8D8' }} thumbColor={checked ? colors.success : colors.danger} /></View>{!checked ? <TextInput value={reason} onChangeText={onReason} placeholder="Reason required for not received" placeholderTextColor={colors.textMuted} style={styles.reasonInput} /> : null}<TextInput value={remark} onChangeText={onRemark} placeholder="Optional remark" placeholderTextColor={colors.textMuted} style={styles.remarkInput} /></View> : null}
    </View>
  );
}
function HeroMini({ label, value }: { label: string; value: string }) { return <View style={styles.heroMini}><Text style={styles.heroMiniLabel}>{label}</Text><Text numberOfLines={1} style={styles.heroMiniValue}>{value}</Text></View>; }
function HeroDivider(){return <View style={styles.heroDivider}/>;}
function MetaMini({label,value}:{label:string;value:string}){return <View style={styles.metaMini}><Text style={styles.metaMiniLabel}>{label}</Text><Text numberOfLines={1} style={styles.metaMiniValue}>{value}</Text></View>;}
function DataMini({ label, value }: { label: string; value: string }) { return <View style={styles.dataMini}><Text style={styles.dataMiniLabel}>{label}</Text><Text numberOfLines={1} style={styles.dataMiniValue}>{value || '—'}</Text></View>; }
function Step({ label, done = false, active = false }: { label: string; done?: boolean; active?: boolean }) { return <View style={styles.step}><View style={[styles.stepDot, done && styles.stepDone, active && styles.stepActive]} /><Text style={[styles.stepText, (done || active) && styles.stepTextStrong]}>{label}</Text></View>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background }, error: { color: colors.danger, fontSize: 13 }, content: { gap: spacing.md, paddingBottom: spacing.xl },
  hero: { padding:14,borderRadius:18,backgroundColor:colors.navy }, heroTop:{flexDirection:'row',alignItems:'flex-start',gap:8},heroIcon:{width:38,height:38,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.12)'},heroCopy:{flex:1,minWidth:0}, no: { color: '#fff', fontSize: 14.5, lineHeight:18,fontWeight: '900' }, office: { color: '#D6E7FF', fontSize: 10, marginTop: 2 }, status: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.warningSoft }, statusText: { color: colors.warning, fontSize: 8.5, fontWeight: '900' }, heroSummary: { minHeight:48,flexDirection:'row',alignItems:'stretch',marginTop:12,borderRadius:9,backgroundColor:'rgba(255,255,255,.08)',overflow:'hidden' }, heroMini: { flex: 1,justifyContent:'center',paddingHorizontal:8 }, heroMiniLabel: { color: '#AFC7E2', fontSize: 8, fontWeight: '700' }, heroMiniValue: { color: '#fff', fontSize: 10, fontWeight: '900', marginTop: 2 },heroDivider:{width:StyleSheet.hairlineWidth,backgroundColor:'rgba(255,255,255,.18)',marginVertical:8},
  sectionTitle: { color: colors.text, fontSize: 13, fontWeight: '900' }, journey: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 13, backgroundColor: colors.surface }, step: { flex: 1, alignItems: 'center' }, stepDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.border }, stepDone: { backgroundColor: colors.success }, stepActive: { backgroundColor: colors.warning }, stepText: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 5 }, stepTextStrong: { color: colors.text, fontWeight: '900' },
  metaCard:{minHeight:54,flexDirection:'row',alignItems:'stretch',borderRadius:12,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,overflow:'hidden'},metaMini:{flex:1,minWidth:0,justifyContent:'center',paddingHorizontal:10},metaMiniLabel:{color:colors.textMuted,fontSize:8,fontWeight:'700'},metaMiniValue:{color:colors.text,fontSize:10,fontWeight:'900',marginTop:2},metaDivider:{width:1,backgroundColor:colors.border,marginVertical:9}, row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, rowLast: { borderBottomWidth: 0 }, rowLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' }, rowValue: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 11, fontWeight: '800' },
  svrCard: { padding: 12, gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, svrActionable: { borderColor: '#B8D3F8', backgroundColor: '#F8FBFF' }, svrTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, svrCopy: { flex: 1 }, svrNo: { color: colors.text, fontSize: 12, fontWeight: '900' }, engineer: { color: colors.textMuted, fontSize: 9.5, marginTop: 2 }, location: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.blueSoft }, locationText: { color: colors.info, fontSize: 9, fontWeight: '900' }, svrGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, dataMini: { width: '47%' }, dataMiniLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700' }, dataMiniValue: { color: colors.text, fontSize: 11, fontWeight: '800', marginTop: 2 },
  receiptBox: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, receiptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, receiptCopy: { flex: 1 }, receiptLabel: { color: colors.text, fontSize: 12, fontWeight: '900' }, receiptHelp: { color: colors.textMuted, fontSize: 8, marginTop: 2 }, reasonInput: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerSoft, color: colors.text, fontSize: 12 }, remarkInput: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', color: colors.text, fontSize: 12 },
  historyToggle: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, historyToggleText: { color: colors.navy, fontSize: 11, fontWeight: '900' }, event: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs }, eventDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, backgroundColor: colors.blue }, eventCopy: { flex: 1 }, eventType: { color: colors.text, fontSize: 11, fontWeight: '900' }, eventMeta: { color: colors.textMuted, fontSize: 9, marginTop: 2 }, message: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.blueSoft }, messageText: { color: colors.navy, fontSize: 11, fontWeight: '700' },
  actionBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }, actionCopy: { flex: 1 }, actionTitle: { color: colors.text, fontSize: 12, fontWeight: '900' }, actionMeta: { color: colors.textMuted, fontSize: 9, marginTop: 2 }, submit: { minHeight: 48, minWidth: 126, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.navy }, submitText: { color: '#fff', fontSize: 12, fontWeight: '900' }, disabled: { opacity: 0.5 },
});
