create table if not exists patient_groups (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  patient_name text not null,
  relation text,
  group_name text not null,
  memo text,
  invite_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references patient_groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  contact text,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references patient_groups(id) on delete cascade,
  hospital_name text not null,
  department text not null,
  appointment_datetime timestamptz not null,
  items_to_bring text,
  memo text,
  reservation_image_url text,
  share_token text not null unique,
  status text not null default 'upcoming' check (status in ('upcoming', 'completed', 'missed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists appointment_companions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  contact text,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists reminder_settings (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('one_week_before', 'one_day_before', 'same_day_morning')),
  enabled boolean not null default true,
  remind_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (appointment_id, reminder_type)
);

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

create index if not exists patient_groups_invite_token_idx on patient_groups(invite_token);
create index if not exists group_members_user_idx on group_members(user_id);
create index if not exists appointments_group_datetime_idx on appointments(group_id, appointment_datetime);
create index if not exists appointments_share_token_idx on appointments(share_token);
create index if not exists appointment_companions_appointment_idx on appointment_companions(appointment_id);
create index if not exists reminder_settings_appointment_idx on reminder_settings(appointment_id);
create index if not exists reminder_settings_due_idx on reminder_settings(enabled, remind_at);
create index if not exists notification_logs_appointment_idx on notification_logs(appointment_id);
create unique index if not exists notification_logs_once_per_reminder_recipient_idx
  on notification_logs(reminder_setting_id, recipient_user_id, channel)
  where reminder_setting_id is not null and recipient_user_id is not null;
create unique index if not exists appointment_companions_one_per_appointment_idx
  on appointment_companions(appointment_id);

alter table patient_groups enable row level security;
alter table group_members enable row level security;
alter table appointments enable row level security;
alter table appointment_companions enable row level security;
alter table reminder_settings enable row level security;
alter table notification_logs enable row level security;

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from group_members
    where group_members.group_id = target_group_id
    and group_members.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from group_members
    where group_members.group_id = target_group_id
    and group_members.user_id = auth.uid()
    and group_members.role = 'admin'
  );
$$;

create policy "Members can read their patient groups"
  on patient_groups for select
  using (owner_user_id = auth.uid() or public.is_group_member(id));

create policy "Authenticated users can open invite links"
  on patient_groups for select
  using (auth.role() = 'authenticated' and invite_token is not null);

create policy "Shared appointment viewers can read patient group summary"
  on patient_groups for select
  using (
    exists (
      select 1 from appointments
      where appointments.group_id = patient_groups.id
      and appointments.share_token is not null
    )
  );

create policy "Users can create patient groups"
  on patient_groups for insert
  with check (owner_user_id = auth.uid());

create policy "Admins can update patient groups"
  on patient_groups for update
  using (public.is_group_admin(id));

create policy "Members can read group members"
  on group_members for select
  using (user_id = auth.uid() or public.is_group_member(group_id));

create policy "Users can join groups"
  on group_members for insert
  with check (user_id = auth.uid());

create policy "Members can read appointments"
  on appointments for select
  using (public.is_group_member(group_id));

create policy "Members can manage appointments"
  on appointments for all
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "Shared appointment pages can read by token API"
  on appointments for select
  using (share_token is not null);

create policy "Members can manage companions"
  on appointment_companions for all
  using (
    exists (
      select 1 from appointments
      where appointments.id = appointment_companions.appointment_id
      and public.is_group_member(appointments.group_id)
    )
  )
  with check (
    user_id is null
    or user_id = auth.uid()
    or exists (
      select 1 from appointments
      where appointments.id = appointment_companions.appointment_id
      and public.is_group_member(appointments.group_id)
    )
  );

create policy "Shared appointment viewers can read companions"
  on appointment_companions for select
  using (
    exists (
      select 1 from appointments
      where appointments.id = appointment_companions.appointment_id
      and appointments.share_token is not null
    )
  );

create policy "Shared appointment viewers can add guest companions"
  on appointment_companions for insert
  with check (
    (user_id is null or user_id = auth.uid())
    and exists (
      select 1 from appointments
      where appointments.id = appointment_companions.appointment_id
      and appointments.share_token is not null
    )
  );

create policy "Members can read reminder settings"
  on reminder_settings for select
  using (
    exists (
      select 1 from appointments
      where appointments.id = reminder_settings.appointment_id
      and public.is_group_member(appointments.group_id)
    )
  );

create policy "Shared appointment viewers can read reminder settings"
  on reminder_settings for select
  using (
    exists (
      select 1 from appointments
      where appointments.id = reminder_settings.appointment_id
      and appointments.share_token is not null
    )
  );

create policy "Members can manage reminder settings"
  on reminder_settings for all
  using (
    exists (
      select 1 from appointments
      where appointments.id = reminder_settings.appointment_id
      and public.is_group_member(appointments.group_id)
    )
  )
  with check (
    exists (
      select 1 from appointments
      where appointments.id = reminder_settings.appointment_id
      and public.is_group_member(appointments.group_id)
    )
  );

create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reminder_one_day_before_time text not null default '09:00',
  reminder_same_day_morning_time text not null default '07:30',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_preferences enable row level security;

drop policy if exists "Users can read their preferences" on user_preferences;
drop policy if exists "Users can insert their preferences" on user_preferences;
drop policy if exists "Users can update their preferences" on user_preferences;
drop policy if exists "Users can delete their preferences" on user_preferences;

create policy "Users can read their preferences"
  on user_preferences for select
  using (user_id = auth.uid());

create policy "Users can insert their preferences"
  on user_preferences for insert
  with check (user_id = auth.uid());

create policy "Users can update their preferences"
  on user_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their preferences"
  on user_preferences for delete
  using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('reservation-images', 'reservation-images', false)
on conflict (id) do nothing;

create policy "Members can upload reservation images"
  on storage.objects for insert
  with check (
    bucket_id = 'reservation-images'
    and auth.role() = 'authenticated'
  );

create policy "Members can read reservation images"
  on storage.objects for select
  using (
    bucket_id = 'reservation-images'
    and auth.role() = 'authenticated'
  );

create policy "Members can update reservation images"
  on storage.objects for update
  using (
    bucket_id = 'reservation-images'
    and auth.role() = 'authenticated'
  );
