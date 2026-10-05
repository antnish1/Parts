# Parts Connect Mobile — Native Baseline and OTA Strategy

**Date:** 05 October 2026  
**Repository:** `antnish1/Parts`  
**Mobile branch:** `agent/expo-android-foundation`  
**PR:** `#126`  
**Expo account:** `insureit_expo`  
**Expo project ID:** `3026af5e-622e-48de-bb4f-1ca851373589`  
**Android package:** `com.frontier.partsconnect`

---

## 1. Why this document exists

This document is the source of truth for future AI agents before creating another Android APK/AAB or changing OTA/EAS Update configuration.

The product goal is to make the next Android binary the **Mobile Native Baseline v1** and include all reasonable native capabilities up front. After that baseline build, normal JavaScript/TypeScript/UI/business-logic changes should be published through **EAS OTA updates whenever runtime-compatible**.

Do not create repeated APK builds for changes that can safely be delivered OTA.

---

## 2. Current important state

The first successful EAS preview APK was built from commit `8968a4452a6808563966259eda8ec59c927e3ca1`.

That APK does **not** contain `expo-updates` and therefore cannot receive EAS OTA updates.

The mobile EAS environment was also initially pointed to the wrong Supabase project. This was corrected in commit `72d7c44a4785bf8ed60157684a4384e83f6dbca3`.

Correct Parts Connect Supabase project:

```text
https://ubkwtjyvbdvepzbxoikq.supabase.co
```

The current intended login behavior must match the web portal:

- User IDs without `@` map to `<userid>@portal.local`
- whitespace is removed from User ID before normalization
- password input must not auto-capitalize or autocorrect
- existing Supabase Auth identities and `portal_profiles` remain authoritative

Example verified user mapping during investigation:

```text
NISHANT -> nishant@portal.local
```

Do not create a separate mobile authentication system.

---

## 3. OTA-first release policy after the next baseline build

After Mobile Native Baseline v1 is installed, prefer OTA for runtime-compatible changes such as:

- screen/UI redesigns
- navigation changes implemented only in JS/TS
- labels/text/copy
- role visibility changes
- validation rules
- Supabase queries and RPC usage
- API calls
- dashboard changes
- reports
- workflow UI changes
- bug fixes
- most bundled images/logos/assets
- business logic that does not add/change native modules
- backend endpoint/config values loaded through JS/runtime-compatible configuration

A new APK/AAB remains necessary whenever native/runtime compatibility changes, including:

- adding or removing a native package
- Expo SDK / React Native upgrade
- changing Android package/application ID
- changing native permissions
- changing AndroidManifest/native config
- changing app icon/adaptive icon
- changing splash screen native configuration
- adding native notification capability not already compiled in
- adding biometric/native device capability not already compiled in
- adding NFC/Bluetooth/background-location/native services
- native deep-link intent configuration changes
- native file-provider/intent configuration changes
- native library upgrades that change the runtime fingerprint

Future agents must explicitly classify a requested change as **OTA-compatible** or **requires new native build** before starting another APK.

---

## 4. Native capabilities to include before Mobile Native Baseline v1

### 4.1 OTA / EAS Update foundation — REQUIRED

Add/configure:

- `expo-updates`
- EAS Updates URL
- `runtimeVersion`
- `preview` update channel for internal APK testing
- production channel strategy for later store builds
- automatic update check on app launch
- safe embedded-bundle fallback
- rollback-safe behavior
- optional in-app update status / restart-to-apply flow

The binary must be verified to report OTA as enabled before treating future work as OTA-first.

### 4.2 Branding / app identity — FINALIZE BEFORE BUILD

Finalize:

- Android app icon
- adaptive icon foreground
- adaptive icon background
- splash screen artwork/layout
- app display name: `Parts Connect`
- Android package: `com.frontier.partsconnect`
- custom URL scheme: `partsconnect://`
- version/versionCode strategy
- notification small icon if push notifications are enabled

### 4.3 Notifications — RECOMMENDED FOR BASELINE

Include native support for:

- `expo-notifications`
- push-token registration capability
- Android notification channels
- foreground/background notification handling
- notification-tap deep links into relevant app screens
- badge handling where supported

Initial product workflows that may later use notifications include order approvals, Credit Dispatch approvals/corrections, TA/DA custody events, delayed VOR/action-required events and operational reminders.

### 4.4 Biometrics — RECOMMENDED FOR BASELINE

Include:

- `expo-local-authentication`
- fingerprint/biometric unlock after a valid first login
- secure token/session remains in `expo-secure-store`

Biometric unlock must never replace backend authentication/authorization.

### 4.5 Media and files — RECOMMENDED FOR BASELINE

Existing native capabilities already include:

- `expo-camera`
- `expo-document-picker`
- `expo-file-system`
- `expo-secure-store`
- `expo-linking`

Recommended additions:

- `expo-image-picker`
- `expo-sharing`

This supports future gallery uploads, evidence/photo selection, document sharing/export, PDF/file sharing and signature/image workflows without introducing another native dependency later.

### 4.6 Device UX — RECOMMENDED FOR BASELINE

Recommended additions:

- `expo-haptics`
- `@react-native-community/netinfo`

Use cases:

- scanner success/error haptic feedback
- approval/receipt confirmation feedback
- online/offline status
- safer retry/error states
- future read-only local cache behavior

### 4.7 Optional native modules — ADD ONLY IF PRODUCT NEED IS CONFIRMED

Do not add permissions/libraries merely because they exist. Avoid unnecessary privacy surface and app size.

Only add later when the product explicitly needs them:

- microphone/audio recording
- Bluetooth
- NFC
- contacts
- SMS
- calendar
- background location
- background audio
- telephony integrations

If any of these become known requirements before the baseline build, include them now; otherwise leave them out.

---

## 5. Native Android configuration to finalize

Before the baseline APK, verify and intentionally set:

- portrait orientation policy
- status bar appearance
- navigation bar appearance
- edge-to-edge / safe-area behavior
- Android keyboard resize behavior
- hardware back-button behavior
- camera permission copy
- notification permission flow
- image/media permission behavior
- biometric availability fallback
- file open/share intents
- deep-link scheme and navigation handling
- app version/versionCode
- update channel/runtime configuration
- release signing handled through EAS credentials

Do not add broad permissions that are not used.

---

## 6. Asset checklist

### Assets the user should provide if exact brand fidelity is required

Preferred source files:

1. **Official Parts Connect / Frontier brand logo**
   - best: SVG or transparent PNG
   - high-resolution source preferred
   - avoid screenshots when possible

2. **Exact app icon concept**, if there is a brand-approved design
   - vector/SVG or large PNG preferred
   - if no approved icon exists, the AI agent may design one from the official logo

3. **Official brand colors**, only if they differ from the existing portal/mobile theme
   - HEX values or brand guideline file

4. **Official splash-screen artwork**, only if a specific marketing/brand composition is required

5. **Notification small-icon artwork**, only if the company has a specific approved monochrome mark

The user does **not** need to provide Android density variants. Those can be generated from a single high-quality source asset.

### Assets the AI agent can generate from supplied brand material

The AI agent can prepare/generate:

- Android adaptive icon foreground PNG
- adaptive icon background color/config
- standard launcher icon
- rounded/icon-safe variants
- splash-screen composition
- splash background
- notification monochrome icon derived from the logo
- store/testing preview artwork if later required
- correctly sized PNG exports from a supplied SVG/high-resolution logo
- dark/light logo variants when design rules permit
- placeholder/default profile/avatar graphics
- simple scanner/empty-state illustrations
- in-app icons using the project's icon library

Any generated branding must be reviewed by the user before the final baseline APK if exact brand fidelity matters.

---

## 7. Recommended asset delivery from user before baseline build

Minimum preferred package from the user:

```text
1. Official logo: SVG or transparent PNG
2. Confirmation whether the app icon should use:
   A. full logo,
   B. initials/monogram,
   C. a dedicated Parts Connect symbol
3. Confirmation of splash preference:
   A. logo centered on brand background,
   B. logo + Parts Connect text,
   C. custom artwork
4. Any mandatory brand HEX colors, if different from the current navy/blue theme
```

If the user provides only the official logo, the AI agent can generate the remaining Android-ready assets and show them for approval before building.

---

## 8. Recommended baseline native package target

In addition to currently installed packages, the preferred baseline includes:

```text
expo-updates
expo-notifications
expo-local-authentication
expo-image-picker
expo-sharing
expo-haptics
@react-native-community/netinfo
```

Before installation, use `npx expo install <package>` / Expo-compatible versions for the current SDK rather than manually guessing versions.

Every added package must pass:

- TypeScript checks
- Expo Android export check
- App CI
- Mobile CI

Do not merge PR #126 unless the user explicitly asks.

---

## 9. Build strategy after baseline

### Preview/internal testing

Use:

```text
EAS profile: preview
Platform: Android
Distribution: internal
Base directory: mobile
```

The next preview APK should be the first OTA-capable baseline.

### After baseline installation

Normal flow:

```text
change code
  -> run checks
  -> publish EAS Update to matching channel/runtime
  -> test OTA on installed baseline APK
```

Do not rebuild an APK solely because JS/TS changed.

### When native code changes

Normal flow:

```text
native dependency/config change
  -> runtime changes
  -> run checks
  -> create new APK/AAB
  -> install/distribute new binary
  -> subsequent compatible changes return to OTA-first
```

---

## 10. Pre-build checklist for future AI agents

Before triggering Mobile Native Baseline v1:

- [ ] Read root `AGENTS.md`
- [ ] Read `mobile/AGENTS.md`
- [ ] Read this document
- [ ] Confirm current branch is `agent/expo-android-foundation`
- [ ] Confirm PR #126 is still not to be merged without explicit user approval
- [ ] Confirm correct Supabase project is `ubkwtjyvbdvepzbxoikq`
- [ ] Confirm login parity with web portal
- [ ] Finalize user-approved app icon/splash assets
- [ ] Install/configure `expo-updates`
- [ ] Configure EAS update URL/runtime/channel
- [ ] Add only the approved/recommended native packages
- [ ] Verify Android permissions
- [ ] Verify notification/biometric/media native config if enabled
- [ ] Run App CI
- [ ] Run Mobile CI
- [ ] Only then trigger the explicitly approved baseline APK build
- [ ] Verify OTA works on the installed baseline before calling OTA-first complete

---

## 11. Core release principle

> **Build native capabilities once; iterate product behavior through OTA whenever compatible.**

A future AI agent should not casually create another APK. First determine whether the requested change can ship through EAS Update. Only rebuild the binary when the native runtime actually changes.
