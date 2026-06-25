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
  const [customRelation, setCustomRelation] = useState("");
  const [groupName, setGroupName] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedRelation = relation === "その他" ? customRelation : relation;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const group = await createGroup({
        patient_name: patientName,
        relation: selectedRelation,
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
          <select required value={relation} onChange={(event) => setRelation(event.target.value)}>
            <option value="">選択してください</option>
            <option value="母">母</option>
            <option value="父">父</option>
            <option value="祖母">祖母</option>
            <option value="祖父">祖父</option>
            <option value="配偶者">配偶者</option>
            <option value="義母">義母</option>
            <option value="義父">義父</option>
            <option value="その他">その他</option>
          </select>
        </label>
        {relation === "その他" && (
          <label>
            その他の続柄
            <input
              required
              value={customRelation}
              onChange={(event) => setCustomRelation(event.target.value)}
              placeholder="叔母、兄、本人など"
            />
          </label>
        )}
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
