"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { getActiveUser } from "@/lib/auth";
import { friendlyErrorMessage } from "@/lib/errors";
import { getGroupByInviteToken, joinGroup } from "@/lib/storage";
import type { AuthUser, PatientGroup } from "@/lib/types";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [group, setGroup] = useState<PatientGroup | null>();
  const [joined, setJoined] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");

  async function refresh() {
    setUser(await getActiveUser());
    if (params.token) setGroup((await getGroupByInviteToken(params.token)) || null);
  }

  useEffect(() => {
    void refresh();
  }, [params.token]);

  async function join() {
    setJoinMessage("");
    try {
      const next = await joinGroup(params.token);
      if (next) {
        setGroup(next);
        setJoined(true);
      }
    } catch (caught) {
      setJoinMessage(friendlyErrorMessage(caught, "共有先に参加できませんでした。ログイン状態と招待URLを確認してください。"));
    }
  }

  if (!user) return <AuthPanel onSignedIn={() => void refresh()} />;
  if (group === undefined) return <main className="mobile-shell">読み込み中です</main>;

  return (
    <main className="mobile-shell">
      <section className="auth-card">
        <p className="eyebrow">家族共有の招待</p>
        {group ? (
          <>
            <h1>{group.group_name}</h1>
            <p>{group.patient_name}さんの通院予定と付き添い担当を一緒に確認できます。</p>
            {joined ? (
              <Link className="primary-action full" href={`/groups/${group.id}`}>共有先を開く</Link>
            ) : (
              <button className="primary-action full" onClick={() => void join()}>この共有先に参加する</button>
            )}
            {joinMessage && <p className="error-text">{joinMessage}</p>}
          </>
        ) : (
          <>
            <h1>招待が見つかりません</h1>
            <p>URLが途中で切れていないか確認してください。</p>
          </>
        )}
      </section>
    </main>
  );
}
