"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { CompanionForm } from "@/components/CompanionForm";
import { LineNotificationButton } from "@/components/LineNotificationButton";
import { calendarFileName, createIcsFile, googleCalendarUrl } from "@/lib/calendar";
import { notifyCompanionAssigned } from "@/lib/line-notify-client";
import {
  deleteAppointment,
  deleteCompanion,
  getCurrentUser,
  getGroupMembers,
  saveCompanion,
  updateAppointment,
  updateAppointmentStatus
} from "@/lib/storage";
import { enabledReminderText, reminderTypeLabel } from "@/lib/reminders";
import type { AppointmentCompanion, AppointmentStatus, AppointmentView, GroupMember, ReminderType } from "@/lib/types";

type Props = {
  appointment: AppointmentView;
  shared?: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit"
});

export function AppointmentDetail({ appointment: initialAppointment, shared = false }: Props) {
  const router = useRouter();
  const [appointment, setAppointment] = useState(initialAppointment);
  const [copied, setCopied] = useState(false);
  const [editingCompanion, setEditingCompanion] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(false);
  const [selectingCompanion, setSelectingCompanion] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [editForm, setEditForm] = useState({
    hospital_name: initialAppointment.hospital_name,
    department: initialAppointment.department,
    appointment_datetime: initialAppointment.appointment_datetime.slice(0, 16),
    items_to_bring: initialAppointment.items_to_bring,
    memo: initialAppointment.memo,
    reminders: {
      one_week_before:
        initialAppointment.reminders.find((reminder) => reminder.reminder_type === "one_week_before")?.enabled ?? true,
      one_day_before:
        initialAppointment.reminders.find((reminder) => reminder.reminder_type === "one_day_before")?.enabled ?? true,
      same_day_morning:
        initialAppointment.reminders.find((reminder) => reminder.reminder_type === "same_day_morning")?.enabled ?? true
    } satisfies Record<ReminderType, boolean>
  });
  const user = getCurrentUser();
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/share/${appointment.share_token}`;
  }, [appointment.share_token]);
  const calendarUrl = useMemo(() => googleCalendarUrl(appointment), [appointment]);
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(
    `${appointment.group.patient_name}さんの通院予定\n${appointment.hospital_name} ${appointment.department}\n${dateFormatter.format(
      new Date(appointment.appointment_datetime)
    )}\n付き添い調整: ${shareUrl}`
  )}`;
  const companionNoticeLineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(
    `${appointment.group.patient_name}さんの通院付き添いが決まりました\n\n${dateFormatter.format(
      new Date(appointment.appointment_datetime)
    )}\n${appointment.hospital_name} / ${appointment.department}\n付き添い: ${
      appointment.companion?.display_name || "未定"
    }さん\n\n確認する: ${shareUrl}`
  )}`;
  const isMyCompanion = Boolean(user && appointment.companion?.user_id === user.id);

  useEffect(() => {
    if (!editingAppointment && !selectingCompanion) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editingAppointment, selectingCompanion]);

  useEffect(() => {
    async function loadMembers() {
      setMembers(await getGroupMembers(appointment.group_id));
    }
    void loadMembers();
  }, [appointment.group_id]);

  function setCompanion(companion: AppointmentCompanion) {
    setAppointment((current) => ({ ...current, companion }));
    setEditingCompanion(false);
    setSelectingCompanion(false);
    void notifyCompanionAssigned(appointment.id);
  }

  async function removeCompanion() {
    await deleteCompanion(appointment.id);
    setAppointment((current) => ({ ...current, companion: undefined }));
  }

  async function quickAssignMe() {
    if (!user) {
      setEditingCompanion(true);
      return;
    }
    setCompanion(await saveCompanion(appointment.id, { display_name: user.display_name, contact: user.email, user_id: user.id }));
  }

  async function assignMember(member: GroupMember) {
    setCompanion(
      await saveCompanion(appointment.id, {
        display_name: member.display_name,
        contact: member.contact,
        user_id: member.user_id
      })
    );
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function setStatus(status: AppointmentStatus) {
    await updateAppointmentStatus(appointment.id, status);
    setAppointment((current) => ({ ...current, status }));
  }

  function updateEditForm<K extends keyof typeof editForm>(key: K, value: (typeof editForm)[K]) {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  async function saveEditedAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAppointment(true);
    try {
      await updateAppointment(appointment.id, editForm);
      setAppointment((current) => ({
        ...current,
        hospital_name: editForm.hospital_name,
        department: editForm.department,
        appointment_datetime: editForm.appointment_datetime,
        items_to_bring: editForm.items_to_bring,
        memo: editForm.memo,
        reminders: current.reminders.map((reminder) => ({
          ...reminder,
          enabled: editForm.reminders[reminder.reminder_type]
        }))
      }));
      setEditingAppointment(false);
    } finally {
      setSavingAppointment(false);
    }
  }

  async function removeAppointment() {
    const ok = window.confirm("この通院予定を削除します。元に戻せません。");
    if (!ok) return;
    await deleteAppointment(appointment.id);
    router.push("/");
  }

  function downloadCalendarFile() {
    const blob = new Blob([createIcsFile(appointment)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = calendarFileName(appointment);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const isPast = new Date(appointment.appointment_datetime).getTime() < Date.now();

  return (
    <article className="detail-stack">
      <section className={appointment.companion ? "detail-hero" : "detail-hero needs-escort"}>
        <p className="eyebrow">{appointment.group.group_name}</p>
        <h1>{appointment.group.patient_name}さんの通院</h1>
        <p className="large-date">{dateFormatter.format(new Date(appointment.appointment_datetime))}</p>
        <div className="summary-tags">
          <span>{appointment.hospital_name}</span>
          <span>{appointment.department}</span>
          <span>{appointment.companion ? `付き添い: ${appointment.companion.display_name}さん` : "付き添い未定"}</span>
        </div>
      </section>

      {!shared && (
        <section className="next-actions">
          {!appointment.companion && (
            <button className="primary-action" onClick={() => void quickAssignMe()} type="button">
              自分が付き添う
            </button>
          )}
          <a className="line-action" href={lineUrl} target="_blank" rel="noreferrer">
            LINEで共有
          </a>
          <button className="secondary-action" onClick={downloadCalendarFile} type="button">
            カレンダー追加
          </button>
          <LineNotificationButton />
        </section>
      )}

      <section className="focus-panel">
        <div>
          <h2>付き添い担当</h2>
          {appointment.companion ? (
            <div className="escort-box ready">
              <strong>{appointment.companion.display_name}さん</strong>
              {isMyCompanion && <p>あなたが付き添い担当です。</p>}
              {appointment.companion.contact && <p>連絡先: {appointment.companion.contact}</p>}
              {appointment.companion.comment && <p>{appointment.companion.comment}</p>}
              <a className="line-action full notify-line" href={companionNoticeLineUrl} target="_blank" rel="noreferrer">
                LINEで家族に知らせる
              </a>
            </div>
          ) : (
            <div className="escort-box missing">
              <strong>まだ決まっていません</strong>
              <p>家族の誰かが付き添える場合は、この画面から担当できます。</p>
            </div>
          )}
        </div>
        <div className="button-column">
          {!appointment.companion && <CompanionForm appointmentId={appointment.id} compact={shared} onSaved={setCompanion} />}
          {appointment.companion && (
            <>
              {members.length > 1 || !isMyCompanion ? (
                <button className="secondary-action full" onClick={() => setSelectingCompanion(true)}>
                  担当者を変更
                </button>
              ) : null}
              <button className="danger-action full" onClick={() => void removeCompanion()}>
                担当者を削除
              </button>
            </>
          )}
          {editingCompanion && <CompanionForm appointmentId={appointment.id} compact onSaved={setCompanion} />}
        </div>
      </section>

      <section className="info-grid">
        <div className="info-panel">
          <h2>持ち物</h2>
          <p>{appointment.items_to_bring || "未登録"}</p>
        </div>
        <div className="info-panel">
          <h2>メモ</h2>
          <p>{appointment.memo || "未登録"}</p>
        </div>
        <div className="info-panel">
          <h2>リマインド</h2>
          <p>{enabledReminderText(appointment)}</p>
          <div className="mini-list">
            {appointment.reminders.map((reminder) => (
              <span key={reminder.id} className={reminder.enabled ? "mini-pill on" : "mini-pill"}>
                {reminderTypeLabel[reminder.reminder_type]} {reminder.enabled ? "ON" : "OFF"}
              </span>
            ))}
          </div>
        </div>
      </section>

      {appointment.reservation_image_url && (
        <section className="section-block compact">
          <h2>予約票写真</h2>
          <img className="reservation-image" src={appointment.reservation_image_url} alt="予約票" />
        </section>
      )}

      <section className="section-block compact">
        <h2>カレンダーに追加</h2>
        <div className="action-grid no-bottom">
          <a className="secondary-action" href={calendarUrl} target="_blank" rel="noreferrer">
            Googleカレンダー
          </a>
          <button className="secondary-action" onClick={downloadCalendarFile} type="button">
            iPhone/Appleカレンダー
          </button>
        </div>
      </section>

      {!shared && (
        <section className="action-grid">
          <button className="secondary-action" onClick={() => setEditingAppointment(true)}>
            予定を編集
          </button>
          <button className="danger-action" onClick={() => void removeAppointment()}>
            予定を削除
          </button>
          <a className="line-action" href={lineUrl} target="_blank" rel="noreferrer">
            LINEで予定共有
          </a>
          <button className="secondary-action" onClick={copyUrl}>
            {copied ? "コピーしました" : "共有URLをコピー"}
          </button>
        </section>
      )}

      {editingAppointment && !shared && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="appointment-edit-title">
          <section className="modal-panel">
            <div className="modal-header">
              <h2 id="appointment-edit-title">予定を編集</h2>
              <button className="text-button" onClick={() => setEditingAppointment(false)} type="button">
                閉じる
              </button>
            </div>
            <form className="inline-form" onSubmit={(event) => void saveEditedAppointment(event)}>
              <label>
                病院名
                <input
                  required
                  value={editForm.hospital_name}
                  onChange={(event) => updateEditForm("hospital_name", event.target.value)}
                />
              </label>
              <label>
                診療科
                <input
                  required
                  value={editForm.department}
                  onChange={(event) => updateEditForm("department", event.target.value)}
                />
              </label>
              <label>
                受診日時
                <input
                  required
                  type="datetime-local"
                  value={editForm.appointment_datetime}
                  onChange={(event) => updateEditForm("appointment_datetime", event.target.value)}
                />
              </label>
              <label>
                持ち物
                <textarea
                  rows={3}
                  value={editForm.items_to_bring}
                  onChange={(event) => updateEditForm("items_to_bring", event.target.value)}
                />
              </label>
              <label>
                メモ
                <textarea rows={4} value={editForm.memo} onChange={(event) => updateEditForm("memo", event.target.value)} />
              </label>
              <fieldset className="reminder-fieldset">
                <legend>リマインド設定</legend>
                {[
                  ["one_week_before", "1週間前"],
                  ["one_day_before", "前日"],
                  ["same_day_morning", "当日朝"]
                ].map(([key, label]) => (
                  <label className="switch-line" key={key}>
                    <span>{label}</span>
                    <input
                      checked={editForm.reminders[key as ReminderType]}
                      onChange={(event) =>
                        updateEditForm("reminders", {
                          ...editForm.reminders,
                          [key]: event.target.checked
                        })
                      }
                      type="checkbox"
                    />
                  </label>
                ))}
              </fieldset>
              <button className="primary-action full" disabled={savingAppointment} type="submit">
                {savingAppointment ? "保存中..." : "変更を保存"}
              </button>
            </form>
          </section>
        </div>
      )}

      {selectingCompanion && (
        <div className="modal-backdrop top-modal" role="dialog" aria-modal="true" aria-labelledby="companion-select-title">
          <section className="modal-panel">
            <div className="modal-header">
              <h2 id="companion-select-title">担当者を変更</h2>
              <button className="text-button" onClick={() => setSelectingCompanion(false)} type="button">
                閉じる
              </button>
            </div>
            <div className="history-list">
              {members.map((member) => (
                <button className="history-card" key={member.id} onClick={() => void assignMember(member)} type="button">
                  <strong>{member.display_name}</strong>
                  <span>{member.contact || "連絡先未登録"}</span>
                </button>
              ))}
              <button
                className="secondary-action full"
                onClick={() => {
                  setSelectingCompanion(false);
                  setEditingCompanion(true);
                }}
                type="button"
              >
                名前を入力して変更
              </button>
            </div>
          </section>
        </div>
      )}

      {isPast && !shared && (
        <section className="section-block compact">
          <h2>受診後の確認</h2>
          <div className="action-grid">
            <button className="primary-action" onClick={() => void setStatus("completed")}>
              受診完了
            </button>
            <button className="secondary-action" onClick={() => void setStatus("missed")}>
              未受診
            </button>
            <Link className="secondary-action" href={`/appointments/new?group=${appointment.group_id}`}>
              次の予定を登録
            </Link>
          </div>
        </section>
      )}
    </article>
  );
}
