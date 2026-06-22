-- Per-type notification opt-outs + a master switch.
-- Per-user flags live on notification_preferences; daily + recap stay
-- household-level (one suggestion per household) on household_notification_settings.
-- notifications_enabled is the per-user master: when false the user gets nothing.

alter table public.notification_preferences
  add column if not exists notifications_enabled boolean not null default true,
  add column if not exists tips_enabled boolean not null default true,
  add column if not exists reengagement_enabled boolean not null default true;

alter table public.household_notification_settings
  add column if not exists recap_enabled boolean not null default true;
