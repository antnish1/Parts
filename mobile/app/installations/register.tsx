import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { AppIcon } from '@/components/AppIcon';
import { canManageInstallations, equipmentTypeLabel, getInstallationInvoice, listInstallationBranches, registerFromInvoice } from '@/services/installations';
import { colors, radius, spacing } from '@/theme/tokens';

export default function InstallationRegisterScreen() {
  const params = useLocalSearchParams<{ invoiceId?: string }>();
  const invoiceId = Array.isArray(params.invoiceId) ? params.invoiceId[0] : params.invoiceId;
  const { profile } = useAuth();
  const allowed = canManageInstallations(profile);
  const queryClient = useQueryClient();
  const invoice = useQuery({ queryKey: ['installation-invoice', invoiceId], queryFn: () => getInstallationInvoice(invoiceId || ''), enabled: Boolean(invoiceId && allowed) });
  const branches = useQuery({ queryKey: ['installation-branches'], queryFn: listInstallationBranches, enabled: allowed });
  const [branch, setBranch] = useState('');
  const [customer, setCustomer] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [branchOpen, setBranchOpen] = useState(false);
  const [message, setMessage] = useState('');
  const mutation = useMutation({
    mutationFn: () => registerFromInvoice({ invoiceId: invoiceId || '', branch, customerName: customer, quantity: Number(quantity) }),
    onSuccess: async (id) => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['installation-invoices'] }), queryClient.invalidateQueries({ queryKey: ['installation-entries'] })]); router.replace(`/installations/${id}`); },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Registration failed.'),
  });

  if (!allowed) return <Screen title="Register Invoice"><View style={styles.center}><Text style={styles.error}>Registration is not available for this role.</Text></View></Screen>;
  if (invoice.isLoading) return <Screen title="Register Invoice"><View style={styles.center}><ActivityIndicator size="large" color={colors.navy} /></View></Screen>;
  if (!invoiceId || invoice.isError || !invoice.data) return <Screen title="Register Invoice"><View style={styles.center}><Text style={styles.error}>Invoice record could not be loaded.</Text></View></Screen>;
  const row = invoice.data;
  if (row.installation_id) return <Screen title="Register Invoice"><View style={styles.center}><Text style={styles.info}>This invoice is already registered.</Text><Pressable onPress={() => router.replace(`/installations/${row.installation_id}`)}><Text style={styles.link}>Open registration</Text></Pressable></View></Screen>;

  function submit() {
    setMessage('');
    const qty = Number(quantity);
    if (!branch || !customer.trim()) return setMessage('Branch and Customer Name are required.');
    if (!Number.isFinite(qty) || qty <= 0) return setMessage('Quantity must be greater than zero.');
    mutation.mutate();
  }

  return <Screen title="Register Invoice" scroll={false}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={styles.hero}>
      <View style={styles.heroTop}><View style={styles.heroIcon}><AppIcon name="fileChart" size={19} color="#FFFFFF"/></View><View style={styles.heroCopy}><Text style={styles.eyebrow}>JCB INVOICE</Text><Text style={styles.invoiceNo}>{row.jcb_invoice_no}</Text><Text style={styles.meta}>{equipmentTypeLabel(row.equipment_type)} · {row.part_no}</Text></View></View>
      <View style={styles.grid}><Mini label="Serial" value={row.serial_no} /><Mini label="DBMS No." value={row.dbms_no || '—'} /><Mini label="Date" value={row.invoice_date} /><Mini label="Document" value={row.document_name} /></View></View>
    <View style={styles.card}>
      <Text style={styles.label}>Branch</Text><Pressable onPress={() => setBranchOpen(true)} style={styles.select}><Text style={branch ? styles.selectText : styles.placeholder}>{(branches.data ?? []).find((item) => item.branch_key === branch)?.display_name || branch || 'Select branch'}</Text></Pressable>
      <Text style={styles.label}>Customer Name</Text><TextInput value={customer} onChangeText={setCustomer} style={styles.input} />
      <Text style={styles.label}>Quantity</Text><TextInput keyboardType="decimal-pad" value={quantity} onChangeText={(value) => setQuantity(value.replace(/[^0-9.]/g, ''))} style={styles.input} />
      <View style={styles.note}><Text style={styles.noteText}>The JCB Invoice No., DBMS No., part, type, serial number and uploaded JCB invoice stay linked to this registration. The branch will add completion fields and remaining documents later.</Text></View>
    </View>
    {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
    <Pressable disabled={mutation.isPending} onPress={submit} style={[styles.submit, mutation.isPending && styles.disabled]}>{mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Registration</Text>}</Pressable>
  </ScrollView>
  <Modal visible={branchOpen} transparent animationType="slide" onRequestClose={() => setBranchOpen(false)}><Pressable style={styles.modalBackdrop} onPress={() => setBranchOpen(false)}><Pressable style={styles.sheet} onPress={() => undefined}><Text style={styles.sheetTitle}>Select Branch</Text><ScrollView>{(branches.data ?? []).map((item) => <Pressable key={item.branch_key} onPress={() => { setBranch(item.branch_key); setBranchOpen(false); }} style={styles.sheetRow}><Text style={styles.sheetRowTitle}>{item.display_name}</Text><Text style={styles.sheetRowMeta}>{item.branch_key}</Text></Pressable>)}</ScrollView></Pressable></Pressable></Modal>
  </Screen>;
}
function Mini({ label, value }: { label: string; value: string }) { return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text numberOfLines={1} style={styles.miniValue}>{value}</Text></View>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background }, content: { gap: 10, paddingBottom: 36 }, hero: { padding: 14, borderRadius: 18, backgroundColor: colors.navy }, heroTop:{flexDirection:'row',alignItems:'flex-start',gap:9},heroIcon:{width:38,height:38,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.12)'},heroCopy:{flex:1,minWidth:0},eyebrow: { color: '#B7D8FF', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, invoiceNo: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 3 }, meta: { color: '#D6E7FF', fontSize: 10, marginTop: 3 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop:10,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'rgba(255,255,255,.16)' }, mini: { width: '47%' }, miniLabel: { color: '#AFC7E2', fontSize: 9, fontWeight: '700' }, miniValue: { color: '#fff', fontSize: 11, fontWeight: '900', marginTop: 2 }, card: { gap: 8, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, label: { color: colors.textMuted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginTop: 3 }, select: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' }, selectText: { color: colors.text, fontSize: 13, fontWeight: '800' }, placeholder: { color: colors.textMuted, fontSize: 12 }, input: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', color: colors.text, fontSize: 13 }, note: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.blueSoft }, noteText: { color: colors.navySoft, fontSize: 10, lineHeight: 16 }, message: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerSoft }, messageText: { color: colors.danger, fontSize: 11 }, submit: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy }, submitText: { color: '#fff', fontSize: 14, fontWeight: '900' }, disabled: { opacity: 0.5 }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.6)' }, sheet: { maxHeight: '72%', padding: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface }, sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: spacing.sm }, sheetRow: { minHeight: 56, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, sheetRowTitle: { color: colors.text, fontSize: 13, fontWeight: '800' }, sheetRowMeta: { color: colors.textMuted, fontSize: 10, marginTop: 2 }, error: { color: colors.danger }, info: { color: colors.text, fontSize: 13, fontWeight: '800' }, link: { color: colors.blue, fontWeight: '900' } });