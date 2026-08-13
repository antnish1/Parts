const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function write(relativePath, source) {
  fs.writeFileSync(path.join(root, relativePath), source);
}

// Keep the comment count on the list record so both desktop and mobile can render it.
{
  const relativePath = 'src/services/creditDispatch.service.ts';
  let source = read(relativePath);

  if (!source.includes('comment_count?: number;')) {
    const typeAnchor = '  updated_at: string;\n};';
    if (!source.includes(typeAnchor)) throw new Error('CreditDispatchRecord type anchor not found.');
    source = source.replace(typeAnchor, '  updated_at: string;\n  comment_count?: number;\n};');
  }

  if (!source.includes('Credit Dispatch comment count lookup failed.')) {
    const oldFunction = `export async function getCreditDispatches() {\n  const { data, error } = await supabase\n    .from('portal_credit_dispatches')\n    .select('*')\n    .order('created_at', { ascending: false })\n    .limit(300);\n\n  if (error) throw error;\n  return ((data ?? []) as CreditDispatchRecord[]).map(withDerivedRecoveryStatus);\n}`;

    const newFunction = `export async function getCreditDispatches() {\n  const { data, error } = await supabase\n    .from('portal_credit_dispatches')\n    .select('*')\n    .order('created_at', { ascending: false })\n    .limit(300);\n\n  if (error) throw error;\n\n  const rows = ((data ?? []) as CreditDispatchRecord[]).map(withDerivedRecoveryStatus);\n  const dispatchIds = rows.map((row) => row.id);\n  if (!dispatchIds.length) return rows;\n\n  const { data: commentEvents, error: commentError } = await supabase\n    .from('portal_credit_dispatch_events')\n    .select('dispatch_id')\n    .eq('event_type', 'Comment')\n    .in('dispatch_id', dispatchIds);\n\n  if (commentError) {\n    console.warn('Credit Dispatch comment count lookup failed.', commentError.message);\n    return rows.map((row) => ({ ...row, comment_count: 0 }));\n  }\n\n  const commentCounts = new Map<string, number>();\n  for (const event of commentEvents ?? []) {\n    const dispatchId = String(event.dispatch_id ?? '');\n    if (!dispatchId) continue;\n    commentCounts.set(dispatchId, (commentCounts.get(dispatchId) ?? 0) + 1);\n  }\n\n  return rows.map((row) => ({ ...row, comment_count: commentCounts.get(row.id) ?? 0 }));\n}`;

    if (!source.includes(oldFunction)) throw new Error('getCreditDispatches function anchor not found.');
    source = source.replace(oldFunction, newFunction);
  }

  write(relativePath, source);
}

// Render the count beside each dispatch ID. Existing row/card navigation remains unchanged.
{
  const relativePath = 'src/features/credit-dispatch/CreditDispatchListPage.tsx';
  let source = read(relativePath);

  if (!source.includes('Number(row.comment_count ?? 0) > 0')) {
    const target = "{row.dispatch_no ?? 'Pending No.'}";
    const badge = "{row.dispatch_no ?? 'Pending No.'}{Number(row.comment_count ?? 0) > 0 ? <span aria-label={String(row.comment_count) + ' comments'} title={String(row.comment_count) + ' comments'} className=\"ml-2 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 align-middle text-[10px] font-bold leading-none text-white\">{row.comment_count}</span> : null}";
    const occurrences = source.split(target).length - 1;
    if (occurrences < 2) throw new Error(`Expected dispatch ID expressions in mobile and desktop views; found ${occurrences}.`);
    source = source.split(target).join(badge);
  }

  write(relativePath, source);
}

console.log('Credit Dispatch comment count badges applied.');
