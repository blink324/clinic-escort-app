"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { patientIcon } from "@/lib/patient-icons";
import { getGroupMembers, getGroups } from "@/lib/storage";
import type { PatientGroup } from "@/lib/types";

export default function GroupsPage() {
  const [groups, setGroups] = useState<PatientGroup[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGroups() {
      setLoading(true);
      const nextGroups = await getGroups();
      const counts = await Promise.all(
        nextGroups.map(async (group) => [group.id, (await getGroupMembers(group.id)).length] as const)
      );
      setGroups(nextGroups);
      setMemberCounts(Object.fromEntries(counts));
      setLoading(false);
    }
    void loadGroups();
  }, []);

  return (
    <main className="mobile-shell with-nav">
      <header className="app-header">
        <div>
          <p className="eyebrow">家族共有</p>
          <h1>共有先</h1>
        </div>
        <div className="header-actions">
          <Link className="secondary-action small" href="/mypage">マイページ</Link>
          <Link className="primary-action small" href="/appointments/new">予定登録</Link>
        </div>
      </header>

      {loading ? (
        <div className="empty-state">
          <h2>読み込み中です</h2>
          <p>共有先を確認しています。</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <h2>まだ共有先はありません</h2>
          <p>通院予定を登録すると、患者ごとの共有先が自動で作られます。</p>
          <Link className="primary-action full" href="/appointments/new">通院予定を登録する</Link>
        </div>
      ) : (
        <section className="group-list">
          {groups.map((group) => (
            <Link className="group-card" href={`/groups/${group.id}`} key={group.id}>
              <span className="patient-avatar" aria-hidden="true">{patientIcon(group.patient_icon)}</span>
              <div>
                <strong>{group.group_name}</strong>
                <p>{group.patient_name}さん / {group.relation}</p>
              </div>
              <span>{memberCounts[group.id] || 0}人</span>
            </Link>
          ))}
        </section>
      )}

      <BottomNav />
    </main>
  );
}
