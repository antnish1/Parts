# Android Home redesign handoff

Target branch: agent/expo-android-foundation. Mobile UI only, not web main.

Changes: branded header, compact real-data KPIs, prominent Track Orders directly below the KPIs, role-aware shortcuts, compact recent orders, final order numbers, and prominent manager Track Orders. Existing Accounts Home and bottom tabs preserved.

Verification: cd mobile && npm ci && npm run check. Test role permissions and navigation, narrow Android display, and loading/empty/error states. Track Orders opens /orders with existing search and filters.

Rollback: revert PR from mobile branch and publish reversal OTA only after approval. No backend, database, APK or AAB modifications.