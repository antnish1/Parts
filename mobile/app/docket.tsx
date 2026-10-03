import { useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { isDocketRowReceived, lookupDocketRows, normalizeDocketNo, receiveDocketRow, type DocketRow } from '@/services/docket';
import { colors, radius, spacing } from '@/theme/tokens';

export default function DocketScannerScreen() {
  const { role } = useAuth();
  const allowed = ['branch', 'admin', 'super', 'manager', 'developer'].includes(role ?? '');
  const [permission, requestPermission] = useCameraPermissions();
  const [docketNo, setDocketNo] = useState('');
  const [rows, setRows] = useState<DocketRow[]>([]);
  const [status, setStatus] = useState('Enter a docket number or scan its barcode.');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [torch, setTorch] = useState(false);
  const [receiveAllOpen, setReceiveAllOpen] = useState(false);
  const lastScanRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });

  if (!allowed) return <SafeAreaView style={styles.center}><Text style={styles.error}>Docket Scanner is not available for this role.</Text><Pressable onPress={() => router.back()}><Text style={styles.link}>Go back</Text></Pressable></SafeAreaView>;

  async function search(value = docketNo) {
    const normalized = normalizeDocketNo(value);
    if (!normalized) return setStatus('Enter or scan a docket number.');
    setLoading(true);
    setDocketNo(normalized);
    setStatus(`Searching ${normalized}…`);
    try {
      const result = await lookupDocketRows(normalized);
      setRows(result);
      setStatus(result.length ? `${result.length} docket row(s) found.` : 'No matching docket rows found.');
    } catch (error) {
      setRows([]);
      setStatus(error instanceof Error ? error.message : 'Docket lookup failed.');
    } finally {
      setLoading(false);
    }
  }

  async function openScanner() {
    if (!permission?.granted) {
      const next = await requestPermission();
      if (!next.granted) return setStatus('Camera permission is required to scan docket barcodes.');
    }
    setScannerOpen(true);
    setStatus('Scanner ready. Point the camera at the docket barcode.');
  }

  function onBarcode(data: string) {
    const normalized = normalizeDocketNo(data);
    if (!normalized) return;
    const now = Date.now();
    if (lastScanRef.current.value === normalized && now - lastScanRef.current.at < 2500) return;
    lastScanRef.current = { value: normalized, at: now };
    setScannerOpen(false);
    void search(normalized);
  }

  async function receive(row: DocketRow) {
    setBusyId(`${row.source_type}-${row.id}`);
    try {
      await receiveDocketRow(row);
      await search(row.docket_no || docketNo);
      setStatus(`${row.part_no} marked as received.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Receive update failed.');
    } finally {
      setBusyId('');
    }
  }

  async function receiveAll() {
    const pending = rows.filter((row) => !isDocketRowReceived(row));
    if (!pending.length) return;
    setReceiveAllOpen(false);
    setBusyId('__all__');
    let success = 0;
    const failed: string[] = [];
    for (const row of pending) {
      try { await receiveDocketRow(row); success += 1; } catch { failed.push(row.part_no); }
    }
    await search(docketNo);
    setBusyId('');
    setStatus(failed.length ? `${success} received; failed: ${failed.join(', ')}.` : `All ${success} pending row(s) marked as received.`);
  }

  const pendingCount = rows.filter((row) => !isDocketRowReceived(row)).length;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹ Back</Text></Pressable>
        <View><Text style={styles.title}>Docket Scanner</Text><Text style={styles.subtitle}>Scan or search by Docket No. only.</Text></View>

        <View style={styles.scannerCard}>
          <View style={styles.scanGraphic}><View style={styles.scanFrame}><Text style={styles.scanIcon}>▦</Text><Text style={styles.scanHint}>Native barcode scanner</Text></View></View>
          <Pressable onPress={() => void openScanner()} style={styles.scanButton}><Text style={styles.scanButtonText}>Open Camera Scanner</Text></Pressable>
        </View>

        <View style={styles.searchRow}>
          <TextInput autoCapitalize="characters" autoCorrect={false} value={docketNo} onChangeText={(value) => setDocketNo(normalizeDocketNo(value))} onSubmitEditing={() => void search()} returnKeyType="search" placeholder="Docket number" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Pressable disabled={loading || Boolean(busyId)} onPress={() => void search()} style={styles.searchButton}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchText}>Search</Text>}</Pressable>
        </View>
        <View style={styles.status}><Text style={styles.statusText}>{status}</Text></View>

        {rows.length ? <View style={styles.resultHeader}><Text style={styles.resultTitle}>{rows.length} row(s)</Text><Pressable disabled={!pendingCount || Boolean(busyId)} onPress={() => setReceiveAllOpen(true)} style={[styles.receiveAll, (!pendingCount || Boolean(busyId)) && styles.disabled]}><Text style={styles.receiveAllText}>{pendingCount ? `Receive All (${pendingCount})` : 'All Received'}</Text></Pressable></View> : null}
        {rows.map((row) => {
          const key = `${row.source_type}-${row.id}`;
          const received = isDocketRowReceived(row);
          return <View key={key} style={[styles.rowCard, received && styles.receivedCard]}>
            <View style={styles.rowTop}><View style={styles.rowCopy}><Text style={styles.partNo}>{row.part_no}</Text><Text numberOfLines={2} style={styles.description}>{row.description || 'No description'}</Text></View><View style={[styles.badge, received ? styles.badgeDone : styles.badgeOpen]}><Text style={[styles.badgeText, received ? styles.badgeDoneText : styles.badgeOpenText]}>{received ? 'Received' : 'Pending'}</Text></View></View>
            <View style={styles.metaGrid}><Mini label="Order" value={row.final_order_no || row.order_no} /><Mini label="Branch" value={row.branch} /><Mini label="Billed" value={String(row.billed_qty)} /><Mini label="Received" value={String(row.received_qty)} /><Mini label="Invoice" value={row.invoice_no || '—'} /><Mini label="Transport" value={row.transport_name || '—'} /></View>
            {!received ? <Pressable disabled={Boolean(busyId)} onPress={() => void receive(row)} style={[styles.receiveButton, Boolean(busyId) && styles.disabled]}>{busyId === key ? <ActivityIndicator color="#fff" /> : <Text style={styles.receiveText}>Mark Received</Text>}</Pressable> : null}
          </View>;
        })}
      </ScrollView>

      <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
        <SafeAreaView style={styles.cameraPage} edges={['top', 'bottom']}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            onBarcodeScanned={({ data }) => onBarcode(data)}
          />
          <View style={styles.cameraOverlay} pointerEvents="box-none">
            <View style={styles.cameraTop}><Pressable onPress={() => setScannerOpen(false)} style={styles.cameraControl}><Text style={styles.cameraControlText}>Close</Text></Pressable><Pressable onPress={() => setTorch((value) => !value)} style={styles.cameraControl}><Text style={styles.cameraControlText}>{torch ? 'Torch Off' : 'Torch On'}</Text></Pressable></View>
            <View style={styles.cameraFrame}><View style={styles.focusBox} /></View>
            <Text style={styles.cameraHint}>Align the docket barcode inside the frame</Text>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={receiveAllOpen} transparent animationType="fade" onRequestClose={() => setReceiveAllOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.dialog}><Text style={styles.dialogTitle}>Receive all pending rows?</Text><Text style={styles.dialogText}>This will mark {pendingCount} pending row(s) for docket {docketNo} as received using the existing server-side receive workflow.</Text><View style={styles.dialogActions}><Pressable onPress={() => setReceiveAllOpen(false)}><Text style={styles.cancel}>Cancel</Text></Pressable><Pressable onPress={() => void receiveAll()} style={styles.dialogPrimary}><Text style={styles.dialogPrimaryText}>Receive all</Text></Pressable></View></View></View>
      </Modal>
    </SafeAreaView>
  );
}

function Mini({ label, value }: { label: string; value: string }) { return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text numberOfLines={1} style={styles.miniValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 44 }, back: { minHeight: 38, justifyContent: 'center', alignSelf: 'flex-start' }, backText: { color: colors.blue, fontSize: 14, fontWeight: '800' }, title: { color: colors.text, fontSize: 24, fontWeight: '900' }, subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  scannerCard: { padding: spacing.md, gap: spacing.md, borderRadius: radius.xl, backgroundColor: colors.navy }, scanGraphic: { minHeight: 128, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: '#102D50' }, scanFrame: { height: 84, width: '72%', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 2, borderColor: '#B7D8FF', borderStyle: 'dashed' }, scanIcon: { color: '#fff', fontSize: 30, fontWeight: '900' }, scanHint: { color: '#D6E7FF', fontSize: 10, marginTop: 5 }, scanButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: '#fff' }, scanButtonText: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  searchRow: { flexDirection: 'row', gap: spacing.sm }, input: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', paddingHorizontal: spacing.md, color: colors.text, fontSize: 14 }, searchButton: { width: 78, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy }, searchText: { color: '#fff', fontSize: 12, fontWeight: '900' }, status: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.blueSoft }, statusText: { color: colors.navySoft, fontSize: 11, lineHeight: 17 }, resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, resultTitle: { color: colors.text, fontSize: 13, fontWeight: '900' }, receiveAll: { minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.success }, receiveAllText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  rowCard: { padding: spacing.lg, gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, receivedCard: { backgroundColor: colors.successSoft, borderColor: '#BFE8D8' }, rowTop: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }, rowCopy: { flex: 1 }, partNo: { color: colors.text, fontSize: 14, fontWeight: '900' }, description: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 }, badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm }, badgeOpen: { backgroundColor: colors.warningSoft }, badgeDone: { backgroundColor: '#D8F1E7' }, badgeText: { fontSize: 10, fontWeight: '900' }, badgeOpenText: { color: colors.warning }, badgeDoneText: { color: colors.success }, metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, mini: { width: '31%', minWidth: 88 }, miniLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700' }, miniValue: { color: colors.text, fontSize: 11, fontWeight: '800', marginTop: 2 }, receiveButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy }, receiveText: { color: '#fff', fontSize: 12, fontWeight: '900' }, disabled: { opacity: 0.45 },
  cameraPage: { flex: 1, backgroundColor: '#000' }, cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: spacing.lg, backgroundColor: 'rgba(0,0,0,0.18)' }, cameraTop: { flexDirection: 'row', justifyContent: 'space-between' }, cameraControl: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: 'rgba(11,31,58,0.82)' }, cameraControlText: { color: '#fff', fontSize: 12, fontWeight: '900' }, cameraFrame: { flex: 1, alignItems: 'center', justifyContent: 'center' }, focusBox: { width: '82%', height: 180, borderRadius: radius.lg, borderWidth: 3, borderColor: '#fff' }, cameraHint: { alignSelf: 'center', color: '#fff', fontSize: 12, fontWeight: '800', marginBottom: spacing.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(2,6,23,0.65)' }, dialog: { margin: spacing.xl, padding: spacing.xl, gap: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface }, dialogTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, dialogText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 }, dialogActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.lg }, cancel: { color: colors.textMuted, fontWeight: '800' }, dialogPrimary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.success }, dialogPrimaryText: { color: '#fff', fontWeight: '900' }, error: { color: colors.danger, fontSize: 13 }, link: { color: colors.blue, fontWeight: '800' },
});
