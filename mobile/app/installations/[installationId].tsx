import { useMemo, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { AppIcon } from '@/components/AppIcon';
import { MotionView } from '@/components/MotionView';
import { acceptInstallationEntry, canCompleteInstallation, equipmentTypeLabel, getInstallationDocumentUrl, getInstallationEntry, installationStatusLabel, isInstallationServiceCrm, submitInstallationEntry, uploadInstallationDocument, type InstallationDocumentType } from '@/services/installations';
import { colors, radius, spacing } from '@/theme/tokens';

const docTypes: InstallationDocumentType[] = ['JCB_INVOICE', 'DBMS_INVOICE', 'SVR'];

export default function InstallationDetailScreen() {
  const params = useLocalSearchParams<{ installationId: string }>();
  const installationId = Array.isArray(params.installationId) ? params.installationId[0] : params.installationId;
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['installation-entry', installationId], queryFn: () => getInstallationEntry(installationId), enabled: Boolean(installationId) });
  const [equipmentNo, setEquipmentNo] = useState('');
  const [dbmsInvoiceNo, setDbmsInvoiceNo] = useState('');
  const [svrNo, setSvrNo] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [uploading, setUploading] = useState<InstallationDocumentType | ''>('');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<'submit' | 'accept' | null>(null);
  const entry = detail.data;
  const canComplete = canCompleteInstallation(profile, entry);
  const serviceCrm = isInstallationServiceCrm(profile);
  const docs = useMemo(() => (entry?.portal_installation_documents ?? []).filter((doc) => doc.is_active), [entry?.portal_installation_documents]);

  const submit = useMutation({
    mutationFn: () => submitInstallationEntry(installationId, equipmentNo, entry?.jcb_invoice_no || entry?.invoice_no || '', dbmsInvoiceNo, svrNo),
    onSuccess: async () => { setConfirm(null); setMessage('Submitted to Service CRM for acceptance.'); await refresh(); },
    onError: (error) => { setConfirm(null); setMessage(error instanceof Error ? error.message : 'Submission failed.'); },
  });
  const accept = useMutation({
    mutationFn: () => acceptInstallationEntry(installationId, registrationNo),
    onSuccess: async () => { setConfirm(null); setMessage('Installation accepted.'); await refresh(); },
    onError: (error) => { setConfirm(null); setMessage(error instanceof Error ? error.message : 'Acceptance failed.'); },
  });

  async function refresh() { await detail.refetch(); await queryClient.invalidateQueries({ queryKey: ['installation-entries'] }); }
  async function pickDocument(type: InstallationDocumentType) {
    try {
      setUploading(type); setMessage('');
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true, multiple: false });
      if (!result.canceled) { await uploadInstallationDocument(installationId, type, result.assets[0]); await refresh(); setMessage(`${type.replace(/_/g, ' ')} uploaded.`); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Upload failed.'); }
    finally { setUploading(''); }
  }
  async function openDocument(path: string) { try { const url = await getInstallationDocumentUrl(path); await Linking.openURL(url); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not open document.'); } }

  if (detail.isLoading) return <Screen title="Engine & Breaker"><View style={styles.center}><ActivityIndicator size="large" color={colors.navy} /></View></Screen>;
  if (!entry || detail.isError) return <Screen title="Engine & Breaker"><View style={styles.center}><Text style={styles.error}>Unable to load this installation.</Text></View></Screen>;
  const step2 = entry.status === 'ACCEPTANCE_PENDING' || entry.status === 'ACCEPTED';
  const completedDocs = docTypes.filter((type) => docs.some((doc) => doc.document_type === type)).length;

  return <Screen title="Engine & Breaker" scroll={false}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <MotionView>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}><AppIcon name="package" size={20} color="#FFFFFF"/></View>
          <View style={styles.heroCopy}><Text style={styles.eyebrow}>ENGINE & BREAKER</Text><Text style={styles.entryNo}>{entry.entry_no}</Text><Text style={styles.heroMeta}>{equipmentTypeLabel(entry.equipment_type)} · {entry.branch}</Text></View>
          <View style={styles.status}><Text style={styles.statusText}>{installationStatusLabel(entry.status)}</Text></View>
        </View><Text style={styles.eyebrow}>ENGINE & BREAKER</Text><Text style={styles.entryNo}>{entry.entry_no}</Text><Text style={styles.heroMeta}>{equipmentTypeLabel(entry.equipment_type)} · {entry.branch}</Text><View style={styles.status}><Text style={styles.statusText}>{installationStatusLabel(entry.status)}</Text></View><View style={styles.journey}><Step label="Registered" done /><Step label="Branch completion" done={step2} active={entry.status === 'PENDING'} /><Step label="Service CRM" done={entry.status === 'ACCEPTED'} active={entry.status === 'ACCEPTANCE_PENDING'} /></View></View>
      </MotionView>

      <Text style={styles.sectionTitle}>Entry information</Text>
      <MotionView delay={70}>
      <View style={styles.card}><Row label="Customer" value={entry.customer_name} /><Row label="Invoice Date" value={entry.invoice_date} /><Row label="JCB Invoice" value={entry.jcb_invoice_no || entry.invoice_no} /><Row label="DBMS No." value={entry.dbms_no || '—'} /><Row label="Equipment No." value={entry.equipment_no || 'Pending'} /><Row label="DBMS Invoice No." value={entry.dbms_invoice_no || 'Pending'} /><Row label="SVR No." value={entry.svr_no || 'Pending'} /><Row label="Registration No." value={entry.equipment_registration_no || 'Pending'} last /></View>
      </MotionView>

      <Text style={styles.sectionTitle}>Parts</Text>
      {(entry.portal_installation_items ?? []).map((item, index) => <MotionView key={item.id || `${item.part_no}-${index}`} delay={Math.min(index * 24, 160)}><View style={styles.part}><View style={styles.partCopy}><Text style={styles.partNo}>{item.part_no}</Text><Text style={styles.partDesc}>{item.description}</Text></View><Text style={styles.qty}>× {item.quantity}</Text></View></MotionView>)}

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Documents</Text><Text style={styles.docCount}>{completedDocs}/3 active</Text></View>
      {docTypes.map((type, index) => { const doc = docs.find((item) => item.document_type === type); return <MotionView key={type} delay={Math.min(index * 32, 160)}><View style={styles.docCard}><View style={styles.docTop}><View style={styles.partCopy}><Text style={styles.docTitle}>{type.replace(/_/g, ' ')}</Text><Text numberOfLines={1} style={styles.docName}>{doc?.file_name || 'Not uploaded'}</Text></View><View style={[styles.docBadge, doc ? styles.docBadgeDone : styles.docBadgeMissing]}><Text style={[styles.docBadgeText, doc ? styles.docBadgeDoneText : styles.docBadgeMissingText]}>{doc ? 'Ready' : 'Required'}</Text></View></View><View style={styles.docActions}>{doc ? <Pressable onPress={() => void openDocument(doc.storage_path)} style={styles.secondary}><Text style={styles.secondaryText}>Open</Text></Pressable> : null}{entry.status === 'PENDING' && canComplete ? <Pressable disabled={Boolean(uploading)} onPress={() => void pickDocument(type)} style={styles.primary}>{uploading === type ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{doc ? 'Replace' : 'Upload'}</Text>}</Pressable> : null}</View></View></MotionView>; })}

      {entry.status === 'PENDING' && canComplete ? <MotionView delay={120}><View style={styles.actionCard}><Text style={styles.actionTitle}>Stage Two Completion</Text><Text style={styles.actionText}>Complete the installation references. All three documents must be active before submission.</Text><Text style={styles.label}>Equipment No.</Text><TextInput autoCapitalize="characters" value={equipmentNo} onChangeText={(v) => setEquipmentNo(v.toUpperCase())} style={styles.input} /><Text style={styles.label}>DBMS Invoice No.</Text><TextInput autoCapitalize="characters" value={dbmsInvoiceNo} onChangeText={(v) => setDbmsInvoiceNo(v.toUpperCase())} style={styles.input} /><Text style={styles.label}>SVR No.</Text><TextInput autoCapitalize="characters" value={svrNo} onChangeText={(v) => setSvrNo(v.toUpperCase())} style={styles.input} /><Pressable disabled={!equipmentNo.trim() || !dbmsInvoiceNo.trim() || !svrNo.trim() || submit.isPending} onPress={() => setConfirm('submit')} style={[styles.submit, (!equipmentNo.trim() || !dbmsInvoiceNo.trim() || !svrNo.trim()) && styles.disabled]}><Text style={styles.submitText}>Submit for Acceptance</Text></Pressable></View></MotionView> : null}

      {entry.status === 'ACCEPTANCE_PENDING' && serviceCrm ? <MotionView delay={120}><View style={styles.crmCard}><Text style={styles.crmTitle}>Service CRM Acceptance</Text><Text style={styles.actionText}>Review the complete file and record the final Equipment Registration No.</Text><Text style={styles.label}>Equipment Registration No.</Text><TextInput autoCapitalize="characters" value={registrationNo} onChangeText={(v) => setRegistrationNo(v.toUpperCase())} style={styles.input} /><Pressable disabled={!registrationNo.trim() || accept.isPending} onPress={() => setConfirm('accept')} style={[styles.submit, !registrationNo.trim() && styles.disabled]}><Text style={styles.submitText}>Accept Entry</Text></Pressable></View></MotionView> : null}

      {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
    </ScrollView>

    <Modal visible={Boolean(confirm)} transparent animationType="fade" onRequestClose={() => setConfirm(null)}><View style={styles.modalBackdrop}><View style={styles.dialog}><Text style={styles.dialogTitle}>{confirm === 'submit' ? 'Submit installation?' : 'Accept installation?'}</Text><Text style={styles.dialogText}>{confirm === 'submit' ? 'This moves the entry to Acceptance Pending. The server will verify required documents and fields.' : 'This records the registration number and marks the entry Accepted.'}</Text><View style={styles.dialogActions}><Pressable onPress={() => setConfirm(null)}><Text style={styles.cancel}>Cancel</Text></Pressable><Pressable onPress={() => confirm === 'submit' ? submit.mutate() : accept.mutate()} style={styles.confirm}>{submit.isPending || accept.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Confirm</Text>}</Pressable></View></View></View></Modal>
  </SafeAreaView>;
}
function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) { return <View style={[styles.row, last && styles.rowLast]}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>; }
function Step({ label, done = false, active = false }: { label: string; done?: boolean; active?: boolean }) { return <View style={styles.step}><View style={[styles.stepDot, done && styles.stepDone, active && styles.stepActive]} /><Text style={[styles.stepText, (done || active) && styles.stepTextStrong]}>{label}</Text></View>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, content: { gap: 10, paddingBottom: 36 }, hero: { padding: 14, borderRadius: 18, backgroundColor: colors.navy }, heroTop:{flexDirection:'row',alignItems:'flex-start',gap:9},heroIcon:{width:38,height:38,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.12)'},heroCopy:{flex:1,minWidth:0},eyebrow: { color: '#B7D8FF', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, entryNo: { color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 3 }, heroMeta: { color: '#D6E7FF', fontSize: 10, marginTop: 3 }, status: { alignSelf: 'flex-start', marginTop: 0, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.warningSoft }, statusText: { color: colors.warning, fontSize: 10, fontWeight: '900' }, journey: { flexDirection: 'row', marginTop: 12, paddingTop:10, borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'rgba(255,255,255,.16)' }, step: { flex: 1, alignItems: 'center' }, stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#49627F' }, stepDone: { backgroundColor: colors.success }, stepActive: { backgroundColor: colors.warning }, stepText: { color: '#AFC7E2', fontSize: 8, fontWeight: '700', marginTop: 5, textAlign: 'center' }, stepTextStrong: { color: '#fff', fontWeight: '900' }, sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '900' }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, docCount: { color: colors.textMuted, fontSize: 10, fontWeight: '800' }, card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, rowLast: { borderBottomWidth: 0 }, rowLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' }, rowValue: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 11, fontWeight: '800' }, part: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, partCopy: { flex: 1 }, partNo: { color: colors.blue, fontSize: 12, fontWeight: '900' }, partDesc: { color: colors.textMuted, fontSize: 10, marginTop: 2 }, qty: { color: colors.text, fontSize: 12, fontWeight: '900' }, docCard: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, docTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, docTitle: { color: colors.text, fontSize: 11, fontWeight: '900' }, docName: { color: colors.textMuted, fontSize: 9, marginTop: 2 }, docBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4, borderRadius: radius.sm }, docBadgeDone: { backgroundColor: colors.successSoft }, docBadgeMissing: { backgroundColor: colors.warningSoft }, docBadgeText: { fontSize: 9, fontWeight: '900' }, docBadgeDoneText: { color: colors.success }, docBadgeMissingText: { color: colors.warning }, docActions: { flexDirection: 'row', gap: spacing.sm }, primary: { minHeight: 42, minWidth: 84, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.navy }, primaryText: { color: '#fff', fontSize: 11, fontWeight: '900' }, secondary: { minHeight: 42, minWidth: 84, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.navy, backgroundColor: '#fff' }, secondaryText: { color: colors.navy, fontSize: 11, fontWeight: '900' }, actionCard: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: '#B8D3F8', backgroundColor: colors.blueSoft }, actionTitle: { color: colors.navy, fontSize: 14, fontWeight: '900' }, actionText: { color: colors.navySoft, fontSize: 10, lineHeight: 16 }, crmCard: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: '#9FC4E6', backgroundColor: '#EEF7FF' }, crmTitle: { color: colors.navy, fontSize: 14, fontWeight: '900' }, label: { color: colors.textMuted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginTop: 3 }, input: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', color: colors.text, fontSize: 13 }, submit: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy, marginTop: spacing.sm }, submitText: { color: '#fff', fontSize: 12, fontWeight: '900' }, disabled: { opacity: 0.45 }, message: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.blueSoft }, messageText: { color: colors.navy, fontSize: 11, fontWeight: '700' }, modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(2,6,23,0.65)' }, dialog: { margin: spacing.xl, padding: spacing.xl, gap: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface }, dialogTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, dialogText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 }, dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.lg }, cancel: { color: colors.textMuted, fontWeight: '800' }, confirm: { minHeight: 44, minWidth: 90, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy }, confirmText: { color: '#fff', fontWeight: '900' }, error: { color: colors.danger } });