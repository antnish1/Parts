# Parts Connect — Android Firebase / FCM launch gate

Prepared 2026-10-17. This is a native **release-build configuration** change, not an OTA-only change.

## Client registration completed

- Dedicated Firebase project: `frontier-parts-connect`.
- Android application ID: `com.frontier.partsconnect` (must match Firebase registration).
- `mobile/google-services.json` contains Firebase **Android client configuration** (public client identifiers/API key, **not** a server private key).
- `mobile/app.json` declares `android.googleServicesFile: "./google-services.json"`.
- Native notification package `expo-notifications` already installed; `PushRegistration` requests permission and registers Expo push tokens with `portal_register_push_device`.
- Existing production Supabase `portal_notifications`, `portal_push_devices`, and `portal_register_push_device` are present. Do not replace Supabase Auth.

## MUST complete before production AAB

- [ ] In Firebase project settings → Cloud Messaging, confirm **Firebase Cloud Messaging API (V1)** is enabled.
- [ ] Create/manage a narrowly scoped **service-account JSON credential** for sending FCM V1 messages. **Never commit this credential, share it in a chat, or include it in an AAB.**
- [ ] Upload that credential directly to Expo/EAS **Android Push Notifications (FCM V1)** credentials for the Parts Connect EAS project. Client `google-services.json` is **not** an FCM server credential.
- [ ] Confirm the Android release signing key / Google Play App Signing setup and immutable package name.
- [ ] Build *one user-approved* test/installable native baseline (only when explicitly requested), with Firebase configuration included; an OTA cannot add Firebase native configuration to an already installed binary.
- [ ] On a real Android device, confirm notification authorization, Expo token registration, device ownership on account switching/logoff, and foreground/background/killed-state delivery.
- [ ] Verify notification-tap navigation and rejection of inaccessible order destinations.
- [ ] Test registration failures, revoked notifications, offline resume, re-install and FCM credential errors.
- [ ] Verify accurate Google Play Data Safety/privacy declarations and generated merged permissions.
- [ ] Confirm all additional **native** capabilities, icon/splash and runtime configuration before Play Store AAB. Avoid speculative location, microphone, SMS or contacts permissions.
- [ ] Verify release runtime version and `production` EAS Update channel. Preview OTA must not reach production releases.

## Release governance

- No APK/AAB is created by this checklist or by the mobile `npm run check` CI task.
- Do not auto-build APK/AAB on merge.
- Future native changes can require another AAB even with OTA; ordinary JS/UI changes should use EAS Update when compatible.
