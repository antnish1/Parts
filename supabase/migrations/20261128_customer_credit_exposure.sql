-- Include operationally issued pending/correction credit, retain rejected as separate exceptions.
create or replace view public.portal_credit_customer_aging_view with (security_invoker=true) as
 SELECT c.id AS customer_id,
    c.customer_name,
    c.mobile_no,
    c.customer_type,
    c.default_branch,
    c.credit_limit,
    COALESCE(sum(d.balance_amount) FILTER (WHERE d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager')), 0::numeric)::numeric(14,2) AS outstanding,
    COALESCE(sum(d.balance_amount) FILTER (WHERE d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager') AND d.balance_amount > 0::numeric AND ((now() at time zone 'Asia/Kolkata')::date - d.due_date) >= 0 AND ((now() at time zone 'Asia/Kolkata')::date - d.due_date) <= 7), 0::numeric)::numeric(14,2) AS bucket_0_7,
    COALESCE(sum(d.balance_amount) FILTER (WHERE d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager') AND d.balance_amount > 0::numeric AND ((now() at time zone 'Asia/Kolkata')::date - d.due_date) >= 8 AND ((now() at time zone 'Asia/Kolkata')::date - d.due_date) <= 15), 0::numeric)::numeric(14,2) AS bucket_8_15,
    COALESCE(sum(d.balance_amount) FILTER (WHERE d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager') AND d.balance_amount > 0::numeric AND ((now() at time zone 'Asia/Kolkata')::date - d.due_date) >= 16 AND ((now() at time zone 'Asia/Kolkata')::date - d.due_date) <= 30), 0::numeric)::numeric(14,2) AS bucket_16_30,
    COALESCE(sum(d.balance_amount) FILTER (WHERE d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager') AND d.balance_amount > 0::numeric AND ((now() at time zone 'Asia/Kolkata')::date - d.due_date) > 30), 0::numeric)::numeric(14,2) AS bucket_30_plus,
    COALESCE(sum(d.balance_amount) FILTER (WHERE d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager') AND d.balance_amount > 0::numeric AND d.due_date < (now() at time zone 'Asia/Kolkata')::date), 0::numeric)::numeric(14,2) AS overdue,
    max(d.due_date) FILTER (WHERE d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager')) AS latest_due_date,
    portal_credit_customer_risk(COALESCE(sum(d.balance_amount) FILTER (WHERE d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager')), 0::numeric), COALESCE(sum(d.balance_amount) FILTER (WHERE d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager') AND d.balance_amount > 0::numeric AND d.due_date < (now() at time zone 'Asia/Kolkata')::date), 0::numeric), c.credit_limit) AS risk_category
   FROM portal_credit_customers c
     LEFT JOIN portal_credit_dispatches d ON d.customer_id = c.id
  GROUP BY c.id;

create or replace view public.portal_credit_customer_ledger_view with (security_invoker=true) as
 SELECT d.customer_id,
    d.id AS dispatch_id,
    d.document_date AS transaction_date,
    d.created_at AS sort_at,
    'Credit Dispatch'::text AS entry_type,
    COALESCE(d.dispatch_no, d.document_no, 'Credit Dispatch'::text) AS particulars,
    d.document_type,
    d.document_no,
    d.branch,
    d.credit_amount AS debit,
    0::numeric(14,2) AS credit
   FROM portal_credit_dispatches d
  WHERE d.customer_id IS NOT NULL AND d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager')
UNION ALL
 SELECT d.customer_id,
    d.id AS dispatch_id,
    p.received_date AS transaction_date,
    p.created_at AS sort_at,
    'Payment Received'::text AS entry_type,
    COALESCE(p.reference_no, p.payment_mode, 'Payment'::text) AS particulars,
    d.document_type,
    d.document_no,
    d.branch,
    0::numeric(14,2) AS debit,
    p.received_amount AS credit
   FROM portal_credit_dispatch_payments p
     JOIN portal_credit_dispatches d ON d.id = p.dispatch_id
  WHERE d.customer_id IS NOT NULL AND d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager');

create or replace view public.portal_credit_customer_outstanding_view with (security_invoker=true) as
 WITH dispatch_totals AS (
         SELECT portal_credit_dispatches.customer_id,
            COALESCE(sum(portal_credit_dispatches.credit_amount) FILTER (WHERE portal_credit_dispatches.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager')), 0::numeric)::numeric(14,2) AS total_credit,
            COALESCE(sum(portal_credit_dispatches.total_received_amount) FILTER (WHERE portal_credit_dispatches.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager')), 0::numeric)::numeric(14,2) AS total_received,
            COALESCE(sum(portal_credit_dispatches.balance_amount) FILTER (WHERE portal_credit_dispatches.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager')), 0::numeric)::numeric(14,2) AS outstanding,
            COALESCE(sum(portal_credit_dispatches.balance_amount) FILTER (WHERE portal_credit_dispatches.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager') AND portal_credit_dispatches.due_date < (now() at time zone 'Asia/Kolkata')::date), 0::numeric)::numeric(14,2) AS overdue,
            max(portal_credit_dispatches.document_date) FILTER (WHERE portal_credit_dispatches.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager')) AS last_credit_date
           FROM portal_credit_dispatches
          WHERE portal_credit_dispatches.customer_id IS NOT NULL
          GROUP BY portal_credit_dispatches.customer_id
        ), payment_totals AS (
         SELECT d.customer_id,
            max(p.received_date) AS last_payment_date
           FROM portal_credit_dispatch_payments p
             JOIN portal_credit_dispatches d ON d.id = p.dispatch_id
          WHERE d.customer_id IS NOT NULL
          GROUP BY d.customer_id
        )
 SELECT c.id AS customer_id,
    c.customer_name,
    c.mobile_no,
    c.customer_type,
    c.default_branch,
    c.credit_limit,
    COALESCE(dt.total_credit, 0::numeric)::numeric(14,2) AS total_credit,
    COALESCE(dt.total_received, 0::numeric)::numeric(14,2) AS total_received,
    COALESCE(dt.outstanding, 0::numeric)::numeric(14,2) AS outstanding,
    COALESCE(dt.overdue, 0::numeric)::numeric(14,2) AS overdue,
    dt.last_credit_date,
    pt.last_payment_date,
    portal_credit_customer_risk(COALESCE(dt.outstanding, 0::numeric), COALESCE(dt.overdue, 0::numeric), c.credit_limit) AS risk_category,
    (select count(*) from public.portal_credit_dispatches x where x.customer_id=c.id and x.approval_status <> 'Draft') as total_dispatches,
    (select count(*) from public.portal_credit_dispatches x where x.customer_id=c.id and x.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager') and x.balance_amount>0) as open_dispatches,
    coalesce((select sum(x.balance_amount) from public.portal_credit_dispatches x where x.customer_id=c.id and x.approval_status in ('Pending Accounts Approval','Pending Manager Approval')),0)::numeric(14,2) as pending_approval_amount,
    coalesce((select sum(x.balance_amount) from public.portal_credit_dispatches x where x.customer_id=c.id and x.approval_status in ('Correction Requested by Accounts','Correction Requested by Manager')),0)::numeric(14,2) as correction_amount,
    coalesce((select sum(x.balance_amount) from public.portal_credit_dispatches x where x.customer_id=c.id and x.approval_status in ('Rejected by Accounts','Rejected by Manager')),0)::numeric(14,2) as rejected_amount,
    c.business_partner_code,
    c.gst_no
   FROM portal_credit_customers c
     LEFT JOIN dispatch_totals dt ON dt.customer_id = c.id
     LEFT JOIN payment_totals pt ON pt.customer_id = c.id;


-- Branch filter uses actual dispatch office, not customer default office.
create or replace view public.portal_credit_customer_office_exposure_view with (security_invoker=true) as
select c.id as customer_id,c.customer_name,c.mobile_no,c.customer_type,c.default_branch,c.credit_limit,
coalesce(sum(d.credit_amount) filter(where d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager')),0)::numeric(14,2) as total_credit,
coalesce(sum(d.total_received_amount) filter(where d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager')),0)::numeric(14,2) as total_received,
coalesce(sum(d.balance_amount) filter(where d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager')),0)::numeric(14,2) as outstanding,
coalesce(sum(d.balance_amount) filter(where d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager') and d.due_date<(now() at time zone 'Asia/Kolkata')::date),0)::numeric(14,2) as overdue,
max(d.document_date) filter(where d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager')) as last_credit_date,
null::date as last_payment_date,
public.portal_credit_customer_risk(coalesce(sum(d.balance_amount) filter(where d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager')),0),coalesce(sum(d.balance_amount) filter(where d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager') and d.due_date<(now() at time zone 'Asia/Kolkata')::date),0),c.credit_limit) as risk_category,
count(*) filter(where d.approval_status<>'Draft') as total_dispatches,
count(*) filter(where d.approval_status in ('Approved','Pending Accounts Approval','Pending Manager Approval','Correction Requested by Accounts','Correction Requested by Manager') and d.balance_amount>0) as open_dispatches,
coalesce(sum(d.balance_amount) filter(where d.approval_status in ('Pending Accounts Approval','Pending Manager Approval')),0)::numeric(14,2) as pending_approval_amount,
coalesce(sum(d.balance_amount) filter(where d.approval_status in ('Correction Requested by Accounts','Correction Requested by Manager')),0)::numeric(14,2) as correction_amount,
coalesce(sum(d.balance_amount) filter(where d.approval_status in ('Rejected by Accounts','Rejected by Manager')),0)::numeric(14,2) as rejected_amount,
c.business_partner_code,c.gst_no,d.branch as office
from public.portal_credit_customers c join public.portal_credit_dispatches d on d.customer_id=c.id
where d.approval_status<>'Draft'
group by c.id,d.branch;
revoke all on public.portal_credit_customer_office_exposure_view from public,anon;
grant select on public.portal_credit_customer_office_exposure_view to authenticated;
