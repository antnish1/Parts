/**
 * An order has already been created by the time this helper runs.
 * Check the Edge Function's acknowledgement and retry a missing initial comment
 * through the existing authenticated comment flow (e.g. frontend deployed first).
 * A comment failure must not cause order creation to be retried.
 */
export async function ensureInitialOrderComment(
  orderId: string,
  rawComment: string,
  savedByServer: boolean | null,
  postComment: (orderId: string, comment: string) => Promise<unknown>,
): Promise<{ commentSaved: boolean | null; commentWarning: string | null }> {
  const comment = rawComment.trim();
  if (!comment) return { commentSaved: null, commentWarning: null };
  if (savedByServer === true) return { commentSaved: true, commentWarning: null };

  try {
    await postComment(orderId, comment);
    return { commentSaved: true, commentWarning: null };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Comment posting failed.';
    return { commentSaved: false, commentWarning: reason };
  }
}
