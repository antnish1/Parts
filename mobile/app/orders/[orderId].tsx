import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { StateView } from '@/components/StateView';
import { Screen } from '@/components/Screen';
import { MotionView } from '@/components/MotionView';
import { SkeletonLoader } from '@/components/SkeletonLoader';
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
  const [quantityFilter, setQuantityFilter] = useState<'ordered' | 'billed' | 'pending' | 'received'>('ordered');

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

  if (order.isLoading) return <Screen title="Track Order"><SkeletonLoader rows={5} /></Screen>;
  if (order.isError || !order.data) return <Screen title="Track Order"><StateView icon="alert" tone="error" title="Order could not be loaded" message="The order workspace request failed." actionLabel="Go back" onAction={() => router.back()} /></Screen>;

  const row = order.data;
  const canCorrect = role === 'manager' || role === 'developer';
  const transitMap = inTransit.data ?? {};
  const totalQty = hydratedItems.reduce((sum, item) => sum + getEffectiveQty(item), 0);
  const totalBilled = hydratedItems.reduce((sum, item) => sum + getBilledQty(item), 0);
  const totalPending = hydratedItems.reduce((sum, item) => sum + getPendingQty(item), 0);
  const totalReceived = hydratedItems.reduce((sum, item) => sum + getReceivedQty(item), 0);
  const totalValue = hydratedItems.reduce((sum, item) => sum + getEffectiveValue(item), 0);
  const visibleItems = hydratedItems.filter((item) => {
    if (quantityFilter === 'billed') return getBilledQty(item) > 0;
    if (quantityFilter === 'pending') return getPendingQty(item) > 0;
    if (quantityFilter === 'received') return getReceivedQty(item) > 0;
    return getEffectiveQty(item) > 0;
  });

  function requestApprovalAction(type: 'approve' | 'reject') {
    setActionMessage('');
    setConfirmAction(type);
  }

  return (
    <Screen title="Track Order" scroll={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <MotionView>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}><AppIcon name="package" size={21} color="#fff" /></View>
            <View style={styles.heroCopy}>
              <Text style={styles.orderNo}>{row.final_order_no || row.order_no}</Text>
              <Text numberOfLines={2} style={styles.customer}>{row.customer_name || 'Customer not available'}</Text>
            </View>
            <PulseWrap><StatusChip status={row.approval_status || row.status} /></PulseWrap>
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
        </MotionView>

        {canApprove ? (
          <MotionView delay={70}>
          <View style={styles.approvalCard}>
            <Pressable accessibilityRole="button" accessibilityLabel="Review quantities" onPress={() => router.push(`/approvals/${orderId}`)} style={({pressed})=>[styles.approvalHeader,pressed&&styles.approvalHeaderPressed]}>
              <View style={styles.approvalIdentity}>
                <View style={styles.approvalIcon}><AppIcon name="clipboardCheck" size={18} color={colors.navy}/></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.approvalEyebrow}>{role === 'manager' ? 'MANAGER APPROVAL' : 'ORDER APPROVAL'}</Text>
                  <Text style={styles.approvalTitle}>{managerOverride ? 'Manager override available' : 'This order is awaiting your action'}</Text>
                </View>
              </View>
              <View style={styles.reviewIcon}><AppIcon name="eye" size={19} color={colors.navy}/></View>
            </Pressable>
            {managerOverride ? <Text style={styles.overrideText}>Audited manager override will be used for this order.</Text> : null}
            <View style={styles.approvalActions}>
              <PulseWrap flex><Pressable disabled={action.isPending} onPress={() => requestApprovalAction('approve')} style={({ pressed }) => [styles.approveButton, pressed && styles.actionPressed, action.isPending && styles.disabled]}><AppIcon name="clipboardCheck" size={17} color={colors.success}/><Text style={styles.approveButtonText}>{role === 'manager' ? 'Approve Order' : 'Approve / Send Forward'}</Text></Pressable></PulseWrap>
              <PulseWrap flex delay={420}><Pressable disabled={action.isPending} onPress={() => requestApprovalAction('reject')} style={({ pressed }) => [styles.rejectButton, pressed && styles.actionPressed, action.isPending && styles.disabled]}><AppIcon name="trash" size={17} color={colors.danger}/><Text style={styles.rejectButtonText}>Reject</Text></Pressable></PulseWrap>
            </View>
            {actionMessage ? <Text style={styles.actionMessage}>{actionMessage}</Text> : null}
          </View>
          </MotionView>
        ) : null}

        <MotionView delay={110}>
        <Pressable onPress={() => router.push(`/orders/${orderId}/activity`)} style={styles.activity}><View style={styles.shortcutIcon}><AppIcon name="activity" size={18} color={colors.navy}/></View><View style={styles.shortcutCopy}><Text style={styles.activityTitle}>Activity, comments & billing</Text><Text style={styles.activityText}>Open the complete audited order history</Text></View><AppIcon name="chevronRight" size={17} color={colors.blue}/></Pressable>
        </MotionView>

        {canCorrect ? <MotionView delay={140}><Pressable onPress={() => router.push(`/orders/${orderId}/correct`)} style={styles.correct}><View style={styles.correctIcon}><AppIcon name="shield" size={18} color={colors.warning}/></View><View style={styles.shortcutCopy}><Text style={styles.correctTitle}>Order Data Correction</Text><Text style={styles.correctText}>Manager / Developer audited correction console</Text></View><AppIcon name="chevronRight" size={17} color={colors.warning}/></Pressable></MotionView> : null}

        <Text style={styles.sectionTitle}>Order quantities</Text>
        <MotionView trigger={quantityFilter} distance={4} duration={180}>
        <View style={styles.totals}>
          <MiniMetric label="Ordered" value={String(totalQty)} active={quantityFilter==='ordered'} onPress={()=>setQuantityFilter('ordered')} />
          <MetricDivider />
          <MiniMetric label="Billed" value={String(totalBilled)} active={quantityFilter==='billed'} onPress={()=>setQuantityFilter('billed')} />
          <MetricDivider />
          <MiniMetric label="Pending" value={String(totalPending)} active={quantityFilter==='pending'} onPress={()=>setQuantityFilter('pending')} />
          <MetricDivider />
          <MiniMetric label="Received" value={String(totalReceived)} active={quantityFilter==='received'} onPress={()=>setQuantityFilter('received')} />
        </View>
        </MotionView>

        {inTransit.isError ? <View style={styles.errorBox}><Text style={styles.errorBoxText}>In-Transit quantities could not be loaded. Pull back and reopen this order, or retry later.</Text></View> : null}
        {billings.isError ? <View style={styles.errorBox}><Text style={styles.errorBoxText}>Billing/docket chunks could not be loaded.</Text></View> : null}

        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Parts ({visibleItems.length})</Text><Text style={styles.filterHint}>{quantityFilter}</Text></View>
        {visibleItems.map((item, index) => {
          const chunks = billingMap.get(item.id) ?? [];
          const transitQty = transitMap[normalizePartNo(item.part_no)] ?? 0;
          return (
            <MotionView key={item.id} delay={Math.min(index * 26, 180)} trigger={quantityFilter}>
            <View style={styles.itemCard}>
              <View style={styles.itemTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partNo}>{item.part_no}</Text>
                  <Text style={styles.description}>{item.description || 'No description'}</Text>
                </View>
                <PulseWrap><StatusChip status={getResolvedRowStatus(item)} /></PulseWrap>
              </View>

              <View style={styles.partMetrics}>
                <View style={styles.partMetricRow}>
                  <PartMetric label="Qty" value={String(getEffectiveQty(item))} />
                  <PartDivider />
                  <PartMetric label="Billed" value={String(getBilledQty(item))} />
                  <PartDivider />
                  <PartMetric label="Pending" value={String(getPendingQty(item))} />
                  <PartDivider />
                  <PartMetric label="Received" value={String(getReceivedQty(item))} />
                </View>
                <View style={styles.partMetricSeparator} />
                <View style={styles.partMetricRow}>
                  <PartMetric label="DNP" value={formatMoney(item.dnp)} />
                  <PartDivider />
                  <PartMetric label="Value" value={formatMoney(getEffectiveValue(item))} />
                  <PartDivider />
                  <PartMetric label="Reg" value={formatDate(item.order_reg_date)} />
                </View>
              </View>

              <View style={styles.transitRow}>
                <Text style={styles.transitLabel}>In Transit</Text>
                {inTransit.isLoading ? <ActivityIndicator size="small" color={colors.navy} /> : transitQty > 0 ? (
                  <Pressable onPress={() => setSelectedTransit({ partNo: item.part_no, qty: transitQty })} style={styles.transitBadge}><AppIcon name="truck" size={14} color="#7A5200"/><Text style={styles.transitBadgeText}>{transitQty} · View orders</Text></Pressable>
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
            </MotionView>
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
              <Pressable onPress={() => setSelectedTransit(null)} style={styles.closeButton}><AppIcon name="x" size={20} color={colors.textMuted}/></Pressable>
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

      <Modal visible={Boolean(confirmAction)} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setConfirmAction(null)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.dialog}>
            <View style={styles.dialogHeading}>
              <AppIcon name={confirmAction === 'approve' ? 'clipboardCheck' : 'alert'} size={20} color={confirmAction === 'approve' ? colors.success : colors.danger}/>
              <Text style={styles.dialogTitle}>{confirmAction === 'approve' ? 'Approve order?' : 'Reject order?'}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close confirmation" hitSlop={10} disabled={action.isPending} onPress={() => setConfirmAction(null)} style={({ pressed }) => [styles.dialogClose, pressed && styles.pressed]}>
                <AppIcon name="x" size={22} color={colors.textMuted}/>
              </Pressable>
            </View>
            <Text style={styles.dialogText}>{confirmAction === 'approve' ? 'Are you sure you want to approve this order? The approval workflow will continue.' : 'Are you sure you want to reject this order? This action cannot be undone.'}</Text>
            <View style={styles.dialogActions}>
              <Pressable disabled={action.isPending} onPress={() => setConfirmAction(null)} style={({ pressed }) => [styles.dialogCancelButton, pressed && styles.dialogButtonPressed, action.isPending && styles.disabled]}>
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </Pressable>
              <Pressable disabled={action.isPending} onPress={() => confirmAction && action.mutate(confirmAction)} style={({ pressed }) => [styles.dialogConfirmButton, confirmAction === 'reject' ? styles.confirmReject : styles.confirmApprove, pressed && styles.dialogButtonPressed, action.isPending && styles.disabled]}>
                {action.isPending ? <ActivityIndicator color="#fff" /> : <><AppIcon name={confirmAction === 'approve' ? 'clipboardCheck' : 'trash'} size={18} color="#fff"/><Text style={styles.confirmText}>{confirmAction === 'approve' ? 'Approve' : 'Reject'}</Text></>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Meta({ label, value }: { label: string; value: string }) { return <View style={styles.meta}><Text style={styles.metaLabel}>{label}</Text><Text numberOfLines={1} style={styles.metaValue}>{value}</Text></View>; }
function Mini({ label, value }: { label: string; value: string }) { return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue}>{value}</Text></View>; }
function PartMetric({ label, value }: { label: string; value: string }) { return <View style={styles.partMetric}><Text style={styles.partMetricLabel}>{label}</Text><Text numberOfLines={1} style={styles.partMetricValue}>{value}</Text></View>; }
function PartDivider(){ return <View style={styles.partDivider}/>; }
function MetricDivider(){ return <View style={styles.metricDivider}/>; }
function PulseWrap({children,flex=false,delay=0}:{children:React.ReactNode;flex?:boolean;delay?:number}) {
  const scale=useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    const loop=Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(scale,{toValue:.985,duration:720,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      Animated.timing(scale,{toValue:1.015,duration:720,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      Animated.timing(scale,{toValue:1,duration:520,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
    ]));
    loop.start();
    return ()=>loop.stop();
  },[delay,scale]);
  return <Animated.View style={[flex&&styles.pulseFlex,{transform:[{scale}]}]}>{children}</Animated.View>;
}
function MiniMetric({ label, value, active, onPress }: { label: string; value: string; active: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.metric, active && styles.metricActive]}><Text style={[styles.metricLabel, active && styles.metricLabelActive]}>{label}</Text><Text style={[styles.metricValue, active && styles.metricValueActive]}>{value}</Text></Pressable>; }
function DetailRow({ label, value, last = false }: { label: string; value: string | null | undefined; last?: boolean }) { return <View style={[styles.detailRow, last && styles.detailRowLast]}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || '—'}</Text></View>; }

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background },
  content: { paddingBottom: 44, gap: spacing.md },
  back: { alignSelf: 'flex-start', width: 28, minHeight: 30, alignItems:'center', justifyContent: 'center' },
  backText: { color: colors.blue, fontSize: 22, fontWeight: '800', lineHeight: 24 },
  hero: { padding: 14, borderRadius: 18, backgroundColor: colors.navy, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems:'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  heroIcon:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.12)'},
  heroCopy: { flex: 1 },
  orderNo: { color: '#fff', fontSize: 14.5, lineHeight: 18, fontWeight: '900' },
  customer: { color: '#C5D7EA', fontSize: 11, lineHeight: 16, marginTop: 3 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, marginTop: 12 },
  meta: { width: '33.33%', paddingRight: 6 },
  metaLabel: { color: '#91AAC5', fontSize: 8, fontWeight: '700' },
  metaValue: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 2 },
  approvalCard: { gap: 10, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#D8E0E8', backgroundColor: '#FFFFFF' },
  approvalHeader: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'space-between' },
  approvalIdentity: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' },
  approvalIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  approvalEyebrow: { color: colors.blue, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  approvalTitle: { color: colors.text, fontSize: 12, fontWeight: '900', marginTop: 2 },
  reviewIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  approvalHeaderPressed:{opacity:.78},
  approvalActions: { flexDirection: 'row', gap: spacing.sm },
  pulseFlex:{flex:1},
  approveButton: { flex: 1, minHeight: 48, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.success, backgroundColor: '#FFFFFF' },
  approveButtonText: { color: colors.success, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  rejectButton: { flex: 1, minHeight: 48, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger, backgroundColor: '#fff' },
  rejectButtonText: { color: colors.danger, fontSize: 11, fontWeight: '900' },
  actionPressed: { opacity: .72, transform: [{ scale: .99 }] },
  overrideText: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  actionMessage: { color: colors.navy, fontSize: 11, fontWeight: '700' },
  activity: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap:spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  activityTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  activityText: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  shortcutIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.blueSoft},shortcutCopy:{flex:1},
  correct: { minHeight:70,flexDirection:'row',alignItems:'center',gap:spacing.md,padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: '#E3D4B3', backgroundColor: '#FFFFFF' },
  correctIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},
  correctTitle: { color: colors.warning, fontSize: 12, fontWeight: '900' },
  correctText: { color: colors.text, fontSize: 10, marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: spacing.xs },
  totals: { minHeight:62,flexDirection:'row',alignItems:'stretch',borderRadius:radius.md,borderWidth:1,borderColor:'#BCD7EF',backgroundColor:'#EAF3FD',overflow:'hidden' },
  metric: { flex: 1, minWidth: 0, paddingHorizontal:10,paddingVertical:10,justifyContent:'center' },
  metricDivider:{width:StyleSheet.hairlineWidth,backgroundColor:'#CFDDED',marginVertical:9},
  metricActive: { backgroundColor: '#3276BB' },
  metricLabel: { color: colors.textMuted, fontSize: 8, fontWeight: '800' },
  metricLabelActive: { color: '#FFFFFF' },
  metricValue: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 3 },
  metricValueActive: { color: '#FFFFFF' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterHint: { color: colors.textMuted, fontSize: 9, fontWeight: '800', textTransform: 'capitalize' },
  itemCard: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  partNo: { color: colors.text, fontSize: 14, fontWeight: '900' },
  description: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  qtyGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  mini: { flex: 1, minWidth: 0 },
  miniLabel: { color: colors.textMuted, fontSize: 8, fontWeight: '700' },
  miniValue: { color: colors.text, fontSize: 12, fontWeight: '900', marginTop: 2 },
  partMetrics:{marginTop:spacing.md,borderRadius:10,backgroundColor:'#EEF5FC',overflow:'hidden'},
  partMetricRow:{flexDirection:'row',alignItems:'stretch',minHeight:48},
  partMetric:{flex:1,minWidth:0,paddingHorizontal:8,paddingVertical:8,justifyContent:'center'},
  partMetricLabel:{color:'#748297',fontSize:8,fontWeight:'700'},
  partMetricValue:{color:'#152740',fontSize:10,fontWeight:'900',marginTop:3},
  partDivider:{width:StyleSheet.hairlineWidth,backgroundColor:'#CFDDED',marginVertical:7},
  partMetricSeparator:{height:StyleSheet.hairlineWidth,backgroundColor:'#CFDDED'},
  transitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  transitLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  transitBadge: { flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: '#E7B94D' },
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

  sheetBody: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 36 },
  transitDetail: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  transitOrder: { color: colors.blue, fontSize: 12, fontWeight: '900' },
  transitMeta: { color: colors.textMuted, fontSize: 9, marginTop: 2 },
  transitQty: { color: colors.text, fontSize: 11, fontWeight: '900' },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl },
  confirmBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 28, backgroundColor: 'rgba(2,6,23,0.64)' },
  dialog: { width: '100%', maxWidth: 390, padding: 22, gap: 14, borderRadius: 24, backgroundColor: colors.surface, shadowColor: '#020617', shadowOpacity: .22, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 18 },
  dialogTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  dialogTopSpacer: { width: 1, height: 1 },
  dialogClose: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dialogHeading:{flexDirection:'row',alignItems:'center',gap:9,justifyContent:'space-between'},
  dialogTitle: { flex: 1, color: colors.text, fontSize: 21, lineHeight: 26, fontWeight: '900' },
  dialogText: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: -2 },
  dialogActions: { flexDirection: 'row', alignItems: 'stretch', gap: 12, marginTop: 8 },
  dialogCancelButton: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff' },
  dialogCancelText: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
  dialogConfirmButton: { flex: 1, minHeight: 50, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  dialogButtonPressed: { opacity: .78, transform: [{ scale: .985 }] },
  confirmApprove: { backgroundColor: colors.success },
  confirmReject: { backgroundColor: colors.danger },
  confirmText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  loadingText:{color:colors.textMuted,fontSize:10,fontWeight:'700'},
  pressed: { opacity: .72 },
  disabled: { opacity: .5 },
});
