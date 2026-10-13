# Compact Android Activity register — release and rollback

- Refines only mobile/app/(tabs)/activity.tsx; no backend, schemas or roles changed.
- Preserves getVisibleOrders(120), the existing 24-row view, status handling, and order detail navigation.
- Replaces tall timeline/dots/right chevrons with joined compact tappable rows, a severity accent bar, two-line order summary and right-aligned branch/date/status.
- Verify on narrow Android devices, loading/error/empty states, long order numbers and status badges.
- CI: npm run check and App CI; manual native visual check recommended.
- Revert this PR to restore old timeline. The existing automatic OTA workflow will run only when this PR is merged into agent/expo-android-foundation. No APK/AAB.
