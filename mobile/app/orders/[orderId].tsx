import { useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { StatusChip } from '@/components/StatusChip';
import { approveOrderStage, rejectOrder } from '@/services/approvals';
import { getInTransitDetails, getInTransitQtyByBranchParts, type InTransitDetailRow } from '@/services/inTransit';
import { getBilledQty, getEffectiveQty, getEffectiveValue, getPendingQty, getReceivedQty, getResolvedRowStatus, normalizePartNo, normalizeStatus } from '@/lib/orderLogic';
import { formatDate, formatMoney, getOrder, getOrderBillingChunks, getOrderItems } from '@/services/orders';
import { colors, radius, spacing } from '@/theme/tokens';

export default function OrderDetailScreen() {
  const params = useLocalSearchParams<{ orderId: string }>();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const { role, profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTransit, setSelectedTransit] = useState<{ partNo: string; qty: number } | null>(null);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  const order = useQuery({ queryKey: ['order', orderId], queryFn: () => getOrder(orderId), enabled: Boolean(orderId) });
  const items = useQuery({ queryKey: ['order-items', orderId], queryFn: () => getOrderItems(orderId), enabled: Boolean(orderId) });
  const itemIds = (items.data ?? []).map((item) => item.id);
  const partNos = (items.data ?? []).map((item) => item.part_no);

  const billings = useQuery({
    queryKey: ['order-billings', orderId, itemIds.join('|')],
    queryFn: () => getOrderBillingChunks(itemIds),
    enabled: itemIds.length > 0,
  });

  const inTransit = useQuery({
    queryKey: ['order-in-transit', order.data?.branch, partNos.join('|')],
    queryFn: () => getInTransitQtyByBranchParts(order.data!.branch!, partNos),
    enabled: Boolean(order.data?.branch) && partNos.length > 0,
    staleTime: 0,
  });

  const transitDetails = useQuery({
    queryKey: ['order-in-transit-details', order.data?.branch, selectedTransit?.partNo],
    queryFn: () => getInTransitDetails(order.data!.branch!, selectedTransit!.partNo),
    enabled: Boolean(order.data?.branch && selectedTransit),
    staleTime: 0,
  });

  const billingMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof billings.data>>();
    for (const chunk of billings.data ?? []) map.set(chunk.item_id, [...(map.get(chunk.item_id) ?? []), chunk]);
    return map;
  }, [billings.data]);

  const hydratedItems = useMemo(() => (items.data ?? []).map((item) => ({
    ...item,
    billing_chunks: (billingMap.get(item.id) ?? []).map((chunk) => ({
      billed_qty: chunk.billed_qty,
      received_qty: chunk.received_qty,
      received_at: chunk.received_at,
    })),
  })), [billingMap, items.data]);

  const normalizedApproval = normalizeStatus(order.data?.approval_status);
  const pendingWorkflow = normalizedApproval === 'PENDING APPROVAL' || normalizedApproval === 'PENDING MANAGER APPROVAL';
  const selectedSuper = role === 'super' && order.data?.approver_id === profile?.id;
  const canApprove = Boolean(order.data && pendingWorkflow && (role === 'developer' || role === 'manager' || selectedSuper));
  const managerOverride = role === 'manager' && normalizedApproval !== 'PENDING MANAGER APPROVAL';

  const action = useMutation({
    mutationFn: async (type: 'approve' | 'reject') => {
      if (!orderId || !role || !['super', 'manager', 'developer'].includes(role)) throw new Error('This role cannot approve this order.');
      if (type === 'approve') return approveOrderStage(orderId, role as 'super' | 'manager' | 'developer');
      return rejectOrder(orderId, role as 'super' | 'manager' | 'developer');
    },
    onSuccess: async (_data, type) => {
      setConfirmAction(null);
      setActionMessage(type === 'approve' ? 'Approval action completed.' : 'Order rejected.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['order', orderId] }),
        queryClient.invalidateQueries({ queryKey: ['order-items', orderId] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-approval-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ]);
    },
    onError: (error) => {
      setConfirmAction(null);
      setActionMessage(error instanceof Error ? error.message : 'Order action failed.');
    },
  });

  if (order.isLoading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={colors.navy} /></SafeAreaView>;
  if (order.isError || !order.data) return <SafeAreaView style={styles.center}><Text style={styles.error}>Unable to load this order.</Text><Pressable onPress={() => router.back()}><Text style={styles.link}>Go back</Text></Pressable></SafeAreaView>;

  const row = order.data;
  const canCorrect = role === 'manager' || role === 'developer';
  const transitMap = inTransit.data ?? {};
  const totalQty = hydratedItems.reduce((sum, item) => sum + getEffectiveQty(item), 0);
  const totalBilled = hydratedItems.reduce((sum, item) => sum + getBilledQty(item), 0);
  const totalPending = hydratedItems.reduce((sum, item) => sum + getPendingQty(item), 0);
  const totalReceived = hydratedItems.reduce((sum, item) => sum + getReceivedQty(item), 0);
  const totalValue = hydratedItems.reduce((sum, item) => sum + getEffectiveValue(item), 0);

  function requestApprovalAction(type: 'approve' | 'reject') {
    setActionMessage('');
    setConfirmAction(type);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹ Back</Text></Pressable>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>ORDER</Text>
              <Text style={styles.orderNo}>{row.final_order_no || row.order_no}</Text>
              <Text numberOfLines={2} style={styles.customer}>{row.customer_name || 'Customer not available'}</Text>
            </View>
            <StatusChip status={row.approval_status || row.status} />
          </View>
          <View style={styles.summaryGrid}>
            <Meta label="Branch" value={row.branch || '—'} />
            <Meta label="Machine" value={row.machine_no || '—'} />
            <Meta label="Order type" value={row.order_type || row.order_for || '—'} />
            <Meta label="Created" value={formatDate(row.created_at)} />
            <Meta label="Effective qty" value={String(totalQty)} />
            <Meta label="Effective value" value={formatMoney(totalValue)} />
          </View>
        </View>

        {canApprove ? (
          <View style={styles.approvalCard}>
            <View style={styles.approvalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.approvalEyebrow}>{role === 'manager' ? 'MANAGER APPROVAL' : 'ORDER APPROVAL'}</Text>
                <Text style={styles.approvalTitle}>{managerOverride ? 'Manager override available' : 'This order is awaiting your action'}</Text>
                <Text style={styles.approvalText}>{managerOverride ? 'The order is not currently at Manager Approval stage. Approval will use the existing audited manager override workflow.' : 'Review quantities if required, then approve or reject using the protected server workflow.'}</Text>
              </View>
              <StatusChip status={row.approval_status} />
            </View>
            <Pressable onPress={() => router.push(`/approvals/${orderId}`)} style={styles.reviewButton}><Text style={styles.reviewButtonText}>Review quantities</Text></Pressable>
            <View style={styles.approvalActions}>
              <Pressable disabled={action.isPending} onPress={() => requestApprovalAction('approve')} style={[styles.approveButton, action.isPending && styles.disabled]}><Text style={styles.approveButtonText}>{role === 'manager' ? 'Approve Order' : 'Approve / Send Forward'}</Text></Pressable>
              <Pressable disabled={action.isPending} onPress={() => requestApprovalAction('reject')} style={[styles.rejectButton, action.isPending && styles.disabled]}><Text style={styles.rejectButtonText}>Reject</Text></Pressable>
            </View>
            {actionMessage ? <Text style={styles.actionMessage}>{actionMessage}</Text> : null}
          </View>
        ) : null}

        <Pressable onPress={() => router.push(`/orders/${orderId}/activity`)} style={styles.activity}>
          <View><Text style={styles.activityTitle}>Activity, comments & billing</Text><Text style={styles.activityText}>Open the complete audited order history</Text></View><Text style={styles.activityArrow}>›</Text>
        </Pressable>

        {canCorrect ? <Pressable onPress={() => router.push(`/orders/${orderId}/correct`)} style={styles.correct}><Text style={styles.correctTitle}>Order Data Correction</Text><Text style={styles.correctText}>Manager / Developer audited correction console</Text></Pressable> : null}

        <Text style={styles.sectionTitle}>Order quantities</Text>
        <View style={styles.totals}>
          <MiniMetric label="Ordered" value={String(totalQty)} />
          <MiniMetric label="Billed" value={String(totalBilled)} />
          <MiniMetric label="Pending" value={String(totalPending)} />
          <MiniMetric label="Received" value={String(totalReceived)} />
        </View>

        {inTransit.isError ? <View style={styles.errorBox}><Text style={styles.errorBoxText}>In-Transit quantities could not be loaded. Pull back and reopen this order, or retry later.</Text></View> : null}
        {billings.isError ? <View style={styles.errorBox}><Text style={styles.errorBoxText}>Billing/docket chunks could not be loaded.</Text></View> : null}

        <Text style={styles.sectionTitle}>Parts ({items.data?.length ?? 0})</Text>
        {hydratedItems.map((item) => {
          const chunks = billingMap.get(item.id) ?? [];
          const transitQty = transitMap[normalizePartNo(item.part_no)] ?? 0;
          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partNo}>{item.part_no}</Text>
                  <Text style={styles.description}>{item.description || 'No description'}</Text>
                </View>
                <StatusChip status={getResolvedRowStatus(item)} />
              </View>

              <View style={styles.qtyGrid}>
                <Mini label="Qty" value={String(getEffectiveQty(item))} />
                <Mini label="Billed" value={String(getBilledQty(item))} />
                <Mini label="Pending" value={String(getPendingQty(item))} />
                <Mini label="Received" value={String(getReceivedQty(item))} />
              </View>

              <View style={styles.itemMeta}>
                <Text style={styles.itemMetaText}>DNP {formatMoney(item.dnp)}</Text>
                <Text style={styles.itemMetaText}>Value {formatMoney(getEffectiveValue(item))}</Text>
                <Text style={styles.itemMetaText}>Reg {formatDate(item.order_reg_date)}</Text>
              </View>

              <View style={styles.transitRow}>
                <Text style={styles.transitLabel}>In Transit</Text>
                {inTransit.isLoading ? <ActivityIndicator size="small" color={colors.navy} /> : transitQty > 0 ? (
                  <Pressable onPress={() => setSelectedTransit({ partNo: item.part_no, qty: transitQty })} style={styles.transitBadge}><Text style={styles.transitBadgeText}>⚠ {transitQty} · View orders</Text></Pressable>
                ) : <Text style={styles.transitZero}>0</Text>}
              </View>

              {chunks.length ? (
                <View style={styles.chunks}>
                  <Text style={styles.chunksTitle}>Billing / Docket Chunks ({chunks.length})</Text>
                  {chunks.map((chunk) => (
                    <View key={chunk.id} style={styles.chunkRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.chunkTitle}>{chunk.invoice_no || 'Invoice not available'} · Qty {Number(chunk.billed_qty ?? 0)}</Text>
                        <Text style={styles.chunkText}>{chunk.docket_no || 'No docket'} · {chunk.transport_name || 'No transport'}</Text>
                      </View>
                      <Text style={styles.chunkDate}>{formatDate(chunk.billing_date || chunk.created_at)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
        {items.isError ? <Text style={styles.error}>Part details could not be loaded.</Text> : null}

        <Text style={styles.sectionTitle}>Processing & dispatch</Text>
        <View style={styles.detailCard}>
          <DetailRow label="Processing ref" value={row.processing_reference} />
          <DetailRow label="Processed date" value={formatDate(row.processed_date)} />
          <DetailRow label="Final order no." value={row.final_order_no} />
          <DetailRow label="DBMS invoice" value={row.dbms_invoice_no} />
          <DetailRow label="DBMS invoice date" value={formatDate(row.dbms_invoice_date)} />
          <DetailRow label="Docket" value={row.docket_no} />
          <DetailRow label="Transport" value={row.transport_name} />
          <DetailRow label="Received" value={formatDate(row.received_date)} last />
        </View>
      </ScrollView>

      <Modal visible={Boolean(selectedTransit)} transparent animationType="slide" onRequestClose={() => setSelectedTransit(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetEyebrow}>IN TRANSIT</Text>
                <Text style={styles.sheetTitle}>{selectedTransit?.partNo}</Text>
                <Text style={styles.sheetText}>Total quantity in transit: {selectedTransit?.qty ?? 0}</Text>
              </View>
              <Pressable onPress={() => setSelectedTransit(null)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              {transitDetails.isLoading ? <ActivityIndicator color={colors.navy} /> : null}
              {transitDetails.isError ? <Text style={styles.error}>Unable to load contributing orders.</Text> : null}
              {(transitDetails.data ?? []).map((detail: InTransitDetailRow) => (
                <Pressable key={`${detail.order_id}-${detail.order_no}-${detail.qty}`} onPress={() => { setSelectedTransit(null); router.push(`/orders/${detail.order_id}`); }} style={styles.transitDetail}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.transitOrder}>{detail.order_no || 'Order'}</Text>
                    <Text style={styles.transitMeta}>{detail.branch || '—'} · {detail.order_type || '—'} · {detail.order_for || '—'}</Text>
                    <Text style={styles.transitMeta}>{formatDate(detail.order_date)} · {detail.status || '—'}</Text>
                  </View>
                  <Text style={styles.transitQty}>Qty {detail.qty}</Text>
                </Pressable>
              ))}
              {!transitDetails.isLoading && !transitDetails.isError && (transitDetails.data ?? []).length === 0 ? <Text style={styles.empty}>No active contributing orders found.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(confirmAction)} transparent animationType="fade" onRequestClose={() => setConfirmAction(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{confirmAction === 'approve' ? 'Approve this order?' : 'Reject this order?'}</Text>
            <Text style={styles.dialogText}>{confirmAction === 'approve' && managerOverride ? 'This uses the audited Manager override path because the order is not currently at Manager Approval stage.' : 'This action uses the same protected server workflow as the web portal.'}</Text>
            <View style={styles.dialogActions}>
              <Pressable disabled={action.isPending} onPress={() => setConfirmAction(null)}><Text style={styles.cancel}>Cancel</Text></Pressable>
              <Pressable disabled={action.isPending} onPress={() => confirmAction && action.mutate(confirmAction)} style={confirmAction === 'reject' ? styles.confirmReject : styles.confirmApprove}>
                {action.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>{confirmAction === 'approve' ? 'Approve' : 'Reject'}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Meta({ label, value }: { label: string; value: string }) { return <View style={styles.meta}><Text style={styles.metaLabel}>{label}</Text><Text numberOfLines={1} style={styles.metaValue}>{value}</Text></View>; }
function Mini({ label, value }: { label: string; value: string }) { return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue}>{value}</Text></View>; }
function MiniMetric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function DetailRow({ label, value, last = false }: { label: string; value: string | null | undefined; last?: boolean }) { return <View style={[styles.detailRow, last && styles.detailRowLast]}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || '—'}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 44 },
  back: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center' },
  backText: { color: colors.blue, fontSize: 14, fontWeight: '800' },
  hero: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  heroCopy: { flex: 1 },
  eyebrow: { color: colors.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  orderNo: { color: colors.text, fontSize: 23, fontWeight: '900', marginTop: 3 },
  customer: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  meta: { width: '46%' },
  metaLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  metaValue: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 2 },
  approvalCard: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: '#A7C7E7', backgroundColor: colors.blueSoft },
  approvalHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  approvalEyebrow: { color: colors.blue, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  approvalTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: 3 },
  approvalText: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  reviewButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.navy, backgroundColor: '#fff' },
  reviewButtonText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  approvalActions: { flexDirection: 'row', gap: spacing.sm },
  approveButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy },
  approveButtonText: { color: '#fff', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  rejectButton: { minWidth: 92, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: '#fff' },
  rejectButtonText: { color: colors.danger, fontSize: 11, fontWeight: '900' },
  actionMessage: { color: colors.navy, fontSize: 11, fontWeight: '700' },
  activity: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  activityTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  activityText: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  activityArrow: { color: colors.blue, fontSize: 26, fontWeight: '700' },
  correct: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: '#F0C36A', backgroundColor: colors.warningSoft },
  correctTitle: { color: colors.warning, fontSize: 12, fontWeight: '900' },
  correctText: { color: colors.text, fontSize: 10, marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: spacing.xs },
  totals: { flexDirection: 'row', gap: spacing.sm },
  metric: { flex: 1, minWidth: 0, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  metricLabel: { color: colors.textMuted, fontSize: 8, fontWeight: '800' },
  metricValue: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 3 },
  itemCard: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  partNo: { color: colors.text, fontSize: 14, fontWeight: '900' },
  description: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  qtyGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  mini: { flex: 1, minWidth: 0 },
  miniLabel: { color: colors.textMuted, fontSize: 8, fontWeight: '700' },
  miniValue: { color: colors.text, fontSize: 12, fontWeight: '900', marginTop: 2 },
  itemMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  itemMetaText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  transitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  transitLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  transitBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: '#E7B94D' },
  transitBadgeText: { color: '#7A5200', fontSize: 10, fontWeight: '900' },
  transitZero: { color: colors.text, fontSize: 11, fontWeight: '800' },
  chunks: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing.sm },
  chunksTitle: { color: colors.blue, fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  chunkRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.background },
  chunkTitle: { color: colors.text, fontSize: 10, fontWeight: '800' },
  chunkText: { color: colors.textMuted, fontSize: 9, marginTop: 2 },
  chunkDate: { color: colors.textMuted, fontSize: 9, textAlign: 'right' },
  detailCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  detailValue: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 11, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  errorBox: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: '#F2C8C8' },
  errorBoxText: { color: colors.danger, fontSize: 11, lineHeight: 17, fontWeight: '700' },
  link: { color: colors.blue, fontSize: 13, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.58)' },
  sheet: { maxHeight: '78%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface, overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  sheetEyebrow: { color: colors.blue, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 3 },
  sheetText: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.textMuted, fontSize: 28, lineHeight: 30 },
  sheetBody: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 36 },
  transitDetail: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  transitOrder: { color: colors.blue, fontSize: 12, fontWeight: '900' },
  transitMeta: { color: colors.textMuted, fontSize: 9, marginTop: 2 },
  transitQty: { color: colors.text, fontSize: 11, fontWeight: '900' },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl },
  dialog: { margin: spacing.xl, marginBottom: 'auto', marginTop: 'auto', padding: spacing.xl, gap: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface },
  dialogTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  dialogText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.lg },
  cancel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  confirmApprove: { minWidth: 96, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy },
  confirmReject: { minWidth: 96, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.danger },
  confirmText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: .5 },
});
