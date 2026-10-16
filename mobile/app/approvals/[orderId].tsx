import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { StateView } from '@/components/StateView';
import { Screen } from '@/components/Screen';
import { MotionView } from '@/components/MotionView';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { StatusChip } from '@/components/StatusChip';
import { approveReview, rejectOrder, resetEditedQuantity, setEditedQuantity, zeroReviewItem } from '@/services/approvals';
import { formatMoney, getOrder, getOrderItems, type OrderItem } from '@/services/orders';
import { getInTransitQtyByBranchParts } from '@/services/inTransit';
import { normalizePartNo } from '@/lib/orderLogic';
import { colors, spacing } from '@/theme/tokens';

export default function ApprovalReviewScreen() {
  const params = useLocalSearchParams<{ orderId: string }>();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const order = useQuery({ queryKey: ['order', orderId], queryFn: () => getOrder(orderId), enabled: Boolean(orderId) });
  const items = useQuery({ queryKey: ['order-items', orderId], queryFn: () => getOrderItems(orderId), enabled: Boolean(orderId) });
  const partNos = (items.data ?? []).map((item) => item.part_no);
  const inTransit = useQuery({
    queryKey: ['approval-review-in-transit', order.data?.branch, partNos.join('|')],
    queryFn: () => getInTransitQtyByBranchParts(order.data!.branch!, partNos),
    enabled: Boolean(order.data?.branch) && partNos.length > 0,
    staleTime: 0,
  });
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rowAction, setRowAction] = useState<{ itemId: string; action: 'reset' | 'zero' } | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!items.data) return;
    setQuantities(Object.fromEntries(items.data.map((item) => [item.id, String(item.edited_qty ?? item.qty)])));
  }, [items.data]);

  const hasEdits = useMemo(
    () => (items.data ?? []).some((item) => Number(quantities[item.id] ?? item.edited_qty ?? item.qty) !== item.qty || item.edited_qty != null),
    [items.data, quantities],
  );

  async function refreshItems() {
    await Promise.all([
      items.refetch(),
      queryClient.invalidateQueries({ queryKey: ['order-items', orderId] }),
      queryClient.invalidateQueries({ queryKey: ['mobile-approval-queue'] }),
    ]);
  }

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


  async function handleReset(item: OrderItem) {
    const previous = quantities[item.id] ?? String(item.edited_qty ?? item.qty);
    setRowErrors((current) => ({ ...current, [item.id]: '' }));
    setQuantities((current) => ({ ...current, [item.id]: String(item.qty) }));

    if (item.edited_qty == null) return;

    setRowAction({ itemId: item.id, action: 'reset' });
    try {
      await resetEditedQuantity(item.id);
      await refreshItems();
    } catch (error) {
      setQuantities((current) => ({ ...current, [item.id]: previous }));
      setRowErrors((current) => ({ ...current, [item.id]: error instanceof Error ? error.message : 'Reset failed.' }));
    } finally {
      setRowAction(null);
    }
  }

  async function handleZero(item: OrderItem) {
    const previous = quantities[item.id] ?? String(item.edited_qty ?? item.qty);
    setRowErrors((current) => ({ ...current, [item.id]: '' }));
    setQuantities((current) => ({ ...current, [item.id]: '0' }));
    setRowAction({ itemId: item.id, action: 'zero' });
    try {
      await zeroReviewItem(item.id);
      await refreshItems();
    } catch (error) {
      setQuantities((current) => ({ ...current, [item.id]: previous }));
      setRowErrors((current) => ({ ...current, [item.id]: error instanceof Error ? error.message : 'Set 0 failed.' }));
    } finally {
      setRowAction(null);
    }
  }


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

  if (!['super', 'manager', 'developer'].includes(role ?? '')) return <Screen title="Approval Review"><StateView icon="alert" tone="error" title="Approval review unavailable" message="This workflow is not available for your role." /></Screen>;
  if (order.isLoading || items.isLoading) return <Screen title="Approval Review"><SkeletonLoader rows={5} /></Screen>;
  if (!order.data || order.isError) return <Screen title="Approval Review"><StateView icon="alert" tone="error" title="Order could not be loaded" actionLabel="Go back" onAction={() => router.back()} /></Screen>;

  const busy = approve.isPending || reject.isPending;
  const currentQty = (items.data ?? []).reduce((sum, item) => sum + Number(quantities[item.id] ?? item.edited_qty ?? item.qty), 0);
  const originalQty = (items.data ?? []).reduce((sum, item) => sum + item.qty, 0);
  const transitMap = inTransit.data ?? {};

  return (
    <Screen title="Approval Review" scroll={false}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <MotionView>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}><AppIcon name="clipboardCheck" size={20} color="#fff" /></View>
            <View style={styles.heroCopy}>
              <Text style={styles.orderNo}>{order.data.final_order_no || order.data.order_no}</Text>
              <Text numberOfLines={1} style={styles.customer}>{order.data.customer_name || order.data.machine_no || 'Customer / machine unavailable'}</Text>
            </View>
            <StatusChip status={order.data.approval_status || order.data.status} />
          </View>
          <View style={styles.summaryGrid}>
            <ReviewMeta label="Branch" value={order.data.branch || '—'} dark />
            <ReviewMeta label="Machine" value={order.data.machine_no || '—'} dark />
            <ReviewMeta label="Order type" value={order.data.order_type || order.data.order_for || '—'} dark />
            <ReviewMeta label="Original qty" value={String(originalQty)} dark />
            <ReviewMeta label="Review qty" value={String(currentQty)} dark />
            <ReviewMeta label="Value" value={formatMoney(order.data.total_value)} dark />
          </View>
        </View>
        </MotionView>

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Parts & quantities</Text><Text style={styles.sectionCount}>{items.data?.length ?? 0} rows</Text></View>

        {(items.data ?? []).map((item, index) => (
          <MotionView key={item.id} delay={Math.min(index * 32, 220)}>
          <ReviewItem
            item={item}
            value={quantities[item.id] ?? String(item.edited_qty ?? item.qty)}
            busy={busy}
            rowAction={rowAction?.itemId === item.id ? rowAction.action : null}
            rowError={rowErrors[item.id] || ''}
            transitQty={transitMap[normalizePartNo(item.part_no)] ?? 0}
            transitLoading={inTransit.isLoading}
            onChange={(value) => {
              setRowErrors((current) => ({ ...current, [item.id]: '' }));
              setQuantities((current) => ({ ...current, [item.id]: value.replace(/[^0-9]/g, '') }));
            }}
            onReset={() => void handleReset(item)}
            onZero={() => void handleZero(item)}
          />
          </MotionView>
        ))}

        {message ? <View style={styles.message}><AppIcon name="alert" size={15} color={colors.danger}/><Text style={styles.messageText}>{message}</Text></View> : null}

        <MotionView delay={100}>
        <View style={styles.actions}>
          <Pressable disabled={busy} onPress={() => approve.mutate('accept_edits')} style={[styles.primary, busy && styles.disabled]}>
            {approve.isPending ? <ActivityIndicator color={colors.success} /> : <><AppIcon name="clipboardCheck" size={15} color={colors.success}/><Text style={styles.primaryText}>{hasEdits ? 'Accept Edits & Approve' : 'Approve Current Qty'}</Text></>}
          </Pressable>
          <Pressable disabled={busy} onPress={() => approve.mutate('approve_original')} style={[styles.secondary, busy && styles.disabled]}><AppIcon name="refresh" size={14} color={colors.navy}/><Text style={styles.secondaryText}>Approve Original Qty</Text></Pressable>
          <Pressable disabled={busy} onPress={() => setRejectOpen(true)} style={[styles.reject, busy && styles.disabled]}><AppIcon name="x" size={14} color={colors.danger}/><Text style={styles.rejectText}>Reject</Text></Pressable>
        </View>
        </MotionView>
      </ScrollView>

      <Modal visible={rejectOpen} transparent animationType="fade" onRequestClose={() => setRejectOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.dialog}>
          <View style={styles.dialogHeading}><AppIcon name="alert" size={18} color={colors.danger}/><Text style={styles.dialogTitle}>Reject order?</Text></View>
          <View style={styles.dialogActions}>
            <Pressable onPress={() => setRejectOpen(false)}><Text style={styles.cancel}>Cancel</Text></Pressable>
            <Pressable disabled={reject.isPending} onPress={() => reject.mutate()} style={styles.rejectConfirm}>{reject.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.rejectConfirmText}>Reject</Text>}</Pressable>
          </View>
        </View></View>
      </Modal>
    </Screen>
  );
}

function ReviewItem({ item, value, busy, rowAction, rowError, transitQty, transitLoading, onChange, onReset, onZero }: { item: OrderItem; value: string; busy: boolean; rowAction: 'reset' | 'zero' | null; rowError: string; transitQty: number; transitLoading: boolean; onChange: (value: string) => void; onReset: () => void; onZero: () => void }) {
  const [editing, setEditing] = useState(false);
  const next = Number(value || 0);
  const changedFromOriginal = next !== item.qty || item.edited_qty != null;
  const resetDisabled = busy || rowAction !== null || (next === item.qty && item.edited_qty == null);
  const zeroDisabled = busy || rowAction !== null || next === 0;

  return (
    <View style={[styles.itemCard, changedFromOriginal && styles.itemChanged]}>
      <View style={styles.itemTop}>
        <View style={styles.partIcon}><AppIcon name="package" size={17} color={changedFromOriginal ? colors.warning : colors.navy}/></View>
        <View style={styles.itemCopy}>
          <Text style={styles.partNo}>{item.part_no}</Text>
          <Text numberOfLines={2} style={styles.description}>{item.description || 'No description'}</Text>
          {changedFromOriginal ? <View style={styles.changedBadge}><Text style={styles.changedText}>EDITED</Text></View> : null}
        </View>

        <View style={styles.qtyControls}>
          {editing ? (
            <TextInput
              autoFocus
              keyboardType="number-pad"
              value={value}
              onChangeText={onChange}
              onBlur={() => setEditing(false)}
              selectTextOnFocus
              style={styles.inlineQtyInput}
            />
          ) : (
            <Text style={styles.inlineQtyValue}>{value || '0'}</Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? `Finish editing review quantity for ${item.part_no}` : `Edit review quantity for ${item.part_no}`}
            disabled={busy || rowAction !== null}
            hitSlop={8}
            onPress={() => setEditing((current) => !current)}
            style={({ pressed }) => [styles.editQtyButton, pressed && styles.pressed, (busy || rowAction !== null) && styles.disabled]}
          >
            <AppIcon name="pencil" size={13} color={colors.navy}/>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reset quantity for ${item.part_no}`}
            disabled={resetDisabled}
            onPress={onReset}
            style={({ pressed }) => [styles.compactReset, pressed && styles.pressed, resetDisabled && styles.disabled]}
          >
            {rowAction === 'reset' ? <ActivityIndicator size="small" color={colors.navy}/> : <><AppIcon name="refresh" size={11} color={colors.navy}/><Text style={styles.compactResetText}>Reset</Text></>}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Set quantity to zero for ${item.part_no}`}
            disabled={zeroDisabled}
            onPress={onZero}
            style={({ pressed }) => [styles.compactZero, pressed && styles.pressed, zeroDisabled && styles.disabled]}
          >
            {rowAction === 'zero' ? <ActivityIndicator size="small" color={colors.danger}/> : <Text style={styles.compactZeroText}>Set 0</Text>}
          </Pressable>
        </View>
      </View>

      <View style={styles.qtyStrip}>
        <ReviewMeta label="Original" value={String(item.qty)} />
        <ReviewDivider />
        <ReviewMeta label="Current" value={String(item.edited_qty ?? item.qty)} />
        <ReviewDivider />
        <ReviewMeta label="In Transit" value={transitLoading ? '…' : String(transitQty)} />
        <ReviewDivider />
        <ReviewMeta label="Line value" value={formatMoney((item.dnp ?? 0) * next)} />
      </View>

      {rowError ? <View style={styles.rowError}><AppIcon name="alert" size={13} color={colors.danger}/><Text style={styles.rowErrorText}>{rowError}</Text></View> : null}
    </View>
  );
}

function ReviewMeta({ label, value, dark = false }: { label:string; value:string; dark?:boolean }) {
  return <View style={styles.reviewMeta}><Text style={[styles.reviewMetaLabel,dark&&styles.reviewMetaLabelDark]}>{label}</Text><Text numberOfLines={1} style={[styles.reviewMetaValue,dark&&styles.reviewMetaValueDark]}>{value}</Text></View>;
}
function ReviewDivider(){ return <View style={styles.reviewDivider}/>; }

const styles = StyleSheet.create({
  center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background,padding:spacing.xl},
  content:{gap:spacing.md,paddingBottom:44},
  hero:{padding:14,borderRadius:18,backgroundColor:colors.navy,overflow:'hidden'},
  heroTop:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:8},
  heroIcon:{width:38,height:38,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.12)'},
  heroCopy:{flex:1,minWidth:0},
  orderNo:{color:'#fff',fontSize:14.5,lineHeight:18,fontWeight:'900'},
  customer:{color:'#C5D7EA',fontSize:10,lineHeight:15,marginTop:3},
  summaryGrid:{flexDirection:'row',flexWrap:'wrap',rowGap:10,marginTop:12},
  mini:{flex:1,minWidth:0},
  miniLabel:{color:colors.textMuted,fontSize:8,fontWeight:'800'},
  miniValue:{color:colors.text,fontSize:11,fontWeight:'900',marginTop:3},
  miniLabelDark:{color:'#91AAC5'},
  miniValueDark:{color:'#fff'},
  reviewMeta:{flex:1,minWidth:0,paddingHorizontal:6,paddingVertical:8,justifyContent:'center'},
  reviewMetaLabel:{color:'#748297',fontSize:7.5,fontWeight:'700'},
  reviewMetaValue:{color:'#152740',fontSize:9.5,fontWeight:'900',marginTop:3},
  reviewMetaLabelDark:{color:'#91AAC5'},
  reviewMetaValueDark:{color:'#FFFFFF'},
  reviewDivider:{width:StyleSheet.hairlineWidth,backgroundColor:'#CFDDED',marginVertical:7},
  sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  sectionTitle:{color:colors.text,fontSize:14,fontWeight:'900'},
  sectionCount:{color:colors.textMuted,fontSize:9,fontWeight:'800'},
  itemCard:{padding:12,borderRadius:14,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:colors.surface},
  itemChanged:{borderColor:'#E1E7EE',backgroundColor:'#FFFFFF'},
  itemTop:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},
  partIcon:{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#F0F4F8'},
  itemCopy:{flex:1,minWidth:0},
  partNo:{color:colors.text,fontSize:12,fontWeight:'900'},
  description:{color:colors.textMuted,fontSize:9,lineHeight:14,marginTop:3},
  changedBadge:{alignSelf:'flex-start',marginTop:5,paddingHorizontal:6,paddingVertical:3,borderRadius:999,backgroundColor:colors.warningSoft},
  changedText:{color:colors.warning,fontSize:7,fontWeight:'900'},
  qtyControls:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:5},
  inlineQtyValue:{minWidth:20,textAlign:'right',color:colors.text,fontSize:14,fontWeight:'900'},
  inlineQtyInput:{width:46,minHeight:32,paddingHorizontal:8,paddingVertical:4,borderRadius:9,borderWidth:1,borderColor:'#B7C6D8',backgroundColor:'#fff',color:colors.text,fontSize:14,fontWeight:'900',textAlign:'right'},
  editQtyButton:{width:30,height:30,alignItems:'center',justifyContent:'center',borderRadius:9,borderWidth:1,borderColor:'#D6E0EA',backgroundColor:'#fff'},
  compactReset:{minHeight:30,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:3,paddingHorizontal:7,borderRadius:9,borderWidth:1,borderColor:'#D6E0EA',backgroundColor:'#fff'},
  compactResetText:{color:colors.navy,fontSize:7.5,fontWeight:'900'},
  compactZero:{minHeight:30,alignItems:'center',justifyContent:'center',paddingHorizontal:8,borderRadius:9,borderWidth:1,borderColor:'#F1BABA',backgroundColor:'#fff'},
  compactZeroText:{color:colors.danger,fontSize:7.5,fontWeight:'900'},
  qtyStrip:{flexDirection:'row',alignItems:'stretch',marginTop:10,borderRadius:9,backgroundColor:'#EEF5FC',overflow:'hidden'},
  rowError:{flexDirection:'row',alignItems:'flex-start',gap:5,marginTop:7,paddingHorizontal:8,paddingVertical:6,borderRadius:8,backgroundColor:colors.dangerSoft},
  rowErrorText:{flex:1,color:colors.danger,fontSize:8.5,lineHeight:12,fontWeight:'700'},
  message:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm,padding:spacing.md,borderRadius:14,backgroundColor:colors.dangerSoft},
  messageText:{flex:1,color:colors.danger,fontSize:10,lineHeight:15,fontWeight:'700'},
  actions:{gap:8},
  primary:{minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderRadius:11,borderWidth:1.5,borderColor:colors.success,backgroundColor:'#FFFFFF'},
  primaryText:{color:colors.success,fontSize:10,fontWeight:'900'},
  secondary:{minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderRadius:11,borderWidth:1,borderColor:colors.navy,backgroundColor:'#fff'},
  secondaryText:{color:colors.navy,fontSize:11,fontWeight:'900'},
  reject:{minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderRadius:11,borderWidth:1,borderColor:colors.danger,backgroundColor:'#fff'},
  rejectText:{color:colors.danger,fontSize:11,fontWeight:'900'},
  pressed:{opacity:.72},
  disabled:{opacity:.4},
  modalBackdrop:{flex:1,justifyContent:'center',backgroundColor:'rgba(2,6,23,.65)'},
  dialog:{alignSelf:'center',width:'78%',maxWidth:310,padding:16,gap:14,borderRadius:16,backgroundColor:colors.surface},
  dialogHeading:{flexDirection:'row',alignItems:'center',gap:8},
  dialogTitle:{color:colors.text,fontSize:14,fontWeight:'900'},
  dialogActions:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:14},
  cancel:{color:colors.textMuted,fontSize:10,fontWeight:'800'},
  rejectConfirm:{minHeight:38,minWidth:88,alignItems:'center',justifyContent:'center',borderRadius:10,backgroundColor:colors.danger},
  rejectConfirmText:{color:'#fff',fontSize:10,fontWeight:'900'},
});
