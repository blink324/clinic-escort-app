drop policy if exists "Members can read their patient groups" on patient_groups;
drop policy if exists "Admins can update patient groups" on patient_groups;
drop policy if exists "Members can read group members" on group_members;
drop policy if exists "Members can read appointments" on appointments;
drop policy if exists "Members can manage appointments" on appointments;
drop policy if exists "Members can manage companions" on appointment_companions;
drop policy if exists "Members can read reminder settings" on reminder_settings;
drop policy if exists "Members can manage reminder settings" on reminder_settings;

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

create policy "Admins can update patient groups"
  on patient_groups for update
  using (public.is_group_admin(id));

create policy "Members can read group members"
  on group_members for select
  using (user_id = auth.uid() or public.is_group_member(group_id));

create policy "Members can read appointments"
  on appointments for select
  using (public.is_group_member(group_id));

create policy "Members can manage appointments"
  on appointments for all
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

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

create policy "Members can read reminder settings"
  on reminder_settings for select
  using (
    exists (
      select 1 from appointments
      where appointments.id = reminder_settings.appointment_id
      and public.is_group_member(appointments.group_id)
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
