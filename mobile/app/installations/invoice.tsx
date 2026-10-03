import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { canManageInstallations, createInstallationInvoice, findInstallationPart, type EquipmentType } from '@/services/installations';
import { colors, radius, spacing } from '@/theme/tokens';

function iso(date: Date) { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }

export default function InstallationInvoiceScreen() {
  const { profile } = useAuth();
  const allowed = canManageInstallations(profile);
  const queryClient = useQueryClient();
  const [date, setDate] = useState(iso(new Date()));
  const [dateOpen, setDateOpen] = useState(false);
  const [jcbNo, setJcbNo] = useState('');
  const [partNo, setPartNo] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<EquipmentType>('ENGINE');
  const [serialNo, setSerialNo] = useState('');
  const [dbmsNo, setDbmsNo] = useState('');
  const [asset, setAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [message, setMessage] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      if (!asset) throw new Error('JCB Invoice document is required.');
      return createInstallationInvoice({ invoiceDate: date, jcbInvoiceNo: jcbNo, partNo, description, equipmentType: type, serialNo, dbmsNo, asset });
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['installation-invoices'] }); router.replace('/installations'); },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not save invoice.'),
  });

  if (!allowed) return <SafeAreaView style={styles.center}><Text style={styles.error}>Invoice Intake is not available for this role.</Text></SafeAreaView>;

  async function lookupPart() {
    const value = partNo.trim().toUpperCase();
    if (!value) return setMessage('Enter Part No.');
    setLookupBusy(true); setMessage('');
    try { const match = await findInstallationPart(value); if (!match) throw new Error('Part not found in part master.'); setPartNo(match.part_no); setDescription(match.description); }
    catch (error) { setDescription(''); setMessage(error instanceof Error ? error.message : 'Part lookup failed.'); }
    finally { setLookupBusy(false); }
  }
  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true, multiple: false });
    if (!result.canceled) setAsset(result.assets[0]);
  }
  function submit() {
    setMessage('');
    if (!date || !jcbNo.trim() || !partNo.trim() || !description.trim() || !serialNo.trim() || !dbmsNo.trim()) return setMessage('Complete all invoice fields before saving.');
    if (!asset) return setMessage('Select the JCB Invoice document.');
    mutation.mutate();
  }

  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹ Back</Text></Pressable>
    <View><Text style={styles.title}>Add Invoice</Text><Text style={styles.subtitle}>Create the Engine / Rock Breaker invoice intake record.</Text></View>
    <View style={styles.card}>
      <Field label="Invoice Date"><Pressable onPress={() => setDateOpen(true)} style={styles.select}><Text style={styles.selectText}>{date}</Text></Pressable></Field>
      <Field label="JCB Invoice No."><TextInput autoCapitalize="characters" value={jcbNo} onChangeText={(v) => setJcbNo(v.toUpperCase())} style={styles.input} /></Field>
      <Field label="Part No."><View style={styles.row}><TextInput autoCapitalize="characters" value={partNo} onChangeText={(v) => { setPartNo(v.toUpperCase()); setDescription(''); }} onEndEditing={() => void lookupPart()} style={[styles.input, styles.flex]} /><Pressable onPress={() => void lookupPart()} disabled={lookupBusy} style={styles.lookup}>{lookupBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.lookupText}>Lookup</Text>}</Pressable></View></Field>
      <Field label="Description"><View style={styles.readOnly}><Text style={description ? styles.readOnlyValue : styles.placeholder}>{description || 'Fetched from part master'}</Text></View></Field>
      <Text style={styles.label}>Type</Text><View style={styles.types}>{(['ENGINE', 'ROCK_BREAKER'] as EquipmentType[]).map((value) => <Pressable key={value} onPress={() => setType(value)} style={[styles.typeButton, type === value && styles.typeActive]}><Text style={[styles.typeText, type === value && styles.typeTextActive]}>{value === 'ENGINE' ? 'Engine' : 'Rock Breaker'}</Text></Pressable>)}</View>
      <Field label="Serial No."><TextInput autoCapitalize="characters" value={serialNo} onChangeText={(v) => setSerialNo(v.toUpperCase())} style={styles.input} /></Field>
      <Field label="DBMS No."><TextInput autoCapitalize="characters" value={dbmsNo} onChangeText={(v) => setDbmsNo(v.toUpperCase())} style={styles.input} /></Field>
      <Field label="JCB Invoice Document"><Pressable onPress={() => void pickFile()} style={styles.fileButton}><Text style={styles.fileText}>{asset ? asset.name : 'Choose PDF / image'}</Text><Text style={styles.fileIcon}>↑</Text></Pressable>{asset ? <Text style={styles.help}>{Math.max(1, Math.round(Number(asset.size ?? 0) / 1024))} KB</Text> : null}</Field>
    </View>
    {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
    <Pressable disabled={mutation.isPending} onPress={submit} style={[styles.submit, mutation.isPending && styles.disabled]}>{mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Invoice</Text>}</Pressable>
  </ScrollView>{dateOpen ? <DateTimePicker value={new Date(`${date}T00:00:00`)} mode="date" onChange={(_event, value) => { setDateOpen(false); if (value) setDate(iso(value)); }} /> : null}</SafeAreaView>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 44 }, back: { minHeight: 38, justifyContent: 'center', alignSelf: 'flex-start' }, backText: { color: colors.blue, fontWeight: '800' }, title: { color: colors.text, fontSize: 24, fontWeight: '900' }, subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 }, card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, field: { gap: 5 }, label: { color: colors.textMuted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }, input: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', color: colors.text, fontSize: 13 }, select: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' }, selectText: { color: colors.text, fontSize: 13, fontWeight: '800' }, row: { flexDirection: 'row', gap: spacing.sm }, flex: { flex: 1 }, lookup: { width: 76, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy }, lookupText: { color: '#fff', fontSize: 11, fontWeight: '900' }, readOnly: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }, readOnlyValue: { color: colors.text, fontSize: 12, fontWeight: '700' }, placeholder: { color: colors.textMuted, fontSize: 11 }, types: { flexDirection: 'row', gap: spacing.sm }, typeButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted }, typeActive: { backgroundColor: colors.navy, borderColor: colors.navy }, typeText: { color: colors.text, fontSize: 12, fontWeight: '900' }, typeTextActive: { color: '#fff' }, fileButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' }, fileText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '700' }, fileIcon: { color: colors.navy, fontSize: 20, fontWeight: '900' }, help: { color: colors.textMuted, fontSize: 9 }, message: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerSoft }, messageText: { color: colors.danger, fontSize: 11 }, submit: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy }, submitText: { color: '#fff', fontSize: 14, fontWeight: '900' }, disabled: { opacity: 0.5 }, error: { color: colors.danger } });