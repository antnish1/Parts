import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { approveReview, rejectOrder, resetEditedQuantity, setEditedQuantity, zeroReviewItem } from '@/services/approvals';
import { formatMoney, getOrder, getOrderItems, type OrderItem } from '@/services/orders';
import { colors, spacing } from '@/theme/tokens';

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

  const itemAction = useMutation({
    mutationFn: async ({ item, action }: { item: OrderItem; action: 'reset' | 'zero' }) => {
      if (action === 'reset') await resetEditedQuantity(item.id);
      else await zeroReviewItem(item.id);
      return { item, action };
    },
    onSuccess: async ({ item, action }) => {
      setMessage(action === 'reset' ? `${item.part_no}: edited quantity reset to original.` : `${item.part_no}: review quantity set to zero.`);
      await refreshItems();
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Quantity action failed.'),
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

  if (!['super', 'manager', 'developer'].includes(role ?? '')) return <SafeAreaView style={styles.center}><StateView icon="alert" tone="error" title="Approval review unavailable" message="This workflow is not available for your role." /></SafeAreaView>;
  if (order.isLoading || items.isLoading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={colors.navy} /></SafeAreaView>;
  if (!order.data || order.isError) return <SafeAreaView style={styles.center}><StateView icon="alert" tone="error" title="Order could not be loaded" actionLabel="Go back" onAction={() => router.back()} /></SafeAreaView>;

  const busy = approve.isPending || reject.isPending || itemAction.isPending;
  const currentQty = (items.data ?? []).reduce((sum, item) => sum + Number(quantities[item.id] ?? item.edited_qty ?? item.qty), 0);
  const originalQty = (items.data ?? []).reduce((sum, item) => sum + item.qty, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹ Approval Queue</Text></Pressable>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}><AppIcon name="shield" size={21} color="#fff" /></View>
            <StatusChip status={order.data.approval_status || order.data.status} />
          </View>
          <Text style={styles.eyebrow}>{role === 'manager' ? 'MANAGER DECISION' : 'APPROVAL REVIEW'}</Text>
          <Text style={styles.orderNo}>{order.data.final_order_no || order.data.order_no}</Text>
          <Text numberOfLines={2} style={styles.customer}>{order.data.customer_name || order.data.machine_no || 'Customer / machine unavailable'} · {order.data.branch}</Text>
          <View style={styles.summary}>
            <Mini label="Original Qty" value={String(originalQty)} dark />
            <Mini label="Review Qty" value={String(currentQty)} dark />
            <Mini label="Value" value={formatMoney(order.data.total_value)} dark />
          </View>
        </View>

        <View style={styles.reviewIntro}>
          <View style={styles.reviewIntroIcon}><AppIcon name="check" size={18} color={colors.navy}/></View>
          <View style={styles.reviewIntroCopy}>
            <Text style={styles.reviewIntroTitle}>Review every changed quantity</Text>
            <Text style={styles.reviewIntroText}>Use Reset to restore the original row, or Set 0 when the protected review workflow should remove that quantity.</Text>
          </View>
        </View>

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Parts & quantities</Text><Text style={styles.sectionCount}>{items.data?.length ?? 0} rows</Text></View>

        {(items.data ?? []).map((item) => (
          <ReviewItem
            key={item.id}
            item={item}
            value={quantities[item.id] ?? String(item.edited_qty ?? item.qty)}
            busy={busy}
            onChange={(value) => setQuantities((current) => ({ ...current, [item.id]: value.replace(/[^0-9]/g, '') }))}
            onReset={() => itemAction.mutate({ item, action: 'reset' })}
            onZero={() => itemAction.mutate({ item, action: 'zero' })}
          />
        ))}

        {message ? <View style={styles.message}><AppIcon name="alert" size={15} color={colors.danger}/><Text style={styles.messageText}>{message}</Text></View> : null}

        <View style={styles.note}>
          <View style={styles.noteIcon}><AppIcon name="shield" size={18} color={colors.navy}/></View>
          <View style={styles.noteCopy}>
            <Text style={styles.noteTitle}>{role === 'manager' ? 'Manager review' : 'Approver review'}</Text>
            <Text style={styles.noteText}>{role === 'manager' ? 'Accept Edits approves the reviewed quantities. Approve Original Qty discards quantity edits and approves the original order quantities.' : 'Approval at this stage forwards the order through the existing protected approval workflow.'}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable disabled={busy} onPress={() => approve.mutate('accept_edits')} style={[styles.primary, busy && styles.disabled]}>
            {approve.isPending ? <ActivityIndicator color="#fff" /> : <><AppIcon name="check" size={17} color="#fff"/><Text style={styles.primaryText}>{hasEdits ? 'Accept Edits & Approve' : 'Approve Current Qty'}</Text></>}
          </Pressable>
          <Pressable disabled={busy} onPress={() => approve.mutate('approve_original')} style={[styles.secondary, busy && styles.disabled]}><Text style={styles.secondaryText}>Approve Original Qty</Text></Pressable>
          <Pressable disabled={busy} onPress={() => setRejectOpen(true)} style={[styles.reject, busy && styles.disabled]}><AppIcon name="x" size={16} color={colors.danger}/><Text style={styles.rejectText}>Reject Order</Text></Pressable>
        </View>
      </ScrollView>

      <Modal visible={rejectOpen} transparent animationType="fade" onRequestClose={() => setRejectOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.dialog}>
          <View style={styles.dialogIcon}><AppIcon name="alert" size={22} color={colors.danger}/></View>
          <Text style={styles.dialogTitle}>Reject this order?</Text>
          <Text style={styles.dialogText}>This executes the protected server-side rejection workflow for {order.data.order_no}. The decision is audited.</Text>
          <View style={styles.dialogActions}>
            <Pressable onPress={() => setRejectOpen(false)}><Text style={styles.cancel}>Cancel</Text></Pressable>
            <Pressable disabled={reject.isPending} onPress={() => reject.mutate()} style={styles.rejectConfirm}>{reject.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.rejectConfirmText}>Reject</Text>}</Pressable>
          </View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

function ReviewItem({ item, value, busy, onChange, onReset, onZero }: { item: OrderItem; value: string; busy: boolean; onChange: (value: string) => void; onReset: () => void; onZero: () => void }) {
  const next = Number(value || 0);
  const changedFromOriginal = next !== item.qty || item.edited_qty != null;
  return (
    <View style={[styles.itemCard, changedFromOriginal && styles.itemChanged]}>
      <View style={styles.itemTop}>
        <View style={styles.partIcon}><AppIcon name="package" size={17} color={changedFromOriginal ? colors.warning : colors.navy}/></View>
        <View style={styles.itemCopy}><Text style={styles.partNo}>{item.part_no}</Text><Text numberOfLines={2} style={styles.description}>{item.description || 'No description'}</Text></View>
        {changedFromOriginal ? <View style={styles.changedBadge}><Text style={styles.changedText}>EDITED</Text></View> : null}
      </View>

      <View style={styles.qtyStrip}>
        <Mini label="Original" value={String(item.qty)} />
        <Mini label="Current" value={String(item.edited_qty ?? item.qty)} />
        <Mini label="Line value" value={formatMoney((item.dnp ?? 0) * next)} />
      </View>

      <View style={styles.qtyRow}>
        <View style={styles.qtyInputWrap}><Text style={styles.qtyLabel}>Review Qty</Text><TextInput keyboardType="number-pad" value={value} onChangeText={onChange} style={styles.qtyInput} /></View>
        <View style={styles.rowActions}>
          <Pressable disabled={busy || item.edited_qty == null} onPress={onReset} style={[styles.rowButton, (busy || item.edited_qty == null) && styles.disabled]}><AppIcon name="refresh" size={14} color={colors.navy}/><Text style={styles.rowButtonText}>Reset</Text></Pressable>
          <Pressable disabled={busy || next === 0} onPress={onZero} style={[styles.zeroButton, (busy || next === 0) && styles.disabled]}><Text style={styles.zeroText}>Set 0</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

function Mini({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return <View style={styles.mini}><Text style={[styles.miniLabel,dark&&styles.miniLabelDark]}>{label}</Text><Text numberOfLines={1} style={[styles.miniValue,dark&&styles.miniValueDark]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},
  center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background,padding:spacing.xl},
  content:{padding:spacing.lg,gap:spacing.md,paddingBottom:44},
  back:{minHeight:38,justifyContent:'center',alignSelf:'flex-start'},
  backText:{color:colors.blue,fontSize:11,fontWeight:'900'},
  hero:{padding:spacing.lg,borderRadius:24,backgroundColor:colors.navy,overflow:'hidden'},
  heroTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  heroIcon:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.12)'},
  eyebrow:{color:'#9EB9D7',fontSize:9,fontWeight:'900',letterSpacing:1.2,marginTop:18},
  orderNo:{color:'#fff',fontSize:22,fontWeight:'900',marginTop:4},
  customer:{color:'#C5D7EA',fontSize:10,lineHeight:16,marginTop:4},
  summary:{flexDirection:'row',gap:spacing.sm,marginTop:spacing.lg,paddingTop:spacing.md,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'rgba(255,255,255,.18)'},
  mini:{flex:1,minWidth:0},
  miniLabel:{color:colors.textMuted,fontSize:8,fontWeight:'800'},
  miniValue:{color:colors.text,fontSize:11,fontWeight:'900',marginTop:3},
  miniLabelDark:{color:'#91AAC5'},
  miniValueDark:{color:'#fff'},
  reviewIntro:{flexDirection:'row',alignItems:'flex-start',gap:spacing.md,padding:spacing.md,borderRadius:18,backgroundColor:colors.blueSoft},
  reviewIntroIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},
  reviewIntroCopy:{flex:1},
  reviewIntroTitle:{color:colors.navy,fontSize:11,fontWeight:'900'},
  reviewIntroText:{color:colors.navySoft,fontSize:9,lineHeight:14,marginTop:3},
  sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  sectionTitle:{color:colors.text,fontSize:14,fontWeight:'900'},
  sectionCount:{color:colors.textMuted,fontSize:9,fontWeight:'800'},
  itemCard:{padding:spacing.md,borderRadius:20,borderWidth:1,borderColor:'#E1E7EE',backgroundColor:colors.surface},
  itemChanged:{borderColor:'#F0CF97',backgroundColor:'#FFFCF6'},
  itemTop:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},
  partIcon:{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#F0F4F8'},
  itemCopy:{flex:1},
  partNo:{color:colors.text,fontSize:12,fontWeight:'900'},
  description:{color:colors.textMuted,fontSize:9,lineHeight:14,marginTop:3},
  changedBadge:{paddingHorizontal:7,paddingVertical:5,borderRadius:999,backgroundColor:colors.warningSoft},
  changedText:{color:colors.warning,fontSize:8,fontWeight:'900'},
  qtyStrip:{flexDirection:'row',gap:spacing.sm,marginTop:spacing.md,padding:spacing.sm,borderRadius:14,backgroundColor:'#F6F8FB'},
  qtyRow:{flexDirection:'row',alignItems:'flex-end',gap:spacing.sm,marginTop:spacing.md},
  qtyInputWrap:{width:104},
  qtyLabel:{color:colors.textMuted,fontSize:8,fontWeight:'800'},
  qtyInput:{minHeight:44,marginTop:4,paddingHorizontal:spacing.md,borderRadius:12,borderWidth:1,borderColor:'#D8E0E8',backgroundColor:'#fff',color:colors.text,fontSize:15,fontWeight:'900'},
  rowActions:{flex:1,flexDirection:'row',justifyContent:'flex-end',gap:spacing.sm},
  rowButton:{minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:11,borderRadius:12,borderWidth:1,borderColor:'#D6E0EA',backgroundColor:'#fff'},
  rowButtonText:{color:colors.navy,fontSize:9,fontWeight:'900'},
  zeroButton:{minHeight:42,alignItems:'center',justifyContent:'center',paddingHorizontal:13,borderRadius:12,borderWidth:1,borderColor:'#F1BABA',backgroundColor:'#fff'},
  zeroText:{color:colors.danger,fontSize:9,fontWeight:'900'},
  note:{flexDirection:'row',alignItems:'flex-start',gap:spacing.md,padding:spacing.md,borderRadius:18,backgroundColor:colors.blueSoft},
  noteIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},
  noteCopy:{flex:1},
  noteTitle:{color:colors.navy,fontSize:11,fontWeight:'900'},
  noteText:{color:colors.navySoft,fontSize:9,lineHeight:15,marginTop:3},
  message:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm,padding:spacing.md,borderRadius:14,backgroundColor:colors.dangerSoft},
  messageText:{flex:1,color:colors.danger,fontSize:10,lineHeight:15,fontWeight:'700'},
  actions:{gap:spacing.sm},
  primary:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderRadius:14,backgroundColor:colors.navy},
  primaryText:{color:'#fff',fontSize:12,fontWeight:'900'},
  secondary:{minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:14,borderWidth:1,borderColor:colors.navy,backgroundColor:'#fff'},
  secondaryText:{color:colors.navy,fontSize:11,fontWeight:'900'},
  reject:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderRadius:14,borderWidth:1,borderColor:'#F0B8B8',backgroundColor:'#fff'},
  rejectText:{color:colors.danger,fontSize:11,fontWeight:'900'},
  disabled:{opacity:.4},
  modalBackdrop:{flex:1,justifyContent:'center',backgroundColor:'rgba(2,6,23,.65)'},
  dialog:{margin:spacing.xl,padding:spacing.xl,gap:spacing.md,borderRadius:22,backgroundColor:colors.surface},
  dialogIcon:{width:46,height:46,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:colors.dangerSoft},
  dialogTitle:{color:colors.text,fontSize:17,fontWeight:'900'},
  dialogText:{color:colors.textMuted,fontSize:10,lineHeight:16},
  dialogActions:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:spacing.lg},
  cancel:{color:colors.textMuted,fontSize:10,fontWeight:'800'},
  rejectConfirm:{minHeight:42,minWidth:88,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:colors.danger},
  rejectConfirmText:{color:'#fff',fontSize:10,fontWeight:'900'},
});
