import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { MotionView } from '@/components/MotionView';
import { useAuth } from '@/auth/AuthProvider';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme/tokens';

export default function LoginScreen() {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');

  if (!isLoading && isAuthenticated) return <Redirect href="/(tabs)/home" />;

  async function submit() {
    if (!loginId.trim() || !password) {
      setError('Enter your User ID and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(loginId, password);
      router.replace('/(tabs)/home');
    } catch {
      setError('Invalid User ID or password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <MotionView distance={10} duration={260}>
      <View style={styles.brand}>
        <Image source={require('../assets/native/icon.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="Parts Connect logo" />
        <Text style={styles.title}>Parts Connect</Text>
        <Text style={styles.subtitle}>Frontier parts operations</Text>
      </View>
      </MotionView>

      <MotionView delay={70} distance={8} duration={240}>
      <View style={styles.card}>
        <Text style={styles.heading}>Sign in</Text>
        <Text style={styles.help}>Use the same User ID and password as the Parts Connect portal.</Text>
        <Text style={styles.label}>User ID</Text>
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!busy}
          placeholder="e.g. DAMOH01"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={loginId}
          onChangeText={setLoginId}
          returnKeyType="next"
        />
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordField}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          secureTextEntry={!passwordVisible}
          textContentType="password"
          autoComplete="current-password"
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.passwordInput]}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => void submit()}
          returnKeyType="go"
        />
        <Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'} onPress={() => setPasswordVisible(value => !value)} hitSlop={8} style={styles.eyeButton}>
          <AppIcon name={passwordVisible ? 'eyeOff' : 'eye'} size={22} color={colors.textMuted} />
        </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Forgot password?" style={styles.forgotPassword} onPress={() => Alert.alert('Password assistance', 'Your Parts Connect User ID uses an internal account. Please contact your Parts Connect administrator to reset your password. Email-based self-service reset is not available for these accounts.')}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </Pressable>
        {error ? <MotionView trigger={error} distance={4} duration={170}><Text style={styles.error}>{error}</Text></MotionView> : null}
        {!isSupabaseConfigured() ? <Text style={styles.warning}>Mobile Supabase environment is not configured on this build.</Text> : null}
        <Pressable disabled={busy} onPress={() => void submit()} style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
      </View>
      </MotionView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { height: 64, width: 64, borderRadius: 16 },
  title: { marginTop: spacing.md, color: colors.text, fontSize: 26, fontWeight: '900' },
  subtitle: { marginTop: 2, color: colors.textMuted, fontSize: 13 },
  card: { gap: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.xl },
  heading: { color: colors.text, fontSize: 20, fontWeight: '800' },
  help: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: spacing.sm },
  label: { marginTop: spacing.xs, color: colors.text, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', paddingHorizontal: spacing.md, color: colors.text, fontSize: 15 },
  passwordField: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 55 },
  eyeButton: { position: 'absolute', right: 5, top: 0, bottom: 0, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  forgotPassword: { alignSelf: 'flex-end', minHeight: 42, paddingHorizontal: 2, justifyContent: 'center' },
  forgotText: { color: '#4E58C8', fontSize: 12, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  warning: { color: colors.warning, fontSize: 12, lineHeight: 18 },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy, marginTop: spacing.md },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
