import { useMemo, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { createTadaDispatch, getTadaBranches, getTadaEngineers, type TadaCreateItem, type TadaEngineer } from '@/services/tada';
import { colors, radius, spacing } from '@/theme/tokens';

type DateTarget = 'from' | 'to' | 'dispatch' | null;

function iso(date: Date) { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
function parse(value: string) { return value ? new Date(`${value}T00:00:00`) : new Date(); }
function addDays(value: string, days: number) { const date = parse(value); date.setDate(date.getDate() + Math.max(0, days - 1)); return iso(date); }
function inclusiveDays(from: string, to: string) { if (!from || !to) return 1; const diff = parse(to).getTime() - parse(from).getTime(); return diff >= 0 ? Math.floor(diff / 86400000) + 1 : 1; }

export default function NewTadaDispatchScreen() {
  const { profile, role } = useAuth();
  const allowed = ['branch', 'manager', 'hq', 'developer'].includes(role ?? '');
  const queryClient = useQueryClient();
  const branches = useQuery({ queryKey: ['tada-branches'], queryFn: getTadaBranches, enabled: allowed });
  const engineers = useQuery({ queryKey: ['tada-engineers'], queryFn: getTadaEngineers, enabled: allowed });
  const [office, setOffice] = useState(profile?.branch ?? '');
  const [items, setItems] = useState<TadaCreateItem[]>([]);
  const [svrNo, setSvrNo] = useState('');
  const [engineer, setEngineer] = useState<TadaEngineer | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [days, setDays] = useState('1');
  const [machineNo, setMachineNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [dispatchDate, setDispatchDate] = useState(iso(new Date()));
  const [dispatchedBy, setDispatchedBy] = useState(profile?.fullName ?? '');
  const [dispatchMode, setDispatchMode] = useState<'Bus' | 'Transport' | 'By Hand'>('Bus');
  const [referenceNo, setReferenceNo] = useState('');
  const [message, setMessage] = useState('');
  const [branchOpen, setBranchOpen] = useState(false);
  const [engineerOpen, setEngineerOpen] = useState(false);
  const [dateTarget, setDateTarget] = useState<DateTarget>(null);

  const officeEngineers = useMemo(() => { const exact = (engineers.data ?? []).filter((row) => row.branch_key === office); return exact.length ? exact : engineers.data ?? []; }, [engineers.data, office]);
  const mutation = useMutation({ mutationFn: createTadaDispatch, onSuccess: async (id) => { await queryClient.invalidateQueries({ queryKey: ['tada-dispatches'] }); router.replace(`/ta-da/${id}`); }, onError: (error) => setMessage(error instanceof Error ? error.message : 'Unable to create TA/DA dispatch.') });

  if (!allowed) return <SafeAreaView style={styles.center}><Text style={styles.error}>New TA/DA Dispatch is not available for this role.</Text></SafeAreaView>;

  function applyDate(value: Date) {
    const next = iso(value);
    if (dateTarget === 'from') { setDateFrom(next); const nextTo = !dateTo || dateTo < next ? next : dateTo; setDateTo(nextTo); setDays(String(inclusiveDays(next, nextTo))); }
    if (dateTarget === 'to') { if (dateFrom && next < dateFrom) { setMessage('Date To cannot be earlier than Date From.'); return; } setDateTo(next); setDays(String(inclusiveDays(dateFrom, next))); }
    if (dateTarget === 'dispatch') setDispatchDate(next);
  }

  function changeDays(value: string) { const numeric = Math.max(1, Math.min(60, Number(value || 1))); setDays(String(numeric)); if (dateFrom) setDateTo(addDays(dateFrom, numeric)); }
  function addSvr() {
    setMessage('');
    const normalized = svrNo.trim().toUpperCase();
    if (!normalized || !engineer || !dateFrom || !dateTo || !machineNo.trim() || !customerName.trim()) return setMessage('Complete all SVR fields before adding.');
    if (items.some((item) => item.svr_no.toUpperCase() === normalized)) return setMessage(`SVR ${normalized} is already added.`);
    setItems((current) => [...current, { svr_no: normalized, engineer_id: engineer.id, engineer_name: engineer.engineer_name, date_from: dateFrom, date_to: dateTo, machine_no: machineNo.trim().toUpperCase(), customer_name: customerName.trim() }]);
    setSvrNo(''); setEngineer(null); setDateFrom(''); setDateTo(''); setDays('1'); setMachineNo(''); setCustomerName('');
  }
  function submit() {
    setMessage('');
    if (!office) return setMessage('Select an Office.');
    if (!items.length) return setMessage('Add at least one SVR.');
    if (!dispatchDate || !dispatchedBy.trim()) return setMessage('Dispatch Date and Dispatched By are required.');
    if ((dispatchMode === 'Bus' || dispatchMode === 'Transport') && !referenceNo.trim()) return setMessage('Reference No. is required for Bus or Transport.');
    mutation.mutate({ branch: office, dispatchDate, dispatchedBy: dispatchedBy.trim(), dispatchMode, referenceNo: referenceNo.trim(), items });
  }

  const pickerValue = dateTarget === 'from' ? parse(dateFrom) : dateTarget === 'to' ? parse(dateTo || dateFrom) : parse(dispatchDate);
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹ Back</Text></Pressable>
    <View><Text style={styles.title}>New TA/DA Dispatch</Text><Text style={styles.subtitle}>Prepare the physical SVR packet for HQ.</Text></View>

    <Section title="1 · Office"><Pressable disabled={role === 'branch'} onPress={() => setBranchOpen(true)} style={[styles.select, role === 'branch' && styles.locked]}><Text style={styles.selectText}>{(branches.data ?? []).find((row) => row.branch_key === office)?.display_name || office || 'Select Office'}</Text></Pressable>{role === 'branch' ? <Text style={styles.help}>Locked to your branch.</Text> : null}</Section>

    <Section title="2 · Add SVR">
      <Field label="SVR No."><TextInput autoCapitalize="characters" value={svrNo} onChangeText={setSvrNo} style={styles.input} /></Field>
      <Field label="Service Engineer"><Pressable onPress={() => setEngineerOpen(true)} style={styles.select}><Text style={engineer ? styles.selectText : styles.placeholder}>{engineer?.engineer_name || 'Select engineer'}</Text></Pressable></Field>
      <View style={styles.twoCol}><Field label="Date From" flex><DateButton value={dateFrom} onPress={() => setDateTarget('from')} /></Field><Field label="No. of Days" flex><TextInput keyboardType="number-pad" value={days} onChangeText={changeDays} style={styles.input} /></Field></View>
      <Field label="Date To"><DateButton value={dateTo} onPress={() => setDateTarget('to')} /></Field>
      <Field label="Machine No."><TextInput autoCapitalize="characters" value={machineNo} onChangeText={setMachineNo} style={styles.input} /></Field>
      <Field label="Customer"><TextInput value={customerName} onChangeText={setCustomerName} style={styles.input} /></Field>
      <Pressable onPress={addSvr} style={styles.add}><Text style={styles.addText}>+ Add SVR to packet</Text></Pressable>
    </Section>

    {items.length ? <View style={styles.packet}><View style={styles.packetHeader}><Text style={styles.sectionTitle}>SVR packet</Text><Text style={styles.count}>{items.length} added</Text></View>{items.map((item, index) => <View key={`${item.svr_no}-${index}`} style={styles.item}><View style={styles.itemTop}><View style={styles.itemCopy}><Text style={styles.svr}>{item.svr_no}</Text><Text style={styles.itemMeta}>{item.engineer_name} · {item.machine_no}</Text></View><Pressable onPress={() => setItems((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}><Text style={styles.remove}>Remove</Text></Pressable></View><Text style={styles.itemMeta}>{item.customer_name}</Text><Text style={styles.itemDate}>{item.date_from} → {item.date_to} · {inclusiveDays(item.date_from, item.date_to)}d</Text></View>)}</View> : null}

    <Section title="3 · Finalize Dispatch"><Field label="Dispatch Date"><DateButton value={dispatchDate} onPress={() => setDateTarget('dispatch')} /></Field><Field label="Dispatched By"><TextInput value={dispatchedBy} onChangeText={setDispatchedBy} style={styles.input} /></Field><Text style={styles.label}>Dispatch Mode</Text><View style={styles.chips}>{(['Bus', 'Transport', 'By Hand'] as const).map((mode) => <Pressable key={mode} onPress={() => setDispatchMode(mode)} style={[styles.chip, dispatchMode === mode && styles.chipActive]}><Text style={[styles.chipText, dispatchMode === mode && styles.chipTextActive]}>{mode}</Text></Pressable>)}</View>{dispatchMode !== 'By Hand' ? <Field label="Reference No."><TextInput value={referenceNo} onChangeText={setReferenceNo} style={styles.input} /></Field> : null}</Section>
    {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
    <Pressable disabled={mutation.isPending} onPress={submit} style={[styles.submit, mutation.isPending && styles.disabled]}>{mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Dispatch</Text>}</Pressable>
  </ScrollView>

  {dateTarget ? <DateTimePicker value={pickerValue} mode="date" onChange={(_event, selectedDate) => { setDateTarget(null); if (selectedDate) applyDate(selectedDate); }} /> : null}
  <PickerModal visible={branchOpen} title="Select Office" onClose={() => setBranchOpen(false)} rows={(branches.data ?? []).map((row) => ({ id: row.branch_key, title: row.display_name, meta: row.branch_key }))} onSelect={(id) => { setOffice(id); setEngineer(null); setBranchOpen(false); }} />
  <PickerModal visible={engineerOpen} title="Select Service Engineer" onClose={() => setEngineerOpen(false)} rows={officeEngineers.map((row) => ({ id: row.id, title: row.engineer_name, meta: row.branch_key }))} onSelect={(id) => { setEngineer(officeEngineers.find((row) => row.id === id) ?? null); setEngineerOpen(false); }} />
  </SafeAreaView>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function Field({ label, children, flex = false }: { label: string; children: React.ReactNode; flex?: boolean }) { return <View style={flex ? styles.flexField : undefined}><Text style={styles.label}>{label}</Text>{children}</View>; }
function DateButton({ value, onPress }: { value: string; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.select}><Text style={value ? styles.selectText : styles.placeholder}>{value || 'Select date'}</Text></Pressable>; }
function PickerModal({ visible, title, rows, onSelect, onClose }: { visible: boolean; title: string; rows: { id: string; title: string; meta: string }[]; onSelect: (id: string) => void; onClose: () => void }) { return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><Pressable style={styles.modalBackdrop} onPress={onClose}><Pressable style={styles.sheet} onPress={() => undefined}><Text style={styles.sheetTitle}>{title}</Text><ScrollView>{rows.map((row) => <Pressable key={row.id} onPress={() => onSelect(row.id)} style={styles.sheetRow}><Text style={styles.sheetRowTitle}>{row.title}</Text><Text style={styles.sheetRowMeta}>{row.meta}</Text></Pressable>)}</ScrollView></Pressable></Pressable></Modal>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 44 }, back: { minHeight: 38, justifyContent: 'center', alignSelf: 'flex-start' }, backText: { color: colors.blue, fontWeight: '800' }, title: { color: colors.text, fontSize: 24, fontWeight: '900' }, subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 }, section: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '900' }, label: { color: colors.textMuted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginTop: 2 }, input: { minHeight: 46, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', color: colors.text, fontSize: 13 }, select: { minHeight: 46, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' }, locked: { backgroundColor: colors.surfaceMuted }, selectText: { color: colors.text, fontSize: 13, fontWeight: '800' }, placeholder: { color: colors.textMuted, fontSize: 12 }, help: { color: colors.textMuted, fontSize: 9 }, twoCol: { flexDirection: 'row', gap: spacing.sm }, flexField: { flex: 1 }, add: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.blueSoft }, addText: { color: colors.navy, fontSize: 12, fontWeight: '900' }, packet: { gap: spacing.sm }, packetHeader: { flexDirection: 'row', justifyContent: 'space-between' }, count: { color: colors.blue, fontSize: 11, fontWeight: '900' }, item: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, itemCopy: { flex: 1 }, svr: { color: colors.text, fontSize: 12, fontWeight: '900' }, itemMeta: { color: colors.textMuted, fontSize: 10, marginTop: 2 }, itemDate: { color: colors.text, fontSize: 10, fontWeight: '700', marginTop: 5 }, remove: { color: colors.danger, fontSize: 10, fontWeight: '900' }, chips: { flexDirection: 'row', gap: spacing.sm }, chip: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted }, chipActive: { backgroundColor: colors.navy, borderColor: colors.navy }, chipText: { color: colors.text, fontSize: 11, fontWeight: '800' }, chipTextActive: { color: '#fff' }, message: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerSoft }, messageText: { color: colors.danger, fontSize: 11, lineHeight: 17 }, submit: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy }, submitText: { color: '#fff', fontSize: 14, fontWeight: '900' }, disabled: { opacity: 0.5 }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.6)' }, sheet: { maxHeight: '72%', padding: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface }, sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: spacing.sm }, sheetRow: { minHeight: 56, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, sheetRowTitle: { color: colors.text, fontSize: 13, fontWeight: '800' }, sheetRowMeta: { color: colors.textMuted, fontSize: 10, marginTop: 2 }, error: { color: colors.danger } });
