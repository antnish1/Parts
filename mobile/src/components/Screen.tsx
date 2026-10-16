import type { PropsWithChildren, ReactNode } from 'react';
import { useSegments } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeBrandHeader } from '@/components/HomeBrandHeader';
import { PersistentBottomNav } from '@/components/PersistentBottomNav';
import { useAuth } from '@/auth/AuthProvider';
import { colors, spacing } from '@/theme/tokens';

type ScreenProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  brandHeader?: boolean;
  scroll?: boolean;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
}>;

export function Screen({ children, title, subtitle, right, brandHeader = false, scroll = true, contentContainerStyle }: ScreenProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const firstSegment = segments[0];
  const insideTabs = firstSegment === '(tabs)';
  const isLogin = firstSegment === 'login';
  const showPersistentNav = !isLoading && isAuthenticated && !insideTabs && !isLogin;
  const showBrand = isAuthenticated || brandHeader;
  const header = title ? (
    <View style={styles.header}>
      <View style={styles.headingCopy}>
        <Text style={styles.title}>{title}</Text>
      </View>
      {right}
    </View>
  ) : null;

  return (
    <View style={styles.shell}>
      <SafeAreaView style={[styles.safe, showBrand && styles.brandedSafe]} edges={showBrand ? [] : ['top']}>
        {scroll ? (
          <ScrollView style={showBrand ? styles.pageBackground : undefined} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, showBrand && styles.brandedContent, contentContainerStyle]}>
            {showBrand ? <HomeBrandHeader /> : null}
            {header}
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.flex, showBrand && styles.pageBackground]}>
            {showBrand ? <HomeBrandHeader /> : null}
            {header}
            {children}
          </View>
        )}
      </SafeAreaView>
      {showPersistentNav ? <PersistentBottomNav /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  pageBackground: { backgroundColor: '#FFFFFF' },
  brandedSafe: { backgroundColor: '#082B5B' },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  brandedContent: { paddingTop: 0 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm, marginBottom: 2 },
  headingCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.25 },
  subtitle: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 2 },
});
