import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { StatusChip } from '@/components/StatusChip';
import { addCreditComment, formatCreditMoney, getCreditDispatchDetail, reviewCreditDispatch } from '@/services/creditDispatch';
import { colors, radius, spacing } from '@/theme/tokens';

type ReviewAction = 'Approved' | 'Rejected' | 'Correction Required';

export default function CreditDispatchDetailScreen() {
  const params = useLocalSearchParams<{ dispatchId: string }>();
  const dispatchId = Array.isArray(params.dispatchId) ? params.dispatchId[0] : params.dispatchId;
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['credit-dispatch-detail', dispatchId], queryFn: () => getCreditDispatchDetail(dispatchId), enabled: Boolean(dispatchId) });
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');

  const review = useMutation({
    mutationFn: async () => {
      if (!reviewAction) return;
      await reviewCreditDispatch(dispatchId, reviewAction, reviewNote);
    },
    onSuccess: async () => {
      setReviewAction(null); setReviewNote(''); setMessage('Review saved.');
      await detail.refetch();
      await queryClient.invalidateQueries({ queryKey: ['credit-dispatches'] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Review failed.'),
  });
  const addComment = useMutation({
    mutationFn: () => addCreditComment(dispatchId, comment),
    onSuccess: async () => { setComment(''); setMessage('Comment added.'); await detail.refetch(); },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not add comment.'),
  });

  if (detail.isLoading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={colors.navy} /></SafeAreaView>;
  if (detail.isError || !detail.data) return <SafeAreaView style={styles.center}><Text style={styles.error}>Unable to load Credit Dispatch.</Text><Pressable onPress={() => router.back()}><Text style={styles.link}>Go back</Text></Pressable></SafeAreaView>;
  const row = detail.data.dispatch;
  const canAccountsReview = (role === 'accounts' || role === 'developer') && row.approval_status === 'Pending Accounts Approval';
  const canManagerReview = (role === 'manager' || role === 'developer') && row.approval_status === 'Pending Manager Approval';
  const canReview = canAccountsReview || canManagerReview;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹ Back</Text></Pressable>
        <View style={styles.hero}><View style={styles.heroTop}><View style={styles.copy}><Text style={styles.eyebrow}>CREDIT DISPATCH</Text><Text style={styles.number}>{row.dispatch_no || 'Credit Request'}</Text><Text style={styles.customer}>{row.customer_name} · {row.branch}</Text></View><StatusChip status={row.approval_status} /></View><View style={styles.moneyRow}><Metric label="Credit" value={formatCreditMoney(row.credit_amount)} /><Metric label="Received" value={formatCreditMoney(row.total_received_amount)} /><Metric label="Balance" value={formatCreditMoney(row.balance_amount)} /></View></View>

        <Text style={styles.sectionTitle}>Approval journey</Text>
        <View style={styles.progress}><Stage label="Branch" done /><Stage label="Accounts" done={!['Pending Accounts Approval'].includes(row.approval_status)} active={row.approval_status === 'Pending Accounts Approval'} /><Stage label="Manager" done={row.approval_status === 'Approved'} active={row.approval_status === 'Pending Manager Approval'} /><Stage label="Payment" active={row.approval_status === 'Approved' && row.recovery_status !== 'Closed'} done={row.recovery_status === 'Closed'} /></View>

        {(row.correction_note || row.rejection_reason) ? <View style={styles.attention}><Text style={styles.attentionTitle}>{row.correction_note ? 'Correction requested' : 'Rejected'}</Text><Text style={styles.attentionText}>{row.correction_note || row.rejection_reason}</Text></View> : null}

        <Text style={styles.sectionTitle}>Request details</Text>
        <View style={styles.card}><Row label="Customer type" value={row.customer_type} /><Row label="Mobile" value={row.mobile_no} /><Row label="Document" value={`${row.document_type} · ${row.document_no || '—'}`} /><Row label="Document date" value={row.document_date} /><Row label="Closure" value={`${row.tentative_closure_days} days`} /><Row label="Due date" value={row.due_date} /><Row label="Recovery" value={row.recovery_status} /><Row label="Sales employee" value={row.sales_employee_name || '—'} /><Row label="Remarks" value={row.remarks || '—'} last /></View>

        {canReview ? <View style={styles.reviewCard}><Text style={styles.reviewTitle}>{canAccountsReview ? 'Accounts review' : 'Manager review'}</Text><Text style={styles.reviewText}>{canAccountsReview ? 'Approval forwards this request to Manager. Rejection is final; correction sends it back to Branch and resubmission restarts at Accounts.' : 'Approval opens Payment Recovery. Rejection is final; correction returns it to Branch and later restarts at Accounts.'}</Text><View style={styles.reviewActions}><Pressable disabled={review.isPending} onPress={() => { setReviewAction('Approved'); setReviewNote(''); }} style={styles.approve}><Text style={styles.approveText}>Approve</Text></Pressable><Pressable disabled={review.isPending} onPress={() => { setReviewAction('Correction Required'); setReviewNote(''); }} style={styles.correct}><Text style={styles.correctText}>Correction</Text></Pressable><Pressable disabled={review.isPending} onPress={() => { setReviewAction('Rejected'); setReviewNote(''); }} style={styles.reject}><Text style={styles.rejectText}>Reject</Text></Pressable></View></View> : null}

        <Text style={styles.sectionTitle}>Payments</Text>
        {detail.data.payments.length ? detail.data.payments.map((payment) => <View key={payment.id} style={styles.payment}><View><Text style={styles.paymentAmount}>{formatCreditMoney(payment.received_amount)}</Text><Text style={styles.muted}>{payment.payment_mode} · {payment.received_date}</Text></View><Text style={styles.muted}>{payment.reference_no || '—'}</Text></View>) : <View style={styles.emptyCard}><Text style={styles.muted}>No payment entries yet.</Text></View>}

        <Text style={styles.sectionTitle}>Activity & comments</Text>
        <View style={styles.commentBox}><TextInput multiline value={comment} onChangeText={setComment} placeholder="Add comment…" placeholderTextColor={colors.textMuted} style={styles.commentInput} /><Pressable disabled={addComment.isPending || !comment.trim()} onPress={() => addComment.mutate()} style={[styles.commentButton, (!comment.trim() || addComment.isPending) && styles.disabled]}>{addComment.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.commentButtonText}>Add</Text>}</Pressable></View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {detail.data.events.map((event) => <View key={event.id} style={styles.event}><View style={styles.eventDot} /><View style={styles.eventCopy}><Text style={styles.eventType}>{event.event_type}</Text>{event.event_note ? <Text style={styles.eventNote}>{event.event_note}</Text> : null}<Text style={styles.eventMeta}>{event.actor_name || 'System'} · {new Date(event.created_at).toLocaleString('en-IN')}</Text></View></View>)}
      </ScrollView>

      <Modal visible={Boolean(reviewAction)} transparent animationType="fade" onRequestClose={() => setReviewAction(null)}>
        <View style={styles.modalBackdrop}><View style={styles.dialog}><Text style={styles.dialogTitle}>{reviewAction === 'Approved' ? 'Approve request?' : reviewAction === 'Rejected' ? 'Reject request?' : 'Request correction?'}</Text>{reviewAction === 'Approved' ? <Text style={styles.dialogText}>The request will move to the next server-controlled stage.</Text> : <TextInput multiline autoFocus value={reviewNote} onChangeText={setReviewNote} placeholder="Reason / note required" placeholderTextColor={colors.textMuted} style={styles.noteInput} />}<View style={styles.dialogActions}><Pressable onPress={() => setReviewAction(null)}><Text style={styles.cancel}>Cancel</Text></Pressable><Pressable disabled={review.isPending || (reviewAction !== 'Approved' && !reviewNote.trim())} onPress={() => review.mutate()} style={[styles.confirm, (review.isPending || (reviewAction !== 'Approved' && !reviewNote.trim())) && styles.disabled]}>{review.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Confirm</Text>}</Pressable></View></View></View>
      </Modal>
    </SafeAreaView>
  );
}
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text numberOfLines={1} style={styles.metricValue}>{value}</Text></View>; }
function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) { return <View style={[styles.row, last && styles.rowLast]}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>; }
function Stage({ label, done = false, active = false }: { label: string; done?: boolean; active?: boolean }) { return <View style={styles.stage}><View style={[styles.stageDot, done && styles.stageDone, active && styles.stageActive]} /><Text style={[styles.stageText, (done || active) && styles.stageTextStrong]}>{label}</Text></View>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 44 }, back: { minHeight: 38, justifyContent: 'center', alignSelf: 'flex-start' }, backText: { color: colors.blue, fontWeight: '800' }, hero: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.navy }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }, copy: { flex: 1 }, eyebrow: { color: '#B7D8FF', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, number: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 3 }, customer: { color: '#D6E7FF', fontSize: 12, marginTop: 3 }, moneyRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }, metric: { flex: 1 }, metricLabel: { color: '#AFC7E2', fontSize: 9, fontWeight: '700' }, metricValue: { color: '#fff', fontSize: 13, fontWeight: '900', marginTop: 2 }, sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '900' }, progress: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface }, stage: { alignItems: 'center', flex: 1 }, stageDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border }, stageDone: { backgroundColor: colors.success }, stageActive: { backgroundColor: colors.warning }, stageText: { color: colors.textMuted, fontSize: 9, fontWeight: '700', marginTop: 5, textAlign: 'center' }, stageTextStrong: { color: colors.text, fontWeight: '900' }, attention: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.warningSoft }, attentionTitle: { color: colors.warning, fontSize: 12, fontWeight: '900' }, attentionText: { color: colors.text, fontSize: 12, lineHeight: 18, marginTop: 4 }, card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, rowLast: { borderBottomWidth: 0 }, rowLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' }, rowValue: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 11, fontWeight: '800' }, reviewCard: { padding: spacing.lg, gap: spacing.md, borderRadius: radius.lg, backgroundColor: colors.blueSoft }, reviewTitle: { color: colors.navy, fontSize: 14, fontWeight: '900' }, reviewText: { color: colors.navySoft, fontSize: 11, lineHeight: 17 }, reviewActions: { flexDirection: 'row', gap: spacing.sm }, approve: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.success }, approveText: { color: '#fff', fontSize: 11, fontWeight: '900' }, correct: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning }, correctText: { color: colors.warning, fontSize: 11, fontWeight: '900' }, reject: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger }, rejectText: { color: colors.danger, fontSize: 11, fontWeight: '900' }, payment: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, paymentAmount: { color: colors.text, fontSize: 13, fontWeight: '900' }, muted: { color: colors.textMuted, fontSize: 10, marginTop: 2 }, emptyCard: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface }, commentBox: { flexDirection: 'row', gap: spacing.sm }, commentInput: { flex: 1, minHeight: 56, maxHeight: 110, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', color: colors.text, textAlignVertical: 'top' }, commentButton: { width: 62, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy }, commentButtonText: { color: '#fff', fontSize: 11, fontWeight: '900' }, message: { color: colors.navy, fontSize: 11, fontWeight: '700' }, event: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm }, eventDot: { width: 8, height: 8, marginTop: 5, borderRadius: 4, backgroundColor: colors.blue }, eventCopy: { flex: 1 }, eventType: { color: colors.text, fontSize: 12, fontWeight: '900' }, eventNote: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 }, eventMeta: { color: colors.textMuted, fontSize: 9, marginTop: 4 }, modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(2,6,23,0.65)' }, dialog: { margin: spacing.xl, padding: spacing.xl, gap: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface }, dialogTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, dialogText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 }, noteInput: { minHeight: 100, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text, textAlignVertical: 'top' }, dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.lg }, cancel: { color: colors.textMuted, fontWeight: '800' }, confirm: { minHeight: 44, minWidth: 90, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy }, confirmText: { color: '#fff', fontWeight: '900' }, disabled: { opacity: 0.45 }, error: { color: colors.danger }, link: { color: colors.blue, fontWeight: '800' } });
