import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type ReminderType = "one_week_before" | "one_day_before" | "same_day_morning";

type ReminderRecord = {
  appointment_id: string;
  created_at: string;
  enabled: boolean;
  id: string;
  remind_at: string;
  reminder_type: ReminderType;
};

type AppointmentRecord = {
  appointment_datetime: string;
  department: string;
  group_id: string;
  hospital_name: string;
  id: string;
  share_token: string;
  status: "upcoming" | "completed" | "missed";
};

type GroupRecord = {
  id: string;
  patient_name: string;
};

type GroupMemberRecord = {
  group_id: string;
  user_id: string;
};

type LineConnectionRecord = {
  line_user_id: string;
  user_id: string;
};

type NotificationLogRecord = {
  recipient_user_id: string | null;
  reminder_setting_id: string | null;
};

type ReminderRunOptions = {
  onlyRecipientUserId?: string;
};

const reminderTitle: Record<ReminderType, string> = {
  one_week_before: "1週間後に通院予定があります",
  one_day_before: "明日は通院予定があります",
  same_day_morning: "今日は通院予定があります"
};

const notificationType: Record<ReminderType, string> = {
  one_week_before: "reminder_one_week_before",
  one_day_before: "reminder_one_day_before",
  same_day_morning: "reminder_same_day_morning"
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo"
});

function adminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
}

function isAuthorized(request: Request) {
  const cronSecret = (process.env.CRON_SECRET || process.env.TSUKISOI_CRON_SECRET)?.trim();
  if (!cronSecret) return true;
  const authorization = request.headers.get("authorization")?.trim();
  const cronSecretHeader = request.headers.get("x-cron-secret")?.trim();
  return authorization === `Bearer ${cronSecret}` || cronSecretHeader === cronSecret;
}

async function pushLineMessage(lineUserId: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text }]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LINE push failed: ${response.status} ${detail}`);
  }
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return "";
  return token.trim();
}

async function runReminderNotifications(request: Request, options: ReminderRunOptions = {}) {
  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const now = new Date();
  const dueAfter = new Date(now.getTime() - 36 * 60 * 60 * 1000);
  const { data: reminders, error: reminderError } = await supabase
    .from("reminder_settings")
    .select("*")
    .eq("enabled", true)
    .lte("remind_at", now.toISOString())
    .gte("remind_at", dueAfter.toISOString())
    .order("remind_at", { ascending: true })
    .returns<ReminderRecord[]>();
  if (reminderError) {
    return NextResponse.json({ error: reminderError.message }, { status: 500 });
  }
  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ checked: 0, sent: 0, failed: 0 });
  }

  const appointmentIds = Array.from(new Set(reminders.map((reminder) => reminder.appointment_id)));
  const { data: appointments, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, group_id, hospital_name, department, appointment_datetime, share_token, status")
    .in("id", appointmentIds)
    .eq("status", "upcoming")
    .returns<AppointmentRecord[]>();
  if (appointmentError) {
    return NextResponse.json({ error: appointmentError.message }, { status: 500 });
  }

  const appointmentMap = new Map((appointments || []).map((appointment) => [appointment.id, appointment]));
  const groupIds = Array.from(new Set((appointments || []).map((appointment) => appointment.group_id)));
  if (groupIds.length === 0) {
    return NextResponse.json({ checked: reminders.length, sent: 0, failed: 0, skipped: "no upcoming appointments" });
  }

  const [{ data: groups, error: groupError }, { data: members, error: memberError }] = await Promise.all([
    supabase.from("patient_groups").select("id, patient_name").in("id", groupIds).returns<GroupRecord[]>(),
    supabase.from("group_members").select("group_id, user_id").in("group_id", groupIds).returns<GroupMemberRecord[]>()
  ]);
  if (groupError) return NextResponse.json({ error: groupError.message }, { status: 500 });
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  const groupMap = new Map((groups || []).map((group) => [group.id, group]));
  const userIds = Array.from(new Set((members || []).map((member) => member.user_id)));
  if (userIds.length === 0) {
    return NextResponse.json({ checked: reminders.length, sent: 0, failed: 0, skipped: "no group members" });
  }

  const [{ data: connections, error: connectionError }, { data: logs, error: logError }] = await Promise.all([
    supabase
      .from("line_connections")
      .select("user_id, line_user_id")
      .in("user_id", userIds)
      .eq("notifications_enabled", true)
      .returns<LineConnectionRecord[]>(),
    supabase
      .from("notification_logs")
      .select("reminder_setting_id, recipient_user_id")
      .in(
        "reminder_setting_id",
        reminders.map((reminder) => reminder.id)
      )
      .returns<NotificationLogRecord[]>()
  ]);
  if (connectionError) return NextResponse.json({ error: connectionError.message }, { status: 500 });
  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 });

  const memberUserIdsByGroup = new Map<string, string[]>();
  for (const member of members || []) {
    memberUserIdsByGroup.set(member.group_id, [...(memberUserIdsByGroup.get(member.group_id) || []), member.user_id]);
  }
  const connectionMap = new Map((connections || []).map((connection) => [connection.user_id, connection]));
  const sentLogKeys = new Set(
    (logs || []).map((log) => `${log.reminder_setting_id || ""}:${log.recipient_user_id || ""}`)
  );
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of reminders) {
    const appointment = appointmentMap.get(reminder.appointment_id);
    if (!appointment) {
      skipped += 1;
      continue;
    }
    const group = groupMap.get(appointment.group_id);
    if (!group) {
      skipped += 1;
      continue;
    }

    const dateText = dateFormatter.format(new Date(appointment.appointment_datetime));
    const shareUrl = `${appUrl}/share/${appointment.share_token}`;
    const text = [
      reminderTitle[reminder.reminder_type],
      "",
      `${group.patient_name}さんの通院予定`,
      dateText,
      `${appointment.hospital_name} / ${appointment.department}`,
      "",
      "付き添い担当と持ち物を確認しておきましょう。",
      `確認する: ${shareUrl}`
    ].join("\n");

    for (const userId of memberUserIdsByGroup.get(appointment.group_id) || []) {
      if (options.onlyRecipientUserId && userId !== options.onlyRecipientUserId) {
        skipped += 1;
        continue;
      }
      if (sentLogKeys.has(`${reminder.id}:${userId}`)) {
        skipped += 1;
        continue;
      }
      const connection = connectionMap.get(userId);
      if (!connection) {
        skipped += 1;
        continue;
      }

      try {
        await pushLineMessage(connection.line_user_id, text);
        const { error: insertError } = await supabase.from("notification_logs").insert({
          appointment_id: appointment.id,
          reminder_setting_id: reminder.id,
          notification_type: notificationType[reminder.reminder_type],
          channel: "line",
          recipient_user_id: userId,
          line_user_id: connection.line_user_id
        });
        if (insertError) throw new Error(insertError.message);
        sentLogKeys.add(`${reminder.id}:${userId}`);
        sent += 1;
      } catch (caught) {
        console.error("LINE reminder failed", {
          appointmentId: appointment.id,
          reminderSettingId: reminder.id,
          recipientUserId: userId,
          error: caught instanceof Error ? caught.message : String(caught)
        });
        failed += 1;
      }
    }
  }

  return NextResponse.json({ checked: reminders.length, sent, failed, skipped });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return runReminderNotifications(request);
}

export async function POST(request: Request) {
  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "ログイン状態を確認できませんでした。もう一度ログインしてください。" }, { status: 401 });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json({ error: "ログイン状態を確認できませんでした。もう一度ログインしてください。" }, { status: 401 });
  }

  return runReminderNotifications(request, { onlyRecipientUserId: data.user.id });
}
