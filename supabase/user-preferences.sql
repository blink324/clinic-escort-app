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
