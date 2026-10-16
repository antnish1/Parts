import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { MotionView } from '@/components/MotionView';
import { StateView } from '@/components/StateView';
import { StatusChip } from '@/components/StatusChip';
import { getImmutableActivityFeed } from '@/services/orderActivity';
import { colors } from '@/theme/tokens';

function accentFor(status: string | null | undefined) {
  const value = (status ?? '').toLowerCase();
  if (value.includes('reject') || value.includes('delayed') || value.includes('not despatch')) return '#BE4248';
  if (value.includes('pending') || value.includes('partial') || value.includes('correction')) return '#B77621';
  if (value.includes('approved') || value.includes('received') || value.includes('issued') || value.includes('closed')) return '#208565';
  return '#2A68B7';
}

function eventLabel(eventType: string) {
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function eventMessage(eventType: string, notes: string | null, oldStatus: string | null, newStatus: string | null) {
  if (notes?.trim()) return notes.trim();
  if (oldStatus && newStatus) return `${oldStatus} → ${newStatus}`;
  if (newStatus) return newStatus;
  return eventLabel(eventType);
}

export default function ActivityScreen() {
  const activity = useQuery({
    queryKey: ['immutable-activity-feed'],
    queryFn: () => getImmutableActivityFeed(120),
    staleTime: 15_000,
  });
  const visible = (activity.data ?? []).slice(0, 40);

  return (
    <Screen brandHeader title="Activity" subtitle="Permanent operational history.">
      {activity.isError ? <StateView icon="alert" tone="error" title="Activity could not be loaded" actionLabel="Retry" onAction={() => void activity.refetch()} /> : null}
      {activity.isLoading ? <StateView icon="activity" title="Loading activity" message="Fetching permanent audit events…" /> : null}

      {visible.length > 0 ? (
        <View style={styles.register}>
          {visible.map((event, index) => {
            const status = event.new_status || event.old_status || event.event_type;
            const stamp = new Date(event.created_at);
            return (
              <MotionView key={event.id} delay={Math.min(index * 24, 180)}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open order ${event.order_no}`}
                  onPress={() => router.push(`/orders/${event.order_id}`)}
                  style={({ pressed }) => [styles.row, index === visible.length - 1 && styles.lastRow, pressed && styles.pressed]}
                >
                  <View style={[styles.accent, { backgroundColor: accentFor(status) }]} />
                  <View style={styles.left}>
                    <Text numberOfLines={1} ellipsizeMode="middle" style={styles.orderNo}>{event.order_no}</Text>
                    <Text numberOfLines={1} style={styles.eventType}>{eventLabel(event.event_type)}</Text>
                    <Text numberOfLines={2} style={styles.message}>{eventMessage(event.event_type, event.notes, event.old_status, event.new_status)}</Text>
                  </View>
                  <View style={styles.right}>
                    {event.new_status ? <StatusChip status={event.new_status} align="right" /> : null}
                    <Text style={styles.date}>{stamp.toLocaleDateString('en-IN')}</Text>
                    <Text style={styles.time}>{stamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </Pressable>
              </MotionView>
            );
          })}
        </View>
      ) : null}

      {!activity.isLoading && !activity.isError && !visible.length ? <StateView icon="activity" title="No activity recorded yet" message="Permanent audit events will appear here as actions occur." /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  register: { borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E7EF', backgroundColor: '#FFFFFF' },
  row: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderBottomColor: '#E8EDF3', borderBottomWidth: StyleSheet.hairlineWidth },
  lastRow: { borderBottomWidth: 0 },
  pressed: { backgroundColor: '#EDF4FC' },
  accent: { width: 4, alignSelf: 'stretch', minHeight: 48, borderRadius: 3 },
  left: { flex: 1, minWidth: 0, gap: 3 },
  right: { maxWidth: '44%', minWidth: 104, alignItems: 'flex-end', gap: 3 },
  orderNo: { color: colors.text, fontSize: 11, fontWeight: '900' },
  eventType: { color: colors.navy, fontSize: 9, fontWeight: '900' },
  message: { color: colors.textMuted, fontSize: 9, lineHeight: 13, fontWeight: '700' },
  date: { color: '#677589', fontSize: 8, fontWeight: '800', textAlign: 'right' },
  time: { color: '#8A97A8', fontSize: 8, fontWeight: '700', textAlign: 'right' },
});
