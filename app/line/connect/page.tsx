"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { getActiveUser } from "@/lib/auth";
import { lineFriendUrl } from "@/lib/line";
import { supabase } from "@/lib/supabase";
import type { AuthUser } from "@/lib/types";

type LiffProfile = {
  displayName?: string;
  userId: string;
};

declare global {
  interface Window {
    liff?: {
      getProfile: () => Promise<LiffProfile>;
      init: (options: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: (options?: { redirectUri?: string }) => void;
    };
  }
}

function loadLiffSdk() {
  return new Promise<void>((resolve, reject) => {
    if (window.liff) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("LINE連携の読み込みに失敗しました。"));
    document.body.appendChild(script);
  });
}

function friendlyLineError(caught: unknown) {
  const message = caught instanceof Error ? caught.message : "";
  const lower = message.toLowerCase();
  if (lower.includes("bad request") || lower.includes("invalid url")) {
    return "LINE連携URLの設定に問題があります。しばらくしても直らない場合はお問い合わせください。";
  }
  if (lower.includes("developing status") || lower.includes("developer role")) {
    return "LINEログインがまだ公開前の設定です。LINE Developersでチャネルを公開してください。";
  }
  if (lower.includes("network") || lower.includes("failed")) {
    return "LINE連携の読み込みに失敗しました。通信状況を確認して、もう一度お試しください。";
  }
  return message || "LINE連携に失敗しました。時間を置いてもう一度お試しください。";
}

export default function LineConnectPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState("LINE連携を準備しています。");
  const [connected, setConnected] = useState(false);
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
  const friendUrl = lineFriendUrl();

  async function refreshUser() {
    const current = await getActiveUser();
    setUser(current);
    return current;
  }

  useEffect(() => {
    async function connectLine() {
      const current = await refreshUser();
      if (!current) return;
      if (!supabase) {
        setStatus("Supabase接続が必要です。");
        return;
      }
      if (!liffId) {
        setStatus("LIFF IDがまだ設定されていません。");
        return;
      }

      try {
        await loadLiffSdk();
        await window.liff?.init({ liffId });
        if (!window.liff?.isLoggedIn()) {
          window.liff?.login({ redirectUri: window.location.href });
          return;
        }
        const profile = await window.liff.getProfile();
        const { error } = await supabase.from("line_connections").upsert(
          {
            user_id: current.id,
            line_user_id: profile.userId,
            display_name: profile.displayName || current.display_name,
            notifications_enabled: true,
            updated_at: new Date().toISOString()
          },
          { onConflict: "user_id" }
        );
        if (error) throw new Error(error.message);
        setConnected(true);
        setStatus("LINE通知を受け取れるようになりました。");
      } catch (caught) {
        setStatus(friendlyLineError(caught));
      }
    }

    void connectLine();
  }, [liffId]);

  if (!user) return <AuthPanel onSignedIn={() => void refreshUser()} />;

  return (
    <main className="mobile-shell">
      <section className="auth-card line-connect-card">
        <p className="eyebrow">LINE通知</p>
        <h1>{connected ? "連携できました" : "LINE通知を受け取る"}</h1>
        <p>{status}</p>
        {!connected && (
          <p className="help-text">
            うまくいかない場合は、LINEログインチャネルが公開済みか、マイページでログインできているか確認してください。
          </p>
        )}
        {friendUrl && (
          <a className="line-action full" href={friendUrl} target="_blank" rel="noreferrer">
            つきそいLINEを友だち追加
          </a>
        )}
        <Link className="secondary-action full" href="/">
          予定へ戻る
        </Link>
      </section>
    </main>
  );
}
