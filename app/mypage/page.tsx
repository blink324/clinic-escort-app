"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { LineNotificationButton } from "@/components/LineNotificationButton";
import { getActiveUser, signOut, updateDisplayName } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { deleteMyAppData } from "@/lib/storage";
import type { AuthUser } from "@/lib/types";

type LineConnection = {
  display_name: string | null;
  notifications_enabled: boolean;
  updated_at: string | null;
};

type NotificationHistoryItem = {
  appointment_datetime: string;
  department: string;
  hospital_name: string;
  id: string;
  label: string;
  patient_name: string;
  sent_at: string;
};

const historyDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short"
});

export default function MyPage() {
  const [user, setUser] = useState<AuthUser | null>();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testingLine, setTestingLine] = useState(false);
  const [checkingReminders, setCheckingReminders] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [lineTestMessage, setLineTestMessage] = useState("");
  const [reminderCheckMessage, setReminderCheckMessage] = useState("");
  const [lineConnection, setLineConnection] = useState<LineConnection | null>();
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistoryItem[]>([]);

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
    await loadNotificationHistory();
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

  async function handleDeleteData() {
    const ok = window.confirm(
      "退会して、ログインアカウントとアプリ内データを削除します。元に戻せません。実行しますか？"
    );
    if (!ok) return;
    setDeleting(true);
    setDeleteMessage("");
    try {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("ログイン状態を確認できませんでした。もう一度ログインしてください。");
        const response = await fetch("/api/account/delete", {
          headers: {
            Authorization: `Bearer ${token}`
          },
          method: "POST"
        });
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) throw new Error(result.error || "退会処理を完了できませんでした。");
      } else {
        await deleteMyAppData();
      }
      await signOut();
      window.location.href = "/";
    } catch (caught) {
      setDeleteMessage(
        caught instanceof Error
          ? `削除できませんでした。時間を置いて再度お試しください。詳細: ${caught.message}`
          : "削除できませんでした。時間を置いて再度お試しください。"
      );
    } finally {
      setDeleting(false);
    }
  }

  async function sendLineTestNotification() {
    if (!supabase) {
      setLineTestMessage("LINE通知の送信設定がまだ完了していません。");
      return;
    }
    setTestingLine(true);
    setLineTestMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("ログイン状態を確認できませんでした。もう一度ログインしてください。");

      const response = await fetch("/api/line/test-notification", {
        headers: {
          Authorization: `Bearer ${token}`
        },
        method: "POST"
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "LINE通知を送信できませんでした。");
      setLineTestMessage("テスト通知を送信しました。LINEを確認してください。");
      await loadNotificationHistory();
    } catch (caught) {
      setLineTestMessage(caught instanceof Error ? caught.message : "LINE通知を送信できませんでした。");
    } finally {
      setTestingLine(false);
    }
  }

  async function checkReminderNotifications() {
    if (!supabase) {
      setReminderCheckMessage("リマインド通知の設定がまだ完了していません。");
      return;
    }
    setCheckingReminders(true);
    setReminderCheckMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("ログイン状態を確認できませんでした。もう一度ログインしてください。");

      const response = await fetch("/api/cron/reminders", {
        headers: {
          Authorization: `Bearer ${token}`
        },
        method: "POST"
      });
      const result = (await response.json().catch(() => ({}))) as {
        checked?: number;
        error?: string;
        failed?: number;
        sent?: number;
        skipped?: number;
      };
      if (!response.ok) throw new Error(result.error || "リマインド通知を確認できませんでした。");
      if ((result.sent || 0) > 0) {
        setReminderCheckMessage(`リマインド通知を${result.sent}件送信しました。LINEを確認してください。`);
        await loadNotificationHistory();
      } else if ((result.checked || 0) === 0) {
        setReminderCheckMessage("今すぐ送信するリマインドはありません。前日・当日朝になると送信対象になります。");
      } else {
        setReminderCheckMessage("送信対象は確認しましたが、すでに送信済みか、LINE連携済みの対象者がいませんでした。");
      }
    } catch (caught) {
      setReminderCheckMessage(caught instanceof Error ? caught.message : "リマインド通知を確認できませんでした。");
    } finally {
      setCheckingReminders(false);
    }
  }

  async function loadNotificationHistory() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const response = await fetch("/api/line/notification-history", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) return;
    const result = (await response.json().catch(() => ({ logs: [] }))) as { logs?: NotificationHistoryItem[] };
    setNotificationHistory(result.logs || []);
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
        <button
          className="secondary-action full"
          disabled={testingLine || !lineConnection?.notifications_enabled}
          onClick={() => void sendLineTestNotification()}
          type="button"
        >
          {testingLine ? "送信中..." : "LINEテスト通知を送る"}
        </button>
        {lineTestMessage && <p className={lineTestMessage.includes("送信しました") ? "notice-text" : "error-text"}>{lineTestMessage}</p>}
        <p className="help-text">
          通知が届かない場合は、つきそい公式LINEを友だち追加しているか確認してください。
        </p>
      </section>

      <section className="profile-panel">
        <h2>リマインド通知テスト</h2>
        <p>前日・当日朝など、今送信対象になっているリマインドを自分宛に確認します。</p>
        <button
          className="secondary-action full"
          disabled={checkingReminders || !lineConnection?.notifications_enabled}
          onClick={() => void checkReminderNotifications()}
          type="button"
        >
          {checkingReminders ? "確認中..." : "今リマインド通知を確認する"}
        </button>
        {reminderCheckMessage && (
          <p className={reminderCheckMessage.includes("送信しました") ? "notice-text" : "help-text"}>
            {reminderCheckMessage}
          </p>
        )}
      </section>

      <section className="profile-panel">
        <h2>最近のLINE通知</h2>
        {notificationHistory.length === 0 ? (
          <p>まだ通知履歴はありません。リマインドや付き添い通知を送るとここへ表示されます。</p>
        ) : (
          <div className="notification-history-list">
            {notificationHistory.map((item) => (
              <div className="notification-history-card" key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{historyDateFormatter.format(new Date(item.sent_at))}</span>
                </div>
                <p>
                  {item.patient_name ? `${item.patient_name}さん / ` : ""}
                  {item.hospital_name || "予定情報なし"}
                  {item.department ? ` / ${item.department}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="profile-panel">
        <h2>サポート</h2>
        <div className="profile-link-list">
          <Link href="/contact">お問い合わせ</Link>
          <Link href="/terms">利用規約</Link>
          <Link href="/privacy">プライバシーポリシー</Link>
        </div>
      </section>

      <section className="profile-panel danger-zone">
        <h2>退会・データ削除</h2>
        <p>
          ログインアカウント、共有先、通院予定、付き添い担当、LINE連携情報を削除します。実行後は元に戻せません。
        </p>
        {deleteMessage && <p className="error-text">{deleteMessage}</p>}
        <button className="danger-action full" disabled={deleting} onClick={() => void handleDeleteData()} type="button">
          {deleting ? "削除中..." : "退会してデータを削除する"}
        </button>
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
