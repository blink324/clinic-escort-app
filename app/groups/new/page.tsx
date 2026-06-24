"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { createGroup } from "@/lib/storage";

export default function NewGroupPage() {
  const router = useRouter();
  const [patientName, setPatientName] = useState("");
  const [relation, setRelation] = useState("");
  const [groupName, setGroupName] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const group = await createGroup({
        patient_name: patientName,
        relation,
        group_name: groupName || `${patientName}の通院グループ`,
        memo
      });
      router.push(`/groups/${group.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mobile-shell with-nav">
      <header className="app-header">
        <div>
          <p className="eyebrow">グループ作成</p>
          <h1>患者グループを作る</h1>
        </div>
        <Link className="text-button" href="/groups">戻る</Link>
      </header>

      <form className="form-grid" onSubmit={submit}>
        <label>
          患者名
          <input required value={patientName} onChange={(event) => setPatientName(event.target.value)} />
        </label>
        <label>
          続柄
          <input required value={relation} onChange={(event) => setRelation(event.target.value)} placeholder="母、父、祖母など" />
        </label>
        <label>
          グループ名
          <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="母の通院グループ" />
        </label>
        <label>
          メモ
          <textarea rows={4} value={memo} onChange={(event) => setMemo(event.target.value)} />
        </label>
        <button className="primary-action full" disabled={saving} type="submit">
          {saving ? "作成中..." : "作成する"}
        </button>
      </form>
      <BottomNav />
    </main>
  );
}
