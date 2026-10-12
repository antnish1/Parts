# Android Home Operations Hub — OTA release

This release records the approved Android Home dashboard redesign from PR #143.

- Target: Expo Android preview channel, runtime 0.2.0.
- Source: `agent/expo-android-foundation`.
- Home changes: prominent Track Orders, operational KPIs, shortcuts, recent orders.
- Delivery: validate through `mobile-ota-publish.yaml` and publish an OTA only; no APK or AAB.
- Reversibility: revert the related mobile UI PR and publish a rollback OTA if necessary.
