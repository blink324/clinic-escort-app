"use client";

import { supabase } from "@/lib/supabase";
import { getCurrentUser, setCurrentUser, signInDemo, signOutLocal } from "@/lib/storage";
import type { AuthUser } from "@/lib/types";

function userFromSupabase(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }, fallbackName = "") {
  const metadataName = typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim() : "";
  const fallback = fallbackName.trim() || user.email?.split("@")[0] || "名前未設定";
  return {
    id: user.id,
    email: user.email || "",
    display_name: metadataName || fallback
  } satisfies AuthUser;
}

function friendlyAuthError(message?: string) {
  const normalized = message?.trim();
  if (!normalized || normalized === "{}" || normalized === "[object Object]") {
    return "認証処理に失敗しました。時間を置いてもう一度お試しください。";
  }
  const lower = normalized.toLowerCase();
  if (lower.includes("rate limit")) {
    return "確認メールの送信回数が上限に達しました。しばらく待ってから再度お試しください。すでに登録済みの場合はログインを選んでください。";
  }
  if (lower.includes("invalid login credentials")) {
    return "メールアドレスまたはパスワードが違います。新規登録がまだの場合は、新規登録を選んでください。";
  }
  if (lower.includes("email not confirmed")) {
    return "メール確認がまだ完了していません。確認メール内のリンクを開いてからログインしてください。";
  }
  return normalized;
}

export function authErrorMessage(caught: unknown) {
  if (caught instanceof Error) return friendlyAuthError(caught.message);
  if (typeof caught === "string") return friendlyAuthError(caught);
  if (caught && typeof caught === "object") {
    const record = caught as Record<string, unknown>;
    if (typeof record.message === "string") return friendlyAuthError(record.message);
    if (typeof record.error_description === "string") return friendlyAuthError(record.error_description);
    if (typeof record.error === "string") return friendlyAuthError(record.error);
  }
  return "認証処理に失敗しました。時間を置いてもう一度お試しください。";
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) return signInDemo(email, email.split("@")[0] || "名前未設定");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendlyAuthError(error.message));
  if (!data.user || !data.session) throw new Error("ログインできませんでした。確認メールが届いている場合は、メール内のリンクを開いてください。");

  const user = userFromSupabase(data.user);
  setCurrentUser(user);
  return user;
}

export async function registerWithEmail(email: string, password: string, displayName: string) {
  const normalizedDisplayName = displayName.trim();
  if (!normalizedDisplayName) throw new Error("表示名を入力してください。");
  if (!supabase) return signInDemo(email, normalizedDisplayName);

  const emailRedirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/`
      : process.env.NEXT_PUBLIC_APP_URL || undefined;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: normalizedDisplayName },
      emailRedirectTo
    }
  });

  if (error) throw new Error(friendlyAuthError(error.message));
  if (data.user && data.session) {
    const user = userFromSupabase(data.user, normalizedDisplayName);
    setCurrentUser(user);
    return user;
  }

  throw new Error("確認メールを送信しました。メール内のリンクを開いてから、ログインしてください。");
}

export async function getActiveUser() {
  if (!supabase) return getCurrentUser();

  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) {
    signOutLocal();
    return null;
  }

  const user = userFromSupabase(data.session.user);
  setCurrentUser(user);
  return user;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
  signOutLocal();
}

export function currentLocalUser() {
  return getCurrentUser();
}
