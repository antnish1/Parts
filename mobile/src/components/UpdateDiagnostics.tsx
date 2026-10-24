import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { AppIcon } from '@/components/AppIcon';

export function UpdateDiagnostics() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function check() {
    if (busy) return;
    if (!Updates.isEnabled) {
      setMessage('Updates are disabled in this installed build.');
      return;
    }
    setBusy(true);
    setMessage('Checking for a compatible update…');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setMessage('No compatible newer OTA found for this installation.');
        return;
      }
      const downloaded = await Updates.fetchUpdateAsync();
      if (!downloaded.isNew) {
        setMessage('No new bundle downloaded.');
        return;
      }
      Alert.alert('Update downloaded', 'Restart now to load the new Parts Connect update?', [
        { text: 'Later', style: 'cancel', onPress: () => setMessage('Update downloaded; it will load on the next launch.') },
        { text: 'Restart', onPress: () => { void Updates.reloadAsync().catch(e => setMessage(e instanceof Error ? e.message : 'Reload failed.')); } },
      ]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to check for updates.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Check for updates"
        disabled={busy}
        onPress={() => void check()}
        style={({ pressed }) => [styles.row, (pressed || busy) && styles.pressed]}
      >
        <View style={styles.iconBadge}>
          <AppIcon name="refresh" size={17} color="#155A9C" strokeWidth={2.1} />
        </View>
        <Text style={styles.title}>{busy ? 'Checking for updates…' : 'Check for updates'}</Text>
        <AppIcon name="chevronRight" size={17} color="#9AA5B5" strokeWidth={2.6} />
      </Pressable>
      {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 7 },
  row: {
    minHeight: 56,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E4EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  pressed: { opacity: 0.65 },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F0F5FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { flex: 1, color: '#1A202B', fontSize: 13, fontWeight: '800' },
  message: { marginTop: 6, paddingHorizontal: 8, fontSize: 11, lineHeight: 16, color: '#44546B' },
});
