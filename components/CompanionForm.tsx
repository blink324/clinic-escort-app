"use client";

import { FormEvent, useState } from "react";
import { getCurrentUser, saveCompanion } from "@/lib/storage";
import type { AppointmentCompanion } from "@/lib/types";

type Props = {
  appointmentId: string;
  compact?: boolean;
  onSaved: (companion: AppointmentCompanion) => void;
};

export function CompanionForm({ appointmentId, compact = false, onSaved }: Props) {
  const user = getCurrentUser();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [contact, setContact] = useState(user?.email || "");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function becomeCompanion() {
    if (user && !compact) {
      setSaving(true);
      try {
        onSaved(await saveCompanion(appointmentId, { display_name: user.display_name, contact: user.email, user_id: user.id }));
      } finally {
        setSaving(false);
      }
      return;
    }
    setOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      onSaved(await saveCompanion(appointmentId, { display_name: displayName, contact, comment, user_id: user?.id ?? null }));
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="primary-action full" disabled={saving} onClick={becomeCompanion}>
        {saving ? "登録中..." : user ? "私が付き添う" : "名前を入力して付き添う"}
      </button>
    );
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <label>
        お名前
        <input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </label>
      <label>
        連絡先 任意
        <input value={contact} onChange={(event) => setContact(event.target.value)} />
      </label>
      <label>
        コメント 任意
        <textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} />
      </label>
      <div className="button-row">
        <button className="primary-action" disabled={saving} type="submit">
          {saving ? "登録中..." : "付き添い担当にする"}
        </button>
        <button className="text-button" type="button" onClick={() => setOpen(false)}>
          閉じる
        </button>
      </div>
    </form>
  );
}
