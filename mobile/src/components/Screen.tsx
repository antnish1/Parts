import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeBrandHeader } from '@/components/HomeBrandHeader';
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
  const header = title ? (
    <View style={styles.header}>
      <View style={styles.headingCopy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  ) : null;

  return (
    <SafeAreaView style={[styles.safe, brandHeader && styles.brandedSafe]} edges={['top']}>
      {scroll ? (
        <ScrollView style={brandHeader ? styles.pageBackground : undefined} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, brandHeader && styles.brandedContent, contentContainerStyle]}>
          {brandHeader ? <HomeBrandHeader /> : null}
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flex, brandHeader && styles.pageBackground]}>
          {brandHeader ? <HomeBrandHeader /> : null}
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  pageBackground: { backgroundColor: colors.background },
  brandedSafe: { backgroundColor: '#082B5B' },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  brandedContent: { paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm, marginBottom: 2 },
  headingCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.25 },
  subtitle: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 2 },
});
