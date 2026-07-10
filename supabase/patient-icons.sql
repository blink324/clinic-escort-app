alter table patient_groups
add column if not exists patient_icon text default '👤';

update patient_groups
set patient_icon = '👤'
where patient_icon is null
   or patient_icon = '';
