"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { getGroupMembers, getGroups } from "@/lib/storage";
import type { PatientGroup } from "@/lib/types";

export default function GroupsPage() {
  const [groups, setGroups] = useState<PatientGroup[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadGroups() {
      const nextGroups = await getGroups();
      const counts = await Promise.all(
        nextGroups.map(async (group) => [group.id, (await getGroupMembers(group.id)).length] as const)
      );
      setGroups(nextGroups);
      setMemberCounts(Object.fromEntries(counts));
    }
    void loadGroups();
  }, []);

  return (
    <main className="mobile-shell with-nav">
      <header className="app-header">
        <div>
          <p className="eyebrow">グループ</p>
          <h1>患者グループ</h1>
        </div>
        <Link className="primary-action small" href="/groups/new">作成</Link>
      </header>

      <section className="group-list">
        {groups.map((group) => (
          <Link className="group-card" href={`/groups/${group.id}`} key={group.id}>
            <div>
              <strong>{group.group_name}</strong>
              <p>{group.patient_name}さん / {group.relation}</p>
            </div>
            <span>{memberCounts[group.id] || 0}人</span>
          </Link>
        ))}
      </section>

      {groups.length === 0 && (
        <div className="empty-state">
          <h2>まだグループがありません</h2>
          <p>最初に、母・父・祖母など患者ごとの通院グループを作りましょう。</p>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
