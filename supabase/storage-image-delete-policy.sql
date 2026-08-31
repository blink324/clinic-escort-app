drop policy if exists "Members can delete reservation images" on storage.objects;

create policy "Members can delete reservation images"
  on storage.objects for delete
  using (
    bucket_id = 'reservation-images'
    and exists (
      select 1
      from appointments
      where appointments.id::text = split_part(storage.objects.name, '/', 2)
      and public.is_group_member(appointments.group_id)
    )
  );
