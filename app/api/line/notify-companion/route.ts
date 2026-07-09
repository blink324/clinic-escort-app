import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { appointmentDateTime } from "@/lib/datetime";

type AppointmentRecord = {
  appointment_datetime: string;
  department: string;
  display_datetime?: string | null;
  group_id: string;
  hospital_name: string;
  id: string;
  share_token: string;
};

type CompanionRecord = {
  display_name: string;
  user_id: string | null;
};

type GroupRecord = {
  patient_name: string;
};

type GroupMemberRecord = {
  display_name: string;
  user_id: string;
};

type LineConnectionRecord = {
  line_user_id: string;
  user_id: string;
};

function adminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
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

type NotificationAction = "assigned" | "removed";

const notificationType: Record<NotificationAction, "companion_assigned" | "companion_removed"> = {
  assigned: "companion_assigned",
  removed: "companion_removed"
};

export async function POST(request: Request) {
  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const { action = "assigned", appointmentId } = (await request.json()) as {
    action?: NotificationAction;
    appointmentId?: string;
  };
  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId is required" }, { status: 400 });
  }
  if (action !== "assigned" && action !== "removed") {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, group_id, hospital_name, department, appointment_datetime, display_datetime, share_token")
    .eq("id", appointmentId)
    .single<AppointmentRecord>();
  if (appointmentError || !appointment) {
    return NextResponse.json({ error: appointmentError?.message || "appointment not found" }, { status: 404 });
  }

  const { data: companion, error: companionError } = await supabase
    .from("appointment_companions")
    .select("display_name, user_id")
    .eq("appointment_id", appointmentId)
    .maybeSingle<CompanionRecord>();
  if (companionError) {
    return NextResponse.json({ error: companionError.message }, { status: 500 });
  }
  if (!companion && action === "assigned") {
    return NextResponse.json({ sent: 0, skipped: "companion not set" });
  }

  const { data: group, error: groupError } = await supabase
    .from("patient_groups")
    .select("patient_name")
    .eq("id", appointment.group_id)
    .single<GroupRecord>();
  if (groupError || !group) {
    return NextResponse.json({ error: groupError?.message || "group not found" }, { status: 404 });
  }

  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("user_id, display_name")
    .eq("group_id", appointment.group_id)
    .returns<GroupMemberRecord[]>();
  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const userIds = (members || []).map((member) => member.user_id);
  if (userIds.length === 0) {
    return NextResponse.json({ sent: 0, skipped: "no group members" });
  }

  const { data: connections, error: connectionsError } = await supabase
    .from("line_connections")
    .select("user_id, line_user_id")
    .in("user_id", userIds)
    .eq("notifications_enabled", true)
    .returns<LineConnectionRecord[]>();
  if (connectionsError) {
    return NextResponse.json({ error: connectionsError.message }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const shareUrl = `${appUrl}/share/${appointment.share_token}`;
  const dateText = appointmentDateTime(appointment.display_datetime || appointment.appointment_datetime);

  const activeConnections = connections || [];
  const results = await Promise.allSettled(
    activeConnections.map((connection) => {
      const isAssignedPerson = companion?.user_id && connection.user_id === companion.user_id;
      const heading =
        action === "removed"
          ? isAssignedPerson
            ? "あなたの付き添い担当が削除されました"
            : `付き添い担当が${companion?.display_name ? `${companion.display_name}さんから` : ""}未定に戻りました`
          : isAssignedPerson
            ? "あなたが付き添い担当になりました"
            : `付き添い担当が${companion?.display_name}さんに決まりました`;
      const text = [
        heading,
        "",
        `${group.patient_name}さんの通院予定`,
        dateText,
        `${appointment.hospital_name} / ${appointment.department}`,
        "",
        `確認する: ${shareUrl}`
      ].join("\n");
      return pushLineMessage(connection.line_user_id, text);
    })
  );

  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;
  const logResults = await Promise.allSettled(
    results.flatMap((result, index) => {
      if (result.status !== "fulfilled") return [];
      const connection = activeConnections[index];
      return [
        (async () => {
          const { error } = await supabase.from("notification_logs").insert({
            appointment_id: appointment.id,
            reminder_setting_id: null,
            notification_type: notificationType[action],
            channel: "line",
            recipient_user_id: connection.user_id,
            line_user_id: connection.line_user_id
          });
          if (error) throw new Error(error.message);
        })()
      ];
    })
  );
  const logged = logResults.filter((result) => result.status === "fulfilled").length;

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error("LINE companion notification failed", {
        appointmentId,
        action,
        recipientUserId: activeConnections[index]?.user_id,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
      });
    }
  });

  return NextResponse.json({ sent, failed, logged });
}
