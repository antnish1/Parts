import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { approveReview, rejectOrder, setEditedQuantity } from '@/services/approvals';
import { formatMoney, getOrder, getOrderItems, type OrderItem } from '@/services/orders';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ApprovalReviewScreen() {
  const params = useLocalSearchParams<{ orderId: string }>();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const order = useQuery({ queryKey: ['order', orderId], queryFn: () => getOrder(orderId), enabled: Boolean(orderId) });
  const items = useQuery({ queryKey: ['order-items', orderId], queryFn: () => getOrderItems(orderId), enabled: Boolean(orderId) });
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);

  useEffect(() => {
    if (!items.data) return;
    setQuantities(Object.fromEntries(items.data.map((item) => [item.id, String(item.edited_qty ?? item.qty)])));
  }, [items.data]);

  const hasEdits = useMemo(() => (items.data ?? []).some((item) => Number(quantities[item.id] ?? item.edited_qty ?? item.qty) !== (item.edited_qty ?? item.qty)), [items.data, quantities]);

  const approve = useMutation({
    mutationFn: async (mode: 'accept_edits' | 'approve_original') => {
      if (mode === 'accept_edits') {
        for (const item of items.data ?? []) {
          const next = Number(quantities[item.id] ?? item.edited_qty ?? item.qty);
          if (!Number.isInteger(next) || next < 0) throw new Error(`Invalid quantity for ${item.part_no}.`);
          if (next !== (item.edited_qty ?? item.qty)) await setEditedQuantity(item.id, next);
        }
      }
      return approveReview(orderId, mode);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobile-approval-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      router.back();
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Approval failed.'),
  });

  const reject = useMutation({
    mutationFn: () => rejectOrder(orderId, role === 'manager' ? 'manager' : role === 'developer' ? 'developer' : 'super'),
    onSuccess: async () => {
      setRejectOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['mobile-approval-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      router.back();
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Reject failed.'),
  });

  if (!['super', 'manager', 'developer'].includes(role ?? '')) return <SafeAreaView style={styles.center}><Text style={styles.error}>This review is not available for your role.</Text></SafeAreaView>;
  if (order.isLoading || items.isLoading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={colors.navy} /></SafeAreaView>;
  if (!order.data || order.isError) return <SafeAreaView style={styles.center}><Text style={styles.error}>Unable to load this order.</Text></SafeAreaView>;

  const busy = approve.isPending || reject.isPending;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹ Back</Text></Pressable>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>APPROVAL REVIEW</Text>
          <Text style={styles.orderNo}>{order.data.order_no}</Text>
          <Text style={styles.customer}>{order.data.customer_name || order.data.machine_no || 'No customer/machine'} · {order.data.branch}</Text>
          <View style={styles.summary}><Mini label="Order Type" value={order.data.order_type || '—'} /><Mini label="Original Qty" value={String((items.data ?? []).reduce((sum, item) => sum + item.qty, 0))} /><Mini label="Value" value={formatMoney(order.data.total_value)} /></View>
        </View>

        <Text style={styles.sectionTitle}>Parts & review quantity</Text>
        {(items.data ?? []).map((item) => <ReviewItem key={item.id} item={item} value={quantities[item.id] ?? String(item.edited_qty ?? item.qty)} onChange={(value) => setQuantities((current) => ({ ...current, [item.id]: value.replace(/[^0-9]/g, '') }))} />)}

        {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
        <View style={styles.note}><Text style={styles.noteTitle}>{role === 'manager' ? 'Manager review' : 'Approver review'}</Text><Text style={styles.noteText}>{role === 'manager' ? 'Accept Edits approves the edited quantities. Approve Original Qty discards edits and approves the original quantities.' : 'Approval at this stage forwards the order to Manager approval. Quantity edits remain in the established edited-quantity field.'}</Text></View>

        <View style={styles.actions}>
          <Pressable disabled={busy} onPress={() => approve.mutate('accept_edits')} style={[styles.primary, busy && styles.disabled]}>{approve.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{hasEdits ? 'Accept Edits' : 'Approve Current Qty'}</Text>}</Pressable>
          <Pressable disabled={busy} onPress={() => approve.mutate('approve_original')} style={[styles.secondary, busy && styles.disabled]}><Text style={styles.secondaryText}>Approve Original Qty</Text></Pressable>
          <Pressable disabled={busy} onPress={() => setRejectOpen(true)} style={[styles.reject, busy && styles.disabled]}><Text style={styles.rejectText}>Reject Order</Text></Pressable>
        </View>
      </ScrollView>

      <Modal visible={rejectOpen} transparent animationType="fade" onRequestClose={() => setRejectOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.dialog}><Text style={styles.dialogTitle}>Reject order?</Text><Text style={styles.dialogText}>This will execute the existing server-side rejection workflow for {order.data.order_no}. This action cannot be undone from this screen.</Text><View style={styles.dialogActions}><Pressable onPress={() => setRejectOpen(false)}><Text style={styles.cancel}>Cancel</Text></Pressable><Pressable disabled={reject.isPending} onPress={() => reject.mutate()} style={styles.rejectConfirm}>{reject.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.rejectConfirmText}>Reject</Text>}</Pressable></View></View></View>
      </Modal>
    </SafeAreaView>
  );
}

function ReviewItem({ item, value, onChange }: { item: OrderItem; value: string; onChange: (value: string) => void }) {
  const next = Number(value || 0);
  const changed = next !== (item.edited_qty ?? item.qty);
  return <View style={[styles.itemCard, changed && styles.itemChanged]}><View style={styles.itemTop}><View style={styles.itemCopy}><Text style={styles.partNo}>{item.part_no}</Text><Text numberOfLines={2} style={styles.description}>{item.description || 'No description'}</Text></View><Text style={styles.original}>Original {item.qty}</Text></View><View style={styles.qtyRow}><View><Text style={styles.qtyLabel}>Review Qty</Text><TextInput keyboardType="number-pad" value={value} onChangeText={onChange} style={styles.qtyInput} /></View><View style={styles.valueBlock}><Text style={styles.qtyLabel}>Line value</Text><Text style={styles.lineValue}>{formatMoney((item.dnp ?? 0) * next)}</Text></View></View></View>;
}
function Mini({ label, value }: { label: string; value: string }) { return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text numberOfLines={1} style={styles.miniValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: spacing.xl }, content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 44 }, back: { minHeight: 38, justifyContent: 'center', alignSelf: 'flex-start' }, backText: { color: colors.blue, fontSize: 14, fontWeight: '800' }, hero: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.navy }, eyebrow: { color: '#B7D8FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, orderNo: { color: '#fff', fontSize: 23, fontWeight: '900', marginTop: 4 }, customer: { color: '#D6E7FF', fontSize: 12, marginTop: 4 }, summary: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }, mini: { flex: 1, minWidth: 0 }, miniLabel: { color: '#AFC7E2', fontSize: 9, fontWeight: '700' }, miniValue: { color: '#fff', fontSize: 11, fontWeight: '900', marginTop: 2 }, sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '900' }, itemCard: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, itemChanged: { borderColor: colors.warning, backgroundColor: colors.warningSoft }, itemTop: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }, itemCopy: { flex: 1 }, partNo: { color: colors.text, fontSize: 14, fontWeight: '900' }, description: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 }, original: { color: colors.textMuted, fontSize: 10, fontWeight: '800' }, qtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.lg, marginTop: spacing.md }, qtyLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700' }, qtyInput: { width: 92, minHeight: 44, marginTop: 4, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', color: colors.text, fontSize: 15, fontWeight: '900' }, valueBlock: { alignItems: 'flex-end' }, lineValue: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: 4 }, note: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.blueSoft }, noteTitle: { color: colors.navy, fontSize: 12, fontWeight: '900' }, noteText: { color: colors.navySoft, fontSize: 11, lineHeight: 17, marginTop: 4 }, message: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerSoft }, messageText: { color: colors.danger, fontSize: 12, lineHeight: 18 }, actions: { gap: spacing.sm }, primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy }, primaryText: { color: '#fff', fontSize: 14, fontWeight: '900' }, secondary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.navy, backgroundColor: '#fff' }, secondaryText: { color: colors.navy, fontSize: 13, fontWeight: '900' }, reject: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: '#fff' }, rejectText: { color: colors.danger, fontSize: 13, fontWeight: '900' }, disabled: { opacity: 0.5 }, modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(2,6,23,0.65)' }, dialog: { margin: spacing.xl, padding: spacing.xl, gap: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface }, dialogTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, dialogText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 }, dialogActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.lg }, cancel: { color: colors.textMuted, fontWeight: '800' }, rejectConfirm: { minHeight: 44, minWidth: 88, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.danger }, rejectConfirmText: { color: '#fff', fontWeight: '900' }, error: { color: colors.danger, fontSize: 13 },
});
