# Optional comment at new order submission — 2026-10-16

## User-facing behavior

- All eligible New Order users (branch, admin, super, manager, developer) see a **compact, light, clearly legible** multiline **Comment for this order — Optional** field **directly above the Parts Builder table**, below the Parts Builder title. On wider screens, the heading and comment input share a row; on narrow screens they stack. It does not block blank submissions. The textarea starts at approximately 46px high and remains vertically resizable. Keep the label dark on the light background and avoid bright gold highlighting or extra explanatory text.
- Up to 2,000 characters. Whitespace-only means no comment.
- An entered comment becomes an ordinary row in `portal_order_comments` with `comment_type = 'user'`, `author_id = the creating portal profile id`, `order_id = new order.id`. The existing Comments & Order Activity, author display, comment counts, and notification consumers continue to work as they do for any other comment.
- No new table, statuses, migrations, role grants, or read policies.

## Safe delivery and partial failure

1. `create-order-action` authenticates and authorizes the creator as before, creates the order and item rows, then inserts the optional comment with the **same** portal profile id. It acknowledges with `initial_comment_saved`; this is true on success, false if the comment write fails, and null when no comment is supplied.
2. Once order creation is successful, failure to insert a comment MUST NOT return a generic `ORDER_CREATE_FAILED` that prompts duplicate submission. Edge logs the failure without logging comment body.
3. Frontend `ensureInitialOrderComment` only calls existing `addTestOrderComment` when a nonblank comment was not acknowledged as saved (including older Edge Function deployment). The client reuses the existing authenticated RLS checks, duplicate prevention, and comment display flow; it does not create another order.
4. If both insertion paths fail, the **Order Created** summary shows a warning with original text to copy into Order Details. It expressly warns not to resubmit the order. Clearing comment/form happens only after order creation succeeds.
5. Deploy the Edge Function `create-order-action` explicitly after merging; updating its repo source alone does not deploy it. The frontend-first fallback allows the UI to work before that deployment. Do not create an APK/AAB/OTA or run DB writes just for testing.

## Verification checklist

- App CI build and tests, including optional blank, server-success (no duplicate), old-function fallback, insert-failure fallback, and warning.
- Browser manual checks in desktop/mobile for branch + an eligible non-branch creator.
- Test blank comment: order succeeds; no comment created.
- Test filled comment: one normal user comment, correct author, same order, count and activity visible.
- Test full 2000-character comment and multiline/mobile readability.
- Verify missing profile or user with no role cannot bypass `create-order-action` authorization.
- After deploying function, verify both insertion paths do not double-post, including success summary.
