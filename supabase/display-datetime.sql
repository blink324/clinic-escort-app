alter table appointments
add column if not exists display_datetime text;

update appointments
set display_datetime = to_char(appointment_datetime at time zone 'Asia/Tokyo', 'YYYY-MM-DD"T"HH24:MI')
where display_datetime is null
   or display_datetime = ''
   or display_datetime = to_char((appointment_datetime at time zone 'Asia/Tokyo') + interval '9 hours', 'YYYY-MM-DD"T"HH24:MI');
