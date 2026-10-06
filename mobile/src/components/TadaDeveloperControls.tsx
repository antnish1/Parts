import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import {
  developerDeleteTadaDispatch,
  developerDeleteTadaSvr,
  developerUpdateTadaDispatch,
  developerUpdateTadaSvr,
  getTadaBranches,
  getTadaEngineers,
  type TadaDispatch,
  type TadaSvrItem,
} from '@/services/tada';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = {
  dispatch: TadaDispatch;
  items: TadaSvrItem[];
  onChanged: () => Promise<unknown> | void;
  onDispatchDeleted: () => void;
};

type DeleteTarget = { type: 'dispatch' } | { type: 'svr'; item: TadaSvrItem } | null;

export function TadaDeveloperControls({ dispatch, items, onChanged, onDispatchDeleted }: Props) {
  const branches = useQuery({ queryKey: ['tada-branches'], queryFn: getTadaBranches });
  const engineers = useQuery({ queryKey: ['tada-engineers'], queryFn: getTadaEngineers });

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [engineerPickerOpen, setEngineerPickerOpen] = useState(false);

  const [branch, setBranch] = useState(dispatch.branch_key);
  const [dispatchDate, setDispatchDate] = useState(dispatch.dispatch_date);
  const [dispatchedBy, setDispatchedBy] = useState(dispatch.dispatched_by);
  const [dispatchMode, setDispatchMode] = useState<TadaDispatch['dispatch_mode']>(dispatch.dispatch_mode);
  const [referenceNo, setReferenceNo] = useState(dispatch.reference_no ?? '');

  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? '');
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedItemId) ?? items[0], [items, selectedItemId]);

  const [svrNo, setSvrNo] = useState(selectedItem?.svr_no ?? '');
  const [engineerName, setEngineerName] = useState(selectedItem?.engineer_name_snapshot ?? '');
  const [engineerId, setEngineerId] = useState<string | null>(selectedItem?.engineer_id ?? null);
  const [dateFrom, setDateFrom] = useState(selectedItem?.date_from ?? '');
  const [dateTo, setDateTo] = useState(selectedItem?.date_to ?? '');
  const [machineNo, setMachineNo] = useState(selectedItem?.machine_no ?? '');
  const [customerName, setCustomerName] = useState(selectedItem?.customer_name ?? '');

  useEffect(() => {
    setBranch(dispatch.branch_key);
    setDispatchDate(dispatch.dispatch_date);
    setDispatchedBy(dispatch.dispatched_by);
    setDispatchMode(dispatch.dispatch_mode);
    setReferenceNo(dispatch.reference_no ?? '');
  }, [dispatch]);

  useEffect(() => {
    if (!selectedItem) return;
    setSvrNo(selectedItem.svr_no);
    setEngineerName(selectedItem.engineer_name_snapshot);
    setEngineerId(selectedItem.engineer_id);
    setDateFrom(selectedItem.date_from);
    setDateTo(selectedItem.date_to);
    setMachineNo(selectedItem.machine_no);
    setCustomerName(selectedItem.customer_name);
  }, [selectedItem]);

  const reasonReady = reason.trim().length >= 3;

  const updateDispatch = useMutation({
    mutationFn: () => {
      if (!reasonReady) throw new Error('Enter an override reason first.');
      return developerUpdateTadaDispatch({ dispatchId: dispatch.id, branch, dispatchDate, dispatchedBy, dispatchMode, referenceNo, reason: reason.trim() });
    },
    onSuccess: async () => { setMessage('Dispatch details updated and audited.'); await onChanged(); },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not update dispatch.'),
  });

  const updateSvr = useMutation({
    mutationFn: () => {
      if (!selectedItem) throw new Error('Select an SVR first.');
      if (!reasonReady) throw new Error('Enter an override reason first.');
      if (!engineerId || !engineerName.trim()) throw new Error('Select a Service Engineer from the predefined list.');
      return developerUpdateTadaSvr({
        itemId: selectedItem.id,
        svrNo: svrNo.trim().toUpperCase(),
        engineerId,
        engineerName: engineerName.trim(),
        dateFrom,
        dateTo,
        machineNo: machineNo.trim().toUpperCase(),
        customerName: customerName.trim(),
        reason: reason.trim(),
      });
    },
    onSuccess: async () => { setMessage('SVR details updated and audited.'); await onChanged(); },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not update SVR.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      if (!reasonReady) throw new Error('Enter an override reason first.');
      if (deleteTarget.type === 'dispatch') await developerDeleteTadaDispatch(dispatch.id, reason.trim());
      else await developerDeleteTadaSvr(deleteTarget.item.id, reason.trim());
    },
    onSuccess: async () => {
      const deletedDispatch = deleteTarget?.type === 'dispatch';
      setDeleteTarget(null);
      if (deletedDispatch) {
        onDispatchDeleted();
        return;
      }
      setMessage('SVR deleted and the dispatch totals/status were recalculated.');
      await onChanged();
    },
    onError: (error) => {
      setDeleteTarget(null);
      setMessage(error instanceof Error ? error.message : 'Delete failed.');
    },
  });

  return (
    <View style={styles.shell}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.header}>
        <View style={styles.headerIcon}><AppIcon name="alert" size={18} color={colors.danger} /></View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>DEVELOPER OVERRIDE</Text>
          <Text style={styles.title}>Audited TA/DA maintenance</Text>
          <Text style={styles.subtitle}>Business-field edits only. Custody and receipt state remain server-controlled.</Text>
        </View>
        <Text style={styles.expand}>{open ? '−' : '+'}</Text>
      </Pressable>

      {open ? <View style={styles.body}>
        <Text style={styles.label}>Override reason · required for every change</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          multiline
          placeholder="Why is this developer correction required?"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.reason]}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dispatch details</Text>
          <Field label="Office">
            <Pressable onPress={() => setBranchPickerOpen(true)} style={styles.select}>
              <Text style={styles.selectText}>{branches.data?.find((item) => item.branch_key === branch)?.display_name || branch || 'Select office'}</Text>
            </Pressable>
          </Field>
          <Field label="Dispatch date"><TextInput value={dispatchDate} onChangeText={setDispatchDate} placeholder="YYYY-MM-DD" style={styles.input} /></Field>
          <Field label="Dispatched by"><TextInput value={dispatchedBy} onChangeText={setDispatchedBy} style={styles.input} /></Field>
          <Text style={styles.label}>Dispatch mode</Text>
          <View style={styles.modeRow}>
            {(['Bus', 'Transport', 'By Hand'] as const).map((mode) => <Pressable key={mode} onPress={() => setDispatchMode(mode)} style={[styles.mode, dispatchMode === mode && styles.modeActive]}><Text style={[styles.modeText, dispatchMode === mode && styles.modeTextActive]}>{mode}</Text></Pressable>)}
          </View>
          <Field label="Reference no."><TextInput value={referenceNo} onChangeText={setReferenceNo} style={styles.input} /></Field>
          <Pressable disabled={!reasonReady || updateDispatch.isPending} onPress={() => updateDispatch.mutate()} style={[styles.save, (!reasonReady || updateDispatch.isPending) && styles.disabled]}>
            {updateDispatch.isPending ? <ActivityIndicator color="#fff" /> : <><AppIcon name="check" size={16} color="#fff" /><Text style={styles.saveText}>Save Dispatch Changes</Text></>}
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SVR business details</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemChips}>
            {items.map((item) => <Pressable key={item.id} onPress={() => setSelectedItemId(item.id)} style={[styles.itemChip, selectedItem?.id === item.id && styles.itemChipActive]}><Text style={[styles.itemChipText, selectedItem?.id === item.id && styles.itemChipTextActive]}>{item.svr_no}</Text></Pressable>)}
          </ScrollView>
          {selectedItem ? <>
            <Field label="SVR no."><TextInput autoCapitalize="characters" value={svrNo} onChangeText={setSvrNo} style={styles.input} /></Field>
            <Field label="Service Engineer">
              <Pressable onPress={() => setEngineerPickerOpen(true)} style={styles.select}><Text style={styles.selectText}>{engineerName || 'Select engineer'}</Text></Pressable>
            </Field>
            <View style={styles.twoCol}>
              <View style={styles.flex}><Field label="Date from"><TextInput value={dateFrom} onChangeText={setDateFrom} placeholder="YYYY-MM-DD" style={styles.input} /></Field></View>
              <View style={styles.flex}><Field label="Date to"><TextInput value={dateTo} onChangeText={setDateTo} placeholder="YYYY-MM-DD" style={styles.input} /></Field></View>
            </View>
            <Field label="Machine no."><TextInput autoCapitalize="characters" value={machineNo} onChangeText={setMachineNo} style={styles.input} /></Field>
            <Field label="Customer"><TextInput value={customerName} onChangeText={setCustomerName} style={styles.input} /></Field>
            <View style={styles.actionRow}>
              <Pressable disabled={!reasonReady || updateSvr.isPending} onPress={() => updateSvr.mutate()} style={[styles.save, styles.flex, (!reasonReady || updateSvr.isPending) && styles.disabled]}>
                {updateSvr.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save SVR</Text>}
              </Pressable>
              <Pressable disabled={!reasonReady || items.length <= 1} onPress={() => setDeleteTarget({ type: 'svr', item: selectedItem })} style={[styles.deleteOutline, styles.flex, (!reasonReady || items.length <= 1) && styles.disabled]}>
                <AppIcon name="x" size={15} color={colors.danger} /><Text style={styles.deleteOutlineText}>Delete SVR</Text>
              </Pressable>
            </View>
          </> : null}
        </View>

        {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}

        <View style={styles.dangerZone}>
          <View style={styles.dangerCopy}>
            <Text style={styles.dangerTitle}>Delete complete TA/DA list</Text>
            <Text style={styles.dangerText}>Removes the live dispatch and descendants only after the backend writes the permanent developer audit snapshot.</Text>
          </View>
          <Pressable disabled={!reasonReady} onPress={() => setDeleteTarget({ type: 'dispatch' })} style={[styles.delete, !reasonReady && styles.disabled]}><Text style={styles.deleteText}>Delete List</Text></Pressable>
        </View>
      </View> : null}

      <PickerModal
        visible={branchPickerOpen}
        title="Select Office"
        rows={(branches.data ?? []).map((item) => ({ id: item.branch_key, title: item.display_name, meta: item.branch_key }))}
        onClose={() => setBranchPickerOpen(false)}
        onSelect={(id) => { setBranch(id); setBranchPickerOpen(false); }}
      />
      <PickerModal
        visible={engineerPickerOpen}
        title="Select Service Engineer"
        rows={(engineers.data ?? []).map((item) => ({ id: item.id, title: item.engineer_name, meta: item.branch_key }))}
        onClose={() => setEngineerPickerOpen(false)}
        onSelect={(id) => {
          const engineer = (engineers.data ?? []).find((item) => item.id === id);
          setEngineerId(engineer?.id ?? null);
          setEngineerName(engineer?.engineer_name ?? '');
          setEngineerPickerOpen(false);
        }}
      />
      <ConfirmModal
        target={deleteTarget}
        busy={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View><Text style={styles.label}>{label}</Text>{children}</View>;
}

function PickerModal({ visible, title, rows, onClose, onSelect }: { visible: boolean; title: string; rows: { id: string; title: string; meta: string }[]; onClose: () => void; onSelect: (id: string) => void }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><Pressable style={styles.backdrop} onPress={onClose}><Pressable style={styles.sheet} onPress={() => undefined}><Text style={styles.sheetTitle}>{title}</Text><ScrollView>{rows.map((row) => <Pressable key={row.id} onPress={() => onSelect(row.id)} style={styles.sheetRow}><Text style={styles.sheetRowTitle}>{row.title}</Text><Text style={styles.sheetRowMeta}>{row.meta}</Text></Pressable>)}</ScrollView></Pressable></Pressable></Modal>;
}

function ConfirmModal({ target, busy, onCancel, onConfirm }: { target: DeleteTarget; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <Modal visible={Boolean(target)} transparent animationType="fade" onRequestClose={onCancel}><View style={styles.backdropCenter}><View style={styles.dialog}><Text style={styles.dialogTitle}>{target?.type === 'dispatch' ? 'Delete complete TA/DA list?' : `Delete SVR ${target?.type === 'svr' ? target.item.svr_no : ''}?`}</Text><Text style={styles.dialogText}>{target?.type === 'dispatch' ? 'The live workflow will be removed. The permanent developer audit snapshot remains.' : 'This SVR will be removed and totals/status will be recalculated by the server.'}</Text><View style={styles.dialogActions}><Pressable disabled={busy} onPress={onCancel}><Text style={styles.cancel}>Cancel</Text></Pressable><Pressable disabled={busy} onPress={onConfirm} style={styles.confirmDelete}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmDeleteText}>Delete</Text>}</Pressable></View></View></View></Modal>;
}

const styles = StyleSheet.create({
  shell: { borderRadius: radius.xl, borderWidth: 1, borderColor: '#F4B8B8', backgroundColor: '#FFF9F9', overflow: 'hidden' },
  header: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  headerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerSoft },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.danger, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 2 },
  subtitle: { color: colors.textMuted, fontSize: 9, lineHeight: 14, marginTop: 2 },
  expand: { color: colors.danger, fontSize: 22, fontWeight: '700' },
  body: { gap: spacing.md, padding: spacing.md, paddingTop: 0 },
  label: { color: colors.textMuted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 },
  input: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', color: colors.text, fontSize: 12 },
  reason: { minHeight: 70, paddingTop: 10, textAlignVertical: 'top', borderColor: '#F2B8B8' },
  section: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  sectionTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  select: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  selectText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  mode: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  modeActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  modeText: { color: colors.textMuted, fontSize: 10, fontWeight: '900' },
  modeTextActive: { color: '#fff' },
  itemChips: { gap: spacing.sm, paddingRight: spacing.md },
  itemChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  itemChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  itemChipText: { color: colors.textMuted, fontSize: 10, fontWeight: '900' },
  itemChipTextActive: { color: '#fff' },
  twoCol: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  save: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.navy },
  saveText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  deleteOutline: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: radius.md, borderWidth: 1, borderColor: '#F0B3B3', backgroundColor: '#fff' },
  deleteOutlineText: { color: colors.danger, fontSize: 10, fontWeight: '900' },
  message: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.blueSoft },
  messageText: { color: colors.navy, fontSize: 10, fontWeight: '700' },
  dangerZone: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: '#F2B8B8', backgroundColor: '#fff' },
  dangerCopy: { flex: 1 },
  dangerTitle: { color: colors.danger, fontSize: 11, fontWeight: '900' },
  dangerText: { color: colors.textMuted, fontSize: 9, lineHeight: 14, marginTop: 2 },
  delete: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.danger },
  deleteText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: .42 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,.5)' },
  sheet: { maxHeight: '72%', padding: spacing.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: spacing.md },
  sheetRow: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  sheetRowTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  sheetRowMeta: { color: colors.textMuted, fontSize: 9, marginTop: 2 },
  backdropCenter: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: 'rgba(15,23,42,.58)' },
  dialog: { gap: spacing.md, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.surface },
  dialogTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  dialogText: { color: colors.textMuted, fontSize: 11, lineHeight: 17 },
  dialogActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.lg },
  cancel: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  confirmDelete: { minWidth: 92, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.danger },
  confirmDeleteText: { color: '#fff', fontSize: 11, fontWeight: '900' },
});
