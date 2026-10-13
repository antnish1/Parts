# Android header, ticker and card refinements (runtime 0.2.0)

## Scope
- Shared Parts Connect logo/bell/profile header on Home, Work, Search, Activity and More, including manager and Accounts Home; remove OPERATIONS PORTAL subtitle.
- Navy top system status bar with light icons in the authenticated tab shell.
- Manager KPI chip strip is an animated continuous right-to-left loop preserving chip actions. Reduce-motion accessibility preference disables animation.
- Remove right chevrons from Needs Attention while keeping entire rows tappable.
- More distinctive solid-color icon tiles in My Work.
- Preserve business queries, security, roles, routes, and existing five-tab navigation.

## Before release
- TypeScript/Android Expo bundle validation through Mobile CI; check App CI.
- Check five tabs on device, status bar edge, clipped text, and bell/profile links.
- Confirm ticker loops smoothly, actions remain tappable and reduce-motion mode is readable.
- Confirm manager approval/pending issue/delayed VOR routes and Needs Attention tap behavior.
- Do not merge until approval; merging mobile branch triggers automatic preview OTA.

## Rollback
Revert this PR from agent/expo-android-foundation and publish a reversal preview OTA after validation. No native changes, APK/AAB, database changes or migrations.
