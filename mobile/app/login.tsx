import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme/tokens';

export default function LoginScreen() {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
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
      <View style={styles.brand}>
        <View style={styles.logo}><Text style={styles.logoText}>PC</Text></View>
        <Text style={styles.title}>Parts Connect</Text>
        <Text style={styles.subtitle}>Frontier parts operations</Text>
      </View>

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
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          secureTextEntry
          textContentType="password"
          autoComplete="current-password"
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => void submit()}
          returnKeyType="go"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!isSupabaseConfigured() ? <Text style={styles.warning}>Mobile Supabase environment is not configured on this build.</Text> : null}
        <Pressable disabled={busy} onPress={() => void submit()} style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { height: 58, width: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.navy },
  logoText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  title: { marginTop: spacing.md, color: colors.text, fontSize: 26, fontWeight: '900' },
  subtitle: { marginTop: 2, color: colors.textMuted, fontSize: 13 },
  card: { gap: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.xl },
  heading: { color: colors.text, fontSize: 20, fontWeight: '800' },
  help: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: spacing.sm },
  label: { marginTop: spacing.xs, color: colors.text, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', paddingHorizontal: spacing.md, color: colors.text, fontSize: 15 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  warning: { color: colors.warning, fontSize: 12, lineHeight: 18 },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy, marginTop: spacing.md },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
