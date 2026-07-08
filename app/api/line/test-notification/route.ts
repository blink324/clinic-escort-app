import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type LineConnectionRecord = {
  line_user_id: string;
  notifications_enabled: boolean;
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

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return "";
  return token.trim();
}

export async function POST(request: Request) {
  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json({ error: "通知設定がまだ完了していません。" }, { status: 500 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "ログイン状態を確認できませんでした。もう一度ログインしてください。" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "ログイン状態を確認できませんでした。もう一度ログインしてください。" }, { status: 401 });
  }

  const { data: connection, error: connectionError } = await supabase
    .from("line_connections")
    .select("user_id, line_user_id, notifications_enabled")
    .eq("user_id", userData.user.id)
    .maybeSingle<LineConnectionRecord>();

  if (connectionError) {
    return NextResponse.json({ error: "LINE連携状態を確認できませんでした。" }, { status: 500 });
  }
  if (!connection) {
    return NextResponse.json({ error: "LINE連携がまだ完了していません。マイページから連携してください。" }, { status: 404 });
  }
  if (!connection.notifications_enabled) {
    return NextResponse.json({ error: "LINE通知が停止中です。通知を受け取る設定に戻してください。" }, { status: 400 });
  }

  try {
    await pushLineMessage(
      connection.line_user_id,
      ["つきそい LINE通知テスト", "", "このメッセージが届いていれば、LINE通知を受け取れる状態です。"].join("\n")
    );
    return NextResponse.json({ sent: 1 });
  } catch (caught) {
    console.error("LINE test notification failed", {
      userId: userData.user.id,
      error: caught instanceof Error ? caught.message : String(caught)
    });
    return NextResponse.json(
      { error: "LINE通知を送信できませんでした。公式LINEを友だち追加しているか確認してください。" },
      { status: 500 }
    );
  }
}
