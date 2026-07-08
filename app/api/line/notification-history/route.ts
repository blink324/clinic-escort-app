import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type NotificationType =
  | "reminder_one_week_before"
  | "reminder_one_day_before"
  | "reminder_same_day_morning"
  | "companion_assigned"
  | "companion_removed";

type NotificationLogRecord = {
  appointment_id: string;
  id: string;
  notification_type: NotificationType;
  sent_at: string;
};

type AppointmentRecord = {
  appointment_datetime: string;
  department: string;
  group_id: string;
  hospital_name: string;
  id: string;
};

type GroupRecord = {
  id: string;
  patient_name: string;
};

function adminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return "";
  return token.trim();
}

const typeLabel: Record<NotificationType, string> = {
  reminder_one_week_before: "1週間前リマインド",
  reminder_one_day_before: "前日リマインド",
  reminder_same_day_morning: "当日朝リマインド",
  companion_assigned: "付き添い決定",
  companion_removed: "付き添い削除"
};

export async function GET(request: Request) {
  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json({ error: "通知履歴を確認する設定がまだ完了していません。" }, { status: 500 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "ログイン状態を確認できませんでした。もう一度ログインしてください。" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "ログイン状態を確認できませんでした。もう一度ログインしてください。" }, { status: 401 });
  }

  const { data: logs, error: logError } = await supabase
    .from("notification_logs")
    .select("id, appointment_id, notification_type, sent_at")
    .eq("recipient_user_id", userData.user.id)
    .order("sent_at", { ascending: false })
    .limit(10)
    .returns<NotificationLogRecord[]>();

  if (logError) {
    return NextResponse.json({ error: "通知履歴を取得できませんでした。" }, { status: 500 });
  }

  const appointmentIds = Array.from(new Set((logs || []).map((log) => log.appointment_id)));
  if (appointmentIds.length === 0) return NextResponse.json({ logs: [] });

  const { data: appointments, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, group_id, hospital_name, department, appointment_datetime")
    .in("id", appointmentIds)
    .returns<AppointmentRecord[]>();
  if (appointmentError) {
    return NextResponse.json({ error: "通知に紐づく予定を取得できませんでした。" }, { status: 500 });
  }

  const groupIds = Array.from(new Set((appointments || []).map((appointment) => appointment.group_id)));
  const { data: groups, error: groupError } = await supabase
    .from("patient_groups")
    .select("id, patient_name")
    .in("id", groupIds)
    .returns<GroupRecord[]>();
  if (groupError) {
    return NextResponse.json({ error: "通知に紐づく共有先を取得できませんでした。" }, { status: 500 });
  }

  const appointmentMap = new Map((appointments || []).map((appointment) => [appointment.id, appointment]));
  const groupMap = new Map((groups || []).map((group) => [group.id, group]));

  return NextResponse.json({
    logs: (logs || []).map((log) => {
      const appointment = appointmentMap.get(log.appointment_id);
      const group = appointment ? groupMap.get(appointment.group_id) : undefined;
      return {
        id: log.id,
        appointment_datetime: appointment?.appointment_datetime || "",
        department: appointment?.department || "",
        hospital_name: appointment?.hospital_name || "",
        label: typeLabel[log.notification_type],
        notification_type: log.notification_type,
        patient_name: group?.patient_name || "",
        sent_at: log.sent_at
      };
    })
  });
}
