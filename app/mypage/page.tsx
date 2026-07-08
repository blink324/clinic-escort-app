"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { LineNotificationButton } from "@/components/LineNotificationButton";
import { getActiveUser, signOut, updateDisplayName } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { AuthUser } from "@/lib/types";

type LineConnection = {
  display_name: string | null;
  notifications_enabled: boolean;
  updated_at: string | null;
};

export default function MyPage() {
  const [user, setUser] = useState<AuthUser | null>();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [lineConnection, setLineConnection] = useState<LineConnection | null>();

  async function loadProfile() {
    const current = await getActiveUser();
    setUser(current);
    setDisplayName(current?.display_name || "");

    if (!current || !supabase) {
      setLineConnection(null);
      return;
    }

    const { data } = await supabase
      .from("line_connections")
      .select("display_name, notifications_enabled, updated_at")
      .eq("user_id", current.id)
      .maybeSingle<LineConnection>();
    setLineConnection(data || null);
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const nextUser = await updateDisplayName(displayName);
      setUser(nextUser);
      setDisplayName(nextUser.display_name);
      await loadProfile();
      setMessage("名前を全体に反映しました");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "名前を更新できませんでした");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = "/";
  }

  if (user === undefined) return <main className="mobile-shell with-nav">読み込み中です</main>;

  if (!user) {
    return (
      <main className="mobile-shell with-nav">
        <section className="empty-state">
          <h1>ログインが必要です</h1>
          <Link className="primary-action full" href="/">ログイン画面へ</Link>
        </section>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="mobile-shell with-nav">
      <header className="app-header">
        <div>
          <p className="eyebrow">アカウント</p>
          <h1>マイページ</h1>
        </div>
        <Link className="text-button" href="/">予定へ戻る</Link>
      </header>

      <section className="profile-panel">
        <h2>名前</h2>
        <p>ここで設定した名前が、メンバー表示・付き添い担当・LINE連携名に反映されます。</p>
        <form className="inline-form compact-form" onSubmit={(event) => void saveName(event)}>
          <label>
            表示名
            <input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          {message && <p className="notice-text">{message}</p>}
          <button className="primary-action full" disabled={saving} type="submit">
            {saving ? "反映中..." : "名前を全体に反映"}
          </button>
        </form>
      </section>

      <section className="profile-panel">
        <h2>LINE連携</h2>
        <div className="profile-status-list">
          <div>
            <span>連携状態</span>
            <strong>{lineConnection ? "連携済み" : "未連携"}</strong>
          </div>
          <div>
            <span>LINE通知</span>
            <strong>
              {lineConnection ? (lineConnection.notifications_enabled ? "受け取る" : "停止中") : "未設定"}
            </strong>
          </div>
          {lineConnection?.display_name && (
            <div>
              <span>LINE表示名</span>
              <strong>{lineConnection.display_name}</strong>
            </div>
          )}
        </div>
        <LineNotificationButton full />
      </section>

      <section className="profile-panel">
        <h2>ログイン情報</h2>
        <div className="profile-status-list">
          <div>
            <span>メールアドレス</span>
            <strong>{user.email}</strong>
          </div>
        </div>
        <button className="danger-action full compact-form" onClick={() => void handleSignOut()} type="button">
          ログアウト
        </button>
      </section>

      <BottomNav />
    </main>
  );
}
