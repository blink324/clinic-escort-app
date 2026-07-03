create table if not exists notification_logs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  reminder_setting_id uuid references reminder_settings(id) on delete cascade,
  notification_type text not null check (
    notification_type in (
      'reminder_one_week_before',
      'reminder_one_day_before',
      'reminder_same_day_morning',
      'companion_assigned',
      'companion_removed'
    )
  ),
  channel text not null default 'line' check (channel in ('line')),
  recipient_user_id uuid references auth.users(id) on delete set null,
  line_user_id text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists reminder_settings_due_idx on reminder_settings(enabled, remind_at);
create index if not exists notification_logs_appointment_idx on notification_logs(appointment_id);
create unique index if not exists notification_logs_once_per_reminder_recipient_idx
  on notification_logs(reminder_setting_id, recipient_user_id, channel)
  where reminder_setting_id is not null and recipient_user_id is not null;

alter table notification_logs enable row level security;
