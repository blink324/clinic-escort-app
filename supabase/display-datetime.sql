alter table appointments
add column if not exists display_datetime text;

update appointments
set display_datetime = to_char(appointment_datetime at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI')
where display_datetime is null
   or display_datetime = '';
