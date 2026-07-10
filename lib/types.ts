export type AppointmentStatus = "upcoming" | "completed" | "missed";
export type MemberRole = "admin" | "member" | "viewer";
export type ReminderType = "one_week_before" | "one_day_before" | "same_day_morning";

export type AuthUser = {
  id: string;
  email: string;
  display_name: string;
};

export type PatientGroup = {
  id: string;
  owner_user_id: string;
  patient_name: string;
  patient_icon?: string | null;
  relation: string;
  group_name: string;
  memo: string;
  invite_token: string;
  created_at: string;
  updated_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  role: MemberRole;
  contact: string;
  created_at: string;
};

export type Appointment = {
  id: string;
  group_id: string;
  hospital_name: string;
  department: string;
  appointment_datetime: string;
  display_datetime?: string | null;
  items_to_bring: string;
  memo: string;
  reservation_image_url?: string;
  share_token: string;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
};

export type AppointmentCompanion = {
  id: string;
  appointment_id: string;
  user_id: string | null;
  display_name: string;
  contact: string;
  comment: string;
  created_at: string;
};

export type ReminderSetting = {
  id: string;
  appointment_id: string;
  reminder_type: ReminderType;
  enabled: boolean;
  remind_at: string;
  created_at: string;
};

export type AppointmentInput = {
  group_id: string;
  hospital_name: string;
  department: string;
  appointment_datetime: string;
  display_datetime?: string;
  items_to_bring: string;
  memo: string;
  reservation_image_url?: string;
  reminders: Record<ReminderType, boolean>;
};

export type GroupInput = {
  patient_name: string;
  patient_icon?: string;
  relation: string;
  group_name: string;
  memo: string;
};

export type AppointmentView = Appointment & {
  group: PatientGroup;
  companion?: AppointmentCompanion;
  reminders: ReminderSetting[];
};
