import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
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
    if ((role === 'manager' || role === 'developer') && ['AWAITING_HQ_RECEIPT', 'PARTIALLY_RECEIVED_HQ'].includes(status)) return 'HQ';
    if ((role === 'accounts' || role === 'developer') && ['AWAITING_ACCOUNTS_RECEIPT', 'PARTIALLY_RECEIVED_ACCOUNTS'].includes(status)) return 'ACCOUNTS';
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

  if (detail.isLoading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={colors.navy} /></SafeAreaView>;
  if (!detail.data || detail.isError) return <SafeAreaView style={styles.center}><Text style={styles.error}>Unable to load TA/DA dispatch.</Text></SafeAreaView>;
  const { dispatch, items, events } = detail.data;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹ Back</Text></Pressable>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>TA/DA DISPATCH</Text>
          <Text style={styles.no}>{dispatch.dispatch_no}</Text>
          <Text style={styles.office}>{dispatch.branch_name_snapshot}</Text>
          <View style={styles.status}><Text style={styles.statusText}>{tadaStatusLabel(dispatch.status)}</Text></View>
          <View style={styles.heroSummary}><HeroMini label="SVRs" value={String(dispatch.total_svr_count)} /><HeroMini label="Date" value={dispatch.dispatch_date} /><HeroMini label="Mode" value={dispatch.dispatch_mode} /></View>
        </View>

        <Text style={styles.sectionTitle}>Custody journey</Text>
        <View style={styles.journey}><Step label="Branch" done /><Step label="HQ" done={items.every((item) => item.hq_received === true)} active={dispatch.status.includes('HQ')} /><Step label="Accounts" done={items.every((item) => item.accounts_received === true)} active={dispatch.status.includes('ACCOUNTS')} /></View>

        <View style={styles.metaCard}><Row label="Dispatched by" value={dispatch.dispatched_by} /><Row label="Reference" value={dispatch.reference_no || '—'} last /></View>

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
    </SafeAreaView>
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
function DataMini({ label, value }: { label: string; value: string }) { return <View style={styles.dataMini}><Text style={styles.dataMiniLabel}>{label}</Text><Text numberOfLines={1} style={styles.dataMiniValue}>{value || '—'}</Text></View>; }
function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) { return <View style={[styles.row, last && styles.rowLast]}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>; }
function Step({ label, done = false, active = false }: { label: string; done?: boolean; active?: boolean }) { return <View style={styles.step}><View style={[styles.stepDot, done && styles.stepDone, active && styles.stepActive]} /><Text style={[styles.stepText, (done || active) && styles.stepTextStrong]}>{label}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background }, error: { color: colors.danger, fontSize: 13 }, content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  back: { minHeight: 38, justifyContent: 'center', alignSelf: 'flex-start' }, backText: { color: colors.blue, fontSize: 14, fontWeight: '800' },
  hero: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.navy }, eyebrow: { color: '#B7D8FF', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, no: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 3 }, office: { color: '#D6E7FF', fontSize: 12, marginTop: 3 }, status: { alignSelf: 'flex-start', marginTop: spacing.md, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.warningSoft }, statusText: { color: colors.warning, fontSize: 10, fontWeight: '900' }, heroSummary: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }, heroMini: { flex: 1 }, heroMiniLabel: { color: '#AFC7E2', fontSize: 9, fontWeight: '700' }, heroMiniValue: { color: '#fff', fontSize: 11, fontWeight: '900', marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '900' }, journey: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface }, step: { flex: 1, alignItems: 'center' }, stepDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.border }, stepDone: { backgroundColor: colors.success }, stepActive: { backgroundColor: colors.warning }, stepText: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 5 }, stepTextStrong: { color: colors.text, fontWeight: '900' },
  metaCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, rowLast: { borderBottomWidth: 0 }, rowLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' }, rowValue: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 11, fontWeight: '800' },
  svrCard: { padding: spacing.md, gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, svrActionable: { borderColor: '#B8D3F8', backgroundColor: '#F8FBFF' }, svrTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, svrCopy: { flex: 1 }, svrNo: { color: colors.text, fontSize: 14, fontWeight: '900' }, engineer: { color: colors.textMuted, fontSize: 11, marginTop: 2 }, location: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.blueSoft }, locationText: { color: colors.info, fontSize: 9, fontWeight: '900' }, svrGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, dataMini: { width: '47%' }, dataMiniLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700' }, dataMiniValue: { color: colors.text, fontSize: 11, fontWeight: '800', marginTop: 2 },
  receiptBox: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, receiptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, receiptCopy: { flex: 1 }, receiptLabel: { color: colors.text, fontSize: 12, fontWeight: '900' }, receiptHelp: { color: colors.textMuted, fontSize: 9, marginTop: 2 }, reasonInput: { minHeight: 46, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerSoft, color: colors.text, fontSize: 12 }, remarkInput: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', color: colors.text, fontSize: 12 },
  historyToggle: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, historyToggleText: { color: colors.navy, fontSize: 11, fontWeight: '900' }, event: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs }, eventDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, backgroundColor: colors.blue }, eventCopy: { flex: 1 }, eventType: { color: colors.text, fontSize: 11, fontWeight: '900' }, eventMeta: { color: colors.textMuted, fontSize: 9, marginTop: 2 }, message: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.blueSoft }, messageText: { color: colors.navy, fontSize: 11, fontWeight: '700' },
  actionBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }, actionCopy: { flex: 1 }, actionTitle: { color: colors.text, fontSize: 12, fontWeight: '900' }, actionMeta: { color: colors.textMuted, fontSize: 9, marginTop: 2 }, submit: { minHeight: 48, minWidth: 126, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.navy }, submitText: { color: '#fff', fontSize: 12, fontWeight: '900' }, disabled: { opacity: 0.5 },
});
