import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

export async function POST(request: Request) {
  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json({ error: "退会処理の設定がまだ完了していません。" }, { status: 500 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "ログイン状態を確認できませんでした。もう一度ログインしてください。" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "ログイン状態を確認できませんでした。もう一度ログインしてください。" }, { status: 401 });
  }

  const userId = userData.user.id;

  const { data: ownedGroups, error: ownedGroupReadError } = await supabase
    .from("patient_groups")
    .select("id")
    .eq("owner_user_id", userId);
  if (ownedGroupReadError) {
    return NextResponse.json({ error: "削除対象の共有先を確認できませんでした。" }, { status: 500 });
  }

  const ownedGroupIds = (ownedGroups || []).map((group) => group.id);

  const cleanupResults = await Promise.allSettled([
    supabase.from("notification_logs").delete().eq("recipient_user_id", userId),
    supabase.from("line_connections").delete().eq("user_id", userId),
    supabase.from("appointment_companions").delete().eq("user_id", userId),
    supabase.from("group_members").delete().eq("user_id", userId)
  ]);

  if (cleanupResults.some((result) => result.status === "rejected")) {
    return NextResponse.json({ error: "アプリ内データの一部を削除できませんでした。" }, { status: 500 });
  }

  const cleanupError = cleanupResults.find(
    (result) => result.status === "fulfilled" && result.value.error
  ) as PromiseFulfilledResult<{ error: { message: string } | null }> | undefined;
  if (cleanupError?.value.error) {
    return NextResponse.json({ error: "アプリ内データの一部を削除できませんでした。" }, { status: 500 });
  }

  if (ownedGroupIds.length > 0) {
    const { error: groupDeleteError } = await supabase.from("patient_groups").delete().in("id", ownedGroupIds);
    if (groupDeleteError) {
      return NextResponse.json({ error: "作成した共有先を削除できませんでした。" }, { status: 500 });
    }
  }

  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    return NextResponse.json({ error: "ログインアカウントを削除できませんでした。" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
