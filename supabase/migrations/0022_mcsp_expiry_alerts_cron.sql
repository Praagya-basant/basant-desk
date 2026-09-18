-- 0022_mcsp_expiry_alerts_cron.sql
--
-- Daily pg_cron job that hits the mcsp-expiry-alerts edge function at
-- 3:30 AM UTC (9:00 AM IST), which finds every sample/panel expiring in
-- exactly 30 or 15 days and fires an mcsp-send-email 'expiry_alert' for each.
--
-- Authorization uses the project's public anon key, not the service_role
-- key: edge functions with verify_jwt=true only need ANY validly-signed
-- Supabase JWT to pass the platform gateway check (the anon key qualifies,
-- and is already public — it ships in every browser bundle via
-- VITE_SUPABASE_ANON_KEY). mcsp-expiry-alerts does its actual privileged
-- DB work with SUPABASE_SERVICE_ROLE_KEY, which the platform injects into
-- every edge function automatically — no manual secret configuration
-- needed, and nothing sensitive is checked into this file. (This
-- intentionally differs from the service_role-GUC pattern sometimes shown
-- in Supabase examples: `app.settings.service_role_key` was never set on
-- this database, and setting it would mean putting the real service role
-- key in a git-tracked migration — worth avoiding.)
--
-- cron.schedule() with a job name that already exists updates it in place,
-- so this is safe to re-run.

select cron.schedule(
  'mcsp-expiry-alerts-daily',
  '30 3 * * *',
  $$select net.http_post(
    url := 'https://fwedvwhjscdrvgjsdzyk.supabase.co/functions/v1/mcsp-expiry-alerts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3ZWR2d2hqc2NkcnZnanNkenlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MTMzNTgsImV4cCI6MjEwMjA4OTM1OH0.B4AHtEv5FqW-4gIwzNZo-yerj5hMt1ryCfJXwTGYdC0',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )$$
);
