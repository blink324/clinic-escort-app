drop policy if exists "Admins can delete patient groups" on patient_groups;
drop policy if exists "Users can leave groups" on group_members;
drop policy if exists "Users can delete their LINE connection" on line_connections;

create policy "Admins can delete patient groups"
  on patient_groups for delete
  using (public.is_group_admin(id));

create policy "Users can leave groups"
  on group_members for delete
  using (user_id = auth.uid());

create policy "Users can delete their LINE connection"
  on line_connections for delete
  using (user_id = auth.uid());
