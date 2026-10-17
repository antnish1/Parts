import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../../supabase/migrations/20261017_push_delivery_queue.sql',import.meta.url),'utf8');
const rules = readFileSync(new URL('../../../supabase/migrations/20261017_notification_recipient_rules.sql',import.meta.url),'utf8');
const sender = readFileSync(new URL('../../../supabase/functions/portal-notification-dispatch/index.ts',import.meta.url),'utf8');
const receipts = readFileSync(new URL('../../../supabase/functions/portal-notification-receipts/index.ts',import.meta.url),'utf8');

describe('notification production safety contracts', () => {
 it('keeps history intact and prevents initial push flood',()=>{
  expect(migration).toContain('n.created_at>=runtime.enabled_after');
  expect(migration).toContain('and not exists (');
  expect(migration).not.toMatch(/truncate\s+.*portal_notifications/i);
  expect(rules).toContain('on conflict do nothing');
 });
 it('leases only unclaimed due work and restricts table access',()=>{
  expect(migration).toContain('for update skip locked');
  expect(migration).toContain("interval '2 minutes'");
  expect(migration).toContain('q.lease_token');
  expect(migration).toContain('service_role only');
  expect(migration).toContain('revoke all on public.portal_push_deliveries from anon,authenticated');
  expect(migration).toContain('unique(notification_id,device_id)');
 });
 it('authenticates both server operations and does not embed a service key',()=>{
  for(const script of [sender,receipts]){
   expect(script).toContain("Deno.env.get('NOTIFICATION_DISPATCH_SECRET')");
   expect(script).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
   expect(script).toContain('Unauthorized');
   expect(script).not.toMatch(/sb_secret_|eyJhbGciOi/);
  }
 });
 it('records Expo tickets separately from final delivery receipts',()=>{
  expect(sender).toContain("status='ticket_ok'");
  expect(sender).toContain("portal_push_claim");
  expect(sender).toContain("portal_push_finish");
  expect(receipts).toContain("getReceipts");
  expect(receipts).toContain("receipt.status==='ok'");
  expect(receipts).toContain("'invalid_token'");
  expect(receipts).toContain("eq('id',item.device_id)");
 });
 it('enforces assigned order users and excludes the original actor for event notices',()=>{
  expect(rules).toContain('p.id=o.approver_id');
  expect(rules).toContain('p.id=o.employee_id');
  expect(rules).toContain('p.id is distinct from new.actor_id');
  expect(rules).toContain('p.id is distinct from new.author_id');
 });
});

describe('operational notification coverage contracts',()=>{
 const ops=readFileSync(new URL('../../../supabase/migrations/20261017_operational_notification_rules.sql',import.meta.url),'utf8');
 it('binds credit dispatch notifications to event transitions and current status',()=>{
  expect(ops).toContain('after insert on public.portal_credit_dispatch_events');
  expect(ops).toContain("d.approval_status='Pending Manager Approval'");
  expect(ops).toContain("d.approval_status='Pending Accounts Approval'");
  expect(ops).toContain("p.id=d.created_by");
  expect(ops).toContain("'credit_dispatch'");
 });
 it('routes TA/DA work to HQ manager, Accounts and original branch user',()=>{
  expect(ops).toContain('after insert on public.portal_tada_events');
  expect(ops).toContain("'AWAITING_HQ_RECEIPT'");
  expect(ops).toContain("'AWAITING_ACCOUNTS_RECEIPT'");
  expect(ops).toContain("p.id=d.created_by");
  expect(ops).toContain("'tada'");
 });
 it('uses only real installation statuses and never creates entries from client UI',()=>{
  expect(ops).toContain('after update of status on public.portal_installation_entries');
  expect(ops).toContain("'ACCEPTANCE_PENDING'");
  expect(ops).toContain("'ACCEPTED'");
  expect(ops).not.toContain("'COMPLETED'");
  expect(ops).toContain("'installation'");
 });
});
