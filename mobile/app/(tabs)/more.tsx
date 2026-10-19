import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/auth/AuthProvider';
import { roleWorkActions } from '@/auth/roleNavigation';
import { AppIcon } from '@/components/AppIcon';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { MotionView } from '@/components/MotionView';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/tokens';
import { UpdateDiagnostics } from '@/components/UpdateDiagnostics';

export default function MoreScreen() {
  const { profile, session, signOut, role, savedAccounts, switchAccount, removeSavedAccount } = useAuth();
  const actions = role ? roleWorkActions[role] : [];
  const shortcuts = [{ key: 'approval-queue', icon: 'clipboardCheck' as const, tone: 'blue' as const, title: 'Approvals' }, { key: 'track-orders', icon: 'route' as const, tone: 'green' as const, title: 'Track Orders' }, { key: 'delayed-vor', icon: 'timer' as const, tone: 'red' as const, title: 'Delayed VOR' }].flatMap(item => {
    const action = actions.find(a => a.key === item.key && a.href);
    return action?.href ? [{ ...item, href: action.href }] : [];
  });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchBusyId, setSwitchBusyId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState('');
  const email = session?.user?.email?.endsWith('@portal.local') ? null : session?.user?.email;

  async function savePhoto(uri: string) {
    const userId = session?.user?.id;
    if (!userId) return;
    setBusy(true);
    try {
      const response = await fetch(uri);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('Image exceeds 5 MB. Please choose a smaller photo.');
      const path = userId + '/avatar.jpg';
      const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, bytes, {
        contentType: 'image/jpeg', upsert: true, cacheControl: '60',
      });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_path: path, avatar_updated_at: Date.now() } });
      if (updateError) throw updateError;
      setPreview(null);
      Alert.alert('Photo updated', 'Your profile picture has been saved.');
    } catch (error) {
      Alert.alert('Could not save photo', error instanceof Error ? error.message : 'Please try again.');
    } finally { setBusy(false); }
  }

  async function choosePhoto(camera: boolean) {
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert('Permission needed', 'Allow access in Android settings to select a profile photo.'); return; }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: .65 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]?.uri) setPreview(result.assets[0].uri);
    } catch (error) { Alert.alert('Photo unavailable', error instanceof Error ? error.message : 'Try again.'); }
  }

  function photoMenu() {
    Alert.alert('Profile picture', 'Choose how to update your photo', [
      { text: 'Camera', onPress: () => void choosePhoto(true) },
      { text: 'Gallery', onPress: () => void choosePhoto(false) },
      ...(typeof session?.user?.user_metadata?.avatar_path === 'string' ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => void removePhoto() }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function removePhoto() {
    if (!session?.user?.id) return;
    setBusy(true);
    try {
      const path = session.user.user_metadata?.avatar_path;
      if (typeof path === 'string' && path.startsWith(session.user.id + '/')) {
        const { error } = await supabase.storage.from('profile-avatars').remove([path]);
        if (error) throw error;
      }
      const { error } = await supabase.auth.updateUser({ data: { avatar_path: null, avatar_updated_at: Date.now() } });
      if (error) throw error;
    } catch (e) { Alert.alert('Could not remove photo', e instanceof Error ? e.message : 'Try again.'); }
    finally { setBusy(false); }
  }

  async function handleSignOut() {
    try { await signOut(); router.replace('/login'); }
    catch { Alert.alert('Sign out failed', 'Please try again.'); }
  }

  async function handleSwitchAccount(userId: string) {
    if (userId === session?.user?.id) return;
    setSwitchBusyId(userId);
    setSwitchError('');
    try {
      await switchAccount(userId);
      setSwitchOpen(false);
      router.replace('/(tabs)/home');
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : 'Could not switch account.');
    } finally {
      setSwitchBusyId(null);
    }
  }

  async function handleRemoveSavedAccount(userId: string) {
    try {
      await removeSavedAccount(userId);
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : 'Could not remove saved account.');
    }
  }

  return (
    <Screen brandHeader title="My Profile" subtitle="Account, work shortcuts and app information.">
      <MotionView trigger={session?.user?.id}>
      <View style={styles.hero}>
        <View style={styles.photoWrap}>
          {preview ? <Image source={{ uri: preview }} style={styles.photo} /> : <ProfileAvatar size={104} />}
          <Pressable accessibilityRole="button" accessibilityLabel="Change profile picture" onPress={photoMenu} disabled={busy} style={styles.camera}>
            <AppIcon name="camera" size={21} color="#FFFFFF" />
          </Pressable>
        </View>
        <Text style={styles.name}>{profile?.fullName || 'Authenticated user'}</Text>
        <Text style={styles.sub}>{profile?.role || 'User'} · {profile?.branch || 'Unassigned'}</Text>
        {preview ? <View style={styles.photoActions}><Pressable disabled={busy} onPress={() => void savePhoto(preview)} style={styles.save}><Text style={styles.saveText}>Save photo</Text></Pressable><Pressable onPress={() => setPreview(null)} style={styles.cancel}><Text>Cancel</Text></Pressable></View> : null}
        {busy ? <ActivityIndicator color="#FFFFFF" /> : null}
      </View>
      </MotionView>

      <Text style={styles.section}>MY ACCOUNT</Text>
      <MotionView delay={60} trigger={session?.user?.id}>
      <View style={styles.card}>
        <Info icon="work" label="Role" value={profile?.role || '—'} />
        <Info icon="inventory" label="Branch" value={profile?.branch || '—'} />
        {email ? <Info icon="package" label="Email" value={email} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Switch account" onPress={() => { setSwitchError(''); setSwitchOpen(true); }} style={styles.accountAction}>
          <AppIcon name="refresh" color="#245A95" size={17} />
          <Text style={styles.label}>Account</Text>
          <Text style={styles.accountActionText}>Switch account</Text>
          <AppIcon name="chevronRight" color="#94A3B8" size={16} />
        </Pressable>
      </View>
      </MotionView>

      {shortcuts.length ? <>
        <Text style={styles.section}>MY OPERATIONS</Text>
        <View style={styles.shortcuts}>{shortcuts.map((item,index) => <MotionView key={item.key} delay={Math.min(index*35,120)} style={{ flex: 1 }}><Shortcut icon={item.icon} tone={item.tone} title={item.title} onPress={() => router.push(item.href)} /></MotionView>)}</View>
      </> : null}

      <Text style={styles.section}>APP INFORMATION</Text>
      <MotionView delay={100}>
      <View style={styles.card}>
        <Info icon="package" label="App" value="Parts Connect Android" />
        <Info icon="refresh" label="Runtime" value="0.2.0" />
        <Info icon="shield" label="Updates" value="OTA enabled" last />
      </View>
      </MotionView>
      <UpdateDiagnostics />
      <Pressable onPress={() => void handleSignOut()} style={styles.signOut}><AppIcon name="x" size={17} color="#B83D46" /><Text style={styles.outText}>Sign out securely</Text></Pressable>

      <Modal visible={switchOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setSwitchOpen(false)}>
        <View style={styles.switchBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSwitchOpen(false)} />
          <View style={styles.switchSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Switch account</Text>
                <Text style={styles.sheetSubtitle}>Saved sign-ins stay securely separated on this device.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close switch account" onPress={() => setSwitchOpen(false)} style={styles.sheetClose}>
                <AppIcon name="x" size={20} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView style={styles.accountsScroll} contentContainerStyle={styles.accountsList}>
              {savedAccounts.map((account) => {
                const active = account.userId === session?.user?.id;
                const initials = account.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'PC';
                return (
                  <MotionView key={account.userId} delay={Math.min(savedAccounts.indexOf(account) * 28, 140)} trigger={switchOpen} distance={5} duration={180}>
                  <View style={styles.accountRow}>
                    <Pressable disabled={active || Boolean(switchBusyId)} onPress={() => void handleSwitchAccount(account.userId)} style={styles.accountMain}>
                      <View style={styles.accountAvatar}><Text style={styles.accountInitials}>{initials}</Text></View>
                      <View style={styles.accountCopy}>
                        <Text numberOfLines={1} style={styles.accountName}>{account.fullName}</Text>
                        <Text numberOfLines={1} style={styles.accountMeta}>{account.role || 'User'} · {account.branch || 'Unassigned'}{account.loginId ? ` · ${account.loginId}` : ''}</Text>
                      </View>
                      {switchBusyId === account.userId ? <ActivityIndicator color="#1689D4" /> : active ? <View style={styles.activeCheck}><AppIcon name="check" size={16} color="#fff" /></View> : <AppIcon name="chevronRight" size={17} color="#94A3B8" />}
                    </Pressable>
                    {!active ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove saved account ${account.fullName}`} disabled={Boolean(switchBusyId)} onPress={() => void handleRemoveSavedAccount(account.userId)} style={styles.removeAccount}><AppIcon name="x" size={14} color="#B83D46" /></Pressable> : null}
                  </View>
                  </MotionView>
                );
              })}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add account"
                onPress={() => {
                  setSwitchError('');
                  setSwitchOpen(false);
                  router.push({ pathname: '/login', params: { mode: 'add-account' } });
                }}
                style={styles.addAccountRow}
              >
                <View style={styles.addAccountIcon}><Text style={styles.addAccountPlus}>+</Text></View>
                <Text style={styles.addAccountText}>Add account</Text>
                <AppIcon name="chevronRight" size={17} color="#94A3B8" />
              </Pressable>
              {switchError ? <MotionView trigger={switchError} distance={4} duration={160}><Text style={styles.switchError}>{switchError}</Text></MotionView> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Info({ icon, label, value, last = false }: { icon: 'work' | 'inventory' | 'package' | 'shield' | 'refresh'; label: string; value: string; last?: boolean }) {
  return <View style={[styles.info, last && { borderBottomWidth: 0 }]}><AppIcon name={icon} color="#245A95" size={17} /><Text style={styles.label}>{label}</Text><Text numberOfLines={1} style={styles.value}>{value}</Text></View>;
}
function Shortcut({ icon, tone, title, onPress }: { icon: 'clipboardCheck' | 'route' | 'timer'; tone: 'blue' | 'green' | 'red'; title: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.shortcut}>
    <View style={[styles.shortcutIcon, tone === 'blue' ? styles.shortcutBlue : tone === 'green' ? styles.shortcutGreen : styles.shortcutRed]}>
      <AppIcon name={icon} color="#FFFFFF" size={22} strokeWidth={2.1} />
    </View>
    <Text style={styles.shortcutTitle}>{title}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  hero: { backgroundColor: '#082B5B', borderRadius: 16, padding: 18, alignItems: 'center', gap: 6 },
  photoWrap: { width: 110, height: 110, marginBottom: 5 },
  photo: { width: 104, height: 104, borderRadius: 52, borderWidth: 2, borderColor: '#FFFFFF' },
  camera: { position: 'absolute', bottom: 0, right: 0, width: 38, height: 38, borderRadius: 20, backgroundColor: '#1160B8', borderWidth: 3, borderColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  name: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  sub: { color: '#CFDDF0', fontSize: 10, fontWeight: '700' },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  save: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, backgroundColor: '#FFFFFF' },
  saveText: { color: '#082B5B', fontWeight: '900' },
  cancel: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: '#E6ECF5' },
  section: { fontSize: 10, letterSpacing: 1, fontWeight: '900', color: '#697990', marginTop: 5 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E7EE', borderRadius: 14, paddingHorizontal: 12 },
  info: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5EAF0' },
  accountAction: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10 },
  accountActionText: { flex: 1, textAlign: 'right', color: '#245A95', fontSize: 10, fontWeight: '900' },
  label: { fontSize: 11, fontWeight: '800', color: '#35465E', width: 66 },
  value: { flex: 1, textAlign: 'right', color: '#15243B', fontWeight: '800', fontSize: 10 },
  shortcuts: { flexDirection: 'row', gap: 8 },
  shortcut: { flex: 1, minHeight: 88, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E1E7EE', alignItems: 'center', justifyContent: 'center', gap: 7 },
  shortcutIcon: { borderRadius: 10, width:44, height:44,alignItems:'center',justifyContent:'center' },
  shortcutBlue: { backgroundColor:'#225AB0' },
  shortcutGreen: { backgroundColor:'#1B8864' },
  shortcutRed: { backgroundColor:'#B9464B' },
  shortcutTitle: { fontSize: 9, fontWeight: '800', color: '#203D62' },
  signOut: { borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8B8B8', padding: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  outText: { color: '#B83D46', fontWeight: '900', fontSize: 11 },
  switchBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,.48)' },
  switchSheet: { maxHeight: '82%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFFFFF', paddingTop: 8, paddingHorizontal: 18, paddingBottom: 24 },
  sheetHandle: { alignSelf: 'center', width: 88, height: 5, borderRadius: 999, backgroundColor: '#CBD5E1', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  sheetTitle: { color: '#12223A', fontSize: 22, fontWeight: '900' },
  sheetSubtitle: { color: '#64748B', fontSize: 11, lineHeight: 16, marginTop: 3 },
  sheetClose: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  accountsScroll: { flexGrow: 0 },
  accountsList: { paddingBottom: 10 },
  accountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7ECF2' },
  accountMain: { flex: 1, minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  accountAvatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C4A86', borderWidth: 2, borderColor: '#D7E5F4' },
  accountInitials: { color: '#fff', fontSize: 16, fontWeight: '900' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountName: { color: '#12223A', fontSize: 14, fontWeight: '900' },
  accountMeta: { color: '#64748B', fontSize: 9.5, fontWeight: '700', marginTop: 4 },
  activeCheck: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1689D4' },
  removeAccount: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' },
  addAccountRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  addAccountIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#082B5B' },
  addAccountPlus: { color: '#fff', fontSize: 32, lineHeight: 34, fontWeight: '300' },
  addAccountText: { flex: 1, color: '#12223A', fontSize: 14, fontWeight: '900' },
  switchError: { color: '#B83D46', fontSize: 10, lineHeight: 15, fontWeight: '700', marginTop: 6 },
});
