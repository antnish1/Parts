import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AppIcon } from '@/components/AppIcon';
import { MotionView } from '@/components/MotionView';

export function SwitchAccountModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { session, savedAccounts, switchAccount, removeSavedAccount, signIn } = useAuth();
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [switchBusyId, setSwitchBusyId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState('');
  const [newLoginId, setNewLoginId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);

  function close() {
    if (switchBusyId) return;
    setSwitchError('');
    setAddAccountOpen(false);
    setNewLoginId('');
    setNewPassword('');
    onClose();
  }

  async function handleSwitchAccount(userId: string) {
    if (userId === session?.user?.id) return;
    setSwitchBusyId(userId);
    setSwitchError('');
    try {
      await switchAccount(userId);
      onClose();
      router.replace('/(tabs)/home');
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : 'Could not switch account.');
    } finally {
      setSwitchBusyId(null);
    }
  }

  async function handleAddAccount() {
    if (!newLoginId.trim() || !newPassword) {
      setSwitchError('Enter the User ID and password for the account you want to add.');
      return;
    }
    setSwitchBusyId('add');
    setSwitchError('');
    try {
      await signIn(newLoginId, newPassword);
      setNewLoginId('');
      setNewPassword('');
      setAddAccountOpen(false);
      onClose();
      router.replace('/(tabs)/home');
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : 'Could not add account.');
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
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Switch account</Text>
              <Text style={styles.subtitle}>Choose a saved Parts Connect account.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close switch account" onPress={close} style={styles.close}>
              <AppIcon name="x" size={20} color="#64748B" />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
            {savedAccounts.map((account) => {
              const active = account.userId === session?.user?.id;
              const initials = account.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'PC';
              return (
                <MotionView key={account.userId} delay={Math.min(savedAccounts.indexOf(account) * 28, 140)} trigger={visible} distance={5} duration={180}>
                  <View style={styles.accountRow}>
                    <Pressable disabled={active || Boolean(switchBusyId)} onPress={() => void handleSwitchAccount(account.userId)} style={styles.accountMain}>
                      <View style={styles.accountAvatar}><Text style={styles.accountInitials}>{initials}</Text></View>
                      <View style={styles.accountCopy}>
                        <Text numberOfLines={1} style={styles.accountName}>{account.fullName}</Text>
                        <Text numberOfLines={1} style={styles.accountMeta}>{account.role || 'User'} · {account.branch || 'Unassigned'}{account.loginId ? ` · ${account.loginId}` : ''}</Text>
                      </View>
                      {switchBusyId === account.userId ? <ActivityIndicator color="#1689D4" /> : active ? <View style={styles.activeCheck}><AppIcon name="check" size={16} color="#fff" /></View> : <AppIcon name="chevronRight" size={17} color="#94A3B8" />}
                    </Pressable>
                    {!active ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove saved account ${account.fullName}`} disabled={Boolean(switchBusyId)} onPress={() => void handleRemoveSavedAccount(account.userId)} style={styles.remove}><AppIcon name="x" size={14} color="#B83D46" /></Pressable> : null}
                  </View>
                </MotionView>
              );
            })}

            {!addAccountOpen ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Add account" onPress={() => { setSwitchError(''); setAddAccountOpen(true); }} style={styles.addRow}>
                <View style={styles.addIcon}><Text style={styles.addPlus}>+</Text></View>
                <Text style={styles.addText}>Add account</Text>
              </Pressable>
            ) : (
              <View style={styles.addForm}>
                <Text style={styles.addTitle}>Add another Parts Connect account</Text>
                <TextInput autoCapitalize="characters" autoCorrect={false} editable={switchBusyId !== 'add'} placeholder="User ID" placeholderTextColor="#94A3B8" value={newLoginId} onChangeText={setNewLoginId} style={styles.input} />
                <View style={styles.passwordField}>
                  <TextInput autoCapitalize="none" autoCorrect={false} editable={switchBusyId !== 'add'} secureTextEntry={!newPasswordVisible} placeholder="Password" placeholderTextColor="#94A3B8" value={newPassword} onChangeText={setNewPassword} onSubmitEditing={() => void handleAddAccount()} style={[styles.input, styles.passwordInput]} />
                  <Pressable onPress={() => setNewPasswordVisible((value) => !value)} style={styles.eye}><AppIcon name={newPasswordVisible ? 'eyeOff' : 'eye'} size={20} color="#64748B" /></Pressable>
                </View>
                <View style={styles.formActions}>
                  <Pressable disabled={switchBusyId === 'add'} onPress={() => { setAddAccountOpen(false); setNewLoginId(''); setNewPassword(''); setSwitchError(''); }} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
                  <Pressable disabled={switchBusyId === 'add'} onPress={() => void handleAddAccount()} style={styles.submit}>{switchBusyId === 'add' ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Add & switch</Text>}</Pressable>
                </View>
              </View>
            )}
            {switchError ? <Text style={styles.error}>{switchError}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,.48)' },
  sheet: { maxHeight: '82%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFFFFF', paddingTop: 8, paddingHorizontal: 18, paddingBottom: 24 },
  handle: { alignSelf: 'center', width: 88, height: 5, borderRadius: 999, backgroundColor: '#CBD5E1', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  title: { color: '#12223A', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#64748B', fontSize: 11, lineHeight: 16, marginTop: 3 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  scroll: { flexGrow: 0 },
  list: { paddingBottom: 10 },
  accountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7ECF2' },
  accountMain: { flex: 1, minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  accountAvatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C4A86', borderWidth: 2, borderColor: '#D7E5F4' },
  accountInitials: { color: '#fff', fontSize: 16, fontWeight: '900' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountName: { color: '#12223A', fontSize: 14, fontWeight: '900' },
  accountMeta: { color: '#64748B', fontSize: 9.5, fontWeight: '700', marginTop: 4 },
  activeCheck: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1689D4' },
  remove: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' },
  addRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  addIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#082B5B' },
  addPlus: { color: '#fff', fontSize: 32, lineHeight: 34, fontWeight: '300' },
  addText: { color: '#12223A', fontSize: 14, fontWeight: '900' },
  addForm: { gap: 10, paddingTop: 14, paddingBottom: 8 },
  addTitle: { color: '#12223A', fontSize: 13, fontWeight: '900' },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#D8E0E8', backgroundColor: '#fff', paddingHorizontal: 12, color: '#12223A', fontSize: 13 },
  passwordField: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 50 },
  eye: { position: 'absolute', right: 4, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' },
  formActions: { flexDirection: 'row', gap: 10 },
  cancel: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#D8E0E8', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#64748B', fontSize: 11, fontWeight: '900' },
  submit: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: '#082B5B', alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  error: { color: '#B83D46', fontSize: 10, lineHeight: 15, fontWeight: '700', marginTop: 6 },
});
