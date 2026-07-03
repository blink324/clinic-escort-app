"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getActiveUser } from "@/lib/auth";
import { isLineConnectReady, lineConnectPath, lineFriendUrl } from "@/lib/line";
import { supabase } from "@/lib/supabase";

type Props = {
  full?: boolean;
};

export function LineNotificationButton({ full = false }: Props) {
  const [connectionState, setConnectionState] = useState<"unknown" | "none" | "enabled" | "disabled">("unknown");
  const [saving, setSaving] = useState(false);
  const connectPath = lineConnectPath();
  const friendUrl = lineFriendUrl();
  const className = full ? "line-notify-button full" : "line-notify-button";

  useEffect(() => {
    async function loadConnection() {
      if (!supabase) {
        setConnectionState("none");
        return;
      }
      const user = await getActiveUser();
      if (!user) {
        setConnectionState("none");
        return;
      }
      const { data, error } = await supabase
        .from("line_connections")
        .select("notifications_enabled")
        .eq("user_id", user.id)
        .maybeSingle<{ notifications_enabled: boolean }>();
      if (error || !data) {
        setConnectionState("none");
        return;
      }
      setConnectionState(data.notifications_enabled ? "enabled" : "disabled");
    }

    void loadConnection();
  }, []);

  async function updateNotification(enabled: boolean) {
    if (!supabase) return;
    setSaving(true);
    try {
      const user = await getActiveUser();
      if (!user) return;
      const { error } = await supabase
        .from("line_connections")
        .update({ notifications_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (!error) setConnectionState(enabled ? "enabled" : "disabled");
    } finally {
      setSaving(false);
    }
  }

  if (connectionState === "unknown") {
    return (
      <button className={className} disabled type="button">
        LINE通知を確認中...
      </button>
    );
  }

  if (connectionState === "enabled") {
    return (
      <button className={`${className} stop`} disabled={saving} onClick={() => void updateNotification(false)} type="button">
        {saving ? "変更中..." : "LINE通知の受け取りをやめる"}
      </button>
    );
  }

  if (connectionState === "disabled") {
    return (
      <button className={className} disabled={saving} onClick={() => void updateNotification(true)} type="button">
        {saving ? "変更中..." : "LINE通知を再開する"}
      </button>
    );
  }

  if (connectPath) {
    return (
      <Link className={className} href={connectPath}>
        LINE通知を受け取る
      </Link>
    );
  }

  if (friendUrl) {
    return (
      <a className={className} href={friendUrl} target="_blank" rel="noreferrer">
        つきそいLINEを追加
      </a>
    );
  }

  return (
    <button className={className} disabled={!isLineConnectReady()} type="button">
      LINE通知は準備中
    </button>
  );
}
