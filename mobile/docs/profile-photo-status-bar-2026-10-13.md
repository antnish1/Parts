# Android Profile photo and status bar — rollout

- Base branch: agent/expo-android-foundation. Runtime remains 0.2.0.
- Uses already configured expo-image-picker (camera/gallery permissions already declared in app.json); no new native package and no APK/AAB build.
- UI: seamless branded status bar, expanded Profile with actual account/role/branch and authorized shortcuts, editable circular camera avatar shown in Profile and all tab headers.
- Storage: new private profile-avatars bucket, 5 MB JPEG limit, RLS owner-folder policies. Apply reviewed migration before publishing OTA. Photo stored at auth.uid()/avatar.jpg; user metadata stores only avatar_path (not a public URL).
- Current Supabase integration could not inspect live bucket/policy state. Review conflicts before applying migration; do not deploy it automatically.
- Verify image picker on installed 0.2.0 binary, crop, preview/cancel, save/remove, replacement cache, sign-out, and different-user isolation. Check actual Android status bar line at device level.
- No user email shown for synthetic @portal.local login addresses. Roles/operations navigation follow roleWorkActions.
- Rollback: revert PR and publish a reversal OTA. For storage rollback, remove only newly introduced policies/bucket after verifying user photos have been migrated or backed up; do not delete photos unexpectedly. No changes to order data.
