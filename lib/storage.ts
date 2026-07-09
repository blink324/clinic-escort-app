"use client";

import { reservationBucket, supabase } from "@/lib/supabase";
import { toStorageDateTime } from "@/lib/datetime";
import type {
  Appointment,
  AppointmentCompanion,
  AppointmentInput,
  AppointmentStatus,
  AppointmentView,
  AuthUser,
  GroupInput,
  GroupMember,
  PatientGroup,
  ReminderSetting,
  ReminderType
} from "@/lib/types";

const USER_KEY = "escort-care-current-user";
const GROUPS_KEY = "escort-care-groups";
const MEMBERS_KEY = "escort-care-members";
const APPOINTMENTS_KEY = "escort-care-appointments";
const COMPANIONS_KEY = "escort-care-companions";
const REMINDERS_KEY = "escort-care-reminders";
const REMINDER_TIME_SETTINGS_KEY = "tsukisoi-reminder-time-settings";

export type ReminderTimeSettings = {
  one_day_before: string;
  same_day_morning: string;
};

const defaultReminderTimeSettings: ReminderTimeSettings = {
  one_day_before: "09:00",
  same_day_morning: "07:30"
};

const reminderLabels: Record<ReminderType, string> = {
  one_week_before: "1週間前",
  one_day_before: "前日",
  same_day_morning: "当日朝"
};

const now = () => new Date().toISOString();

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function createToken() {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now()}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getReminderTimeSettings() {
  return readJson<ReminderTimeSettings>(REMINDER_TIME_SETTINGS_KEY, defaultReminderTimeSettings);
}

export function saveReminderTimeSettings(settings: ReminderTimeSettings) {
  const next = {
    one_day_before: settings.one_day_before || defaultReminderTimeSettings.one_day_before,
    same_day_morning: settings.same_day_morning || defaultReminderTimeSettings.same_day_morning
  };
  writeJson(REMINDER_TIME_SETTINGS_KEY, next);
  return next;
}

export async function getActiveReminderTimeSettings() {
  const localSettings = getReminderTimeSettings();
  const user = getCurrentUser();
  if (!supabase || !user) return localSettings;

  const { data, error } = await supabase
    .from("user_preferences")
    .select("reminder_one_day_before_time, reminder_same_day_morning_time")
    .eq("user_id", user.id)
    .maybeSingle<{
      reminder_one_day_before_time: string | null;
      reminder_same_day_morning_time: string | null;
    }>();

  if (error || !data) return localSettings;

  return saveReminderTimeSettings({
    one_day_before: data.reminder_one_day_before_time || localSettings.one_day_before,
    same_day_morning: data.reminder_same_day_morning_time || localSettings.same_day_morning
  });
}

export async function saveActiveReminderTimeSettings(settings: ReminderTimeSettings) {
  const next = saveReminderTimeSettings(settings);
  const user = getCurrentUser();
  if (!supabase || !user) return next;

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      reminder_one_day_before_time: next.one_day_before,
      reminder_same_day_morning_time: next.same_day_morning,
      updated_at: now()
    },
    { onConflict: "user_id" }
  );
  throwIfError(error);
  return next;
}

function applyTime(date: Date, timeValue: string) {
  const [hour, minute] = timeValue.split(":").map((value) => Number(value));
  date.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
}

function reminderDate(type: ReminderType, appointmentDatetime: string, timeSettings: ReminderTimeSettings) {
  const date = new Date(appointmentDatetime);
  if (type === "one_week_before") date.setDate(date.getDate() - 7);
  if (type === "one_day_before") {
    date.setDate(date.getDate() - 1);
    applyTime(date, timeSettings.one_day_before);
  }
  if (type === "same_day_morning") applyTime(date, timeSettings.same_day_morning);
  return date.toISOString();
}

function requireSupabase() {
  if (!supabase) throw new Error("Supabaseの環境変数が設定されていません");
  return supabase;
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function dataUrlToFile(dataUrl: string, fallbackName: string) {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
  const binary = atob(body);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new File([bytes], fallbackName, { type: mime });
}

async function signedImageUrl(pathOrUrl?: string) {
  if (!pathOrUrl || pathOrUrl.startsWith("data:") || pathOrUrl.startsWith("http")) return pathOrUrl;
  if (!supabase) return pathOrUrl;
  const { data } = await supabase.storage.from(reservationBucket).createSignedUrl(pathOrUrl, 60 * 60 * 24 * 30);
  return data?.signedUrl || pathOrUrl;
}

async function uploadReservationImage(appointmentId: string, image?: string) {
  if (!image || !image.startsWith("data:") || !supabase) return image || "";
  const file = dataUrlToFile(image, `${appointmentId}.jpg`);
  const path = `appointments/${appointmentId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from(reservationBucket).upload(path, file, { upsert: true });
  throwIfError(error);
  return path;
}

export function getCurrentUser() {
  return readJson<AuthUser | null>(USER_KEY, null);
}

export function setCurrentUser(user: AuthUser) {
  writeJson(USER_KEY, user);
}

export function signInDemo(email: string, displayName: string) {
  const user: AuthUser = {
    id: createId("user"),
    email,
    display_name: displayName || email.split("@")[0] || "自分"
  };
  setCurrentUser(user);
  seedDemoData(user);
  return user;
}

export function signOutLocal() {
  window.localStorage.removeItem(USER_KEY);
}

export async function updateCurrentUserName(displayName: string) {
  const user = getCurrentUser();
  const nextName = displayName.trim();
  if (!user) throw new Error("ログインが必要です");
  if (!nextName) throw new Error("名前を入力してください");

  const nextUser = { ...user, display_name: nextName };
  setCurrentUser(nextUser);

  if (!supabase) {
    const members = readJson<GroupMember[]>(MEMBERS_KEY, []).map((member) =>
      member.user_id === user.id ? { ...member, display_name: nextName, contact: user.email } : member
    );
    const companions = readJson<AppointmentCompanion[]>(COMPANIONS_KEY, []).map((companion) =>
      companion.user_id === user.id ? { ...companion, display_name: nextName, contact: user.email } : companion
    );
    writeJson(MEMBERS_KEY, members);
    writeJson(COMPANIONS_KEY, companions);
    return nextUser;
  }

  const { error: memberError } = await supabase
    .from("group_members")
    .update({ display_name: nextName, contact: user.email })
    .eq("user_id", user.id);
  throwIfError(memberError);

  const { error: companionError } = await supabase
    .from("appointment_companions")
    .update({ display_name: nextName, contact: user.email })
    .eq("user_id", user.id);
  throwIfError(companionError);

  await supabase
    .from("line_connections")
    .update({ display_name: nextName, updated_at: now() })
    .eq("user_id", user.id);

  return nextUser;
}

async function localGroups() {
  const user = getCurrentUser();
  if (!user) return [];
  const groups = readJson<PatientGroup[]>(GROUPS_KEY, []);
  const memberships = readJson<GroupMember[]>(MEMBERS_KEY, []);
  const groupIds = memberships.filter((member) => member.user_id === user.id).map((member) => member.group_id);
  return groups.filter((group) => groupIds.includes(group.id));
}

export async function getGroups() {
  const user = getCurrentUser();
  if (!user) return [];
  if (!supabase) return localGroups();

  const { data: memberships, error: memberError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id);
  throwIfError(memberError);

  const groupIds = Array.from(new Set((memberships || []).map((member) => member.group_id)));
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase
    .from("patient_groups")
    .select("*")
    .in("id", groupIds)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return (data || []) as PatientGroup[];
}

export async function getAllGroupsUnsafe() {
  if (!supabase) return readJson<PatientGroup[]>(GROUPS_KEY, []);
  const { data, error } = await supabase.from("patient_groups").select("*");
  throwIfError(error);
  return (data || []) as PatientGroup[];
}

export async function getGroup(id: string) {
  const groups = await getGroups();
  return groups.find((group) => group.id === id);
}

export async function getGroupByInviteToken(token: string) {
  if (!supabase) {
    return readJson<PatientGroup[]>(GROUPS_KEY, []).find((group) => group.invite_token === token);
  }
  const { data, error } = await supabase
    .from("patient_groups")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();
  throwIfError(error);
  return data as PatientGroup | null;
}

export async function getGroupMembers(groupId: string) {
  if (!supabase) {
    return readJson<GroupMember[]>(MEMBERS_KEY, []).filter((member) => member.group_id === groupId);
  }
  const { data, error } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });
  throwIfError(error);
  return (data || []) as GroupMember[];
}

export async function createGroup(input: GroupInput) {
  const user = getCurrentUser();
  if (!user) throw new Error("ログインが必要です");
  if (!supabase) return createLocalGroup(input, user);

  const { data: group, error: groupError } = await supabase
    .from("patient_groups")
    .insert({
      owner_user_id: user.id,
      patient_name: input.patient_name,
      relation: input.relation,
      group_name: input.group_name || `${input.patient_name}の共有先`,
      memo: input.memo,
      invite_token: createToken()
    })
    .select("*")
    .single();
  throwIfError(groupError);

  const { error: memberError } = await supabase.from("group_members").insert({
    group_id: group.id,
    user_id: user.id,
    display_name: user.display_name,
    role: "admin",
    contact: user.email
  });
  throwIfError(memberError);

  return group as PatientGroup;
}

export async function updateGroup(
  id: string,
  input: Pick<GroupInput, "patient_name" | "group_name" | "memo">
) {
  const patientName = input.patient_name.trim();
  const groupName = input.group_name.trim();
  if (!patientName) throw new Error("患者名を入力してください");
  if (!groupName) throw new Error("共有先の名前を入力してください");

  if (!supabase) {
    const updated = readJson<PatientGroup[]>(GROUPS_KEY, []).map((group) =>
      group.id === id
        ? {
            ...group,
            patient_name: patientName,
            group_name: groupName,
            memo: input.memo,
            updated_at: now()
          }
        : group
    );
    writeJson(GROUPS_KEY, updated);
    return updated.find((group) => group.id === id);
  }

  const { data, error } = await supabase
    .from("patient_groups")
    .update({
      patient_name: patientName,
      group_name: groupName,
      memo: input.memo
    })
    .eq("id", id)
    .select("*")
    .single();
  throwIfError(error);
  return data as PatientGroup;
}

export async function regenerateGroupInviteToken(id: string) {
  const inviteToken = createToken();

  if (!supabase) {
    const updated = readJson<PatientGroup[]>(GROUPS_KEY, []).map((group) =>
      group.id === id ? { ...group, invite_token: inviteToken, updated_at: now() } : group
    );
    writeJson(GROUPS_KEY, updated);
    return updated.find((group) => group.id === id);
  }

  const { data, error } = await supabase
    .from("patient_groups")
    .update({ invite_token: inviteToken, updated_at: now() })
    .eq("id", id)
    .select("*")
    .single();
  throwIfError(error);
  return data as PatientGroup;
}

function createLocalGroup(input: GroupInput, user: AuthUser) {
  const timestamp = now();
  const group: PatientGroup = {
    id: createId("group"),
    owner_user_id: user.id,
    patient_name: input.patient_name,
    relation: input.relation,
    group_name: input.group_name || `${input.patient_name}の共有先`,
    memo: input.memo,
    invite_token: createToken(),
    created_at: timestamp,
    updated_at: timestamp
  };
  const member: GroupMember = {
    id: createId("member"),
    group_id: group.id,
    user_id: user.id,
    display_name: user.display_name,
    role: "admin",
    contact: user.email,
    created_at: timestamp
  };
  writeJson(GROUPS_KEY, [...readJson<PatientGroup[]>(GROUPS_KEY, []), group]);
  writeJson(MEMBERS_KEY, [...readJson<GroupMember[]>(MEMBERS_KEY, []), member]);
  return group;
}

export async function joinGroup(inviteToken: string) {
  const user = getCurrentUser();
  if (!user) throw new Error("ログインが必要です");
  const group = await getGroupByInviteToken(inviteToken);
  if (!group) return null;

  if (!supabase) {
    const members = readJson<GroupMember[]>(MEMBERS_KEY, []);
    if (!members.some((member) => member.group_id === group.id && member.user_id === user.id)) {
      members.push({
        id: createId("member"),
        group_id: group.id,
        user_id: user.id,
        display_name: user.display_name,
        role: "member",
        contact: user.email,
        created_at: now()
      });
      writeJson(MEMBERS_KEY, members);
    }
    return group;
  }

  const { error } = await supabase.from("group_members").upsert(
    {
      group_id: group.id,
      user_id: user.id,
      display_name: user.display_name,
      role: "member",
      contact: user.email
    },
    { onConflict: "group_id,user_id" }
  );
  throwIfError(error);
  return group;
}

export async function leaveGroup(groupId: string) {
  const user = getCurrentUser();
  if (!user) throw new Error("ログインが必要です");

  if (!supabase) {
    const members = readJson<GroupMember[]>(MEMBERS_KEY, []).filter(
      (member) => !(member.group_id === groupId && member.user_id === user.id)
    );
    writeJson(MEMBERS_KEY, members);
    return;
  }

  const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
  throwIfError(error);
}

export async function deleteMyAppData() {
  const user = getCurrentUser();
  if (!user) throw new Error("ログインが必要です");

  if (!supabase) {
    const ownedGroupIds = readJson<PatientGroup[]>(GROUPS_KEY, [])
      .filter((group) => group.owner_user_id === user.id)
      .map((group) => group.id);
    const ownedAppointmentIds = readJson<Appointment[]>(APPOINTMENTS_KEY, [])
      .filter((appointment) => ownedGroupIds.includes(appointment.group_id))
      .map((appointment) => appointment.id);

    writeJson(
      GROUPS_KEY,
      readJson<PatientGroup[]>(GROUPS_KEY, []).filter((group) => !ownedGroupIds.includes(group.id))
    );
    writeJson(
      MEMBERS_KEY,
      readJson<GroupMember[]>(MEMBERS_KEY, []).filter(
        (member) => member.user_id !== user.id && !ownedGroupIds.includes(member.group_id)
      )
    );
    writeJson(
      APPOINTMENTS_KEY,
      readJson<Appointment[]>(APPOINTMENTS_KEY, []).filter((appointment) => !ownedGroupIds.includes(appointment.group_id))
    );
    writeJson(
      COMPANIONS_KEY,
      readJson<AppointmentCompanion[]>(COMPANIONS_KEY, []).filter(
        (companion) => companion.user_id !== user.id && !ownedAppointmentIds.includes(companion.appointment_id)
      )
    );
    writeJson(
      REMINDERS_KEY,
      readJson<ReminderSetting[]>(REMINDERS_KEY, []).filter(
        (reminder) => !ownedAppointmentIds.includes(reminder.appointment_id)
      )
    );
    signOutLocal();
    return;
  }

  const { data: ownedGroups, error: groupReadError } = await supabase
    .from("patient_groups")
    .select("id")
    .eq("owner_user_id", user.id);
  throwIfError(groupReadError);

  const ownedGroupIds = (ownedGroups || []).map((group) => group.id);

  const { error: lineError } = await supabase.from("line_connections").delete().eq("user_id", user.id);
  throwIfError(lineError);

  const { error: companionError } = await supabase.from("appointment_companions").delete().eq("user_id", user.id);
  throwIfError(companionError);

  if (ownedGroupIds.length > 0) {
    const { error: ownedGroupError } = await supabase.from("patient_groups").delete().in("id", ownedGroupIds);
    throwIfError(ownedGroupError);
  }

  const { error: memberError } = await supabase.from("group_members").delete().eq("user_id", user.id);
  throwIfError(memberError);

  signOutLocal();
}

async function buildAppointmentViews(appointments: Appointment[], groups: PatientGroup[]) {
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  if (appointments.length === 0) return [];
  const ids = appointments.map((appointment) => appointment.id);

  let companions: AppointmentCompanion[] = [];
  let reminders: ReminderSetting[] = [];
  if (supabase) {
    const { data: companionData, error: companionError } = await supabase
      .from("appointment_companions")
      .select("*")
      .in("appointment_id", ids);
    throwIfError(companionError);
    companions = (companionData || []) as AppointmentCompanion[];

    const { data: reminderData, error: reminderError } = await supabase
      .from("reminder_settings")
      .select("*")
      .in("appointment_id", ids);
    throwIfError(reminderError);
    reminders = (reminderData || []) as ReminderSetting[];
  } else {
    companions = readJson<AppointmentCompanion[]>(COMPANIONS_KEY, []);
    reminders = readJson<ReminderSetting[]>(REMINDERS_KEY, []);
  }

  const views = await Promise.all(
    appointments
      .filter((appointment) => groupMap.has(appointment.group_id))
      .map(async (appointment) => ({
        ...appointment,
        reservation_image_url: await signedImageUrl(appointment.reservation_image_url),
        group: groupMap.get(appointment.group_id)!,
        companion: companions.find((companion) => companion.appointment_id === appointment.id),
        reminders: reminders.filter((reminder) => reminder.appointment_id === appointment.id)
      }))
  );
  return views.sort((a, b) => new Date(a.appointment_datetime).getTime() - new Date(b.appointment_datetime).getTime());
}

export async function getAppointments() {
  const groups = await getGroups();
  const groupIds = groups.map((group) => group.id);
  if (groupIds.length === 0) return [];

  if (!supabase) {
    const appointments = readJson<Appointment[]>(APPOINTMENTS_KEY, []).filter((appointment) =>
      groupIds.includes(appointment.group_id)
    );
    return buildAppointmentViews(appointments, groups);
  }

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .in("group_id", groupIds)
    .order("appointment_datetime", { ascending: true });
  throwIfError(error);
  return buildAppointmentViews((data || []) as Appointment[], groups);
}

export async function getAppointment(id: string) {
  const appointments = await getAppointments();
  return appointments.find((appointment) => appointment.id === id);
}

export async function getSharedAppointment(token: string): Promise<AppointmentView | undefined> {
  if (!supabase) {
    const appointment = readJson<Appointment[]>(APPOINTMENTS_KEY, []).find((item) => item.share_token === token);
    if (!appointment) return undefined;
    const group = readJson<PatientGroup[]>(GROUPS_KEY, []).find((item) => item.id === appointment.group_id);
    if (!group) return undefined;
    const [view] = await buildAppointmentViews([appointment], [group]);
    return view;
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("share_token", token)
    .maybeSingle();
  throwIfError(error);
  if (!appointment) return undefined;

  const { data: group, error: groupError } = await supabase
    .from("patient_groups")
    .select("*")
    .eq("id", appointment.group_id)
    .single();
  throwIfError(groupError);

  const [view] = await buildAppointmentViews([appointment as Appointment], [group as PatientGroup]);
  return view;
}

export async function saveAppointment(input: AppointmentInput) {
  if (!supabase) return saveLocalAppointment(input);
  const appointmentDatetime = toStorageDateTime(input.appointment_datetime);

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      group_id: input.group_id,
      hospital_name: input.hospital_name,
      department: input.department,
      appointment_datetime: appointmentDatetime,
      items_to_bring: input.items_to_bring,
      memo: input.memo,
      reservation_image_url: "",
      share_token: createToken(),
      status: "upcoming"
    })
    .select("*")
    .single();
  throwIfError(error);

  const imagePath = await uploadReservationImage(appointment.id, input.reservation_image_url);
  if (imagePath) {
    const { error: updateError } = await supabase
      .from("appointments")
      .update({ reservation_image_url: imagePath })
      .eq("id", appointment.id);
    throwIfError(updateError);
    appointment.reservation_image_url = imagePath;
  }

  await saveReminderSettings(appointment.id, appointment.appointment_datetime, input.reminders);
  return appointment as Appointment;
}

function saveLocalAppointment(input: AppointmentInput) {
  const timestamp = now();
  const appointmentDatetime = toStorageDateTime(input.appointment_datetime);
  const appointment: Appointment = {
    id: createId("appt"),
    group_id: input.group_id,
    hospital_name: input.hospital_name,
    department: input.department,
    appointment_datetime: appointmentDatetime,
    items_to_bring: input.items_to_bring,
    memo: input.memo,
    reservation_image_url: input.reservation_image_url,
    share_token: createToken(),
    status: "upcoming",
    created_at: timestamp,
    updated_at: timestamp
  };
  writeJson(APPOINTMENTS_KEY, [...readJson<Appointment[]>(APPOINTMENTS_KEY, []), appointment]);
  void saveReminderSettings(appointment.id, appointment.appointment_datetime, input.reminders);
  return appointment;
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  if (!supabase) {
    const updated = readJson<Appointment[]>(APPOINTMENTS_KEY, []).map((appointment) =>
      appointment.id === id ? { ...appointment, status, updated_at: now() } : appointment
    );
    writeJson(APPOINTMENTS_KEY, updated);
    return;
  }
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
  throwIfError(error);
}

export async function updateAppointment(
  id: string,
  input: Pick<AppointmentInput, "hospital_name" | "department" | "appointment_datetime" | "items_to_bring" | "memo" | "reminders"> & {
    reservation_image_url?: string;
  }
) {
  const appointmentDatetime = toStorageDateTime(input.appointment_datetime);
  if (!supabase) {
    let nextAppointment: Appointment | undefined;
    const updated = readJson<Appointment[]>(APPOINTMENTS_KEY, []).map((appointment) =>
      appointment.id === id
        ? (nextAppointment = {
            ...appointment,
            hospital_name: input.hospital_name,
            department: input.department,
            appointment_datetime: appointmentDatetime,
            items_to_bring: input.items_to_bring,
            memo: input.memo,
            reservation_image_url:
              input.reservation_image_url === undefined ? appointment.reservation_image_url : input.reservation_image_url,
            updated_at: now()
          })
        : appointment
    );
    writeJson(APPOINTMENTS_KEY, updated);
    await saveReminderSettings(id, appointmentDatetime, input.reminders);
    return nextAppointment;
  }

  const { data: updatedAppointment, error } = await supabase
    .from("appointments")
    .update({
      hospital_name: input.hospital_name,
      department: input.department,
      appointment_datetime: appointmentDatetime,
      items_to_bring: input.items_to_bring,
      memo: input.memo
    })
    .eq("id", id)
    .select("*")
    .single<Appointment>();
  throwIfError(error);

  let nextAppointment = updatedAppointment;
  if (input.reservation_image_url !== undefined) {
    const imagePath = await uploadReservationImage(id, input.reservation_image_url);
    const { data: imageUpdatedAppointment, error: imageError } = await supabase
      .from("appointments")
      .update({ reservation_image_url: imagePath })
      .eq("id", id)
      .select("*")
      .single<Appointment>();
    throwIfError(imageError);
    nextAppointment = imageUpdatedAppointment;
  }

  await saveReminderSettings(id, appointmentDatetime, input.reminders);
  return nextAppointment;
}

export async function deleteAppointment(id: string) {
  if (!supabase) {
    writeJson(
      APPOINTMENTS_KEY,
      readJson<Appointment[]>(APPOINTMENTS_KEY, []).filter((appointment) => appointment.id !== id)
    );
    writeJson(
      COMPANIONS_KEY,
      readJson<AppointmentCompanion[]>(COMPANIONS_KEY, []).filter((companion) => companion.appointment_id !== id)
    );
    writeJson(
      REMINDERS_KEY,
      readJson<ReminderSetting[]>(REMINDERS_KEY, []).filter((reminder) => reminder.appointment_id !== id)
    );
    return;
  }
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  throwIfError(error);
}

export async function saveCompanion(
  appointmentId: string,
  input: { display_name: string; contact?: string; comment?: string; user_id?: string | null }
) {
  const user = getCurrentUser();
  if (!supabase) {
    const companion: AppointmentCompanion = {
      id: createId("companion"),
      appointment_id: appointmentId,
      user_id: input.user_id === undefined ? user?.id ?? null : input.user_id,
      display_name: input.display_name,
      contact: input.contact || "",
      comment: input.comment || "",
      created_at: now()
    };
    const companions = readJson<AppointmentCompanion[]>(COMPANIONS_KEY, []);
    writeJson(COMPANIONS_KEY, [...companions.filter((item) => item.appointment_id !== appointmentId), companion]);
    return companion;
  }

  await deleteCompanion(appointmentId);
  const { data, error } = await supabase
    .from("appointment_companions")
    .insert({
      appointment_id: appointmentId,
      user_id: input.user_id === undefined ? user?.id ?? null : input.user_id,
      display_name: input.display_name,
      contact: input.contact || "",
      comment: input.comment || ""
    })
    .select("*")
    .single();
  throwIfError(error);
  return data as AppointmentCompanion;
}

export async function deleteCompanion(appointmentId: string) {
  if (!supabase) {
    writeJson(
      COMPANIONS_KEY,
      readJson<AppointmentCompanion[]>(COMPANIONS_KEY, []).filter((item) => item.appointment_id !== appointmentId)
    );
    return;
  }
  const { error } = await supabase.from("appointment_companions").delete().eq("appointment_id", appointmentId);
  if (error && !error.message.toLowerCase().includes("permission")) throw new Error(error.message);
}

export async function saveReminderSettings(
  appointmentId: string,
  appointmentDatetime: string,
  settings: Record<ReminderType, boolean>
) {
  const timeSettings = await getActiveReminderTimeSettings();
  const next = (Object.keys(reminderLabels) as ReminderType[]).map((type) => ({
    appointment_id: appointmentId,
    reminder_type: type,
    enabled: settings[type],
    remind_at: reminderDate(type, appointmentDatetime, timeSettings)
  }));

  if (!supabase) {
    const existing = readJson<ReminderSetting[]>(REMINDERS_KEY, []).filter((item) => item.appointment_id !== appointmentId);
    const localNext = next.map((item) => ({ ...item, id: createId("reminder"), created_at: now() }));
    writeJson(REMINDERS_KEY, [...existing, ...localNext]);
    return localNext;
  }

  const { error } = await supabase.from("reminder_settings").upsert(next, {
    onConflict: "appointment_id,reminder_type"
  });
  throwIfError(error);
  const { data, error: selectError } = await supabase
    .from("reminder_settings")
    .select("*")
    .eq("appointment_id", appointmentId);
  throwIfError(selectError);
  return (data || []) as ReminderSetting[];
}

export { reminderLabels };

export function seedDemoData(user = getCurrentUser()) {
  if (!user || supabase) return;
  const members = readJson<GroupMember[]>(MEMBERS_KEY, []);
  if (members.some((member) => member.user_id === user.id)) return;

  const mother = createLocalGroup({
    patient_name: "母",
    relation: "母",
    group_name: "母の共有先",
    memo: "血圧と薬の変更を家族で確認"
  }, user);
  const father = createLocalGroup({
    patient_name: "父",
    relation: "父",
    group_name: "父の共有先",
    memo: "眼科の予定は付き添い必須"
  }, user);
  const grandmother = createLocalGroup({
    patient_name: "祖母",
    relation: "祖母",
    group_name: "祖母の共有先",
    memo: "歯科は午後が楽"
  }, user);

  const inSixHours = new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString().slice(0, 16);
  const inFourDays = new Date(Date.now() + 1000 * 60 * 60 * 24 * 4).toISOString().slice(0, 16);
  const inTenDays = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString().slice(0, 16);

  const appt1 = saveLocalAppointment({
    group_id: mother.id,
    hospital_name: "みどり内科",
    department: "循環器内科",
    appointment_datetime: inSixHours,
    items_to_bring: "保険証、お薬手帳、血圧手帳",
    memo: "薬の残りを確認",
    reservation_image_url: "",
    reminders: { one_week_before: false, one_day_before: true, same_day_morning: true }
  });
  void saveCompanion(appt1.id, { display_name: "自分", contact: user.email, comment: "午前は対応できます", user_id: user.id });
  saveLocalAppointment({
    group_id: father.id,
    hospital_name: "青葉眼科",
    department: "眼科",
    appointment_datetime: inFourDays,
    items_to_bring: "診察券、メガネ",
    memo: "帰りはタクシー利用",
    reservation_image_url: "",
    reminders: { one_week_before: true, one_day_before: true, same_day_morning: true }
  });
  saveLocalAppointment({
    group_id: grandmother.id,
    hospital_name: "さくら歯科",
    department: "歯科",
    appointment_datetime: inTenDays,
    items_to_bring: "保険証",
    memo: "入れ歯の調整",
    reservation_image_url: "",
    reminders: { one_week_before: true, one_day_before: false, same_day_morning: true }
  });
}
