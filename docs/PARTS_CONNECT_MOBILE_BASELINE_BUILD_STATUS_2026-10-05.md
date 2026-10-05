# Parts Connect Mobile — OTA Baseline Build Status

**Date:** 05 October 2026  
**Branch:** `agent/expo-android-foundation`  
**PR:** `#126` — keep unmerged unless the user explicitly asks  
**Expo project:** `@insureit_expo/parts-connect`  
**Expo project ID:** `3026af5e-622e-48de-bb4f-1ca851373589`

## Current status

The mobile branch is now ready for the one-time OTA-capable Android preview baseline build.

Latest verified baseline head before this status-only commit:

```text
d9f45fdcd1ea8b8c1efe86f8c45a018ca2a1f85c
```

Verification on that exact functional head:

- Mobile CI #56 — PASS
- App CI #1743 — PASS
- Expo Android export — PASS through Mobile CI

## Native baseline included

The baseline now includes native dependencies for:

- EAS OTA updates: `expo-updates`
- push/local notifications: `expo-notifications`
- biometric authentication: `expo-local-authentication`
- image/gallery selection: `expo-image-picker`
- native file sharing: `expo-sharing`
- haptic feedback: `expo-haptics`
- network-state detection: `@react-native-community/netinfo`
- native splash configuration: `expo-splash-screen`

Existing native modules retained include camera, document picker, file system, secure store, linking and date picker.

## Branding included

The user supplied the Frontier red globe mark as the approved branding basis.

Because the GitHub connector used in this session cannot directly commit binary PNG files, the branch now contains a deterministic native asset generator:

```text
mobile/scripts/generate-native-assets.cjs
```

It runs during `npm install` / `postinstall` and creates:

- launcher icon
- adaptive foreground icon
- Android 13+ monochrome icon
- notification small icon
- splash artwork

Generated assets are written to:

```text
mobile/assets/native/
```

The asset style uses Frontier red with the Parts Connect dark navy palette.

## OTA/runtime configuration

App version / OTA runtime baseline:

```text
0.2.0
```

Runtime policy:

```text
appVersion
```

EAS Update URL:

```text
https://u.expo.dev/3026af5e-622e-48de-bb4f-1ca851373589
```

Channels:

```text
preview     -> internal APK / testing OTA
production  -> future production builds / OTA
```

The preview EAS profile builds an internal-distribution Android APK.

## Backend

The mobile EAS environment now points to the same Parts Connect Supabase backend used by the web portal:

```text
https://ubkwtjyvbdvepzbxoikq.supabase.co
```

Do not switch the mobile build back to `ilzhsfqqjyppzzvfscmh`; that was the incorrect backend that caused valid portal credentials to fail.

## Release rule after installing baseline 0.2.0

Use OTA first for JS/TS/UI/business-logic changes that remain compatible with runtime `0.2.0`.

Create another APK/AAB only when native code/configuration changes, including adding/removing native packages, changing Android permissions, changing app icon/splash native config, changing package/deep-link native configuration, or upgrading Expo/React Native.

Before any future binary build, read:

- root `AGENTS.md`
- `mobile/AGENTS.md`
- `docs/PARTS_CONNECT_MOBILE_NATIVE_BASELINE_AND_OTA_2026-10-05.md`
- this file

## Immediate next action

Trigger one EAS Android build using:

```text
profile: preview
platform: ANDROID
git ref: agent/expo-android-foundation
base directory: mobile
auto submit: false
```

After installation, explicitly test EAS OTA delivery on the `preview` channel before declaring the OTA-first rollout complete.
