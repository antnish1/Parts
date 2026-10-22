-- Create dormant notification jobs. Neither job may execute until explicitly activated.
DO $setup$
DECLARE sender_job bigint; receipt_job bigint;
BEGIN
 IF EXISTS (SELECT 1 FROM cron.job WHERE jobname IN ('parts-notification-dispatch','parts-notification-receipts')) THEN
   RAISE EXCEPTION 'Notification jobs already exist; refusing duplicate scheduler setup';
 END IF;
 sender_job := cron.schedule(
   'parts-notification-dispatch',
   '* * * * *',
   $job$SELECT net.http_post(
     url := 'https://ubkwtjyvbdvepzbxoikq.supabase.co/functions/v1/portal-notification-dispatch',
     headers := jsonb_build_object('Content-Type','application/json',
       'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='notification_dispatch_secret')),
     body := '{}'::jsonb,
     timeout_milliseconds := 15000
   );$job$
 );
 PERFORM cron.alter_job(job_id := sender_job, active := false);
 receipt_job := cron.schedule(
   'parts-notification-receipts',
   '*/2 * * * *',
   $job$SELECT net.http_post(
     url := 'https://ubkwtjyvbdvepzbxoikq.supabase.co/functions/v1/portal-notification-receipts',
     headers := jsonb_build_object('Content-Type','application/json',
       'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='notification_dispatch_secret')),
     body := '{}'::jsonb,
     timeout_milliseconds := 15000
   );$job$
 );
 PERFORM cron.alter_job(job_id := receipt_job, active := false);
END $setup$;
