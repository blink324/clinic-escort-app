"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { friendlyErrorMessage } from "@/lib/errors";
import { createGroup } from "@/lib/storage";

export default function NewGroupPage() {
  const router = useRouter();
  const [patientName, setPatientName] = useState("");
  const [relation, setRelation] = useState("");
  const [customRelation, setCustomRelation] = useState("");
  const [groupName, setGroupName] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const selectedRelation = relation === "その他" ? customRelation : relation;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
    try {
      const group = await createGroup({
        patient_name: patientName,
        relation: selectedRelation,
        group_name: groupName || `${patientName}の共有先`,
        memo
      });
      router.push(`/groups/${group.id}`);
    } catch (caught) {
      setSaveMessage(friendlyErrorMessage(caught, "共有先を作成できませんでした。入力内容と通信状況を確認してください。"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mobile-shell with-nav">
      <header className="app-header">
        <div>
          <p className="eyebrow">家族共有</p>
          <h1>共有先を作る</h1>
        </div>
        <Link className="text-button" href="/groups">戻る</Link>
      </header>

      <section className="attention-panel calm">
        <strong>通院予定の登録からも自動で作れます</strong>
        <p>先に予定を入れたい場合は、予定登録から始めるのがおすすめです。</p>
      </section>

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
          共有先の名前
          <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="母の共有先" />
        </label>
        <label>
          メモ
          <textarea rows={4} value={memo} onChange={(event) => setMemo(event.target.value)} />
        </label>
        {saveMessage && <p className="error-text">{saveMessage}</p>}
        <button className="primary-action full" disabled={saving} type="submit">
          {saving ? "作成中..." : "作成する"}
        </button>
      </form>
      <BottomNav />
    </main>
  );
}
