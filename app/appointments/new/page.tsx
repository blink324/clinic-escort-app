"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { friendlyErrorMessage } from "@/lib/errors";
import { createGroup, getAppointments, getGroups, saveAppointment } from "@/lib/storage";
import type { AppointmentInput, AppointmentView, PatientGroup, ReminderType } from "@/lib/types";

const reminderTypes: { key: ReminderType; label: string }[] = [
  { key: "one_week_before", label: "1週間前" },
  { key: "one_day_before", label: "前日" },
  { key: "same_day_morning", label: "当日朝" }
];

export default function NewAppointmentPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<PatientGroup[]>([]);
  const [history, setHistory] = useState<AppointmentView[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [groupMode, setGroupMode] = useState<"existing" | "new">("new");
  const [patientName, setPatientName] = useState("");
  const [relation, setRelation] = useState("");
  const [customRelation, setCustomRelation] = useState("");
  const [form, setForm] = useState<AppointmentInput>({
    group_id: "",
    hospital_name: "",
    department: "",
    appointment_datetime: "",
    items_to_bring: "",
    memo: "",
    reservation_image_url: "",
    reminders: { one_week_before: true, one_day_before: true, same_day_morning: true }
  });

  useEffect(() => {
    async function loadGroups() {
      const nextGroups = await getGroups();
      const nextAppointments = await getAppointments();
      const urlGroup = new URLSearchParams(window.location.search).get("group");
      setGroups(nextGroups);
      setHistory(nextAppointments);
      setGroupMode(urlGroup || nextGroups.length > 0 ? "existing" : "new");
      setForm((current) => ({ ...current, group_id: urlGroup || nextGroups[0]?.id || "" }));
    }
    void loadGroups();
  }, []);

  function update<K extends keyof AppointmentInput>(key: K, value: AppointmentInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const appointmentHistory = useMemo(() => {
    const seen = new Set<string>();
    return history.filter((appointment) => {
      const key = `${appointment.hospital_name}__${appointment.department}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [history]);

  function applyHistory(appointment: AppointmentView) {
    setForm((current) => ({
      ...current,
      hospital_name: appointment.hospital_name,
      department: appointment.department,
      items_to_bring: appointment.items_to_bring,
      memo: appointment.memo
    }));
    setHistoryOpen(false);
  }

  function handleImage(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("reservation_image_url", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
    try {
      let groupId = form.group_id;
      if (groupMode === "new" || !groupId) {
        const selectedRelation = relation === "その他" ? customRelation : relation;
        const group = await createGroup({
          patient_name: patientName,
          relation: selectedRelation || "本人",
          group_name: `${patientName}の共有先`,
          memo: ""
        });
        groupId = group.id;
      }
      const appointment = await saveAppointment({ ...form, group_id: groupId });
      router.push(`/appointments/${appointment.id}`);
    } catch (caught) {
      setSaveMessage(friendlyErrorMessage(caught, "通院予定を登録できませんでした。入力内容と通信状況を確認してください。"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mobile-shell with-nav">
      <header className="app-header">
        <div>
          <p className="eyebrow">予定登録</p>
          <h1>通院予定を追加</h1>
        </div>
        <Link className="text-button" href="/">戻る</Link>
      </header>

      <form className="form-grid" onSubmit={submit}>
        {groups.length > 0 && (
          <fieldset className="reminder-fieldset">
            <legend>患者</legend>
            <label className="switch-line">
              <span>登録済みの共有先から選ぶ</span>
              <input
                checked={groupMode === "existing"}
                name="group-mode"
                onChange={() => setGroupMode("existing")}
                type="radio"
              />
            </label>
            <label className="switch-line">
              <span>新しく患者名を入力する</span>
              <input
                checked={groupMode === "new"}
                name="group-mode"
                onChange={() => setGroupMode("new")}
                type="radio"
              />
            </label>
          </fieldset>
        )}

        {groupMode === "existing" && groups.length > 0 ? (
          <label>
            共有先
            <select required value={form.group_id} onChange={(event) => update("group_id", event.target.value)}>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.group_name}</option>
              ))}
            </select>
          </label>
        ) : (
          <>
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
                <option value="本人">本人</option>
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
                  placeholder="叔母、兄など"
                />
              </label>
            )}
          </>
        )}
        <section className="history-prompt">
          <div>
            <strong>前と同じ病院なら</strong>
            <p>過去の予定から病院名や診療科を呼び出せます。</p>
          </div>
          <button className="secondary-action small" onClick={() => setHistoryOpen(true)} type="button">
            履歴
          </button>
        </section>
        <label>
          病院名
          <input required value={form.hospital_name} onChange={(event) => update("hospital_name", event.target.value)} />
        </label>
        <label>
          診療科
          <input required value={form.department} onChange={(event) => update("department", event.target.value)} />
        </label>
        <label>
          受診日時
          <input required type="datetime-local" value={form.appointment_datetime} onChange={(event) => update("appointment_datetime", event.target.value)} />
        </label>
        <label>
          持ち物
          <textarea rows={3} value={form.items_to_bring} onChange={(event) => update("items_to_bring", event.target.value)} />
        </label>
        <label>
          メモ
          <textarea rows={4} value={form.memo} onChange={(event) => update("memo", event.target.value)} />
        </label>

        <fieldset className="reminder-fieldset">
          <legend>リマインド設定</legend>
          {reminderTypes.map((reminder) => (
            <label className="switch-line" key={reminder.key}>
              <span>{reminder.label}</span>
              <input
                type="checkbox"
                checked={form.reminders[reminder.key]}
                onChange={(event) =>
                  update("reminders", { ...form.reminders, [reminder.key]: event.target.checked })
                }
              />
            </label>
          ))}
        </fieldset>

        <label className="upload-box">
          予約票写真 任意
          <input accept="image/*" type="file" onChange={(event) => handleImage(event.target.files?.[0])} />
          <span>写真を選ぶ</span>
        </label>
        {form.reservation_image_url && <img className="reservation-preview" src={form.reservation_image_url} alt="予約票プレビュー" />}

        {saveMessage && <p className="error-text">{saveMessage}</p>}
        <button className="primary-action full" disabled={saving} type="submit">
          {saving ? "登録中..." : "登録する"}
        </button>
      </form>

      {historyOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="history-title">
          <section className="modal-panel">
            <div className="modal-header">
              <h2 id="history-title">予約履歴から選ぶ</h2>
              <button className="text-button" onClick={() => setHistoryOpen(false)} type="button">
                閉じる
              </button>
            </div>
            <div className="history-list">
              {appointmentHistory.length === 0 ? (
                <div className="empty-state">
                  <h2>まだ履歴がありません</h2>
                  <p>予定を登録すると、次回からここに表示されます。</p>
                </div>
              ) : (
                appointmentHistory.map((appointment) => (
                  <button className="history-card" key={appointment.id} onClick={() => applyHistory(appointment)} type="button">
                    <strong>{appointment.hospital_name}</strong>
                    <span>{appointment.department}</span>
                    <small>{appointment.group.patient_name}さんの過去予定</small>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      )}
      <BottomNav />
    </main>
  );
}
