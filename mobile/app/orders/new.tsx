import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { createOrder, getApprovers, getInTransitQty, lookupMachine, lookupPart, normalizeMachineNo, normalizePartNo, type Approver } from '@/services/newOrder';
import { colors, radius, spacing } from '@/theme/tokens';

type ItemLine = { id: string; partNo: string; description: string; dnp: number | null; qty: string; category: string; inTransitQty: number; loading: boolean };

const ORDER_TYPES = ['VOR', 'SOP', 'ZSPL', 'ZMAC', 'LUBES'];
const ORDER_FOR = ['Customer', 'Stock'];
const MACHINE_TYPES = ['U/W', 'B/W'];

function blankItem(): ItemLine {
  return { id: `${Date.now()}-${Math.random()}`, partNo: '', description: '', dnp: null, qty: '', category: '', inTransitQty: 0, loading: false };
}

export default function NewOrderScreen() {
  const { profile, role } = useAuth();
  const queryClient = useQueryClient();
  const approvers = useQuery({ queryKey: ['mobile-approvers'], queryFn: getApprovers });
  const [orderType, setOrderType] = useState('');
  const [orderFor, setOrderFor] = useState('');
  const [approver, setApprover] = useState<Approver | null>(null);
  const [machineNo, setMachineNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [machineType, setMachineType] = useState('');
  const [callId, setCallId] = useState('');
  const [items, setItems] = useState<ItemLine[]>([blankItem()]);
  const [machineBusy, setMachineBusy] = useState(false);
  const [missingMachineOpen, setMissingMachineOpen] = useState(false);
  const [manualCustomer, setManualCustomer] = useState('');
  const [approverOpen, setApproverOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState<{ orderNo: string; warning?: string | null } | null>(null);

  const branch = profile?.branch ?? '';
  const total = useMemo(() => items.reduce((sum, item) => sum + (item.dnp ?? 0) * Number(item.qty || 0), 0), [items]);
  const busyPart = items.some((item) => item.loading);

  const mutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (result) => {
      setSuccess({ orderNo: result.order_no, warning: result.warning });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Order creation failed.'),
  });

  if (role !== 'branch') {
    return <SafeAreaView style={styles.center}><Text style={styles.error}>New Order is available to Branch users.</Text><Pressable onPress={() => router.back()}><Text style={styles.link}>Go back</Text></Pressable></SafeAreaView>;
  }

  function selectOrderType(value: string) {
    setOrderType(value);
    if (value === 'VOR') setOrderFor('Customer');
  }

  async function searchMachine() {
    if (orderFor === 'Stock') return;
    const normalized = normalizeMachineNo(machineNo);
    if (!normalized) return setMessage('Enter Machine Number first.');
    setMachineBusy(true);
    setMessage('');
    try {
      const machine = await lookupMachine(normalized);
      setMachineNo(normalized);
      if (machine?.customer_name) {
        setCustomerName(machine.customer_name);
      } else {
        setCustomerName('');
        setManualCustomer('');
        setMissingMachineOpen(true);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Machine lookup failed.');
    } finally {
      setMachineBusy(false);
    }
  }

  async function searchPart(id: string) {
    const current = items.find((item) => item.id === id);
    const normalized = normalizePartNo(current?.partNo);
    if (!normalized) return;
    setItems((rows) => rows.map((item) => item.id === id ? { ...item, partNo: normalized, loading: true, description: '', dnp: null, category: '', inTransitQty: 0 } : item));
    setMessage('');
    try {
      const part = await lookupPart(normalized);
      if (!part) throw new Error(`Part not found in part_master: ${normalized}`);
      const inTransitQty = await getInTransitQty(branch, normalized).catch(() => 0);
      setItems((rows) => rows.map((item) => item.id === id ? { ...item, partNo: part.part_no, description: part.description ?? '', dnp: part.dnp, category: part.cat1 || part.cat2 || '—', inTransitQty, loading: false } : item));
    } catch (error) {
      setItems((rows) => rows.map((item) => item.id === id ? { ...item, loading: false } : item));
      setMessage(error instanceof Error ? error.message : 'Part lookup failed.');
    }
  }

  function updateItem(id: string, patch: Partial<ItemLine>) {
    setItems((rows) => rows.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function validateAndSubmit() {
    setMessage('');
    if (!branch || !orderType || !orderFor) return setMessage('Order Type and Order For are required.');
    if (!approver) return setMessage('Select an approver.');
    if (orderType === 'VOR' && orderFor !== 'Customer') return setMessage('VOR order must be for Customer.');
    if (orderFor === 'Customer' && (!normalizeMachineNo(machineNo) || !customerName.trim() || !machineType)) return setMessage('Customer order requires machine number, customer name and machine type.');
    if (busyPart) return setMessage('Wait for part lookup to finish.');

    const parsed = items.map((item) => ({
      partNo: normalizePartNo(item.partNo),
      description: item.description.trim(),
      dnp: Number(item.dnp),
      qty: Number(item.qty),
      previous30dQty: item.inTransitQty,
    }));
    const duplicate = parsed.find((item, index) => parsed.findIndex((candidate) => candidate.partNo === item.partNo) !== index);
    if (duplicate) return setMessage(`Duplicate item not allowed: ${duplicate.partNo}`);
    const invalid = parsed.find((item) => !item.partNo || !item.description || !Number.isFinite(item.dnp) || item.dnp < 0 || !Number.isInteger(item.qty) || item.qty < 1);
    if (invalid) return setMessage('Every part must be looked up and have a whole quantity above zero.');

    mutation.mutate({
      branch,
      orderType,
      orderFor,
      approverId: approver.id,
      machineNo: orderFor === 'Stock' ? '' : normalizeMachineNo(machineNo),
      customerName: orderFor === 'Stock' ? '' : customerName.trim(),
      callId: callId.trim(),
      warrantyStatus: orderFor === 'Stock' ? 'NA' : machineType,
      items: parsed,
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹ Back</Text></Pressable>
          <View><Text style={styles.title}>New Order</Text><Text style={styles.subtitle}>{branch} · {profile?.fullName}</Text></View>

          <Section title="Order setup">
            <Label text="Order Type" />
            <ChipRow values={ORDER_TYPES} selected={orderType} onSelect={selectOrderType} />
            <Label text="Order For" />
            <ChipRow values={ORDER_FOR} selected={orderFor} disabled={orderType === 'VOR'} onSelect={(value) => { setOrderFor(value); if (value === 'Stock') { setMachineNo(''); setCustomerName(''); setMachineType(''); } }} />
            <Label text="Approved By" />
            <Pressable style={styles.select} onPress={() => setApproverOpen(true)}><Text style={approver ? styles.selectValue : styles.placeholder}>{approver ? `${approver.full_name} (${approver.role})` : 'Select approver'}</Text></Pressable>
          </Section>

          <Section title="Customer details">
            <Label text="Machine Number" />
            <View style={styles.inputActionRow}>
              <TextInput editable={orderFor !== 'Stock' && !machineBusy} autoCapitalize="characters" value={machineNo} onChangeText={(value) => { setMachineNo(value); setCustomerName(''); }} onEndEditing={() => void searchMachine()} placeholder={orderFor === 'Stock' ? 'Not required for Stock' : 'Enter machine number'} placeholderTextColor={colors.textMuted} style={[styles.input, styles.flex]} />
              <Pressable disabled={orderFor === 'Stock' || machineBusy} onPress={() => void searchMachine()} style={styles.lookupButton}>{machineBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.lookupText}>Lookup</Text>}</Pressable>
            </View>
            <Label text="Customer Name" />
            <View style={styles.readOnly}><Text style={customerName ? styles.readOnlyValue : styles.placeholder}>{orderFor === 'Stock' ? 'Not required' : customerName || 'Auto-fetched after machine lookup'}</Text></View>
            <Label text="Machine Type" />
            <ChipRow values={MACHINE_TYPES} selected={machineType} disabled={orderFor === 'Stock'} onSelect={setMachineType} />
            <Label text="Call ID" />
            <TextInput value={callId} onChangeText={setCallId} placeholder="Enter Call ID" placeholderTextColor={colors.textMuted} style={styles.input} />
          </Section>

          <View style={styles.partsHeader}><Text style={styles.sectionTitle}>Parts</Text><Pressable onPress={() => setItems((rows) => [...rows, blankItem()])}><Text style={styles.addLink}>+ Add part</Text></Pressable></View>
          {items.map((item, index) => (
            <View key={item.id} style={styles.partCard}>
              <View style={styles.partTop}><Text style={styles.partIndex}>Part {index + 1}</Text>{items.length > 1 ? <Pressable onPress={() => setItems((rows) => rows.filter((row) => row.id !== item.id))}><Text style={styles.remove}>Remove</Text></Pressable> : null}</View>
              <Label text="Part Number" />
              <View style={styles.inputActionRow}>
                <TextInput autoCapitalize="characters" editable={!item.loading} value={item.partNo} onChangeText={(value) => updateItem(item.id, { partNo: value, description: '', dnp: null, category: '', inTransitQty: 0 })} onEndEditing={() => void searchPart(item.id)} placeholder="Part No." placeholderTextColor={colors.textMuted} style={[styles.input, styles.flex]} />
                <Pressable disabled={item.loading} onPress={() => void searchPart(item.id)} style={styles.lookupButton}>{item.loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.lookupText}>Lookup</Text>}</Pressable>
              </View>
              <View style={styles.infoGrid}>
                <Mini label="Description" value={item.description || '—'} wide />
                <Mini label="DNP" value={item.dnp == null ? '—' : `₹${item.dnp.toLocaleString('en-IN')}`} />
                <Mini label="Category" value={item.category || '—'} />
                <Mini label="In Transit" value={String(item.inTransitQty)} />
              </View>
              <Label text="Quantity" />
              <TextInput keyboardType="number-pad" value={item.qty} onChangeText={(value) => updateItem(item.id, { qty: value.replace(/[^0-9]/g, '') })} placeholder="Qty" placeholderTextColor={colors.textMuted} style={styles.input} />
              <View style={styles.lineTotal}><Text style={styles.lineTotalLabel}>Line value</Text><Text style={styles.lineTotalValue}>₹{((item.dnp ?? 0) * Number(item.qty || 0)).toLocaleString('en-IN')}</Text></View>
            </View>
          ))}

          {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
          <View style={styles.totalCard}><Text style={styles.totalLabel}>{items.length} item(s)</Text><Text style={styles.totalValue}>₹{total.toLocaleString('en-IN')}</Text></View>
          <Pressable disabled={mutation.isPending || machineBusy || busyPart} onPress={validateAndSubmit} style={({ pressed }) => [styles.submit, (pressed || mutation.isPending) && styles.pressed]}>{mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Order</Text>}</Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={approverOpen} transparent animationType="slide" onRequestClose={() => setApproverOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setApproverOpen(false)}><Pressable style={styles.sheet} onPress={() => undefined}><Text style={styles.sheetTitle}>Select approver</Text>{(approvers.data ?? []).map((item) => <Pressable key={item.id} style={styles.sheetRow} onPress={() => { setApprover(item); setApproverOpen(false); }}><View><Text style={styles.sheetRowTitle}>{item.full_name}</Text><Text style={styles.sheetRowMeta}>{item.role} · {item.branch}</Text></View></Pressable>)}</Pressable></Pressable>
      </Modal>

      <Modal visible={missingMachineOpen} transparent animationType="fade" onRequestClose={() => setMissingMachineOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.dialog}><Text style={styles.sheetTitle}>Machine not found</Text><Text style={styles.dialogText}>{normalizeMachineNo(machineNo)} is not in machine master. Enter Customer Name; the server will attempt to save the machine when the order is created.</Text><TextInput autoFocus value={manualCustomer} onChangeText={setManualCustomer} placeholder="Customer name" placeholderTextColor={colors.textMuted} style={styles.input} /><View style={styles.dialogActions}><Pressable onPress={() => setMissingMachineOpen(false)}><Text style={styles.cancel}>Cancel</Text></Pressable><Pressable onPress={() => { if (!manualCustomer.trim()) return; setCustomerName(manualCustomer.trim()); setMissingMachineOpen(false); }} style={styles.dialogPrimary}><Text style={styles.dialogPrimaryText}>Use customer</Text></Pressable></View></View></View>
      </Modal>

      <Modal visible={Boolean(success)} transparent animationType="fade" onRequestClose={() => setSuccess(null)}>
        <View style={styles.modalBackdrop}><View style={styles.dialog}><Text style={styles.successTitle}>Order placed</Text><Text style={styles.successNo}>{success?.orderNo}</Text>{success?.warning ? <Text style={styles.warning}>{success.warning}</Text> : null}<Pressable onPress={() => { const orderNo = success?.orderNo; setSuccess(null); if (orderNo) router.replace('/orders'); }} style={styles.dialogPrimary}><Text style={styles.dialogPrimaryText}>Done</Text></Pressable></View></View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function Label({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }
function ChipRow({ values, selected, onSelect, disabled = false }: { values: string[]; selected: string; onSelect: (value: string) => void; disabled?: boolean }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{values.map((value) => <Pressable key={value} disabled={disabled} onPress={() => onSelect(value)} style={[styles.chip, selected === value && styles.chipActive, disabled && styles.disabled]}><Text style={[styles.chipText, selected === value && styles.chipTextActive]}>{value}</Text></Pressable>)}</ScrollView>; }
function Mini({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <View style={[styles.mini, wide && styles.miniWide]}><Text style={styles.miniLabel}>{label}</Text><Text numberOfLines={wide ? 2 : 1} style={styles.miniValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  back: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center' }, backText: { color: colors.blue, fontSize: 14, fontWeight: '800' }, title: { color: colors.text, fontSize: 24, fontWeight: '900' }, subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  section: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '900' }, label: { color: colors.textMuted, fontSize: 10, fontWeight: '800', marginTop: 3, textTransform: 'uppercase' },
  chips: { gap: spacing.sm, paddingRight: spacing.md }, chip: { minHeight: 40, minWidth: 58, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted }, chipActive: { borderColor: colors.navy, backgroundColor: colors.navy }, chipText: { color: colors.text, fontSize: 12, fontWeight: '800' }, chipTextActive: { color: '#fff' }, disabled: { opacity: 0.45 },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', paddingHorizontal: spacing.md, color: colors.text, fontSize: 14 }, inputActionRow: { flexDirection: 'row', gap: spacing.sm }, lookupButton: { width: 74, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy }, lookupText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  readOnly: { minHeight: 48, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md }, readOnlyValue: { color: colors.text, fontSize: 14, fontWeight: '700' }, placeholder: { color: colors.textMuted, fontSize: 13 }, select: { minHeight: 48, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, backgroundColor: '#fff' }, selectValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  partsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, addLink: { color: colors.blue, fontSize: 12, fontWeight: '900' }, partCard: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, partTop: { flexDirection: 'row', justifyContent: 'space-between' }, partIndex: { color: colors.navy, fontSize: 12, fontWeight: '900' }, remove: { color: colors.danger, fontSize: 11, fontWeight: '800' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, mini: { width: '31%', minHeight: 54, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }, miniWide: { width: '100%' }, miniLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700' }, miniValue: { color: colors.text, fontSize: 11, fontWeight: '800', marginTop: 3 }, lineTotal: { flexDirection: 'row', justifyContent: 'space-between' }, lineTotalLabel: { color: colors.textMuted, fontSize: 11 }, lineTotalValue: { color: colors.text, fontSize: 13, fontWeight: '900' },
  message: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerSoft }, messageText: { color: colors.danger, fontSize: 12, lineHeight: 18 }, totalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.navy }, totalLabel: { color: '#D6E7FF', fontSize: 12, fontWeight: '700' }, totalValue: { color: '#fff', fontSize: 22, fontWeight: '900' }, submit: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy }, submitText: { color: '#fff', fontSize: 15, fontWeight: '900' }, pressed: { opacity: 0.75 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.65)' }, sheet: { maxHeight: '70%', padding: spacing.lg, gap: spacing.sm, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface }, sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: spacing.sm }, sheetRow: { minHeight: 58, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, sheetRowTitle: { color: colors.text, fontSize: 14, fontWeight: '800' }, sheetRowMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  dialog: { margin: spacing.xl, padding: spacing.xl, gap: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface }, dialogText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 }, dialogActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.lg }, cancel: { color: colors.textMuted, fontSize: 13, fontWeight: '800' }, dialogPrimary: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.navy }, dialogPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '900' }, successTitle: { color: colors.success, fontSize: 18, fontWeight: '900' }, successNo: { color: colors.text, fontSize: 22, fontWeight: '900' }, warning: { color: colors.warning, fontSize: 11, lineHeight: 17 }, error: { color: colors.danger, fontSize: 13 }, link: { color: colors.blue, fontSize: 13, fontWeight: '800' },
});
