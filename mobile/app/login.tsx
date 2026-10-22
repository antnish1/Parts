import { useEffect, useRef, useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Image, ImageBackground, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { AppIcon } from '@/components/AppIcon';
import { MotionView } from '@/components/MotionView';
import { useAuth } from '@/auth/AuthProvider';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

export default function LoginScreen() {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const addAccountMode = (Array.isArray(params.mode) ? params.mode[0] : params.mode) === 'add-account';
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const passwordRef = useRef<TextInput>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);

  function revealFocusedField() {
    // Allow Android to resize first, then keep the fields and submit action reachable.
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }

  if (!isLoading && isAuthenticated && !addAccountMode) return <Redirect href="/(tabs)/home" />;

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
    <ImageBackground source={require('../assets/branding/jsign.jpeg')} style={styles.background} resizeMode="stretch">
      <View pointerEvents="none" style={styles.backgroundWash} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.page, keyboardOpen && styles.pageKeyboard]}
        >
          <MotionView distance={10} duration={260}>
            <View style={[styles.brand, keyboardOpen && styles.brandKeyboard]}>
              <Image source={require('../assets/branding/PCLOGO.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="Parts Connect logo" />
              <Text style={styles.title}>Parts Connect</Text>
              <Text style={styles.subtitle}>Frontier parts operations</Text>
              <View style={styles.brandUnderline} />
            </View>
          </MotionView>

          <MotionView delay={70} distance={8} duration={240}>
            <View style={styles.cardWrap}>
              <View style={styles.card}>
                <View style={styles.userMedallion}>
                  <AppIcon name="user" size={30} color="#FFFFFF" strokeWidth={1.9} />
                </View>

                <Text style={styles.heading}>{addAccountMode ? 'Add account' : 'Sign in'}</Text>
                <Text style={styles.help}>
                  {addAccountMode
                    ? 'Sign in with another Parts Connect User ID. Your current account stays saved on this device.'
                    : 'Use the same User ID and password as the Parts Connect portal.'}
                </Text>

                <FieldLabel icon="user" text="User ID" />
                <View style={styles.inputShell}>
                  <AppIcon name="user" size={20} color="#748297" strokeWidth={1.8} />
                  <TextInput
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!busy}
                    placeholder="e.g. DAMOH01"
                    placeholderTextColor="#A2ACBA"
                    style={styles.input}
                    value={loginId}
                    onChangeText={setLoginId}
                    onFocus={() => { setKeyboardOpen(true); revealFocusedField(); }}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    returnKeyType="next"
                  />
                </View>

                <FieldLabel icon="lock" text="Password" />
                <View style={styles.inputShell}>
                  <AppIcon name="lock" size={20} color="#748297" strokeWidth={1.8} />
                  <TextInput
                    ref={passwordRef}
                    onFocus={() => { setKeyboardOpen(true); revealFocusedField(); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!busy}
                    secureTextEntry={!passwordVisible}
                    textContentType="password"
                    autoComplete="current-password"
                    placeholder="Password"
                    placeholderTextColor="#A2ACBA"
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={() => void submit()}
                    returnKeyType="go"
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                    onPress={() => setPasswordVisible((value) => !value)}
                    hitSlop={8}
                    style={styles.eyeButton}
                  >
                    <AppIcon name={passwordVisible ? 'eyeOff' : 'eye'} size={22} color="#607086" />
                  </Pressable>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Forgot password?"
                  style={styles.forgotPassword}
                  onPress={() => Alert.alert('Password assistance', 'Your Parts Connect User ID uses an internal account. Please contact your Parts Connect administrator to reset your password. Email-based self-service reset is not available for these accounts.')}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                  <AppIcon name="chevronRight" size={14} color="#0A66D4" strokeWidth={2.2} />
                </Pressable>

                {error ? <MotionView trigger={error} distance={4} duration={170}><Text style={styles.error}>{error}</Text></MotionView> : null}
                {!isSupabaseConfigured() ? <Text style={styles.warning}>Mobile Supabase environment is not configured on this build.</Text> : null}

                <Pressable
                  disabled={busy}
                  onPress={() => void submit()}
                  style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
                >
                  <GradientBackground />
                  {busy
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <View style={styles.buttonContent}>
                        <Text style={styles.buttonText}>{addAccountMode ? 'Add & switch' : 'Sign in'}</Text>
                        <Text style={styles.buttonArrow}>→</Text>
                      </View>}
                </Pressable>
              </View>
            </View>
          </MotionView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

function FieldLabel({ icon, text }: { icon: 'user' | 'lock'; text: string }) {
  return (
    <View style={styles.labelRow}>
      <AppIcon name={icon} size={17} color="#0A66D4" strokeWidth={1.9} />
      <Text style={styles.label}>{text}</Text>
    </View>
  );
}

function GradientBackground() {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="signinButton" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#0752A2" />
          <Stop offset="0.55" stopColor="#0069D9" />
          <Stop offset="1" stopColor="#1795FF" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx="30" fill="url(#signinButton)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#EEF6FF' },
  backgroundWash: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,.03)' },
  keyboard: { flex: 1 },
  page: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 46,
    paddingBottom: 30,
  },

  pageKeyboard: { justifyContent: 'flex-start', paddingTop: 10, paddingBottom: 24 },
  brandKeyboard: { marginBottom: 12 },
  brand: {
    alignItems: 'flex-start',
    paddingHorizontal: 22,
    marginBottom: 22,
    zIndex: 2,
  },
  logo: { width: 88, height: 88 },
  title: {
    marginTop: 0,
    color: '#0E2038',
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -.7,
  },
  subtitle: {
    marginTop: 1,
    color: '#6F7F94',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  brandUnderline: {
    marginTop: 10,
    width: 66,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#0A7BEF',
  },

  cardWrap: { paddingTop: 34, paddingBottom: 4 },
  card: {
    position: 'relative',
    paddingTop: 50,
    paddingHorizontal: 26,
    paddingBottom: 28,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,.97)',
    borderWidth: 1,
    borderColor: 'rgba(211,225,240,.95)',
    shadowColor: '#4B89C9',
    shadowOpacity: .16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 9,
  },
  userMedallion: {
    position: 'absolute',
    top: -39,
    alignSelf: 'center',
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#086DD0',
    borderWidth: 5,
    borderColor: '#FFFFFF',
  },
  heading: {
    textAlign: 'left',
    color: '#0E2038',
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -.45,
  },
  help: {
    marginTop: 6,
    marginBottom: 22,
    textAlign: 'left',
    color: '#6F7F94',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  label: {
    color: '#13253D',
    fontSize: 12,
    fontWeight: '800',
  },
  inputShell: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D7E0E9',
    borderRadius: 30,
    backgroundColor: 'rgba(250,252,255,.96)',
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 0,
    color: '#1A2B43',
    fontSize: 14,
    fontWeight: '600',
  },
  eyeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  forgotPassword: {
    alignSelf: 'flex-end',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: -8,
    marginBottom: 16,
  },
  forgotText: {
    color: '#0A66D4',
    fontSize: 12,
    fontWeight: '800',
  },

  error: {
    color: colors.danger,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  warning: {
    color: colors.warning,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },

  button: {
    position: 'relative',
    minHeight: 54,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    marginTop: 6,
    shadowColor: '#0A70D7',
    shadowOpacity: .28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  buttonPressed: { opacity: .82, transform: [{ scale: .995 }] },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  buttonArrow: { color: '#FFFFFF', fontSize: 29, lineHeight: 30, marginTop: -2 },
});
